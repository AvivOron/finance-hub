'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import {
  Home, Baby, RefreshCw, Shield, Zap, Car, PawPrint,
  ShoppingCart, Sparkles, MoreHorizontal, LucideIcon,
} from 'lucide-react'

export interface CategoryConfig {
  label: string
  icon: React.ReactNode
  color: string
}

export interface CategoryRow {
  id: string
  slug: string
  label: string
  icon: string
  color: string
  sortOrder: number
}

const ICON_MAP: Record<string, LucideIcon> = {
  Home, Baby, RefreshCw, Shield, Zap, Car, PawPrint,
  ShoppingCart, Sparkles, MoreHorizontal,
}

// Colors must live in source so Tailwind includes them at build time
const COLOR_MAP: Record<string, string> = {
  housing:       'text-blue-400 bg-blue-500/10 border-blue-500/20',
  childcare:     'text-pink-400 bg-pink-500/10 border-pink-500/20',
  subscriptions: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  insurance:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  utilities:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  transport:     'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  pets:          'text-rose-400 bg-rose-500/10 border-rose-500/20',
  groceries:     'text-green-400 bg-green-500/10 border-green-500/20',
  lifestyle:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  other:         'text-gray-400 bg-gray-500/10 border-gray-500/20',
}

function toConfig(row: CategoryRow): CategoryConfig {
  const IconComponent = ICON_MAP[row.icon] ?? MoreHorizontal
  return {
    label: row.label,
    icon: React.createElement(IconComponent, { size: 14 }),
    color: COLOR_MAP[row.slug] ?? row.color,
  }
}

// Module-level cache so the fetch only happens once per page load
let cachedRows: CategoryRow[] | null = null
let fetchPromise: Promise<CategoryRow[]> | null = null

function fetchCategories(): Promise<CategoryRow[]> {
  if (cachedRows) return Promise.resolve(cachedRows)
  if (!fetchPromise) {
    fetchPromise = fetch('/finance-hub/api/categories')
      .then(r => r.json())
      .then((rows: CategoryRow[]) => {
        cachedRows = rows
        return rows
      })
  }
  return fetchPromise
}

export function invalidateCategoryCache() {
  cachedRows = null
  fetchPromise = null
}

export type CategoryConfigMap = Record<string, CategoryConfig>

export function useCategories() {
  const [rows, setRows] = useState<CategoryRow[]>(() => cachedRows ?? [])

  useEffect(() => {
    fetchCategories().then(rows => setRows(rows))
  }, [])

  const categoryConfig: CategoryConfigMap = {}
  const categories: string[] = []
  for (const row of rows) {
    categoryConfig[row.slug] = toConfig(row)
    categories.push(row.slug)
  }

  return { categoryConfig, categories, rows }
}
