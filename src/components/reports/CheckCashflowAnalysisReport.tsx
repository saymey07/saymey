import React, { useState, useMemo } from 'react';
import { 
  BookOpenCheck, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter, 
  Sparkles, 
  Calculator, 
  ArrowRight,
  Building2,
  Clock,
  Layers
} from 'lucide-react';
import { Cek, Firma } from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface CheckCashflowAnalysisReportProps {
  cekler: Cek[];
  firmalar: Firma[];
}

export const CheckCashflowAnalysisReport: React.FC<CheckCashflowAnalysisReportProps> = ({
  cekler,
  firmalar,
}) => {
  const exchangeRates = getSavedExchangeRates();
  const today = getTodayDateString();

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('active'); // active = Bekleyenler (Portföyde, Tahsilde, Beklemede)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Simulator State: "Firmaya ne zaman çek kesmeliyim?"
  const [simAmount, setSimAmount] = useState<number>(50000);
  const [simCurrency, setSimCurrency] = useState<string>('TRY');

  // Parse all checks with normalized TRY values
  const normalizedChecks = useMemo(() => {
    return cekler.map((c) => {
      const cur = c.paraBirimi || 'TRY';
      const miktarTRY = convertCurrencyToTRY(c.miktar, cur, exchangeRates.rates);
      const isAlinan = c.cekTuru === 'alinan_cek' || (!c.cekTuru && c.durum !== 'Ödendi');
      const isVerilen = c.cekTuru === 'verilen_cek';

      // Find matching firma name
      const firma = firmalar.find((f) => f.id === c.firmaId);
      const targetName =
        firma?.isim || c.hesapSahibi || c.hamil || c.aciklama || 'Belirtilmedi';

      return {
        ...c,
        isAlinan,
        isVerilen,
        miktarTRY: Math.round(miktarTRY),
        targetName,
      };
    });
  }, [cekler, firmalar, exchangeRates.rates]);

  // Filtered by status (active vs all)
  const filteredChecks = useMemo(() => {
    return normalizedChecks.filter((c) => {
      if (selectedStatus === 'active') {
        // Exclude already completed/paid checks
        if (c.durum === 'Tahsil Edildi' || c.durum === 'Ödendi') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const no = (c.cekNo || '').toLowerCase();
        const bank = (c.banka || '').toLowerCase();
        const name = (c.targetName || '').toLowerCase();
        if (!no.includes(q) && !bank.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [normalizedChecks, selectedStatus, searchQuery]);

  // Group by Maturity Month (Vade Ayı Analizi)
  const monthlyCashflow = useMemo(() => {
    const monthMap: Record<
      string,
      {
        monthKey: string;
        displayMonth: string;
        alinanTRY: number;
        verilenTRY: number;
        alinanCount: number;
        verilenCount: number;
        alinanChecks: typeof normalizedChecks;
        verilenChecks: typeof normalizedChecks;
      }
    > = {};

    filteredChecks.forEach((c) => {
      if (!c.vadeTarihi) return;
      const monthKey = c.vadeTarihi.substring(0, 7); // "YYYY-MM"
      if (!monthMap[monthKey]) {
        const [year, month] = monthKey.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, 1);
        const displayMonth = dateObj.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

        monthMap[monthKey] = {
          monthKey,
          displayMonth,
          alinanTRY: 0,
          verilenTRY: 0,
          alinanCount: 0,
          verilenCount: 0,
          alinanChecks: [],
          verilenChecks: [],
        };
      }

      if (c.isAlinan) {
        monthMap[monthKey].alinanTRY += c.miktarTRY;
        monthMap[monthKey].alinanCount += 1;
        monthMap[monthKey].alinanChecks.push(c);
      } else {
        monthMap[monthKey].verilenTRY += c.miktarTRY;
        monthMap[monthKey].verilenCount += 1;
        monthMap[monthKey].verilenChecks.push(c);
      }
    });

    // Sort chronologically and compute running cumulative balance
    const sorted = Object.values(monthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    let runningCumulativeBalance = 0;
    return sorted.map((m) => {
      const netMonthly = m.alinanTRY - m.verilenTRY;
      runningCumulativeBalance += netMonthly;
      const isDeficit = runningCumulativeBalance < 0;

      return {
        ...m,
        netMonthly,
        cumulativeBalance: runningCumulativeBalance,
        isDeficit,
      };
    });
  }, [filteredChecks]);

  // Overall totals
  const aggregates = useMemo(() => {
    let totalAlinanTRY = 0;
    let totalVerilenTRY = 0;
    let alinanCount = 0;
    let verilenCount = 0;

    filteredChecks.forEach((c) => {
      if (c.isAlinan) {
        totalAlinanTRY += c.miktarTRY;
        alinanCount++;
      } else {
        totalVerilenTRY += c.miktarTRY;
        verilenCount++;
      }
    });

    const netPosition = totalAlinanTRY - totalVerilenTRY;
    const isSafetyPositive = netPosition >= 0;

    return {
      totalAlinanTRY,
      totalVerilenTRY,
      alinanCount,
      verilenCount,
      netPosition,
      isSafetyPositive,
    };
  }, [filteredChecks]);

  // Smart Simulator: "Verilecek çek için en güvenli vade tarihi hesaplama"
  const recommendation = useMemo(() => {
    const requiredTRY = convertCurrencyToTRY(simAmount, simCurrency, exchangeRates.rates);
    if (!requiredTRY || requiredTRY <= 0) return null;

    // Filter all pending Alınan Çekler sorted by vade date
    const futureAlinan = normalizedChecks
      .filter((c) => c.isAlinan && c.durum !== 'Tahsil Edildi' && c.vadeTarihi >= today)
      .sort((a, b) => a.vadeTarihi.localeCompare(b.vadeTarihi));

    let accumulatedInflow = 0;
    let safeDate = '';
    let found = false;

    // We also must account for existing Verilen Çekler on those dates!
    for (const check of futureAlinan) {
      accumulatedInflow += check.miktarTRY;
      if (accumulatedInflow >= requiredTRY) {
        safeDate = check.vadeTarihi;
        found = true;
        break;
      }
    }

    // Add buffer of +2 to +5 business days after customer check is deposited
    let bufferDate = safeDate;
    if (safeDate) {
      const d = new Date(safeDate);
      d.setDate(d.getDate() + 3); // 3-day clearance safety margin
      bufferDate = d.toISOString().slice(0, 10);
    }

    return {
      requiredTRY,
      found,
      earliestCheckDate: safeDate,
      recommendedDate: bufferDate,
      totalFutureInflow: futureAlinan.reduce((acc, c) => acc + c.miktarTRY, 0),
    };
  }, [simAmount, simCurrency, normalizedChecks, today, exchangeRates.rates]);

  // Export options
  const exportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Çek Vade Uyum ve Likidite Nakit Akışı Analiz Raporu',
      subtitle: `Rapor Tarihi: ${today} | Alınan Çek Girişi: ${formatCurrency(aggregates.totalAlinanTRY, 'TRY')} | Verilen Çek Çıkışı: ${formatCurrency(aggregates.totalVerilenTRY, 'TRY')}`,
      filename: `Cek_Vade_Uyum_Analizi_${today}`,
      columns: [
        { header: '#', dataKey: '__index', width: 25 },
        { header: 'Vade Dönemi (Ay)', dataKey: 'period' },
        { header: 'Müşteriden Alınan Çekler', dataKey: 'alinan', align: 'right' },
        { header: 'Firmalara Verilen Çekler', dataKey: 'verilen', align: 'right' },
        { header: 'Dönem Net Farkı', dataKey: 'net', align: 'right' },
        { header: 'Kümülatif Nakit Durumu', dataKey: 'cum', align: 'right' },
        { header: 'Vade Güvenlik Analizi', dataKey: 'safety', align: 'center' },
      ],
      data: monthlyCashflow.map((m) => ({
        period: m.displayMonth,
        alinan: `${formatCurrency(m.alinanTRY, 'TRY')} (${m.alinanCount} Adet)`,
        verilen: `${formatCurrency(m.verilenTRY, 'TRY')} (${m.verilenCount} Adet)`,
        net: formatCurrency(m.netMonthly, 'TRY'),
        cum: formatCurrency(m.cumulativeBalance, 'TRY'),
        safety: m.cumulativeBalance >= 0 ? 'Denge Güvenli (Giriş Fazla)' : 'DİKKAT: Vade Açığı / Çıkış Fazla',
      })),
      summaryRows: [
        { label: 'Toplam Müşteri Çekleri (Giriş)', value: formatCurrency(aggregates.totalAlinanTRY, 'TRY') },
        { label: 'Toplam Verilen Firma Çekleri (Çıkış)', value: formatCurrency(aggregates.totalVerilenTRY, 'TRY') },
        { label: 'Net Kümülatif Çek Pozisyonu', value: formatCurrency(aggregates.netPosition, 'TRY') },
      ],
      orientation: 'landscape',
    };
  }, [monthlyCashflow, aggregates, today]);

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5 text-indigo-600" />
              <span>Çek Vade Uyum ve Likidite Analizi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Firmalara keseceğiniz çekleri, müşterilerden aldığınız çeklerin tahsilat tarihinden sonra kesmenizi sağlayan vade optimizasyon ekranı
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton options={exportOptions} buttonText="Çek Analizini İndir" variant="primary" />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Çek Durumu Filtresi
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active">⏳ Bekleyen ve Açık Çekler (Portföyde / Tahsilde / Vadesi Gelmemiş)</option>
              <option value="all">📁 Tüm Çekler (Tahsil Edilenler & Ödenenler Dahil)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Hızlı Arama
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Çek no, banka, firma adı..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Alınan Çek Girişleri */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Müşteriden Alınan Çekler</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatCurrency(aggregates.totalAlinanTRY, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{aggregates.alinanCount} Adet Çek Girişi</div>
        </div>

        {/* Firmalara Kesilen Çekler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Firmalara Kesilen Çekler</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-600">
            {formatCurrency(aggregates.totalVerilenTRY, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{aggregates.verilenCount} Adet Çek Çıkışı</div>
        </div>

        {/* Net Çek Pozisyonu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Net Çek Likiditesi</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                aggregates.isSafetyPositive ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {aggregates.isSafetyPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black ${
              aggregates.isSafetyPositive ? 'text-indigo-600' : 'text-amber-600'
            }`}
          >
            {formatCurrency(aggregates.netPosition, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {aggregates.isSafetyPositive ? 'Girişler çıkışları karşılıyor' : 'Çıkışlar fazla (Özkaynak gerekir)'}
          </div>
        </div>

        {/* Vade Uyum Durumu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Vade Uyum Sağlığı</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            {monthlyCashflow.some((m) => m.isDeficit) ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Vade Açığı Var
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Vade Dengesi Tam
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {monthlyCashflow.length} Dönemlik Nakit Akış İncelemesi
          </div>
        </div>
      </div>

      {/* SMART CHECK SIMULATOR: EN GÜVENLİ ÇEK KESME TARİHİ SİMÜLATÖRÜ */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-indigo-750 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Akıllı Çek Vadesi Danışmanı</span>
            </div>
            <h4 className="text-base font-black text-white">
              Tedarikçiye / Taşerona Çek Kesmeden Önce Vade Kontrolü Yapın
            </h4>
            <p className="text-xs text-indigo-200 mt-0.5">
              Keseceğiniz çekin karşılığının müşterilerden aldığınız çeklerle karşılanabilmesi için en erken güvenli vade tarihini anında hesaplar.
            </p>
          </div>

          {/* Amount inputs */}
          <div className="flex items-center gap-2 bg-indigo-950/60 p-2 rounded-xl border border-indigo-700/50">
            <div>
              <label className="block text-[10px] text-indigo-300 font-bold uppercase">Kesilecek Tutar</label>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                min={1000}
                step={1000}
                className="w-32 px-2.5 py-1.5 bg-indigo-900/80 border border-indigo-600 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-[10px] text-indigo-300 font-bold uppercase">Para Birimi</label>
              <select
                value={simCurrency}
                onChange={(e) => setSimCurrency(e.target.value)}
                className="px-2 py-1.5 bg-indigo-900/80 border border-indigo-600 rounded-lg text-xs font-bold text-white focus:outline-none"
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Simulation Output Card */}
        {recommendation && (
          <div className="mt-4 pt-2">
            {recommendation.found ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="bg-indigo-800/40 p-3 rounded-xl border border-indigo-700/40">
                  <div className="text-[11px] text-indigo-200">Gereken Karşılık Tahsilatı</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">
                    {formatCurrency(recommendation.requiredTRY, 'TRY')}
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-0.5">Müşteri çekleriyle finanse edilecek</div>
                </div>

                <div className="bg-indigo-800/40 p-3 rounded-xl border border-indigo-700/40">
                  <div className="text-[11px] text-indigo-200">En Erken Müşteri Çek Vadesi</div>
                  <div className="text-lg font-bold text-amber-300 mt-0.5">
                    {recommendation.earliestCheckDate}
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-0.5">Portföydeki son çekin vadesi</div>
                </div>

                <div className="bg-emerald-950/70 p-3 rounded-xl border border-emerald-500/50">
                  <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Önerilen En Güvenli Vade Tarihi</span>
                  </div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {recommendation.recommendedDate}
                  </div>
                  <div className="text-[10px] text-emerald-300 mt-0.5">+3 İş günü banka takas emniyet payı ile</div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Portföyünüzde bu tutarı ({formatCurrency(recommendation.requiredTRY, 'TRY')}) karşılayacak yeterli vadeli müşteri çeki bulunmuyor (Toplam bekleyen giriş: {formatCurrency(recommendation.totalFutureInflow, 'TRY')}). Bu çeki kesmeniz durumunda nakit/banka özkaynağınızdan karşılama yapmanız gerekecektir.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MONTHLY CASHFLOW VADE TIMELINE TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Aylık Çek Vade Giriş / Çıkış ve Nakit Dengesi</h4>
            <p className="text-xs text-slate-500">
              Her ay tahsil edilecek müşteri çekleri ile şirketiniz tarafından ödenecek çeklerin karşılıklı likidite dengesi
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3">Vade Dönemi</th>
                <th className="py-3 px-3 text-right">Müşteri Çek Girişi</th>
                <th className="py-3 px-3 text-right">Verilen Çek Çıkışı</th>
                <th className="py-3 px-3 text-right">Aylık Net Fark</th>
                <th className="py-3 px-3 text-right">Kümülatif Çek Dengesi</th>
                <th className="py-3 px-3 text-center">Vade Güvenlik Analizi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyCashflow.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Vadesi bekleyen çek kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                monthlyCashflow.map((m) => {
                  const isPositiveMonth = m.netMonthly >= 0;
                  const isSafeCumulative = m.cumulativeBalance >= 0;

                  return (
                    <tr key={m.monthKey} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.displayMonth}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        <div>{formatCurrency(m.alinanTRY, 'TRY')}</div>
                        <div className="text-[10px] text-slate-400">{m.alinanCount} Adet Çek</div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-600">
                        <div>{formatCurrency(m.verilenTRY, 'TRY')}</div>
                        <div className="text-[10px] text-slate-400">{m.verilenCount} Adet Çek</div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        <span className={isPositiveMonth ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatCurrency(m.netMonthly, 'TRY')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black">
                        <span className={isSafeCumulative ? 'text-indigo-600' : 'text-amber-600'}>
                          {formatCurrency(m.cumulativeBalance, 'TRY')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isSafeCumulative ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Girişler Karşılıyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            Vade Açığı (Çıkış Fazla)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {monthlyCashflow.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-3">TOPLAM:</td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    {formatCurrency(aggregates.totalAlinanTRY, 'TRY')}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700">
                    {formatCurrency(aggregates.totalVerilenTRY, 'TRY')}
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-700">
                    {formatCurrency(aggregates.netPosition, 'TRY')}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ALL CHECKS SORTED BY DUE DATE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Vade Sıralı Çek Listesi (Alınan & Verilen)</h4>
            <p className="text-xs text-slate-500">
              Öncelikli vadeden ileriye doğru tüm çek hareketleri
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3">Vade Tarihi</th>
                <th className="py-3 px-3">Tür</th>
                <th className="py-3 px-3">Çek No</th>
                <th className="py-3 px-3">Banka & Şube</th>
                <th className="py-3 px-3">İlişkili Firma / Kişi</th>
                <th className="py-3 px-3 text-right">Orijinal Tutar</th>
                <th className="py-3 px-3 text-right">TRY Karşılığı</th>
                <th className="py-3 px-3 text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    Kayıtlı çek bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredChecks
                  .sort((a, b) => (a.vadeTarihi || '').localeCompare(b.vadeTarihi || ''))
                  .map((c) => {
                    const isDuePast = c.vadeTarihi < today && c.durum !== 'Tahsil Edildi' && c.durum !== 'Ödendi';

                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-bold">
                          <span className={isDuePast ? 'text-rose-600 font-black' : 'text-slate-900'}>
                            {c.vadeTarihi}
                          </span>
                          {isDuePast && <span className="text-[10px] text-rose-500 block">Vadesi Geçmiş</span>}
                        </td>
                        <td className="py-3 px-3">
                          {c.isAlinan ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800">
                              <ArrowDownLeft className="w-3 h-3" />
                              Alınan (Giriş)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800">
                              <ArrowUpRight className="w-3 h-3" />
                              Verilen (Çıkış)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-700">{c.cekNo || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">
                          <div>{c.banka || '-'}</div>
                          {c.sube && <div className="text-[10px] text-slate-400">{c.sube}</div>}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{c.targetName}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">
                          {formatCurrency(c.miktar, c.paraBirimi || 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(c.miktarTRY, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {c.durum || 'Beklemede'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
