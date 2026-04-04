import { useState, useEffect, useCallback } from 'react'
import { Property } from '../types'

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/finance-hub/api/properties')
      .then(r => r.ok ? r.json() : [])
      .then((data: Property[]) => setProperties(data))
      .catch(() => setProperties([]))
      .finally(() => setLoading(false))
  }, [])

  const addProperty = useCallback(
    async (payload: Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<void> => {
      const res = await fetch('/finance-hub/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const created: Property = await res.json()
      setProperties(prev => [...prev, created])
    },
    []
  )

  const updateProperty = useCallback(
    async (id: string, payload: Omit<Property, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<void> => {
      const res = await fetch(`/finance-hub/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: Property = await res.json()
      setProperties(prev => prev.map(p => (p.id === id ? updated : p)))
    },
    []
  )

  const deleteProperty = useCallback(
    async (id: string): Promise<void> => {
      const res = await fetch(`/finance-hub/api/properties/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setProperties(prev => prev.filter(p => p.id !== id))
    },
    []
  )

  return { properties, loading, addProperty, updateProperty, deleteProperty }
}
