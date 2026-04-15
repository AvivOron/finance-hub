/**
 * Shared data access helpers for reading/writing normalized financial tables.
 * Used by GET /api/data and POST /api/insights so they stay in sync.
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import type { AppData, Account, MonthlySnapshot, SnapshotEntry, FamilyMember, RecurringExpense, VariableExpense, IncomeSource, AccountHoldings, Investment } from '@/types'

export async function assembleAppData(userId: string): Promise<AppData> {
  const [
    dbAccounts,
    dbSnapshots,
    dbFamilyMembers,
    dbExpenses,
    dbVariableExpenses,
    dbIncome,
    dbHoldings,
    userData,
  ] = await Promise.all([
    prisma.financialAccount.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    prisma.monthlySnapshot.findMany({
      where: { userId },
      include: { entries: true },
      orderBy: { date: 'asc' },
    }),
    prisma.familyMember.findMany({ where: { userId } }),
    prisma.recurringExpense.findMany({ where: { userId } }),
    prisma.variableExpense.findMany({ where: { userId } }),
    prisma.incomeSource.findMany({ where: { userId } }),
    prisma.accountHoldings.findMany({ where: { userId } }),
    prisma.userData.findUnique({ where: { userId }, select: { aiInsights: true } }),
  ])

  const accounts: Account[] = dbAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as Account['type'],
    kind: a.kind as Account['kind'],
    owner: a.owner ?? undefined,
    notes: a.notes ?? undefined,
    url: a.url ?? undefined,
    monthlyDeposit: a.monthlyDeposit ?? undefined,
    feesFixed: a.feesFixed ?? undefined,
    feesOnBalance: a.feesOnBalance ?? undefined,
    feesOnDeposit: a.feesOnDeposit ?? undefined,
    description: a.description ?? undefined,
    bankVendor: a.bankVendor as Account['bankVendor'] ?? undefined,
    brokerageVendor: a.brokerageVendor as Account['brokerageVendor'] ?? undefined,
    liquidity: (a as any).liquidity as Account['liquidity'] ?? undefined,
  }))

  const snapshots: MonthlySnapshot[] = dbSnapshots.map((s) => ({
    id: s.id,
    date: s.date,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    entries: s.entries.map((e) => ({
      accountId: e.accountId,
      balance: e.balance,
      subBalances: e.subBalances as SnapshotEntry['subBalances'] ?? undefined,
      lastUpdatedAt: e.lastUpdatedAt?.toISOString() ?? undefined,
    })),
  }))

  const familyMembers: FamilyMember[] = dbFamilyMembers.map((m) => ({
    name: m.name,
    isChild: m.isChild,
  }))

  const expenses: RecurringExpense[] = dbExpenses.map((e) => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    category: e.category as RecurringExpense['category'],
    billingCycle: e.billingCycle as RecurringExpense['billingCycle'],
    owner: e.owner ?? undefined,
    notes: e.notes ?? undefined,
    active: e.active,
  }))

  const variableExpenses: VariableExpense[] = dbVariableExpenses.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category as VariableExpense['category'],
    owner: e.owner ?? undefined,
    active: e.active,
  }))

  const income: IncomeSource[] = dbIncome.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type as IncomeSource['type'],
    grossAmount: i.grossAmount,
    netAmount: i.netAmount,
    billingCycle: i.billingCycle as IncomeSource['billingCycle'],
    owner: i.owner ?? undefined,
    notes: i.notes ?? undefined,
    active: i.active,
  }))

  const accountHoldings: AccountHoldings[] = dbHoldings.map((h) => ({
    accountId: h.accountId,
    updatedAt: h.updatedAt.toISOString(),
    totalValueNIS: h.totalValueNIS,
    holdings: h.holdings as unknown as Investment[],
  }))

  const result: AppData = {
    accounts,
    snapshots,
    familyMembers,
    expenses,
    variableExpenses,
    income,
    accountHoldings,
  }

  const aiInsights = userData?.aiInsights as AppData['aiInsights'] | null
  if (aiInsights) result.aiInsights = aiInsights

  return result
}

export async function saveAppData(userId: string, data: AppData): Promise<void> {
  await Promise.all([
    saveAccounts(userId, data.accounts ?? []),
    saveFamilyMembers(userId, data.familyMembers ?? []),
    saveExpenses(userId, data.expenses ?? []),
    saveVariableExpenses(userId, data.variableExpenses ?? []),
    saveIncome(userId, data.income ?? []),
    saveAccountHoldings(userId, data.accountHoldings ?? []),
  ])
  // Snapshots depend on accounts existing first, so run after
  await saveSnapshots(userId, data.snapshots ?? [])
}

export async function saveAccounts(userId: string, accounts: Account[]): Promise<void> {
  const incomingIds = accounts.map((a) => a.id)
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i]
    await prisma.financialAccount.upsert({
      where: { id: a.id },
      update: {
        name: a.name, type: a.type, kind: a.kind ?? 'custom', owner: a.owner ?? null,
        notes: a.notes ?? null, url: a.url ?? null, monthlyDeposit: a.monthlyDeposit ?? null,
        feesFixed: a.feesFixed ?? null, feesOnBalance: a.feesOnBalance ?? null,
        feesOnDeposit: a.feesOnDeposit ?? null, description: a.description ?? null,
        bankVendor: a.bankVendor ?? null, brokerageVendor: a.brokerageVendor ?? null,
        liquidity: a.liquidity ?? null, sortOrder: i,
      },
      create: {
        id: a.id, userId, name: a.name, type: a.type, kind: a.kind ?? 'custom', owner: a.owner ?? null,
        notes: a.notes ?? null, url: a.url ?? null, monthlyDeposit: a.monthlyDeposit ?? null,
        feesFixed: a.feesFixed ?? null, feesOnBalance: a.feesOnBalance ?? null,
        feesOnDeposit: a.feesOnDeposit ?? null, description: a.description ?? null,
        bankVendor: a.bankVendor ?? null, brokerageVendor: a.brokerageVendor ?? null,
        liquidity: a.liquidity ?? null, sortOrder: i,
      },
    })
  }
  await prisma.financialAccount.deleteMany({ where: { userId, id: { notIn: incomingIds } } })
}

export async function saveSnapshots(userId: string, snapshots: MonthlySnapshot[]): Promise<void> {
  const incomingDates = snapshots.map((s) => s.date)
  for (const snap of snapshots) {
    const dbSnap = await prisma.monthlySnapshot.upsert({
      where: { userId_date: { userId, date: snap.date } },
      update: { updatedAt: snap.updatedAt ? new Date(snap.updatedAt) : new Date() },
      create: {
        id: snap.id, userId, date: snap.date,
        createdAt: snap.createdAt ? new Date(snap.createdAt) : new Date(),
        updatedAt: snap.updatedAt ? new Date(snap.updatedAt) : new Date(),
      },
    })
    const incomingEntryAccountIds = snap.entries.map((e) => e.accountId)
    for (const entry of snap.entries) {
      await prisma.snapshotEntry.upsert({
        where: { snapshotId_accountId: { snapshotId: dbSnap.id, accountId: entry.accountId } },
        update: {
          balance: entry.balance,
          subBalances: entry.subBalances ?? Prisma.JsonNull,
          lastUpdatedAt: entry.lastUpdatedAt ? new Date(entry.lastUpdatedAt) : null,
        },
        create: {
          snapshotId: dbSnap.id, accountId: entry.accountId, balance: entry.balance,
          subBalances: entry.subBalances ?? Prisma.JsonNull,
          lastUpdatedAt: entry.lastUpdatedAt ? new Date(entry.lastUpdatedAt) : null,
        },
      })
    }
    await prisma.snapshotEntry.deleteMany({ where: { snapshotId: dbSnap.id, accountId: { notIn: incomingEntryAccountIds } } })
  }
  await prisma.monthlySnapshot.deleteMany({ where: { userId, date: { notIn: incomingDates } } })
}

export async function saveFamilyMembers(userId: string, familyMembers: FamilyMember[]): Promise<void> {
  const incomingNames = familyMembers.map((m) => m.name)
  for (const m of familyMembers) {
    await prisma.familyMember.upsert({
      where: { userId_name: { userId, name: m.name } },
      update: { isChild: m.isChild ?? false },
      create: { userId, name: m.name, isChild: m.isChild ?? false },
    })
  }
  await prisma.familyMember.deleteMany({ where: { userId, name: { notIn: incomingNames } } })
}

export async function saveExpenses(userId: string, expenses: RecurringExpense[]): Promise<void> {
  const incomingIds = expenses.map((e) => e.id)
  for (const e of expenses) {
    await prisma.recurringExpense.upsert({
      where: { id: e.id },
      update: { name: e.name, amount: e.amount, category: e.category, billingCycle: e.billingCycle, owner: e.owner ?? null, notes: e.notes ?? null, active: e.active },
      create: { id: e.id, userId, name: e.name, amount: e.amount, category: e.category, billingCycle: e.billingCycle, owner: e.owner ?? null, notes: e.notes ?? null, active: e.active },
    })
  }
  await prisma.recurringExpense.deleteMany({ where: { userId, id: { notIn: incomingIds } } })
}

export async function saveVariableExpenses(userId: string, variableExpenses: VariableExpense[]): Promise<void> {
  const incomingIds = variableExpenses.map((e) => e.id)
  for (const e of variableExpenses) {
    await prisma.variableExpense.upsert({
      where: { id: e.id },
      update: { name: e.name, category: e.category, owner: e.owner ?? null, active: e.active },
      create: { id: e.id, userId, name: e.name, category: e.category, owner: e.owner ?? null, active: e.active },
    })
  }
  await prisma.variableExpense.deleteMany({ where: { userId, id: { notIn: incomingIds } } })
}

export async function saveIncome(userId: string, income: IncomeSource[]): Promise<void> {
  const incomingIds = income.map((i) => i.id)
  for (const i of income) {
    await prisma.incomeSource.upsert({
      where: { id: i.id },
      update: { name: i.name, type: i.type, grossAmount: i.grossAmount, netAmount: i.netAmount, billingCycle: i.billingCycle, owner: i.owner ?? null, notes: i.notes ?? null, active: i.active },
      create: { id: i.id, userId, name: i.name, type: i.type, grossAmount: i.grossAmount, netAmount: i.netAmount, billingCycle: i.billingCycle, owner: i.owner ?? null, notes: i.notes ?? null, active: i.active },
    })
  }
  await prisma.incomeSource.deleteMany({ where: { userId, id: { notIn: incomingIds } } })
}

export async function saveAccountHoldings(userId: string, holdings: AccountHoldings[]): Promise<void> {
  const incomingAccountIds = holdings.map((h) => h.accountId)
  for (const h of holdings) {
    await prisma.accountHoldings.upsert({
      where: { accountId: h.accountId },
      update: { updatedAt: new Date(h.updatedAt), totalValueNIS: h.totalValueNIS, holdings: h.holdings as object[] },
      create: { accountId: h.accountId, userId, updatedAt: new Date(h.updatedAt), totalValueNIS: h.totalValueNIS, holdings: h.holdings as object[] },
    })
  }
  await prisma.accountHoldings.deleteMany({ where: { userId, accountId: { notIn: incomingAccountIds } } })
}
