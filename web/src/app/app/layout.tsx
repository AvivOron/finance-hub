import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { AppClient } from '@/app/app/AppClient'
import { authOptions } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  return (
    <>
      <AppClient user={session.user} />
      <div className="hidden">{children}</div>
    </>
  )
}
