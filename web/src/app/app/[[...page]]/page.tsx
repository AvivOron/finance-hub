import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DEFAULT_APP_PAGE, getPageFromSegments } from '@/lib/app-routes'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface AppPageProps {
  params: {
    page?: string[]
  }
}

export default async function AppPage({ params }: AppPageProps) {
  const currentPage = getPageFromSegments(params.page)

  if (!currentPage) {
    redirect(`/app/${DEFAULT_APP_PAGE}`)
  }

  if (!params.page || params.page.length === 0) {
    redirect(`/app/${DEFAULT_APP_PAGE}`)
  }

  return null
}
