import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const { id } = params
  const body = await request.json()

  // Ensure the property belongs to this user
  const existing = await prisma.property.findUnique({ where: { id } })
  if (!existing || existing.userId !== effectiveUserId) {
    return new Response('Not found', { status: 404 })
  }

  const { name, address, lat, lng, propertyType, estimatedValue, valuationDate, description, notes, aiEstimateReasoning } = body

  const property = await prisma.property.update({
    where: { id },
    data: {
      name,
      address: address || null,
      lat: lat ?? null,
      lng: lng ?? null,
      propertyType: propertyType || 'apartment',
      estimatedValue: Number(estimatedValue),
      valuationDate,
      description: description || null,
      notes: notes || null,
      aiEstimateReasoning: aiEstimateReasoning ?? existing.aiEstimateReasoning,
    }
  })

  return Response.json(property)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const { id } = params

  const existing = await prisma.property.findUnique({ where: { id } })
  if (!existing || existing.userId !== effectiveUserId) {
    return new Response('Not found', { status: 404 })
  }

  await prisma.property.delete({ where: { id } })

  return new Response(null, { status: 204 })
}
