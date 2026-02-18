export type SupportedCurrency = 'EUR' | 'USD'

interface FormatCurrencyOptions {
  /**
   * Keep higher precision for tiny values (existing BOM behavior).
   */
  preserveTinyPrecision?: boolean
}

const CURRENCY_FORMAT: Record<SupportedCurrency, { locale: string, symbol: string }> = {
  EUR: { locale: 'de-DE', symbol: '€' },
  USD: { locale: 'en-US', symbol: '$' },
}

export function normalizeCurrencyCode(raw: string | null | undefined): SupportedCurrency | null {
  const v = String(raw ?? '').trim().toUpperCase()
  if (!v) return null
  if (v === 'USD' || v === 'US$' || v === '$') return 'USD'
  if (v === 'EUR' || v === 'EURO' || v === '€') return 'EUR'
  return null
}

export function formatCurrency(value: number, currency: string, options: FormatCurrencyOptions = {}): string {
  const normalizedCurrency = normalizeCurrencyCode(currency)
  const preserveTinyPrecision = options.preserveTinyPrecision ?? true
  const fractionDigits = preserveTinyPrecision && value > 0 && value < 0.01 ? 4 : 2

  if (!normalizedCurrency) {
    return `${String(currency || '').toUpperCase()} ${value.toFixed(fractionDigits)}`
  }

  const cfg = CURRENCY_FORMAT[normalizedCurrency]
  try {
    const formattedNumber = new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value)
    return `${cfg.symbol} ${formattedNumber}`
  } catch {
    return `${cfg.symbol} ${value.toFixed(fractionDigits)}`
  }
}
