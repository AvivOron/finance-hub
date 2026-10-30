import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/household'
import { generateId } from '@/utils'
import { INSIGHTS_MODEL, loadInsightsContext, loadThread, appendToThread, buildReportPrompt } from '@/lib/insights'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GET — the insights thread (reports + replies), oldest first
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }
  const effectiveUserId = await getEffectiveUserId(session.user.id)
  return Response.json({ messages: await loadThread(effectiveUserId) })
}

// POST — generate a new report (streamed as plain text) and append it to the thread
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { currency = 'NIS', language = 'en' } = await request.json()

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const [ctx, thread] = await Promise.all([
    loadInsightsContext(effectiveUserId),
    loadThread(effectiveUserId),
  ])

  const stream = client.messages.stream({
    model: INSIGHTS_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: buildReportPrompt(ctx, currency, language, thread) }],
  })

  const encoder = new TextEncoder()
  let fullContent = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullContent += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        try {
          await appendToThread(effectiveUserId, [{
            id: generateId(),
            role: 'assistant',
            kind: 'report',
            content: fullContent,
            language: language === 'he' ? 'he' : 'en',
            at: new Date().toISOString(),
          }])
        } catch (persistError) {
          console.error('Failed to persist insights:', persistError)
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
