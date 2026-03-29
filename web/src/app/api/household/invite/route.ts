import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * POST /api/household/invite
 * Generates (or regenerates) a shareable invite token for the owner's household.
 * Returns { token }.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const household = await prisma.household.findUnique({
    where: { ownerId: session.user.id }
  })
  if (!household) {
    return NextResponse.json({ error: 'You do not own a household' }, { status: 403 })
  }

  const token = randomBytes(16).toString('hex')

  await prisma.household.update({
    where: { id: household.id },
    data: { inviteToken: token }
  })

  return NextResponse.json({ token })
}

/**
 * DELETE /api/household/invite
 * Revokes the current invite token (sets it to null).
 */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const household = await prisma.household.findUnique({
    where: { ownerId: session.user.id }
  })
  if (!household) {
    return NextResponse.json({ error: 'You do not own a household' }, { status: 403 })
  }

  await prisma.household.update({
    where: { id: household.id },
    data: { inviteToken: null }
  })

  return NextResponse.json({ success: true })
}
