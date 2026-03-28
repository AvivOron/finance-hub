import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const defaultData = { accounts: [], snapshots: [], familyMembers: [] }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userData = await prisma.userData.findUnique({
    where: { userId: session.user.id }
  })

  return NextResponse.json(userData?.data ?? defaultData)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await request.json()

  await prisma.userData.upsert({
    where: { userId: session.user.id },
    update: { data },
    create: { userId: session.user.id, data }
  })

  return NextResponse.json({ success: true })
}
