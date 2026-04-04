import { prisma } from '@/lib/prisma'

// GET /api/categories — returns all expense categories ordered by sortOrder
export async function GET() {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: { sortOrder: 'asc' },
  })
  return Response.json(categories)
}
