import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEffectiveUserId } from '@/lib/household'
import { generateId } from '@/utils'
import { INSIGHTS_MODEL, startModelStream, loadInsightsContext, loadThread, appendToThread, buildChatSystem, threadToMessages } from '@/lib/insights'
import type { InsightsMessage } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_MESSAGE_LENGTH = 4000

// POST — reply to the insights thread; the answer streams back as plain text.
// Both the user's message and the answer are saved, and later reports read the user's messages.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { message, currency = 'NIS', language = 'en' } = await request.json()
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return new Response('Empty message', { status: 400 })
  if (text.length > MAX_MESSAGE_LENGTH) return new Response('Message too long', { status: 400 })

  const effectiveUserId = await getEffectiveUserId(session.user.id)
  const [ctx, thread] = await Promise.all([
    loadInsightsContext(effectiveUserId),
    loadThread(effectiveUserId),
  ])

  const lang: InsightsMessage['language'] = language === 'he' ? 'he' : 'en'
  const userMessage: InsightsMessage = { id: generateId(), role: 'user', content: text, language: lang, at: new Date().toISOString() }

  const stream = client.messages.stream({
    model: INSIGHTS_MODEL,
    max_tokens: 16000,
    system: buildChatSystem(ctx, currency, language),
    messages: threadToMessages([...thread, userMessage]),
  })
  const rejected = await startModelStream(stream)
  if (rejected) return rejected

  const encoder = new TextEncoder()
  let fullContent = ''

  const readable = new ReadableStream({
    async start(controller) {
      // Keep generating and save the result even if the browser leaves (reload, navigation):
      // the model thinks for up to a minute before writing, and a closed stream must not lose the work
      let clientGone = false
      const send = (text: string) => {
        if (clientGone) return
        try { controller.enqueue(encoder.encode(text)) } catch { clientGone = true }
      }
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullContent += chunk.delta.text
            send(chunk.delta.text)
          }
        }

        await appendToThread(effectiveUserId, [
          userMessage,
          { id: generateId(), role: 'assistant', content: fullContent, language: lang, at: new Date().toISOString() },
        ])

        if (!clientGone) controller.close()
      } catch (error) {
        console.error('Insights stream failed:', error)
        if (!clientGone) controller.error(error)
      }
    }
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
