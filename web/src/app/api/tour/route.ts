import { NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { generateMockData } from '@/lib/tour-data'
import { DEMO_USER_EMAIL } from '@/lib/auth'

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

    // Create or update userData with mock data
    const mockData = generateMockData() as any
    await prisma.userData.upsert({
      where: { userId: user.id },
      update: { data: mockData },
      create: {
        userId: user.id,
        data: mockData
      }
    })

    // Create a JWT token
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        id: user.id,
        isDemo: true
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60
    })

    // Redirect to app with session cookie
    const baseUrl = new URL(request.url).origin
    const response = NextResponse.redirect(new URL('/finance-hub/app', baseUrl))

    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('[Tour API] ERROR:', error)
    return NextResponse.json({ error: 'Tour setup failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
