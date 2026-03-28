'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center px-4">
      <div className="bg-[#14141f] border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="text-white font-semibold mb-2">Sign in failed</p>
        <p className="text-gray-500 text-sm mb-6">{error ?? 'An unexpected error occurred.'}</p>
        <Link href="/" className="text-indigo-400 text-sm hover:text-indigo-300">
          Try again
        </Link>
      </div>
    </div>
  )
}
