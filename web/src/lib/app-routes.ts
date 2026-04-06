import { Page } from '@/types'

export const DEFAULT_APP_PAGE: Page = 'dashboard'

export const ROUTABLE_APP_PAGES: readonly Page[] = [
  'dashboard',
  'snapshot',
  'accounts',
  'history',
  'expenses',
  'income',
  'insights',
  'projections',
  'investments',
  'transactions',
  'properties',
  'fire',
  'settings',
]

export function isRoutableAppPage(value: string): value is Page {
  return ROUTABLE_APP_PAGES.includes(value as Page)
}

export function getPageFromSegments(pageSegments?: string[]): Page | null {
  if (!pageSegments || pageSegments.length === 0) {
    return DEFAULT_APP_PAGE
  }

  if (pageSegments.length !== 1 || !isRoutableAppPage(pageSegments[0])) {
    return null
  }

  return pageSegments[0]
}
