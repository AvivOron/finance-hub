'use client'

import { signIn } from 'next-auth/react'
import { Rocket } from 'lucide-react'

export function LoginButton({ callbackUrl = '/finance-hub/app' }: { callbackUrl?: string } = {}) {
  const handleTourClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    console.log('Tour button clicked!')
    // Use /api/tour only on avivo.dev (has rewrite), otherwise use /finance-hub/api/tour
    const url = false ? '/api/tour' : '/finance-hub/api/tour'
    window.location.href = url
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => signIn('google', { callbackUrl })}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold transition-colors shadow-lg"
      >
        {/* Google "G" logo */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-[#14141f] text-gray-500">or</span>
        </div>
      </div>

      <a
        href="#"
        onClick={handleTourClick}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 text-sm font-semibold transition-colors"
      >
        <Rocket size={18} />
        Try Tour
      </a>
    </div>
  )
}
