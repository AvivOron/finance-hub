'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AuthError() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked: 'This email is already registered. Please sign in with the same method you used originally.',
    OAuthSignin: 'Could not start the sign-in process. Please try again.',
    OAuthCallback: 'Something went wrong during sign-in. Please try again.',
    Signin: 'Sign in failed. Please try again.',
    default: 'An unexpected error occurred.'
  }

  const message = error ? (errorMessages[error] ?? errorMessages.default) : errorMessages.default

  return (
    <div className="bg-[#14141f] border border-white/8 rounded-2xl p-8 max-w-sm w-full text-center">
      <p className="text-white font-semibold mb-2">Sign in failed</p>
      <p className="text-gray-500 text-sm mb-6">{message}</p>
      <Link href="/" className="text-indigo-400 text-sm hover:text-indigo-300">
        Try again
      </Link>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center px-4">
      <Suspense>
        <AuthError />
      </Suspense>
    </div>
  )
}
