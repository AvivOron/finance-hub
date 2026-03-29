import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * GET /api/household
 * Returns current user's household status.
 *
 * Response shapes:
 *   { status: 'none' }
 *   { status: 'owner', householdId, inviteToken, members: [{ id, name, email, image, joinedAt }] }
 *   { status: 'member', householdId, owner: { name, email, image } }
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Check if user owns a household
  const owned = await prisma.household.findUnique({
    where: { ownerId: userId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: 'asc' }
      }
    }
  })

  if (owned) {
    return NextResponse.json({
      status: 'owner',
      householdId: owned.id,
      inviteToken: owned.inviteToken,
      members: owned.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        joinedAt: m.joinedAt
      }))
    })
  }

  // Check if user is a member of someone else's household
  const membership = await prisma.householdMember.findUnique({
    where: { userId },
    include: {
      household: {
        include: { owner: { select: { name: true, email: true, image: true } } }
      }
    }
  })

  if (membership) {
    return NextResponse.json({
      status: 'member',
      householdId: membership.householdId,
      owner: {
        name: membership.household.owner.name,
        email: membership.household.owner.email,
        image: membership.household.owner.image
      }
    })
  }

  return NextResponse.json({ status: 'none' })
}

/**
 * POST /api/household
 * Creates a new household owned by the current user.
 * Fails if user already owns one or is a member of one.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const alreadyOwns = await prisma.household.findUnique({ where: { ownerId: userId } })
  if (alreadyOwns) {
    return NextResponse.json({ error: 'You already own a household' }, { status: 409 })
  }

  const alreadyMember = await prisma.householdMember.findUnique({ where: { userId } })
  if (alreadyMember) {
    return NextResponse.json({ error: 'You are already a member of a household' }, { status: 409 })
  }

  const household = await prisma.household.create({ data: { ownerId: userId } })
  return NextResponse.json({ householdId: household.id })
}

/**
 * DELETE /api/household
 * Owner: disbands the household (removes all members and the household itself).
 * Member: leaves the household.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const owned = await prisma.household.findUnique({ where: { ownerId: userId } })
  if (owned) {
    // Cascade deletes all HouseholdMembers too
    await prisma.household.delete({ where: { id: owned.id } })
    return NextResponse.json({ success: true })
  }

  const membership = await prisma.householdMember.findUnique({ where: { userId } })
  if (membership) {
    await prisma.householdMember.delete({ where: { userId } })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Not in a household' }, { status: 404 })
}
