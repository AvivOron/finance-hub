import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'

export const runtime = 'nodejs'

// GET /api/transactions/summary
// Returns per-month totals grouped by expense id (or expenseCategory as fallback)
// Response: { byExpense: Record<expenseId, Record<month, number>>, byCategory: Record<category, Record<month, number>> }
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: effectiveUserId,
      mappingStatus: { not: 'ignored' },
    },
    select: {
      month: true,
      amount: true,
      overrideAmount: true,
      recurringExpenseId: true,
      variableExpenseId: true,
      expenseCategory: true,
    },
  })

  // Aggregate by expense id → month → total
  const byExpense: Record<string, Record<string, number>> = {}
  // Aggregate by category → month → total
  const byCategory: Record<string, Record<string, number>> = {}

  for (const tx of transactions) {
    const amt = tx.overrideAmount ?? tx.amount
    const linkedId = tx.recurringExpenseId ?? tx.variableExpenseId ?? null
    if (linkedId) {
      if (!byExpense[linkedId]) byExpense[linkedId] = {}
      byExpense[linkedId][tx.month] = (byExpense[linkedId][tx.month] ?? 0) + amt
    } else {
      const key = tx.expenseCategory ?? 'unlinked'
      if (!byCategory[key]) byCategory[key] = {}
      byCategory[key][tx.month] = (byCategory[key][tx.month] ?? 0) + amt
    }
  }

  return NextResponse.json({ byExpense, byCategory })
}
