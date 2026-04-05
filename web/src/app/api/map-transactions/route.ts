import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import Anthropic from '@anthropic-ai/sdk'
import type { Transaction, RecurringExpense, VariableExpense, ExpenseCategory } from '@/types'

export const runtime = 'nodejs'

const client = new Anthropic()

interface MappingResult {
  transactionId: string
  // Claude returns a single id — we split it into the correct column after matching
  recurringExpenseId?: string
  expenseCategory?: ExpenseCategory
  mappingStatus: 'auto' | 'unmapped'
}

async function mapWithClaude(
  transactions: Transaction[],
  recurringExpenses: RecurringExpense[],
  variableExpenses: VariableExpense[]
): Promise<MappingResult[]> {
  const recurringList = recurringExpenses
    .filter(e => e.active)
    .map(e => `- id: ${e.id} | name: "${e.name}" | category: ${e.category} | amount: ₪${e.amount} | type: recurring`)
    .join('\n')

  const variableList = variableExpenses
    .filter(e => e.active)
    .map(e => `- id: ${e.id} | name: "${e.name}" | category: ${e.category} | type: variable (no fixed amount)`)
    .join('\n')

  const expenseList = [recurringList, variableList].filter(Boolean).join('\n')

  const txList = transactions
    .map(t => `- id: ${t.id} | merchant: "${t.merchant}" | amount: ₪${t.amount} | calCategory: "${t.calCategory ?? ''}" | type: "${t.type}"`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a financial assistant helping categorize Israeli credit card transactions.

## Recurring Expenses (the user's logged recurring bills):
${expenseList || '(none)'}

## Transactions to map:
${txList}

For each transaction, determine:
1. If it matches a recurring expense (by merchant name / purpose — not necessarily same amount), provide its id in recurringExpenseId
2. The best expenseCategory from: housing, childcare, subscriptions, insurance, utilities, transport, pets, groceries, lifestyle, other
3. mappingStatus: "auto" if you matched to a recurring expense, "unmapped" otherwise

Use context clues: הוראת קבע = standing order (likely recurring), merchant names in Hebrew, Cal category (ענף).

Respond with ONLY a JSON array, one entry per transaction, in the same order:
[{"transactionId":"...","recurringExpenseId":"..." or null,"expenseCategory":"...","mappingStatus":"auto"|"unmapped"}]`
      }
    ]
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')

  const jsonMatch = content.text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON array in response')

  return JSON.parse(jsonMatch[0]) as MappingResult[]
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)

  try {
    const { transactions, recurringExpenses, variableExpenses } = await req.json() as {
      transactions: Transaction[]
      recurringExpenses: RecurringExpense[]
      variableExpenses: VariableExpense[]
    }

    if (!transactions?.length) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    // Map using Claude
    const mappings = await mapWithClaude(transactions, recurringExpenses ?? [], variableExpenses ?? [])

    const variableExpenseIdSet = new Set((variableExpenses ?? []).map(e => e.id))

    // Apply mappings to transactions — route the id Claude returned to the correct column
    const mapped: Transaction[] = transactions.map(t => {
      const m = mappings.find(r => r.transactionId === t.id)
      const matchedId = m?.recurringExpenseId ?? undefined
      const isVariable = matchedId != null && variableExpenseIdSet.has(matchedId)
      return {
        ...t,
        recurringExpenseId: matchedId && !isVariable ? matchedId : undefined,
        variableExpenseId: matchedId && isVariable ? matchedId : undefined,
        expenseCategory: m?.expenseCategory ?? undefined,
        mappingStatus: m?.mappingStatus ?? 'unmapped',
      }
    })

    // IDs are deterministic (from parse-cal), so skipDuplicates handles re-uploads safely.
    // Two real identical rows in the same file get different IDs (different row index), so both are saved.
    const { count } = await prisma.transaction.createMany({
      skipDuplicates: true,
      data: mapped.map(t => ({
        id: t.id,
        userId: effectiveUserId,
        date: t.date,
        merchant: t.merchant,
        amount: t.amount,
        transactionAmount: t.transactionAmount ?? null,
        type: t.type,
        calCategory: t.calCategory ?? null,
        cardLast4: t.cardLast4 ?? null,
        accountLabel: t.accountLabel ?? null,
        notes: t.notes ?? null,
        expenseCategory: t.expenseCategory ?? null,
        recurringExpenseId: t.recurringExpenseId ?? null,
        variableExpenseId: t.variableExpenseId ?? null,
        mappingStatus: t.mappingStatus,
        month: t.month,
      })),
    })

    return NextResponse.json({
      mapped,
      saved: count,
      duplicates: mapped.length - count,
    })
  } catch (error) {
    console.error('map-transactions error:', error)
    return NextResponse.json({ error: 'Failed to map transactions' }, { status: 500 })
  }
}
