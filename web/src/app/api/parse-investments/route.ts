import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { Investment } from '@/types'
import { Anthropic } from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

interface ParseResult {
  holdings: Investment[]
  totalValueNIS: number
  updatedAt: string
}

interface ParsedHolding {
  quantity: number
  lastPrice: number
  valueNIS: number
  costPrice: number
  gainFromCostNIS: number
  gainFromCostPct: number
  personalNote: string | undefined
  portfolioPct: number | undefined
}

async function categorizeHoldings(holdings: Partial<Investment>[]): Promise<string[]> {
  const client = new Anthropic()

  const holdingsList = holdings
    .map((h, i) => `${i + 1}. ${h.name}`)
    .join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Categorize the following Israeli securities/holdings into one of these categories: מניות (stocks), אגרות חוב (bonds), שקל (cash/shekel equivalents), or other.

Holdings:
${holdingsList}

Respond with ONLY a JSON array of category strings in the same order as the holdings list. Example: ["מניות", "אגרות חוב", "שקל"]`
      }
    ]
  })

  try {
    const content = message.content[0]
    if (content.type === 'text') {
      const categories = JSON.parse(content.text)
      return categories
    }
  } catch (e) {
    console.error('Failed to parse categorization response:', e)
  }

  // Fallback: simple heuristic categorization
  return holdings.map(h => {
    const name = h.name?.toLowerCase() || ''
    if (name.includes('אגח') || name.includes('תל גוב') || name.includes('bond')) return 'אגרות חוב'
    if (name.includes('כספית') || name.includes('cash') || name.includes('מזומן')) return 'שקל'
    return 'מניות' // default to stocks
  })
}

function parsePoalimRow(row: Record<string, any>): ParsedHolding {
  return {
    quantity: Number(row['__EMPTY_5']) || 0,
    lastPrice: Number(row['__EMPTY_2']) || 0,
    valueNIS: Number(row['__EMPTY_7']) || 0,
    costPrice: Number(row['__EMPTY_8']) || 0,
    gainFromCostNIS: Number(row['__EMPTY_11']) || 0,
    gainFromCostPct: parseFloat(row['__EMPTY_10']?.toString().trim() || '0') || 0,
    personalNote: row['__EMPTY_12']?.toString().trim() || undefined,
    portfolioPct: undefined
  }
}

function parseExcellenceRow(row: Record<string, any>): ParsedHolding {
  return {
    quantity: Number(row['__EMPTY_3']) || 0,
    lastPrice: Number(row['__EMPTY_2']) || 0,
    valueNIS: Number(row['__EMPTY_4']) || 0,
    costPrice: Number(row['__EMPTY_8']) || 0,
    gainFromCostPct: parseFloat(row['__EMPTY_9']?.toString().trim() || '0') || 0,
    gainFromCostNIS: Number(row['__EMPTY_11']) || 0,
    portfolioPct: Number(row['__EMPTY_12']) || undefined,
    personalNote: row['__EMPTY_16']?.toString().trim() || undefined
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const vendor = formData.get('vendor') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file as buffer
    const buffer = await file.arrayBuffer()
    const workbook = read(buffer, { cellNF: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = utils.sheet_to_json(sheet, { defval: '' })

    // Find header row: first row where column 0 === 'שם נייר'
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, any>
      if (row['__EMPTY'] === 'שם נייר') {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) {
      return NextResponse.json(
        { error: 'Could not find header row with שם נייר' },
        { status: 400 }
      )
    }

    // Find summary row before header (bank files have "שווי תיק" row with total)
    let totalValueNIS = 0
    if (headerIdx > 1) {
      const summaryRow = rows[headerIdx - 1] as Record<string, any>
      if (summaryRow['__EMPTY']?.toString().includes('שווי תיק')) {
        const summaryLine = rows[headerIdx - 2] as Record<string, any>
        const valueStr = summaryLine['__EMPTY']?.toString() || ''
        // Parse "₪ 1,033,723.12" format
        const match = valueStr.match(/₪[\s]*([0-9,]+\.?\d*)/)
        if (match) {
          totalValueNIS = parseFloat(match[1].replace(/,/g, ''))
        }
      }
    }

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor parameter is required' },
        { status: 400 }
      )
    }

    const holdings: Investment[] = []
    let calculatedTotal = 0

    // Parse holdings rows (after header)
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as Record<string, any>
      const name = row['__EMPTY']?.toString().trim()
      const paperNumberStr = row['__EMPTY_1']?.toString().trim()

      // Stop if we hit an empty row or non-numeric paper number
      if (!name || !paperNumberStr || isNaN(Number(paperNumberStr))) {
        break
      }

      const parsed = vendor === 'excellence'
        ? parseExcellenceRow(row)
        : parsePoalimRow(row)

      holdings.push({
        paperNumber: paperNumberStr,
        name,
        ...parsed
      })

      calculatedTotal += parsed.valueNIS
    }

    // If we didn't find a summary row total, use calculated sum
    if (totalValueNIS === 0) {
      totalValueNIS = calculatedTotal
    }

    // Categorize holdings using Claude
    const categories = await categorizeHoldings(holdings)
    const categorizedHoldings = holdings.map((h, i) => ({
      ...h,
      category: categories[i] || 'מניות'
    }))

    const result: ParseResult = {
      holdings: categorizedHoldings as Investment[],
      totalValueNIS,
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Parse investments error:', error)
    return NextResponse.json(
      { error: 'Failed to parse investments file' },
      { status: 500 }
    )
  }
}
