import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { Investment } from '@/types'

const client = new Anthropic()

interface EnrichRequest {
  holdings: Investment[]
}

interface EnrichResponse {
  enriched: Investment[]
}

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body: EnrichRequest = await req.json()
    const { holdings } = body

    if (!holdings || holdings.length === 0) {
      return NextResponse.json<EnrichResponse>({
        enriched: []
      })
    }

    // Filter holdings that don't already have a fee
    const toEnrich = holdings.filter((h) => !h.managementFee)

    if (toEnrich.length === 0) {
      return NextResponse.json<EnrichResponse>({
        enriched: holdings
      })
    }

    // Build a prompt asking Claude to find management fees
    const holdingsList = toEnrich
      .map(
        (h) =>
          `- ${h.name} (Paper #${h.paperNumber}, ticker/identifier: paper number)`
      )
      .join('\n')

    const prompt = `You are a financial data expert. Your task is to find annual management fees for investment funds.

**CRITICAL: Be conservative. Only return fees for well-known international ETFs from major providers (iShares, Vanguard, etc.). For all Israeli-specific or lesser-known funds, return "Unknown" - do not guess.**

I have a list of investment holdings. For each, find the exact annual management fee (% per year).

Holdings:
${holdingsList}

For each holding, follow this logic:
1. If it's a major international ETF from iShares, Vanguard, Schwab, etc. with a recognizable global ticker:
   - Return the exact management fee from your training data
   - Return high confidence (90+)
2. If it's an Israeli-specific fund, local tracker fund, or any fund you're not 100% sure about:
   - Return "Unknown" for managementFee
   - Return 0 for confidence
   - Return null for feeSource
3. Never guess or estimate based on fund category

For each holding, provide:
1. paperNumber
2. name
3. managementFee (number OR "Unknown")
4. confidence (0-100)
5. feeSource (string OR null)

Example format (Israeli funds should have "Unknown"):
[
  { "paperNumber": "1159235", "name": "iShares $ MSCI ACWI UCITS ETF-TA", "managementFee": 0.20, "confidence": 95, "feeSource": "iShares prospectus" },
  { "paperNumber": "5127766", "name": "אי.בי.אי. מחקה י Nasdaq 100", "managementFee": "Unknown", "confidence": 0, "feeSource": null },
  ...
]

Return ONLY the JSON array, no other text.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Extract the JSON response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    let enrichedData: Array<{
      paperNumber: string
      managementFee?: number | string
      feeSource?: string | null
      confidence?: number
    }> = []

    try {
      // Claude sometimes wraps JSON in markdown code blocks, extract it
      let jsonText = content.text.trim()

      // Check if wrapped in ```json ... ```
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim()
      }

      enrichedData = JSON.parse(jsonText)
    } catch (error) {
      console.error('Failed to parse Claude response:', content.text, error)
      return NextResponse.json<EnrichResponse>({
        enriched: holdings
      })
    }

    // Merge enriched fees back into holdings
    // Only use fees where Claude has high confidence (>= 80%)
    const enrichedMap = new Map(enrichedData.map((e) => [e.paperNumber, e]))

    const result: Investment[] = holdings.map((holding) => {
      const enriched = enrichedMap.get(holding.paperNumber)
      if (enriched && enriched.managementFee !== undefined && enriched.managementFee !== null) {
        // Only set fee if it's a number AND confidence is high (>= 80%)
        const confidence = enriched.confidence ?? 0
        if (typeof enriched.managementFee === 'number' && confidence >= 80) {
          return {
            ...holding,
            managementFee: enriched.managementFee,
            feeSource: enriched.feeSource || undefined
          }
        }
      }
      return holding
    })

    return NextResponse.json<EnrichResponse>({
      enriched: result
    })
  } catch (error) {
    console.error('Enrich holdings error:', error)
    return NextResponse.json(
      { error: 'Failed to enrich holdings' },
      { status: 500 }
    )
  }
}
