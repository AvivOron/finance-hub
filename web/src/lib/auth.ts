import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id
      return token
    },
    // Expose the user id in the session object
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string
      }
    })
  },
  pages: {
    signIn: '/',
    error: '/auth/error'
  }
}
