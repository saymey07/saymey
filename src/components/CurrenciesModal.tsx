import React, { useState, useEffect } from 'react';
import { CurrencyOption, DEFAULT_CURRENCIES } from '../types';
import { 
  getSavedCurrencies, 
  saveCustomCurrency, 
  deleteCustomCurrency,
  getSavedExchangeRates,
  saveExchangeRates,
  fetchLiveExchangeRates,
  ExchangeRatesData
} from '../utils/currencyStore';
import { 
  Coins, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  TrendingUp, 
  Check, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { formatCurrency } from '../utils/storage';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface CurrenciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCurrencyUpdated?: () => void;
}

export const CurrenciesModal: React.FC<CurrenciesModalProps> = ({
  isOpen,
  onClose,
  onCurrencyUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'rates' | 'currencies'>('rates');
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [exchangeData, setExchangeData] = useState<ExchangeRatesData>(getSavedExchangeRates());
  const [editingRates, setEditingRates] = useState<Record<string, number>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'Para Birimini Sil',
    description: '',
    onConfirm: () => {},
  });
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New currency form
  const [code, setCode] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currs = getSavedCurrencies();
      const rates = getSavedExchangeRates();
      setCurrencies(currs);
      setExchangeData(rates);
      setEditingRates(rates.rates);
      setError(null);
      setFetchMessage(null);
      setCode('');
      setSymbol('');
      setName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Lütfen bir para birimi kodu giriniz (Örn: CHF).');
      return;
    }
    const cleanSymbol = symbol.trim() || cleanCode;
    const cleanName = name.trim() || `${cleanCode} (${cleanSymbol})`;

    const updated = saveCustomCurrency({
      code: cleanCode,
      symbol: cleanSymbol,
      name: cleanName,
    });
    setCurrencies(updated);
    setCode('');
    setSymbol('');
    setName('');
    setError(null);
    if (onCurrencyUpdated) onCurrencyUpdated();
  };

  const handleDelete = (codeToDelete: string) => {
    const updated = deleteCustomCurrency(codeToDelete);
    setCurrencies(updated);
    if (onCurrencyUpdated) onCurrencyUpdated();
  };

  const isDefaultCurrency = (cCode: string) => {
    return ['TRY', 'USD', 'EUR', 'GBP'].includes(cCode.toUpperCase());
  };

  const handleFetchRates = async () => {
    setIsFetchingRates(true);
    setFetchMessage(null);
    try {
      const res = await fetchLiveExchangeRates();
      setExchangeData(res.data);
      setEditingRates(res.data.rates);
      if (res.success) {
        setFetchMessage({ text: 'Günlük döviz kurları başarıyla güncellendi!', type: 'success' });
      } else {
        setFetchMessage({ text: res.message, type: 'error' });
      }
      if (onCurrencyUpdated) onCurrencyUpdated();
    } catch (e: any) {
      setFetchMessage({ text: 'Kurlar çekilirken bir hata oluştu.', type: 'error' });
    } finally {
      setIsFetchingRates(false);
    }
  };

  const handleRateChange = (currCode: string, value: string) => {
    const num = parseFloat(value);
    setEditingRates((prev) => ({
      ...prev,
      [currCode]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSaveManualRates = () => {
    const updated = saveExchangeRates(editingRates, 'manual');
    setExchangeData(updated);
    setFetchMessage({ text: 'Döviz kurları başarıyla kaydedildi!', type: 'success' });
    if (onCurrencyUpdated) onCurrencyUpdated();
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Para Birimleri & Günlük Kurlar</h3>
              <p className="text-xs text-slate-500">Faturalar, çekler, taşeron ve personel hakedişlerinde TL çevrimi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rates'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Günlük Döviz Kurları (TL Çevrim)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('currencies')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'currencies'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Tanımlı Para Birimleri ({currencies.length})</span>
          </button>
        </div>

        {/* Tab 1: Günlük Döviz Kurları */}
        {activeTab === 'rates' && (
          <div className="p-6 overflow-y-auto space-y-4">
            {/* Top Toolbar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    Günlük Döviz Kuru Servisi
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    {exchangeData.source === 'api' ? 'Canlı Veri' : exchangeData.source === 'manual' ? 'Kullanıcı Tanımlı' : 'Sistem Varsayılanı'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Son Güncelleme: <strong>{formatDateTime(exchangeData.lastUpdated)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleFetchRates}
                  disabled={isFetchingRates}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingRates ? 'animate-spin' : ''}`} />
                  <span>{isFetchingRates ? 'Kurlar Çekiliyor...' : 'Piyasa Kurlarını Çek'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualRates}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kurları Kaydet</span>
                </button>
              </div>
            </div>

            {fetchMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  fetchMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {fetchMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{fetchMessage.text}</span>
              </div>
            )}

            {/* Rates Table / List */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Para Birimi</span>
                <span>1 Birim Karşılığı (TL)</span>
              </div>

              <div className="divide-y divide-slate-100">
                {currencies.map((curr) => {
                  const isBase = curr.code === 'TRY';
                  const currentVal = isBase ? 1 : editingRates[curr.code] || 0;

                  return (
                    <div
                      key={curr.code}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 font-mono font-bold text-sm flex items-center justify-center border border-slate-200 shrink-0">
                          {curr.symbol || curr.code}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">{curr.code}</span>
                            <span className="text-xs text-slate-500">{curr.name}</span>
                          </div>
                          {isBase && (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              Ana Para Birimi (Sabit = 1,00 ₺)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isBase ? (
                          <div className="px-3.5 py-1.5 bg-slate-100 rounded-xl font-mono font-bold text-xs text-slate-600 border border-slate-200">
                            1.0000 ₺
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400 font-mono">1 {curr.code} =</span>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={currentVal === 0 ? '' : currentVal}
                              onChange={(e) => handleRateChange(curr.code, e.target.value)}
                              className="w-28 px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                              placeholder="0.0000"
                            />
                            <span className="text-xs font-bold text-slate-700 font-mono">₺</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2 text-xs text-amber-900 leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Hakediş ve Harcama Hesaplamaları:</strong> Personel avanslarında, maaşlarında ve taşeron hakedişlerinde döviz (USD, EUR, vb.) olarak yapılan ödemeler, bu kurlar baz alınarak otomatik olarak Türk Lirasına (TL) dönüştürülür ve genel hakediş tablosuna doğru şekilde yansıtılır.
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tanımlı Para Birimleri */}
        {activeTab === 'currencies' && (
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Add New Currency Form */}
            <form onSubmit={handleAdd} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Yeni Para Birimi Tanımla</span>
              </div>

              {error && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Para Kodu (ISO) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Örn: CHF"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Sembol / İşaret
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="Örn: Fr, $, د.إ"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Açıklama / İsim
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: İsviçre Frangı"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sisteme Ekle</span>
                </button>
              </div>
            </form>

            {/* Existing Currencies List */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Kayıtlı ve Aktif Para Birimleri ({currencies.length})
                </h4>
                <span className="text-[11px] text-slate-500">Varsayılan: Türk Lirası (₺)</span>
              </div>

              <div className="space-y-2">
                {currencies.map((curr) => {
                  const isDefault = isDefaultCurrency(curr.code);
                  const isBase = curr.code === 'TRY';

                  return (
                    <div
                      key={curr.code}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 font-bold font-mono text-base flex items-center justify-center border border-slate-200">
                          {curr.symbol || curr.code}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 font-mono">{curr.code}</span>
                            <span className="text-slate-600 text-xs font-medium">{curr.name}</span>
                            {isBase && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Ana Birim (Default)
                              </span>
                            )}
                            {!isBase && isDefault && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Standart
                              </span>
                            )}
                            {!isDefault && (
                              <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                                Özel Tanımlı
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirm({
                              isOpen: true,
                              title: 'Para Birimini Sil',
                              description: `"${curr.code} - ${curr.name}" para birimini silmek istediğinize emin misiniz?`,
                              onConfirm: () => handleDelete(curr.code),
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Para birimini sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500">
            Tüm alış, fatura, çek, personel ve şantiye işlemlerinde bu para birimleri kullanılabilir.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
      />
    </div>
  );
};
