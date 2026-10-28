import React, { useMemo, useState } from 'react';
import { 
  Building2, 
  Users, 
  Clock, 
  Receipt, 
  ChevronRight, 
  ChevronLeft,
  CreditCard, 
  BookOpenCheck, 
  Layers, 
  Plus, 
  HardHat, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  WalletCards,
  Printer,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Filter,
  Package,
  Activity,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Banknote
} from 'lucide-react';
import { 
  Santiye, 
  Personnel, 
  Puantaj,
  Mesai,
  PersonelOdeme,
  SantiyeGider, 
  KrediKarti, 
  KrediKartiHarcama, 
  Firma, 
  FirmaCari, 
  Cek, 
  Taseron 
} from '../types';
import { formatCurrency, getTodayDateString } from '../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../utils/currencyStore';
import { isOdemeInBordroDonemi } from '../utils/personnelBalance';
import { 
  getCanonicalFirmKey, 
  allocateInvoicePaymentsFIFO, 
  allocateInvoiceCollectionsFIFO 
} from '../utils/siteAccountingUtils';
import { ExportButton } from './ExportButton';
import { ExportOptions, exportToExcel, exportToPDF, printReport } from '../utils/exportUtils';
import { ActiveTabType, PayrollSubTabType } from './Navbar';

export interface SummaryData {
  activeSites: number;
  totalSites: number;
  totalStaff: number;
  activeStaff: number;
  monthMesai: number;
  totalPendingPayment: number;
  totalResmiPending: number;
  totalEldenPending: number;
  totalResmiPaid?: number;
  totalEldenPaid?: number;
}

interface DashboardViewProps {
  summaryData: SummaryData;
  currentMonthStr: string;
  availableMonths?: string[];
  onChangeMonth?: (month: string) => void;
  setActiveTab: (tab: ActiveTabType) => void;
  onNavigateToPayrollSubTab?: (subTab: PayrollSubTabType) => void;
  santiyeler: Santiye[];
  personnelList: Personnel[];
  puantajList?: Puantaj[];
  mesaiList?: Mesai[];
  odemeList?: PersonelOdeme[];
  giderler: SantiyeGider[];
  krediKartlari: KrediKarti[];
  kartHarcamalari: KrediKartiHarcama[];
  firmalar: Firma[];
  cariList: FirmaCari[];
  cekler: Cek[];
  taseronlar: Taseron[];
  onOpenAddPersonnel: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summaryData,
  currentMonthStr,
  availableMonths = [],
  onChangeMonth,
  setActiveTab,
  onNavigateToPayrollSubTab,
  santiyeler,
  personnelList,
  puantajList = [],
  mesaiList = [],
  odemeList = [],
  giderler,
  krediKartlari,
  kartHarcamalari,
  firmalar,
  cariList,
  cekler,
  taseronlar,
  onOpenAddPersonnel,
}) => {
  const ratesData = useMemo(() => getSavedExchangeRates(), []);
  const rates = ratesData.rates;

  // Hesaplama Esası: 'cash' (Varsayılan: Sadece Fiili Ödemeler & Tahsilatlar) vs 'accrual' (Faturalar Dahil - Açık Fark)
  const [accountingBasis, setAccountingBasis] = useState<'cash' | 'accrual'>('cash');

  // Format month for display: e.g. "2025-02" -> "Şubat 2025"
  const formattedMonthTitle = useMemo(() => {
    if (!currentMonthStr || currentMonthStr === 'all') return 'Tüm Dönemler';
    try {
      const [year, month] = currentMonthStr.split('-');
      if (!year || !month) return currentMonthStr;
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    } catch {
      return currentMonthStr;
    }
  }, [currentMonthStr]);

  // Navigate months
  const handlePrevMonth = () => {
    if (!onChangeMonth || !currentMonthStr || currentMonthStr === 'all') return;
    try {
      const [year, month] = currentMonthStr.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      onChangeMonth(prevMonthStr);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextMonth = () => {
    if (!onChangeMonth || !currentMonthStr || currentMonthStr === 'all') return;
    try {
      const [year, month] = currentMonthStr.split('-').map(Number);
      const nextDate = new Date(year, month, 1);
      const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      onChangeMonth(nextMonthStr);
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Credit Card Totals converted to TRY
  const creditCardTotals = useMemo(() => {
    let totalLimitTRY = 0;
    let totalCurrentDebtTRY = 0;

    krediKartlari.forEach((kart) => {
      const limitVal = kart.kartLimiti || (kart as any).limit || 0;
      totalLimitTRY += convertCurrencyToTRY(limitVal, 'TRY', rates);

      // Kart harcamalarını toplayalım
      const cardExpenses = kartHarcamalari.filter((h) => h.kartId === kart.id);
      let cardDebt = 0;
      cardExpenses.forEach((h) => {
        const amount = convertCurrencyToTRY(h.tutar || 0, h.paraBirimi || 'TRY', rates);
        if (h.islemTipi === 'Harcama') {
          cardDebt += amount;
        } else if (h.islemTipi === 'Kart Ödemesi' || h.islemTipi === 'İade') {
          cardDebt -= amount;
        }
      });
      totalCurrentDebtTRY += Math.max(0, cardDebt);
    });

    // Fallback: kart harcaması boşsa varsa karttaki guncelBorc
    if (kartHarcamalari.length === 0 && krediKartlari.some((k) => (k as any).guncelBorc)) {
      totalCurrentDebtTRY = krediKartlari.reduce((acc, k) => acc + ((k as any).guncelBorc || 0), 0);
    }

    const totalAvailableTRY = Math.max(0, totalLimitTRY - totalCurrentDebtTRY);

    return {
      totalLimitTRY,
      totalCurrentDebtTRY,
      totalAvailableTRY,
      cardCount: krediKartlari.length,
      expenseCount: kartHarcamalari.length,
    };
  }, [krediKartlari, kartHarcamalari, rates]);

  // 2. Check Portfolio totals converted to TRY
  const checkTotals = useMemo(() => {
    let portfolioTRY = 0;
    let collectedTRY = 0;
    let endorsedTRY = 0;
    let bounceOrCancelTRY = 0;
    let paidTRY = 0;

    cekler.forEach((c) => {
      const amountVal = c.miktar ?? (c as any).tutar ?? 0;
      const amountTRY = convertCurrencyToTRY(amountVal, c.paraBirimi || 'TRY', rates);
      
      const st = (c.durum || '').trim();
      if (st === 'Portföyde') {
        portfolioTRY += amountTRY;
      } else if (st === 'Tahsil Edildi' || st === 'Tahsilde') {
        collectedTRY += amountTRY;
      } else if (st === 'Ciro Edildi' || st === 'Cirolandı') {
        endorsedTRY += amountTRY;
      } else if (st === 'Karşılıksız' || st === 'İptal') {
        bounceOrCancelTRY += amountTRY;
      } else if (st === 'Ödendi') {
        paidTRY += amountTRY;
      }
    });

    return {
      totalChecks: cekler.length,
      portfolioTRY,
      collectedTRY,
      endorsedTRY,
      bounceOrCancelTRY,
      paidTRY,
    };
  }, [cekler, rates]);

  // 3. Subcontractor & Company Balance Overview
  const balanceOverview = useMemo(() => {
    let totalSubcontractorContracts = 0;
    let totalSubcontractorPaid = 0;

    taseronlar.forEach((t) => {
      totalSubcontractorContracts += convertCurrencyToTRY(t.sozlesmeBedeli || 0, t.paraBirimi || 'TRY', rates);
      totalSubcontractorPaid += convertCurrencyToTRY(t.odenenTutar || 0, t.paraBirimi || 'TRY', rates);
    });

    let companyReceivableTRY = 0; // Bizim Alacağımız (Satış faturası vb.)
    let companyPayableTRY = 0;    // Bizim Borcumuz (Alış faturası vb.)

    // Cari hareketlerden firmaların net durumunu hesapla
    const firmTotals: Record<string, { borcTRY: number; alacakTRY: number }> = {};
    cariList.forEach((c) => {
      const bTRY = convertCurrencyToTRY(c.borc || 0, c.paraBirimi || 'TRY', rates);
      const aTRY = convertCurrencyToTRY(c.alacak || 0, c.paraBirimi || 'TRY', rates);
      if (!firmTotals[c.firmaId]) {
        firmTotals[c.firmaId] = { borcTRY: 0, alacakTRY: 0 };
      }
      firmTotals[c.firmaId].borcTRY += bTRY;
      firmTotals[c.firmaId].alacakTRY += aTRY;
    });

    Object.values(firmTotals).forEach((f) => {
      const net = f.borcTRY - f.alacakTRY;
      if (net > 0) {
        // Firmaya borçluyuz
        companyPayableTRY += net;
      } else if (net < 0) {
        // Firmadan alacaklıyız
        companyReceivableTRY += Math.abs(net);
      }
    });

    return {
      subcontractorRemaining: Math.max(0, totalSubcontractorContracts - totalSubcontractorPaid),
      totalSubcontractors: taseronlar.length,
      companyReceivableTRY,
      companyPayableTRY,
      totalCompanies: firmalar.length,
    };
  }, [taseronlar, cariList, firmalar, rates]);

  // 4. Şantiye Giderleri Özeti (Dönem veya Genel - Doğrudan Giderler + Şantiye Personel Ödemeleri + Açık Fatura Farkları)
  const siteExpensesOverview = useMemo(() => {
    let totalExpenseTRY = 0;
    let expenseCount = 0;
    const categoryTotals: Record<string, number> = {};
    const siteExpenseMap: Record<string, number> = {};

    // Track actual payments made to each firm per site: siteId -> firmKey -> totalPaymentsTRY
    const siteFirmPayments: Record<string, Record<string, number>> = {};
    const pendingPurchaseInvoices: Array<{
      c: FirmaCari;
      siteId: string;
      firmKey: string;
      tryVal: number;
    }> = [];

    const existingGiderIds = new Set(giderler.map((g) => g.id));
    const existingCariIdsInGiderler = new Set(
      giderler.map((g) => g.cariHareketId).filter(Boolean) as string[]
    );
    const existingCekIdsInGiderler = new Set(
      giderler.map((g) => g.cekId).filter(Boolean) as string[]
    );
    const processedCekIds = new Set<string>(existingCekIdsInGiderler);

    const findSiteByIdOrName = (siteId?: string, siteName?: string) => {
      if (siteId) {
        const byId = santiyeler.find(
          (s) => s.id === siteId || s.isim.trim().toLowerCase() === siteId.trim().toLowerCase()
        );
        if (byId) return byId;
      }
      if (siteName) {
        const byName = santiyeler.find(
          (s) => s.isim.trim().toLowerCase() === siteName.trim().toLowerCase()
        );
        if (byName) return byName;
      }
      return undefined;
    };

    giderler.forEach((g) => {
      // Eğer belirli bir ay seçiliyse ve tarihte eşleşme varsa
      if (currentMonthStr && currentMonthStr !== 'all' && g.tarih && !g.tarih.startsWith(currentMonthStr)) {
        return;
      }

      const rawVal = Number(g.miktar ?? (g as any).tutar ?? 0);
      const amountTRY = convertCurrencyToTRY(rawVal, g.paraBirimi || 'TRY', rates);
      totalExpenseTRY += amountTRY;
      expenseCount += 1;

      const cat = g.kategori || 'Genel Gider';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amountTRY;

      let site = findSiteByIdOrName(g.santiyeId, g.santiyeId);
      if (site) {
        siteExpenseMap[site.id] = (siteExpenseMap[site.id] || 0) + amountTRY;
        const firmKey = getCanonicalFirmKey(g.cariFirmaId, g.taseron || g.odemeYapilanFirma, firmalar, taseronlar);
        siteFirmPayments[site.id] = siteFirmPayments[site.id] || {};
        siteFirmPayments[site.id][firmKey] = (siteFirmPayments[site.id][firmKey] || 0) + amountTRY;
      }
    });

    // Cari Kayıtlardan Şantiyeye Ait Masraflar (Taşeron, Tedarikçi, Alış Faturaları ve Ödemeler)
    cariList.forEach((c) => {
      if (currentMonthStr && currentMonthStr !== 'all' && c.tarih && !c.tarih.startsWith(currentMonthStr)) {
        return;
      }
      const isAlisFaturasi = c.islemTuru === 'alis_faturasi';
      const isOdeme = c.islemTuru === 'odeme';
      const isExplicitRevenue = c.islemTuru === 'satis_faturasi' || c.islemTuru === 'tahsilat';
      if (isExplicitRevenue) return;

      const firma = firmalar.find((f) => f.id === c.firmaId);
      const isCustomer = firma?.tur === 'musteri';
      if (isCustomer && !isAlisFaturasi) return;

      const isExpense = isAlisFaturasi || isOdeme || ((c.alacak || 0) > 0) || ((c.borc || 0) > 0);
      if (!isExpense) return;

      // Nakit esaslı modda alış faturaları gider sayılmaz, sadece fiili ödemeler dahil edilir
      if (accountingBasis === 'cash' && isAlisFaturasi) return;

      if (c.giderId && existingGiderIds.has(c.giderId)) return;
      if (existingCariIdsInGiderler.has(c.id)) return;

      const isLinkedToPersonel = Boolean(
        c.odemeId ||
        odemeList.some((o) => o.cariHareketId === c.id) ||
        c.aciklama?.includes('[Taşeron Personeli Hakediş]') ||
        c.aciklama?.includes('[Taşeron Ekip Hakediş Ödemesi]')
      );
      if (isLinkedToPersonel) return;

      const matchingTas =
        taseronlar.find(
          (t) =>
            t.id === c.firmaId ||
            (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()))
        ) || (firma?.tur === 'taseron' ? { id: firma.id, isim: firma.isim } : null);

      const isTas = Boolean(matchingTas || firma?.tur === 'taseron');

      const linkedCek = cekler.find(
        (ck) =>
          (c.cekId && ck.id === c.cekId) ||
          ck.cariHareketId === c.id ||
          ck.ciroCariHareketId === c.id ||
          (c.faturaNo && ck.cekNo && c.faturaNo.includes(ck.cekNo))
      );
      if (linkedCek) processedCekIds.add(linkedCek.id);

      let targetSite = findSiteByIdOrName(c.santiyeId, c.santiyeAdi);
      if (!targetSite && linkedCek) {
        const isCiroMatch = linkedCek.ciroCariHareketId === c.id || Boolean(c.faturaNo?.toUpperCase().startsWith('CİRO'));
        targetSite = isCiroMatch
          ? findSiteByIdOrName(
              linkedCek.ciroSantiyeId || linkedCek.santiyeId,
              linkedCek.ciroSantiyeProje || linkedCek.santiyeProje
            )
          : findSiteByIdOrName(linkedCek.santiyeId, linkedCek.santiyeProje);
      }
      if (!targetSite && c.aciklama) {
        targetSite = santiyeler.find((s) => c.aciklama!.toLowerCase().includes(s.isim.toLowerCase()));
      }
      if (!targetSite && linkedCek?.aciklama) {
        targetSite = santiyeler.find((s) => linkedCek.aciklama!.toLowerCase().includes(s.isim.toLowerCase()));
      }
      if (!targetSite) return;

      const rawAmt = Math.max(Number(c.alacak || 0), Number(c.borc || 0));
      if (rawAmt <= 0) return;
      const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
      const amountTRY =
        c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
          ? rawAmt * c.dovizKuru
          : convertCurrencyToTRY(rawAmt, cur, rates);

      const tasName = matchingTas?.isim || firma?.isim || 'Firma / Tedarikçi';
      const firmKey = getCanonicalFirmKey(c.firmaId, tasName, firmalar, taseronlar);

      if (isAlisFaturasi) {
        pendingPurchaseInvoices.push({
          c,
          siteId: targetSite.id,
          firmKey,
          tryVal: amountTRY,
        });
        return;
      }

      totalExpenseTRY += amountTRY;
      expenseCount += 1;

      const cat = linkedCek
        ? (isTas ? 'Taşeron Çek Ödemesi' : 'Tedarikçi Çek Ödemesi')
        : isTas
        ? 'Taşeron Cari Ödemesi'
        : 'Tedarikçi / Cari Ödemesi';

      categoryTotals[cat] = (categoryTotals[cat] || 0) + amountTRY;
      siteExpenseMap[targetSite.id] = (siteExpenseMap[targetSite.id] || 0) + amountTRY;

      siteFirmPayments[targetSite.id] = siteFirmPayments[targetSite.id] || {};
      siteFirmPayments[targetSite.id][firmKey] = (siteFirmPayments[targetSite.id][firmKey] || 0) + amountTRY;
    });

    cekler.forEach((ck) => {
      if (processedCekIds.has(ck.id)) return;
      if (ck.cariHareketId && existingCariIdsInGiderler.has(ck.cariHareketId)) return;
      if (ck.ciroCariHareketId && existingCariIdsInGiderler.has(ck.ciroCariHareketId)) return;

      const isVerilen = ck.cekTuru === 'verilen_cek';
      const isCiro = ck.durum === 'Ciro Edildi';
      if (!isVerilen && !isCiro) return;

      const txDate = (isCiro ? ck.ciroTarihi : ck.alinanTarih) || '';
      if (currentMonthStr && currentMonthStr !== 'all' && txDate && !txDate.startsWith(currentMonthStr)) {
        return;
      }

      let isTasCheck = false;
      let tasName: string | undefined;
      let firmId: string | undefined;
      if (isCiro && (ck.ciroFirmaId || ck.ciroEdilenFirma)) {
        firmId = ck.ciroFirmaId;
        const firma = firmalar.find((f) => f.id === ck.ciroFirmaId);
        const matchingTas = taseronlar.find(
          (t) =>
            t.id === ck.ciroFirmaId ||
            (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase())) ||
            (ck.ciroEdilenFirma && t.isim.trim().toLowerCase() === ck.ciroEdilenFirma.trim().toLowerCase())
        );
        isTasCheck = Boolean(matchingTas || firma?.tur === 'taseron');
        if (matchingTas || firma?.tur === 'taseron') {
          tasName = matchingTas?.isim || firma?.isim || ck.ciroEdilenFirma;
        }
      } else if (isVerilen) {
        firmId = ck.firmaId;
        const firma = firmalar.find((f) => f.id === ck.firmaId);
        const matchingTas = taseronlar.find(
          (t) =>
            t.id === ck.firmaId ||
            (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase())) ||
            (ck.hamil && t.isim.trim().toLowerCase() === ck.hamil.trim().toLowerCase())
        );
        isTasCheck = Boolean(matchingTas || firma?.tur === 'taseron');
        if (matchingTas || firma?.tur === 'taseron') {
          tasName = matchingTas?.isim || firma?.isim || ck.hamil;
        }
      }
      if (!isTasCheck || !tasName) return;

      const targetSite = isCiro
        ? findSiteByIdOrName(ck.ciroSantiyeId || ck.santiyeId, ck.ciroSantiyeProje || ck.santiyeProje)
        : findSiteByIdOrName(ck.santiyeId, ck.santiyeProje);
      if (!targetSite) return;

      const rawAmt = Number(ck.miktar || 0);
      if (rawAmt <= 0) return;
      const amountTRY = convertCurrencyToTRY(rawAmt, ck.paraBirimi || 'TRY', rates);
      totalExpenseTRY += amountTRY;
      expenseCount += 1;

      const cat = 'Taşeron Çek Ödemesi';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amountTRY;
      siteExpenseMap[targetSite.id] = (siteExpenseMap[targetSite.id] || 0) + amountTRY;

      const firmKey = getCanonicalFirmKey(firmId, tasName, firmalar, taseronlar);
      siteFirmPayments[targetSite.id] = siteFirmPayments[targetSite.id] || {};
      siteFirmPayments[targetSite.id][firmKey] = (siteFirmPayments[targetSite.id][firmKey] || 0) + amountTRY;
    });

    // 2C. Faturalar Dahil modunda: Alış faturalarını FIFO ile eşleştir ve yalnızca AÇIK FARKI ekle
    if (accountingBasis === 'accrual' && pendingPurchaseInvoices.length > 0) {
      const groups: Record<string, typeof pendingPurchaseInvoices> = {};
      pendingPurchaseInvoices.forEach((inv) => {
        const groupKey = `${inv.siteId}___${inv.firmKey}`;
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(inv);
      });

      Object.entries(groups).forEach(([groupKey, groupInvoices]) => {
        const [siteId, firmKey] = groupKey.split('___');
        const totalPaid = siteFirmPayments[siteId]?.[firmKey] || 0;
        const allocMap = allocateInvoicePaymentsFIFO(
          totalPaid,
          groupInvoices.map((i) => ({ id: i.c.id, tryVal: i.tryVal, tarih: i.c.tarih }))
        );

        groupInvoices.forEach((inv) => {
          const alloc = allocMap.get(inv.c.id);
          const openDiff = alloc?.openDifferenceTRY ?? inv.tryVal;
          if (openDiff > 0) {
            totalExpenseTRY += openDiff;
            expenseCount += 1;
            categoryTotals['Alış Faturası / Malzeme Alımı'] =
              (categoryTotals['Alış Faturası / Malzeme Alımı'] || 0) + openDiff;
            siteExpenseMap[siteId] = (siteExpenseMap[siteId] || 0) + openDiff;
          }
        });
      });
    }

    odemeList.forEach((o) => {
      if (currentMonthStr && currentMonthStr !== 'all' && !isOdemeInBordroDonemi(o, currentMonthStr)) {
        return;
      }
      if (existingGiderIds.has(o.id) || ((o as any).giderId && existingGiderIds.has((o as any).giderId))) return;

      const avans = Number(o.avansOdemesi) || 0;
      const resmi = Number(o.resmiOdeme) || 0;
      const harcama = Number(o.yaptigiHarcama) || 0;
      const legacyMiktar = avans === 0 && resmi === 0 && harcama === 0 ? (Number((o as any).miktar) || 0) : 0;
      const rawAmt = avans + resmi + harcama + legacyMiktar;
      if (rawAmt <= 0) return;

      const person = personnelList.find((p) => p.id === o.personelId);
      if (!person) return;

      const targetSite = santiyeler.find(
        (s) =>
          (person.santiyeId && (s.id === person.santiyeId || s.isim.trim().toLowerCase() === person.santiyeId.trim().toLowerCase())) ||
          (person.santiye && (s.isim.trim().toLowerCase() === person.santiye.trim().toLowerCase() || s.id === person.santiye.trim()))
      );
      if (!targetSite) return;

      const amountTRY = convertCurrencyToTRY(rawAmt, o.paraBirimi || 'TRY', rates);
      totalExpenseTRY += amountTRY;
      expenseCount += 1;

      const cat = 'Personel Ödemeleri';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amountTRY;
      siteExpenseMap[targetSite.id] = (siteExpenseMap[targetSite.id] || 0) + amountTRY;
    });

    // 4. Şantiye Gelirleri (Cari Hareket / Fatura Ekle veya Düzenle ekranında İlgili Şantiye seçilen kayıtlar)
    const siteRevenueMap: Record<string, number> = {};
    let totalSiteRevenueTRY = 0;
    const siteCustCollections: Record<string, Record<string, number>> = {};
    const pendingSalesInvoices: Array<{
      c: FirmaCari;
      siteId: string;
      custKey: string;
      tryVal: number;
    }> = [];

    cariList.forEach((c) => {
      if (currentMonthStr && currentMonthStr !== 'all' && c.tarih && !c.tarih.startsWith(currentMonthStr)) {
        return;
      }
      if (c.giderId || c.odemeId) return;
      const isLinkedToPersonel = Boolean(
        odemeList.some((o) => o.cariHareketId === c.id) ||
          c.aciklama?.includes('[Taşeron Personeli Hakediş]') ||
          c.aciklama?.includes('[Taşeron Ekip Hakediş Ödemesi]')
      );
      if (isLinkedToPersonel) return;

      const matchingFirma = firmalar.find((f) => f.id === c.firmaId);
      const matchingTas =
        taseronlar.find(
          (t) =>
            t.id === c.firmaId ||
            (matchingFirma &&
              (t.id === matchingFirma.id ||
                t.isim.trim().toLowerCase() === matchingFirma.isim.trim().toLowerCase()))
        ) || (matchingFirma?.tur === 'taseron' ? { id: matchingFirma.id, isim: matchingFirma.isim } : null);

      const isSubcontractor = Boolean(matchingTas || matchingFirma?.tur === 'taseron');
      const isCustomer = matchingFirma?.tur === 'musteri';

      if (isSubcontractor && c.islemTuru !== 'satis_faturasi' && c.islemTuru !== 'tahsilat') return;
      if (c.islemTuru === 'alis_faturasi' || c.islemTuru === 'odeme') return;

      // Nakit esaslı hesaplamada satış faturaları gelir sayılmaz, sadece fiili tahsilatlar gelir yazılır
      if (accountingBasis === 'cash' && c.islemTuru !== 'tahsilat') return;

      const linkedCek = cekler.find(
        (ck) => (c.cekId && ck.id === c.cekId) || ck.cariHareketId === c.id
      );

      let targetSite = findSiteByIdOrName(c.santiyeId, c.santiyeAdi);
      const hasExplicitSiteOnCari = Boolean(c.santiyeId || c.santiyeAdi);

      if (!targetSite && !hasExplicitSiteOnCari && linkedCek) {
        targetSite = findSiteByIdOrName(linkedCek.santiyeId, linkedCek.santiyeProje);
      }

      if (!targetSite && !hasExplicitSiteOnCari) {
        const isRevenueByType =
          c.islemTuru === 'satis_faturasi' ||
          c.islemTuru === 'tahsilat' ||
          isCustomer;
        if (!isRevenueByType) return;

        targetSite = santiyeler.find(
          (s) =>
            c.aciklama?.toLowerCase().includes(s.isim.toLowerCase()) ||
            matchingFirma?.isim.toLowerCase().includes(s.isim.toLowerCase()) ||
            (s.yetkiliFirma &&
              matchingFirma?.isim.toLowerCase().includes(s.yetkiliFirma.toLowerCase()))
        );
      }

      if (!targetSite) return;

      const rawAmt = Math.max(Number(c.borc || 0), Number(c.alacak || 0));
      if (rawAmt <= 0) return;

      const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
      const tryVal =
        c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
          ? rawAmt * c.dovizKuru
          : convertCurrencyToTRY(rawAmt, cur, rates);

      const custKey = getCanonicalFirmKey(c.firmaId, matchingFirma?.isim, firmalar, taseronlar);

      if (c.islemTuru === 'satis_faturasi') {
        pendingSalesInvoices.push({
          c,
          siteId: targetSite.id,
          custKey,
          tryVal,
        });
        return;
      }

      siteRevenueMap[targetSite.id] = (siteRevenueMap[targetSite.id] || 0) + tryVal;
      totalSiteRevenueTRY += tryVal;

      siteCustCollections[targetSite.id] = siteCustCollections[targetSite.id] || {};
      siteCustCollections[targetSite.id][custKey] = (siteCustCollections[targetSite.id][custKey] || 0) + tryVal;
    });

    // Faturalar Dahil modunda: Satış faturalarını FIFO ile eşleştir ve yalnızca AÇIK FARKI ekle
    if (accountingBasis === 'accrual' && pendingSalesInvoices.length > 0) {
      const groups: Record<string, typeof pendingSalesInvoices> = {};
      pendingSalesInvoices.forEach((inv) => {
        const groupKey = `${inv.siteId}___${inv.custKey}`;
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(inv);
      });

      Object.entries(groups).forEach(([groupKey, groupInvoices]) => {
        const [siteId, custKey] = groupKey.split('___');
        const totalCollected = siteCustCollections[siteId]?.[custKey] || 0;
        const allocMap = allocateInvoiceCollectionsFIFO(
          totalCollected,
          groupInvoices.map((i) => ({ id: i.c.id, tryVal: i.tryVal, tarih: i.c.tarih }))
        );

        groupInvoices.forEach((inv) => {
          const alloc = allocMap.get(inv.c.id);
          const openDiff = alloc?.openDifferenceTRY ?? inv.tryVal;
          if (openDiff > 0) {
            siteRevenueMap[siteId] = (siteRevenueMap[siteId] || 0) + openDiff;
            totalSiteRevenueTRY += openDiff;
          }
        });
      });
    }

    return {
      totalExpenseTRY,
      categoryTotals,
      siteExpenseMap,
      siteRevenueMap,
      totalSiteRevenueTRY,
      expenseCount,
    };
  }, [giderler, cariList, cekler, firmalar, taseronlar, odemeList, personnelList, santiyeler, currentMonthStr, rates, accountingBasis]);

  // 5. Dashboard Export Options
  const getDashboardExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Modül / Gösterge', dataKey: 'gosterge', width: 40 },
      { header: 'Değer / Durum', dataKey: 'deger', width: 35, align: 'right' as const },
      { header: 'Açıklama / Detay', dataKey: 'detay', width: 45 },
    ];

    const data = [
      {
        gosterge: 'Aktif Şantiye Sayısı',
        deger: `${summaryData.activeSites} / ${summaryData.totalSites}`,
        detay: `${summaryData.activeSites} aktif, toplam ${summaryData.totalSites} kayıtlı şantiye projesi`,
      },
      {
        gosterge: 'Aktif Personel Kadrosu',
        deger: `${summaryData.activeStaff} / ${summaryData.totalStaff}`,
        detay: `Sahada çalışan ${summaryData.activeStaff} aktif personel`,
      },
      {
        gosterge: `${formattedMonthTitle} Toplam Mesai`,
        deger: `${summaryData.monthMesai} Saat`,
        detay: 'Puantaj ve mesai kayıtlarına göre hesaplanan toplam saat',
      },
      {
        gosterge: 'Bekleyen Personel Hakediş / Ödeme',
        deger: formatCurrency(summaryData.totalPendingPayment),
        detay: `Resmi: ${formatCurrency(summaryData.totalResmiPending)} | Elden: ${formatCurrency(summaryData.totalEldenPending)}`,
      },
      {
        gosterge: 'Kredi Kartları Toplam Borç',
        deger: formatCurrency(creditCardTotals.totalCurrentDebtTRY),
        detay: `Limit: ${formatCurrency(creditCardTotals.totalLimitTRY)} | Kalan Limit: ${formatCurrency(creditCardTotals.totalAvailableTRY)}`,
      },
      {
        gosterge: 'Çek Portföyü (Tahsil Edilecek)',
        deger: formatCurrency(checkTotals.portfolioTRY),
        detay: `Kayıtlı ${checkTotals.totalChecks} adet çek arasından portföyde bekleyenler`,
      },
      {
        gosterge: 'Firma / Müşteri Alacaklarımız',
        deger: formatCurrency(balanceOverview.companyReceivableTRY),
        detay: 'Cari hareketler sonucu tahsil edilecek hakediş ve satış bakiyesi',
      },
      {
        gosterge: 'Firmalara / Tedarikçilere Borcumuz',
        deger: formatCurrency(balanceOverview.companyPayableTRY),
        detay: 'Cari hareketler sonucu ödenecek fatura bakiyeleri',
      },
      {
        gosterge: 'Taşeron Kalan Hakediş Borcu',
        deger: formatCurrency(balanceOverview.subcontractorRemaining),
        detay: `${balanceOverview.totalSubcontractors} taşeron firması sözleşme kalanları`,
      },
      {
        gosterge: `${formattedMonthTitle} Şantiye Giderleri`,
        deger: formatCurrency(siteExpensesOverview.totalExpenseTRY),
        detay: 'Şantiyelerde bu dönem yapılan malzeme, nakliye vb. harcamalar',
      },
    ];

    const summaryRows = [
      { label: 'Rapor Dönemi', value: formattedMonthTitle },
      { label: 'Toplam Bekleyen Personel Borcu', value: formatCurrency(summaryData.totalPendingPayment) },
      { label: 'Toplam Tedarikçi Borcu', value: formatCurrency(balanceOverview.companyPayableTRY) },
      { label: 'Toplam Müşteri Alacağı', value: formatCurrency(balanceOverview.companyReceivableTRY) },
      { label: 'Portföydeki Çek Tutarı', value: formatCurrency(checkTotals.portfolioTRY) },
    ];

    return {
      title: 'İnşaat & Şantiye ERP - Genel Yönetim Özeti Raporu',
      subtitle: `Rapor Dönemi: ${formattedMonthTitle} | Tarih: ${getTodayDateString()}`,
      filename: `Genel_Dashboard_Ozeti_${getTodayDateString()}`,
      columns,
      data,
      summaryRows,
      orientation: 'portrait',
    };
  };

  return (
    <div className="space-y-6 w-full">
      {/* 1. Header Banner & Period Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700/50 w-full">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Calendar className="w-3.5 h-3.5" />
              {formattedMonthTitle}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Canlı Bulut Senkronizasyonu
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Genel Sistem ve Şantiye Özeti</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Personel puantajları, şantiye durumları, bekleyen hakedişler, kredi kartları, çekler ve cari hesapların anlık genel görünümü.
          </p>
        </div>

        {/* Action Toolbar: Period Selector & Exports */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          {/* Period Selector */}
          {onChangeMonth && (
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={currentMonthStr === 'all'}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={currentMonthStr}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold px-2 py-1 outline-none cursor-pointer border-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m === 'all' ? 'Tüm Zamanlar / Genel' : `${m}`}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={currentMonthStr === 'all'}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Print & Export Options */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => printReport(getDashboardExportOptions())}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              title="Dashboard Özetini Yazdır / Çıktı Al"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Yazdır</span>
            </button>

            <button
              type="button"
              onClick={() => exportToPDF(getDashboardExportOptions())}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              title="Dashboard Özetini PDF Olarak İndir"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => exportToExcel(getDashboardExportOptions())}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-800/60 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              title="Dashboard Özetini Excel Olarak İndir"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>

          {/* Quick Personnel Add Button */}
          <button
            id="dashboard-btn-quick-personnel"
            onClick={onOpenAddPersonnel}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">Personel Ekle</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Key Metric Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: Active Sites */}
        <div 
          onClick={() => setActiveTab('sites')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Şantiyeler
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {summaryData.activeSites}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              aktif / {summaryData.totalSites} toplam
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
            <span>Şantiye Yönetimi</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 2: Personnel */}
        <div 
          onClick={() => setActiveTab('personnel')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Personel Kadrosu
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {summaryData.activeStaff}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              çalışan / {summaryData.totalStaff} kayıtlı
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-600 font-semibold">
            <span>Personel Listesi</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 3: Overtime Hours */}
        <div 
          onClick={() => setActiveTab('attendance')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {formattedMonthTitle} Mesai
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
              {summaryData.monthMesai}
            </span>
            <span className="text-sm font-semibold text-slate-500">saat</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-amber-700 font-semibold">
            <span>Puantaj & Mesai Takvimi</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 4: Kalan Personel Alacağı */}
        <div 
          onClick={() => setActiveTab('payroll')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-bold">
              Kalan Personel Alacağı
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 font-mono">
              {formatCurrency(summaryData.totalPendingPayment)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Net Kalan Bakiye
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100">
              <span className="text-indigo-950 font-semibold flex items-center gap-1 text-[11px]">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                Resmi (Banka):
              </span>
              <div className="text-right font-mono">
                <span className="font-bold text-indigo-700">{formatCurrency(summaryData.totalResmiPending)}</span>
                <span className="text-[10px] text-slate-500 ml-1.5 font-medium">
                  (Ödenen: <strong className="text-emerald-600">{formatCurrency(summaryData.totalResmiPaid || 0)}</strong>)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-amber-50/50 px-2 py-1 rounded-lg border border-amber-100">
              <span className="text-amber-950 font-semibold flex items-center gap-1 text-[11px]">
                <Banknote className="w-3.5 h-3.5 text-amber-700" />
                Elden (Avans):
              </span>
              <div className="text-right font-mono">
                <span className="font-bold text-amber-800">{formatCurrency(summaryData.totalEldenPending)}</span>
                <span className="text-[10px] text-slate-500 ml-1.5 font-medium">
                  (Ödenen: <strong className="text-emerald-600">{formatCurrency(summaryData.totalEldenPaid || 0)}</strong>)
                </span>
              </div>
            </div>
            {onNavigateToPayrollSubTab && (
              <div className="pt-1.5 mt-0.5 border-t border-slate-100 grid grid-cols-2 gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onNavigateToPayrollSubTab('hakedis')}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] text-left truncate transition-colors cursor-pointer"
                >
                  • Tablo 2: Hakediş Cetveli
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPayrollSubTab('taseron')}
                  className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[10px] text-left truncate transition-colors cursor-pointer"
                >
                  • Taşeron Ekipleri ({taseronlar.length})
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPayrollSubTab('odemeler')}
                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[10px] text-left truncate transition-colors cursor-pointer"
                >
                  • Tablo 5: Ödeme & Avans
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToPayrollSubTab('analiz')}
                  className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[10px] text-left truncate transition-colors cursor-pointer"
                >
                  • Aylık / Yevmiyeli Analiz
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Secondary Financial & Operational Status Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
        {/* Module A: Credit Cards */}
        <div 
          onClick={() => setActiveTab('credit_cards')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-violet-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Kredi Kartları Durumu</h3>
                  <p className="text-xs text-slate-500">{creditCardTotals.cardCount} Tanımlı Şirket Kartı</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Toplam Tanımlı Limit:</span>
                <span className="font-bold text-slate-800 font-mono">{formatCurrency(creditCardTotals.totalLimitTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Güncel Toplam Borç:</span>
                <span className="font-bold text-rose-600 font-mono">{formatCurrency(creditCardTotals.totalCurrentDebtTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Kullanılabilir Kalan Limit:</span>
                <span className="font-bold text-emerald-600 font-mono">{formatCurrency(creditCardTotals.totalAvailableTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-dashed border-slate-200">
                <span className="text-slate-500">Limit Kullanım Oranı:</span>
                <span className="font-semibold text-slate-700 font-mono">
                  %{creditCardTotals.totalLimitTRY > 0 ? Math.round((creditCardTotals.totalCurrentDebtTRY / creditCardTotals.totalLimitTRY) * 100) : 0}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-violet-700">
            <span>Kart Harcamaları ve Detaylar</span>
            <span className="text-slate-400 font-normal">{creditCardTotals.expenseCount} Harcama</span>
          </div>
        </div>

        {/* Module B: Checks Portfolio */}
        <div 
          onClick={() => setActiveTab('checks')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                  <BookOpenCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Çek Portföyü Özeti</h3>
                  <p className="text-xs text-slate-500">{checkTotals.totalChecks} Kayıtlı Çek</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Portföydeki Çekler:</span>
                <span className="font-bold text-indigo-600 font-mono">{formatCurrency(checkTotals.portfolioTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Tahsilde / Tahsil Edilen:</span>
                <span className="font-bold text-emerald-600 font-mono">{formatCurrency(checkTotals.collectedTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Cirolanan Çekler:</span>
                <span className="font-bold text-amber-600 font-mono">{formatCurrency(checkTotals.endorsedTRY)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-dashed border-slate-200">
                <span className="text-slate-500">Karşılıksız / İptal:</span>
                <span className="font-semibold text-rose-600 font-mono">{formatCurrency(checkTotals.bounceOrCancelTRY)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-cyan-700">
            <span>Çek Portföyü & Vade Takibi</span>
            <span className="text-slate-400 font-normal">İncele</span>
          </div>
        </div>

        {/* Module C: Subcontractor & Company Balances */}
        <div 
          onClick={() => setActiveTab('companies')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Taşeron & Firma Cari Dengesi</h3>
                  <p className="text-xs text-slate-500">{balanceOverview.totalCompanies} Firma & {balanceOverview.totalSubcontractors} Taşeron</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Taşeron Kalan Hakediş:</span>
                <span className="font-bold text-amber-800 font-mono">{formatCurrency(balanceOverview.subcontractorRemaining)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Firma Alacaklarımız (Tahsil):</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1 font-mono">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {formatCurrency(balanceOverview.companyReceivableTRY)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Firmalara Borcumuz (Ödeme):</span>
                <span className="font-bold text-rose-600 flex items-center gap-1 font-mono">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {formatCurrency(balanceOverview.companyPayableTRY)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-dashed border-slate-200">
                <span className="text-slate-500">Net Cari Durum:</span>
                <span className={`font-bold font-mono ${balanceOverview.companyReceivableTRY >= balanceOverview.companyPayableTRY ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(balanceOverview.companyReceivableTRY - balanceOverview.companyPayableTRY)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>Cari Hareketler & Ekstreler</span>
            <span className="text-slate-400 font-normal">İncele</span>
          </div>
        </div>
      </div>

      {/* 4. Active Sites & Personnel Distribution & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
        {/* Active Sites List (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <HardHat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Aktif Şantiyeler ve Personel Dağılımı</h3>
                <p className="text-xs text-slate-500">Projelerde görevli personeller ve harcama durumu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAccountingBasis('cash')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    accountingBasis === 'cash'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Faturalar hariç, sadece fiili ödeme ve tahsilatlar şantiyeye yansıtılır"
                >
                  💵 Fiili (Nakit)
                </button>
                <button
                  type="button"
                  onClick={() => setAccountingBasis('accrual')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    accountingBasis === 'accrual'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Mükerrerliği önlemek için firmanın şantiyedeki ödenmemiş açık fatura bakiye farkı dahil edilir"
                >
                  📑 Faturalar Dahil
                </button>
              </div>

              <button
                onClick={() => setActiveTab('sites')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Tümünü Gör</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {santiyeler.filter(s => s.durum === 'Aktif').length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Aktif şantiye kaydı bulunamadı. Şantiyeler sekmesinden yeni proje ekleyebilirsiniz.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {santiyeler.filter(s => s.durum === 'Aktif').map((santiye) => {
                const staffCount = personnelList.filter(
                  (p) =>
                    p.santiyeId === santiye.id ||
                    (p.santiye && p.santiye.trim().toLowerCase() === santiye.isim.trim().toLowerCase())
                ).length;
                const siteExpense = siteExpensesOverview.siteExpenseMap[santiye.id] || 0;
                const siteRevenue = siteExpensesOverview.siteRevenueMap[santiye.id] || 0;
                const siteNet = siteRevenue - siteExpense;
                const siteName = santiye.isim || (santiye as any).ad || 'İsimsiz Şantiye';
                return (
                  <div 
                    key={santiye.id}
                    onClick={() => setActiveTab('sites')}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {siteName}
                        </h4>
                        {santiye.kod && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            {santiye.kod}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {santiye.adres || santiye.sorumlu ? `Sorumlu: ${santiye.sorumlu || '-'}` : 'Şantiye Lokasyonu'}
                      </p>
                      {(siteRevenue > 0 || siteExpense > 0) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] font-mono font-semibold">
                          {siteRevenue > 0 && (
                            <span className="text-blue-600">Gelir: {formatCurrency(siteRevenue)}</span>
                          )}
                          {siteExpense > 0 && (
                            <span className="text-rose-600">Gider: {formatCurrency(siteExpense)}</span>
                          )}
                          {siteRevenue > 0 && (
                            <span className={siteNet >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-700 font-bold'}>
                              Net: {formatCurrency(siteNet)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                      <Users className="w-3.5 h-3.5" />
                      <span>{staffCount} Kişi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Shortcut Buttons (1 col) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Hızlı İşlemler</h3>
              <p className="text-xs text-slate-500">Sık kullanılan işlemlere tek tıkla ulaşın</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onOpenAddPersonnel}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Personel Ekle</span>
              </button>

              <button
                onClick={() => setActiveTab('attendance')}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Puantaj Gir</span>
              </button>

              <button
                onClick={() => setActiveTab('payroll')}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Hakediş & Bordro</span>
              </button>

              <button
                onClick={() => setActiveTab('companies')}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Cari Hareketler</span>
              </button>

              <button
                onClick={() => setActiveTab('credit_cards')}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                  <WalletCards className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Kredi Kartları</span>
              </button>

              <button
                onClick={() => setActiveTab('checks')}
                className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <BookOpenCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Çek İşlemleri</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Veriler anlık olarak Firestore ve yerel önbellek ile senkronizedir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
