'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertCircle, Globe, SendHorizontal } from 'lucide-react'
import { AppData, InsightsMessage } from '../types'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { cn, generateId } from '../utils'
import { renderMarkdown } from './renderMarkdown'

interface InsightsProps {
  data: AppData
  user?: { isDemo?: boolean }
}

// What's streaming in right now: a new report, a reply to the user, or a translation of the latest report
type Pending = { kind: 'report' | 'reply' | 'translation'; content: string }

async function streamText(res: Response, onText: (text: string) => void): Promise<string> {
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
    onText(accumulated)
  }
  return accumulated
}

export function Insights({ data, user }: InsightsProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const [messages, setMessages] = useState<InsightsMessage[]>(data.aiInsights?.messages ?? [])
  const [pending, setPending] = useState<Pending | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [waitSeconds, setWaitSeconds] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const hasData = data.snapshots.length > 0 || data.accounts.length > 0
  const isDemo = user?.isDemo ?? false
  const busy = pending !== null
  const hasReport = messages.some(m => m.kind === 'report')
  const latestReport = [...messages].reverse().find(m => m.kind === 'report')
  const needsTranslation = !busy && latestReport && latestReport.language !== lang

  // AppData can be stale after replies on another visit — load the stored thread
  useEffect(() => {
    fetch('/finance-hub/api/insights')
      .then(res => (res.ok ? res.json() : null))
      .then(body => { if (body?.messages) setMessages(body.messages) })
      .catch(() => {})
    return () => abortRef.current?.abort()
  }, [])

  // The model thinks before writing (up to a minute for a report), so count the wait
  const waitingForText = pending !== null && pending.content === ''
  useEffect(() => {
    if (!waitingForText) return
    setWaitSeconds(0)
    const timer = setInterval(() => setWaitSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [waitingForText])

  // Open at the top of the latest report (and of a new report as it starts streaming)
  const reportStreaming = pending?.kind === 'report'
  const scrolledOnce = useRef(false)
  useEffect(() => {
    const container = scrollRef.current
    const id = reportStreaming ? 'pending' : latestReport?.id
    const target = id && container?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
    if (!container || !target) return
    container.scrollTo({ top: target.offsetTop, behavior: scrolledOnce.current ? 'smooth' : 'auto' })
    scrolledOnce.current = true
  }, [latestReport?.id, reportStreaming])

  // While a reply streams in, follow it at the bottom
  const replyContent = pending?.kind === 'reply' ? pending.content : null
  useEffect(() => {
    const container = scrollRef.current
    if (container && replyContent !== null) container.scrollTop = container.scrollHeight
  }, [replyContent])

  function startRequest() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    return controller.signal
  }

  async function generate() {
    const signal = startRequest()
    setPending({ kind: 'report', content: '' })
    try {
      const res = await fetch('/finance-hub/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, language: lang }),
        signal,
      })
      const content = await streamText(res, text => setPending({ kind: 'report', content: text }))
      setMessages(prev => [...prev, {
        id: generateId(), role: 'assistant', kind: 'report', content,
        language: lang as InsightsMessage['language'], at: new Date().toISOString(),
      }])
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message ?? t('insights.error', lang))
    } finally {
      setPending(null)
    }
  }

  async function sendReply() {
    const text = draft.trim()
    if (!text || busy) return
    const signal = startRequest()
    const language = lang as InsightsMessage['language']
    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: text, language, at: new Date().toISOString() }])
    setDraft('')
    setPending({ kind: 'reply', content: '' })
    try {
      const res = await fetch('/finance-hub/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, currency, language: lang }),
        signal,
      })
      const content = await streamText(res, reply => setPending({ kind: 'reply', content: reply }))
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content, language, at: new Date().toISOString() }])
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // The server saves nothing on failure — drop the optimistic message and give the text back
        setMessages(prev => prev.slice(0, -1))
        setDraft(text)
        setError(err.message ?? t('insights.error', lang))
      }
    } finally {
      setPending(null)
    }
  }

  // Translates the latest report on screen only; the stored copy keeps its original language
  async function translateLatestReport() {
    if (!latestReport) return
    const signal = startRequest()
    setPending({ kind: 'translation', content: '' })
    try {
      const res = await fetch('/finance-hub/api/translate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: latestReport.content, fromLanguage: latestReport.language, toLanguage: lang }),
        signal,
      })
      const content = await streamText(res, text => setPending({ kind: 'translation', content: text }))
      setMessages(prev => prev.map(m => m.id === latestReport.id
        ? { ...m, content, language: lang as InsightsMessage['language'] }
        : m))
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message ?? 'Failed to translate insights')
    } finally {
      setPending(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  function renderMessage(m: InsightsMessage, content = m.content, streaming = false) {
    const cursor = streaming && <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
    if (m.kind === 'report') {
      return (
        <div key={m.id} data-msg-id={m.id} className="bg-[#14141f] border border-white/5 rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <Sparkles size={12} className="text-indigo-400" />
            {t('insights.report', lang)} · {formatDate(m.at)}
          </div>
          {renderMarkdown(content, m.language)}
          {cursor}
        </div>
      )
    }
    const mine = m.role === 'user'
    return (
      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
        <div className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
          mine ? 'bg-indigo-500/15 border border-indigo-500/20 text-gray-100 whitespace-pre-wrap' : 'bg-[#14141f] border border-white/5'
        )}>
          {mine ? content : renderMarkdown(content, m.language)}
          {cursor}
        </div>
      </div>
    )
  }

  const language = lang as InsightsMessage['language']
  const pendingMessage: InsightsMessage | null = pending && pending.kind !== 'translation'
    ? { id: 'pending', role: 'assistant', kind: pending.kind === 'report' ? 'report' : undefined, content: pending.content, language, at: new Date().toISOString() }
    : null

  return (
    <div className="absolute inset-0 flex flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="w-full flex flex-col flex-1 min-h-0 gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('insights.title', lang)}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('insights.subtitle', lang)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {needsTranslation && (
              <button
                onClick={translateLatestReport}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                title="Translate to current language"
              >
                <Globe size={14} />
              </button>
            )}
            {hasReport && !busy && !isDemo && (
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
        ) : messages.length === 0 && !busy ? (
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
              disabled={isDemo}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-sm text-white font-medium transition-colors"
            >
              <Sparkles size={15} />
              {t('insights.cta.button', lang)}
            </button>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto space-y-4 pe-1">
              {messages.map(m =>
                pending?.kind === 'translation' && m.id === latestReport?.id
                  ? renderMessage({ ...m, language }, pending.content, true)
                  : renderMessage(m)
              )}
              {pendingMessage && (pendingMessage.content
                ? renderMessage(pendingMessage, pendingMessage.content, true)
                : (
                  <div data-msg-id={pending?.kind === 'report' ? 'pending' : undefined} className="flex items-center gap-3 text-gray-500 py-2">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
                    <span className="text-sm">
                      {pending?.kind === 'report' ? t('insights.loading', lang) : t('insights.thinking', lang)}
                      <span className="text-gray-600 tabular-nums"> · {waitSeconds}s</span>
                      {pending?.kind === 'report' && <span className="text-gray-600"> · {t('insights.loading.hint', lang)}</span>}
                    </span>
                  </div>
                ))}
              {pending?.kind === 'translation' && !pending.content && (
                <p className="text-sm text-gray-500">{t('insights.translating', lang)}</p>
              )}
            </div>

            {hasReport && !isDemo && (
              <div className="shrink-0 space-y-1.5">
                <div className="flex items-end gap-2 bg-[#14141f] border border-white/10 focus-within:border-indigo-500/50 rounded-xl p-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        sendReply()
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    dir="auto"
                    placeholder={t('insights.reply.placeholder', lang)}
                    className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none max-h-40 [field-sizing:content]"
                  />
                  <button
                    onClick={sendReply}
                    disabled={busy || !draft.trim()}
                    aria-label={t('insights.reply.send', lang)}
                    className="shrink-0 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:hover:bg-indigo-500 text-white transition-colors"
                  >
                    <SendHorizontal size={16} className="rtl:rotate-180" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 px-1">{t('insights.reply.hint', lang)}</p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Model attribution */}
        {(messages.length > 0 || busy) && !error && (
          <p className="text-xs text-gray-700 text-center">
            {t('insights.attribution', lang)}
          </p>
        )}
      </div>
    </div>
  )
}
