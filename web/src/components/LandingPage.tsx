'use client'

import { LoginButton } from '@/components/LoginButton'
import { useLanguage } from '@/context/LanguageContext'
import {
  TrendingUp,
  ShieldCheck,
  Cloud,
  BarChart3,
  Wallet,
  Receipt,
  BrainCircuit,
  Users,
  RefreshCw,
  LineChart,
  PieChart,
} from 'lucide-react'
import { cn } from '@/utils'

const copy = {
  h1a:          { en: 'Your complete', he: 'לוח הבקרה הפיננסי' },
  h1b:          { en: 'finance dashboard', he: 'שלך' },
  subtitle:     { en: 'Track net worth, recurring expenses, and income — in one private, beautifully simple place.', he: 'עקוב אחרי שווי נטו, הוצאות חוזרות והכנסות — במקום אחד פרטי ופשוט.' },
  signIn:       { en: 'Sign in to access your dashboard', he: 'התחבר כדי לגשת ללוח הבקרה' },
  encrypted:    { en: 'End-to-end encrypted', he: 'מוצפן מקצה לקצה' },
  synced:       { en: 'Synced to the cloud', he: 'מסונכרן לענן' },
  household:    { en: 'Household sharing', he: 'שיתוף משפחתי' },
  featuresH2:   { en: 'Everything you need to stay on top of your finances', he: 'כל מה שצריך כדי לנהל את הכספים שלך' },
  featuresSub:  { en: 'Built for individuals and households who want clarity without complexity.', he: 'בנוי עבור יחידים ומשפחות שרוצים בהירות ללא סיבוך.' },
  stepsH2:      { en: 'Get started in minutes', he: 'מתחילים תוך דקות' },
  stepsSub:     { en: 'No spreadsheets. No setup fees. No clutter.', he: 'ללא גיליונות אלקטרוניים. ללא עלויות. ללא עומס.' },
  footer:       { en: 'Finance Hub — free, private, and open source.', he: 'Finance Hub — חינמי, פרטי ופתוח.' },
}

const features = [
  {
    icon: TrendingUp,
    title:       { en: 'Net worth tracking',    he: 'מעקב שווי נטו' },
    description: { en: 'Connect assets and liabilities to see your net worth evolve over time with historical charts.', he: 'חבר נכסים והתחייבויות וצפה כיצד שווי הנטו שלך מתפתח לאורך זמן.' },
  },
  {
    icon: Receipt,
    title:       { en: 'Recurring expenses',    he: 'הוצאות חוזרות' },
    description: { en: 'Log subscriptions, rent, and insurance. See your total monthly burn at a glance.', he: 'תעד מנויים, שכירות וביטוחים. ראה את סך ההוצאות החודשיות במבט אחד.' },
  },
  {
    icon: Wallet,
    title:       { en: 'Income management',     he: 'ניהול הכנסות' },
    description: { en: 'Track salary, freelance, and investments. Supports gross-to-net calculation.', he: 'עקוב אחרי משכורת, פרילנס והשקעות. תומך בחישוב ברוטו לנטו.' },
  },
  {
    icon: BarChart3,
    title:       { en: 'Monthly snapshots',     he: 'תיעוד חודשי' },
    description: { en: 'Record account balances each month and view your wealth trajectory over time.', he: 'תעד יתרות חשבון מדי חודש וצפה במסלול העושר שלך לאורך זמן.' },
  },
  {
    icon: BrainCircuit,
    title:       { en: 'AI-powered insights',   he: 'תובנות מבוססות AI' },
    description: { en: 'Plain-language analysis of your finances — trends, savings rate, and suggestions.', he: 'ניתוח פיננסי בשפה פשוטה — מגמות, שיעור חיסכון והמלצות.' },
  },
  {
    icon: RefreshCw,
    title:       { en: 'Multi-currency',        he: 'ריבוי מטבעות' },
    description: { en: 'Switch between NIS (₪) and USD ($) with automatic conversion across all views.', he: 'עבור בין ₪ ל-$ עם המרה אוטומטית בכל התצוגות.' },
  },
  {
    icon: LineChart,
    title:       { en: 'Future projections',    he: 'תחזיות עתידיות' },
    description: { en: 'Forecast your net worth years ahead. Model returns, deposits, and fees to see exactly where you\'re headed.', he: 'חזה את שווי הנטו שלך שנים קדימה. בחן תשואות, הפקדות ודמי ניהול כדי לדעת לאן אתה הולך.' },
  },
  {
    icon: PieChart,
    title:       { en: 'Portfolio tracking',    he: 'מעקב תיק השקעות' },
    description: { en: 'Upload brokerage statements to track holdings, gains, and fees. See your asset allocation at a glance.', he: 'העלה דוחות של חברות ביטחון כדי לעקוב אחרי אחזקות, רווחים ודמים. ראה את הקצאת הנכסים שלך במבט אחד.' },
  },
]

const steps = [
  {
    title:  { en: 'Sign in with Google',      he: 'התחבר עם Google' },
    detail: { en: 'One click — no password needed. Your account is created automatically.', he: 'לחיצה אחת — אין צורך בסיסמה. החשבון נוצר אוטומטית.' },
  },
  {
    title:  { en: 'Add your accounts',        he: 'הוסף חשבונות' },
    detail: { en: 'Enter bank accounts, investments, mortgage, and any asset or liability.', he: 'הזן חשבונות בנק, השקעות, משכנתא וכל נכס או התחייבות.' },
  },
  {
    title:  { en: 'Record a snapshot',        he: 'תעד תיעוד חודשי' },
    detail: { en: 'Log current balances for each account. Repeat monthly to build history.', he: 'תעד יתרות נוכחיות לכל חשבון. חזור מדי חודש לבניית היסטוריה.' },
  },
  {
    title:  { en: 'Track expenses & income',  he: 'עקוב אחרי הוצאות והכנסות' },
    detail: { en: 'Add recurring costs and income sources to see your true monthly cash flow.', he: 'הוסף עלויות חוזרות ומקורות הכנסה כדי לראות את תזרים המזומנים האמיתי שלך.' },
  },
  {
    title:  { en: 'Upload portfolio holdings',  he: 'העלה את אחזקות התיק' },
    detail: { en: 'Import XLSX brokerage statements to track investments, gains, and management fees in one place.', he: 'ייבא דוחות של חברות ביטחון כדי לעקוב אחרי השקעות, רווחים ודמי ניהול במקום אחד.' },
  },
]

export function LandingPage() {
  const { lang, setLang } = useLanguage()
  const rtl = lang === 'he'

  function s(obj: { en: string; he: string }) {
    return obj[lang]
  }

  return (
    <div className={cn('min-h-screen bg-[#09090f] text-white overflow-x-hidden', rtl && 'direction-rtl')} dir={rtl ? 'rtl' : 'ltr'}>

      {/* ── Ambient glow ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-violet-700/8 blur-[100px]" />
        <div className="absolute top-1/3 -right-32 w-[350px] h-[350px] rounded-full bg-indigo-500/6 blur-[90px]" />
      </div>

      {/* ── Language toggle ── */}
      <div className={cn('relative flex pt-5 px-5', rtl ? 'justify-start' : 'justify-end')}>
        <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-lg p-1">
          {(['en', 'he'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md transition-colors font-medium',
                lang === l
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {l === 'en' ? 'EN' : 'עב'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-14 pb-20 text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center mb-7 shadow-lg shadow-indigo-500/10">
          <TrendingUp size={30} className="text-indigo-300" />
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 max-w-2xl leading-[1.1]">
          {s(copy.h1a)}{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            {s(copy.h1b)}
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-lg mb-12 leading-relaxed">
          {s(copy.subtitle)}
        </p>

        {/* Login card */}
        <div className="w-full max-w-sm relative">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 blur-xl scale-105" />
          <div className="relative bg-[#14141f]/80 backdrop-blur border border-white/8 rounded-2xl p-6 shadow-2xl shadow-black/50">
            <p className="text-xs text-gray-500 text-center mb-4">{s(copy.signIn)}</p>
            <LoginButton />
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {[
            { icon: ShieldCheck, text: s(copy.encrypted) },
            { icon: Cloud,       text: s(copy.synced) },
            { icon: Users,       text: s(copy.household) },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Icon size={12} className="text-indigo-500/50 shrink-0" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      {/* ── Features ── */}
      <section className="relative px-4 py-20 max-w-4xl mx-auto" aria-label="Features">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{s(copy.featuresH2)}</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">{s(copy.featuresSub)}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title.en}
              className="group bg-[#14141f] border border-white/6 rounded-2xl p-5 hover:border-indigo-500/25 hover:bg-[#16162a] transition-colors duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-600/10 border border-indigo-500/15 flex items-center justify-center mb-3">
                <Icon size={17} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{s(title)}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{s(description)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      {/* ── How it works ── */}
      <section className="relative px-4 py-20 max-w-xl mx-auto" aria-label="How it works">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{s(copy.stepsH2)}</h2>
          <p className="text-gray-500 text-sm">{s(copy.stepsSub)}</p>
        </div>

        <ol className="space-y-5">
          {steps.map(({ title, detail }, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/25 to-violet-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 mt-2 bg-gradient-to-b from-indigo-500/20 to-transparent" />
                )}
              </div>
              <div className="pb-5">
                <p className="text-white text-sm font-medium">{s(title)}</p>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">{s(detail)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Footer ── */}
      <footer className="relative px-4 pb-12 text-center">
        <div className="h-px max-w-4xl mx-auto bg-gradient-to-r from-transparent via-white/8 to-transparent mb-8" />
        <p className="text-gray-700 text-xs">{s(copy.footer)}</p>
      </footer>

    </div>
  )
}
