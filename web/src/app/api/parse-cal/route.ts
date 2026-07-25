import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { read, utils } from 'xlsx'

import { createHash } from 'crypto'

function deterministicId(cardLast4: string, date: string, merchant: string, amount: number, rowIndex: number): string {
  return createHash('sha1').update(`${cardLast4}|${date}|${merchant}|${amount}|${rowIndex}`).digest('hex').slice(0, 16)
}
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

// Isracard: "‫WORLD ELITE MASTERCA‬ - 4588" → card last 4 + label
function parseIsracardCardHeader(row: any[]): { cardLast4: string; accountLabel: string } {
  const header = (row[0] ?? '').toString().replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()
  const match = header.match(/(.+?)\s*-\s*(\d{4})\s*$/)
  if (match) {
    return { accountLabel: match[1].trim(), cardLast4: match[2] }
  }
  return { accountLabel: header.slice(0, 40), cardLast4: '' }
}

// Isracard: "לחיוב ב-10.07" — day.month, no year, so derive year from sheet title row ("יולי 2026")
function parseIsracardMonth(rows: any[][]): string {
  const monthNames: Record<string, string> = {
    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04', 'מאי': '05', 'יוני': '06',
    'יולי': '07', 'אוגוסט': '08', 'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
  }
  for (const row of rows) {
    const text = (row[2] ?? row[0] ?? '').toString()
    for (const [name, num] of Object.entries(monthNames)) {
      const match = text.match(new RegExp(`${name}\\s+(\\d{4})`))
      if (match) return `${match[1]}-${num}`
    }
  }
  return new Date().toISOString().slice(0, 7)
}

// Isracard date: "08.07.26" (DD.MM.YY) → YYYY-MM-DD
function parseIsracardDate(raw: string): string | null {
  const parts = raw.toString().split('.')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const fullYear = y.length === 2 ? `20${y}` : y
  return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function isIsracardSheet(rows: any[][]): boolean {
  return rows.some(row => (row[0] ?? '').toString().includes('תאריך רכישה'))
}

function parseIsracardTransactions(rows: any[][], month: string): {
  cardLast4: string
  accountLabel: string
  txs: { date: string; merchant: string; transactionAmount: number; chargeAmount: number; currency: string; voucherNum: string; notes: string; rowIndex: number }[]
} {
  let cardLast4 = ''
  let accountLabel = ''
  const txs: { date: string; merchant: string; transactionAmount: number; chargeAmount: number; currency: string; voucherNum: string; notes: string; rowIndex: number }[] = []

  let inTable = false
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const col0 = (row[0] ?? '').toString().trim()

    // Card header row, e.g. "WORLD ELITE MASTERCA - 4588"
    if (col0.includes(' - ') && /\d{4}\s*$/.test(col0.replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim()) && !inTable) {
      const parsed = parseIsracardCardHeader(row)
      if (parsed.cardLast4) {
        cardLast4 = parsed.cardLast4
        accountLabel = parsed.accountLabel
      }
      continue
    }

    if (col0.includes('תאריך רכישה')) {
      inTable = true
      continue
    }

    if (!inTable) continue

    // Footer row: "סה"כ לחיוב החודש..." or empty date — end of table
    if (!col0 || col0.includes('סה"כ') || col0.includes('תנאים משפטיים')) {
      inTable = false
      continue
    }

    const date = parseIsracardDate(col0)
    const merchant = (row[1] ?? '').toString().trim()
    if (!date || !merchant) continue

    const transactionAmount = Number(row[2]) || 0
    const currency = (row[3] ?? '₪').toString().trim()
    const chargeAmount = Number(row[4]) || 0
    const voucherNum = (row[6] ?? '').toString().trim()
    const notes = (row[7] ?? '').toString().trim().replace(/\n/g, ' · ')

    txs.push({ date, merchant, transactionAmount, chargeAmount, currency, voucherNum, notes, rowIndex: i })
  }

  return { cardLast4, accountLabel, txs }
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

        if (isIsracardSheet(rows)) {
          const month = parseIsracardMonth(rows)
          const { cardLast4, accountLabel, txs } = parseIsracardTransactions(rows, month)

          for (const tx of txs) {
            allTransactions.push({
              id: deterministicId(cardLast4, tx.date, tx.merchant, tx.chargeAmount, tx.rowIndex),
              date: tx.date,
              merchant: tx.merchant,
              amount: tx.chargeAmount,
              transactionAmount: tx.transactionAmount !== tx.chargeAmount ? tx.transactionAmount : undefined,
              type: tx.currency !== '₪' ? `${tx.currency} ${tx.transactionAmount}` : '',
              cardLast4: cardLast4 || undefined,
              accountLabel: accountLabel || undefined,
              notes: [tx.notes, tx.voucherNum ? `#${tx.voucherNum}` : ''].filter(Boolean).join(' · ') || undefined,
              mappingStatus: 'unmapped',
              importedAt: new Date().toISOString(),
              month,
            })
          }
          continue
        }

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
          if (!merchant || (typeof dateRaw !== 'number' && !dateRaw)) continue

          let date: string
          if (typeof dateRaw === 'number') {
            date = excelDateToISO(dateRaw)
          } else {
            // Text date from manually-edited cells, e.g. "17/5/26" or "17/05/2026"
            const parts = dateRaw.toString().split('/')
            if (parts.length !== 3) continue
            const [d, m, y] = parts
            const fullYear = y.length === 2 ? `20${y}` : y
            date = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
          }

          allTransactions.push({
            id: deterministicId(cardLast4, date, merchant, chargeAmount, i),
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

    // No dedup at parse time — identical rows in the same file are kept as-is.
    // Dedup against already-saved transactions happens in map-transactions.
    const unique = allTransactions

    return NextResponse.json({ transactions: unique })
  } catch (error) {
    console.error('parse-cal error:', error)
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }
}
