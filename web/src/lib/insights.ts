/**
 * Shared prompt building and thread storage for AI insights.
 * Used by POST /api/insights (new report) and POST /api/insights/chat (replies).
 */

import { prisma } from './prisma'
import { assembleAppData } from './data'
import { variableSpendingAverage, buildTxSummary } from './variable-spending'
import { readThread } from './insights-thread'
import { expenseMonthlyAmount } from '@/utils'
import type { AppData, MonthlySnapshot, Property, InsightsMessage } from '@/types'
import type Anthropic from '@anthropic-ai/sdk'

export const INSIGHTS_MODEL = 'claude-opus-5-5'

// How much of the thread to send back to the model
const MAX_HISTORY_MESSAGES = 40
const MAX_USER_NOTES = 30
// How much of the thread to keep in storage
const MAX_STORED_MESSAGES = 200

export interface InsightsContext {
  data: AppData
  properties: Property[]
  variableExpensesByCategory: Record<string, number>
}

export async function loadInsightsContext(userId: string): Promise<InsightsContext> {
  const [data, dbProperties, txns] = await Promise.all([
    assembleAppData(userId),
    prisma.property.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }).catch(() => []),
    prisma.transaction.findMany({
      where: { userId, mappingStatus: { not: 'ignored' } },
      select: { month: true, amount: true, overrideAmount: true, mappingStatus: true, expenseCategory: true, recurringExpenseId: true, variableExpenseId: true },
    }).catch(() => []),
  ])

  // Same numbers as the dashboard's variable average
  const variableExpensesByCategory =
    variableSpendingAverage(buildTxSummary(txns), data.variableExpenses ?? [])?.byCategory ?? {}

  return { data, properties: dbProperties as Property[], variableExpensesByCategory }
}

function buildFinancialData({ data, properties, variableExpensesByCategory }: InsightsContext, currency: string): string {
  const currencySymbol = currency === 'NIS' ? '₪' : '$'

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
    s + expenseMonthlyAmount(e), 0)
  const expensesByCategory: Record<string, number> = {}
  for (const e of activeExpenses) {
    const monthly = expenseMonthlyAmount(e)
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

  return `## Financial Data

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
${propertiesSummary}` : ''}`
}

function languageInstruction(language: string): string {
  return language === 'he'
    ? '\n\nIMPORTANT: You MUST respond entirely in Hebrew (עברית). Use Hebrew formatting and conventions.'
    : ''
}

function advisorIntro(currency: string): string {
  const currencySymbol = currency === 'NIS' ? '₪' : '$'
  return `You are a personal financial advisor. Be specific, reference actual numbers from the data, and use a friendly but professional tone. The user's currency is ${currency} (${currencySymbol}).`
}

// Everything the user has replied in the thread, so new reports take it into account
function userNotesSection(thread: InsightsMessage[]): string {
  const notes = thread.filter(m => m.role === 'user').slice(-MAX_USER_NOTES)
  if (notes.length === 0) return ''
  return `

## What the user has told you

In earlier conversations about previous reports, the user said the following (oldest first). Treat these as facts about their situation that override your own inferences from the numbers — for example, if they sold an asset, a change in net worth is explained by that sale, not by market movement. Don't repeat advice they've already explained away.

${notes.map(n => `- [${n.at.slice(0, 10)}] ${n.content}`).join('\n')}`
}

const REPORT_INSTRUCTIONS = `## Instructions

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

export function buildReportPrompt(ctx: InsightsContext, currency: string, language: string, thread: InsightsMessage[]): string {
  return `${advisorIntro(currency)} Analyze the following financial data and provide clear, actionable insights and recommendations, prioritizing the most impactful advice.${languageInstruction(language)}

${buildFinancialData(ctx, currency)}${userNotesSection(thread)}

${REPORT_INSTRUCTIONS}`
}

export function buildChatSystem(ctx: InsightsContext, currency: string, language: string): string {
  return `${advisorIntro(currency)} You previously wrote financial insights reports for this user, which appear in the conversation. The user is now replying — answering, correcting or adding context. Respond conversationally and concisely (not a full report): acknowledge new facts, explain how they change your earlier analysis, and update any recommendation they affect. Use markdown sparingly.${languageInstruction(language)}

${buildFinancialData(ctx, currency)}`
}

// The conversation as API messages. Reports become assistant turns after a synthetic request.
export function threadToMessages(thread: InsightsMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of thread.slice(-MAX_HISTORY_MESSAGES)) {
    if (m.kind === 'report') out.push({ role: 'user', content: 'Please write my financial insights report.' })
    out.push({ role: m.role, content: m.content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

export async function loadThread(userId: string): Promise<InsightsMessage[]> {
  const row = await prisma.userData.findUnique({ where: { userId }, select: { aiInsights: true } })
  return readThread(row?.aiInsights)
}

export async function appendToThread(userId: string, messages: InsightsMessage[]): Promise<void> {
  const thread = [...(await loadThread(userId)), ...messages].slice(-MAX_STORED_MESSAGES)
  // update, not upsert: upsert needs a transaction, which Neon HTTP mode doesn't support
  await prisma.userData.update({
    where: { userId },
    data: { aiInsights: { messages: thread } as object },
  })
}

// Waits until the API accepts the request, so errors (rate or spend limits, bad requests) reach the
// browser as a readable HTTP error instead of a stream that breaks mid-way
export async function startModelStream(stream: ReturnType<Anthropic['messages']['stream']>): Promise<Response | null> {
  try {
    await stream.withResponse()
    return null
  } catch (error) {
    console.error('Insights request rejected:', error)
    // API errors carry the body as { error: { message } }
    const apiMessage = (error as { error?: { error?: { message?: string } } })?.error?.error?.message
    const message = apiMessage ?? 'Failed to reach the AI service'
    return new Response(message, { status: 502 })
  }
}
