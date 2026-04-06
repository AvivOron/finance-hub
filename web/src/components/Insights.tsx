'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Globe } from 'lucide-react'
import { AppData } from '../types'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { cn } from '../utils'
import { renderMarkdown } from './renderMarkdown'

interface InsightsProps {
  data: AppData
  user?: { isDemo?: boolean }
  onSaveInsights?: (insights: { content: string; language: string; generatedAt: string }) => Promise<void>
}


export function Insights({ data, user, onSaveInsights }: InsightsProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [insightsLanguage, setInsightsLanguage] = useState<'en' | 'he' | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const hasData = data.snapshots.length > 0 || data.accounts.length > 0
  const isDemo = user?.isDemo ?? false
  const needsTranslation = generated && insightsLanguage && insightsLanguage !== lang

  // Load persisted insights on mount
  useEffect(() => {
    const aiInsights = (data as any).aiInsights
    if (aiInsights && aiInsights.content) {
      setInsightsLanguage(aiInsights.language || 'en')
      setContent(aiInsights.content)
      setGenerated(true)
    }
  }, [])

  async function generate() {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller


    setLoading(true)
    setError(null)
    setContent('')
    setGenerated(false)
    setInsightsLanguage(null)

    try {
      const res = await fetch('/finance-hub/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, language: lang }),
        signal: controller.signal
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Error ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        setContent(accumulated)
      }

      setGenerated(true)
      setInsightsLanguage(lang as 'en' | 'he')

      // Persist insights to database
      if (onSaveInsights) {
        await onSaveInsights({
          content: accumulated,
          language: lang,
          generatedAt: new Date().toISOString()
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message ?? t('insights.error', lang))
    } finally {
      setLoading(false)
    }
  }

  async function translateInsights() {
    if (!content || !insightsLanguage || insightsLanguage === lang) return

    setTranslating(true)

    setContent('')
    setError(null)

    try {
      const res = await fetch('/finance-hub/api/translate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          fromLanguage: insightsLanguage,
          toLanguage: lang
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Error ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        setContent(accumulated)
      }

      setInsightsLanguage(lang as 'en' | 'he')
    } catch (err: any) {
      setError(err.message ?? 'Failed to translate insights')
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="w-full flex flex-col flex-1 min-h-0 gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('insights.title', lang)}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('insights.subtitle', lang)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {needsTranslation && !translating && (
              <button
                onClick={translateInsights}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                title="Translate to current language"
              >
                <Globe size={14} />
              </button>
            )}
            {generated && !loading && !isDemo && (
              <button
                onClick={generate}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <RefreshCw size={14} />
                {t('insights.refresh', lang)}
              </button>
            )}
          </div>
        </div>

        {!hasData ? (
          <div className="bg-[#14141f] border border-white/5 rounded-xl p-10 flex flex-col items-center text-center space-y-3">
            <AlertCircle size={32} className="text-gray-600" />
            <h3 className="text-base font-semibold text-white">{t('insights.empty.title', lang)}</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              {t('insights.empty.message', lang)}
            </p>
          </div>
        ) : !generated && !loading ? (
          <div className="bg-[#14141f] border border-white/5 rounded-xl p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Sparkles size={28} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{t('insights.cta.title', lang)}</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                {t('insights.cta.message', lang)}
              </p>
            </div>
            <button
              onClick={generate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
            >
              <Sparkles size={15} />
              {t('insights.cta.button', lang)}
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-[#14141f] border border-white/5 rounded-xl p-5 md:p-6 flex flex-col overflow-hidden">
            {(loading || translating) && !content ? (
              <div className="flex items-center gap-3 text-gray-500 py-4">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
                <span className="text-sm">
                  {translating ? 'Translating…' : t('insights.loading', lang)}
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {renderMarkdown(content, insightsLanguage ?? lang)}
                {(loading || translating) && (
                  <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Model attribution */}
        {(generated || loading) && !error && (
          <p className="text-xs text-gray-700 text-center">
            {t('insights.attribution', lang)}
          </p>
        )}
      </div>
    </div>
  )
}
