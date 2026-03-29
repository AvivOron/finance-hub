import { withAuth } from 'next-auth/middleware'

const authMiddleware = withAuth({ pages: { signIn: '/finance-hub' } })

export default authMiddleware

export const config = {
  matcher: ['/app/:path*', '/api/data/:path*']
}
