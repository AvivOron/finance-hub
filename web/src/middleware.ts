import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { sessionCookieName } from '@/lib/auth-cookies'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || '')

export async function middleware(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/finance-hub/api/')
  const token = request.cookies.get(sessionCookieName)?.value

  // If no token, block API requests with 401 JSON; redirect page requests to signin
  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Try to verify the token
  try {
    const { payload } = await jwtVerify(token, secret)

    // Demo account is read-only: block all mutating API requests
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    if (payload.isDemo && isApiRequest && isMutation) {
      return NextResponse.json({ error: 'Demo account is read-only' }, { status: 403 })
    }

    // Token is valid, continue
    return NextResponse.next()
  } catch (error) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }
}

export const config = {
  matcher: [
    '/finance-hub/app/:path*',
    '/finance-hub/api/data/:path*',
    '/finance-hub/api/accounts/:path*',
    '/finance-hub/api/income/:path*',
    '/finance-hub/api/expenses/:path*',
    '/finance-hub/api/variable-expenses/:path*',
    '/finance-hub/api/account-holdings/:path*',
    '/finance-hub/api/snapshots/:path*',
    '/finance-hub/api/properties/:path*',
    '/finance-hub/api/family-members/:path*',
    '/finance-hub/api/household/:path*',
    '/finance-hub/api/transactions/:path*',
    '/finance-hub/api/insights/:path*',
    '/finance-hub/api/save-insights/:path*',
    '/finance-hub/api/translate-insights/:path*',
    '/finance-hub/api/send-backup/:path*',
    '/finance-hub/api/map-transactions/:path*',
    '/finance-hub/api/parse-cal/:path*',
  ],
}
