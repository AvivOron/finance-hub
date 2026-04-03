export type Currency = 'USD' | 'NIS'

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', NIS: '₪' }

export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const symbol = CURRENCY_SYMBOL[currency]
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(abs)
  return `${sign}${symbol}${formatted}`
}

export function formatCurrencyShort(amount: number, currency: Currency = 'USD'): string {
  const symbol = CURRENCY_SYMBOL[currency]
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`
  return formatCurrency(amount, currency)
}

export function formatMonthLabel(date: string): string {
  const [year, month] = date.split('-')
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit'
  })
}

export function formatMonthFull(date: string, lang?: string): string {
  const [year, month] = date.split('-')
  const locale = lang === 'he' ? 'he-IL' : 'en-US'
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric'
  })
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
