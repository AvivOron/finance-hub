import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { saveAppData } from '@/lib/data'
import { generateMockData } from '@/lib/tour-data'
import { DEMO_USER_EMAIL } from '@/lib/auth'
import { isSecureAuthCookie, sessionCookieName } from '@/lib/auth-cookies'

function mockTransactions(userId: string) {
  const today = new Date()
  const months = [0, 1, 2].map(delta => {
    const d = new Date(today.getFullYear(), today.getMonth() - delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Per-month rows — vary amounts to make averages meaningful
  const rowsByMonth = [
    // current month
    [
      { merchant: 'HOT Mobile', amount: 350, type: 'הוראת קבע', calCategory: 'תקשורת', recurringExpenseId: 'exp-2', expenseCategory: 'utilities', mappingStatus: 'auto', day: 3 },
      { merchant: 'Netflix', amount: 15, type: 'הוראת קבע', calCategory: 'בידור', recurringExpenseId: 'exp-6', expenseCategory: 'subscriptions', mappingStatus: 'auto', day: 5 },
      { merchant: 'Yes Insurance', amount: 300, type: 'הוראת קבע', calCategory: 'ביטוח', recurringExpenseId: 'exp-5', expenseCategory: 'insurance', mappingStatus: 'auto', day: 1 },
      { merchant: 'Gas Station Paz', amount: 400, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'exp-7', expenseCategory: 'transport', mappingStatus: 'auto', day: 10 },
      { merchant: 'Preschool Gimel', amount: 2500, type: 'הוראת קבע', calCategory: 'חינוך', recurringExpenseId: 'exp-10', expenseCategory: 'childcare', mappingStatus: 'auto', day: 2 },
      { merchant: 'Shufersal', amount: 420, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 6 },
      { merchant: 'Rami Levy', amount: 380, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 15 },
      { merchant: 'Shufersal', amount: 290, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 22 },
      { merchant: 'Cafe Nero', amount: 85, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 8 },
      { merchant: 'Dominos Pizza', amount: 120, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 18 },
      { merchant: 'Super-Pharm', amount: 160, type: 'רגילה', calCategory: 'רוקחות', recurringExpenseId: 'vexp-3', expenseCategory: 'other', mappingStatus: 'manual', day: 12 },
      { merchant: 'Zara', amount: 340, type: 'רגילה', calCategory: 'ביגוד', recurringExpenseId: 'vexp-4', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 20 },
      { merchant: 'Ten', amount: 220, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'vexp-5', expenseCategory: 'transport', mappingStatus: 'manual', day: 14 },
      { merchant: 'Amazon', amount: 210, type: 'רגילה', calCategory: 'קניות', mappingStatus: 'unmapped', day: 9 },
      { merchant: 'Apple Store', amount: 49, type: 'רגילה', calCategory: 'אלקטרוניקה', mappingStatus: 'unmapped', day: 17 },
      { merchant: 'Bank Transfer', amount: 1000, type: 'העברה', calCategory: '', mappingStatus: 'ignored', day: 1 },
    ],
    // prev month — somewhat lower grocery/lifestyle spend
    [
      { merchant: 'HOT Mobile', amount: 350, type: 'הוראת קבע', calCategory: 'תקשורת', recurringExpenseId: 'exp-2', expenseCategory: 'utilities', mappingStatus: 'auto', day: 3 },
      { merchant: 'Netflix', amount: 15, type: 'הוראת קבע', calCategory: 'בידור', recurringExpenseId: 'exp-6', expenseCategory: 'subscriptions', mappingStatus: 'auto', day: 5 },
      { merchant: 'Yes Insurance', amount: 300, type: 'הוראת קבע', calCategory: 'ביטוח', recurringExpenseId: 'exp-5', expenseCategory: 'insurance', mappingStatus: 'auto', day: 1 },
      { merchant: 'Gas Station Paz', amount: 360, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'exp-7', expenseCategory: 'transport', mappingStatus: 'auto', day: 10 },
      { merchant: 'Preschool Gimel', amount: 2500, type: 'הוראת קבע', calCategory: 'חינוך', recurringExpenseId: 'exp-10', expenseCategory: 'childcare', mappingStatus: 'auto', day: 2 },
      { merchant: 'Shufersal', amount: 390, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 7 },
      { merchant: 'Rami Levy', amount: 310, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 16 },
      { merchant: 'Cafe Nero', amount: 65, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 9 },
      { merchant: 'Burger Ranch', amount: 95, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 21 },
      { merchant: 'Super-Pharm', amount: 90, type: 'רגילה', calCategory: 'רוקחות', recurringExpenseId: 'vexp-3', expenseCategory: 'other', mappingStatus: 'manual', day: 13 },
      { merchant: 'Ten', amount: 195, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'vexp-5', expenseCategory: 'transport', mappingStatus: 'manual', day: 18 },
      { merchant: 'Amazon', amount: 145, type: 'רגילה', calCategory: 'קניות', mappingStatus: 'unmapped', day: 11 },
      { merchant: 'Bank Transfer', amount: 1000, type: 'העברה', calCategory: '', mappingStatus: 'ignored', day: 1 },
    ],
    // 2 months ago — higher lifestyle, no clothing
    [
      { merchant: 'HOT Mobile', amount: 350, type: 'הוראת קבע', calCategory: 'תקשורת', recurringExpenseId: 'exp-2', expenseCategory: 'utilities', mappingStatus: 'auto', day: 3 },
      { merchant: 'Netflix', amount: 15, type: 'הוראת קבע', calCategory: 'בידור', recurringExpenseId: 'exp-6', expenseCategory: 'subscriptions', mappingStatus: 'auto', day: 5 },
      { merchant: 'Yes Insurance', amount: 300, type: 'הוראת קבע', calCategory: 'ביטוח', recurringExpenseId: 'exp-5', expenseCategory: 'insurance', mappingStatus: 'auto', day: 1 },
      { merchant: 'Gas Station Paz', amount: 430, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'exp-7', expenseCategory: 'transport', mappingStatus: 'auto', day: 10 },
      { merchant: 'Preschool Gimel', amount: 2500, type: 'הוראת קבע', calCategory: 'חינוך', recurringExpenseId: 'exp-10', expenseCategory: 'childcare', mappingStatus: 'auto', day: 2 },
      { merchant: 'Shufersal', amount: 460, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 5 },
      { merchant: 'Rami Levy', amount: 340, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 14 },
      { merchant: 'Shufersal', amount: 270, type: 'רגילה', calCategory: 'סופרמרקט', recurringExpenseId: 'vexp-1', expenseCategory: 'groceries', mappingStatus: 'manual', day: 23 },
      { merchant: 'Cafe Nero', amount: 110, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 7 },
      { merchant: 'Dominos Pizza', amount: 145, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 19 },
      { merchant: 'Arcafe', amount: 80, type: 'רגילה', calCategory: 'מסעדות', recurringExpenseId: 'vexp-2', expenseCategory: 'lifestyle', mappingStatus: 'manual', day: 25 },
      { merchant: 'Super-Pharm', amount: 200, type: 'רגילה', calCategory: 'רוקחות', recurringExpenseId: 'vexp-3', expenseCategory: 'other', mappingStatus: 'manual', day: 11 },
      { merchant: 'Ten', amount: 240, type: 'רגילה', calCategory: 'תחנות דלק', recurringExpenseId: 'vexp-5', expenseCategory: 'transport', mappingStatus: 'manual', day: 16 },
      { merchant: 'Amazon', amount: 320, type: 'רגילה', calCategory: 'קניות', mappingStatus: 'unmapped', day: 8 },
      { merchant: 'Apple Store', amount: 199, type: 'רגילה', calCategory: 'אלקטרוניקה', mappingStatus: 'unmapped', day: 22 },
      { merchant: 'Bank Transfer', amount: 1000, type: 'העברה', calCategory: '', mappingStatus: 'ignored', day: 1 },
    ],
  ]

  return months.flatMap((month, mi) =>
    rowsByMonth[mi].map((r, i) => {
      const [y, m] = month.split('-').map(Number)
      const date = `${y}-${String(m).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`
      const rawExpenseId: string | undefined = (r as any).recurringExpenseId
      const isVariable = rawExpenseId?.startsWith('vexp-')
      return {
        id: `demo-tx-${mi}-${i}`,
        userId,
        date,
        merchant: r.merchant,
        amount: r.amount,
        type: r.type,
        calCategory: r.calCategory || null,
        cardLast4: i % 2 === 0 ? '1234' : '5678',
        accountLabel: 'הפועלים 640-10524',
        recurringExpenseId: isVariable ? null : (rawExpenseId ?? null),
        variableExpenseId: isVariable ? rawExpenseId : null,
        expenseCategory: (r as any).expenseCategory ?? null,
        mappingStatus: r.mappingStatus,
        importedAt: new Date(),
        month,
      }
    })
  )
}

function mockProperties(userId: string) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return [
    {
      userId,
      name: 'Primary Residence',
      address: '14 Herzl Street, Tel Aviv',
      lat: 32.0853,
      lng: 34.7818,
      propertyType: 'apartment',
      estimatedValue: 3200000,
      valuationDate: todayStr,
      description: '4-room apartment, purchased 2018',
      notes: 'Linked to mortgage account',
    },
    {
      userId,
      name: 'Investment Property',
      address: '7 Ben Gurion Blvd, Haifa',
      lat: 32.8156,
      lng: 34.9858,
      propertyType: 'apartment',
      estimatedValue: 1450000,
      valuationDate: todayStr,
      description: '3-room apartment, rented out',
      notes: 'Monthly rental income ₪4,500',
    },
  ]
}

export async function GET(request: Request) {
  try {
    console.log('[Tour API] GET request received')

    // Create or get the demo user
    let user = await prisma.user.findUnique({
      where: { email: DEMO_USER_EMAIL }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: DEMO_USER_EMAIL,
          name: 'Tour Demo'
        }
      })
    }

    // Create or update normalized tables with mock data
    await saveAppData(user.id, generateMockData() as any)

    // Seed mock transactions (delete existing demo ones first)
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await Promise.all(mockTransactions(user.id).map(tx => prisma.transaction.create({ data: tx })))

    // Seed mock properties (delete existing demo ones first)
    await prisma.property.deleteMany({ where: { userId: user.id } })
    await Promise.all(mockProperties(user.id).map(p => prisma.property.create({ data: p })))

    const now = Math.floor(Date.now() / 1000)

    // Create a JWT token
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        id: user.id,
        isDemo: true,
        iat: now,
        exp: now + 24 * 60 * 60
      },
      secret: process.env.NEXTAUTH_SECRET!,
    })

    // Redirect to app - return location header without establishing absolute URL
    const response = new NextResponse(null, {
      status: 302,
      headers: {
        'Location': '/finance-hub/app'
      }
    })

    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      secure: isSecureAuthCookie,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response
  } catch (error) {
    console.error('[Tour API] ERROR:', error)
    return NextResponse.json({ error: 'Tour setup failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
