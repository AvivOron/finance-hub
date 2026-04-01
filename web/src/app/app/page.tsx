import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppClient } from './AppClient'

export default async function AppPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return <AppClient user={session.user} />
}
