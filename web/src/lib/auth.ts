import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const DEMO_USER_EMAIL = 'tour-demo@finance-hub.local'

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: { name: '__Secure-finance.session-token', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
    callbackUrl: { name: '__Secure-finance.callback-url', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
    csrfToken: { name: '__Host-finance.csrf-token', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
    pkceCodeVerifier: { name: '__Secure-finance.pkce.code_verifier', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
    state: { name: '__Secure-finance.state', options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.isDemo = user.email === DEMO_USER_EMAIL
      }
      return token
    },
    // Expose the user id and demo status in the session object
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        isDemo: token.isDemo as boolean
      }
    })
  },
  pages: {
    signIn: '/',
    error: '/auth/error'
  }
}
