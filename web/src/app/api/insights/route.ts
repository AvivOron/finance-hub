import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import Anthropic from '@anthropic-ai/sdk'
import { AppData, MonthlySnapshot } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(data: AppData, currency: string, language: string = 'en'): string {
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
    let line = `  - ${a.name} (${a.type}, kind=${a.kind ?? 'custom'}${a.owner ? `, owner=${a.owner}` : ''})`
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
      return `  - ${account.name} (${account.type}): ${currencySymbol}${e.balance.toLocaleString()}${subInfo ? ` [${subInfo}]` : ''}${account.kind === 'bank' && e.subBalances?.investments ? ' (note: investments sub-balance is already invested in stocks/securities, not idle cash)' : ''}`
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

  return `You are a personal financial advisor. Analyze the following financial data and provide clear, actionable insights and recommendations. Be specific, reference actual numbers from the data, and prioritize the most impactful advice. Use a friendly but professional tone. The user's currency is ${currency} (${currencySymbol}).${languageInstruction}

## Financial Data

**Family members:** ${familyMembers || 'Not specified'}

**Accounts:**
${accountsSummary || '  None'}

**Net worth history (chronological):**
${snapshotSummary || '  No snapshots yet'}

**Latest snapshot breakdown (${latest?.date ?? 'N/A'}):**
${latestBreakdown || '  No data'}

**Income sources (active):**
${incomeSummary || '  None'}
  Total monthly gross: ${currencySymbol}${totalMonthlyGross.toLocaleString()}
  Total monthly net: ${currencySymbol}${totalMonthlyNet.toLocaleString()}

**Recurring expenses (active):**
${expenseSummary || '  None'}
  Total monthly: ${currencySymbol}${totalMonthlyExpenses.toLocaleString()}
  By category: ${Object.entries(expensesByCategory).map(([k, v]) => `${k}=${currencySymbol}${Math.round(v).toLocaleString()}`).join(', ') || 'N/A'}

**Monthly cash flow:**
  Net income: ${currencySymbol}${totalMonthlyNet.toLocaleString()}
  Expenses: ${currencySymbol}${totalMonthlyExpenses.toLocaleString()}
  Surplus/deficit: ${currencySymbol}${(totalMonthlyNet - totalMonthlyExpenses).toLocaleString()}
${savingsRate !== null ? `  Savings rate: ${savingsRate}%` : ''}

## Instructions

Provide financial insights structured as follows. Use markdown with ## headers for each section. Be concise but specific — reference actual numbers.

## Net Worth Trajectory
Analyze the trend. Is it growing? At what pace? Any concerns?

## Cash Flow & Savings Rate
Evaluate income vs expenses. Is the savings rate healthy? What's notable?

## Asset Allocation
Analyze the mix of account types (bank, brokerage, etc.). Is it well-diversified? Note: for bank accounts, the "investments" sub-balance represents money already invested in stocks/securities — do NOT recommend moving it to investments. Only the "checking" and "savings" sub-balances are liquid cash.

## Debt & Liabilities
Comment on liabilities. Debt-to-asset ratio, any red flags?

## Top Recommendations
Give 3–5 specific, prioritized action items the user should take. Be direct and concrete. Remember: bank "investments" sub-balances are already in stocks — do not recommend investing money that is already invested.`
}

function isAppData(data: any): data is AppData {
  return data && Array.isArray(data.accounts) && Array.isArray(data.snapshots) && Array.isArray(data.familyMembers);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { currency = 'NIS', language = 'en' } = await request.json()

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const userData = await prisma.userData.findUnique({
    where: { userId: effectiveUserId }
  })

  const data = isAppData(userData?.data) ? userData.data : { accounts: [], snapshots: [], familyMembers: [] };

  const prompt = buildPrompt(data, currency, language)

  const stream = await client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
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
