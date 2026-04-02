'use client'

import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Wallet,
  PlusCircle,
  History,
  Receipt,
  TrendingUp,
  Sparkles,
  LineChart,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '../utils'
import { Page } from '@/types'
import { useLanguage } from '../context/LanguageContext'

interface TourStep {
  page: Page
  icon: React.ElementType
  navId: string
  title: { en: string; he: string }
  body: { en: string; he: string }
}

const TOUR_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    icon: LayoutDashboard,
    navId: 'tour-nav-dashboard',
    title: { en: 'Dashboard', he: 'לוח בקרה' },
    body: {
      en: 'Your financial command centre. See net worth, assets vs liabilities, and cash flow at a glance — all updated every time you add a snapshot.',
      he: 'מרכז הפיקוד הפיננסי שלך. ראה שווי נטו, נכסים מול התחייבויות ותזרים מזומנים במבט אחד — מתעדכן בכל פעם שמוסיפים תיעוד.',
    },
  },
  {
    page: 'accounts',
    icon: Wallet,
    navId: 'tour-nav-accounts',
    title: { en: 'Accounts', he: 'חשבונות' },
    body: {
      en: 'Define your assets (bank accounts, investments, savings) and liabilities (loans, mortgages). These become the categories you track each month.',
      he: 'הגדר את הנכסים שלך (חשבונות בנק, השקעות, חסכונות) והתחייבויות (הלוואות, משכנתאות). אלה הקטגוריות שתעקוב אחריהן כל חודש.',
    },
  },
  {
    page: 'snapshot',
    icon: PlusCircle,
    navId: 'tour-nav-snapshot',
    title: { en: 'Monthly Snapshot', he: 'תיעוד חודשי' },
    body: {
      en: 'Once a month, open this page and enter your current balances. Finance Hub will calculate your net worth and track your progress over time.',
      he: 'פעם בחודש, פתח דף זה והזן את היתרות הנוכחיות שלך. Finance Hub יחשב את שווי הנטו שלך וילווה את ההתקדמות לאורך זמן.',
    },
  },
  {
    page: 'history',
    icon: History,
    navId: 'tour-nav-history',
    title: { en: 'History', he: 'היסטוריה' },
    body: {
      en: "A timeline of every snapshot you've recorded, with month-over-month changes. Great for spotting trends and reviewing your financial journey.",
      he: 'ציר זמן של כל תיעוד שהוקלט, עם שינויים חודשיים. מצוין לזיהוי מגמות וסקירת המסע הפיננסי שלך.',
    },
  },
  {
    page: 'projections',
    icon: LineChart,
    navId: 'tour-nav-projections',
    title: { en: 'Projections', he: 'תחזיות' },
    body: {
      en: 'See where your money will be in 5, 10, or 30 years. Model different return rates, account for monthly deposits, and see the real cost of fees over time.',
      he: 'ראה לאן הכסף שלך יגיע בעוד 5, 10 או 30 שנה. בחן שיעורי תשואה שונים, הפקדות חודשיות והשפעת דמי הניהול לאורך זמן.',
    },
  },
  {
    page: 'expenses',
    icon: Receipt,
    navId: 'tour-nav-expenses',
    title: { en: 'Expenses', he: 'הוצאות' },
    body: {
      en: 'Log your recurring fixed costs — rent, insurance, subscriptions. Finance Hub tracks totals by category and shows your monthly burn rate.',
      he: 'רשום הוצאות קבועות חוזרות — שכירות, ביטוח, מנויים. Finance Hub עוקב אחרי סכומים לפי קטגוריה ומציג את ההוצאה החודשית.',
    },
  },
  {
    page: 'income',
    icon: TrendingUp,
    navId: 'tour-nav-income',
    title: { en: 'Income', he: 'הכנסות' },
    body: {
      en: 'Record salary and other income sources with gross and net amounts. Finance Hub calculates your take-home pay, savings rate, and cash flow.',
      he: 'רשום משכורת ומקורות הכנסה נוספים עם סכומי ברוטו ונטו. Finance Hub מחשב את הנטו לקחת הביתה, שיעור החיסכון ותזרים המזומנים.',
    },
  },
  {
    page: 'insights',
    icon: Sparkles,
    navId: 'tour-nav-insights',
    title: { en: 'AI Insights', he: 'תובנות AI' },
    body: {
      en: 'Get personalised financial advice from Claude AI. It reviews your accounts, history, income, and expenses to give you actionable recommendations.',
      he: 'קבל עצות פיננסיות מותאמות אישית מ-Claude AI. הוא סוקר את החשבונות, ההיסטוריה, ההכנסות וההוצאות שלך ומספק המלצות מעשיות.',
    },
  },
]

interface TourOverlayProps {
  onComplete: () => void
  onNavigate: (page: Page) => void
  currentPage: Page
}

// `side` = which side of the bubble the arrow sits on (pointing toward the sidebar)
// LTR: sidebar is left  → arrow on the LEFT  edge of bubble → points left
// RTL: sidebar is right → arrow on the RIGHT edge of bubble → points right
function TooltipArrow({ side }: { side: 'left' | 'right' }) {
  if (side === 'left') {
    // Arrow on left edge, pointing left
    return (
      <div className="absolute top-1/2 -translate-y-1/2 -left-[7px] w-0 h-0 border-y-[7px] border-y-transparent border-r-[7px] border-r-[#1e1e30]" />
    )
  }
  // Arrow on right edge, pointing right
  return (
    <div className="absolute top-1/2 -translate-y-1/2 -right-[7px] w-0 h-0 border-y-[7px] border-y-transparent border-l-[7px] border-l-[#1e1e30]" />
  )
}

const TIP_WIDTH = 288 // w-72
const MOBILE_BREAKPOINT = 768 // matches Tailwind md:

export function TourOverlay({ onComplete, onNavigate, currentPage }: TourOverlayProps) {
  const { lang, setLang } = useLanguage()
  const isRtl = lang === 'he'

  const [stepIdx, setStepIdx] = useState(0)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowSide, setArrowSide] = useState<'left' | 'right'>('left')
  const [isMobile, setIsMobile] = useState(false)
  const [visible, setVisible] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = TOUR_STEPS[stepIdx]
  const isLast = stepIdx === TOUR_STEPS.length - 1
  const isFirst = stepIdx === 0

  // Navigate to the page for this step
  useEffect(() => {
    if (currentPage !== step.page) {
      onNavigate(step.page)
    }
  }, [stepIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Position tooltip next to the sidebar nav item (desktop) or as bottom sheet (mobile)
  useEffect(() => {
    const position = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)

      if (mobile) {
        // Bottom-sheet: centered, pinned above bottom safe area
        setTooltipStyle({ bottom: 16, left: 16, right: 16, width: 'auto' })
        setArrowSide('left') // arrow hidden on mobile
        setVisible(true)
        return
      }

      const el = document.getElementById(step.navId)
      if (!el) {
        setTooltipStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
        setArrowSide('left')
        setVisible(true)
        return
      }
      const rect = el.getBoundingClientRect()
      const tipHeight = tooltipRef.current?.offsetHeight ?? 160
      const top = Math.min(
        Math.max(rect.top + rect.height / 2 - tipHeight / 2, 12),
        window.innerHeight - tipHeight - 12
      )
      if (isRtl) {
        setTooltipStyle({ top, left: rect.left - TIP_WIDTH - 12 })
        setArrowSide('right')
      } else {
        setTooltipStyle({ top, left: rect.right + 12 })
        setArrowSide('left')
      }
      setVisible(true)
    }

    setVisible(false)
    const t = setTimeout(position, 120)
    return () => clearTimeout(t)
  }, [stepIdx, step.navId, isRtl])

  function goTo(idx: number) {
    setAnimKey((k) => k + 1)
    setStepIdx(idx)
  }

  function handleNext() {
    if (isLast) {
      onNavigate('dashboard')
      onComplete()
    } else {
      goTo(stepIdx + 1)
    }
  }

  function handleBack() {
    if (!isFirst) goTo(stepIdx - 1)
  }

  const Icon = step.icon
  const slideFrom = isRtl ? '6px' : '-6px'

  return (
    <>
      {/* Dimmed overlay — doesn't block clicks on sidebar */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          'fixed z-[60] transition-opacity duration-200',
          isMobile ? 'w-auto' : 'w-72',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={tooltipStyle}
      >
        <div className="relative">
          {!isMobile && <TooltipArrow side={arrowSide} />}

          <div
            key={animKey}
            className="bg-[#1e1e30] border border-white/12 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            style={{ animation: 'tour-fade-in 0.22s ease-out both' }}
          >
            {/* Step progress bar */}
            <div className="h-0.5 bg-white/8">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-400"
                style={{ width: `${((stepIdx + 1) / TOUR_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="p-4 space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
              {/* Icon + title + skip */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">
                    {isRtl ? `שלב ${stepIdx + 1} מתוך ${TOUR_STEPS.length}` : `Step ${stepIdx + 1} of ${TOUR_STEPS.length}`}
                  </p>
                  <h3 className="text-sm font-semibold text-white leading-tight">{step.title[lang === 'he' ? 'he' : 'en']}</h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center bg-white/5 rounded-md p-0.5">
                    {(['en', 'he'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded transition-colors',
                          lang === l
                            ? 'bg-indigo-500/30 text-indigo-300 font-medium'
                            : 'text-gray-500 hover:text-gray-300'
                        )}
                      >
                        {l === 'en' ? 'EN' : 'עב'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onComplete}
                    className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
                    title={isRtl ? 'דלג על הסיור' : 'Skip tour'}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <p className="text-xs text-white/60 leading-relaxed">{step.body[lang === 'he' ? 'he' : 'en']}</p>

              {/* Step dots */}
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'rounded-full transition-all duration-300',
                      i === stepIdx
                        ? 'w-4 h-1 bg-indigo-500'
                        : i < stepIdx
                        ? 'w-1 h-1 bg-indigo-500/50'
                        : 'w-1 h-1 bg-white/15'
                    )}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleBack}
                  disabled={isFirst}
                  className={cn(
                    'flex items-center gap-1 text-xs transition-colors',
                    isFirst
                      ? 'text-white/20 cursor-not-allowed'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  {isRtl ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                  {isRtl ? 'הקודם' : 'Back'}
                </button>

                <button
                  onClick={handleNext}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    isLast
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  )}
                >
                  {isLast ? (isRtl ? 'סיום הסיור' : 'Finish tour') : (isRtl ? 'הבא' : 'Next')}
                  {isLast ? <Sparkles size={12} /> : isRtl ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animation — slides in from the sidebar side */}
      <style>{`
        @keyframes tour-fade-in {
          from { opacity: 0; transform: translateX(${slideFrom}); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
