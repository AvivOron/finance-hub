import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { sessionCookieName } from '@/lib/auth-cookies'

export async function middleware(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: sessionCookieName,
  })

  // No valid session: block API requests with 401 JSON; redirect page requests to signin
  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/', request.url)
    signInUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Demo account is read-only: block all mutating API requests
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  if (token.isDemo && isApiRequest && isMutation) {
    return NextResponse.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/data/:path*',
    '/api/accounts/:path*',
    '/api/income/:path*',
    '/api/expenses/:path*',
    '/api/variable-expenses/:path*',
    '/api/account-holdings/:path*',
    '/api/snapshots/:path*',
    '/api/properties/:path*',
    '/api/family-members/:path*',
    '/api/household/:path*',
    '/api/transactions/:path*',
    '/api/insights/:path*',
    '/api/save-insights/:path*',
    '/api/translate-insights/:path*',
    '/api/send-backup/:path*',
    '/api/map-transactions/:path*',
    '/api/parse-cal/:path*',
  ],
}
