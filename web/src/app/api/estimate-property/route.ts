import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { PropertyType } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { name, address, propertyType, description, notes, lat, lng, language } = await request.json() as {
    name: string
    address?: string
    propertyType: PropertyType
    description?: string
    notes?: string
    lat?: number
    lng?: number
    language?: string
  }

  const locationInfo = address
    ? `Address: ${address}${lat != null && lng != null ? ` (coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)})` : ''}`
    : lat != null && lng != null
    ? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : 'Location not specified'

  const allText = `${description ?? ''} ${notes ?? ''}`
  const sqmMatch = allText.match(/(\d+)\s*(?:sqm|מ"ר|מטר|m²|מ׳|מ')/i)
  const sizeInfo = sqmMatch ? `\n- Size: ${sqmMatch[1]} sqm` : ''

  const prompt = `You are an Israeli real estate valuation expert with access to web search. Your task is to estimate the current market value of the following property in Israeli New Shekels (₪ NIS).

Property details:
- Name: ${name}
- Type: ${propertyType}
- ${locationInfo}${sizeInfo}${description ? `\n- Description: ${description}` : ''}${notes ? `\n- Notes: ${notes}` : ''}

Today's date: ${new Date().toISOString().slice(0, 10)}

Steps:
1. Search for recent property transactions (עסקאות נדל"ן) in this specific area on madlan.co.il or yad2.co.il to find actual recent sale prices per sqm.
2. Use those real transactions to determine an accurate price per sqm for this location.
3. Calculate: price_per_sqm × size_in_sqm = estimatedValue (exact arithmetic, no rounding to nearest million).
4. In the explanation, mention the actual transactions or data sources you found and the price per sqm used.

${language === 'he' ? 'Write the explanation in Hebrew.' : 'Write the explanation in English.'}

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{"estimatedValue": 2500000, "explanation": "Explanation mentioning sources and price/sqm used."}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: [{ role: 'user', content: prompt }]
    })

    // Extract the final text block (after tool use)
    const textBlock = message.content.findLast((b: any) => b.type === 'text')
    const text = (textBlock as any)?.text as string

    if (!text) {
      console.error('estimate-property: no text block in response', message.content)
      return Response.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Strip any preamble text before the JSON object
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    const cleaned = jsonStart !== -1 && jsonEnd !== -1
      ? text.slice(jsonStart, jsonEnd + 1)
      : text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('estimate-property: failed to parse AI response:', text)
      return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    if (typeof parsed.estimatedValue !== 'number' || typeof parsed.explanation !== 'string') {
      console.error('estimate-property: unexpected shape:', parsed)
      return Response.json({ error: 'Invalid response from AI' }, { status: 500 })
    }

    return Response.json({ estimatedValue: parsed.estimatedValue, explanation: parsed.explanation, reasoning: text })
  } catch (e: any) {
    console.error('estimate-property error:', e)
    return Response.json({ error: e?.message ?? 'Failed to estimate value' }, { status: 500 })
  }
}
