import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LoginButton } from '@/components/LoginButton'
import { TrendingUp, ShieldCheck, Cloud } from 'lucide-react'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/app')

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
            <TrendingUp size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Finance Hub</h1>
          <p className="text-gray-500 text-sm mt-2">
            Track your net worth, recurring expenses,<br />and income — all in one place.
          </p>
        </div>

        {/* Login card */}
        <div className="bg-[#14141f] border border-white/8 rounded-2xl p-6 shadow-2xl">
          <p className="text-xs text-gray-500 text-center mb-4">Sign in to access your dashboard</p>
          <LoginButton />
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex flex-col gap-2.5">
          {[
            { icon: ShieldCheck, text: 'Your data is end-to-end encrypted' },
            { icon: Cloud, text: 'Automatically synced to the cloud' }
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-xs text-gray-600">
              <Icon size={13} className="text-indigo-500/60 shrink-0" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
