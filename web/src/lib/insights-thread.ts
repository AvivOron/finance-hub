import type { InsightsMessage } from '@/types'

// Older rows stored a single report as { content, language, generatedAt }
export function readThread(raw: unknown): InsightsMessage[] {
  if (!raw || typeof raw !== 'object') return []
  const value = raw as { messages?: InsightsMessage[]; content?: string; language?: 'en' | 'he'; generatedAt?: string }
  if (Array.isArray(value.messages)) return value.messages
  if (value.content) {
    return [{ id: 'legacy-report', role: 'assistant', kind: 'report', content: value.content, language: value.language ?? 'en', at: value.generatedAt ?? new Date(0).toISOString() }]
  }
  return []
}
