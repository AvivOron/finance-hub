import { prisma } from './prisma'

/**
 * Returns the userId whose UserData should be read/written for a given user.
 * - If the user owns a household or is standalone → their own id
 * - If the user is a member of someone else's household → the owner's id
 */
export async function getEffectiveUserId(userId: string): Promise<string> {
  try {
    const membership = await prisma.householdMember.findUnique({
      where: { userId },
      select: { household: { select: { ownerId: true } } }
    })
    return membership?.household.ownerId ?? userId
  } catch (error: any) {
    // If household tables don't exist yet (during initial setup), just use the user's own id
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return userId
    }
    throw error
  }
}
