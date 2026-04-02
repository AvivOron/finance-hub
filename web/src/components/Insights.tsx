'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Globe } from 'lucide-react'
import { AppData } from '../types'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { cn } from '../utils'

interface InsightsProps {
  data: AppData
  user?: { isDemo?: boolean }
  onSaveInsights?: (insights: { content: string; language: string; generatedAt: string }) => Promise<void>
}

// Markdown renderer: handles # h1, ## h2, ### h3, **bold**, - bullet lists, and | tables
function renderMarkdown(text: string, lang?: string): React.ReactNode[] {
  const isRtl = lang === 'he'
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  function isTableRow(line: string) {
    return line.trim().startsWith('|') && line.trim().endsWith('|')
  }

  function isSeparatorRow(line: string) {
    return /^\|[\s|:-]+\|$/.test(line.trim())
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      nodes.push(
        <h1 key={i} className="text-lg font-bold text-white mt-6 mb-2 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-sm font-semibold text-gray-200 mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++
      continue
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    // Table: collect all consecutive table rows
    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const nonSeparator = tableLines.filter(l => !isSeparatorRow(l))
      const [headerRow, ...bodyRows] = nonSeparator
      const parseRow = (row: string) =>
        row.trim().slice(1, -1).split('|').map(cell => cell.trim())

      nodes.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr>
                {parseRow(headerRow).map((cell, j) => (
                  <th key={j} className="text-gray-400 font-medium px-3 py-1.5 border-b border-white/10 text-start">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5">
                  {parseRow(row).map((cell, j) => (
                    <td key={j} className="text-gray-300 px-3 py-1.5">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={i} className="space-y-1.5 my-2 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-gray-300">
              <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (line.trim() === '' || line.trim() === '---') {
      i++
      continue
    }

    nodes.push(
      <p key={i} className="text-sm text-gray-300 leading-relaxed my-1">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return nodes
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
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
      <div className="max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0 gap-6">
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
