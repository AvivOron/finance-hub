import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/context/Providers'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.avivo.dev/finance-hub'),
  title: {
    default: 'Finance Hub',
    template: '%s | Finance Hub',
  },
  description: 'Track your net worth, recurring expenses, and income — all in one place.',
  openGraph: {
    type: 'website',
    url: 'https://www.avivo.dev/finance-hub',
    siteName: 'Finance Hub',
    title: 'Finance Hub',
    description: 'Track your net worth, recurring expenses, and income — all in one place.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finance Hub',
    description: 'Track your net worth, recurring expenses, and income — all in one place.',
  },
  alternates: {
    canonical: 'https://www.avivo.dev/finance-hub',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
