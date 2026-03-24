import { createContext, useContext, useState } from 'react'
import type { Currency } from '../utils'

interface CurrencyCtx {
  currency: Currency
  setCurrency: (c: Currency) => void
}

const CurrencyContext = createContext<CurrencyCtx>({ currency: 'NIS', setCurrency: () => {} })

const LS_KEY = 'networth-currency'

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      return saved === 'USD' || saved === 'NIS' ? saved : 'NIS'
    } catch {
      return 'NIS'
    }
  })

  function setCurrency(c: Currency) {
    setCurrencyState(c)
    try {
      localStorage.setItem(LS_KEY, c)
    } catch {}
  }

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
