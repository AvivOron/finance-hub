import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import { assembleAppData, saveAppData } from '@/lib/data'
import { NextResponse } from 'next/server'

const defaultData = { accounts: [], snapshots: [], familyMembers: [] }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const effectiveUserId = await getEffectiveUserId(session.user.id)
    const data = await assembleAppData(effectiveUserId)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Data fetch error', error)
    if (error?.code === 'P1001' || error?.name === 'PrismaClientInitializationError') {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }
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
    // Ensure user exists (should be created by NextAuth, but be safe)
    await prisma.user.upsert({
      where: { id: effectiveUserId },
      update: {},
      create: { id: effectiveUserId },
    })

    await saveAppData(effectiveUserId, data)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Data save error', error)
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    throw error
  }
}
