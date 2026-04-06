'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Building2, Home, Landmark, Store, MapPin, Loader2, Check, Sparkles } from 'lucide-react'
import { Property, PropertyType } from '../types'
import { formatCurrency, formatCurrencyShort, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { Modal } from './Accounts'
import { renderMarkdown } from './renderMarkdown'

interface PropertiesProps {
  properties: Property[]
  onAdd: (property: Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onUpdate: (id: string, property: Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

type FormState = {
  name: string
  address: string
  lat: number | null
  lng: number | null
  propertyType: PropertyType
  estimatedValue: string
  valuationDate: string
  description: string
  notes: string
  aiEstimateReasoning: string
}

const PROPERTY_ICONS: Record<PropertyType, React.ElementType> = {
  apartment: Building2,
  house: Home,
  land: Landmark,
  commercial: Store,
  other: MapPin,
}

const PROPERTY_COLORS: Record<PropertyType, string> = {
  apartment: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  house: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  land: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  commercial: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  other: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

const PROPERTY_TYPES: PropertyType[] = ['apartment', 'house', 'land', 'commercial', 'other']

function todayString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const emptyForm: FormState = {
  name: '',
  address: '',
  lat: null,
  lng: null,
  propertyType: 'apartment',
  estimatedValue: '',
  valuationDate: todayString(),
  description: '',
  notes: '',
  aiEstimateReasoning: '',
}

// ─── Address autocomplete via OpenStreetMap Nominatim ────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  lang,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (display: string, lat: number, lng: number) => void
  placeholder: string
  lang: string
}) {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setOpen(false); return }
    setSearching(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=0&countrycodes=il`
      const res = await fetch(url, { headers: { 'Accept-Language': lang === 'he' ? 'he,en' : 'en' } })
      const data: NominatimResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [lang])

  function handleInput(v: string) {
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 400)
  }

  function handlePick(r: NominatimResult) {
    onSelect(r.display_name, parseFloat(r.lat), parseFloat(r.lon))
    setOpen(false)
    setResults([])
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => handleInput(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        />
        {searching && (
          <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />
        )}
        {!searching && value && (
          <MapPin size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden">
          {results.map(r => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition-colors truncate"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Property Card ────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  onEdit,
  onDelete,
  lang,
  currency,
}: {
  property: Property
  onEdit: () => void
  onDelete: () => void
  lang: string
  currency: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const Icon = PROPERTY_ICONS[property.propertyType] ?? MapPin
  const color = PROPERTY_COLORS[property.propertyType] ?? PROPERTY_COLORS.other
  const typeLabel = t(`properties.type.${property.propertyType}`, lang)

  const valuationFormatted = (() => {
    try {
      const [y, m, d] = property.valuationDate.split('-')
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString(
        lang === 'he' ? 'he-IL' : 'en-US',
        { day: 'numeric', month: 'short', year: 'numeric' }
      )
    } catch {
      return property.valuationDate
    }
  })()

  return (
    <div className="bg-[#14141f] border border-white/8 rounded-xl p-4 flex flex-col gap-3 hover:border-white/15 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn('p-2 rounded-lg border', color)}>
            <Icon size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{property.name}</p>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', color)}>
              {typeLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
          >
            <Pencil size={13} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDelete}
                className="text-[11px] px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/30 transition-colors"
              >
                {t('properties.deleteConfirm', lang)}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Value */}
      <div>
        <p className="text-xl font-bold text-white">
          {formatCurrency(property.estimatedValue, currency as 'NIS' | 'USD')}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {t('properties.card.valuedOn', lang)} {valuationFormatted}
        </p>
      </div>

      {/* Address */}
      {property.address && (
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <MapPin size={11} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{property.address}</span>
        </div>
      )}

      {/* Description */}
      {property.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{property.description}</p>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Properties({ properties, onAdd, onUpdate, onDelete }: PropertiesProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimateExplanation, setEstimateExplanation] = useState<string | null>(null)

  const totalValue = properties.reduce((s, p) => s + p.estimatedValue, 0)

  function openAdd() {
    setForm({ ...emptyForm, valuationDate: todayString() })
    setEditingId(null)
    setError(null)
    setShowModal(true)
  }

  function openEdit(p: Property) {
    setForm({
      name: p.name,
      address: p.address ?? '',
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      propertyType: p.propertyType,
      estimatedValue: String(p.estimatedValue),
      valuationDate: p.valuationDate,
      description: p.description ?? '',
      notes: p.notes ?? '',
      aiEstimateReasoning: p.aiEstimateReasoning ?? '',
    })
    setEditingId(p.id)
    setError(null)
    setEstimateExplanation(p.aiEstimateReasoning ?? null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setError(null)
    setEstimateExplanation(null)
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.estimatedValue || !form.valuationDate) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        lat: form.lat ?? undefined,
        lng: form.lng ?? undefined,
        propertyType: form.propertyType,
        estimatedValue: parseFloat(form.estimatedValue),
        valuationDate: form.valuationDate,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
        aiEstimateReasoning: form.aiEstimateReasoning || undefined,
      }
      if (editingId) {
        await onUpdate(editingId, payload as Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>)
      } else {
        await onAdd(payload as Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>)
      }
      closeModal()
    } catch (e: any) {
      setError(t('properties.error.save', lang) + (e?.message ?? String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function handleEstimate() {
    setEstimating(true)
    setEstimateExplanation(null)
    try {
      const res = await fetch('/finance-hub/api/estimate-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address || undefined,
          propertyType: form.propertyType,
          description: form.description || undefined,
          notes: form.notes || undefined,
          lat: form.lat ?? undefined,
          lng: form.lng ?? undefined,
          language: lang,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setEstimateExplanation('error')
      } else {
        set('estimatedValue', String(data.estimatedValue))
        setEstimateExplanation(data.explanation)
        set('aiEstimateReasoning', data.explanation ?? '')
      }
    } catch {
      setEstimateExplanation('error')
    } finally {
      setEstimating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await onDelete(id)
    } catch {
      // silent
    }
  }

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{t('properties.title', lang)}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('properties.subtitle', lang)}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          {t('properties.addButton', lang)}
        </button>
      </div>

      {/* Summary card */}
      {properties.length > 0 && (
        <div className="bg-[#14141f] border border-white/8 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{t('properties.total', lang)}</p>
            <p className="text-2xl font-bold text-white mt-0.5">
              {formatCurrency(totalValue, currency)}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            {properties.length} {properties.length === 1 ? t('properties.count', lang) : t('properties.count.plural', lang)}
          </p>
        </div>
      )}

      {/* Grid */}
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-full bg-white/5 mb-4">
            <Building2 size={28} className="text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400">{t('properties.empty.title', lang)}</p>
          <p className="text-xs text-gray-600 mt-1 max-w-xs">{t('properties.empty.message', lang)}</p>
          <button
            onClick={openAdd}
            className="mt-4 px-4 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            {t('properties.addButton', lang)}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => (
            <PropertyCard
              key={p.id}
              property={p}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
              lang={lang}
              currency={currency}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal
          title={editingId ? t('properties.modal.editTitle', lang) : t('properties.modal.newTitle', lang)}
          onClose={closeModal}
        >
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('properties.modal.nameLabel', lang)}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder={t('properties.modal.namePlaceholder', lang)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('properties.modal.typeLabel', lang)}
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PROPERTY_TYPES.map(type => {
                  const Icon = PROPERTY_ICONS[type]
                  const selected = form.propertyType === type
                  const color = PROPERTY_COLORS[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => set('propertyType', type)}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-all',
                        selected ? color : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400'
                      )}
                    >
                      <Icon size={14} />
                      {t(`properties.type.${type}`, lang)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('properties.modal.addressLabel', lang)}{' '}
                <span className="text-gray-600">{t('properties.modal.optional', lang)}</span>
              </label>
              <AddressAutocomplete
                value={form.address}
                onChange={v => set('address', v)}
                onSelect={(display, lat, lng) => setForm(f => ({ ...f, address: display, lat, lng }))}
                placeholder={t('properties.modal.addressPlaceholder', lang)}
                lang={lang}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('properties.modal.descriptionLabel', lang)}{' '}
                <span className="text-gray-600">{t('properties.modal.optional', lang)}</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder={t('properties.modal.descriptionPlaceholder', lang)}
                rows={3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('properties.modal.notesLabel', lang)}{' '}
                <span className="text-gray-600">{t('properties.modal.optional', lang)}</span>
              </label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder={t('properties.modal.notesPlaceholder', lang)}
                rows={2}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            {/* Estimated Value + Valuation Date side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t('properties.modal.estimatedValueLabel', lang)}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    value={form.estimatedValue}
                    onChange={e => { set('estimatedValue', e.target.value); setEstimateExplanation(null) }}
                    placeholder="e.g. 2500000"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleEstimate}
                    disabled={estimating || !form.name.trim()}
                    title={t('properties.modal.estimateButton', lang)}
                    className="shrink-0 flex items-center px-2 py-1.5 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-violet-300 border border-violet-500/30 rounded-lg transition-colors"
                  >
                    {estimating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t('properties.modal.valuationDateLabel', lang)}
                </label>
                <input
                  type="date"
                  value={form.valuationDate}
                  onChange={e => set('valuationDate', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {/* AI estimate explanation */}
            {estimateExplanation && estimateExplanation !== 'error' && (
              <div className="flex items-start gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <Sparkles size={12} className="shrink-0 mt-0.5 text-violet-400" />
                <div className="text-xs text-violet-300 leading-snug">{renderMarkdown(estimateExplanation, lang)}</div>
              </div>
            )}
            {estimateExplanation === 'error' && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {t('properties.modal.estimateError', lang)}
              </p>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded-lg transition-colors"
            >
              {t('properties.modal.cancel', lang)}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.estimatedValue || !form.valuationDate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving
                ? t('properties.modal.saving', lang)
                : editingId
                ? t('properties.modal.saveChanges', lang)
                : t('properties.modal.create', lang)}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
