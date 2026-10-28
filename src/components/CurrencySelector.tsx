import React, { useState, useEffect } from 'react';
import { CurrencyOption, DEFAULT_CURRENCIES } from '../types';
import { getSavedCurrencies, saveCustomCurrency } from '../utils/currencyStore';
import { Coins, Plus } from 'lucide-react';

interface CurrencySelectorProps {
  value?: string;
  onChange: (currency: string) => void;
  label?: string;
  className?: string;
  allowCustom?: boolean;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value = 'TRY',
  onChange,
  label = 'Para Birimi',
  className = '',
  allowCustom = true,
}) => {
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');

  useEffect(() => {
    setCurrencies(getSavedCurrencies());
  }, []);

  const handleSaveCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = customCode.trim().toUpperCase();
    if (!code) return;
    const sym = customSymbol.trim() || code;
    const name = `${code} (${sym})`;
    const updated = saveCustomCurrency({ code, symbol: sym, name });
    setCurrencies(updated);
    onChange(code);
    setIsCustomMode(false);
    setCustomCode('');
    setCustomSymbol('');
  };

  const isKnown = currencies.some((c) => c.code === value);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>{label}</span>
          </label>
          {allowCustom && (
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(!isCustomMode);
                setCustomCode('');
                setCustomSymbol('');
              }}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              {isCustomMode ? 'Listeden Seç' : '+ Yeni Tanımla'}
            </button>
          )}
        </div>
      )}

      {isCustomMode ? (
        <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-0.5">Kod (Örn: CHF)</label>
              <input
                type="text"
                maxLength={6}
                placeholder="Örn: CHF, CAD"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-indigo-300 bg-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-indigo-900 uppercase mb-0.5">Sembol (Örn: Fr)</label>
              <input
                type="text"
                maxLength={4}
                placeholder="Örn: Fr, $, د.إ"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-indigo-300 bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => handleSaveCustom()}
              disabled={!customCode.trim()}
              className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
            >
              Kaydet ve Seç
            </button>
          </div>
        </div>
      ) : (
        <select
          value={value || 'TRY'}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setIsCustomMode(true);
            } else {
              onChange(e.target.value);
            }
          }}
          className="w-full px-3 py-2 text-sm font-medium rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-colors cursor-pointer"
        >
          {currencies.map((c: CurrencyOption) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.name}
            </option>
          ))}
          {!isKnown && value && (
            <option value={value}>
              {value} (Özel Para Birimi)
            </option>
          )}
          {allowCustom && (
            <option value="__custom__">+ Yeni Para Birimi Tanımla...</option>
          )}
        </select>
      )}
    </div>
  );
};
