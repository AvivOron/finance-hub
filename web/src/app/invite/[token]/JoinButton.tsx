'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function JoinButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleJoin() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/finance-hub/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to join household')
        setLoading(false)
        return
      }
      // Full page reload to refetch session and data
      window.location.reload()
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 text-center">
          {error}
        </div>
      )}
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {loading ? 'Joining…' : 'Join Household'}
      </button>
    </div>
  )
}
