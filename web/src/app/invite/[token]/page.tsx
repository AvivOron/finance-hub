import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { TrendingUp, Users } from 'lucide-react'
import { LoginButton } from '@/components/LoginButton'
import { JoinButton } from './JoinButton'

interface Props {
  params: { token: string }
}

export default async function InvitePage({ params }: Props) {
  const { token } = params

  // Look up the household for this token
  const household = await prisma.household.findUnique({
    where: { inviteToken: token },
    include: {
      owner: { select: { name: true, email: true, image: true } },
      members: true
    }
  })

  if (!household) {
    return (
      <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/20 flex items-center justify-center mx-auto">
            <TrendingUp size={32} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Invite link invalid</h1>
          <p className="text-sm text-gray-500">
            This invite link has been revoked or doesn&apos;t exist.
            Ask the household owner to generate a new one.
          </p>
        </div>
      </div>
    )
  }

  const session = await getServerSession(authOptions)

  // If user already in the app, redirect them there
  if (session?.user?.id) {
    // Check if already a member
    const alreadyMember = await prisma.householdMember.findUnique({
      where: { userId: session.user.id }
    })
    const isOwner = household.ownerId === session.user.id

    if (isOwner || alreadyMember?.householdId === household.id) {
      redirect('/app')
    }
  }

  const ownerName = household.owner.name ?? household.owner.email ?? 'Someone'
  const memberCount = household.members.length

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <TrendingUp size={32} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Finance Hub</h1>
            <p className="text-gray-500 text-sm mt-1">You&apos;ve been invited to join a household</p>
          </div>
        </div>

        {/* Invite card */}
        <div className="bg-[#14141f] border border-white/8 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Users size={18} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{ownerName}&apos;s household</p>
              <p className="text-xs text-gray-500">
                {memberCount === 0
                  ? 'No other members yet'
                  : `${memberCount} member${memberCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Joining will give you access to {ownerName}&apos;s shared financial data — net worth, accounts,
            expenses, and income. Your existing data will not be lost but won&apos;t be visible while you&apos;re
            part of this household.
          </p>

          {session ? (
            <JoinButton token={token} />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 text-center">Sign in to accept this invite</p>
              <LoginButton callbackUrl={`/finance-hub/invite/${token}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
