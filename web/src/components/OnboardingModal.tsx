'use client'

import { useState } from 'react'
import {
  X,
  Plus,
  Check,
  Wallet,
  Camera,
  Receipt,
  TrendingUp,
  Users,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '../utils'
import { FamilyMember } from '@/types'
import { useLanguage } from '../context/LanguageContext'

type Lang = 'en' | 'he'

// Simple bilingual lookup — keeps all strings co-located with the component
const s = {
  // Welcome
  welcomeTitle:       { en: 'Welcome to Finance Hub', he: 'ברוכים הבאים ל-Finance Hub' },
  welcomeSubtitle:    { en: 'Your personal finance command centre. Track net worth, investments, and real estate — log every expense, and gain clarity on your money — all in one place.', he: 'מרכז הפיקוד הפיננסי האישי שלך. עקוב אחרי שווי נטו, השקעות ונדל"ן — רשום כל הוצאה וקבל בהירות על הכסף שלך — הכל במקום אחד.' },
  welcomeBullet1:     { en: 'Track assets, liabilities, investments & properties', he: 'עקוב אחרי נכסים, התחייבויות, השקעות ונדל"ן' },
  welcomeBullet2:     { en: 'Log recurring & variable income and expenses', he: 'רשום הכנסות והוצאות קבועות ומשתנות' },
  welcomeBullet3:     { en: 'Get AI-powered financial insights', he: 'קבל תובנות פיננסיות מבוססות AI' },
  // Family
  familyTitle:        { en: "Who's in your household?", he: 'מי נמצא במשק הבית שלך?' },
  familySubtitle:     { en: 'Family members let you organise accounts, income, and expenses by person. You can always add or edit these later in Settings.', he: 'הוספת בני משפחה מאפשרת לארגן חשבונות, הכנסות והוצאות לפי אדם. תמיד ניתן להוסיף או לערוך אותם מאוחר יותר בהגדרות.' },
  familyPlaceholder:  { en: 'Member name…', he: 'שם בן המשפחה' },
  familyAdd:          { en: 'Add', he: 'הוסף' },
  familyIsChild:      { en: 'This person is a child', he: 'בן משפחה זה הוא ילד' },
  familyChildBadge:   { en: 'child', he: 'ילד' },
  familyEmpty:        { en: 'No members added yet — you can always do that later in the Settings page.', he: 'לא נוספו בני משפחה עדיין — ניתן לעשות זאת מאוחר יותר בדף ההגדרות.' },
  // Accounts guide
  accountsTitle:      { en: 'Set up your accounts', he: 'הגדר את החשבונות שלך' },
  accountsDesc:       { en: 'Accounts represent everything you own (assets) or owe (liabilities) — bank accounts, investments, loans, and more.', he: 'חשבונות מייצגים את כל מה שיש לך (נכסים) או שאתה חייב (התחייבויות) — חשבונות בנק, השקעות, הלוואות ועוד.' },
  accountsBullet1:    { en: 'Assets include bank accounts, brokerage portfolios, and savings.', he: 'נכסים כוללים חשבונות בנק, תיקי תיווך וחסכונות.' },
  accountsBullet2:    { en: 'Liabilities include mortgages, loans, and credit card balances.', he: 'התחייבויות כוללות משכנתאות, הלוואות ויתרות כרטיסי אשראי.' },
  accountsBullet3:    { en: 'Track investment holdings and real estate separately in the Investments and Properties pages.', he: 'עקוב אחרי פוזיציות בתיק ההשקעות ונכסי נדל"ן בנפרד בדפי ההשקעות והנדל"ן.' },
  // Snapshot guide
  snapshotTitle:      { en: 'Record your first snapshot', he: 'הוסף את התיעוד הראשון שלך' },
  snapshotDesc:       { en: "A monthly snapshot is a point-in-time record of all your account balances. It's how Finance Hub tracks your net worth over time.", he: 'תיעוד חודשי הוא רשומה נקודתית של כל יתרות החשבון שלך. כך Finance Hub עוקב אחרי שווי הנטו שלך לאורך זמן.' },
  snapshotBullet1:    { en: 'Each month, open the Snapshot page and enter your current balances.', he: 'בכל חודש, פתח את דף התיעוד והזן את היתרות הנוכחיות שלך.' },
  snapshotBullet2:    { en: 'Finance Hub will calculate your total assets, liabilities, and net worth automatically.', he: 'Finance Hub יחשב אוטומטית את סך הנכסים, ההתחייבויות ושווי הנטו.' },
  snapshotBullet3:    { en: "Over time you'll build a clear picture of your financial progress.", he: 'לאורך זמן תבנה תמונה ברורה של ההתקדמות הפיננסית שלך.' },
  // Expenses guide
  expensesTitle:      { en: 'Track your money flow', he: 'עקוב אחרי תזרים הכסף שלך' },
  expensesDesc:       { en: 'Log your income and expenses to understand exactly where your money comes from — and where it goes.', he: 'רשום הכנסות והוצאות כדי להבין בדיוק מאיפה הכסף שלך מגיע — ולאן הוא הולך.' },
  expensesBullet1:    { en: 'Add recurring expenses like rent, subscriptions, and insurance on the Expenses page.', he: 'הוסף הוצאות קבועות כמו שכירות, מנויים וביטוח בדף ההוצאות.' },
  expensesBullet2:    { en: 'Track day-to-day variable spending on the Transactions page — import from your credit card or log manually.', he: 'עקוב אחרי הוצאות משתנות יומיומיות בדף העסקאות — ייבא מכרטיס האשראי או רשום ידנית.' },
  expensesBullet3:    { en: 'Record income sources with gross and net amounts on the Income page — Finance Hub calculates your monthly surplus automatically.', he: 'רשום מקורות הכנסה עם ברוטו ונטו בדף ההכנסות — Finance Hub מחשב את העודף החודשי אוטומטית.' },
  // Done
  doneTitle:          { en: "You're all set!", he: 'הכל מוכן!' },
  doneSubtitle:       { en: 'Your Finance Hub is ready. Start by adding your accounts and recording your first monthly snapshot.', he: 'Finance Hub שלך מוכן. התחל בהוספת חשבונות ותיעוד התיעוד החודשי הראשון שלך.' },
  doneAccounts:       { en: 'Accounts', he: 'חשבונות' },
  doneSnapshot:       { en: 'Snapshot', he: 'תיעוד' },
  doneInsights:       { en: 'Insights', he: 'תובנות' },
  // Buttons / footer
  btnGetStarted:      { en: 'Get started', he: 'בואו נתחיל' },
  btnContinue:        { en: 'Continue', he: 'המשך' },
  btnSaving:          { en: 'Saving…', he: 'שומר...' },
  btnStartTracking:   { en: 'Start tracking', he: 'התחל לעקוב' },
  btnGotIt:           { en: 'Got it', he: 'הבנתי' },
  btnBack:            { en: 'Back', he: 'חזור' },
  btnDontShow:        { en: "Don't show again", he: 'אל תציג שוב' },
  // Counter
  stepOf:             { en: 'of', he: 'מתוך' },
}

function tx(key: keyof typeof s, lang: Lang): string {
  return s[key][lang]
}

interface OnboardingModalProps {
  onComplete: () => void
  onDismissPermanently: () => void
  initialFamilyMembers?: FamilyMember[]
  onSaveFamilyMembers: (members: FamilyMember[]) => Promise<void>
}

const TOTAL_STEPS = 6

// -------------------------------------------------------------------
// Welcome illustration SVG
// -------------------------------------------------------------------
function WelcomeIllustration() {
  return (
    <svg
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-48 h-auto mx-auto"
      aria-hidden="true"
    >
      <ellipse cx="100" cy="110" rx="80" ry="18" fill="#6366f1" opacity="0.12" />
      <rect x="28" y="70" width="18" height="40" rx="4" fill="#6366f1" opacity="0.5" />
      <rect x="52" y="50" width="18" height="60" rx="4" fill="#6366f1" opacity="0.7" />
      <rect x="76" y="35" width="18" height="75" rx="4" fill="#6366f1" />
      <rect x="100" y="55" width="18" height="55" rx="4" fill="#6366f1" opacity="0.7" />
      <rect x="124" y="42" width="18" height="68" rx="4" fill="#6366f1" opacity="0.85" />
      <rect x="148" y="28" width="18" height="82" rx="4" fill="#6366f1" />
      <polyline
        points="37,68 61,48 85,33 109,53 133,40 157,26"
        stroke="#a5b4fc"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="37" cy="68" r="4" fill="#c7d2fe" />
      <circle cx="85" cy="33" r="4" fill="#c7d2fe" />
      <circle cx="157" cy="26" r="4" fill="#fff" />
      <circle cx="165" cy="55" r="14" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" />
      <text x="165" y="60" textAnchor="middle" fontSize="13" fill="#a5b4fc" fontWeight="bold">
        ₪
      </text>
    </svg>
  )
}

// -------------------------------------------------------------------
// Step 0 — Welcome
// -------------------------------------------------------------------
function WelcomeStep({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-2">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-2xl scale-150" />
        <WelcomeIllustration />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">{tx('welcomeTitle', lang)}</h2>
        <p className="text-white/60 text-sm leading-relaxed max-w-sm">{tx('welcomeSubtitle', lang)}</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs text-sm text-white/40">
        {(['welcomeBullet1', 'welcomeBullet2', 'welcomeBullet3'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <Check size={14} className="text-indigo-400 shrink-0" />
            <span>{tx(key, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Step 1 — Family
// -------------------------------------------------------------------
interface FamilyStepProps {
  lang: Lang
  members: FamilyMember[]
  onMembersChange: (members: FamilyMember[]) => void
}

function FamilyStep({ lang, members, onMembersChange }: FamilyStepProps) {
  const [name, setName] = useState('')
  const [isChild, setIsChild] = useState(false)

  function addMember() {
    const trimmed = name.trim()
    if (!trimmed) return
    onMembersChange([...members, { name: trimmed, isChild }])
    setName('')
    setIsChild(false)
  }

  function removeMember(idx: number) {
    onMembersChange(members.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/15 mb-1">
          <Users size={24} className="text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{tx('familyTitle', lang)}</h2>
        <p className="text-white/50 text-sm leading-relaxed">{tx('familySubtitle', lang)}</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder={tx('familyPlaceholder', lang)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        />
        <button
          onClick={addMember}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          {tx('familyAdd', lang)}
        </button>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-2">
        <div
          onClick={() => setIsChild((v) => !v)}
          className={cn(
            'w-8 h-5 rounded-full transition-colors relative',
            isChild ? 'bg-indigo-600' : 'bg-white/10'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              isChild ? 'translate-x-3' : 'translate-x-0'
            )}
          />
        </div>
        <span className="text-sm text-white/60">{tx('familyIsChild', lang)}</span>
      </label>

      {members.length > 0 && (
        <ul className="space-y-2">
          {members.map((m, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-white/5 border border-white/8 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-semibold">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-white">{m.name}</span>
                {m.isChild && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
                    {tx('familyChildBadge', lang)}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeMember(i)}
                className="text-white/30 hover:text-white/70 transition-colors p-1"
                aria-label="Remove member"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {members.length === 0 && (
        <p className="text-center text-white/25 text-xs">{tx('familyEmpty', lang)}</p>
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Guide step (steps 2, 3, 4)
// -------------------------------------------------------------------
interface GuideStepProps {
  lang: Lang
  icon: React.ReactNode
  title: string
  description: string
  bullets: string[]
  actionLabel?: string
  onAction?: () => void
}

function GuideStep({ lang, icon, title, description, bullets, actionLabel, onAction }: GuideStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/15 mb-1">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-white/50 text-sm leading-relaxed">{description}</p>
      </div>
      <ul className="space-y-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Check size={11} className="text-indigo-400" />
            </span>
            <span className="text-sm text-white/70 leading-snug">{b}</span>
          </li>
        ))}
      </ul>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={cn(
            'self-start flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors',
            lang === 'he' && 'self-end flex-row-reverse'
          )}
        >
          {actionLabel}
          {lang === 'he' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
    </div>
  )
}

// -------------------------------------------------------------------
// Step 5 — Done
// -------------------------------------------------------------------
function DoneStep({ lang }: { lang: Lang }) {
  const dots = [
    { color: 'bg-indigo-400', top: '10%', left: '12%', delay: '0ms', size: 'w-2 h-2' },
    { color: 'bg-violet-400', top: '20%', left: '80%', delay: '200ms', size: 'w-1.5 h-1.5' },
    { color: 'bg-sky-400', top: '65%', left: '8%', delay: '400ms', size: 'w-1.5 h-1.5' },
    { color: 'bg-indigo-300', top: '75%', left: '85%', delay: '100ms', size: 'w-2 h-2' },
    { color: 'bg-pink-400', top: '15%', left: '50%', delay: '300ms', size: 'w-1 h-1' },
    { color: 'bg-violet-300', top: '80%', left: '50%', delay: '500ms', size: 'w-1 h-1' },
    { color: 'bg-indigo-500', top: '40%', left: '5%', delay: '250ms', size: 'w-1 h-1' },
    { color: 'bg-sky-300', top: '35%', left: '92%', delay: '450ms', size: 'w-1.5 h-1.5' },
  ]

  return (
    <div className="relative flex flex-col items-center text-center gap-5 py-4">
      {dots.map((d, i) => (
        <span
          key={i}
          className={cn('absolute rounded-full animate-ping', d.color, d.size)}
          style={{ top: d.top, left: d.left, animationDelay: d.delay, animationDuration: '1.8s' }}
        />
      ))}
      {[
        { color: 'bg-indigo-400', top: '55%', left: '20%', delay: '0ms' },
        { color: 'bg-violet-400', top: '30%', left: '70%', delay: '150ms' },
        { color: 'bg-sky-400', top: '70%', left: '72%', delay: '300ms' },
      ].map((d, i) => (
        <span
          key={`b${i}`}
          className={cn('absolute w-1.5 h-1.5 rounded-full animate-bounce', d.color)}
          style={{ top: d.top, left: d.left, animationDelay: d.delay }}
        />
      ))}

      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl scale-150" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Check size={38} className="text-white" strokeWidth={2.5} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">{tx('doneTitle', lang)}</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs">{tx('doneSubtitle', lang)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-1">
        {[
          { icon: <Wallet size={16} className="text-indigo-400" />, label: tx('doneAccounts', lang) },
          { icon: <Camera size={16} className="text-indigo-400" />, label: tx('doneSnapshot', lang) },
          { icon: <TrendingUp size={16} className="text-indigo-400" />, label: tx('doneInsights', lang) },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl py-3"
          >
            {icon}
            <span className="text-[11px] text-white/50">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Progress bar
// -------------------------------------------------------------------
function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / (TOTAL_STEPS - 1)) * 100)
  return (
    <div className="h-1 bg-white/8 w-full">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// -------------------------------------------------------------------
// Step dots
// -------------------------------------------------------------------
function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full transition-all duration-300',
            i === step
              ? 'w-5 h-1.5 bg-indigo-500'
              : i < step
              ? 'w-1.5 h-1.5 bg-indigo-500/50'
              : 'w-1.5 h-1.5 bg-white/15'
          )}
        />
      ))}
    </div>
  )
}

// -------------------------------------------------------------------
// Main component
// -------------------------------------------------------------------
export function OnboardingModal({
  onComplete,
  onDismissPermanently,
  initialFamilyMembers = [],
  onSaveFamilyMembers,
}: OnboardingModalProps) {
  const { lang: rawLang, setLang } = useLanguage()
  const lang: Lang = rawLang === 'he' ? 'he' : 'en'
  const isRtl = lang === 'he'

  const [step, setStep] = useState(0)
  const [members, setMembers] = useState<FamilyMember[]>(initialFamilyMembers)
  const [saving, setSaving] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  function goTo(nextStep: number) {
    setStep(nextStep)
    setAnimKey((k) => k + 1)
  }

  async function handleNext() {
    if (step === 1) {
      if (members.length > 0) {
        setSaving(true)
        try {
          await onSaveFamilyMembers(members)
        } finally {
          setSaving(false)
        }
      }
      goTo(step + 1)
      return
    }
    if (step === TOTAL_STEPS - 1) {
      onComplete()
      return
    }
    goTo(step + 1)
  }

  function handleBack() {
    if (step > 0) goTo(step - 1)
  }

  // -------------------------------------------------------------------
  // Step content
  // -------------------------------------------------------------------
  function renderStep() {
    switch (step) {
      case 0:
        return <WelcomeStep lang={lang} />
      case 1:
        return <FamilyStep lang={lang} members={members} onMembersChange={setMembers} />
      case 2:
        return (
          <GuideStep
            lang={lang}
            icon={<Wallet size={28} className="text-indigo-400" />}
            title={tx('accountsTitle', lang)}
            description={tx('accountsDesc', lang)}
            bullets={[tx('accountsBullet1', lang), tx('accountsBullet2', lang), tx('accountsBullet3', lang)]}
          />
        )
      case 3:
        return (
          <GuideStep
            lang={lang}
            icon={<Camera size={28} className="text-indigo-400" />}
            title={tx('snapshotTitle', lang)}
            description={tx('snapshotDesc', lang)}
            bullets={[tx('snapshotBullet1', lang), tx('snapshotBullet2', lang), tx('snapshotBullet3', lang)]}
          />
        )
      case 4:
        return (
          <GuideStep
            lang={lang}
            icon={<Receipt size={28} className="text-indigo-400" />}
            title={tx('expensesTitle', lang)}
            description={tx('expensesDesc', lang)}
            bullets={[tx('expensesBullet1', lang), tx('expensesBullet2', lang), tx('expensesBullet3', lang)]}
          />
        )
      case 5:
        return <DoneStep lang={lang} />
      default:
        return null
    }
  }

  // -------------------------------------------------------------------
  // Button labels
  // -------------------------------------------------------------------
  const isLastStep = step === TOTAL_STEPS - 1

  const nextLabel = (() => {
    if (step === 0) return tx('btnGetStarted', lang)
    if (step === 1) return saving ? tx('btnSaving', lang) : tx('btnContinue', lang)
    if (isLastStep) return tx('btnStartTracking', lang)
    return tx('btnGotIt', lang)
  })()

  const showBack = step > 0 && step < TOTAL_STEPS - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-[#14141f] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <ProgressBar step={step} />

        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <StepDots step={step} />
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/5 rounded-md p-0.5">
              {(['en', 'he'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded transition-colors',
                    lang === l
                      ? 'bg-indigo-500/30 text-indigo-300 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {l === 'en' ? 'EN' : 'עב'}
                </button>
              ))}
            </div>
            <span className="text-xs text-white/30">
              {step + 1} {tx('stepOf', lang)} {TOTAL_STEPS}
            </span>
          </div>
        </div>

        <div
          key={animKey}
          className="px-6 pt-6 pb-4 min-h-[340px] flex flex-col justify-center"
          style={{ animation: 'onboarding-fade-in 0.28s ease-out both' }}
        >
          {renderStep()}
        </div>

        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <div>
            {showBack && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                {tx('btnBack', lang)}
              </button>
            )}
            {(isLastStep || step === 0) && (
              <button
                onClick={onDismissPermanently}
                className="text-xs text-white/25 hover:text-white/50 transition-colors underline underline-offset-2"
              >
                {tx('btnDontShow', lang)}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNext}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                isLastStep
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white',
                saving && 'opacity-60 cursor-not-allowed'
              )}
            >
              {nextLabel}
              {!isLastStep && !saving && (isRtl ? <ChevronLeft size={15} /> : <ChevronRight size={15} />)}
              {isLastStep && <Sparkles size={15} />}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes onboarding-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
