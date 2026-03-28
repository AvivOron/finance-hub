import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/context/Providers'

export const metadata: Metadata = {
  title: 'Finance Hub',
  description: 'Track your net worth, expenses, and income'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
