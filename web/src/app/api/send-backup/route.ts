import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/household'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { AppData, Account, RecurringExpense, IncomeSource } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatNIS(amount: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

function buildHtml(data: AppData, userEmail: string): string {
  const accounts = data.accounts ?? []
  const snapshots = data.snapshots ?? []
  const expenses = (data.expenses ?? []).filter((e: RecurringExpense) => e.active)
  const income = (data.income ?? []).filter((s: IncomeSource) => s.active)

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

  // Monthly expenses
  let totalExpenses = 0
  const expenseRows = expenses.map((e: RecurringExpense) => {
    const monthly = e.billingCycle === 'yearly' ? e.amount / 12 : e.amount
    totalExpenses += monthly
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#d1d5db;">${e.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#9ca3af;text-align:center;">${e.category}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#d1d5db;text-align:right;">${formatNIS(monthly)}</td>
    </tr>`
  }).join('')

  // Monthly income
  let totalNetIncome = 0
  const incomeRows = income.map((s: IncomeSource) => {
    const factor = s.billingCycle === 'yearly' ? 1 / 12 : 1
    const net = s.netAmount * factor
    totalNetIncome += net
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#d1d5db;">${s.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#9ca3af;text-align:center;">${s.owner ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#d1d5db;text-align:right;">${formatNIS(net)}</td>
    </tr>`
  }).join('')

  // Accounts list with latest balance
  const accountRows = accounts.map((a: Account) => {
    const entry = latest?.entries.find((e) => e.accountId === a.id)
    const balance = entry ? entry.balance : null
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#d1d5db;">${a.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#9ca3af;text-align:center;">${a.type === 'asset' ? 'Asset' : 'Liability'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:${a.type === 'asset' ? '#6ee7b7' : '#fca5a5'};text-align:right;">${balance != null ? formatNIS(balance) : '—'}</td>
    </tr>`
  }).join('')

  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const section = (title: string, content: string) => `
    <div style="margin-bottom:32px;">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.05em;">${title}</h2>
      ${content}
    </div>`

  const table = (headers: string[], rows: string) => `
    <table style="width:100%;border-collapse:collapse;background:#14141f;border-radius:8px;overflow:hidden;">
      <thead>
        <tr>${headers.map(h => `<th style="padding:8px 12px;text-align:${h === headers[headers.length - 1] ? 'right' : 'left'};font-size:12px;font-weight:500;color:#6b7280;border-bottom:1px solid #2a2a3a;">${h}</th>`).join('')}</tr>
      </thead>
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

    <!-- Net Worth Summary -->
    ${section('Net Worth', `
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${[
          { label: 'Net Worth', value: formatNIS(netWorth), color: netWorth >= 0 ? '#6ee7b7' : '#fca5a5' },
          { label: 'Assets', value: formatNIS(assets), color: '#6ee7b7' },
          { label: 'Liabilities', value: formatNIS(liabilities), color: '#fca5a5' },
        ].map(card => `
          <div style="flex:1;min-width:140px;background:#14141f;border-radius:8px;padding:16px;">
            <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${card.label}</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:${card.color};">${card.value}</p>
          </div>
        `).join('')}
      </div>
      ${latest ? `<p style="margin:8px 0 0;font-size:12px;color:#4b5563;">Based on ${latest.date} snapshot</p>` : ''}
    `)}

    <!-- Accounts -->
    ${accounts.length > 0 ? section('Accounts', table(['Account', 'Type', 'Balance'], accountRows)) : ''}

    <!-- Income -->
    ${income.length > 0 ? section('Monthly Income', `
      ${table(['Source', 'Owner', 'Net / month'], incomeRows)}
      <p style="margin:8px 0 0;font-size:13px;color:#d1d5db;">Total net: <strong style="color:#6ee7b7;">${formatNIS(totalNetIncome)}/mo</strong></p>
    `) : ''}

    <!-- Expenses -->
    ${expenses.length > 0 ? section('Monthly Expenses', `
      ${table(['Expense', 'Category', 'Amount / month'], expenseRows)}
      <p style="margin:8px 0 0;font-size:13px;color:#d1d5db;">Total: <strong style="color:#fca5a5;">${formatNIS(totalExpenses)}/mo</strong></p>
    `) : ''}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1a1a2a;">
      <p style="margin:0;font-size:12px;color:#4b5563;">Sent from <a href="https://avivo.dev/finance-hub" style="color:#6366f1;text-decoration:none;">Finance Hub</a> · Raw JSON backup attached</p>
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
    const userData = await prisma.userData.findUnique({ where: { userId: effectiveUserId } })
    const data = (userData?.data as unknown as AppData) ?? { accounts: [], snapshots: [] }

    const dateStr = new Date().toISOString().split('T')[0]
    const jsonStr = JSON.stringify(data, null, 2)
    const jsonBase64 = Buffer.from(jsonStr).toString('base64')

    const { error } = await resend.emails.send({
      from: 'Finance Hub <no-reply@avivo.dev>',
      to: session.user.email,
      subject: `Finance Hub Backup — ${dateStr}`,
      html: buildHtml(data, session.user.email),
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
