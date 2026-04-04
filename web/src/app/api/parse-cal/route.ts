import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'
import { generateId } from '@/utils'
import type { Transaction } from '@/types'

export const runtime = 'nodejs'

// Excel serial date → YYYY-MM-DD
function excelDateToISO(serial: number): string {
  const utc = new Date(Date.UTC(1899, 11, 30 + serial))
  return utc.toISOString().slice(0, 10)
}

// Extract card last 4 digits and account label from header row
function parseHeader(row0: any[]): { cardLast4: string; accountLabel: string; } {
  const header = (row0[0] ?? '').toString()
  const last4Match = header.match(/(\d{4})\s*$/)
  const cardLast4 = last4Match ? last4Match[1] : ''
  // e.g. "פירוט עסקאות לחשבון הפועלים 640-10524 לכרטיס..."
  const accountMatch = header.match(/לחשבון\s+(.+?)\s+לכרטיס/)
  const accountLabel = accountMatch ? accountMatch[1] : header.slice(0, 40)
  return { cardLast4, accountLabel }
}

// Extract billing month from row like "עסקאות לחיוב ב-10/03/2026: 11,927.08 ₪"
function parseBillingMonth(row2: any[]): string {
  const text = (row2[0] ?? '').toString()
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (match) {
    return `${match[3]}-${match[2]}` // YYYY-MM
  }
  return new Date().toISOString().slice(0, 7)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const allTransactions: Transaction[] = []

    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const workbook = read(buffer, { type: 'array' })

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const rows: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: '' })

        if (rows.length < 5) continue

        const { cardLast4, accountLabel } = parseHeader(rows[0])
        const month = parseBillingMonth(rows[2])

        // Row 3 is the column header row, data starts at row 4
        // Columns: תאריך עסקה | שם בית עסק | סכום עסקה | סכום חיוב | סוג עסקה | ענף | הערות
        for (let i = 4; i < rows.length; i++) {
          const row = rows[i]
          const dateRaw = row[0]
          const merchant = (row[1] ?? '').toString().trim()
          const transactionAmount = Number(row[2]) || 0
          const chargeAmount = Number(row[3]) || 0
          const type = (row[4] ?? '').toString().trim()
          const calCategory = (row[5] ?? '').toString().trim()
          const notes = (row[6] ?? '').toString().trim()

          // Skip empty rows or footer rows
          if (!merchant || typeof dateRaw !== 'number') continue

          const date = excelDateToISO(dateRaw)

          allTransactions.push({
            id: generateId(),
            date,
            merchant,
            amount: chargeAmount,
            transactionAmount: transactionAmount !== chargeAmount ? transactionAmount : undefined,
            type,
            calCategory: calCategory || undefined,
            cardLast4: cardLast4 || undefined,
            accountLabel: accountLabel || undefined,
            notes: notes || undefined,
            mappingStatus: 'unmapped',
            importedAt: new Date().toISOString(),
            month,
          })
        }
      }
    }

    // Deduplicate by date + merchant + amount (in case same file uploaded twice)
    const seen = new Set<string>()
    const unique = allTransactions.filter(t => {
      const key = `${t.date}|${t.merchant}|${t.amount}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ transactions: unique })
  } catch (error) {
    console.error('parse-cal error:', error)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
