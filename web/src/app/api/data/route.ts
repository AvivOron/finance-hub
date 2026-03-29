import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import { NextResponse } from 'next/server'

const defaultData = { accounts: [], snapshots: [], familyMembers: [] }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const effectiveUserId = await getEffectiveUserId(session.user.id)

    try {
      const userData = await prisma.userData.findUnique({
        where: { userId: effectiveUserId }
      })

      const data = (userData?.data as any) ?? defaultData
      // Include aiInsights in the response if available (handle gracefully if column doesn't exist yet)
      try {
        const aiInsights = (userData as any)?.aiInsights
        if (aiInsights) {
          return NextResponse.json({ ...data, aiInsights })
        }
      } catch {
        // aiInsights column might not exist yet in migration
      }
      return NextResponse.json(data)
    } catch (error: any) {
      // If the column doesn't exist yet, just return data without insights
      if (error.code === 'P2022' || error.code === 'P2021') {
        // Column or table doesn't exist yet, return data without aiInsights
        return NextResponse.json(defaultData)
      }
      throw error
    }
  } catch (error: any) {
    console.error('Data fetch error:', error)
    return NextResponse.json(defaultData)
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const data = await request.json()

  try {
    // Ensure user exists first (should be created by NextAuth, but be safe)
    await prisma.user.upsert({
      where: { id: effectiveUserId },
      update: {},
      create: { id: effectiveUserId }
    })

    await prisma.userData.upsert({
      where: { userId: effectiveUserId },
      update: { data },
      create: { userId: effectiveUserId, data }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Data save error:', error)
    if (error.code === 'P2003') {
      // Foreign key constraint - user doesn't exist
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    throw error
  }
}
