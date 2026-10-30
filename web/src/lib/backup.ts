/**
 * Full data backup for the export-to-email option.
 * Exports every table the household owns as raw rows (all columns), so nothing is lost
 * to the trimmed AppData shape the UI uses.
 */

import { prisma } from './prisma'
import { readThread } from './insights-thread'

export const BACKUP_VERSION = 2

export async function buildBackup(userId: string, exportedBy: string) {
  const [
    accounts,
    snapshots,
    familyMembers,
    recurringExpenses,
    variableExpenses,
    incomeSources,
    accountHoldings,
    properties,
    transactions,
    userData,
    expenseCategories,
    household,
  ] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    prisma.monthlySnapshot.findMany({ where: { userId }, include: { entries: true }, orderBy: { date: 'asc' } }),
    prisma.familyMember.findMany({ where: { userId } }),
    prisma.recurringExpense.findMany({ where: { userId } }),
    prisma.variableExpense.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId } }),
    prisma.accountHoldings.findMany({ where: { userId } }),
    prisma.property.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.userData.findUnique({ where: { userId }, select: { aiInsights: true } }),
    // Shared across users, but needed to read the category slugs on expenses and transactions
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.household.findUnique({
      where: { ownerId: userId },
      select: {
        createdAt: true,
        owner: { select: { name: true, email: true } },
        members: { select: { joinedAt: true, user: { select: { name: true, email: true } } } },
      },
    }),
  ])

  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    household,
    accounts,
    snapshots,
    familyMembers,
    recurringExpenses,
    variableExpenses,
    incomeSources,
    accountHoldings,
    properties,
    transactions,
    aiInsights: { messages: readThread(userData?.aiInsights) },
    expenseCategories,
  }
}

export type Backup = Awaited<ReturnType<typeof buildBackup>>

// Row counts for the email body, so it's clear at a glance what the attachment holds
export function backupContents(backup: Backup): [string, number][] {
  return [
    ['Accounts', backup.accounts.length],
    ['Monthly snapshots', backup.snapshots.length],
    ['Snapshot balances', backup.snapshots.reduce((s, snap) => s + snap.entries.length, 0)],
    ['Fixed expenses', backup.recurringExpenses.length],
    ['Variable expenses', backup.variableExpenses.length],
    ['Income sources', backup.incomeSources.length],
    ['Investment portfolios', backup.accountHoldings.length],
    ['Properties', backup.properties.length],
    ['Transactions', backup.transactions.length],
    ['Family members', backup.familyMembers.length],
    ['AI insights messages', backup.aiInsights.messages.length],
    ['Expense categories', backup.expenseCategories.length],
  ]
}
