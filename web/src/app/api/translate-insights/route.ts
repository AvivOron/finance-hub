import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { content: rawContent, fromLanguage, toLanguage } = await request.json()

  if (!rawContent || !fromLanguage || !toLanguage) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Remove duplicate bullet blocks that sometimes appear due to generation artifacts.
  // Strategy: split into paragraphs, remove any paragraph that appeared earlier verbatim.
  const paragraphs = rawContent.split(/\n{2,}/)
  const seen = new Set<string>()
  const deduped = paragraphs.filter((p: string) => {
    const key = p.trim()
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const content = deduped.join('\n\n').trim()

  const languageName = {
    en: 'English',
    he: 'Hebrew'
  }[toLanguage as string] || toLanguage

  const prompt = `Translate the following financial insights text to ${languageName}. Rules:
- Translate EVERY part of the text, including bullet points and list items
- Keep all markdown formatting (headers, tables, bullet points, bold, etc.) intact
- Do NOT leave any text in the original language — translate everything
- Do NOT add any preamble, explanation, or commentary
- Output only the translated content

Text to translate:
${content}`

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
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
