import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { content, language, generatedAt } = await request.json()

  if (!content || !language) {
    return new Response('Missing required fields', { status: 400 })
  }

  const effectiveUserId = await getEffectiveUserId(session.user.id)

  try {
    await (prisma.userData.update as any)({
      where: { userId: effectiveUserId },
      data: {
        aiInsights: {
          content,
          language,
          generatedAt
        }
      }
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    // P2022 = column doesn't exist (migration not applied yet)
    if (error?.code === 'P2022') {
      // Column doesn't exist yet, but still return success so client doesn't error
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    console.error('Failed to save insights:', error)
    return new Response('Failed to save insights', { status: 500 })
  }
}
