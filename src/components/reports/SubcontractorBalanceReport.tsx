import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  DollarSign, 
  CreditCard, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  Building2, 
  CheckCircle2, 
  Clock, 
  BookOpenCheck,
  HardHat,
  Filter
} from 'lucide-react';
import { 
  Taseron, 
  Firma, 
  FirmaCari, 
  SantiyeGider, 
  Cek, 
  KrediKartiHarcama,
  Santiye 
} from '../../types';
import { formatCurrency } from '../../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface SubcontractorBalanceReportProps {
  taseronlar: Taseron[];
  firmalar: Firma[];
  cariList: FirmaCari[];
  giderler: SantiyeGider[];
  cekler: Cek[];
  kartHarcamalari?: KrediKartiHarcama[];
  santiyeler: Santiye[];
}

export const SubcontractorBalanceReport: React.FC<SubcontractorBalanceReportProps> = ({
  taseronlar,
  firmalar,
  cariList,
  giderler,
  cekler,
  kartHarcamalari = [],
  santiyeler,
}) => {
  const exchangeRates = getSavedExchangeRates();

  // Filters
  const [selectedTaseronId, setSelectedTaseronId] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'payable' | 'paid' | 'overpaid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Unified list of all subcontractors
  const unifiedTaseronlar = useMemo(() => {
    const map = new Map<string, { id: string; isim: string; yetkili?: string; telefon?: string; uzmanlik?: string; firmaId?: string }>();

    // From taseronlar table
    taseronlar.forEach((t) => {
      map.set(t.id, {
        id: t.id,
        isim: t.isim,
        yetkili: t.yetkili,
        telefon: t.telefon,
        uzmanlik: t.uzmanlik,
      });
    });

    // From firmalar where tur === 'taseron'
    firmalar.filter((f) => f.tur === 'taseron').forEach((f) => {
      const existing = Array.from(map.values()).find((item) => item.isim.trim().toLowerCase() === f.isim.trim().toLowerCase());
      if (!existing) {
        map.set(f.id, {
          id: f.id,
          isim: f.isim,
          yetkili: f.ilgili,
          telefon: f.telefon,
          uzmanlik: f.uzmanlik,
          firmaId: f.id,
        });
      } else {
        existing.firmaId = f.id;
        if (!existing.yetkili) existing.yetkili = f.ilgili;
        if (!existing.telefon) existing.telefon = f.telefon;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
  }, [taseronlar, firmalar]);

  // Compute calculated balance, accruals, and payments for each subcontractor
  const subcontractorReportData = useMemo(() => {
    return unifiedTaseronlar.map((tas) => {
      // Find matching firma in firmalar
      const matchingFirma = firmalar.find(
        (f) => f.id === tas.firmaId || f.id === tas.id || f.isim.trim().toLowerCase() === tas.isim.trim().toLowerCase()
      );
      const firmaId = matchingFirma?.id || tas.id;

      // 1. Cari Hareketleri
      const firmaCariRecords = cariList.filter(
        (c) => c.firmaId === firmaId || c.firmaId === tas.id || (matchingFirma && c.firmaId === matchingFirma.id)
      );

      let totalHakedisCariTRY = 0;
      let totalOdemeCariTRY = 0;

      firmaCariRecords.forEach((c) => {
        const cur = c.paraBirimi || 'TRY';
        // Borç = Taşerona olan hakediş borcumuz
        totalHakedisCariTRY += convertCurrencyToTRY(c.borc || 0, cur, exchangeRates.rates);
        // Alacak = Taşerona yaptığımız ödeme
        totalOdemeCariTRY += convertCurrencyToTRY(c.alacak || 0, cur, exchangeRates.rates);
      });

      // 2. Şantiye Giderleri (Taşeron Hakediş ve Ödemeleri)
      const siteExpenses = giderler.filter((g) => {
        const isTasMatch =
          g.taseron?.toLowerCase() === tas.isim.toLowerCase() ||
          g.odemeYapilanFirma?.toLowerCase() === tas.isim.toLowerCase() ||
          g.cariFirmaId === firmaId ||
          g.cariFirmaId === tas.id;
        return isTasMatch;
      });

      let totalExpensesHakedisTRY = 0;
      let totalExpensesPaidTRY = 0;

      siteExpenses.forEach((g) => {
        const cur = g.paraBirimi || 'TRY';
        const amtTRY = convertCurrencyToTRY(g.miktar, cur, exchangeRates.rates);
        // If not already in cariRecords, add
        if (!g.cariHareketId) {
          if (g.kategori === 'Taşeron Hakediş') {
            totalExpensesHakedisTRY += amtTRY;
          } else {
            totalExpensesPaidTRY += amtTRY;
          }
        }
      });

      // 3. Verilen Çekler ile Yapılan Ödemeler
      const tasCekler = cekler.filter((c) => {
        const isVerilen = c.cekTuru === 'verilen_cek';
        const isTasMatch =
          c.firmaId === firmaId ||
          c.firmaId === tas.id ||
          c.hamil?.toLowerCase().includes(tas.isim.toLowerCase()) ||
          c.aciklama?.toLowerCase().includes(tas.isim.toLowerCase());
        return isVerilen && isTasMatch;
      });

      let totalCekPaymentTRY = 0;
      tasCekler.forEach((c) => {
        const cur = c.paraBirimi || 'TRY';
        totalCekPaymentTRY += convertCurrencyToTRY(c.miktar, cur, exchangeRates.rates);
      });

      // 4. Kredi Kartı ile Yapılan Ödemeler
      const tasKartPayments = kartHarcamalari.filter((kh) => {
        return (
          kh.firmaId === firmaId ||
          kh.firmaId === tas.id ||
          kh.firmaAdi?.toLowerCase().includes(tas.isim.toLowerCase())
        );
      });

      let totalKartPaymentTRY = 0;
      tasKartPayments.forEach((kh) => {
        const cur = kh.paraBirimi || 'TRY';
        totalKartPaymentTRY += convertCurrencyToTRY(kh.tutar, cur, exchangeRates.rates);
      });

      // Combine totals:
      // Toplam Hakediş = Cari Borçları + Doğrudan girilen hakedişler
      const grandHakedis = Math.round(totalHakedisCariTRY + totalExpensesHakedisTRY);

      // Toplam Ödenen = Cari Alacakları (Ödemeler) + Doğrudan ödenen giderler
      // Not: CariAlacak içine çek veya kredi kartı otomatik işlenmiş olabilir; eğer cari kaydı yoksa eklenir
      const grandOdenen = Math.round(Math.max(totalOdemeCariTRY, totalCekPaymentTRY + totalKartPaymentTRY) + totalExpensesPaidTRY);

      // Net Bakiye = Borcumuz - Ödediğimiz
      // > 0 ise taşeron alacaklı (bizim borcumuz var)
      // < 0 ise şirket alacaklı (avans fazla ödenmiş)
      const netBakiye = grandHakedis - grandOdenen;

      // Sites where this subcontractor is active
      const activeSiteNames = Array.from(
        new Set(
          siteExpenses
            .map((g) => santiyeler.find((s) => s.id === g.santiyeId)?.isim)
            .filter(Boolean) as string[]
        )
      );

      return {
        tas,
        matchingFirma,
        grandHakedis,
        grandOdenen,
        netBakiye,
        totalCekPayment: Math.round(totalCekPaymentTRY),
        totalKartPayment: Math.round(totalKartPaymentTRY),
        totalCariRecords: firmaCariRecords.length,
        totalSiteExpenses: siteExpenses.length,
        activeSiteNames,
        cariRecords: firmaCariRecords,
        siteExpenses,
        tasCekler,
      };
    });
  }, [unifiedTaseronlar, firmalar, cariList, giderler, cekler, kartHarcamalari, santiyeler, exchangeRates.rates]);

  // Filter subcontractor rows
  const filteredData = useMemo(() => {
    return subcontractorReportData.filter((row) => {
      if (selectedTaseronId !== 'all' && row.tas.id !== selectedTaseronId) return false;

      // Balance Filter
      if (balanceFilter === 'payable' && row.netBakiye <= 0) return false;
      if (balanceFilter === 'paid' && row.netBakiye !== 0) return false;
      if (balanceFilter === 'overpaid' && row.netBakiye >= 0) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = row.tas.isim.toLowerCase();
        const auth = (row.tas.yetkili || '').toLowerCase();
        const spec = (row.tas.uzmanlik || '').toLowerCase();
        if (!name.includes(q) && !auth.includes(q) && !spec.includes(q)) return false;
      }

      return true;
    });
  }, [subcontractorReportData, selectedTaseronId, balanceFilter, searchQuery]);

  // Aggregates
  const aggregates = useMemo(() => {
    let totalHakedis = 0;
    let totalOdenen = 0;
    let totalNetBorc = 0;
    let totalCek = 0;
    let totalKart = 0;

    filteredData.forEach((row) => {
      totalHakedis += row.grandHakedis;
      totalOdenen += row.grandOdenen;
      if (row.netBakiye > 0) totalNetBorc += row.netBakiye;
      totalCek += row.totalCekPayment;
      totalKart += row.totalKartPayment;
    });

    return {
      totalHakedis,
      totalOdenen,
      totalNetBorc,
      totalCek,
      totalKart,
      count: filteredData.length,
    };
  }, [filteredData]);

  // Export
  const exportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Taşeron Alacak & Borç Hesap Ekstresi Raporu',
      subtitle: `İncelenen Taşeron Sayısı: ${filteredData.length} | Toplam Net Borç: ${formatCurrency(aggregates.totalNetBorc, 'TRY')}`,
      filename: `Taseron_Alacak_Borc_Raporu_${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: '#', dataKey: '__index', width: 25 },
        { header: 'Taşeron Adı', dataKey: 'name' },
        { header: 'Yetkili', dataKey: 'auth' },
        { header: 'Uzmanlık Alanı', dataKey: 'spec' },
        { header: 'Çalıştığı Şantiyeler', dataKey: 'sites' },
        { header: 'Toplam Hakediş (TL)', dataKey: 'hakedis', align: 'right' },
        { header: 'Toplam Ödenen (TL)', dataKey: 'odenen', align: 'right' },
        { header: 'Kalan Bakiye (TL)', dataKey: 'bakiye', align: 'right' },
        { header: 'Hesap Durumu', dataKey: 'status', align: 'center' },
      ],
      data: filteredData.map((row) => ({
        name: row.tas.isim,
        auth: row.tas.yetkili || '-',
        spec: row.tas.uzmanlik || 'Genel Taşeron',
        sites: row.activeSiteNames.join(', ') || 'Belirtilmedi',
        hakedis: formatCurrency(row.grandHakedis, 'TRY'),
        odenen: formatCurrency(row.grandOdenen, 'TRY'),
        bakiye: formatCurrency(row.netBakiye, 'TRY'),
        status:
          row.netBakiye > 0
            ? 'Taşeron Alacaklı'
            : row.netBakiye < 0
            ? 'Şirket Alacaklı (Fazla Ödeme)'
            : 'Hesap Kapandı',
      })),
      summaryRows: [
        { label: 'Toplam Tahakkuk Eden Taşeron Hakedişi', value: formatCurrency(aggregates.totalHakedis, 'TRY') },
        { label: 'Toplam Yapılan Taşeron Ödemesi', value: formatCurrency(aggregates.totalOdenen, 'TRY') },
        { label: 'Kalan Net Taşeron Borcumuz', value: formatCurrency(aggregates.totalNetBorc, 'TRY') },
        { label: 'Çekle Yapılan Ödemeler Toplamı', value: formatCurrency(aggregates.totalCek, 'TRY') },
        { label: 'Kredi Kartıyla Yapılan Ödemeler Toplamı', value: formatCurrency(aggregates.totalKart, 'TRY') },
      ],
      orientation: 'landscape',
    };
  }, [filteredData, aggregates]);

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-600" />
              <span>Taşeron Alacak & Borç Hesap Takibi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Taşeronların tahakkuk eden hakedişleri, nakit/çek/kredi kartı ödemeleri ve güncel cari bakiyeleri
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton options={exportOptions} buttonText="Taşeron Raporunu İndir" variant="primary" />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Select Subcontractor */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Taşeron Seçimi
            </label>
            <select
              value={selectedTaseronId}
              onChange={(e) => setSelectedTaseronId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">👥 Tüm Taşeronlar (Konsolide Liste)</option>
              {unifiedTaseronlar.map((t) => (
                <option key={t.id} value={t.id}>
                  🏗️ {t.isim} {t.uzmanlik ? `(${t.uzmanlik})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Bakiye Durumu
            </label>
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">Tüm Bakiyeler</option>
              <option value="payable">⚠️ Borcumuz Olanlar (Taşeron Alacaklı)</option>
              <option value="paid">✅ Hesabı Tam Kapananlar (Sıfır Bakiye)</option>
              <option value="overpaid">🔵 Fazla Ödeme Yapılanlar (Şirket Alacaklı)</option>
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
                placeholder="Taşeron adı, yetkili, uzmanlık..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Hakediş */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Hakedişler</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatCurrency(aggregates.totalHakedis, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{aggregates.count} Taşeron firması</div>
        </div>

        {/* Toplam Yapılan Ödeme */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Yapılan Ödeme</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatCurrency(aggregates.totalOdenen, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Çek: {formatCurrency(aggregates.totalCek, 'TRY')}</span>
            <span>Kart: {formatCurrency(aggregates.totalKart, 'TRY')}</span>
          </div>
        </div>

        {/* Kalan Net Borcumuz */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Kalan Taşeron Borcumuz</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {formatCurrency(aggregates.totalNetBorc, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Taşeronlara ödenecek net tutar</div>
        </div>

        {/* Taşeron Portföyü */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Hesap Durumu</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {filteredData.filter((r) => r.netBakiye > 0).length} <span className="text-xs font-normal text-slate-500">Alacaklı Taşeron</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {filteredData.filter((r) => r.netBakiye === 0).length} Sıfır Bakiye / {filteredData.filter((r) => r.netBakiye < 0).length} Fazla Ödenen
          </div>
        </div>
      </div>

      {/* DETAILED SUBCONTRACTOR TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Taşeron Cari Bakiye ve Ödeme Listesi</h4>
            <p className="text-xs text-slate-500">
              Satıra tıklayarak ilgili taşerona ait şantiye giderlerini, verilen çekleri ve cari hareketleri detaylı görebilirsiniz.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">Taşeron</th>
                <th className="py-3 px-3">Yetkili & İletişim</th>
                <th className="py-3 px-3">Uzmanlık</th>
                <th className="py-3 px-3">İlişkili Şantiyeler</th>
                <th className="py-3 px-3 text-right">Toplam Hakediş</th>
                <th className="py-3 px-3 text-right">Toplam Ödenen</th>
                <th className="py-3 px-3 text-right">Kalan Bakiye</th>
                <th className="py-3 px-3 text-center">Durum</th>
                <th className="py-3 px-2 text-center w-8">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    Kayıtlı taşeron bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  const isExpanded = expandedId === row.tas.id;
                  const isBorclu = row.netBakiye > 0;
                  const isSifir = row.netBakiye === 0;

                  return (
                    <React.Fragment key={row.tas.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : row.tas.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{row.tas.isim}</div>
                          <div className="text-[11px] text-slate-500">
                            {row.totalCariRecords} Cari / {row.totalSiteExpenses} Gider Fişi
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>{row.tas.yetkili || '-'}</div>
                          <div className="text-[11px] text-slate-400">{row.tas.telefon || '-'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {row.tas.uzmanlik || 'Genel Taşeron'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <div className="truncate max-w-[140px]" title={row.activeSiteNames.join(', ')}>
                            {row.activeSiteNames.join(', ') || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(row.grandHakedis, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600">
                          {formatCurrency(row.grandOdenen, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-black">
                          <span
                            className={
                              isBorclu
                                ? 'text-rose-600'
                                : isSifir
                                ? 'text-slate-600'
                                : 'text-blue-600'
                            }
                          >
                            {formatCurrency(Math.abs(row.netBakiye), 'TRY')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isBorclu ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Taşeron Alacaklı
                            </span>
                          ) : isSifir ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Hesap Kapandı
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              Fazla Ödendi
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expand row */}
                      {isExpanded && (
                        <tr className="bg-amber-50/20 border-b border-slate-200">
                          <td colSpan={10} className="p-4">
                            <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                                <span>{row.tas.isim} - Detaylı İşlem ve Ödeme Dağılımı</span>
                                <span className="text-[11px] text-slate-500">
                                  {row.cariRecords.length} Cari Hareket | {row.tasCekler.length} Verilen Çek
                                </span>
                              </div>

                              {/* Method Summary */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                  <div className="text-slate-500 text-[11px]">Çek ile Yapılan Ödemeler</div>
                                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                                    {formatCurrency(row.totalCekPayment, 'TRY')}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{row.tasCekler.length} Adet Çek</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                  <div className="text-slate-500 text-[11px]">Kredi Kartı ile Ödemeler</div>
                                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                                    {formatCurrency(row.totalKartPayment, 'TRY')}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Şirket Kredi Kartları</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                  <div className="text-slate-500 text-[11px]">Nakit & Banka Transferleri</div>
                                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                                    {formatCurrency(
                                      Math.max(0, row.grandOdenen - row.totalCekPayment - row.totalKartPayment),
                                      'TRY'
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Kasa & Havale</div>
                                </div>
                              </div>

                              {/* Recent Movements Preview */}
                              {row.cariRecords.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-slate-700">Son Cari Hareketler:</div>
                                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                    {row.cariRecords.slice(0, 5).map((c) => (
                                      <div
                                        key={c.id}
                                        className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-50 border border-slate-100"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-500 font-medium">{c.tarih}</span>
                                          <span className="text-slate-800">{c.aciklama || 'Cari İşlem'}</span>
                                        </div>
                                        <div className="font-bold">
                                          {c.borc > 0 ? (
                                            <span className="text-slate-900">
                                              Hakediş: {formatCurrency(c.borc, c.paraBirimi || 'TRY')}
                                            </span>
                                          ) : (
                                            <span className="text-emerald-600">
                                              Ödeme: {formatCurrency(c.alacak, c.paraBirimi || 'TRY')}
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
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3 px-3 text-right">TOPLAM:</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(aggregates.totalHakedis, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-emerald-700">{formatCurrency(aggregates.totalOdenen, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-rose-700">{formatCurrency(aggregates.totalNetBorc, 'TRY')}</td>
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
