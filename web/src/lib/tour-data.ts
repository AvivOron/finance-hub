import { AppData } from '@/types'

export function generateMockData(): AppData {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prev2Month = new Date(today.getFullYear(), today.getMonth() - 2, 1)
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const prev2MonthStr = `${prev2Month.getFullYear()}-${String(prev2Month.getMonth() + 1).padStart(2, '0')}`

  return {
    familyMembers: [
      { name: 'You', isChild: false },
      { name: 'Partner', isChild: false },
      { name: 'Sarah', isChild: true },
      { name: 'David', isChild: true }
    ],
    accounts: [
      {
        id: 'checking-1',
        name: 'Checking Account',
        type: 'asset',
        kind: 'bank',
        owner: 'You',
        url: 'https://bank.example.com'
      },
      {
        id: 'savings-1',
        name: 'Emergency Fund',
        type: 'asset',
        kind: 'bank',
        owner: 'You',
        monthlyDeposit: 500
      },
      {
        id: 'brokerage-1',
        name: 'Investment Portfolio',
        type: 'asset',
        kind: 'brokerage',
        owner: 'You',
        monthlyDeposit: 3000,
        feesOnBalance: 0.5,
        description: '70% stocks, 30% bonds — index funds'
      },
      {
        id: 'savings-partner',
        name: 'Partner Savings',
        type: 'asset',
        kind: 'bank',
        owner: 'Partner',
        monthlyDeposit: 1500
      },
      {
        id: 'pension-1',
        name: 'Pension Fund',
        type: 'asset',
        kind: 'piggyBank',
        owner: 'You',
        monthlyDeposit: 2200,
        feesOnBalance: 0.3,
        feesOnDeposit: 1.5,
        description: 'Employer + employee contributions'
      },
      {
        id: 'piggy-sarah',
        name: "Sarah's Savings",
        type: 'asset',
        kind: 'piggyBank',
        owner: 'Sarah',
        monthlyDeposit: 200
      },
      {
        id: 'mortgage',
        name: 'Mortgage',
        type: 'liability',
        monthlyDeposit: 2200
      },
      {
        id: 'car-loan',
        name: 'Car Loan',
        type: 'liability',
        monthlyDeposit: 500
      },
      {
        id: 'credit-card-1',
        name: 'Credit Card - Chase',
        type: 'liability'
      },
      {
        id: 'student-loans',
        name: 'Student Loans',
        type: 'liability',
        owner: 'Partner',
        monthlyDeposit: 400
      },
      {
        id: 'heloc',
        name: 'HELOC',
        type: 'liability'
      }
    ],
    snapshots: [
      {
        id: 'snap-1',
        date: prev2MonthStr,
        createdAt: new Date(prev2Month).toISOString(),
        updatedAt: new Date(prev2Month).toISOString(),
        entries: [
          {
            accountId: 'checking-1',
            balance: 15000,
            subBalances: { checking: 15000 },
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'savings-1',
            balance: 75000,
            subBalances: { savings: 75000 },
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'brokerage-1',
            balance: 280000,
            subBalances: { stocks: 250000, cash: 30000 },
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'savings-partner',
            balance: 45000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'pension-1',
            balance: 142000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'piggy-sarah',
            balance: 5000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'mortgage',
            balance: 180000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'car-loan',
            balance: 18000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'credit-card-1',
            balance: 1500,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'student-loans',
            balance: 22000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          },
          {
            accountId: 'heloc',
            balance: 15000,
            lastUpdatedAt: new Date(prev2Month).toISOString()
          }
        ]
      },
      {
        id: 'snap-2',
        date: prevMonthStr,
        createdAt: new Date(prevMonth).toISOString(),
        updatedAt: new Date(prevMonth).toISOString(),
        entries: [
          {
            accountId: 'checking-1',
            balance: 18000,
            subBalances: { checking: 18000 },
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'savings-1',
            balance: 80000,
            subBalances: { savings: 80000 },
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'brokerage-1',
            balance: 295000,
            subBalances: { stocks: 265000, cash: 30000 },
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'savings-partner',
            balance: 48000,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'pension-1',
            balance: 144500,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'piggy-sarah',
            balance: 5500,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'mortgage',
            balance: 179500,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'car-loan',
            balance: 17500,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'credit-card-1',
            balance: 1200,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'student-loans',
            balance: 21800,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          },
          {
            accountId: 'heloc',
            balance: 15000,
            lastUpdatedAt: new Date(prevMonth).toISOString()
          }
        ]
      },
      {
        id: 'snap-3',
        date: currentMonth,
        createdAt: today.toISOString(),
        updatedAt: today.toISOString(),
        entries: [
          {
            accountId: 'checking-1',
            balance: 22000,
            subBalances: { checking: 22000 },
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'savings-1',
            balance: 90000,
            subBalances: { savings: 90000 },
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'brokerage-1',
            balance: 320000,
            subBalances: { stocks: 290000, cash: 30000 },
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'savings-partner',
            balance: 52000,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'pension-1',
            balance: 147200,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'piggy-sarah',
            balance: 6500,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'mortgage',
            balance: 179000,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'car-loan',
            balance: 17000,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'credit-card-1',
            balance: 800,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'student-loans',
            balance: 21500,
            lastUpdatedAt: today.toISOString()
          },
          {
            accountId: 'heloc',
            balance: 15000,
            lastUpdatedAt: today.toISOString()
          }
        ]
      }
    ],
    income: [
      {
        id: 'income-1',
        name: 'Salary',
        type: 'salary',
        grossAmount: 18000,
        netAmount: 13500,
        billingCycle: 'monthly',
        owner: 'You',
        active: true
      },
      {
        id: 'income-2',
        name: 'Partner Income',
        type: 'salary',
        grossAmount: 16000,
        netAmount: 12000,
        billingCycle: 'monthly',
        owner: 'Partner',
        active: true
      }
    ],
    expenses: [
      {
        id: 'exp-1',
        name: 'Mortgage Payment',
        amount: 2200,
        category: 'housing',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-2',
        name: 'Electricity & Water',
        amount: 350,
        category: 'utilities',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-3',
        name: 'Groceries',
        amount: 1200,
        category: 'groceries',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-4',
        name: 'Car Insurance',
        amount: 1200,
        category: 'insurance',
        billingCycle: 'yearly',
        active: true
      },
      {
        id: 'exp-5',
        name: 'Health Insurance',
        amount: 300,
        category: 'insurance',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-6',
        name: 'Netflix',
        amount: 15,
        category: 'subscriptions',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-7',
        name: 'Gas',
        amount: 400,
        category: 'transport',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-8',
        name: 'Dog Food & Vet',
        amount: 250,
        category: 'pets',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-9',
        name: 'Dining Out',
        amount: 600,
        category: 'lifestyle',
        billingCycle: 'monthly',
        active: true
      },
      {
        id: 'exp-10',
        name: 'Preschool (Sarah)',
        amount: 2500,
        category: 'childcare',
        billingCycle: 'monthly',
        owner: 'Sarah',
        active: true
      }
    ]
  }
}
