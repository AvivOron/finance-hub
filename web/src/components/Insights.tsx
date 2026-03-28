'use client'

import { useState, useRef } from 'react'
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react'
import { AppData } from '../types'
import { useCurrency } from '../context/CurrencyContext'
import { cn } from '../utils'

interface InsightsProps {
  data: AppData
}

// Minimal markdown renderer: handles ## headers, **bold**, and - bullet lists
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 first:mt-0">
          {line.slice(3)}
        </h2>
      )
      i++
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

    if (line.trim() === '') {
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

export function Insights({ data }: InsightsProps) {
  const { currency } = useCurrency()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const hasData = data.snapshots.length > 0 || data.accounts.length > 0

  async function generate() {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setContent('')

    try {
      const res = await fetch('/finance-hub/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
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
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message ?? 'Failed to generate insights')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Insights</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Personalized financial advice based on your data
            </p>
          </div>
          {generated && !loading && (
            <button
              onClick={generate}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-gray-200 transition-colors shrink-0"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          )}
        </div>

        {!hasData ? (
          <div className="bg-[#14141f] border border-white/5 rounded-xl p-10 flex flex-col items-center text-center space-y-3">
            <AlertCircle size={32} className="text-gray-600" />
            <h3 className="text-base font-semibold text-white">Not enough data yet</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Add your accounts and record at least one monthly snapshot to generate insights.
            </p>
          </div>
        ) : !generated && !loading ? (
          <div className="bg-[#14141f] border border-white/5 rounded-xl p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Sparkles size={28} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Ready to analyze your finances</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                Claude will review your accounts, net worth history, income, and expenses to give you personalized advice.
              </p>
            </div>
            <button
              onClick={generate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
            >
              <Sparkles size={15} />
              Generate Insights
            </button>
          </div>
        ) : (
          <div className="bg-[#14141f] border border-white/5 rounded-xl p-5 md:p-6">
            {loading && content === '' ? (
              <div className="flex items-center gap-3 text-gray-500 py-4">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin shrink-0" />
                <span className="text-sm">Analyzing your financial data…</span>
              </div>
            ) : (
              <div>
                {renderMarkdown(content)}
                {loading && (
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
            Powered by Claude Opus · Not financial advice
          </p>
        )}
      </div>
    </div>
  )
}
