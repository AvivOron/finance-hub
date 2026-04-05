import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'

export const runtime = 'nodejs'

// GET /api/transactions?month=YYYY-MM (optional filter)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const month = req.nextUrl.searchParams.get('month') ?? undefined

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: effectiveUserId,
      ...(month ? { month } : {}),
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ transactions })
}

// PATCH /api/transactions — update one transaction (manual mapping, ignore, etc.)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const { id, recurringExpenseId, variableExpenseId, expenseCategory, mappingStatus, overrideAmount } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'Transaction id required' }, { status: 400 })
  }

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.userId !== effectiveUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      recurringExpenseId: recurringExpenseId ?? null,
      variableExpenseId: variableExpenseId ?? null,
      expenseCategory: expenseCategory ?? null,
      mappingStatus: mappingStatus ?? existing.mappingStatus,
      ...(overrideAmount !== undefined ? { overrideAmount: overrideAmount === null ? null : Number(overrideAmount) } : {}),
    },
  })

  return NextResponse.json({ transaction: updated })
}

// DELETE /api/transactions?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.userId !== effectiveUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
