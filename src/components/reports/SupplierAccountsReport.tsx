import React, { useState, useMemo } from 'react';
import { 
  Truck, 
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
  Phone,
  Building2,
  ReceiptText
} from 'lucide-react';
import { Firma, FirmaCari, Cek, Santiye, KrediKartiHarcama } from '../../types';
import { formatCurrency } from '../../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface SupplierAccountsReportProps {
  firmalar: Firma[];
  cariList: FirmaCari[];
  cekler: Cek[];
  santiyeler: Santiye[];
  kartHarcamalari?: KrediKartiHarcama[];
}

export const SupplierAccountsReport: React.FC<SupplierAccountsReportProps> = ({
  firmalar,
  cariList,
  cekler,
  santiyeler,
  kartHarcamalari = [],
}) => {
  const exchangeRates = getSavedExchangeRates();

  // Filters
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'debt' | 'closed' | 'advance'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // List of supplier firms (marked as 'tedarikci' or having purchase/payment records and not 'musteri'/'taseron')
  const supplierFirms = useMemo(() => {
    return firmalar.filter((f) => {
      if (f.tur === 'tedarikci') return true;
      if (!f.tur) {
        // Fallback: check if has purchase invoice or supplier payments
        const hasPurchases = cariList.some(
          (c) => c.firmaId === f.id && (c.islemTuru === 'alis_faturasi' || c.islemTuru === 'odeme')
        );
        return hasPurchases;
      }
      return false;
    });
  }, [firmalar, cariList]);

  // Compute calculated metrics for each supplier
  const supplierReportData = useMemo(() => {
    return supplierFirms.map((sup) => {
      const records = cariList.filter((c) => c.firmaId === sup.id);

      let totalInvoicedTRY = 0; // Toplam Alış Faturası / Malzeme & Hizmet Borcu
      let totalPaidTRY = 0;     // Toplam Yapılan Ödeme (Banka, Nakit, Kasa)

      records.forEach((c) => {
        const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
        const rawAmt = Math.max(Number(c.borc || 0), Number(c.alacak || 0));
        const tryVal =
          c.tlKarsiligi && c.tlKarsiligi > 0
            ? c.tlKarsiligi
            : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
            ? rawAmt * c.dovizKuru
            : convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

        if (c.islemTuru === 'alis_faturasi') {
          totalInvoicedTRY += tryVal;
        } else if (c.islemTuru === 'odeme') {
          totalPaidTRY += tryVal;
        } else if (c.islemTuru === 'satis_faturasi') {
          // İade veya düşüm faturasıysa ödemeye mahsup et
          totalPaidTRY += tryVal;
        } else if (c.islemTuru === 'tahsilat') {
          totalInvoicedTRY += tryVal;
        } else if (!c.islemTuru) {
          // Legacy records: borç = alış, alacak = ödeme
          totalInvoicedTRY += convertCurrencyToTRY(c.borc || 0, cur, exchangeRates.rates);
          totalPaidTRY += convertCurrencyToTRY(c.alacak || 0, cur, exchangeRates.rates);
        }
      });

      // Tedarikçiye verilen veya ciro edilen çekler
      const supplierChecks = cekler.filter((c) => {
        const isVerilen = c.cekTuru === 'verilen_cek';
        const isCiroToSup = c.ciroFirmaId === sup.id;
        const isSupMatch =
          c.firmaId === sup.id ||
          (c.hamil && c.hamil.toLowerCase().includes(sup.isim.toLowerCase())) ||
          (c.aciklama && c.aciklama.toLowerCase().includes(sup.isim.toLowerCase()));
        return (isVerilen && isSupMatch) || isCiroToSup;
      });

      let totalChecksTRY = 0;
      let pendingChecksTRY = 0;

      supplierChecks.forEach((c) => {
        const cur = c.paraBirimi || 'TRY';
        const tryAmt = convertCurrencyToTRY(c.miktar, cur, exchangeRates.rates);
        totalChecksTRY += tryAmt;
        if (c.durum === 'Verildi' || c.durum === 'Portföyde' || c.durum === 'Tahsilde') {
          pendingChecksTRY += tryAmt;
        }
      });

      // Tedarikçiyle ilişkili kredi kartı harcamaları
      const supplierCardTxs = kartHarcamalari.filter((tx) => {
        const matchCari = tx.cariHareketId && records.some((r) => r.id === tx.cariHareketId);
        const matchName = tx.tedarikci && tx.tedarikci.trim().toLowerCase() === sup.isim.trim().toLowerCase();
        return matchCari || matchName;
      });

      let totalCardTRY = 0;
      supplierCardTxs.forEach((tx) => {
        const tryAmt = convertCurrencyToTRY(tx.tutar, tx.paraBirimi || 'TRY', exchangeRates.rates);
        totalCardTRY += tryAmt;
      });

      // Net Kalan Bakiye:
      // Tedarikçi için: Borç (Alış Faturası) - Alacak (Ödemeler)
      // > 0 ise Tedarikçiye Borcumuz Var (Ödenecek Tutar)
      // < 0 ise Tedarikçiye Fazla/Avans Ödenmiş (Avans Alacağımız)
      // === 0 ise Hesap Kapalı / Mutabık
      const openBalance = Math.round(totalInvoicedTRY - totalPaidTRY);
      const paymentRate =
        totalInvoicedTRY > 0 ? Math.min(100, Math.round((totalPaidTRY / totalInvoicedTRY) * 100)) : 100;

      return {
        supplier: sup,
        totalInvoiced: Math.round(totalInvoicedTRY),
        totalPaid: Math.round(totalPaidTRY),
        openBalance,
        paymentRate,
        totalChecks: Math.round(totalChecksTRY),
        pendingChecks: Math.round(pendingChecksTRY),
        totalCard: Math.round(totalCardTRY),
        checkCount: supplierChecks.length,
        recordCount: records.length,
        records,
        supplierChecks,
        supplierCardTxs,
      };
    });
  }, [supplierFirms, cariList, cekler, kartHarcamalari, exchangeRates.rates]);

  // Filtered rows
  const filteredSuppliers = useMemo(() => {
    return supplierReportData.filter((row) => {
      if (selectedSupplierId !== 'all' && row.supplier.id !== selectedSupplierId) return false;

      // Balance Filter
      if (balanceFilter === 'debt' && row.openBalance <= 0) return false;
      if (balanceFilter === 'closed' && row.openBalance !== 0) return false;
      if (balanceFilter === 'advance' && row.openBalance >= 0) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = row.supplier.isim.toLowerCase();
        const auth = (row.supplier.ilgili || '').toLowerCase();
        const phone = (row.supplier.telefon || '').toLowerCase();
        const tax = (row.supplier.vergiNo || '').toLowerCase();
        if (!name.includes(q) && !auth.includes(q) && !phone.includes(q) && !tax.includes(q)) return false;
      }

      return true;
    });
  }, [supplierReportData, selectedSupplierId, balanceFilter, searchQuery]);

  // Aggregates
  const aggregates = useMemo(() => {
    let grandInvoiced = 0;
    let grandPaid = 0;
    let grandDebt = 0;
    let grandPendingChecks = 0;
    let grandCard = 0;

    filteredSuppliers.forEach((row) => {
      grandInvoiced += row.totalInvoiced;
      grandPaid += row.totalPaid;
      if (row.openBalance > 0) grandDebt += row.openBalance;
      grandPendingChecks += row.pendingChecks;
      grandCard += row.totalCard;
    });

    const grandRate = grandInvoiced > 0 ? Math.round((grandPaid / grandInvoiced) * 100) : 0;

    return {
      grandInvoiced,
      grandPaid,
      grandDebt,
      grandPendingChecks,
      grandCard,
      grandRate,
      count: filteredSuppliers.length,
    };
  }, [filteredSuppliers]);

  // Export
  const exportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Tedarikçi Hesapları ve Borç Analizi Raporu',
      subtitle: `Tedarikçi Sayısı: ${filteredSuppliers.length} | Toplam Tedarikçi Borcu: ${formatCurrency(aggregates.grandDebt, 'TRY')}`,
      filename: `Tedarikci_Hesaplari_Raporu_${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: '#', dataKey: '__index', width: 25 },
        { header: 'Tedarikçi Firma', dataKey: 'name' },
        { header: 'Yetkili Kişi', dataKey: 'auth' },
        { header: 'Telefon', dataKey: 'phone' },
        { header: 'Toplam Alış / Fatura', dataKey: 'invoiced', align: 'right' },
        { header: 'Yapılan Ödemeler', dataKey: 'paid', align: 'right' },
        { header: 'Kalan Borç (Bakiye)', dataKey: 'balance', align: 'right' },
        { header: 'Vadesi Bekleyen Çekler', dataKey: 'pendingChecks', align: 'right' },
        { header: 'Ödeme Oranı', dataKey: 'rate', align: 'center' },
        { header: 'Durum', dataKey: 'status', align: 'center' },
      ],
      data: filteredSuppliers.map((row) => ({
        name: row.supplier.isim,
        auth: row.supplier.ilgili || '-',
        phone: row.supplier.telefon || '-',
        invoiced: formatCurrency(row.totalInvoiced, 'TRY'),
        paid: formatCurrency(row.totalPaid, 'TRY'),
        balance: formatCurrency(row.openBalance, 'TRY'),
        pendingChecks: formatCurrency(row.pendingChecks, 'TRY'),
        rate: `%${row.paymentRate}`,
        status:
          row.openBalance > 0
            ? 'Borcumuz Var'
            : row.openBalance < 0
            ? 'Avans (Fazla Ödeme)'
            : 'Hesap Kapandı',
      })),
      summaryRows: [
        { label: 'Toplam Alış / Malzeme Faturaları', value: formatCurrency(aggregates.grandInvoiced, 'TRY') },
        { label: 'Toplam Yapılan Ödemeler', value: formatCurrency(aggregates.grandPaid, 'TRY') },
        { label: 'Toplam Kalan Tedarikçi Borcu', value: formatCurrency(aggregates.grandDebt, 'TRY') },
        { label: 'Tedarikçideki Bekleyen Çekler', value: formatCurrency(aggregates.grandPendingChecks, 'TRY') },
        { label: 'Ortalama Borç Kapatma Oranı', value: `%${aggregates.grandRate}` },
      ],
      orientation: 'landscape',
    };
  }, [filteredSuppliers, aggregates]);

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-teal-600" />
              <span>Tedarikçi Hesapları ve Borç Analizi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tedarikçi malzeme alış faturaları, yapılan ödemeler, verilen çekler, açık borçlar ve mutabakat dengesi
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton options={exportOptions} buttonText="Tedarikçi Raporunu İndir" variant="primary" />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Select Supplier */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Tedarikçi Firma Seçimi
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">🚚 Tüm Tedarikçiler ({supplierFirms.length} Firma)</option>
              {supplierFirms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.isim}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Borç & Bakiye Durumu
            </label>
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Tüm Tedarikçiler</option>
              <option value="debt">⚠️ Borçlu Olduklarımız (Ödeme Bekleyen)</option>
              <option value="closed">✅ Hesabı Kapananlar (Sıfır Bakiye)</option>
              <option value="advance">🔵 Avanslı / Alacaklı Olduklarımız</option>
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
                placeholder="Tedarikçi adı, yetkili, vergi no..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Alış / Fatura */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Alış Faturaları</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
            {formatCurrency(aggregates.grandInvoiced, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{aggregates.count} Tedarikçi firması</div>
        </div>

        {/* Toplam Ödenen */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Yapılan Ödeme</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums">
            {formatCurrency(aggregates.grandPaid, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Ödeme Başarısı:</span>
            <span className="font-bold text-emerald-600 tabular-nums">%{aggregates.grandRate}</span>
          </div>
        </div>

        {/* Kalan Açık Borç */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Kalan Tedarikçi Borcumuz</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600 tabular-nums">
            {formatCurrency(aggregates.grandDebt, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Tedarikçilere ödenecek net borç</div>
        </div>

        {/* Bekleyen Çekler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Vadesi Bekleyen Çekler</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <BookOpenCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-violet-700 tabular-nums">
            {formatCurrency(aggregates.grandPendingChecks, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Tedarikçideki keşide/ciro çekler</div>
        </div>
      </div>

      {/* SUPPLIERS DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-slate-900">Tedarikçi Cari Hesap Listesi</h4>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
              {filteredSuppliers.length} Kayıt
            </span>
          </div>
          <span className="text-xs text-slate-400">Detayları görmek için satıra tıklayınız</span>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium">Filtrelere uygun tedarikçi kaydı bulunamadı.</p>
            <p className="text-xs text-slate-400 mt-1">Arama kriterlerini değiştirerek tekrar deneyiniz.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Tedarikçi Firma</th>
                  <th className="py-3 px-3.5 min-w-[130px]">Yetkili / İletişim</th>
                  <th className="py-3 px-3.5 text-right min-w-[120px]">Toplam Alış / Fatura</th>
                  <th className="py-3 px-3.5 text-right min-w-[120px]">Yapılan Ödeme</th>
                  <th className="py-3 px-3.5 text-right min-w-[120px]">Kalan Borç (Bakiye)</th>
                  <th className="py-3 px-3.5 text-right min-w-[120px]">Bekleyen Çek</th>
                  <th className="py-3 px-3.5 text-center min-w-[100px]">Ödeme Oranı</th>
                  <th className="py-3 px-3.5 text-center min-w-[110px]">Durum</th>
                  <th className="py-3 px-3.5 w-10 text-center">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSuppliers.map((row, idx) => {
                  const isExpanded = expandedId === row.supplier.id;
                  const isDebt = row.openBalance > 0;
                  const isAdvance = row.openBalance < 0;
                  const isClosed = row.openBalance === 0;

                  return (
                    <React.Fragment key={row.supplier.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : row.supplier.id)}
                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-teal-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900">{row.supplier.isim}</div>
                          {row.supplier.vergiNo && (
                            <div className="text-[10px] text-slate-400">VN: {row.supplier.vergiNo}</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="text-slate-700">{row.supplier.ilgili || '-'}</div>
                          {row.supplier.telefon && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{row.supplier.telefon}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrency(row.totalInvoiced, 'TRY')}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-emerald-600 tabular-nums">
                          {formatCurrency(row.totalPaid, 'TRY')}
                        </td>
                        <td className="py-3 px-3.5 text-right font-black tabular-nums">
                          <span
                            className={
                              isDebt ? 'text-rose-600' : isAdvance ? 'text-blue-600' : 'text-slate-600'
                            }
                          >
                            {formatCurrency(row.openBalance, 'TRY')}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right text-violet-700 font-bold tabular-nums">
                          {row.pendingChecks > 0 ? formatCurrency(row.pendingChecks, 'TRY') : '-'}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  row.paymentRate >= 100
                                    ? 'bg-emerald-500'
                                    : row.paymentRate >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${row.paymentRate}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-700">%{row.paymentRate}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isDebt && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              <span>Borçlu</span>
                            </span>
                          )}
                          {isAdvance && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Avanslı</span>
                            </span>
                          )}
                          {isClosed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Kapalı</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-teal-600 inline" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 inline" />
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED ACCORDION DETAILS */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-y border-slate-200">
                          <td colSpan={10} className="p-4 sm:p-5">
                            <div className="space-y-4 max-w-5xl mx-auto">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                  <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                    <ReceiptText className="w-4 h-4 text-teal-600" />
                                    <span>{row.supplier.isim} — Cari Hesap ve Çek Detayları</span>
                                  </h5>
                                  <p className="text-xs text-slate-500">
                                    Toplam {row.records.length} cari hareket, {row.supplierChecks.length} çek ve{' '}
                                    {row.supplierCardTxs.length} kredi kartı işlemi
                                  </p>
                                </div>
                                <div className="text-xs font-semibold text-slate-600 flex items-center gap-3">
                                  <span>Toplam Alış: <strong className="text-slate-900 tabular-nums">{formatCurrency(row.totalInvoiced, 'TRY')}</strong></span>
                                  <span>Toplam Ödenen: <strong className="text-emerald-700 tabular-nums">{formatCurrency(row.totalPaid, 'TRY')}</strong></span>
                                  <span>Net Borç: <strong className={row.openBalance > 0 ? 'text-rose-600 tabular-nums' : 'text-slate-800 tabular-nums'}>{formatCurrency(row.openBalance, 'TRY')}</strong></span>
                                </div>
                              </div>

                              {/* 1. CARI HAREKETLER TABLOSU */}
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                <div className="px-3.5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                                  <span>Cari Hesap Hareketleri & Faturalar</span>
                                  <span className="text-[11px] text-slate-500">{row.records.length} Kayıt</span>
                                </div>

                                {row.records.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                    Bu tedarikçiye ait cari hareket bulunamadı.
                                  </div>
                                ) : (
                                  <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 border-b border-slate-100">
                                        <tr>
                                          <th className="py-2 px-3">Tarih</th>
                                          <th className="py-2 px-3">İşlem Türü</th>
                                          <th className="py-2 px-3">Fatura / Belge No</th>
                                          <th className="py-2 px-3">Açıklama</th>
                                          <th className="py-2 px-3 text-right">Borç (Alış)</th>
                                          <th className="py-2 px-3 text-right">Alacak (Ödeme)</th>
                                          <th className="py-2 px-3 text-right">TL Karşılığı</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {row.records.map((c) => {
                                          const cur = c.paraBirimi || 'TRY';
                                          const isAlis = c.islemTuru === 'alis_faturasi' || (!c.islemTuru && c.borc > 0);
                                          const isOdeme = c.islemTuru === 'odeme' || (!c.islemTuru && c.alacak > 0);

                                          return (
                                            <tr key={c.id} className="hover:bg-slate-50/50">
                                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                                {c.tarih}
                                              </td>
                                              <td className="py-2 px-3">
                                                {isAlis ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                    Alış Faturası
                                                  </span>
                                                ) : isOdeme ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    Ödeme
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {c.islemTuru || 'Cari İşlem'}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 font-mono text-slate-700 text-[11px]">
                                                {c.faturaNo || '-'}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={c.aciklama}>
                                                {c.aciklama || '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right text-slate-900 font-bold tabular-nums">
                                                {c.borc > 0 ? formatCurrency(c.borc, cur) : '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right text-emerald-700 font-bold tabular-nums">
                                                {c.alacak > 0 ? formatCurrency(c.alacak, cur) : '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right text-slate-900 font-black tabular-nums">
                                                {c.tlKarsiligi ? formatCurrency(c.tlKarsiligi, 'TRY') : '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 2. TEDARİKÇİYE VERİLEN ÇEKLER */}
                              {row.supplierChecks.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                  <div className="px-3.5 py-2.5 bg-violet-50/70 border-b border-violet-100 text-xs font-bold text-violet-950 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <BookOpenCheck className="w-4 h-4 text-violet-600" />
                                      <span>Tedarikçiye Verilen / Ciro Edilen Çekler</span>
                                    </span>
                                    <span className="text-[11px] text-violet-700 font-bold tabular-nums">
                                      Toplam: {formatCurrency(row.totalChecks, 'TRY')}
                                    </span>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 border-b border-slate-100">
                                        <tr>
                                          <th className="py-2 px-3">Çek No</th>
                                          <th className="py-2 px-3">Banka</th>
                                          <th className="py-2 px-3">Vade Tarihi</th>
                                          <th className="py-2 px-3">Tutar</th>
                                          <th className="py-2 px-3">İşlem</th>
                                          <th className="py-2 px-3 text-center">Durum</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {row.supplierChecks.map((chk) => (
                                          <tr key={chk.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{chk.cekNo}</td>
                                            <td className="py-2 px-3 text-slate-700">{chk.bankaAdi}</td>
                                            <td className="py-2 px-3 font-mono text-slate-600">{chk.vadeTarihi}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900 tabular-nums">
                                              {formatCurrency(chk.miktar, chk.paraBirimi || 'TRY')}
                                            </td>
                                            <td className="py-2 px-3 text-slate-600 text-[11px]">
                                              {chk.ciroFirmaId === row.supplier.id ? 'Ciro Edildi' : 'Doğrudan Verildi'}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800">
                                                {chk.durum}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
