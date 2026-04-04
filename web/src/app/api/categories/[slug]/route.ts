import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/categories/:slug — update label, icon, or color
export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { label, icon, color, sortOrder } = await request.json()

  const updated = await prisma.expenseCategory.update({
    where: { slug: params.slug },
    data: {
      ...(label !== undefined && { label }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  })

  return Response.json(updated)
}
