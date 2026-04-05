import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import { assembleAppData } from '@/lib/data'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { AppData, Account, RecurringExpense, IncomeSource } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatNIS(amount: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

function buildHtml(
  data: AppData,
  properties: { estimatedValue: number }[],
  userEmail: string,
  transactions: { month: string; amount: number; overrideAmount?: number | null; mappingStatus: string }[] = [],
): string {
  const accounts = data.accounts ?? []
  const snapshots = data.snapshots ?? []
  const activeExpenses = (data.expenses ?? []).filter((e: RecurringExpense) => e.active)
  const activeIncome = (data.income ?? []).filter((s: IncomeSource) => s.active)

  // Latest snapshot net worth
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  let assets = 0
  let liabilities = 0
  if (latest) {
    for (const entry of latest.entries) {
      const account = accounts.find((a: Account) => a.id === entry.accountId)
      if (!account) continue
      if (account.type === 'asset') assets += entry.balance
      else liabilities += Math.abs(entry.balance)
    }
  }
  const netWorth = assets - liabilities

  // Recurring expense monthly total
  let recurringExpenses = 0
  for (const e of activeExpenses) {
    recurringExpenses += e.billingCycle === 'yearly' ? e.amount / 12 : e.amount
  }

  // Variable expense avg: 12-month rolling average of non-ignored transactions
  const avgVariableTotal = (() => {
    const nonIgnored = transactions.filter(
      (tx) => tx.mappingStatus !== 'ignored' && !!(tx as any).variableExpenseId
    )
    // sum by month
    const byMonth: Record<string, number> = {}
    for (const tx of nonIgnored) {
      byMonth[tx.month] = (byMonth[tx.month] ?? 0) + (tx.overrideAmount ?? tx.amount)
    }
    const months = Object.keys(byMonth).sort().slice(-12)
    if (months.length === 0) return 0
    return months.reduce((s, m) => s + byMonth[m], 0) / months.length
  })()

  const totalExpenses = recurringExpenses + avgVariableTotal

  let totalNetIncome = 0
  for (const s of activeIncome) {
    totalNetIncome += s.netAmount * (s.billingCycle === 'yearly' ? 1 / 12 : 1)
  }

  const totalPropertyValue = properties.reduce((sum, p) => sum + p.estimatedValue, 0)

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const card = (label: string, value: string, color: string) => `
    <div style="flex:1;min-width:140px;background:#14141f;border-radius:8px;padding:16px;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:${color};">${value}</p>
    </div>`

  const section = (title: string, content: string) => `
    <div style="margin-bottom:32px;">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.05em;">${title}</h2>
      ${content}
    </div>`

  const statRow = (label: string, value: string, color = '#d1d5db') =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#9ca3af;">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;text-align:right;color:${color};font-weight:600;">${value}</td>
    </tr>`

  const statsTable = (rows: string) => `
    <table style="width:100%;border-collapse:collapse;background:#14141f;border-radius:8px;overflow:hidden;">
      <tbody>${rows}</tbody>
    </table>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <style>:root{color-scheme:dark;}body{color-scheme:dark;}</style>
</head>
<body style="margin:0;padding:0;background:#09090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color-scheme:dark;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="margin-bottom:32px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">Finance Hub Backup</h1>
      <p style="margin:0;font-size:13px;color:#6b7280;">${date} · ${userEmail}</p>
    </div>

    <!-- Net Worth -->
    ${section('Net Worth', `
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${card('Net Worth', formatNIS(netWorth), netWorth >= 0 ? '#6ee7b7' : '#fca5a5')}
        ${card('Assets', formatNIS(assets), '#6ee7b7')}
        ${card('Liabilities', formatNIS(liabilities), '#fca5a5')}
      </div>
      ${latest ? `<p style="margin:8px 0 0;font-size:12px;color:#4b5563;">Based on ${latest.date} snapshot</p>` : ''}
    `)}

    <!-- Summary -->
    ${section('Summary', statsTable([
      statRow('Accounts', `${accounts.length}`),
      statRow('Snapshots recorded', `${snapshots.length}`),
      activeIncome.length > 0 ? statRow('Monthly net income', `${formatNIS(totalNetIncome)}/mo`, '#6ee7b7') : '',
      activeExpenses.length > 0 ? statRow('Monthly expenses', `${formatNIS(totalExpenses)}/mo`, '#fca5a5') : '',
      activeIncome.length > 0 && activeExpenses.length > 0
        ? statRow('Monthly cash flow', `${formatNIS(totalNetIncome - totalExpenses)}/mo`, totalNetIncome >= totalExpenses ? '#6ee7b7' : '#fca5a5')
        : '',
      properties.length > 0 ? statRow('Properties', `${properties.length} · ${formatNIS(totalPropertyValue)}`) : '',
      data.accountHoldings?.length
        ? statRow('Investment portfolios', `${data.accountHoldings.length}`)
        : '',
      transactions.length > 0 ? statRow('Transactions', `${transactions.length}`) : '',
    ].filter(Boolean).join('')))}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1a1a2a;">
      <p style="margin:0;font-size:12px;color:#4b5563;">Sent from <a href="https://avivo.dev/finance-hub" style="color:#6366f1;text-decoration:none;">Finance Hub</a> · Full JSON backup attached</p>
    </div>
  </div>
</body>
</html>`
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const effectiveUserId = await getEffectiveUserId(session.user.id)
    const [data, properties, transactions] = await Promise.all([
      assembleAppData(effectiveUserId),
      prisma.property.findMany({ where: { userId: effectiveUserId } }),
      prisma.transaction.findMany({ where: { userId: effectiveUserId } }),
    ])

    const dateStr = new Date().toISOString().split('T')[0]
    const exportData = { ...data, properties, transactions }
    const jsonStr = JSON.stringify(exportData, null, 2)
    const jsonBase64 = Buffer.from(jsonStr).toString('base64')

    const { error } = await resend.emails.send({
      from: 'Finance Hub <no-reply@avivo.dev>',
      to: session.user.email,
      subject: `Finance Hub Backup — ${dateStr}`,
      html: buildHtml(data, properties, session.user.email, transactions),
      attachments: [
        {
          filename: `finance-hub-backup-${dateStr}.json`,
          content: jsonBase64,
        },
      ],
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Send backup error:', err)
    return NextResponse.json({ error: err.message ?? 'Failed to send email' }, { status: 500 })
  }
}
