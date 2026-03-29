import { prisma } from './prisma'

/**
 * Returns the userId whose UserData should be read/written for a given user.
 * - If the user owns a household or is standalone → their own id
 * - If the user is a member of someone else's household → the owner's id
 */
export async function getEffectiveUserId(userId: string): Promise<string> {
  const membership = await prisma.householdMember.findUnique({
    where: { userId },
    select: { household: { select: { ownerId: true } } }
  })
  return membership?.household.ownerId ?? userId
}
