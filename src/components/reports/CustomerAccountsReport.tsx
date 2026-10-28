import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  DollarSign, 
  CreditCard, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  BookOpenCheck,
  TrendingUp,
  Percent,
  Phone
} from 'lucide-react';
import { Firma, FirmaCari, Cek, Santiye } from '../../types';
import { formatCurrency } from '../../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface CustomerAccountsReportProps {
  firmalar: Firma[];
  cariList: FirmaCari[];
  cekler: Cek[];
  santiyeler: Santiye[];
}

export const CustomerAccountsReport: React.FC<CustomerAccountsReportProps> = ({
  firmalar,
  cariList,
  cekler,
  santiyeler,
}) => {
  const exchangeRates = getSavedExchangeRates();

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'open' | 'closed' | 'advance'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // List of customer firms (firms marked as 'musteri' or having sales records)
  const customerFirms = useMemo(() => {
    return firmalar.filter((f) => {
      if (f.tur === 'musteri') return true;
      // Also include if there are sales invoice records for this firm
      const hasSales = cariList.some((c) => c.firmaId === f.id && (c.islemTuru === 'satis_faturasi' || c.islemTuru === 'tahsilat'));
      return hasSales;
    });
  }, [firmalar, cariList]);

  // Compute calculated metrics for each customer
  const customerReportData = useMemo(() => {
    return customerFirms.map((cust) => {
      const records = cariList.filter((c) => c.firmaId === cust.id);

      let totalInvoicedTRY = 0; // Toplam Satış / Borçlandırılan Tutar
      let totalCollectedTRY = 0; // Toplam Tahsil Edilen Tutar

      records.forEach((c) => {
        const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
        const rawAmt = Math.max(Number(c.borc || 0), Number(c.alacak || 0));
        const tryVal =
          c.tlKarsiligi && c.tlKarsiligi > 0
            ? c.tlKarsiligi
            : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
            ? rawAmt * c.dovizKuru
            : convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

        if (c.islemTuru === 'satis_faturasi') {
          totalInvoicedTRY += tryVal;
        } else if (c.islemTuru === 'tahsilat') {
          totalCollectedTRY += tryVal;
        } else if (c.islemTuru === 'alis_faturasi') {
          totalInvoicedTRY += tryVal;
        } else if (!c.islemTuru) {
          // Legacy records
          totalInvoicedTRY += convertCurrencyToTRY(c.borc || 0, cur, exchangeRates.rates);
          totalCollectedTRY += convertCurrencyToTRY(c.alacak || 0, cur, exchangeRates.rates);
        }
      });

      // Müşteriden alınan çekler
      const customerChecks = cekler.filter((c) => {
        const isAlinan = c.cekTuru === 'alinan_cek' || !c.cekTuru;
        const isMatch =
          c.firmaId === cust.id ||
          c.hesapSahibi?.toLowerCase().includes(cust.isim.toLowerCase()) ||
          c.aciklama?.toLowerCase().includes(cust.isim.toLowerCase());
        return isAlinan && isMatch;
      });

      let totalChecksTRY = 0;
      let pendingChecksTRY = 0;

      customerChecks.forEach((c) => {
        const cur = c.paraBirimi || 'TRY';
        const tryAmt = convertCurrencyToTRY(c.miktar, cur, exchangeRates.rates);
        totalChecksTRY += tryAmt;
        if (c.durum === 'Portföyde' || c.durum === 'Tahsilde') {
          pendingChecksTRY += tryAmt;
        }
      });

      // Net Kalan Bakiye:
      // Müşteri için: Borç (Fatura) - Alacak (Tahsilat)
      // > 0 ise Müşteri Borçlu (Tahsil Edilecek Alacağımız Var)
      // < 0 ise Müşteri Fazla Ödedi (Avans)
      const openBalance = Math.round(totalInvoicedTRY - totalCollectedTRY);
      const collectionRate =
        totalInvoicedTRY > 0 ? Math.min(100, Math.round((totalCollectedTRY / totalInvoicedTRY) * 100)) : 100;

      return {
        customer: cust,
        totalInvoiced: Math.round(totalInvoicedTRY),
        totalCollected: Math.round(totalCollectedTRY),
        openBalance,
        collectionRate,
        totalChecks: Math.round(totalChecksTRY),
        pendingChecks: Math.round(pendingChecksTRY),
        checkCount: customerChecks.length,
        recordCount: records.length,
        records,
        customerChecks,
      };
    });
  }, [customerFirms, cariList, cekler, exchangeRates.rates]);

  // Filtered rows
  const filteredCustomers = useMemo(() => {
    return customerReportData.filter((row) => {
      if (selectedCustomerId !== 'all' && row.customer.id !== selectedCustomerId) return false;

      // Balance Filter
      if (balanceFilter === 'open' && row.openBalance <= 0) return false;
      if (balanceFilter === 'closed' && row.openBalance !== 0) return false;
      if (balanceFilter === 'advance' && row.openBalance >= 0) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = row.customer.isim.toLowerCase();
        const auth = (row.customer.ilgili || '').toLowerCase();
        const phone = (row.customer.telefon || '').toLowerCase();
        const tax = (row.customer.vergiNo || '').toLowerCase();
        if (!name.includes(q) && !auth.includes(q) && !phone.includes(q) && !tax.includes(q)) return false;
      }

      return true;
    });
  }, [customerReportData, selectedCustomerId, balanceFilter, searchQuery]);

  // Aggregates
  const aggregates = useMemo(() => {
    let grandInvoiced = 0;
    let grandCollected = 0;
    let grandOpenBalance = 0;
    let grandPendingChecks = 0;

    filteredCustomers.forEach((row) => {
      grandInvoiced += row.totalInvoiced;
      grandCollected += row.totalCollected;
      if (row.openBalance > 0) grandOpenBalance += row.openBalance;
      grandPendingChecks += row.pendingChecks;
    });

    const grandRate = grandInvoiced > 0 ? Math.round((grandCollected / grandInvoiced) * 100) : 0;

    return {
      grandInvoiced,
      grandCollected,
      grandOpenBalance,
      grandPendingChecks,
      grandRate,
      count: filteredCustomers.length,
    };
  }, [filteredCustomers]);

  // Export
  const exportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Müşteri Hesapları ve Tahsilat Analizi Raporu',
      subtitle: `Müşteri Sayısı: ${filteredCustomers.length} | Toplam Açık Bakiye: ${formatCurrency(aggregates.grandOpenBalance, 'TRY')}`,
      filename: `Musteri_Hesaplari_Raporu_${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: '#', dataKey: '__index', width: 25 },
        { header: 'Müşteri Firma', dataKey: 'name' },
        { header: 'Yetkili Kişi', dataKey: 'auth' },
        { header: 'Telefon', dataKey: 'phone' },
        { header: 'Toplam Fatura / Hakediş', dataKey: 'invoiced', align: 'right' },
        { header: 'Toplam Tahsilat', dataKey: 'collected', align: 'right' },
        { header: 'Açık Bakiye (Alacak)', dataKey: 'balance', align: 'right' },
        { header: 'Portföydeki Çekler', dataKey: 'pendingChecks', align: 'right' },
        { header: 'Tahsilat Oranı', dataKey: 'rate', align: 'center' },
        { header: 'Durum', dataKey: 'status', align: 'center' },
      ],
      data: filteredCustomers.map((row) => ({
        name: row.customer.isim,
        auth: row.customer.ilgili || '-',
        phone: row.customer.telefon || '-',
        invoiced: formatCurrency(row.totalInvoiced, 'TRY'),
        collected: formatCurrency(row.totalCollected, 'TRY'),
        balance: formatCurrency(row.openBalance, 'TRY'),
        pendingChecks: formatCurrency(row.pendingChecks, 'TRY'),
        rate: `%${row.collectionRate}`,
        status:
          row.openBalance > 0
            ? 'Açık Hesap (Borçlu)'
            : row.openBalance < 0
            ? 'Avans (Fazla Tahsilat)'
            : 'Hesap Kapandı',
      })),
      summaryRows: [
        { label: 'Toplam Faturalanan Tutar', value: formatCurrency(aggregates.grandInvoiced, 'TRY') },
        { label: 'Toplam Yapılan Tahsilat', value: formatCurrency(aggregates.grandCollected, 'TRY') },
        { label: 'Toplam Kalan Açık Müşteri Alacağı', value: formatCurrency(aggregates.grandOpenBalance, 'TRY') },
        { label: 'Tahsilat Bekleyen Portföy Çekleri', value: formatCurrency(aggregates.grandPendingChecks, 'TRY') },
        { label: 'Ortalama Tahsilat Başarı Oranı', value: `%${aggregates.grandRate}` },
      ],
      orientation: 'landscape',
    };
  }, [filteredCustomers, aggregates]);

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Müşteri Hesapları ve Tahsilat Analizi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Müşterilerinize kesilen satış & hakediş faturaları, tahsilatlar, açık hesaplar ve tahsilat başarı oranları
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton options={exportOptions} buttonText="Müşteri Raporunu İndir" variant="primary" />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Select Customer */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Müşteri Firma Seçimi
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">🏢 Tüm Müşteriler (Konsolide)</option>
              {customerFirms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isim}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Hesap Bakiye Durumu
            </label>
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tüm Müşteriler</option>
              <option value="open">⚠️ Açık Hesabı Olanlar (Tahsilat Bekleyen)</option>
              <option value="closed">✅ Hesabı Kapananlar (Sıfır Bakiye)</option>
              <option value="advance">🔵 Avans Verenler (Fazla Tahsilat)</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Arama
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Müşteri adı, yetkili, vergi no..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Faturalanan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Müşteri Hakediş/Fatura</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatCurrency(aggregates.grandInvoiced, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{aggregates.count} Müşteri firması</div>
        </div>

        {/* Toplam Tahsilat */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Tahsil Edilen</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatCurrency(aggregates.grandCollected, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Tahsilat Başarısı:</span>
            <span className="font-bold text-emerald-600">%{aggregates.grandRate}</span>
          </div>
        </div>

        {/* Kalan Açık Alacak */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Kalan Açık Hesap Alacağı</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {formatCurrency(aggregates.grandOpenBalance, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Müşterilerden tahsil edilecek net tutar</div>
        </div>

        {/* Bekleyen Çekler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Portföydeki Müşteri Çekleri</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpenCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-600">
            {formatCurrency(aggregates.grandPendingChecks, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Vadesi gelmemiş çek teminatı</div>
        </div>
      </div>

      {/* DETAILED CUSTOMERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Müşteri Bakiye ve Tahsilat Tablosu</h4>
            <p className="text-xs text-slate-500">
              Satıra tıklayarak ilgili müşteriye ait cari hareketleri ve alınan çekleri detaylı görebilirsiniz.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">Müşteri Firma</th>
                <th className="py-3 px-3">Yetkili & İletişim</th>
                <th className="py-3 px-3 text-right">Toplam Fatura</th>
                <th className="py-3 px-3 text-right">Toplam Tahsilat</th>
                <th className="py-3 px-3 text-right">Açık Bakiye (Alacak)</th>
                <th className="py-3 px-3 text-right">Portföydeki Çekler</th>
                <th className="py-3 px-3 text-center">Tahsilat Oranı</th>
                <th className="py-3 px-3 text-center">Durum</th>
                <th className="py-3 px-2 text-center w-8">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    Kayıtlı müşteri hesabı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredCustomers
                  .sort((a, b) => b.openBalance - a.openBalance)
                  .map((row, idx) => {
                    const isExpanded = expandedId === row.customer.id;
                    const isOpen = row.openBalance > 0;
                    const isClosed = row.openBalance === 0;

                    return (
                      <React.Fragment key={row.customer.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : row.customer.id)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isExpanded ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{row.customer.isim}</div>
                            <div className="text-[11px] text-slate-500">
                              {row.recordCount} Cari Fiş / {row.checkCount} Çek
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            <div>{row.customer.ilgili || '-'}</div>
                            <div className="text-[11px] text-slate-400">{row.customer.telefon || '-'}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(row.totalInvoiced, 'TRY')}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600">
                            {formatCurrency(row.totalCollected, 'TRY')}
                          </td>
                          <td className="py-3 px-3 text-right font-black">
                            <span
                              className={
                                isOpen
                                  ? 'text-rose-600'
                                  : isClosed
                                  ? 'text-slate-600'
                                  : 'text-blue-600'
                              }
                            >
                              {formatCurrency(Math.abs(row.openBalance), 'TRY')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-indigo-600">
                            {row.pendingChecks > 0 ? formatCurrency(row.pendingChecks, 'TRY') : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${row.collectionRate}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-700 text-[11px]">%{row.collectionRate}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isOpen ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertCircle className="w-3 h-3" />
                                Açık Hesap
                              </span>
                            ) : isClosed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Kapandı
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                Avans Fazlası
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center text-slate-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {isExpanded && (
                          <tr className="bg-blue-50/20 border-b border-slate-200">
                            <td colSpan={10} className="p-4">
                              <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                                  <span>{row.customer.isim} - Detaylı Cari & Çek Hareketleri</span>
                                  <span className="text-[11px] text-slate-500">
                                    Adres: {row.customer.adres || 'Belirtilmedi'}
                                  </span>
                                </div>

                                {row.records.length === 0 ? (
                                  <div className="text-xs text-slate-400 py-2 text-center">
                                    Kayıtlı cari hareket bulunmuyor.
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-bold text-slate-700">Son Fatura ve Tahsilatlar:</div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                      {row.records.slice(0, 6).map((c) => (
                                        <div
                                          key={c.id}
                                          className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-50 border border-slate-100"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium">{c.tarih}</span>
                                            <span className="text-slate-800">{c.aciklama || 'Cari Hareket'}</span>
                                            {c.faturaNo && (
                                              <span className="text-[10px] text-slate-400">({c.faturaNo})</span>
                                            )}
                                          </div>
                                          <div className="font-bold">
                                            {c.borc > 0 ? (
                                              <span className="text-slate-900">
                                                Fatura: {formatCurrency(c.borc, c.paraBirimi || 'TRY')}
                                              </span>
                                            ) : (
                                              <span className="text-emerald-600">
                                                Tahsilat: {formatCurrency(c.alacak, c.paraBirimi || 'TRY')}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
              )}
            </tbody>
            {filteredCustomers.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-3 px-3 text-right">TOPLAM:</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(aggregates.grandInvoiced, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-emerald-700">{formatCurrency(aggregates.grandCollected, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-rose-700">{formatCurrency(aggregates.grandOpenBalance, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-indigo-700">{formatCurrency(aggregates.grandPendingChecks, 'TRY')}</td>
                  <td className="py-3 px-3 text-center">%{aggregates.grandRate}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
