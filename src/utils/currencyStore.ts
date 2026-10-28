import { CurrencyOption, DEFAULT_CURRENCIES } from '../types';
import { getStoredData, setStoredData } from './storage';

const CURRENCIES_STORAGE_KEY = 'erpv1_currencies_v1';
const EXCHANGE_RATES_STORAGE_KEY = 'erpv1_exchange_rates_v1';

export interface ExchangeRatesData {
  rates: Record<string, number>; // Foreign currency value in TRY (e.g. USD: 36.45 ₺)
  lastUpdated: string;
  source: 'api' | 'manual' | 'default';
}

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  TRY: 1,
  USD: 36.45,
  EUR: 39.50,
  GBP: 46.85,
  CHF: 41.20,
  AED: 9.92,
  SAR: 9.72,
  RUB: 0.38,
  JPY: 0.24,
  AZN: 21.44,
  KZT: 0.073,
};

export const getSavedExchangeRates = (): ExchangeRatesData => {
  const defaultData: ExchangeRatesData = {
    rates: DEFAULT_EXCHANGE_RATES,
    lastUpdated: new Date().toISOString(),
    source: 'default',
  };
  const stored = getStoredData<ExchangeRatesData>(EXCHANGE_RATES_STORAGE_KEY, defaultData);
  return {
    ...stored,
    rates: {
      ...DEFAULT_EXCHANGE_RATES,
      ...(stored.rates || {}),
      TRY: 1, // TRY is always 1
    },
  };
};

export const saveExchangeRates = (
  rates: Record<string, number>,
  source: 'api' | 'manual' = 'manual'
): ExchangeRatesData => {
  const current = getSavedExchangeRates();
  const updatedData: ExchangeRatesData = {
    rates: {
      ...current.rates,
      ...rates,
      TRY: 1,
    },
    lastUpdated: new Date().toISOString(),
    source,
  };
  setStoredData(EXCHANGE_RATES_STORAGE_KEY, updatedData);
  return updatedData;
};

export const fetchLiveExchangeRates = async (): Promise<{
  success: boolean;
  data: ExchangeRatesData;
  message: string;
}> => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/TRY');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data && data.result === 'success' && data.rates) {
      const calculatedRates: Record<string, number> = { TRY: 1 };
      
      // open.er-api rates are: 1 TRY = X ForeignCurrency
      // So 1 ForeignCurrency = 1 / X TRY
      Object.entries(data.rates).forEach(([currCode, rateAgainstTry]) => {
        const numRate = Number(rateAgainstTry);
        if (numRate > 0) {
          calculatedRates[currCode.toUpperCase()] = Math.round((1 / numRate) * 10000) / 10000;
        }
      });

      const saved = saveExchangeRates(calculatedRates, 'api');
      return {
        success: true,
        data: saved,
        message: 'Güncel döviz kurları başarıyla çekildi ve sisteme kaydedildi.',
      };
    }
    throw new Error('Geçersiz veri formatı');
  } catch (err: any) {
    console.warn('Live exchange rates fetch error:', err);
    return {
      success: false,
      data: getSavedExchangeRates(),
      message: 'Kurlar internetten çekilemedi; kayıtlı son kurlar korunuyor.',
    };
  }
};

export const convertCurrencyToTRY = (
  amount: number,
  currencyCode: string = 'TRY',
  rates?: Record<string, number>
): number => {
  if (!amount || isNaN(amount)) return 0;
  const cleanCode = (currencyCode || 'TRY').trim().toUpperCase();
  if (cleanCode === 'TRY') return amount;

  const currentRates = rates || getSavedExchangeRates().rates;
  const rate = currentRates[cleanCode] || DEFAULT_EXCHANGE_RATES[cleanCode] || 1;
  return Math.round((amount * rate + Number.EPSILON) * 100) / 100;
};

export const getCurrencyExchangeRate = (
  currencyCode: string = 'TRY',
  rates?: Record<string, number>
): number => {
  const cleanCode = (currencyCode || 'TRY').trim().toUpperCase();
  if (cleanCode === 'TRY') return 1;
  const currentRates = rates || getSavedExchangeRates().rates;
  return currentRates[cleanCode] || DEFAULT_EXCHANGE_RATES[cleanCode] || 1;
};

export const getSuggestedCrossRate = (
  fromCurrency: string = 'TRY',
  toCurrency: string = 'TRY',
  rates?: Record<string, number>
): { rate: number; label: string; formula: 'divide' | 'multiply' } => {
  const from = (fromCurrency || 'TRY').trim().toUpperCase();
  const to = (toCurrency || 'TRY').trim().toUpperCase();

  if (from === to) {
    return { rate: 1, label: `1 ${from} = 1 ${to}`, formula: 'multiply' };
  }

  const currentRates = rates || getSavedExchangeRates().rates;
  const fromTryRate = currentRates[from] || DEFAULT_EXCHANGE_RATES[from] || 1;
  const toTryRate = currentRates[to] || DEFAULT_EXCHANGE_RATES[to] || 1;

  // If paying in TRY towards foreign debt (e.g. 3000 TRY -> EUR debt)
  if (from === 'TRY') {
    // Standard convention in Turkey: 1 EUR = 40.00 ₺ (formula: 3000 / 40 = 75 EUR)
    return {
      rate: Math.round(toTryRate * 10000) / 10000,
      label: `1 ${to} = ${toTryRate} ₺`,
      formula: 'divide',
    };
  }

  // If paying in foreign currency towards TRY debt (e.g. 2000 EUR -> TRY debt)
  if (to === 'TRY') {
    // Standard convention: 1 EUR = 40.00 ₺ (formula: 2000 * 40 = 80000 ₺)
    return {
      rate: Math.round(fromTryRate * 10000) / 10000,
      label: `1 ${from} = ${fromTryRate} ₺`,
      formula: 'multiply',
    };
  }

  // Foreign to foreign (e.g. USD to EUR)
  // 1 toCurrency = (toTryRate / fromTryRate) fromCurrency
  const crossRate = Math.round((toTryRate / fromTryRate) * 10000) / 10000;
  return {
    rate: crossRate,
    label: `1 ${to} = ${crossRate} ${from}`,
    formula: 'divide',
  };
};

export const calculateCrossDeduction = (
  paymentAmount: number,
  fromCurrency: string,
  toCurrency: string,
  customRate?: number,
  rates?: Record<string, number>
): number => {
  if (!paymentAmount || isNaN(paymentAmount)) return 0;
  const from = (fromCurrency || 'TRY').trim().toUpperCase();
  const to = (toCurrency || 'TRY').trim().toUpperCase();
  if (from === to) return paymentAmount;

  const suggested = getSuggestedCrossRate(from, to, rates);
  const effectiveRate = customRate && customRate > 0 ? customRate : suggested.rate;
  if (!effectiveRate || effectiveRate <= 0) return 0;

  let result = 0;
  if (suggested.formula === 'divide') {
    result = paymentAmount / effectiveRate;
  } else {
    result = paymentAmount * effectiveRate;
  }
  return Math.round((result + Number.EPSILON) * 100) / 100;
};


export const getSavedCurrencies = (): CurrencyOption[] => {
  const stored = getStoredData<CurrencyOption[]>(CURRENCIES_STORAGE_KEY, DEFAULT_CURRENCIES);
  // Ensure default currencies are always present
  const missingDefaults = DEFAULT_CURRENCIES.filter(
    (def) => !stored.some((s) => s.code.toUpperCase() === def.code.toUpperCase())
  );
  return [...stored, ...missingDefaults];
};

export const saveCustomCurrency = (newCurr: {
  code: string;
  symbol: string;
  name: string;
}): CurrencyOption[] => {
  const current = getSavedCurrencies();
  const cleanCode = newCurr.code.trim().toUpperCase();
  const cleanSymbol = newCurr.symbol.trim() || cleanCode;
  const cleanName = newCurr.name.trim() || `${cleanCode} (${cleanSymbol})`;

  const existingIdx = current.findIndex((c) => c.code.toUpperCase() === cleanCode);
  let updated: CurrencyOption[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { code: cleanCode, symbol: cleanSymbol, name: cleanName };
  } else {
    updated = [...current, { code: cleanCode, symbol: cleanSymbol, name: cleanName }];
  }
  setStoredData(CURRENCIES_STORAGE_KEY, updated);
  return updated;
};

export const deleteCustomCurrency = (code: string): CurrencyOption[] => {
  const cleanCode = code.trim().toUpperCase();
  if (['TRY', 'USD', 'EUR', 'GBP'].includes(cleanCode)) {
    return getSavedCurrencies(); // Core defaults cannot be removed
  }
  const current = getSavedCurrencies();
  const updated = current.filter((c) => c.code.toUpperCase() !== cleanCode);
  setStoredData(CURRENCIES_STORAGE_KEY, updated);
  return updated;
};
