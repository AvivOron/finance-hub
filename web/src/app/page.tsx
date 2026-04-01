import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/LandingPage'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/app')

  return <LandingPage />
}
