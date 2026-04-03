import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { Investment } from '@/types'

export const runtime = 'nodejs'

interface ParseResult {
  holdings: Investment[]
  totalValueNIS: number
  updatedAt: string
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

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

    const holdings: Investment[] = []
    let calculatedTotal = 0

    // Detect file type by checking which columns exist
    const headerRow = rows[headerIdx] as Record<string, any>
    const isExcellenceFormat = headerRow['__EMPTY_4']?.toString().includes('שווי אחזקה')

    // Parse holdings rows (after header)
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as Record<string, any>
      const name = row['__EMPTY']?.toString().trim()
      const paperNumberStr = row['__EMPTY_1']?.toString().trim()

      // Stop if we hit an empty row or non-numeric paper number
      if (!name || !paperNumberStr || isNaN(Number(paperNumberStr))) {
        break
      }

      let quantity: number
      let lastPrice: number
      let valueNIS: number
      let costPrice: number
      let gainFromCostNIS: number
      let gainFromCostPct: number
      let category: string | undefined
      let portfolioPct: number | undefined

      if (isExcellenceFormat) {
        // Excellence format: different column mapping
        quantity = Number(row['__EMPTY_3']) || 0
        lastPrice = Number(row['__EMPTY_2']) || 0
        valueNIS = Number(row['__EMPTY_4']) || 0
        costPrice = Number(row['__EMPTY_8']) || 0
        const gainFromCostPctStr = row['__EMPTY_9']?.toString().trim() || '0'
        gainFromCostPct = parseFloat(gainFromCostPctStr) || 0
        gainFromCostNIS = Number(row['__EMPTY_11']) || 0
        portfolioPct = Number(row['__EMPTY_12']) || undefined
        category = row['__EMPTY_16']?.toString().trim() || undefined
      } else {
        // Bank format: original mapping
        quantity = Number(row['__EMPTY_5']) || 0
        lastPrice = Number(row['__EMPTY_2']) || 0
        valueNIS = Number(row['__EMPTY_7']) || 0
        costPrice = Number(row['__EMPTY_8']) || 0
        gainFromCostNIS = Number(row['__EMPTY_11']) || 0
        const gainFromCostPctStr = row['__EMPTY_10']?.toString().trim() || '0'
        gainFromCostPct = parseFloat(gainFromCostPctStr) || 0
        category = row['__EMPTY_12']?.toString().trim() || undefined
        portfolioPct = undefined
      }

      holdings.push({
        paperNumber: paperNumberStr,
        name,
        quantity,
        lastPrice,
        valueNIS,
        costPrice,
        gainFromCostNIS,
        gainFromCostPct,
        category: portfolioPct !== undefined && !isNaN(portfolioPct) ? undefined : category,
        portfolioPct: portfolioPct !== undefined && !isNaN(portfolioPct) ? portfolioPct : undefined
      })

      calculatedTotal += valueNIS
    }

    // If we didn't find a summary row total, use calculated sum
    if (totalValueNIS === 0) {
      totalValueNIS = calculatedTotal
    }

    const result: ParseResult = {
      holdings,
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
