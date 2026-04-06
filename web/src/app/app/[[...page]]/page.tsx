import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import { AppClient } from '@/app/app/AppClient'
import { authOptions } from '@/lib/auth'
import { DEFAULT_APP_PAGE, isRoutableAppPage } from '@/lib/app-routes'
import { Page } from '@/types'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface AppPageProps {
  params: {
    page?: string[]
  }
}

function getPageFromParams(pageSegments?: string[]): Page {
  if (!pageSegments || pageSegments.length === 0) {
    redirect(`/app/${DEFAULT_APP_PAGE}`)
  }

  if (pageSegments.length !== 1 || !isRoutableAppPage(pageSegments[0])) {
    redirect(`/app/${DEFAULT_APP_PAGE}`)
  }

  return pageSegments[0]
}

export default async function AppPage({ params }: AppPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/')

  const currentPage = getPageFromParams(params.page)

  return <AppClient user={session.user} page={currentPage} />
}
