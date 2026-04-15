import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import { assembleAppData } from '@/lib/data'
import Anthropic from '@anthropic-ai/sdk'
import { AppData, MonthlySnapshot, Property } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(data: AppData, currency: string, language: string = 'en', properties: Property[] = [], variableExpensesByCategory: Record<string, number> = {}): string {
  const currencySymbol = currency === 'NIS' ? '₪' : '$'
  const languageInstruction = language === 'he'
    ? '\n\nIMPORTANT: You MUST respond entirely in Hebrew (עברית). Use Hebrew formatting and conventions.'
    : ''

  // Net worth history
  const snapshots = [...data.snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const snapshotSummary = snapshots.map((s: MonthlySnapshot) => {
    let assets = 0
    let liabilities = 0
    for (const e of s.entries) {
      const account = data.accounts.find((a) => a.id === e.accountId)
      if (!account) continue
      if (account.type === 'asset') assets += e.balance
      else liabilities += e.balance
    }
    return `  ${s.date}: assets=${currencySymbol}${assets.toLocaleString()}, liabilities=${currencySymbol}${liabilities.toLocaleString()}, net worth=${currencySymbol}${(assets - liabilities).toLocaleString()}`
  }).join('\n')

  // Accounts
  const accountsSummary = data.accounts.map((a) => {
    const liquidityTag = a.type === 'asset' ? `, liquidity=${a.liquidity ?? 'liquid'}` : ''
    let line = `  - ${a.name} (${a.type}, kind=${a.kind ?? 'custom'}${liquidityTag}${a.owner ? `, owner=${a.owner}` : ''})`
    if (a.monthlyDeposit != null) line += `, monthly deposit=${currencySymbol}${a.monthlyDeposit.toLocaleString()}`
    if (a.feesFixed != null) line += `, monthly fee=${currencySymbol}${a.feesFixed.toLocaleString()}`
    if (a.feesOnBalance != null) line += `, management fee on balance=${a.feesOnBalance}%/year`
    if (a.feesOnDeposit != null) line += `, management fee on deposit=${a.feesOnDeposit}%`
    if (a.description) line += ` — "${a.description}"`
    return line
  }).join('\n')

  // Latest snapshot breakdown
  const latest = snapshots[snapshots.length - 1]
  let latestBreakdown = ''
  if (latest) {
    latestBreakdown = latest.entries.map((e) => {
      const account = data.accounts.find((a) => a.id === e.accountId)
      if (!account) return ''
      const subInfo = e.subBalances
        ? Object.entries(e.subBalances).map(([k, v]) => `${k}=${currencySymbol}${v.toLocaleString()}`).join(', ')
        : ''
      const liquidityTag = account.type === 'asset' ? ` [${account.liquidity ?? 'liquid'}]` : ''
      return `  - ${account.name} (${account.type}${liquidityTag}): ${currencySymbol}${e.balance.toLocaleString()}${subInfo ? ` [${subInfo}]` : ''}${account.kind === 'bank' && e.subBalances?.investments ? ' (note: investments sub-balance is already invested in stocks/securities, not idle cash)' : ''}`
    }).filter(Boolean).join('\n')
  }

  // Income
  const activeIncome = (data.income ?? []).filter((i) => i.active)
  const totalMonthlyGross = activeIncome.reduce((s, i) =>
    s + (i.billingCycle === 'yearly' ? i.grossAmount / 12 : i.grossAmount), 0)
  const totalMonthlyNet = activeIncome.reduce((s, i) =>
    s + (i.billingCycle === 'yearly' ? i.netAmount / 12 : i.netAmount), 0)
  const incomeSummary = activeIncome.map((i) =>
    `  - ${i.name}${i.owner ? ` (${i.owner})` : ''}: gross=${currencySymbol}${i.grossAmount.toLocaleString()}/${i.billingCycle}, net=${currencySymbol}${i.netAmount.toLocaleString()}/${i.billingCycle}`
  ).join('\n')

  // Expenses
  const activeExpenses = (data.expenses ?? []).filter((e) => e.active)
  const totalMonthlyExpenses = activeExpenses.reduce((s, e) =>
    s + (e.billingCycle === 'yearly' ? e.amount / 12 : e.amount), 0)
  const expensesByCategory: Record<string, number> = {}
  for (const e of activeExpenses) {
    const monthly = e.billingCycle === 'yearly' ? e.amount / 12 : e.amount
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + monthly
  }
  const expenseSummary = activeExpenses.map((e) =>
    `  - ${e.name} [${e.category}]${e.owner ? ` (${e.owner})` : ''}: ${currencySymbol}${e.amount.toLocaleString()}/${e.billingCycle}`
  ).join('\n')

  const savingsRate = totalMonthlyNet > 0
    ? (((totalMonthlyNet - totalMonthlyExpenses) / totalMonthlyNet) * 100).toFixed(1)
    : null

  const familyMembers = (data.familyMembers ?? []).map((m: any) =>
    typeof m === 'string' ? m : `${m.name}${m.isChild ? ' (child)' : ''}`
  ).join(', ')

  // Holdings summary
  let holdingsSummary = ''
  const accountHoldings = data.accountHoldings ?? []
  if (accountHoldings.length > 0) {
    holdingsSummary = accountHoldings.map((ah) => {
      const account = data.accounts.find((a) => a.id === ah.accountId)
      const accountName = account?.name ?? 'Unknown'
      const holdings = ah.holdings
        .map((h) => {
          let line = `    - ${h.name} (paper #${h.paperNumber}): ${h.quantity.toLocaleString()} shares @ ${currencySymbol}${h.lastPrice.toLocaleString()}`
          line += ` = ${currencySymbol}${h.valueNIS.toLocaleString()}`
          if (h.gainFromCostPct !== 0) {
            line += ` (${h.gainFromCostPct > 0 ? '+' : ''}${h.gainFromCostPct.toFixed(2)}% gain, ${currencySymbol}${h.gainFromCostNIS.toLocaleString()})`
          }
          if (h.managementFee !== undefined) {
            line += ` [fee: ${h.managementFee.toFixed(2)}%/year]`
          }
          if (h.category) {
            line += ` (${h.category})`
          }
          return line
        })
        .join('\n')
      return `  **${accountName}** (total: ${currencySymbol}${ah.totalValueNIS.toLocaleString()}):\n${holdings}`
    }).join('\n\n')
  }

  // Variable expenses (transaction-based, non-recurring)
  let variableExpensesSummary = ''
  let totalMonthlyVariable = 0
  const varEntries = Object.entries(variableExpensesByCategory)
    .filter(([, avg]) => (avg as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][]
  if (varEntries.length > 0) {
    totalMonthlyVariable = varEntries.reduce((s, [, avg]) => s + avg, 0)
    variableExpensesSummary = varEntries
      .map(([cat, avg]) => `  - ${cat}: ${currencySymbol}${Math.round(avg).toLocaleString()}/month (avg)`)
      .join('\n')
  }

  // Liquidity breakdown from latest snapshot
  let liquidityBreakdown = ''
  if (latest) {
    let liquidTotal = 0
    let pensionTotal = 0
    for (const e of latest.entries) {
      const account = data.accounts.find((a) => a.id === e.accountId)
      if (!account || account.type !== 'asset') continue
      if (account.liquidity === 'pension') pensionTotal += e.balance
      else liquidTotal += e.balance
    }
    const hasPension = data.accounts.some((a) => a.type === 'asset' && a.liquidity === 'pension')
    if (hasPension) {
      liquidityBreakdown = `  Liquid assets: ${currencySymbol}${liquidTotal.toLocaleString()}\n  Pension/retirement assets (illiquid): ${currencySymbol}${pensionTotal.toLocaleString()}\n  Liquid % of total assets: ${liquidTotal + pensionTotal > 0 ? ((liquidTotal / (liquidTotal + pensionTotal)) * 100).toFixed(1) : 0}%`
    }
  }

  // Properties
  let propertiesSummary = ''
  if (properties.length > 0) {
    const totalPropertyValue = properties.reduce((s, p) => s + p.estimatedValue, 0)
    propertiesSummary = properties.map(p => {
      let line = `  - ${p.name} (${p.propertyType}): estimated value=${currencySymbol}${p.estimatedValue.toLocaleString()}, valued on ${p.valuationDate}`
      if (p.address) line += `, address: ${p.address}`
      if (p.description) line += ` — "${p.description}"`
      if (p.notes) line += ` [notes: ${p.notes}]`
      return line
    }).join('\n')
    propertiesSummary += `\n  Total estimated property value: ${currencySymbol}${totalPropertyValue.toLocaleString()}`
  }

  return `You are a personal financial advisor. Analyze the following financial data and provide clear, actionable insights and recommendations. Be specific, reference actual numbers from the data, and prioritize the most impactful advice. Use a friendly but professional tone. The user's currency is ${currency} (${currencySymbol}).${languageInstruction}

## Financial Data

**Family members:** ${familyMembers || 'Not specified'}

**Accounts:**
${accountsSummary || '  None'}

**Net worth history (chronological):**
${snapshotSummary || '  No snapshots yet'}

**Latest snapshot breakdown (${latest?.date ?? 'N/A'}):**
${latestBreakdown || '  No data'}
${liquidityBreakdown ? `\n**Asset liquidity breakdown:**\n${liquidityBreakdown}` : ''}

**Income sources (active):**
${incomeSummary || '  None'}
  Total monthly gross: ${currencySymbol}${totalMonthlyGross.toLocaleString()}
  Total monthly net: ${currencySymbol}${totalMonthlyNet.toLocaleString()}

**Recurring expenses (active):**
${expenseSummary || '  None'}
  Total monthly: ${currencySymbol}${totalMonthlyExpenses.toLocaleString()}
  By category: ${Object.entries(expensesByCategory).map(([k, v]) => `${k}=${currencySymbol}${Math.round(v).toLocaleString()}`).join(', ') || 'N/A'}
${variableExpensesSummary ? `
**Variable / non-recurring expenses (monthly averages from transaction history):**
${variableExpensesSummary}
  Total monthly avg: ${currencySymbol}${Math.round(totalMonthlyVariable).toLocaleString()}` : ''}

**Monthly cash flow:**
  Net income: ${currencySymbol}${totalMonthlyNet.toLocaleString()}
  Recurring expenses: ${currencySymbol}${totalMonthlyExpenses.toLocaleString()}${totalMonthlyVariable > 0 ? `
  Variable expenses (avg): ${currencySymbol}${Math.round(totalMonthlyVariable).toLocaleString()}
  Total expenses: ${currencySymbol}${Math.round(totalMonthlyExpenses + totalMonthlyVariable).toLocaleString()}
  Surplus/deficit: ${currencySymbol}${Math.round(totalMonthlyNet - totalMonthlyExpenses - totalMonthlyVariable).toLocaleString()}` : `
  Surplus/deficit: ${currencySymbol}${(totalMonthlyNet - totalMonthlyExpenses).toLocaleString()}`}
${savingsRate !== null && totalMonthlyVariable === 0 ? `  Savings rate: ${savingsRate}%` : ''}${totalMonthlyVariable > 0 && totalMonthlyNet > 0 ? `  Savings rate: ${(((totalMonthlyNet - totalMonthlyExpenses - totalMonthlyVariable) / totalMonthlyNet) * 100).toFixed(1)}%` : ''}
${holdingsSummary ? `

**Investment Holdings:**
${holdingsSummary}` : ''}
${propertiesSummary ? `

**Real Estate / Properties:**
${propertiesSummary}` : ''}

## Instructions

Provide financial insights structured as follows. Use markdown with ## headers for each section. Be concise but specific — reference actual numbers.

## Net Worth Trajectory
Analyze the trend. Is it growing? At what pace? Any concerns?

## Cash Flow & Savings Rate
Evaluate income vs expenses. Is the savings rate healthy? What's notable?

## Asset Allocation
Analyze the mix of account types (bank, brokerage, real estate, etc.). Is it well-diversified? Note: for bank accounts, the "investments" sub-balance represents money already invested in stocks/securities — do NOT recommend moving it to investments. Only the "checking" and "savings" sub-balances are liquid cash. If real estate is present, include it in the overall asset picture. Comment on the liquid vs pension/retirement split — is the user over- or under-allocated to illiquid retirement assets relative to their stage of life and cash flow?

## Emergency Fund
When evaluating emergency cash availability, count: (1) bank checking/savings balances, AND (2) any holdings identified as קרן כספית (money market fund) — these are redeemable within 1 business day and should be treated as near-cash. Do NOT count brokerage stocks, bonds, or pension/retirement assets as emergency-accessible. Assess whether the total covers 3–6 months of expenses.

## Debt & Liabilities
Comment on liabilities. Debt-to-asset ratio, any red flags?

## Top Recommendations
Give 3–5 specific, prioritized action items the user should take. Be direct and concrete. Remember: bank "investments" sub-balances are already in stocks — do not recommend investing money that is already invested.`
}


export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { currency = 'NIS', language = 'en' } = await request.json()

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const [data, dbProperties, allTxns] = await Promise.all([
    assembleAppData(effectiveUserId),
    prisma.property.findMany({ where: { userId: effectiveUserId }, orderBy: { createdAt: 'asc' } }).catch(() => []),
    prisma.transaction.findMany({
      where: { userId: effectiveUserId, mappingStatus: { not: 'ignored' } },
      select: { month: true, amount: true, overrideAmount: true, expenseCategory: true, recurringExpenseId: true, variableExpenseId: true },
    }).catch(() => []),
  ])

  const properties = dbProperties as Property[]

  // byExpense: variable-mapped txns grouped by expenseId → month → total
  const byExpense: Record<string, Record<string, number>> = {}
  // byCategory: unmapped txns grouped by category → month → total
  const byCategory: Record<string, Record<string, number>> = {}
  for (const tx of allTxns) {
    const amt = ((tx.overrideAmount ?? tx.amount) as number)
    const vid = (tx as any).variableExpenseId as string | null
    const rid = tx.recurringExpenseId as string | null
    if (vid) {
      if (!byExpense[vid]) byExpense[vid] = {}
      byExpense[vid][tx.month] = (byExpense[vid][tx.month] ?? 0) + amt
    } else if (!rid) {
      // not linked to any expense — bucket by category
      const cat = (tx.expenseCategory as string | null) ?? 'other'
      if (!byCategory[cat]) byCategory[cat] = {}
      byCategory[cat][tx.month] = (byCategory[cat][tx.month] ?? 0) + amt
    }
    // transactions mapped to a recurring expense are already in the recurring section — skip
  }
  // Rolling avg over up to last 12 months that have data (same as Expenses.tsx)
  function rollingAvg(byMonth: Record<string, number>): number {
    const sorted = Object.keys(byMonth).sort().slice(-12)
    if (sorted.length === 0) return 0
    return sorted.reduce((s, m) => s + byMonth[m], 0) / sorted.length
  }
  // Combine into per-category averages (variable-mapped use their category from variableExpenses)
  const variableExpensesByCategory: Record<string, number> = {}
  for (const [cat, byMonth] of Object.entries(byCategory)) {
    variableExpensesByCategory[cat] = (variableExpensesByCategory[cat] ?? 0) + rollingAvg(byMonth)
  }
  for (const ve of (data.variableExpenses ?? []) as any[]) {
    const byMonth = byExpense[ve.id]
    if (!byMonth) continue
    const cat = ve.category ?? 'other'
    variableExpensesByCategory[cat] = (variableExpensesByCategory[cat] ?? 0) + rollingAvg(byMonth)
  }

  const prompt = buildPrompt(data, currency, language, properties, variableExpensesByCategory)

  const stream = await client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  })

  const encoder = new TextEncoder()
  let fullContent = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullContent += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Persist insights after streaming completes (optional - will fail gracefully if column doesn't exist)
        try {
          await (prisma.userData.update as any)({
            where: { userId: effectiveUserId },
            data: {
              aiInsights: {
                content: fullContent,
                language,
                generatedAt: new Date().toISOString()
              }
            }
          })
        } catch (persistError: any) {
          // P2022 = column doesn't exist (migration not applied yet)
          if (persistError?.code !== 'P2022') {
            console.error('Failed to persist insights:', persistError)
          }
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
