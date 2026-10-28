import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Receipt, 
  Plus, 
  Phone, 
  Mail, 
  Trash2, 
  Pencil, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Search, 
  AlertTriangle, 
  ExternalLink, 
  X,
  FileSpreadsheet,
  Wallet,
  FileCheck,
  Package,
  Users,
  Wrench,
  Layers,
  Coins,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Printer,
  FileText,
  Download,
  Upload
} from 'lucide-react';
import { Firma, FirmaCari, FirmaTuru, Santiye } from '../types';
import { formatCurrency, getCurrencySymbol, getTodayDateString } from '../utils/storage';
import { CurrencySelector } from './CurrencySelector';
import { ExportButton } from './ExportButton';
import { ExportOptions, exportToExcel, exportToPDF, printReport } from '../utils/exportUtils';
import { CariExcelImportModal } from './CariExcelImportModal';
import { ImportScope } from '../utils/excelImportUtils';
import {
  convertCurrencyToTRY,
  getCurrencyExchangeRate,
  getSuggestedCrossRate,
  calculateCrossDeduction,
  getSavedExchangeRates,
  getSavedCurrencies,
} from '../utils/currencyStore';

export interface CompanyBasketItem {
  borc: number;
  alacak: number;
  bakiye: number; // borc - alacak (pozitif: borçluyuz, negatif: alacaklıyız)
}

export interface CompanyStatsItem {
  baskets: Record<string, CompanyBasketItem>;
  totalBorcTRY: number;
  totalAlacakTRY: number;
  netBakiyeTRY: number;
  count: number;
  activeCurrencies: string[];
}

export type CariIslemTuru = 'alis_faturasi' | 'satis_faturasi' | 'odeme' | 'tahsilat';

export const getFirmaTurInfo = (tur?: FirmaTuru) => {
  switch (tur) {
    case 'musteri':
      return {
        tur: 'musteri' as const,
        label: 'Müşteri',
        fullLabel: 'Müşteri Firma',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/20',
        badgeHeaderClass: 'bg-blue-600 text-white',
        icon: '👥',
        desc: 'İşveren / Hakediş & Satış Müşterisi',
        example: 'Örn: Gülmete Turizm İnş.',
      };
    case 'taseron':
      return {
        tur: 'taseron' as const,
        label: 'Taşeron',
        fullLabel: 'Taşeron Firma',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-500/20',
        badgeHeaderClass: 'bg-purple-600 text-white',
        icon: '🔨',
        desc: 'Şantiye Alt Yüklenici / Taşeron',
        example: 'Örn: Adelsan İnşaat Ltd.',
      };
    case 'diger':
      return {
        tur: 'diger' as const,
        label: 'Diğer',
        fullLabel: 'Genel Firma',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        badgeHeaderClass: 'bg-slate-700 text-white',
        icon: '🏢',
        desc: 'Resmi Kurum veya Genel Cari Hesap',
        example: 'Örn: Yapı Denetim A.Ş.',
      };
    case 'tedarikci':
    default:
      return {
        tur: 'tedarikci' as const,
        label: 'Tedarikçi',
        fullLabel: 'Tedarikçi Firma',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-500/20',
        badgeHeaderClass: 'bg-amber-600 text-white',
        icon: '📦',
        desc: 'Malzeme, Bilişim veya Hizmet Satıcısı',
        example: 'Örn: YILDIRIMLAR BİLGİSAYAR',
      };
  }
};

export interface CompaniesAndLedgerProps {
  firmalar: Firma[];
  cariList: FirmaCari[];
  santiyeler?: Santiye[];
  initialFirmaId?: string;
  onAddFirma: (firma: Firma) => void;
  onUpdateFirma?: (firma: Firma) => void;
  onDeleteFirma: (id: string) => void;
  onAddCariHareket: (hareket: FirmaCari) => void;
  onUpdateCariHareket?: (hareket: FirmaCari) => void;
  onDeleteCariHareket: (id: string) => void;
  onOpenCurrencies?: () => void;
  onBatchImportFirmaAndCari?: (data: {
    firmsToUpsert: Partial<Firma>[];
    cariToInsert: Omit<FirmaCari, 'id'>[];
    summary: {
      newFirms: number;
      updatedFirms: number;
      newCari: number;
    };
  }) => void;
}

export const CompaniesAndLedger: React.FC<CompaniesAndLedgerProps> = ({
  firmalar,
  cariList,
  santiyeler = [],
  initialFirmaId,
  onAddFirma,
  onUpdateFirma,
  onDeleteFirma,
  onAddCariHareket,
  onUpdateCariHareket,
  onDeleteCariHareket,
  onOpenCurrencies,
  onBatchImportFirmaAndCari,
}) => {
  // Main view tab: 'cari' = Cari Hareketler & Faturalar, 'firmalar' = Firmalar Listesi
  const [activeSubTab, setActiveSubTab] = useState<'cari' | 'firmalar'>('cari');

  // Excel İçe Aktarma Modalı
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [excelImportScope, setExcelImportScope] = useState<ImportScope>('combined');

  const handleOpenExcelImport = (scope: ImportScope = 'combined') => {
    setExcelImportScope(scope);
    setIsExcelImportModalOpen(true);
  };

  // Filters & Search
  const [selectedFirmaId, setSelectedFirmaId] = useState<string>(initialFirmaId || 'all');

  useEffect(() => {
    if (initialFirmaId) {
      setSelectedFirmaId(initialFirmaId);
      setActiveSubTab('cari');
    }
  }, [initialFirmaId]);
  const [cariTurFilter, setCariTurFilter] = useState<'all' | CariIslemTuru>('all');
  const [cariParaBirimiFilter, setCariParaBirimiFilter] = useState<string>('all');
  const [cariSearchQuery, setCariSearchQuery] = useState<string>('');
  const [firmaSearchQuery, setFirmaSearchQuery] = useState<string>('');
  const [firmaTurFilter, setFirmaTurFilter] = useState<'all' | FirmaTuru>('all');

  // Modals for Firma
  const [isFirmaModalOpen, setIsFirmaModalOpen] = useState(false);
  const [editingFirma, setEditingFirma] = useState<Firma | null>(null);
  const [deletingFirma, setDeletingFirma] = useState<Firma | null>(null);

  // Modals for Cari Hareket
  const [isCariModalOpen, setIsCariModalOpen] = useState(false);
  const [editingCari, setEditingCari] = useState<FirmaCari | null>(null);
  const [deletingCari, setDeletingCari] = useState<FirmaCari | null>(null);

  // New Firma Form State
  const [firmaForm, setFirmaForm] = useState<Partial<Firma>>({
    isim: '',
    tur: 'tedarikci',
    vergiNo: '',
    vergiDairesi: '',
    ilgili: '',
    telefon: '',
    email: '',
    adres: '',
  });

  // Exchange rates for live conversions
  const exchangeRates = useMemo(() => getSavedExchangeRates(), []);

  // New Cari Movement Form State
  const [cariForm, setCariForm] = useState<{
    firmaId: string;
    tur: CariIslemTuru;
    tutar: number;
    paraBirimi: string;
    dovizKuru: number;
    hedefParaBirimi: string;
    hedefKur: number;
    hedefDusulenTutar: number;
    tarih: string;
    saat: string;
    faturaNo: string;
    aciklama: string;
    santiyeId: string;
  }>({
    firmaId: firmalar[0]?.id || '',
    tur: 'alis_faturasi',
    tutar: 10000,
    paraBirimi: 'TRY',
    dovizKuru: 1,
    hedefParaBirimi: 'TRY',
    hedefKur: 1,
    hedefDusulenTutar: 10000,
    tarih: getTodayDateString(),
    saat: '12:00',
    faturaNo: '',
    aciklama: '',
    santiyeId: santiyeler[0]?.id || '',
  });

  // Edit Cari Movement Form State
  const [editCariForm, setEditCariForm] = useState<{
    id: string;
    firmaId: string;
    tur: CariIslemTuru;
    tutar: number;
    paraBirimi: string;
    dovizKuru: number;
    hedefParaBirimi: string;
    hedefKur: number;
    hedefDusulenTutar: number;
    tarih: string;
    saat: string;
    faturaNo: string;
    aciklama: string;
    santiyeId: string;
  }>({
    id: '',
    firmaId: '',
    tur: 'alis_faturasi',
    tutar: 0,
    paraBirimi: 'TRY',
    dovizKuru: 1,
    hedefParaBirimi: 'TRY',
    hedefKur: 1,
    hedefDusulenTutar: 0,
    tarih: getTodayDateString(),
    saat: '12:00',
    faturaNo: '',
    aciklama: '',
    santiyeId: '',
  });

  // Helper to determine the transaction classification
  const getIslemClassification = (c: FirmaCari): {
    tur: CariIslemTuru;
    label: string;
    badgeClass: string;
    direction: 'borc' | 'alacak';
  } => {
    if (c.islemTuru) {
      switch (c.islemTuru) {
        case 'alis_faturasi':
          return {
            tur: 'alis_faturasi',
            label: 'Alış Faturası (Gelen)',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
            direction: 'borc',
          };
        case 'satis_faturasi':
          return {
            tur: 'satis_faturasi',
            label: 'Satış Faturası (Kesilen)',
            badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
            direction: 'alacak',
          };
        case 'odeme':
          return {
            tur: 'odeme',
            label: 'Ödeme Yapıldı',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            direction: 'alacak',
          };
        case 'tahsilat':
          return {
            tur: 'tahsilat',
            label: 'Tahsilat Alındı',
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
            direction: 'borc',
          };
      }
    }

    // Fallback for legacy records
    if ((c.borc || 0) > 0) {
      return {
        tur: 'alis_faturasi',
        label: 'Alış Faturası (Borç)',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        direction: 'borc',
      };
    }
    return {
      tur: 'odeme',
      label: 'Ödeme Yapıldı (Alacak)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      direction: 'alacak',
    };
  };

  // Precomputed company balances & currency baskets
  const companyStats = useMemo(() => {
    const statsMap: Record<string, CompanyStatsItem> = {};

    firmalar.forEach((f) => {
      statsMap[f.id] = {
        baskets: {},
        totalBorcTRY: 0,
        totalAlacakTRY: 0,
        netBakiyeTRY: 0,
        count: 0,
        activeCurrencies: [],
      };
    });

    cariList.forEach((c) => {
      if (!statsMap[c.firmaId]) {
        statsMap[c.firmaId] = {
          baskets: {},
          totalBorcTRY: 0,
          totalAlacakTRY: 0,
          netBakiyeTRY: 0,
          count: 0,
          activeCurrencies: [],
        };
      }
      const item = statsMap[c.firmaId];
      item.count += 1;

      const cls = getIslemClassification(c);
      const origCurr = (c.paraBirimi || 'TRY').trim().toUpperCase();

      if (cls.tur === 'alis_faturasi') {
        // Alış faturası: Kendi para birimi sepetine borç olarak girer
        if (!item.baskets[origCurr]) item.baskets[origCurr] = { borc: 0, alacak: 0, bakiye: 0 };
        item.baskets[origCurr].borc += (c.borc || 0);
        item.baskets[origCurr].bakiye += (c.borc || 0);

        const tryVal = c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : convertCurrencyToTRY(c.borc || 0, origCurr, exchangeRates.rates);
        item.totalBorcTRY += tryVal;
      } else if (cls.tur === 'satis_faturasi') {
        // Satış faturası: Kendi para birimi sepetine alacak olarak girer
        if (!item.baskets[origCurr]) item.baskets[origCurr] = { borc: 0, alacak: 0, bakiye: 0 };
        item.baskets[origCurr].alacak += (c.alacak || 0);
        item.baskets[origCurr].bakiye -= (c.alacak || 0);

        const tryVal = c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : convertCurrencyToTRY(c.alacak || 0, origCurr, exchangeRates.rates);
        item.totalAlacakTRY += tryVal;
      } else if (cls.tur === 'odeme') {
        // Ödeme: Hedef para birimi sepetinden düşer
        const targetCurr = (c.hedefParaBirimi || origCurr).trim().toUpperCase();
        const deducted = c.hedefDusulenTutar && c.hedefDusulenTutar > 0
          ? c.hedefDusulenTutar
          : (c.alacak || 0);

        if (!item.baskets[targetCurr]) item.baskets[targetCurr] = { borc: 0, alacak: 0, bakiye: 0 };
        item.baskets[targetCurr].alacak += deducted;
        item.baskets[targetCurr].bakiye -= deducted;

        const tryVal = c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : convertCurrencyToTRY(c.alacak || 0, origCurr, exchangeRates.rates);
        item.totalAlacakTRY += tryVal;
      } else if (cls.tur === 'tahsilat') {
        // Tahsilat: Hedef para birimi sepetinden düşer
        const targetCurr = (c.hedefParaBirimi || origCurr).trim().toUpperCase();
        const deducted = c.hedefDusulenTutar && c.hedefDusulenTutar > 0
          ? c.hedefDusulenTutar
          : (c.borc || 0);

        if (!item.baskets[targetCurr]) item.baskets[targetCurr] = { borc: 0, alacak: 0, bakiye: 0 };
        item.baskets[targetCurr].borc += deducted;
        item.baskets[targetCurr].bakiye += deducted;

        const tryVal = c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : convertCurrencyToTRY(c.borc || 0, origCurr, exchangeRates.rates);
        item.totalBorcTRY += tryVal;
      }
    });

    // Her firma için aktif döviz sepetleri ve konsolide TRY bakiye hesabı
    Object.values(statsMap).forEach((st) => {
      st.activeCurrencies = Object.keys(st.baskets).filter((curr) => {
        const b = st.baskets[curr];
        return Math.abs(b.borc) > 0.001 || Math.abs(b.alacak) > 0.001 || Math.abs(b.bakiye) > 0.001;
      });

      let netBakiye = 0;
      Object.entries(st.baskets).forEach(([curr, b]) => {
        netBakiye += convertCurrencyToTRY(b.bakiye, curr, exchangeRates.rates);
      });
      st.netBakiyeTRY = Math.round((netBakiye + Number.EPSILON) * 100) / 100;
    });

    return statsMap;
  }, [cariList, firmalar, exchangeRates]);

  // Precomputed company category counts
  const firmaCounts = useMemo(() => {
    let tedarikci = 0;
    let musteri = 0;
    let taseron = 0;
    let diger = 0;
    firmalar.forEach((f) => {
      const t = f.tur || 'tedarikci';
      if (t === 'musteri') musteri++;
      else if (t === 'taseron') taseron++;
      else if (t === 'diger') diger++;
      else tedarikci++;
    });
    return { tedarikci, musteri, taseron, diger, total: firmalar.length };
  }, [firmalar]);

  // Filtered Companies
  const filteredFirmalar = useMemo(() => {
    return firmalar.filter((f) => {
      const actualTur = f.tur || 'tedarikci';
      if (firmaTurFilter !== 'all' && actualTur !== firmaTurFilter) {
        return false;
      }
      if (!firmaSearchQuery.trim()) return true;
      const q = firmaSearchQuery.toLowerCase();
      return (
        f.isim.toLowerCase().includes(q) ||
        (f.vergiNo && f.vergiNo.toLowerCase().includes(q)) ||
        (f.vergiDairesi && f.vergiDairesi.toLowerCase().includes(q)) ||
        (f.ilgili && f.ilgili.toLowerCase().includes(q)) ||
        (f.telefon && f.telefon.toLowerCase().includes(q)) ||
        (f.adres && f.adres.toLowerCase().includes(q))
      );
    });
  }, [firmalar, firmaSearchQuery, firmaTurFilter]);

  // Filtered Cari Movements
  const filteredCari = useMemo(() => {
    return cariList.filter((c) => {
      const matchesFirma = selectedFirmaId === 'all' || c.firmaId === selectedFirmaId;
      const classification = getIslemClassification(c);
      
      const matchesTur =
        cariTurFilter === 'all' || classification.tur === cariTurFilter;

      const matchesCurrency =
        cariParaBirimiFilter === 'all' ||
        (c.paraBirimi || 'TRY').toUpperCase() === cariParaBirimiFilter.toUpperCase();

      const firm = firmalar.find((f) => f.id === c.firmaId);
      const q = cariSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (c.faturaNo && c.faturaNo.toLowerCase().includes(q)) ||
        (c.aciklama && c.aciklama.toLowerCase().includes(q)) ||
        (firm && firm.isim.toLowerCase().includes(q));

      return matchesFirma && matchesTur && matchesCurrency && matchesSearch;
    });
  }, [cariList, selectedFirmaId, cariTurFilter, cariParaBirimiFilter, cariSearchQuery, firmalar]);

  // Totals in TRY (Consolidated) for top cards
  const totalBorc = useMemo(() => {
    if (selectedFirmaId !== 'all') {
      return companyStats[selectedFirmaId]?.totalBorcTRY || 0;
    }
    return (Object.values(companyStats) as CompanyStatsItem[]).reduce((acc, st) => acc + st.totalBorcTRY, 0);
  }, [companyStats, selectedFirmaId]);

  const totalAlacak = useMemo(() => {
    if (selectedFirmaId !== 'all') {
      return companyStats[selectedFirmaId]?.totalAlacakTRY || 0;
    }
    return (Object.values(companyStats) as CompanyStatsItem[]).reduce((acc, st) => acc + st.totalAlacakTRY, 0);
  }, [companyStats, selectedFirmaId]);

  const netCariBakiye = useMemo(() => {
    if (selectedFirmaId !== 'all') {
      return companyStats[selectedFirmaId]?.netBakiyeTRY || 0;
    }
    return (Object.values(companyStats) as CompanyStatsItem[]).reduce((acc, st) => acc + st.netBakiyeTRY, 0);
  }, [companyStats, selectedFirmaId]);

  // Breakdown statistics in TRY for current filter
  const statsBreakdown = useMemo(() => {
    const list = selectedFirmaId === 'all' ? cariList : cariList.filter((c) => c.firmaId === selectedFirmaId);
    let alisFaturaToplami = 0;
    let satisFaturaToplami = 0;
    let odemeToplami = 0;
    let tahsilatToplami = 0;

    list.forEach((c) => {
      const cls = getIslemClassification(c);
      const origCurr = (c.paraBirimi || 'TRY').trim().toUpperCase();
      const val = c.borc > 0 ? c.borc : c.alacak || 0;
      const tryVal = c.tlKarsiligi && c.tlKarsiligi > 0 
        ? c.tlKarsiligi 
        : convertCurrencyToTRY(val, origCurr, exchangeRates.rates);

      if (cls.tur === 'alis_faturasi') alisFaturaToplami += tryVal;
      else if (cls.tur === 'satis_faturasi') satisFaturaToplami += tryVal;
      else if (cls.tur === 'odeme') odemeToplami += tryVal;
      else if (cls.tur === 'tahsilat') tahsilatToplami += tryVal;
    });

    return {
      alisFaturaToplami,
      satisFaturaToplami,
      odemeToplami,
      tahsilatToplami,
    };
  }, [cariList, selectedFirmaId, exchangeRates]);

  // Helper to open Add Cari Modal with pre-configured settings
  const handleOpenAddCariModal = (
    initialFirmaId?: string,
    initialTur?: CariIslemTuru,
    initialTargetCurr?: string
  ) => {
    const fId = initialFirmaId || (selectedFirmaId !== 'all' ? selectedFirmaId : firmalar[0]?.id || '');
    const selectedF = firmalar.find((f) => f.id === fId);
    const effectiveTur: CariIslemTuru = initialTur || (selectedF?.tur === 'musteri' ? 'satis_faturasi' : 'alis_faturasi');
    const isPayment = effectiveTur === 'odeme';
    const isCollection = effectiveTur === 'tahsilat';
    const isPayOrCollect = isPayment || isCollection;

    const st = companyStats[fId];
    const firstForeign = st?.activeCurrencies.find((curr) => curr !== 'TRY');
    const targetCurr = initialTargetCurr || (isPayment && firstForeign ? firstForeign : 'TRY');
    const paymentCurr = isPayment ? 'TRY' : targetCurr;

    const cross = getSuggestedCrossRate(paymentCurr, targetCurr, exchangeRates.rates);
    const tutar = isPayment ? 3000 : 10000;
    const initialDeduction = isPayOrCollect ? calculateCrossDeduction(tutar, paymentCurr, targetCurr, cross.rate, exchangeRates.rates) : tutar;

    const matchedCustomerSite = selectedF
      ? santiyeler.find((s) => s.yetkiliFirma && s.yetkiliFirma.trim().toLowerCase() === selectedF.isim.trim().toLowerCase())
      : undefined;

    setCariForm({
      firmaId: fId,
      tur: effectiveTur,
      tutar,
      paraBirimi: paymentCurr,
      dovizKuru: getCurrencyExchangeRate(paymentCurr, exchangeRates.rates),
      hedefParaBirimi: isPayOrCollect ? targetCurr : paymentCurr,
      hedefKur: isPayOrCollect ? cross.rate : 1,
      hedefDusulenTutar: isPayOrCollect ? initialDeduction : tutar,
      tarih: getTodayDateString(),
      saat: '12:00',
      faturaNo: '',
      aciklama: '',
      santiyeId: matchedCustomerSite?.id || '',
    });
    setIsCariModalOpen(true);
  };

  const updateCariFormCrossCalculation = (
    updates: Partial<typeof cariForm>,
    baseState = cariForm
  ) => {
    const merged = { ...baseState, ...updates };
    const payCurr = (merged.paraBirimi || 'TRY').toUpperCase();
    const isPayOrCollect = merged.tur === 'odeme' || merged.tur === 'tahsilat';

    if (isPayOrCollect) {
      let targetCurr = (merged.hedefParaBirimi || payCurr).toUpperCase();
      if (updates.paraBirimi !== undefined && updates.hedefParaBirimi === undefined) {
        if ((baseState.hedefParaBirimi || 'TRY').toUpperCase() === (baseState.paraBirimi || 'TRY').toUpperCase()) {
          targetCurr = payCurr;
        }
      } else if (updates.hedefParaBirimi !== undefined) {
        targetCurr = updates.hedefParaBirimi.toUpperCase();
      }

      let kur = merged.hedefKur;
      if (payCurr === targetCurr) {
        kur = 1;
      } else if (!kur || kur <= 0 || updates.hedefParaBirimi !== undefined || updates.paraBirimi !== undefined) {
        kur = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates).rate;
      }

      const deducted = calculateCrossDeduction(merged.tutar || 0, payCurr, targetCurr, kur, exchangeRates.rates);
      const rateToTry = payCurr === 'TRY' ? 1 : (merged.dovizKuru || getCurrencyExchangeRate(payCurr, exchangeRates.rates));

      setCariForm({
        ...merged,
        paraBirimi: payCurr,
        dovizKuru: rateToTry,
        hedefParaBirimi: targetCurr,
        hedefKur: kur,
        hedefDusulenTutar: deducted,
      });
    } else {
      // Faturalar (Alış Faturası veya Satış Faturası) kesinlikle çapraz borç düşümü içermez
      const rateToTry = payCurr === 'TRY' ? 1 : (updates.paraBirimi ? getCurrencyExchangeRate(payCurr, exchangeRates.rates) : (merged.dovizKuru || getCurrencyExchangeRate(payCurr, exchangeRates.rates)));
      setCariForm({
        ...merged,
        paraBirimi: payCurr,
        dovizKuru: rateToTry,
        hedefParaBirimi: payCurr,
        hedefKur: 1,
        hedefDusulenTutar: merged.tutar || 0,
      });
    }
  };

  const updateEditCariFormCrossCalculation = (
    updates: Partial<typeof editCariForm>,
    baseState = editCariForm
  ) => {
    const merged = { ...baseState, ...updates };
    const payCurr = (merged.paraBirimi || 'TRY').toUpperCase();
    const isPayOrCollect = merged.tur === 'odeme' || merged.tur === 'tahsilat';

    if (isPayOrCollect) {
      let targetCurr = (merged.hedefParaBirimi || payCurr).toUpperCase();
      if (updates.paraBirimi !== undefined && updates.hedefParaBirimi === undefined) {
        if ((baseState.hedefParaBirimi || 'TRY').toUpperCase() === (baseState.paraBirimi || 'TRY').toUpperCase()) {
          targetCurr = payCurr;
        }
      } else if (updates.hedefParaBirimi !== undefined) {
        targetCurr = updates.hedefParaBirimi.toUpperCase();
      }

      let kur = merged.hedefKur;
      if (payCurr === targetCurr) {
        kur = 1;
      } else if (!kur || kur <= 0 || updates.hedefParaBirimi !== undefined || updates.paraBirimi !== undefined) {
        kur = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates).rate;
      }

      const deducted = calculateCrossDeduction(merged.tutar || 0, payCurr, targetCurr, kur, exchangeRates.rates);
      const rateToTry = payCurr === 'TRY' ? 1 : (merged.dovizKuru || getCurrencyExchangeRate(payCurr, exchangeRates.rates));

      setEditCariForm({
        ...merged,
        paraBirimi: payCurr,
        dovizKuru: rateToTry,
        hedefParaBirimi: targetCurr,
        hedefKur: kur,
        hedefDusulenTutar: deducted,
      });
    } else {
      // Faturalar (Alış Faturası veya Satış Faturası)
      const rateToTry = payCurr === 'TRY' ? 1 : (updates.paraBirimi ? getCurrencyExchangeRate(payCurr, exchangeRates.rates) : (merged.dovizKuru || getCurrencyExchangeRate(payCurr, exchangeRates.rates)));
      setEditCariForm({
        ...merged,
        paraBirimi: payCurr,
        dovizKuru: rateToTry,
        hedefParaBirimi: payCurr,
        hedefKur: 1,
        hedefDusulenTutar: merged.tutar || 0,
      });
    }
  };

  // Handlers for Firma
  const handleOpenNewFirmaModal = (tur: FirmaTuru = 'tedarikci') => {
    setFirmaForm({
      isim: '',
      tur,
      vergiNo: '',
      vergiDairesi: '',
      ilgili: '',
      telefon: '',
      email: '',
      adres: '',
      uzmanlik: tur === 'taseron' ? 'Ahşap İşleri' : '',
    });
    setIsFirmaModalOpen(true);
  };

  const handleSaveFirma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmaForm.isim?.trim()) return;

    onAddFirma({
      id: `f-${Date.now()}`,
      isim: firmaForm.isim.trim(),
      tur: firmaForm.tur || 'tedarikci',
      vergiNo: firmaForm.vergiNo?.trim() || '',
      vergiDairesi: firmaForm.vergiDairesi?.trim() || '',
      ilgili: firmaForm.ilgili?.trim() || '',
      telefon: firmaForm.telefon?.trim() || '',
      email: firmaForm.email?.trim() || '',
      adres: firmaForm.adres?.trim() || '',
      uzmanlik: firmaForm.uzmanlik?.trim() || '',
    });
    setFirmaForm({
      isim: '',
      tur: 'tedarikci',
      vergiNo: '',
      vergiDairesi: '',
      ilgili: '',
      telefon: '',
      email: '',
      adres: '',
      uzmanlik: '',
    });
    setIsFirmaModalOpen(false);
  };

  const handleOpenEditFirma = (f: Firma) => {
    setEditingFirma({
      ...f,
      tur: f.tur || 'tedarikci',
      vergiDairesi: f.vergiDairesi || '',
      uzmanlik: f.uzmanlik || '',
    });
  };

  const handleSaveEditFirma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFirma || !editingFirma.isim?.trim()) return;

    if (onUpdateFirma) {
      onUpdateFirma({
        ...editingFirma,
        isim: editingFirma.isim.trim(),
        tur: editingFirma.tur || 'tedarikci',
        vergiNo: editingFirma.vergiNo?.trim() || '',
        vergiDairesi: editingFirma.vergiDairesi?.trim() || '',
        ilgili: editingFirma.ilgili?.trim() || '',
        telefon: editingFirma.telefon?.trim() || '',
        email: editingFirma.email?.trim() || '',
        adres: editingFirma.adres?.trim() || '',
        uzmanlik: editingFirma.uzmanlik?.trim() || '',
      });
    }
    setEditingFirma(null);
  };

  const handleConfirmDeleteFirma = () => {
    if (!deletingFirma) return;
    onDeleteFirma(deletingFirma.id);
    if (selectedFirmaId === deletingFirma.id) {
      setSelectedFirmaId('all');
    }
    setDeletingFirma(null);
  };

  // Handlers for Cari Movement
  const calculateBorcAlacak = (tur: CariIslemTuru, tutar: number) => {
    if (tur === 'alis_faturasi') {
      return { borc: tutar, alacak: 0 };
    } else if (tur === 'satis_faturasi') {
      return { borc: 0, alacak: tutar };
    } else if (tur === 'odeme') {
      return { borc: 0, alacak: tutar };
    } else {
      // tahsilat
      return { borc: tutar, alacak: 0 };
    }
  };

  const handleSaveCari = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cariForm.firmaId || Number(cariForm.tutar) <= 0) return;

    const tutar = Number(cariForm.tutar);
    const curr = (cariForm.paraBirimi || 'TRY').trim().toUpperCase();
    const rateToTry = cariForm.dovizKuru > 0 
      ? cariForm.dovizKuru 
      : getCurrencyExchangeRate(curr, exchangeRates.rates);
    const tlVal = convertCurrencyToTRY(tutar, curr, exchangeRates.rates);

    const isPayOrCollect = cariForm.tur === 'odeme' || cariForm.tur === 'tahsilat';
    let effectiveKur: number | undefined = undefined;
    let deductedAmount: number | undefined = undefined;
    let targetCurr: string | undefined = undefined;

    if (isPayOrCollect) {
      targetCurr = (cariForm.hedefParaBirimi || curr).trim().toUpperCase();
      if (curr !== targetCurr) {
        const suggested = getSuggestedCrossRate(curr, targetCurr, exchangeRates.rates);
        effectiveKur = cariForm.hedefKur > 0 ? cariForm.hedefKur : suggested.rate;
        deductedAmount = calculateCrossDeduction(tutar, curr, targetCurr, effectiveKur, exchangeRates.rates);
      } else {
        effectiveKur = 1;
        deductedAmount = tutar;
      }
    }

    const { borc, alacak } = calculateBorcAlacak(cariForm.tur, tutar);
    const chosenSite = santiyeler.find((s) => s.id === cariForm.santiyeId);

    onAddCariHareket({
      id: `fc-${Date.now()}`,
      firmaId: cariForm.firmaId,
      borc,
      alacak,
      paraBirimi: curr,
      dovizKuru: rateToTry,
      tlKarsiligi: tlVal,
      hedefParaBirimi: isPayOrCollect ? targetCurr : undefined,
      hedefKur: isPayOrCollect ? effectiveKur : undefined,
      hedefDusulenTutar: isPayOrCollect ? deductedAmount : undefined,
      tarih: cariForm.tarih,
      saat: cariForm.saat,
      faturaNo: cariForm.faturaNo?.trim() || '',
      aciklama: cariForm.aciklama?.trim() || '',
      islemTuru: cariForm.tur,
      santiyeId: chosenSite?.id || undefined,
      santiyeAdi: chosenSite?.isim || undefined,
    });

    setIsCariModalOpen(false);
  };

  const handleOpenEditCari = (c: FirmaCari) => {
    const classification = getIslemClassification(c);
    const tutar = (c.borc || 0) > 0 ? c.borc : c.alacak || 0;
    const curr = (c.paraBirimi || 'TRY').trim().toUpperCase();
    const isPayOrCollect = classification.tur === 'odeme' || classification.tur === 'tahsilat';
    const targetCurr = isPayOrCollect ? (c.hedefParaBirimi || curr).trim().toUpperCase() : curr;
    const rateToTry = c.dovizKuru || getCurrencyExchangeRate(curr, exchangeRates.rates);
    const targetRate = isPayOrCollect ? (c.hedefKur || getSuggestedCrossRate(curr, targetCurr, exchangeRates.rates).rate) : 1;
    const deducted = isPayOrCollect ? (c.hedefDusulenTutar || calculateCrossDeduction(tutar, curr, targetCurr, targetRate, exchangeRates.rates)) : tutar;

    const matchedSite = santiyeler.find(
      (s) =>
        s.id === c.santiyeId ||
        (c.santiyeAdi && s.isim.trim().toLowerCase() === c.santiyeAdi.trim().toLowerCase()) ||
        (c.aciklama && c.aciklama.toLowerCase().includes(s.isim.toLowerCase()))
    );

    setEditCariForm({
      id: c.id,
      firmaId: c.firmaId,
      tur: classification.tur,
      tutar,
      paraBirimi: curr,
      dovizKuru: rateToTry,
      hedefParaBirimi: targetCurr,
      hedefKur: targetRate,
      hedefDusulenTutar: deducted,
      tarih: c.tarih || getTodayDateString(),
      saat: c.saat || '12:00',
      faturaNo: c.faturaNo || '',
      aciklama: c.aciklama || '',
      santiyeId: matchedSite?.id || c.santiyeId || '',
    });
    setEditingCari(c);
  };

  const handleSaveEditCari = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCari || !editCariForm.firmaId || Number(editCariForm.tutar) <= 0) return;

    const tutar = Number(editCariForm.tutar);
    const curr = (editCariForm.paraBirimi || 'TRY').trim().toUpperCase();
    const rateToTry = editCariForm.dovizKuru > 0 
      ? editCariForm.dovizKuru 
      : getCurrencyExchangeRate(curr, exchangeRates.rates);
    const tlVal = convertCurrencyToTRY(tutar, curr, exchangeRates.rates);

    const isPayOrCollect = editCariForm.tur === 'odeme' || editCariForm.tur === 'tahsilat';
    let effectiveKur: number | undefined = undefined;
    let deductedAmount: number | undefined = undefined;
    let targetCurr: string | undefined = undefined;

    if (isPayOrCollect) {
      targetCurr = (editCariForm.hedefParaBirimi || curr).trim().toUpperCase();
      if (curr !== targetCurr) {
        const suggested = getSuggestedCrossRate(curr, targetCurr, exchangeRates.rates);
        effectiveKur = editCariForm.hedefKur > 0 ? editCariForm.hedefKur : suggested.rate;
        deductedAmount = calculateCrossDeduction(tutar, curr, targetCurr, effectiveKur, exchangeRates.rates);
      } else {
        effectiveKur = 1;
        deductedAmount = tutar;
      }
    }

    const { borc, alacak } = calculateBorcAlacak(editCariForm.tur, tutar);
    const chosenSite = santiyeler.find((s) => s.id === editCariForm.santiyeId);

    const updated: FirmaCari = {
      id: editingCari.id,
      firmaId: editCariForm.firmaId,
      borc,
      alacak,
      paraBirimi: curr,
      dovizKuru: rateToTry,
      tlKarsiligi: tlVal,
      hedefParaBirimi: isPayOrCollect ? targetCurr : undefined,
      hedefKur: isPayOrCollect ? effectiveKur : undefined,
      hedefDusulenTutar: isPayOrCollect ? deductedAmount : undefined,
      tarih: editCariForm.tarih,
      saat: editCariForm.saat,
      faturaNo: editCariForm.faturaNo?.trim() || '',
      aciklama: editCariForm.aciklama?.trim() || '',
      islemTuru: editCariForm.tur,
      cekId: editingCari.cekId,
      giderId: editingCari.giderId,
      odemeId: editingCari.odemeId,
      santiyeId: chosenSite?.id || undefined,
      santiyeAdi: chosenSite?.isim || undefined,
    };

    if (onUpdateCariHareket) {
      onUpdateCariHareket(updated);
    }
    setEditingCari(null);
  };

  const handleConfirmDeleteCari = () => {
    if (!deletingCari) return;
    onDeleteCariHareket(deletingCari.id);
    setDeletingCari(null);
  };

  // Find active selected company name for title
  const activeFirmaObj = firmalar.find((f) => f.id === selectedFirmaId);

  // Export options for Firma Cari Hareketleri
  const getLedgerExportOptions = (): ExportOptions => {
    const isSingleCompany = selectedFirmaId !== 'all' && activeFirmaObj;
    const title = isSingleCompany 
      ? `${activeFirmaObj.isim} - Cari Hesap Ekstresi`
      : 'Firma Cari Hesap Hareketleri Dökümü';
    
    const subtitle = isSingleCompany
      ? `Firma Türü: ${getFirmaTurInfo(activeFirmaObj.tur).label} | VN: ${activeFirmaObj.vergiNo || '-'} | Raporlanan: ${filteredCari.length} hareket`
      : `Toplam: ${filteredCari.length} hareket | İşlem Türü: ${cariTurFilter === 'all' ? 'Tümü' : cariTurFilter}`;

    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Tarih & Saat', dataKey: 'tarihSaat', width: 25 },
      { header: 'Firma Adı', dataKey: 'firmaAdi', width: 35 },
      { header: 'İşlem Türü', dataKey: 'islemTuru', width: 25 },
      { header: 'Fatura / Evrak No', dataKey: 'faturaNo', width: 25 },
      { header: 'Açıklama', dataKey: 'aciklama', width: 45 },
      { header: 'Borç Tutarı', dataKey: 'borcStr', width: 25, align: 'right' as const },
      { header: 'Alacak Tutarı', dataKey: 'alacakStr', width: 25, align: 'right' as const },
      { header: 'Borç (TRY)', dataKey: 'borcTRY', width: 25, align: 'right' as const },
      { header: 'Alacak (TRY)', dataKey: 'alacakTRY', width: 25, align: 'right' as const },
    ];

    let sumBorcTRY = 0;
    let sumAlacakTRY = 0;

    const data = filteredCari.map((c) => {
      const firm = firmalar.find((f) => f.id === c.firmaId);
      const classification = getIslemClassification(c);
      const bTRY = convertCurrencyToTRY(c.borc || 0, c.paraBirimi || 'TRY', exchangeRates.rates);
      const aTRY = convertCurrencyToTRY(c.alacak || 0, c.paraBirimi || 'TRY', exchangeRates.rates);
      sumBorcTRY += bTRY;
      sumAlacakTRY += aTRY;

      return {
        tarihSaat: `${c.tarih} ${c.saat || ''}`.trim(),
        firmaAdi: firm ? firm.isim : 'Bilinmeyen Firma',
        islemTuru: classification.label,
        faturaNo: c.faturaNo || '-',
        aciklama: c.aciklama || '-',
        borcStr: c.borc > 0 ? formatCurrency(c.borc, c.paraBirimi || 'TRY') : '-',
        alacakStr: c.alacak > 0 ? formatCurrency(c.alacak, c.paraBirimi || 'TRY') : '-',
        borcTRY: c.borc > 0 ? formatCurrency(bTRY) : '-',
        alacakTRY: c.alacak > 0 ? formatCurrency(aTRY) : '-',
      };
    });

    const netTRY = sumBorcTRY - sumAlacakTRY;
    const netStatus = netTRY > 0 ? 'Firmaya Borçluyuz' : netTRY < 0 ? 'Firmadan Alacaklıyız' : 'Bakiye Sıfır';

    const summaryRows = [
      { label: 'Toplam Borç (Bizim Borcumuz)', value: formatCurrency(sumBorcTRY) },
      { label: 'Toplam Alacak (Bizim Alacağımız)', value: formatCurrency(sumAlacakTRY) },
      { label: 'Net Bakiye Durumu', value: `${formatCurrency(Math.abs(netTRY))} (${netStatus})` },
    ];

    return {
      title,
      subtitle,
      filename: isSingleCompany 
        ? `Cari_Ekstre_${activeFirmaObj.isim.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}_${getTodayDateString()}`
        : `Firma_Cari_Hareketleri_${getTodayDateString()}`,
      columns,
      data,
      summaryRows,
      orientation: 'landscape',
    };
  };

  // Export options for Firmalar Listesi
  const getCompaniesExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Firma Adı', dataKey: 'isim', width: 35 },
      { header: 'Firma Türü', dataKey: 'turLabel', width: 20 },
      { header: 'Yetkili Kişi', dataKey: 'yetkili', width: 25 },
      { header: 'Telefon', dataKey: 'telefon', width: 20 },
      { header: 'Vergi No / Daire', dataKey: 'vergiInfo', width: 25 },
      { header: 'Toplam Borç (TRY)', dataKey: 'borcTRY', width: 25, align: 'right' as const },
      { header: 'Toplam Alacak (TRY)', dataKey: 'alacakTRY', width: 25, align: 'right' as const },
      { header: 'Net Bakiye (TRY)', dataKey: 'bakiyeTRY', width: 25, align: 'right' as const },
      { header: 'Durum', dataKey: 'durumLabel', width: 25 },
    ];

    let totalBorc = 0;
    let totalAlacak = 0;

    const data = filteredFirmalar.map((f) => {
      const stats = companyStats[f.id] || { totalBorcTRY: 0, totalAlacakTRY: 0, netBakiyeTRY: 0 };
      totalBorc += stats.totalBorcTRY;
      totalAlacak += stats.totalAlacakTRY;
      const net = stats.netBakiyeTRY;
      const netStatus = net > 0 ? 'Firmaya Borçluyuz' : net < 0 ? 'Firmadan Alacaklıyız' : 'Bakiye Sıfır';

      return {
        isim: f.isim,
        turLabel: getFirmaTurInfo(f.tur).label,
        yetkili: f.yetkili || '-',
        telefon: f.telefon || '-',
        vergiInfo: f.vergiDairesi && f.vergiNo ? `${f.vergiDairesi} - ${f.vergiNo}` : (f.vergiNo || f.vergiDairesi || '-'),
        borcTRY: formatCurrency(stats.totalBorcTRY),
        alacakTRY: formatCurrency(stats.totalAlacakTRY),
        bakiyeTRY: formatCurrency(Math.abs(net)),
        durumLabel: netStatus,
      };
    });

    const netGenel = totalBorc - totalAlacak;

    return {
      title: 'Firma Cari Hesaplar Listesi & Genel Bakiye Durumu',
      subtitle: `Toplam Firma: ${filteredFirmalar.length} adet | Rapor Tarihi: ${getTodayDateString()}`,
      filename: `Firmalar_Listesi_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Firmalara Toplam Borcumuz', value: formatCurrency(totalBorc) },
        { label: 'Firmalardan Toplam Alacağımız', value: formatCurrency(totalAlacak) },
        { label: 'Genel Net Bakiye', value: `${formatCurrency(Math.abs(netGenel))} (${netGenel > 0 ? 'Borçluyuz' : netGenel < 0 ? 'Alacaklıyız' : 'Dengede'})` },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Alış Faturaları (Borçlandığımız) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Alış Faturaları (Gelen)
            </span>
            <div className="text-xl font-bold text-rose-600 mt-1 font-mono">
              {formatCurrency(statsBreakdown.alisFaturaToplami)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tedarikçi Borcumuz</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Satış Faturaları (Müşteriye/Firmaya Kestiğimiz) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Satış Faturaları (Kesilen)
            </span>
            <div className="text-xl font-bold text-blue-600 mt-1 font-mono">
              {formatCurrency(statsBreakdown.satisFaturaToplami)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Hakediş / Satış Alacağımız</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        {/* Yapılan Ödemeler & Tahsilatlar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Ödeme / Tahsilat
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
              {formatCurrency(statsBreakdown.odemeToplami)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Ödenen: {formatCurrency(statsBreakdown.odemeToplami)} | Tahsilat: {formatCurrency(statsBreakdown.tahsilatToplami)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* Net Kalan Cari Bakiye */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Net Kalan Cari Bakiye</span>
            <div className={`text-xl font-bold mt-1 font-mono ${
              netCariBakiye > 0 ? 'text-rose-600' : netCariBakiye < 0 ? 'text-blue-600' : 'text-emerald-600'
            }`}>
              {formatCurrency(Math.abs(netCariBakiye))}
            </div>
            <div className="text-[11px] font-semibold mt-0.5">
              {netCariBakiye > 0 ? (
                <span className="text-rose-600">Firmaya Borçluyuz</span>
              ) : netCariBakiye < 0 ? (
                <span className="text-blue-600">Firmadan Alacaklıyız</span>
              ) : (
                <span className="text-emerald-600">Bakiye Sıfır (Kapalı)</span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation: Cari Hareketler vs Firmalar Listesi */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('cari')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'cari'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>Cari Hareketler & Faturalar (Tablo 11)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700">
              {cariList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('firmalar')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'firmalar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Firmalar & Tedarikçiler (Tablo 10)</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-100 text-slate-700">
              {firmalar.length}
            </span>
          </button>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          {onOpenCurrencies && (
            <button
              type="button"
              onClick={onOpenCurrencies}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors shadow-2xs"
              title="Günlük Döviz Kurlarını Güncelle & Yeni Para Birimi Tanımla"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Döviz Kurları</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenNewFirmaModal('tedarikci')}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>+ Tedarikçi</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenNewFirmaModal('musteri')}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>+ Müşteri</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenNewFirmaModal('taseron')}
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>+ Taşeron</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenNewFirmaModal('tedarikci')}
            className="sm:hidden px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
          >
            <Building2 className="w-4 h-4 text-slate-600" />
            <span>Firma Ekle</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenExcelImport(activeSubTab === 'firmalar' ? 'firmalar_only' : 'combined')}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors shadow-2xs"
            title="Excel dosyasından firma kartlarını veya cari hareketleri topluca içeri aktarın"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel'den Aktar</span>
          </button>
          
          <button
            type="button"
            onClick={() => handleOpenAddCariModal(selectedFirmaId !== 'all' ? selectedFirmaId : undefined, 'alis_faturasi')}
            disabled={firmalar.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Cari Hareket / Fatura Ekle</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: CARİ HAREKETLER & FATURALAR (TABLO 11)                         */}
      {/* ========================================================================= */}
      {activeSubTab === 'cari' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Firma Seçimi */}
              <div className="w-full sm:w-64">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Firma Filtrele
                </label>
                <select
                  value={selectedFirmaId}
                  onChange={(e) => setSelectedFirmaId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="all">Tüm Firmalar ({firmalar.length})</option>
                  <optgroup label="Tedarikçiler">
                    {firmalar.filter((f) => (f.tur || 'tedarikci') === 'tedarikci').map((f) => (
                      <option key={f.id} value={f.id}>
                        📦 [Tedarikçi] {f.isim}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Müşteriler">
                    {firmalar.filter((f) => f.tur === 'musteri').map((f) => (
                      <option key={f.id} value={f.id}>
                        👥 [Müşteri] {f.isim}
                      </option>
                    ))}
                  </optgroup>
                  {firmalar.some((f) => f.tur === 'taseron') && (
                    <optgroup label="Taşeronlar">
                      {firmalar.filter((f) => f.tur === 'taseron').map((f) => (
                        <option key={f.id} value={f.id}>
                          🔨 [Taşeron] {f.isim}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {firmalar.some((f) => f.tur === 'diger') && (
                    <optgroup label="Diğer">
                      {firmalar.filter((f) => f.tur === 'diger').map((f) => (
                        <option key={f.id} value={f.id}>
                          🏢 [Diğer] {f.isim}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Hareket Türü Filtresi (Alış Faturası, Satış Faturası, Ödeme, Tahsilat) */}
              <div className="w-full sm:w-52">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  İşlem / Fatura Türü
                </label>
                <select
                  value={cariTurFilter}
                  onChange={(e) => setCariTurFilter(e.target.value as 'all' | CariIslemTuru)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="all">Tüm İşlemler</option>
                  <option value="alis_faturasi">Alış Faturaları (Gelen)</option>
                  <option value="satis_faturasi">Satış Faturaları (Kesilen)</option>
                  <option value="odeme">Yapılan Ödemeler</option>
                  <option value="tahsilat">Alınan Tahsilatlar</option>
                </select>
              </div>

              {/* Para Birimi Filtresi */}
              <div className="w-full sm:w-44">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Para Birimi
                </label>
                <select
                  value={cariParaBirimiFilter}
                  onChange={(e) => setCariParaBirimiFilter(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                >
                  <option value="all">Tüm Para Birimleri</option>
                  <option value="TRY">₺ Türk Lirası (TRY)</option>
                  <option value="USD">$ Amerikan Doları (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                  <option value="GBP">£ İngiliz Sterlini (GBP)</option>
                </select>
              </div>

              {/* Arama */}
              <div className="w-full sm:w-64">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Fatura / Açıklama Ara
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cariSearchQuery}
                    onChange={(e) => setCariSearchQuery(e.target.value)}
                    placeholder="Evrak no veya açıklama..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                  {cariSearchQuery && (
                    <button
                      onClick={() => setCariSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {selectedFirmaId !== 'all' && activeFirmaObj && (
              <div className="flex items-center gap-2 self-end lg:self-center">
                <span className="text-xs text-slate-500">Seçili Firma:</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  {activeFirmaObj.isim}
                </span>
                <button
                  onClick={() => setSelectedFirmaId('all')}
                  className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Filtreyi Temizle
                </button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SEÇİLİ FİRMA DÖVİZ BORÇ & ALACAK SEPETLERİ (PARA BİRİMİ BAZLI AYRIM)     */}
          {/* ========================================================================= */}
          {selectedFirmaId !== 'all' && activeFirmaObj && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <h4 className="text-base font-bold text-white">
                      {activeFirmaObj.isim} — Para Birimi Borç & Alacak Sepetleri
                    </h4>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-1">
                    Dövizli faturalar kendi para birimi sepetinde ayrı tutulur. TL veya döviz ödemelerinizde belirlediğiniz kur üzerinden seçtiğiniz sepet borcundan düşülür.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenAddCariModal(selectedFirmaId, 'odeme')}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4 text-slate-950" />
                    <span>Ödeme Yap / Borçtan Düş</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddCariModal(selectedFirmaId, 'alis_faturasi')}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-400" />
                    <span>+ Fatura Ekle</span>
                  </button>
                </div>
              </div>

              {/* Sepet Kartları */}
              {(() => {
                const st = companyStats[selectedFirmaId];
                const activeCurrs = st ? st.activeCurrencies : [];
                // Include TRY if not already present so user always sees the TL basket
                const displayCurrs = Array.from(new Set(['TRY', ...activeCurrs]));

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {displayCurrs.map((curr) => {
                      const basket = st?.baskets[curr] || { borc: 0, alacak: 0, bakiye: 0 };
                      const isForeign = curr !== 'TRY';
                      const approxTRY = isForeign
                        ? convertCurrencyToTRY(Math.abs(basket.bakiye), curr, exchangeRates.rates)
                        : Math.abs(basket.bakiye);
                      const currentRate = isForeign ? getCurrencyExchangeRate(curr, exchangeRates.rates) : 1;

                      return (
                        <div
                          key={curr}
                          className={`p-3.5 rounded-xl border transition-all ${
                            basket.bakiye > 0
                              ? 'bg-rose-950/40 border-rose-800/60'
                              : basket.bakiye < 0
                              ? 'bg-blue-950/40 border-blue-800/60'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <span>{getCurrencySymbol(curr)}</span>
                              <span>{curr} Sepeti</span>
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              basket.bakiye > 0
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : basket.bakiye < 0
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}>
                              {basket.bakiye > 0 ? 'Borçluyuz' : basket.bakiye < 0 ? 'Alacaklıyız' : 'Kapalı'}
                            </span>
                          </div>

                          <div className="mt-2 font-mono text-lg font-black text-white">
                            {formatCurrency(Math.abs(basket.bakiye), curr)}
                          </div>

                          <div className="text-[11px] text-slate-300 mt-1 flex items-center justify-between font-mono">
                            <span>Faturalar: {formatCurrency(basket.borc, curr)}</span>
                            <span>Ödenen: {formatCurrency(basket.alacak, curr)}</span>
                          </div>

                          {isForeign && (
                            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-amber-300/90 font-mono">
                              <span>≈ {formatCurrency(approxTRY, 'TRY')}</span>
                              <span className="text-[10px] text-slate-400">Kur: {currentRate} ₺</span>
                            </div>
                          )}

                          {basket.bakiye > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenAddCariModal(selectedFirmaId, 'odeme', curr)}
                              className="mt-2.5 w-full py-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>💳 {curr} Borcundan Düş</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Main Ledger Table (Tablo 11) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Veritabanı Tablosu 11: Firma Cari Hesap Hareketleri</span>
                  <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-xs font-bold font-mono">
                    {filteredCari.length} Hareket
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Alış faturaları, satış faturaları, yapılan ödemeler ve tahsilat hareketleri tam satır dökümü.
                </p>
              </div>

              {/* Dışa Aktar Seçenekleri (Yazdır, PDF, Excel) */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => printReport(getLedgerExportOptions())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer transition-colors"
                  title="Cari Hesap Hareketlerini Yazıcıya Gönder / Çıktı Al"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Yazdır</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToPDF(getLedgerExportOptions())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 shadow-2xs cursor-pointer transition-colors"
                  title="Cari Hesap Hareketlerini PDF Olarak İndir"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToExcel(getLedgerExportOptions())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 shadow-2xs cursor-pointer transition-colors"
                  title="Cari Hesap Hareketlerini Excel (.xlsx) Tablosu Olarak İndir"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel</span>
                </button>

                <ExportButton
                  options={getLedgerExportOptions}
                  buttonText="Dışa Aktar"
                  variant="secondary"
                />

                <button
                  type="button"
                  onClick={() => handleOpenExcelImport('cari_only')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-2xs cursor-pointer transition-colors"
                  title="Excel dosyasından cari hareketleri ve faturaları içeri aktarın"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Excel'den Yükle</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs sm:text-sm min-w-full">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Tarih & Saat</th>
                    <th className="px-4 py-3 min-w-[180px]">Firma Adı</th>
                    <th className="px-4 py-3 whitespace-nowrap">İşlem / Fatura Türü</th>
                    <th className="px-4 py-3 whitespace-nowrap">Fatura / Evrak No</th>
                    <th className="px-4 py-3 min-w-[200px]">Açıklama</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Borç (Bizim Borcumuz)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Alacak (Bizim Alacağımız)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCari.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        Kayıtlı cari hareket veya fatura bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredCari.map((c) => {
                      const firm = firmalar.find((f) => f.id === c.firmaId);
                      const classification = getIslemClassification(c);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                            {c.tarih} {c.saat}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{firm ? firm.isim : 'Bilinmeyen Firma'}</span>
                              {firm && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${getFirmaTurInfo(firm.tur).badgeClass}`}>
                                  <span>{getFirmaTurInfo(firm.tur).icon}</span>
                                  <span>{getFirmaTurInfo(firm.tur).label}</span>
                                </span>
                              )}
                            </div>
                            {firm?.vergiNo && (
                              <span className="text-[10px] text-slate-400 font-mono">VN: {firm.vergiNo}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${classification.badgeClass}`}>
                              {classification.tur === 'alis_faturasi' && <ArrowDownLeft className="w-3 h-3 text-rose-600" />}
                              {classification.tur === 'satis_faturasi' && <FileSpreadsheet className="w-3 h-3 text-blue-600" />}
                              {classification.tur === 'odeme' && <ArrowUpRight className="w-3 h-3 text-emerald-600" />}
                              {classification.tur === 'tahsilat' && <ArrowDownLeft className="w-3 h-3 text-purple-600" />}
                              <span>{classification.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {(c.cekId || c.faturaNo?.toLowerCase().includes('çek') || c.faturaNo?.toLowerCase().includes('ck-')) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200" title="Çek İşlemi">
                                  🏦 Çek
                                </span>
                              )}
                              <span>{c.faturaNo || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 min-w-[200px]">
                            <div>{c.aciklama || '-'}</div>
                            {(() => {
                              const linkedSite = santiyeler.find(
                                (s) =>
                                  (c.santiyeId && s.id === c.santiyeId) ||
                                  (c.santiyeAdi && s.isim.trim().toLowerCase() === c.santiyeAdi.trim().toLowerCase())
                              );
                              const siteName = linkedSite?.isim || c.santiyeAdi;
                              if (!siteName) return null;
                              const isTasExpense = Boolean(
                                c.giderId ||
                                c.kartHarcamaId ||
                                c.odemeId ||
                                (firm?.tur === 'taseron' && (c.islemTuru === 'odeme' || (c.alacak || 0) > 0))
                              );
                              return (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold">
                                    <span>🏗️ {siteName}</span>
                                  </span>
                                  {isTasExpense ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                                      📉 Şantiye Gideri
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                                      📈 Şantiye Geliri
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono whitespace-nowrap">
                            {c.borc > 0 ? (
                              <div className="flex flex-col items-end">
                                <div className="flex items-center justify-end gap-1">
                                  <span>{formatCurrency(c.borc, c.paraBirimi)}</span>
                                  {c.paraBirimi && c.paraBirimi !== 'TRY' && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-bold">
                                      {c.paraBirimi}
                                    </span>
                                  )}
                                </div>
                                {c.islemTuru === 'tahsilat' && c.hedefParaBirimi && c.hedefParaBirimi !== (c.paraBirimi || 'TRY') ? (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-semibold">
                                    <span>🎯 {c.hedefParaBirimi} Alacağından: -{formatCurrency(c.hedefDusulenTutar || 0, c.hedefParaBirimi)}</span>
                                    <span className="text-purple-600 font-mono">({c.hedefKur} kur)</span>
                                  </div>
                                ) : c.paraBirimi && c.paraBirimi !== 'TRY' ? (
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    ≈ {formatCurrency(c.tlKarsiligi || convertCurrencyToTRY(c.borc, c.paraBirimi, exchangeRates.rates))} (Kur: {c.dovizKuru || getCurrencyExchangeRate(c.paraBirimi, exchangeRates.rates)})
                                  </div>
                                ) : null}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono whitespace-nowrap">
                            {c.alacak > 0 ? (
                              <div className="flex flex-col items-end">
                                <div className="flex items-center justify-end gap-1">
                                  <span>{formatCurrency(c.alacak, c.paraBirimi)}</span>
                                  {c.paraBirimi && c.paraBirimi !== 'TRY' && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-bold">
                                      {c.paraBirimi}
                                    </span>
                                  )}
                                </div>
                                {/* Target debt deduction badge (sadece ödemelerde gösterilir, faturalarda gösterilmez) */}
                                {c.islemTuru === 'odeme' && c.hedefParaBirimi && c.hedefParaBirimi !== (c.paraBirimi || 'TRY') ? (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">
                                    <span>🎯 {c.hedefParaBirimi} Borcundan: -{formatCurrency(c.hedefDusulenTutar || 0, c.hedefParaBirimi)}</span>
                                    <span className="text-amber-600 font-mono">({c.hedefKur} kur)</span>
                                  </div>
                                ) : c.paraBirimi && c.paraBirimi !== 'TRY' ? (
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    ≈ {formatCurrency(c.tlKarsiligi || convertCurrencyToTRY(c.alacak, c.paraBirimi, exchangeRates.rates))} (Kur: {c.dovizKuru || getCurrencyExchangeRate(c.paraBirimi, exchangeRates.rates)})
                                  </div>
                                ) : null}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditCari(c)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Cari Hareketi Düzenle"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingCari(c)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Cari Hareketi Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: FİRMALAR & TEDARİKÇİLER LİSTESİ (TABLO 10)                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'firmalar' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Search & Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            {/* Upper row: Category Filter Tabs & Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFirmaTurFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    firmaTurFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tümü</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200/70 text-slate-700">
                    {firmaCounts.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFirmaTurFilter('tedarikci')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    firmaTurFilter === 'tedarikci'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <span>📦</span>
                  <span>Tedarikçiler</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    firmaTurFilter === 'tedarikci' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {firmaCounts.tedarikci}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFirmaTurFilter('musteri')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    firmaTurFilter === 'musteri'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  <span>👥</span>
                  <span>Müşteriler</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    firmaTurFilter === 'musteri' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {firmaCounts.musteri}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFirmaTurFilter('taseron')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    firmaTurFilter === 'taseron'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-purple-900 hover:bg-purple-50'
                  }`}
                >
                  <span>🔨</span>
                  <span>Taşeronlar</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    firmaTurFilter === 'taseron' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-900'
                  }`}>
                    {firmaCounts.taseron}
                  </span>
                </button>
              </div>

              {/* Action Buttons to quickly create Tedarikçi vs Müşteri vs Taşeron */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenNewFirmaModal('tedarikci')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Yeni Tedarikçi Firma Tanımla (Örn: YILDIRIMLAR BİLGİSAYAR)"
                >
                  <Package className="w-4 h-4" />
                  <span>+ Tedarikçi Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenNewFirmaModal('musteri')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Yeni Müşteri Firma Tanımla (Örn: Gülmete Turizm İnş.)"
                >
                  <Users className="w-4 h-4" />
                  <span>+ Müşteri Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenNewFirmaModal('taseron')}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Yeni Taşeron Firma Tanımla (Örn: Adelsan İnşaat Ltd.) - Taşeronlar Bölümüne de Eklenir"
                >
                  <Layers className="w-4 h-4" />
                  <span>+ Taşeron Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenNewFirmaModal('diger')}
                  className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  <span className="hidden md:inline">Diğer Firma</span>
                </button>

                <ExportButton
                  options={getCompaniesExportOptions}
                  buttonText="Firmaları Dışa Aktar"
                  variant="secondary"
                />

                <button
                  type="button"
                  onClick={() => handleOpenExcelImport('firmalar_only')}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Excel dosyasından firma kartlarını toplu içe aktarın"
                >
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Excel'den Yükle</span>
                </button>
              </div>
            </div>

            {/* Lower row: Search input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={firmaSearchQuery}
                onChange={(e) => setFirmaSearchQuery(e.target.value)}
                placeholder="Firma ünvanı, tedarikçi, müşteri, vergi no veya yetkili ara..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800"
              />
              {firmaSearchQuery && (
                <button
                  onClick={() => setFirmaSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Companies Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Veritabanı Tablosu 10: Firma, Tedarikçi ve Müşteri Rehberi</span>
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-bold font-mono">
                    {filteredFirmalar.length} Firma
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tedarikçiler (satıcılar), müşteriler (alıcılar) ve taşeron firmaların iletişim, vergi ve cari hesap bakiyesi.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="px-4 py-3">Firma Ünvanı & Türü</th>
                    <th className="px-4 py-3">Yetkili Kişi</th>
                    <th className="px-4 py-3">İletişim</th>
                    <th className="px-4 py-3">Vergi No & Adres</th>
                    <th className="px-4 py-3 text-right">Toplam Borç (Alış)</th>
                    <th className="px-4 py-3 text-right">Toplam Alacak (Satış/Ödeme)</th>
                    <th className="px-4 py-3 text-right">Cari Bakiye</th>
                    <th className="px-4 py-3 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFirmalar.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        {firmalar.length === 0 ? (
                          <div className="space-y-3">
                            <p>Henüz tanımlanmış bir tedarikçi veya müşteri bulunmuyor.</p>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenNewFirmaModal('tedarikci')}
                                className="px-4 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors cursor-pointer"
                              >
                                📦 Tedarikçi Tanımla
                              </button>
                              <button
                                onClick={() => handleOpenNewFirmaModal('musteri')}
                                className="px-4 py-2 text-xs font-bold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors cursor-pointer"
                              >
                                👥 Müşteri Tanımla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p>Filtreye veya arama kriterine uygun firma bulunamadı.</p>
                            {(firmaTurFilter !== 'all' || firmaSearchQuery) && (
                              <button
                                onClick={() => {
                                  setFirmaTurFilter('all');
                                  setFirmaSearchQuery('');
                                }}
                                className="text-xs text-indigo-600 hover:underline font-semibold"
                              >
                                Filtreyi Sıfırla
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredFirmalar.map((f) => {
                      const stats = companyStats[f.id] || { totalBorc: 0, totalAlacak: 0, count: 0 };
                      const balance = stats.totalBorc - stats.totalAlacak;
                      const turInfo = getFirmaTurInfo(f.tur);

                      return (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border ${
                                f.tur === 'musteri'
                                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                  : f.tur === 'taseron'
                                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}>
                                {turInfo.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{f.isim}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${turInfo.badgeClass}`}>
                                    <span>{turInfo.icon}</span>
                                    <span>{turInfo.label}</span>
                                  </span>
                                  {f.tur === 'taseron' && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      <span>🔨</span>
                                      <span>Taşeronlar Tablosunda Aktif</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>{turInfo.desc}</span>
                                  {f.uzmanlik && (
                                    <>
                                      <span>•</span>
                                      <span className="text-purple-700 font-medium bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-[10px]">
                                        İş Kolu: {f.uzmanlik}
                                      </span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">
                                    {stats.count} Hareket
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium">
                            {f.ilgili || '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="space-y-0.5 text-xs">
                              {f.telefon ? (
                                <a
                                  href={`tel:${f.telefon}`}
                                  className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 font-mono"
                                >
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{f.telefon}</span>
                                </a>
                              ) : null}
                              {f.email ? (
                                <a
                                  href={`mailto:${f.email}`}
                                  className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-[11px]"
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{f.email}</span>
                                </a>
                              ) : null}
                              {!f.telefon && !f.email && <span className="text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs">
                            <div className="text-xs">
                              {(f.vergiDairesi || f.vergiNo) && (
                                <div className="text-slate-800">
                                  {f.vergiDairesi && (
                                    <span className="text-[11px] font-semibold text-slate-700 block">
                                      {f.vergiDairesi}
                                    </span>
                                  )}
                                  {f.vergiNo && (
                                    <span className="font-mono text-slate-800 font-semibold">
                                      VN: {f.vergiNo}
                                    </span>
                                  )}
                                </div>
                              )}
                              {f.adres ? (
                                <div className="text-[11px] text-slate-500 truncate mt-0.5" title={f.adres}>
                                  {f.adres}
                                </div>
                              ) : (
                                !f.vergiNo && !f.vergiDairesi && <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono">
                            {stats.totalBorcTRY > 0 ? formatCurrency(stats.totalBorcTRY) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">
                            {stats.totalAlacakTRY > 0 ? formatCurrency(stats.totalAlacakTRY) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {stats.activeCurrencies.length > 0 ? (
                              <div className="flex flex-col items-end gap-1">
                                {stats.activeCurrencies.map((curr) => {
                                  const b = stats.baskets[curr];
                                  if (!b || Math.abs(b.bakiye) < 0.01) return null;
                                  return (
                                    <div key={curr} className="inline-flex items-center gap-1 text-xs">
                                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                                        b.bakiye > 0 
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}>
                                        {formatCurrency(Math.abs(b.bakiye), curr)} {b.bakiye > 0 ? 'Borç' : 'Alacak'}
                                      </span>
                                    </div>
                                  );
                                })}
                                {stats.activeCurrencies.some((c) => c !== 'TRY') && (
                                  <div className="text-[11px] font-bold text-slate-700 mt-0.5 pt-0.5 border-t border-slate-100">
                                    Toplam: {formatCurrency(Math.abs(stats.netBakiyeTRY))} {stats.netBakiyeTRY > 0 ? '(Borç)' : stats.netBakiyeTRY < 0 ? '(Alacak)' : ''}
                                  </div>
                                )}
                                {!stats.activeCurrencies.some((c) => c !== 'TRY') && (
                                  <div className="text-[10px] font-semibold text-slate-400">
                                    {stats.netBakiyeTRY > 0 ? 'Borçluyuz' : stats.netBakiyeTRY < 0 ? 'Alacaklıyız' : 'Kapalı'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className={`font-black ${
                                  stats.netBakiyeTRY > 0 ? 'text-rose-600' : stats.netBakiyeTRY < 0 ? 'text-blue-600' : 'text-slate-500'
                                }`}>
                                  {formatCurrency(Math.abs(stats.netBakiyeTRY))}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400">
                                  {stats.netBakiyeTRY > 0 ? 'Borçluyuz' : stats.netBakiyeTRY < 0 ? 'Alacaklıyız' : 'Kapalı'}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick Ödeme Yap / Borçtan Düş */}
                              <button
                                onClick={() => handleOpenAddCariModal(f.id, 'odeme')}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Bu Firmaya Ödeme Yap / Borçtan Düş"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                              {/* Cari döküme git */}
                              <button
                                onClick={() => {
                                  setSelectedFirmaId(f.id);
                                  setActiveSubTab('cari');
                                }}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Bu Firmanın Cari Hareketlerini Gör"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              {/* Firma Düzenle */}
                              <button
                                onClick={() => handleOpenEditFirma(f)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Firma Bilgilerini Düzenle"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {/* Firma Sil */}
                              <button
                                onClick={() => setDeletingFirma(f)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Firmayı Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* MODAL: YENİ FİRMA TANIMLA (TEDARİKÇİ & MÜŞTERİ AYRIMI)                     */}
      {/* ========================================================================= */}
      {isFirmaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  firmaForm.tur === 'musteri'
                    ? 'bg-blue-100 text-blue-700'
                    : firmaForm.tur === 'taseron'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {getFirmaTurInfo(firmaForm.tur).icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Yeni {getFirmaTurInfo(firmaForm.tur).label} Tanımla
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {getFirmaTurInfo(firmaForm.tur).desc}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFirmaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFirma} className="p-6 space-y-4 overflow-y-auto">
              {/* 1. Firma Türü Seçimi (Tedarikçi vs Müşteri vs Taşeron vs Diğer) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Firma Rolü / Türü <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Tedarikçi */}
                  <button
                    type="button"
                    onClick={() => setFirmaForm({ ...firmaForm, tur: 'tedarikci' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      (firmaForm.tur || 'tedarikci') === 'tedarikci'
                        ? 'bg-amber-50/80 border-amber-400 text-amber-950 ring-2 ring-amber-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">📦</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Tedarikçi Firma</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Malzeme / bilişim / hizmet satıcısı
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold block mt-1">
                        Örn: YILDIRIMLAR BİLGİSAYAR
                      </span>
                    </div>
                  </button>

                  {/* Müşteri */}
                  <button
                    type="button"
                    onClick={() => setFirmaForm({ ...firmaForm, tur: 'musteri' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      firmaForm.tur === 'musteri'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-950 ring-2 ring-blue-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">👥</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Müşteri Firma</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Hakediş / satış yaptığımız işveren
                      </span>
                      <span className="text-[10px] text-blue-700 font-semibold block mt-1">
                        Örn: Gülmete Turizm İnş.
                      </span>
                    </div>
                  </button>

                  {/* Taşeron */}
                  <button
                    type="button"
                    onClick={() => setFirmaForm({ ...firmaForm, tur: 'taseron' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      firmaForm.tur === 'taseron'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-950 ring-2 ring-purple-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">🔨</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Taşeron Firma</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Şantiye alt yüklenicisi / kalıp-demir
                      </span>
                      <span className="text-[10px] text-purple-700 font-semibold block mt-1">
                        Örn: Adelsan İnşaat Ltd.
                      </span>
                    </div>
                  </button>

                  {/* Diğer */}
                  <button
                    type="button"
                    onClick={() => setFirmaForm({ ...firmaForm, tur: 'diger' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      firmaForm.tur === 'diger'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">🏢</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Diğer Cari</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Resmi kurum / danışmanlık / genel
                      </span>
                      <span className="text-[10px] text-slate-600 font-semibold block mt-1">
                        Örn: Yapı Denetim A.Ş.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Firma Ünvanı */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {firmaForm.tur === 'musteri'
                    ? 'Müşteri Firma Ünvanı'
                    : firmaForm.tur === 'taseron'
                    ? 'Taşeron Firma Ünvanı'
                    : 'Tedarikçi / Firma Ünvanı'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    firmaForm.tur === 'musteri'
                      ? 'Örn: Gülmete Turizm İnş.'
                      : firmaForm.tur === 'taseron'
                      ? 'Örn: Adelsan İnşaat Ltd.'
                      : 'Örn: YILDIRIMLAR BİLGİSAYAR'
                  }
                  value={firmaForm.isim || ''}
                  onChange={(e) => setFirmaForm({ ...firmaForm, isim: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Taşeron Entegrasyon ve Uzmanlık Alanı */}
              {firmaForm.tur === 'taseron' && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-purple-900 font-bold">
                    <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Taşeronlar Bölümü ile 1:1 Entegre</span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Bu taşeron kaydedildiğinde <b>Taşeronlar (Tablo 6)</b> tablosuna otomatik olarak işlenecek ve personel puantajında taşeron firma olarak seçilebilecektir.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Uzmanlık Alanı / İş Kolu
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Ahşap İşleri"
                      value={firmaForm.uzmanlik || ''}
                      onChange={(e) => setFirmaForm({ ...firmaForm, uzmanlik: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Kadıköy V.D."
                    value={firmaForm.vergiDairesi || ''}
                    onChange={(e) => setFirmaForm({ ...firmaForm, vergiDairesi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Numarası / TCKN
                  </label>
                  <input
                    type="text"
                    placeholder="10 veya 11 haneli"
                    value={firmaForm.vergiNo || ''}
                    onChange={(e) => setFirmaForm({ ...firmaForm, vergiNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Yetkili / İlgili Kişi
                </label>
                <input
                  type="text"
                  placeholder="Örn: Selim Bey"
                  value={firmaForm.ilgili || ''}
                  onChange={(e) => setFirmaForm({ ...firmaForm, ilgili: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    placeholder="0216 123 45 67"
                    value={firmaForm.telefon || ''}
                    onChange={(e) => setFirmaForm({ ...firmaForm, telefon: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-Posta</label>
                  <input
                    type="email"
                    placeholder="muhasebe@firma.com"
                    value={firmaForm.email || ''}
                    onChange={(e) => setFirmaForm({ ...firmaForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adres</label>
                <textarea
                  rows={2}
                  placeholder="Firma resmi tebligat adresi"
                  value={firmaForm.adres || ''}
                  onChange={(e) => setFirmaForm({ ...firmaForm, adres: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFirmaModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-sm font-semibold text-white rounded-xl cursor-pointer transition-colors ${
                    firmaForm.tur === 'musteri'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : firmaForm.tur === 'taseron'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {getFirmaTurInfo(firmaForm.tur).label} Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FİRMA BİLGİLERİNİ DÜZENLE                                          */}
      {/* ========================================================================= */}
      {editingFirma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  editingFirma.tur === 'musteri'
                    ? 'bg-blue-100 text-blue-700'
                    : editingFirma.tur === 'taseron'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {getFirmaTurInfo(editingFirma.tur).icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Firma Bilgilerini Düzenle</h3>
                  <p className="text-[11px] text-slate-500">
                    Mevcut Tür: <span className="font-semibold text-slate-800">{getFirmaTurInfo(editingFirma.tur).label}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingFirma(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditFirma} className="p-6 space-y-4 overflow-y-auto">
              {/* Firma Türü Seçimi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Firma Rolü / Türü <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Tedarikçi */}
                  <button
                    type="button"
                    onClick={() => setEditingFirma({ ...editingFirma, tur: 'tedarikci' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      (editingFirma.tur || 'tedarikci') === 'tedarikci'
                        ? 'bg-amber-50/80 border-amber-400 text-amber-950 ring-2 ring-amber-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">📦</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Tedarikçi</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Malzeme / bilişim satıcısı
                      </span>
                    </div>
                  </button>

                  {/* Müşteri */}
                  <button
                    type="button"
                    onClick={() => setEditingFirma({ ...editingFirma, tur: 'musteri' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      editingFirma.tur === 'musteri'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-950 ring-2 ring-blue-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">👥</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Müşteri</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        İşveren / hakediş alıcısı
                      </span>
                    </div>
                  </button>

                  {/* Taşeron */}
                  <button
                    type="button"
                    onClick={() => setEditingFirma({ ...editingFirma, tur: 'taseron' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      editingFirma.tur === 'taseron'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-950 ring-2 ring-purple-300/60'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">🔨</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Taşeron</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Şantiye alt yüklenicisi
                      </span>
                    </div>
                  </button>

                  {/* Diğer */}
                  <button
                    type="button"
                    onClick={() => setEditingFirma({ ...editingFirma, tur: 'diger' })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      editingFirma.tur === 'diger'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-slate-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">🏢</span>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        <span>Diğer Cari</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Resmi kurum / genel
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firma / Müşteri Ünvanı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingFirma.isim}
                  onChange={(e) => setEditingFirma({ ...editingFirma, isim: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Taşeron Entegrasyon ve Uzmanlık Alanı */}
              {editingFirma.tur === 'taseron' && (
                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-purple-900 font-bold">
                    <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Taşeronlar Bölümü ile 1:1 Entegre</span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Değişiklikler <b>Taşeronlar (Tablo 6)</b> tablosuna ve bu taşerona bağlı personellere anında yansıtılacaktır.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Uzmanlık Alanı / İş Kolu
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Ahşap İşleri"
                      value={editingFirma.uzmanlik || ''}
                      onChange={(e) => setEditingFirma({ ...editingFirma, uzmanlik: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Kadıköy V.D."
                    value={editingFirma.vergiDairesi || ''}
                    onChange={(e) => setEditingFirma({ ...editingFirma, vergiDairesi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Numarası / TCKN
                  </label>
                  <input
                    type="text"
                    placeholder="10 veya 11 haneli"
                    value={editingFirma.vergiNo || ''}
                    onChange={(e) => setEditingFirma({ ...editingFirma, vergiNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Yetkili / İlgili Kişi
                </label>
                <input
                  type="text"
                  placeholder="Örn: Selim Bey"
                  value={editingFirma.ilgili || ''}
                  onChange={(e) => setEditingFirma({ ...editingFirma, ilgili: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={editingFirma.telefon || ''}
                    onChange={(e) => setEditingFirma({ ...editingFirma, telefon: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-Posta</label>
                  <input
                    type="email"
                    value={editingFirma.email || ''}
                    onChange={(e) => setEditingFirma({ ...editingFirma, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adres</label>
                <textarea
                  rows={2}
                  value={editingFirma.adres || ''}
                  onChange={(e) => setEditingFirma({ ...editingFirma, adres: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFirma(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-xs"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FİRMA SİLME ONAY MODALI                                            */}
      {/* ========================================================================= */}
      {deletingFirma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Firmayı Sil</h3>
              <p className="text-sm text-slate-600 mb-3">
                <strong className="text-slate-900">{deletingFirma.isim}</strong> firmasını sistemden silmek istediğinize emin misiniz?
              </p>

              {(() => {
                const count = cariList.filter((c) => c.firmaId === deletingFirma.id).length;
                return count > 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs text-left mb-5">
                    <strong>Dikkat:</strong> Bu firmaya ait <b>{count} adet</b> cari hesap ve fatura hareketi bulunmaktadır.
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-5">Bu işlem geri alınamaz.</p>
                );
              })()}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingFirma(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmDeleteFirma}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Evet, Firmayı Sil</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: YENİ CARİ HAREKET / FATURA EKLE                                    */}
      {/* ========================================================================= */}
      {isCariModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Yeni Cari Hareket / Fatura Ekle</h3>
              </div>
              <button
                onClick={() => setIsCariModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCari} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firma / Müşteri Seçiniz <span className="text-rose-500">*</span>
                </label>
                <select
                  value={cariForm.firmaId}
                  onChange={(e) => {
                    const newFirmaId = e.target.value;
                    const selectedF = firmalar.find((f) => f.id === newFirmaId);
                    // Smart helper: If user picked a 'musteri' and current type is 'alis_faturasi', suggest switching to 'satis_faturasi'
                    if (selectedF?.tur === 'musteri' && cariForm.tur === 'alis_faturasi') {
                      setCariForm({ ...cariForm, firmaId: newFirmaId, tur: 'satis_faturasi' });
                    } else if (selectedF?.tur === 'tedarikci' && cariForm.tur === 'satis_faturasi') {
                      setCariForm({ ...cariForm, firmaId: newFirmaId, tur: 'alis_faturasi' });
                    } else {
                      setCariForm({ ...cariForm, firmaId: newFirmaId });
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  required
                >
                  <optgroup label="📦 Tedarikçi Firmalar (Satıcılar)">
                    {firmalar.filter((f) => (f.tur || 'tedarikci') === 'tedarikci').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="👥 Müşteri Firmalar (Alıcı / İşveren)">
                    {firmalar.filter((f) => f.tur === 'musteri').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🔨 Taşeron Firmalar (Alt Yükleniciler)">
                    {firmalar.filter((f) => f.tur === 'taseron').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🏢 Diğer Cariler">
                    {firmalar.filter((f) => f.tur === 'diger').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {/* Selected company role badge */}
                {(() => {
                  const selectedF = firmalar.find((f) => f.id === cariForm.firmaId);
                  if (!selectedF) return null;
                  const turInfo = getFirmaTurInfo(selectedF.tur);
                  return (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${turInfo.badgeClass}`}>
                        <span>{turInfo.icon}</span>
                        <span>{turInfo.label}</span>
                      </span>
                      <span className="text-slate-500 text-[11px]">{turInfo.desc}</span>
                    </div>
                  );
                })()}
              </div>

              {/* İşlem / Fatura Türü Seçimi (4 Seçenek) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  İşlem & Fatura Türü <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. Alış Faturası */}
                  <button
                    type="button"
                    onClick={() => updateCariFormCrossCalculation({ tur: 'alis_faturasi' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      cariForm.tur === 'alis_faturasi'
                        ? 'bg-rose-50/80 border-rose-400 text-rose-900 ring-2 ring-rose-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ArrowDownLeft className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Alış Faturası</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Malzeme/hizmet alımı (Firmaya Borçlanma)
                    </span>
                  </button>

                  {/* 2. Satış Faturası (Requested by user) */}
                  <button
                    type="button"
                    onClick={() => updateCariFormCrossCalculation({ tur: 'satis_faturasi' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      cariForm.tur === 'satis_faturasi'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 ring-2 ring-blue-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Satış Faturası</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Kesilen fatura/hakediş (Firmadan Alacaklanma)
                    </span>
                  </button>

                  {/* 3. Yapılan Ödeme */}
                  <button
                    type="button"
                    onClick={() => updateCariFormCrossCalculation({ tur: 'odeme' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      cariForm.tur === 'odeme'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-900 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Ödeme Yapıldı</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Firmaya ödeme yapıldı (Borç Kapatma)
                    </span>
                  </button>

                  {/* 4. Tahsilat Alındı */}
                  <button
                    type="button"
                    onClick={() => updateCariFormCrossCalculation({ tur: 'tahsilat' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      cariForm.tur === 'tahsilat'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-900 ring-2 ring-purple-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <FileCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Tahsilat Alındı</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Müşteriden tahsilat yapıldı (Alacak Kapatma)
                    </span>
                  </button>
                </div>

                {/* İlgili Şantiye Seçimi */}
                {santiyeler.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      İlgili Şantiye / Proje (Gelir veya Masraf Dağılımı İçin)
                    </label>
                    <select
                      value={cariForm.santiyeId || ''}
                      onChange={(e) => setCariForm({ ...cariForm, santiyeId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Şantiye Seçilmedi (Genel Cari Hareket) --</option>
                      {santiyeler.map((s) => (
                        <option key={s.id} value={s.id}>
                          🏗️ {s.isim}
                        </option>
                      ))}
                    </select>
                    {cariForm.santiyeId ? (() => {
                      const selectedF = firmalar.find((f) => f.id === cariForm.firmaId);
                      const chosenS = santiyeler.find((s) => s.id === cariForm.santiyeId);
                      const isAlis = cariForm.tur === 'alis_faturasi';
                      const isOdeme = cariForm.tur === 'odeme';
                      const isTahsilat = cariForm.tur === 'tahsilat';

                      if (isOdeme) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                            <span className="text-base">📉</span>
                            <span>
                              <strong>Şantiye Fiili Gideri:</strong> Bu fiili cari ödeme <strong>{chosenS?.isim}</strong> şantiyesinin <strong>masraflarına (fiili nakit çıkışı)</strong> eklenecek ve kârlılık raporlarında şantiye giderlerine yansıtılacaktır.
                            </span>
                          </div>
                        );
                      }
                      if (isAlis) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <span>
                              <strong>Cari Fatura Kaydı:</strong> Bu alış faturası firmanın cari borç hanesine işlenir. Şantiye giderine bu faturaya istinaden <strong>ödeme yapıldıkça</strong> fiili masraf olarak yansıtılır (istenirse kârlılık raporlarında tahakkuk bazlı incelenebilir).
                            </span>
                          </div>
                        );
                      }
                      if (isTahsilat) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                            <span className="text-base">📈</span>
                            <span>
                              <strong>Şantiye Fiili Geliri:</strong> Bu tahsilat <strong>{chosenS?.isim}</strong> şantiyesinin <strong>fiili gelirlerine (nakit girişi)</strong> eklenecek ve kârlılık durumuna yansıtılacaktır.
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
                          <span className="text-base">📑</span>
                          <span>
                            <strong>Cari Satış Faturası:</strong> Bu satış faturası müşterinin cari alacak hanesine işlenir. Şantiye gelirine bu faturaya istinaden <strong>tahsilat yapıldıkça</strong> fiili gelir olarak yansıtılır (istenirse tahakkuk raporlarında incelenebilir).
                          </span>
                        </div>
                      );
                    })() : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Bir şantiye seçtiğinizde; fiili ödemeler şantiye masraflarına, fiili tahsilatlar şantiye gelirlerine işlenir. Faturalar ise cari hesapta borç/alacak olarak takip edilir.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <CurrencySelector
                    value={cariForm.paraBirimi || 'TRY'}
                    onChange={(curr) => updateCariFormCrossCalculation({ paraBirimi: curr })}
                    label="Ödeme / İşlem Para Birimi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tutar ({getCurrencySymbol(cariForm.paraBirimi || 'TRY')}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={cariForm.tutar === 0 ? '' : cariForm.tutar}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = val === '' ? 0 : parseFloat(val) || 0;
                      updateCariFormCrossCalculation({ tutar: num });
                    }}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-300 font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fatura / Dekont No
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: SF-202500042"
                    value={cariForm.faturaNo}
                    onChange={(e) => setCariForm({ ...cariForm, faturaNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* ================= DÖVİZLİ FATURA BİLGİ ALANI ================= */}
              {(cariForm.tur === 'alis_faturasi' || cariForm.tur === 'satis_faturasi') && (cariForm.paraBirimi || 'TRY') !== 'TRY' && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-900">
                        Döviz Kuru ({cariForm.paraBirimi} / TRY)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-600">1 {cariForm.paraBirimi} =</span>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={cariForm.dovizKuru || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCariForm({ ...cariForm, dovizKuru: val });
                        }}
                        className="w-24 px-2 py-1 text-xs font-bold font-mono text-blue-950 bg-white border border-blue-300 rounded-lg"
                      />
                      <span className="text-xs font-mono text-slate-600">₺</span>
                      <button
                        type="button"
                        onClick={() => {
                          const rate = getCurrencyExchangeRate(cariForm.paraBirimi || 'TRY', exchangeRates.rates);
                          setCariForm({ ...cariForm, dovizKuru: rate });
                        }}
                        className="px-2 py-1 text-[10px] font-semibold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md cursor-pointer"
                        title="Güncel sistem kurunu uygula"
                      >
                        Güncel Kuru Al
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-blue-800 flex items-center justify-between pt-1 border-t border-blue-200/60 font-medium">
                    <span>💡 Fatura tutarı firmanın <strong>{cariForm.paraBirimi}</strong> sepetine işlenir.</span>
                    <span className="font-mono font-bold text-blue-950">
                      TL Karşılığı: ≈ {formatCurrency((cariForm.tutar || 0) * (cariForm.dovizKuru || 1), 'TRY')}
                    </span>
                  </div>
                </div>
              )}

              {/* ================= DÖVİZ BORÇ TAHSİS & DÜŞÜM ALANI (USER REQUEST) ================= */}
              {(cariForm.tur === 'odeme' || cariForm.tur === 'tahsilat') && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-300 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🎯</span>
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        {cariForm.tur === 'odeme' ? 'Hangi Borç Sepetinden Düşülecek?' : 'Hangi Alacak Sepetinden Düşülecek?'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      Ayrı Döviz Sepeti Düşümü
                    </span>
                  </div>

                  {/* Sepet Seçim Düğmeleri */}
                  {(() => {
                    const firmSt = cariForm.firmaId ? companyStats[cariForm.firmaId] : undefined;
                    const activeCurrs = firmSt ? firmSt.activeCurrencies : [];
                    const displayCurrs = Array.from(new Set(['TRY', ...activeCurrs]));

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {displayCurrs.map((curr) => {
                          const basket = firmSt?.baskets[curr];
                          const isSelected = (cariForm.hedefParaBirimi || 'TRY') === curr;
                          const bakiyeVal = basket ? basket.bakiye : 0;

                          return (
                            <button
                              key={curr}
                              type="button"
                              onClick={() => updateCariFormCrossCalculation({ hedefParaBirimi: curr })}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-100/90 border-amber-500 text-amber-950 ring-2 ring-amber-300 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span>{getCurrencySymbol(curr)} {curr} Borcu</span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                              </div>
                              <div className="text-[11px] mt-1">
                                {basket ? (
                                  <span className={bakiyeVal > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
                                    Kalan: {formatCurrency(Math.abs(bakiyeVal), curr)} {bakiyeVal > 0 ? 'Borç' : 'Alacak'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sepet Boş (0 {curr})</span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {/* Diğer Tanımlı Dövizler */}
                        <div className="relative">
                          <select
                            value={displayCurrs.includes(cariForm.hedefParaBirimi || 'TRY') ? '' : (cariForm.hedefParaBirimi || '')}
                            onChange={(e) => {
                              if (e.target.value) {
                                updateCariFormCrossCalculation({ hedefParaBirimi: e.target.value });
                              }
                            }}
                            className="w-full h-full min-h-[52px] p-2 text-xs rounded-xl border border-dashed border-amber-300 bg-white font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="">+ Diğer Para Birimi Sepeti...</option>
                            {getSavedCurrencies().filter((c) => !displayCurrs.includes(c.code)).map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.symbol} {c.code} - {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Kur ve Düşüm Hesap Özeti */}
                  {(() => {
                    const payCurr = cariForm.paraBirimi || 'TRY';
                    const targetCurr = cariForm.hedefParaBirimi || payCurr;
                    const isCross = payCurr !== targetCurr;
                    const crossInfo = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates);
                    const firmSt = cariForm.firmaId ? companyStats[cariForm.firmaId] : undefined;
                    const targetBasket = firmSt?.baskets[targetCurr];
                    const currentTargetDebt = targetBasket ? targetBasket.bakiye : 0;
                    const deducted = calculateCrossDeduction(cariForm.tutar || 0, payCurr, targetCurr, cariForm.hedefKur, exchangeRates.rates);
                    const remainingDebt = currentTargetDebt - deducted;

                    if (isCross) {
                      return (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-amber-300 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-800">
                                Çevrim Kuru ({crossInfo.label})
                              </label>
                              <span className="text-[11px] text-slate-500">
                                {payCurr} ödemenizin {targetCurr} borcunuza dönüştürülme kuru
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={cariForm.hedefKur || ''}
                                onChange={(e) => {
                                  const newKur = parseFloat(e.target.value) || 0;
                                  const dec = calculateCrossDeduction(cariForm.tutar || 0, payCurr, targetCurr, newKur, exchangeRates.rates);
                                  setCariForm({
                                    ...cariForm,
                                    hedefKur: newKur,
                                    hedefDusulenTutar: dec,
                                  });
                                }}
                                className="w-28 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-amber-300 text-slate-900 bg-amber-50/50"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const sRate = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates).rate;
                                  const dec = calculateCrossDeduction(cariForm.tutar || 0, payCurr, targetCurr, sRate, exchangeRates.rates);
                                  setCariForm({
                                    ...cariForm,
                                    hedefKur: sRate,
                                    hedefDusulenTutar: dec,
                                  });
                                }}
                                className="px-2 py-1.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                                title="Güncel sistem kurunu uygula"
                              >
                                Güncel Kuru Al
                              </button>
                            </div>
                          </div>

                          <div className="p-2.5 bg-amber-100/70 rounded-lg border border-amber-200/80 text-xs text-amber-950 font-medium space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {formatCurrency(cariForm.tutar || 0, payCurr)} ödeme, {cariForm.hedefKur} kuru üzerinden firmanın {targetCurr} borcundan {formatCurrency(deducted, targetCurr)} olarak düşülecektir.
                              </span>
                            </div>
                            {currentTargetDebt > 0 && (
                              <div className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/60 flex items-center justify-between">
                                <span>Mevcut {targetCurr} Borcu: <strong>{formatCurrency(currentTargetDebt, targetCurr)}</strong></span>
                                <span>➔ İşlem Sonrası Kalan: <strong className={remainingDebt <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatCurrency(Math.abs(remainingDebt), targetCurr)} {remainingDebt > 0 ? 'Borç' : remainingDebt < 0 ? 'Fazla Ödeme' : 'Kapatıldı'}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {formatCurrency(cariForm.tutar || 0, payCurr)} ödeme doğrudan firmanın <strong>{targetCurr}</strong> sepetinden birebir düşülecektir.
                          </span>
                        </div>
                        {currentTargetDebt > 0 && (
                          <span className="text-[11px] text-emerald-800 font-mono font-semibold">
                            Kalan: {formatCurrency(Math.max(0, currentTargetDebt - (cariForm.tutar || 0)), targetCurr)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={cariForm.tarih}
                    onChange={(e) => setCariForm({ ...cariForm, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Saat</label>
                  <input
                    type="time"
                    value={cariForm.saat}
                    onChange={(e) => setCariForm({ ...cariForm, saat: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Kalem Detayı
                </label>
                <input
                  type="text"
                  placeholder={
                    cariForm.tur === 'satis_faturasi'
                      ? 'Örn: 2. Etap Kaba İnşaat Hakediş Faturası'
                      : cariForm.tur === 'alis_faturasi'
                      ? 'Örn: C30 Hazır Beton 80m3 Faturası'
                      : 'İşlem açıklaması...'
                  }
                  value={cariForm.aciklama}
                  onChange={(e) => setCariForm({ ...cariForm, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCariModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Kaydı Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CARİ HAREKET / FATURA DÜZENLE                                      */}
      {/* ========================================================================= */}
      {editingCari && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Cari Hareket / Faturayı Düzenle</h3>
              </div>
              <button
                onClick={() => setEditingCari(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditCari} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firma / Müşteri Seçiniz <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editCariForm.firmaId}
                  onChange={(e) => setEditCariForm({ ...editCariForm, firmaId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  required
                >
                  <optgroup label="📦 Tedarikçi Firmalar (Satıcılar)">
                    {firmalar.filter((f) => (f.tur || 'tedarikci') === 'tedarikci').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="👥 Müşteri Firmalar (Alıcı / İşveren)">
                    {firmalar.filter((f) => f.tur === 'musteri').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🔨 Taşeron Firmalar (Alt Yükleniciler)">
                    {firmalar.filter((f) => f.tur === 'taseron').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🏢 Diğer Cariler">
                    {firmalar.filter((f) => f.tur === 'diger').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.isim} {f.vergiNo ? `(VN: ${f.vergiNo})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {/* Selected company role badge */}
                {(() => {
                  const selectedF = firmalar.find((f) => f.id === editCariForm.firmaId);
                  if (!selectedF) return null;
                  const turInfo = getFirmaTurInfo(selectedF.tur);
                  return (
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${turInfo.badgeClass}`}>
                        <span>{turInfo.icon}</span>
                        <span>{turInfo.label}</span>
                      </span>
                      <span className="text-slate-500 text-[11px]">{turInfo.desc}</span>
                    </div>
                  );
                })()}
              </div>

              {/* İşlem / Fatura Türü Seçimi (4 Seçenek) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  İşlem & Fatura Türü <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. Alış Faturası */}
                  <button
                    type="button"
                    onClick={() => updateEditCariFormCrossCalculation({ tur: 'alis_faturasi' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editCariForm.tur === 'alis_faturasi'
                        ? 'bg-rose-50/80 border-rose-400 text-rose-900 ring-2 ring-rose-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ArrowDownLeft className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Alış Faturası</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Malzeme/hizmet alımı (Firmaya Borçlanma)
                    </span>
                  </button>

                  {/* 2. Satış Faturası */}
                  <button
                    type="button"
                    onClick={() => updateEditCariFormCrossCalculation({ tur: 'satis_faturasi' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editCariForm.tur === 'satis_faturasi'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 ring-2 ring-blue-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Satış Faturası</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Kesilen fatura/hakediş (Firmadan Alacaklanma)
                    </span>
                  </button>

                  {/* 3. Yapılan Ödeme */}
                  <button
                    type="button"
                    onClick={() => updateEditCariFormCrossCalculation({ tur: 'odeme' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editCariForm.tur === 'odeme'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-900 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Ödeme Yapıldı</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Firmaya ödeme yapıldı (Borç Kapatma)
                    </span>
                  </button>

                  {/* 4. Tahsilat Alındı */}
                  <button
                    type="button"
                    onClick={() => updateEditCariFormCrossCalculation({ tur: 'tahsilat' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editCariForm.tur === 'tahsilat'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-900 ring-2 ring-purple-200'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <FileCheck className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Tahsilat Alındı</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">
                      Müşteriden tahsilat yapıldı (Alacak Kapatma)
                    </span>
                  </button>
                </div>

                {/* İlgili Şantiye Seçimi (Düzenleme) */}
                {santiyeler.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      İlgili Şantiye / Proje (Gelir veya Masraf Dağılımı İçin)
                    </label>
                    <select
                      value={editCariForm.santiyeId || ''}
                      onChange={(e) => setEditCariForm({ ...editCariForm, santiyeId: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Şantiye Seçilmedi (Genel Cari Hareket) --</option>
                      {santiyeler.map((s) => (
                        <option key={s.id} value={s.id}>
                          🏗️ {s.isim}
                        </option>
                      ))}
                    </select>
                    {editCariForm.santiyeId ? (() => {
                      const selectedF = firmalar.find((f) => f.id === editCariForm.firmaId);
                      const chosenS = santiyeler.find((s) => s.id === editCariForm.santiyeId);
                      const isAlis = editCariForm.tur === 'alis_faturasi';
                      const isOdeme = editCariForm.tur === 'odeme';
                      const isTahsilat = editCariForm.tur === 'tahsilat';

                      if (isOdeme) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                            <span className="text-base">📉</span>
                            <span>
                              <strong>Şantiye Fiili Gideri:</strong> Bu fiili cari ödeme <strong>{chosenS?.isim}</strong> şantiyesinin <strong>masraflarına (fiili nakit çıkışı)</strong> eklenecek ve kârlılık raporlarında şantiye giderlerine yansıtılacaktır.
                            </span>
                          </div>
                        );
                      }
                      if (isAlis) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-center gap-2">
                            <span className="text-base">📄</span>
                            <span>
                              <strong>Cari Fatura Kaydı:</strong> Bu alış faturası firmanın cari borç hanesine işlenir. Şantiye giderine bu faturaya istinaden <strong>ödeme yapıldıkça</strong> fiili masraf olarak yansıtılır (istenirse kârlılık raporlarında tahakkuk bazlı incelenebilir).
                            </span>
                          </div>
                        );
                      }
                      if (isTahsilat) {
                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                            <span className="text-base">📈</span>
                            <span>
                              <strong>Şantiye Fiili Geliri:</strong> Bu tahsilat <strong>{chosenS?.isim}</strong> şantiyesinin <strong>fiili gelirlerine (nakit girişi)</strong> eklenecek ve kârlılık durumuna yansıtılacaktır.
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center gap-2">
                          <span className="text-base">📑</span>
                          <span>
                            <strong>Cari Satış Faturası:</strong> Bu satış faturası müşterinin cari alacak hanesine işlenir. Şantiye gelirine bu faturaya istinaden <strong>tahsilat yapıldıkça</strong> fiili gelir olarak yansıtılır (istenirse tahakkuk raporlarında incelenebilir).
                          </span>
                        </div>
                      );
                    })() : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Bir şantiye seçtiğinizde; fiili ödemeler şantiye masraflarına, fiili tahsilatlar şantiye gelirlerine işlenir. Faturalar ise cari hesapta borç/alacak olarak takip edilir.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <CurrencySelector
                    value={editCariForm.paraBirimi || 'TRY'}
                    onChange={(curr) => updateEditCariFormCrossCalculation({ paraBirimi: curr })}
                    label="Ödeme / İşlem Para Birimi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tutar ({getCurrencySymbol(editCariForm.paraBirimi || 'TRY')}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={editCariForm.tutar === 0 ? '' : editCariForm.tutar}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = val === '' ? 0 : parseFloat(val) || 0;
                      updateEditCariFormCrossCalculation({ tutar: num });
                    }}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-300 font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fatura / Dekont No
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: SF-202500042"
                    value={editCariForm.faturaNo}
                    onChange={(e) => setEditCariForm({ ...editCariForm, faturaNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* ================= DÖVİZLİ FATURA BİLGİ ALANI (DÜZENLEME) ================= */}
              {(editCariForm.tur === 'alis_faturasi' || editCariForm.tur === 'satis_faturasi') && (editCariForm.paraBirimi || 'TRY') !== 'TRY' && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-900">
                        Döviz Kuru ({editCariForm.paraBirimi} / TRY)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-600">1 {editCariForm.paraBirimi} =</span>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        value={editCariForm.dovizKuru || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditCariForm({ ...editCariForm, dovizKuru: val });
                        }}
                        className="w-24 px-2 py-1 text-xs font-bold font-mono text-blue-950 bg-white border border-blue-300 rounded-lg"
                      />
                      <span className="text-xs font-mono text-slate-600">₺</span>
                      <button
                        type="button"
                        onClick={() => {
                          const rate = getCurrencyExchangeRate(editCariForm.paraBirimi || 'TRY', exchangeRates.rates);
                          setEditCariForm({ ...editCariForm, dovizKuru: rate });
                        }}
                        className="px-2 py-1 text-[10px] font-semibold bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md cursor-pointer"
                        title="Güncel sistem kurunu uygula"
                      >
                        Güncel Kuru Al
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-blue-800 flex items-center justify-between pt-1 border-t border-blue-200/60 font-medium">
                    <span>💡 Fatura tutarı firmanın <strong>{editCariForm.paraBirimi}</strong> sepetine işlenir.</span>
                    <span className="font-mono font-bold text-blue-950">
                      TL Karşılığı: ≈ {formatCurrency((editCariForm.tutar || 0) * (editCariForm.dovizKuru || 1), 'TRY')}
                    </span>
                  </div>
                </div>
              )}

              {/* ================= DÖVİZ BORÇ TAHSİS & DÜŞÜM ALANI (DÜZENLEME) ================= */}
              {(editCariForm.tur === 'odeme' || editCariForm.tur === 'tahsilat') && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-300 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🎯</span>
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        {editCariForm.tur === 'odeme' ? 'Hangi Borç Sepetinden Düşülecek?' : 'Hangi Alacak Sepetinden Düşülecek?'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      Ayrı Döviz Sepeti Düşümü
                    </span>
                  </div>

                  {/* Sepet Seçim Düğmeleri */}
                  {(() => {
                    const firmSt = editCariForm.firmaId ? companyStats[editCariForm.firmaId] : undefined;
                    const activeCurrs = firmSt ? firmSt.activeCurrencies : [];
                    const displayCurrs = Array.from(new Set(['TRY', ...activeCurrs]));

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {displayCurrs.map((curr) => {
                          const basket = firmSt?.baskets[curr];
                          const isSelected = (editCariForm.hedefParaBirimi || 'TRY') === curr;
                          const bakiyeVal = basket ? basket.bakiye : 0;

                          return (
                            <button
                              key={curr}
                              type="button"
                              onClick={() => updateEditCariFormCrossCalculation({ hedefParaBirimi: curr })}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-100/90 border-amber-500 text-amber-950 ring-2 ring-amber-300 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span>{getCurrencySymbol(curr)} {curr} Borcu</span>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                              </div>
                              <div className="text-[11px] mt-1">
                                {basket ? (
                                  <span className={bakiyeVal > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
                                    Kalan: {formatCurrency(Math.abs(bakiyeVal), curr)} {bakiyeVal > 0 ? 'Borç' : 'Alacak'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Sepet Boş (0 {curr})</span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {/* Diğer Tanımlı Dövizler */}
                        <div className="relative">
                          <select
                            value={displayCurrs.includes(editCariForm.hedefParaBirimi || 'TRY') ? '' : (editCariForm.hedefParaBirimi || '')}
                            onChange={(e) => {
                              if (e.target.value) {
                                updateEditCariFormCrossCalculation({ hedefParaBirimi: e.target.value });
                              }
                            }}
                            className="w-full h-full min-h-[52px] p-2 text-xs rounded-xl border border-dashed border-amber-300 bg-white font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="">+ Diğer Para Birimi Sepeti...</option>
                            {getSavedCurrencies().filter((c) => !displayCurrs.includes(c.code)).map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.symbol} {c.code} - {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Kur ve Düşüm Hesap Özeti */}
                  {(() => {
                    const payCurr = editCariForm.paraBirimi || 'TRY';
                    const targetCurr = editCariForm.hedefParaBirimi || payCurr;
                    const isCross = payCurr !== targetCurr;
                    const crossInfo = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates);
                    const firmSt = editCariForm.firmaId ? companyStats[editCariForm.firmaId] : undefined;
                    const targetBasket = firmSt?.baskets[targetCurr];
                    const currentTargetDebt = targetBasket ? targetBasket.bakiye : 0;
                    const deducted = calculateCrossDeduction(editCariForm.tutar || 0, payCurr, targetCurr, editCariForm.hedefKur, exchangeRates.rates);
                    const remainingDebt = currentTargetDebt - deducted;

                    if (isCross) {
                      return (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-amber-300 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-800">
                                Çevrim Kuru ({crossInfo.label})
                              </label>
                              <span className="text-[11px] text-slate-500">
                                {payCurr} ödemenizin {targetCurr} borcunuza dönüştürülme kuru
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={editCariForm.hedefKur || ''}
                                onChange={(e) => {
                                  const newKur = parseFloat(e.target.value) || 0;
                                  const dec = calculateCrossDeduction(editCariForm.tutar || 0, payCurr, targetCurr, newKur, exchangeRates.rates);
                                  setEditCariForm({
                                    ...editCariForm,
                                    hedefKur: newKur,
                                    hedefDusulenTutar: dec,
                                  });
                                }}
                                className="w-28 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-amber-300 text-slate-900 bg-amber-50/50"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const sRate = getSuggestedCrossRate(payCurr, targetCurr, exchangeRates.rates).rate;
                                  const dec = calculateCrossDeduction(editCariForm.tutar || 0, payCurr, targetCurr, sRate, exchangeRates.rates);
                                  setEditCariForm({
                                    ...editCariForm,
                                    hedefKur: sRate,
                                    hedefDusulenTutar: dec,
                                  });
                                }}
                                className="px-2 py-1.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer whitespace-nowrap"
                                title="Güncel sistem kurunu uygula"
                              >
                                Güncel Kuru Al
                              </button>
                            </div>
                          </div>

                          <div className="p-2.5 bg-amber-100/70 rounded-lg border border-amber-200/80 text-xs text-amber-950 font-medium space-y-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                {formatCurrency(editCariForm.tutar || 0, payCurr)} ödeme, {editCariForm.hedefKur} kuru üzerinden firmanın {targetCurr} borcundan {formatCurrency(deducted, targetCurr)} olarak düşülecektir.
                              </span>
                            </div>
                            {currentTargetDebt > 0 && (
                              <div className="text-[11px] text-amber-900 pt-1 border-t border-amber-200/60 flex items-center justify-between">
                                <span>Mevcut {targetCurr} Borcu: <strong>{formatCurrency(currentTargetDebt, targetCurr)}</strong></span>
                                <span>➔ İşlem Sonrası Kalan: <strong className={remainingDebt <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatCurrency(Math.abs(remainingDebt), targetCurr)} {remainingDebt > 0 ? 'Borç' : remainingDebt < 0 ? 'Fazla Ödeme' : 'Kapatıldı'}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {formatCurrency(editCariForm.tutar || 0, payCurr)} ödeme doğrudan firmanın <strong>{targetCurr}</strong> sepetinden birebir düşülecektir.
                          </span>
                        </div>
                        {currentTargetDebt > 0 && (
                          <span className="text-[11px] text-emerald-800 font-mono font-semibold">
                            Kalan: {formatCurrency(Math.max(0, currentTargetDebt - (editCariForm.tutar || 0)), targetCurr)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tarih</label>
                  <input
                    type="date"
                    value={editCariForm.tarih}
                    onChange={(e) => setEditCariForm({ ...editCariForm, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Saat</label>
                  <input
                    type="time"
                    value={editCariForm.saat}
                    onChange={(e) => setEditCariForm({ ...editCariForm, saat: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Kalem Detayı
                </label>
                <input
                  type="text"
                  placeholder="Örn: 2. Etap Kaba İnşaat Satış Faturası"
                  value={editCariForm.aciklama}
                  onChange={(e) => setEditCariForm({ ...editCariForm, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCari(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-xs"
                >
                  Değişiklikleri Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CARİ HAREKET / FATURA SİLME ONAY MODALI                             */}
      {/* ========================================================================= */}
      {deletingCari && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cari Hareketi Sil</h3>
              <p className="text-sm text-slate-600 mb-4">
                Aşağıdaki fatura / cari hareket kaydını sistemden silmek istediğinize emin misiniz?
              </p>

              {/* Detay Kartı */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-slate-500">Firma:</span>
                  <span className="font-bold text-slate-900">
                    {firmalar.find((f) => f.id === deletingCari.firmaId)?.isim || 'Bilinmeyen Firma'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">İşlem Türü:</span>
                  <span className="font-semibold text-slate-900">
                    {getIslemClassification(deletingCari).label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tutar:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {formatCurrency(deletingCari.borc > 0 ? deletingCari.borc : deletingCari.alacak)}
                  </span>
                </div>
                {deletingCari.faturaNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fatura / Evrak No:</span>
                    <span className="font-mono text-slate-700">{deletingCari.faturaNo}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarih:</span>
                  <span className="text-slate-700 font-mono">{deletingCari.tarih} {deletingCari.saat}</span>
                </div>
                {deletingCari.aciklama && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Açıklama:</span>
                    <span className="text-slate-700 truncate max-w-[200px]">{deletingCari.aciklama}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingCari(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmDeleteCari}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Evet, Sil</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL'DEN FİRMA VE CARİ AKTARMA SİHİRBAZI MODALI */}
      <CariExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        firmalar={firmalar}
        santiyeler={santiyeler}
        initialScope={excelImportScope}
        onImportSuccess={(result) => {
          if (onBatchImportFirmaAndCari) {
            onBatchImportFirmaAndCari(result);
          } else {
            result.firmsToUpsert.forEach((f) => {
              const existing = firmalar.find(
                (ef) => (f.vergiNo && ef.vergiNo === f.vergiNo) || ef.isim.toLowerCase() === f.isim?.toLowerCase()
              );
              if (existing && onUpdateFirma) {
                onUpdateFirma({ ...existing, ...f } as Firma);
              } else if (f.isim) {
                onAddFirma({
                  id: `firma-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  isim: f.isim,
                  tur: f.tur || 'tedarikci',
                  adres: f.adres || '',
                  vergiNo: f.vergiNo || '',
                  ilgili: f.ilgili || '',
                  telefon: f.telefon || '',
                  email: f.email || '',
                  uzmanlik: f.uzmanlik || '',
                });
              }
            });
            result.cariToInsert.forEach((c, idx) => {
              onAddCariHareket({
                ...c,
                id: `cari-imp-${Date.now()}-${idx}`,
              } as FirmaCari);
            });
          }
        }}
      />
    </div>
  );
};
