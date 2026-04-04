import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)

  const properties = await prisma.property.findMany({
    where: { userId: effectiveUserId },
    orderBy: { createdAt: 'asc' }
  })

  return Response.json(properties)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const body = await request.json()

  const { name, address, lat, lng, propertyType, estimatedValue, valuationDate, description, notes } = body

  if (!name || estimatedValue == null || !valuationDate) {
    return new Response('Missing required fields', { status: 400 })
  }

  const property = await prisma.property.create({
    data: {
      userId: effectiveUserId,
      name,
      address: address || null,
      lat: lat ?? null,
      lng: lng ?? null,
      propertyType: propertyType || 'apartment',
      estimatedValue: Number(estimatedValue),
      valuationDate,
      description: description || null,
      notes: notes || null,
    }
  })

  return Response.json(property, { status: 201 })
}
