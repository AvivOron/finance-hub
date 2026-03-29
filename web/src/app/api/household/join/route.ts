import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * POST /api/household/join
 * Body: { token: string }
 *
 * Joins the household associated with the given invite token.
 * Fails if:
 *   - token is invalid
 *   - user already owns a household
 *   - user is already a member of this (or another) household
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const household = await prisma.household.findUnique({
    where: { inviteToken: token }
  })

  if (!household) {
    return NextResponse.json({ error: 'Invalid or revoked invite link' }, { status: 404 })
  }

  if (household.ownerId === userId) {
    return NextResponse.json({ error: 'You already own this household' }, { status: 409 })
  }

  const alreadyOwns = await prisma.household.findUnique({ where: { ownerId: userId } })
  if (alreadyOwns) {
    return NextResponse.json(
      { error: 'You own a household — disband it before joining another' },
      { status: 409 }
    )
  }

  const existingMembership = await prisma.householdMember.findUnique({ where: { userId } })
  if (existingMembership) {
    if (existingMembership.householdId === household.id) {
      return NextResponse.json({ error: 'You are already a member of this household' }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'You are already a member of another household — leave it first' },
      { status: 409 }
    )
  }

  // Ensure User record exists before creating the foreign-key reference
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: session.user.email ?? undefined, name: session.user.name ?? undefined }
  })

  await prisma.householdMember.create({
    data: { householdId: household.id, userId }
  })

  return NextResponse.json({ success: true })
}
