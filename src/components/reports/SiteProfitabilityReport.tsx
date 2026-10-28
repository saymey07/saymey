import React, { useState, useMemo } from 'react';
import { 
  HardHat, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Building2, 
  Calendar, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt,
  Layers,
  Users,
  User,
  Tag,
  Banknote,
  Landmark,
  RotateCcw,
  X,
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { 
  Santiye, 
  SantiyeGider, 
  FirmaCari, 
  Cek,
  Personnel, 
  PersonelOdeme, 
  Firma,
  Taseron
} from '../../types';
import { formatCurrency, DEFAULT_SANTIYE_GIDER_KATEGORILERI } from '../../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { 
  getCanonicalFirmKey, 
  allocateInvoicePaymentsFIFO, 
  allocateInvoiceCollectionsFIFO 
} from '../../utils/siteAccountingUtils';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface SiteProfitabilityReportProps {
  santiyeler: Santiye[];
  giderler: SantiyeGider[];
  cariList: FirmaCari[];
  cekler?: Cek[];
  firmalar: Firma[];
  taseronlar?: Taseron[];
  personnelList: Personnel[];
  odemeList: PersonelOdeme[];
}

export interface UnifiedSiteExpenseItem {
  id: string;
  santiyeId: string;
  santiyeIsim: string;
  tarih: string;
  kaynakTuru: 'santiye_masraf' | 'taseron_cari' | 'personel_odeme' | 'tedarikci_cari';
  kategori: string;
  odemeAltTuru?: 'avans' | 'resmi' | 'harcama' | 'karma';
  odemeAltTuruLabel?: string;
  personelId?: string;
  personelAdi?: string;
  personelKategori?: string;
  taseronAdi?: string;
  isOwnStaff?: boolean;
  ilgiliKisiFirma: string;
  aciklama: string;
  odemeYontemi: string;
  orijinalMiktar: number;
  paraBirimi: string;
  tutarTRY: number;
  avansTRY: number;
  resmiTRY: number;
  harcamaTRY: number;
  isInvoice?: boolean;
  faturaNo?: string;
  faturaTutariTRY?: number;
  odenenTutarTRY?: number;
  acikFarkTRY?: number;
  faturaDurum?: 'tamamen_odendi' | 'kismen_odendi' | 'odenmedi';
}

export interface UnifiedSiteRevenueItem {
  id: string;
  cariId: string;
  santiyeId: string;
  santiyeIsim: string;
  tarih: string;
  saat?: string;
  firmaId: string;
  firmaAdi: string;
  faturaNo: string;
  islemTuruLabel: string;
  islemTuru: 'satis_faturasi' | 'tahsilat' | 'proje_gelir';
  aciklama: string;
  orijinalMiktar: number;
  paraBirimi: string;
  tutarTRY: number;
  isInvoice?: boolean;
  faturaTutariTRY?: number;
  tahsilEdilenTutarTRY?: number;
  acikFarkTRY?: number;
  faturaDurum?: 'tamamen_tahsil' | 'kismen_tahsil' | 'tahsil_edilmedi';
}

const MONTHS_TR = [
  { value: '01', label: 'Ocak' },
  { value: '02', label: 'Şubat' },
  { value: '03', label: 'Mart' },
  { value: '04', label: 'Nisan' },
  { value: '05', label: 'Mayıs' },
  { value: '06', label: 'Haziran' },
  { value: '07', label: 'Temmuz' },
  { value: '08', label: 'Ağustos' },
  { value: '09', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

export const SiteProfitabilityReport: React.FC<SiteProfitabilityReportProps> = ({
  santiyeler,
  giderler,
  cariList,
  cekler = [],
  firmalar,
  taseronlar = [],
  personnelList,
  odemeList,
}) => {
  const exchangeRates = getSavedExchangeRates();
  const currentYear = new Date().getFullYear();

  // Primary Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expense Category & Personnel Payment Filters
  const [expenseScope, setExpenseScope] = useState<'all' | 'site_expenses' | 'personnel_payments'>('all');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('all');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('all');
  const [selectedPaymentType, setSelectedPaymentType] = useState<'all' | 'avans' | 'resmi' | 'harcama'>('all');
  const [selectedPersonnelCategory, setSelectedPersonnelCategory] = useState<string>('all');

  // Accounting Basis: 'cash' (Default: Only actual payments & collections) vs 'accrual' (Invoices included)
  const [accountingBasis, setAccountingBasis] = useState<'cash' | 'accrual'>('cash');

  // Helper: Find which site a personnel belongs to (strictly by personnel's assigned site)
  const findPersonnelSite = (person: Personnel): Santiye | undefined => {
    return santiyeler.find(
      (s) =>
        (person.santiyeId && (s.id === person.santiyeId || s.isim.trim().toLowerCase() === person.santiyeId.trim().toLowerCase())) ||
        (person.santiye && (s.isim.trim().toLowerCase() === person.santiye.trim().toLowerCase() || s.id === person.santiye.trim()))
    );
  };

  // Helper: Find which site a payment belongs to (locking to payment's recorded site, falling back to personnel's assigned site)
  const findOdemeSite = (o: PersonelOdeme, person?: Personnel): Santiye | undefined => {
    const paymentSiteId = (o as any).santiyeId;
    const paymentSiteName = (o as any).santiyeAdi || (o as any).santiye;
    if (paymentSiteId) {
      const match = santiyeler.find(
        (s) => s.id === paymentSiteId || s.isim.trim().toLowerCase() === paymentSiteId.trim().toLowerCase()
      );
      if (match) return match;
    }
    if (paymentSiteName) {
      const match = santiyeler.find(
        (s) => s.isim.trim().toLowerCase() === paymentSiteName.trim().toLowerCase()
      );
      if (match) return match;
    }
    if (person) {
      return findPersonnelSite(person);
    }
    return undefined;
  };

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1, currentYear - 2]);
    giderler.forEach((g) => {
      const y = parseInt((g.tarih || '').substring(0, 4), 10);
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    odemeList.forEach((o) => {
      const y = parseInt((o.tarih || '').substring(0, 4), 10);
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    cariList.forEach((c) => {
      const y = parseInt((c.tarih || '').substring(0, 4), 10);
      if (!isNaN(y) && y > 2000) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [giderler, odemeList, cariList, currentYear]);

  // All available site expense categories
  const availableExpenseCategories = useMemo(() => {
    const catSet = new Set<string>(DEFAULT_SANTIYE_GIDER_KATEGORILERI);
    giderler.forEach((g) => {
      if (g.kategori) catSet.add(g.kategori);
    });
    catSet.add('Taşeron Cari Ödemesi');
    catSet.add('Alış Faturası / Malzeme Alımı');
    catSet.add('Tedarikçi / Cari Ödemesi');
    return Array.from(catSet);
  }, [giderler]);

  // Personnel options filtered by selected site
  const siteLinkedPersonnelList = useMemo(() => {
    return personnelList.filter((p) => {
      const site = findPersonnelSite(p);
      if (!site) return false;
      if (selectedSiteId !== 'all' && site.id !== selectedSiteId) return false;
      return true;
    });
  }, [personnelList, santiyeler, selectedSiteId]);

  // Distinct personnel professions/categories
  const availablePersonnelCategories = useMemo(() => {
    const set = new Set<string>();
    siteLinkedPersonnelList.forEach((p) => {
      if (p.kategori?.trim()) set.add(p.kategori.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [siteLinkedPersonnelList]);

  // Date period matcher
  const matchesDatePeriod = (tarih?: string) => {
    if (!tarih) return selectedYear === 'all' && selectedMonth === 'all';
    if (selectedYear !== 'all' && !tarih.startsWith(`${selectedYear}`)) return false;
    if (selectedMonth !== 'all') {
      const mPart = tarih.substring(5, 7);
      if (mPart !== selectedMonth) return false;
    }
    return true;
  };

  const findSiteByIdOrName = (siteId?: string, siteName?: string): Santiye | undefined => {
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

  // Build all unified expense & personnel payment items across sites
  const allSiteExpenseItems = useMemo<UnifiedSiteExpenseItem[]>(() => {
    const items: UnifiedSiteExpenseItem[] = [];
    const existingGiderIds = new Set(giderler.map((g) => g.id));
    const existingCariIdsInGiderler = new Set(
      giderler.map((g) => g.cariHareketId).filter(Boolean) as string[]
    );
    const existingCekIdsInGiderler = new Set(
      giderler.map((g) => g.cekId).filter(Boolean) as string[]
    );
    const processedCekIds = new Set<string>(existingCekIdsInGiderler);

    // Track actual payments made to each firm/subcontractor per site: siteId -> firmKey -> totalPaymentsTRY
    const siteFirmPayments: Record<string, Record<string, number>> = {};
    const pendingPurchaseInvoices: Array<{
      c: FirmaCari;
      targetSite: Santiye;
      isTas: boolean;
      tasName: string;
      firmKey: string;
      rawAmt: number;
      cur: string;
      tryVal: number;
    }> = [];

    // 1. Direct Site Expenses (Şantiye Masraf Fişleri)
    giderler.forEach((g) => {
      const linkedCek = (cekler || []).find(
        (ck) =>
          (g.cekId && ck.id === g.cekId) ||
          (g.cariHareketId && (ck.cariHareketId === g.cariHareketId || ck.ciroCariHareketId === g.cariHareketId))
      );
      const linkedCari = g.cariHareketId
        ? cariList.find((c) => c.id === g.cariHareketId)
        : undefined;

      let site = findSiteByIdOrName(g.santiyeId, g.santiyeId);
      if (linkedCek) {
        const isCiroMatch = Boolean(g.cariHareketId && linkedCek.ciroCariHareketId === g.cariHareketId);
        const cekSite = isCiroMatch
          ? findSiteByIdOrName(
              linkedCari?.santiyeId || linkedCek.ciroSantiyeId || linkedCek.santiyeId,
              linkedCari?.santiyeAdi || linkedCek.ciroSantiyeProje || linkedCek.santiyeProje
            )
          : findSiteByIdOrName(
              linkedCari?.santiyeId || linkedCek.santiyeId,
              linkedCari?.santiyeAdi || linkedCek.santiyeProje
            );
        if (cekSite) site = cekSite;
      } else if (linkedCari && (linkedCari.santiyeId || linkedCari.santiyeAdi)) {
        const cariSite = findSiteByIdOrName(linkedCari.santiyeId, linkedCari.santiyeAdi);
        if (cariSite) site = cariSite;
      }

      if (!site) return;

      const cur = g.paraBirimi || 'TRY';
      const rawAmt = Number(g.miktar ?? (g as any).tutar ?? 0);
      if (rawAmt <= 0) return;
      const tryVal = convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      // Record actual payment towards the firm's balance pool on this site
      const firmKey = getCanonicalFirmKey(g.cariFirmaId, g.taseron || g.odemeYapilanFirma, firmalar, taseronlar);
      siteFirmPayments[site.id] = siteFirmPayments[site.id] || {};
      siteFirmPayments[site.id][firmKey] = (siteFirmPayments[site.id][firmKey] || 0) + tryVal;

      items.push({
        id: g.id,
        santiyeId: site.id,
        santiyeIsim: site.isim,
        tarih: g.tarih || '',
        kaynakTuru: 'santiye_masraf',
        kategori: g.kategori || 'Diğer',
        taseronAdi: g.taseron || undefined,
        ilgiliKisiFirma: g.odemeYapilanFirma || g.taseron || g.odeyen || '-',
        aciklama: g.aciklama || g.kategori || 'Şantiye Masrafı',
        odemeYontemi: g.odemeYontemi || 'Nakit',
        orijinalMiktar: rawAmt,
        paraBirimi: cur,
        tutarTRY: tryVal,
        avansTRY: 0,
        resmiTRY: 0,
        harcamaTRY: 0,
      });
    });

    // 2. Subcontractor & Supplier Cari & Invoices linked to a selected site
    cariList.forEach((c) => {
      const isAlisFaturasi = c.islemTuru === 'alis_faturasi';
      const isOdeme = c.islemTuru === 'odeme';
      const isExplicitRevenue = c.islemTuru === 'satis_faturasi' || c.islemTuru === 'tahsilat';
      if (isExplicitRevenue) return;

      const firma = firmalar.find((f) => f.id === c.firmaId);
      const isCustomer = firma?.tur === 'musteri';
      if (isCustomer && !isAlisFaturasi) return;

      const isExpense = isAlisFaturasi || isOdeme || ((c.alacak || 0) > 0) || ((c.borc || 0) > 0);
      if (!isExpense) return;

      // Nakit esaslı hesaplamada alış faturaları gider sayılmaz; sadece fiili ödemeler gider yazılır
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
      const tasName = matchingTas?.isim || firma?.isim || 'Firma / Tedarikçi';

      const linkedCek = (cekler || []).find(
        (ck) =>
          (c.cekId && ck.id === c.cekId) ||
          ck.cariHareketId === c.id ||
          ck.ciroCariHareketId === c.id ||
          (c.faturaNo && ck.cekNo && c.faturaNo.includes(ck.cekNo))
      );

      if (linkedCek) {
        processedCekIds.add(linkedCek.id);
      }

      // Sadece seçilen şantiyeye göre eşleştir
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

      const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
      const rawAmt = Math.max(Number(c.borc || 0), Number(c.alacak || 0));
      if (rawAmt <= 0) return;
      const tryVal =
        c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
          ? rawAmt * c.dovizKuru
          : convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      const firmKey = getCanonicalFirmKey(c.firmaId, tasName, firmalar, taseronlar);

      if (isAlisFaturasi) {
        // Alış faturalarını şantiyeye yapılan fiili ödemeler havuzuyla FIFO eşleştirmek üzere topla
        pendingPurchaseInvoices.push({
          c,
          targetSite,
          isTas,
          tasName,
          firmKey,
          rawAmt,
          cur,
          tryVal,
        });
        return;
      }

      // Fiili ödeme: firmanın şantiyedeki ödemeler havuzuna ekle
      siteFirmPayments[targetSite.id] = siteFirmPayments[targetSite.id] || {};
      siteFirmPayments[targetSite.id][firmKey] = (siteFirmPayments[targetSite.id][firmKey] || 0) + tryVal;

      const isCiro = linkedCek?.ciroCariHareketId === c.id || Boolean(c.faturaNo?.toUpperCase().startsWith('CİRO'));
      const odemeYontemiLabel = linkedCek
        ? `${isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'} (${linkedCek.cekNo})`
        : (c.odemeYontemi || (isTas ? 'Taşeron Cari Hesabı' : 'Firma Cari Hesabı'));

      const kategoriLabel = linkedCek
        ? (isTas ? 'Taşeron Çek Ödemesi' : 'Tedarikçi Çek Ödemesi')
        : isTas
        ? 'Taşeron Cari Ödemesi'
        : 'Tedarikçi / Cari Ödemesi';

      items.push({
        id: `cari-gider-${c.id}`,
        santiyeId: targetSite.id,
        santiyeIsim: targetSite.isim,
        tarih: c.tarih || '',
        kaynakTuru: isTas ? 'taseron_cari' : 'tedarikci_cari',
        kategori: kategoriLabel,
        taseronAdi: isTas ? tasName : undefined,
        ilgiliKisiFirma: tasName,
        aciklama: c.aciklama || `[Cari Ödeme] ${tasName}`,
        odemeYontemi: odemeYontemiLabel,
        orijinalMiktar: rawAmt,
        paraBirimi: cur,
        tutarTRY: tryVal,
        avansTRY: 0,
        resmiTRY: 0,
        harcamaTRY: 0,
      });
    });

    // 2B. Çek Takibinde şantiye seçilerek taşerona verilen / ciro edilen ancak cari harekette yer almayan çekler
    (cekler || []).forEach((ck) => {
      if (processedCekIds.has(ck.id)) return;
      if (ck.cariHareketId && existingCariIdsInGiderler.has(ck.cariHareketId)) return;
      if (ck.ciroCariHareketId && existingCariIdsInGiderler.has(ck.ciroCariHareketId)) return;

      const isVerilen = ck.cekTuru === 'verilen_cek';
      const isCiro = ck.durum === 'Ciro Edildi';
      if (!isVerilen && !isCiro) return;

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
        if (matchingTas || firma?.tur === 'taseron') {
          tasName = matchingTas?.isim || firma?.isim || ck.hamil;
        }
      }

      if (!tasName) return;

      const targetSite = isCiro
        ? findSiteByIdOrName(ck.ciroSantiyeId || ck.santiyeId, ck.ciroSantiyeProje || ck.santiyeProje)
        : findSiteByIdOrName(ck.santiyeId, ck.santiyeProje);

      if (!targetSite) return;

      const cur = ck.paraBirimi || 'TRY';
      const rawAmt = Number(ck.miktar || 0);
      if (rawAmt <= 0) return;
      const tryVal = convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      const firmKey = getCanonicalFirmKey(firmId, tasName, firmalar, taseronlar);
      siteFirmPayments[targetSite.id] = siteFirmPayments[targetSite.id] || {};
      siteFirmPayments[targetSite.id][firmKey] = (siteFirmPayments[targetSite.id][firmKey] || 0) + tryVal;

      items.push({
        id: `cek-gider-${ck.id}`,
        santiyeId: targetSite.id,
        santiyeIsim: targetSite.isim,
        tarih: (isCiro ? ck.ciroTarihi : ck.alinanTarih) || '',
        kaynakTuru: 'taseron_cari',
        kategori: 'Taşeron Çek Ödemesi',
        taseronAdi: tasName,
        ilgiliKisiFirma: tasName,
        aciklama: `[${isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'}] ${ck.bankaAdi} - Çek No: ${ck.cekNo} (Vade: ${ck.vadeTarihi || '-'}) [${targetSite.isim}]${ck.aciklama ? ` - ${ck.aciklama}` : ''}`,
        odemeYontemi: `${isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'} (${ck.cekNo})`,
        orijinalMiktar: rawAmt,
        paraBirimi: cur,
        tutarTRY: tryVal,
        avansTRY: 0,
        resmiTRY: 0,
        harcamaTRY: 0,
      });
    });

    // 2C. Faturalar Dahil (Tahakkuk) Modunda: Alış faturalarını firma bazında FIFO ile eşleştir ve yalnızca AÇIK FARKI ekle
    if (accountingBasis === 'accrual' && pendingPurchaseInvoices.length > 0) {
      // Group by site and firmKey
      const groups: Record<string, typeof pendingPurchaseInvoices> = {};
      pendingPurchaseInvoices.forEach((inv) => {
        const groupKey = `${inv.targetSite.id}___${inv.firmKey}`;
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
          const paidPart = alloc?.paidAmountTRY ?? 0;
          const status = alloc?.status ?? 'odenmedi';

          items.push({
            id: `cari-gider-${inv.c.id}`,
            santiyeId: inv.targetSite.id,
            santiyeIsim: inv.targetSite.isim,
            tarih: inv.c.tarih || '',
            kaynakTuru: inv.isTas ? 'taseron_cari' : 'tedarikci_cari',
            kategori: 'Alış Faturası / Malzeme Alımı',
            taseronAdi: inv.isTas ? inv.tasName : undefined,
            ilgiliKisiFirma: inv.tasName,
            aciklama: inv.c.aciklama
              ? `${inv.c.aciklama} ${status === 'tamamen_odendi' ? '[Tamamı Ödendi - Açık Fark: 0 TL]' : status === 'kismen_odendi' ? `[Kısmen Ödendi - Kalan Açık Fark: ${formatCurrency(openDiff)}]` : `[Açık Fatura: ${formatCurrency(openDiff)}]`}`
              : status === 'tamamen_odendi'
              ? `[Alış Faturası - Ödendi] ${inv.tasName} (0 TL Açık Fark)`
              : status === 'kismen_odendi'
              ? `[Alış Faturası - Kısmen Ödendi] ${inv.tasName} (Kalan Açık Fark: ${formatCurrency(openDiff)})`
              : `[Açık Alış Faturası] ${inv.tasName} (${formatCurrency(openDiff)})`,
            odemeYontemi: 'Alış Faturası (Cari)',
            orijinalMiktar: inv.rawAmt,
            paraBirimi: inv.cur,
            tutarTRY: openDiff, // Yalnızca açık fark eklenir; fatura tamamen ödendiyse 0 TL eklenerek mükerrerlik önlenir!
            avansTRY: 0,
            resmiTRY: 0,
            harcamaTRY: 0,
            isInvoice: true,
            faturaNo: inv.c.faturaNo,
            faturaTutariTRY: inv.tryVal,
            odenenTutarTRY: paidPart,
            acikFarkTRY: openDiff,
            faturaDurum: status,
          });
        });
      });
    }

    // 3. Personnel Payments for Personnel Linked to a Site (Şantiyeye Bağlı Personellere Yapılan Ödemeler)
    odemeList.forEach((o) => {
      if (existingGiderIds.has(o.id) || ((o as any).giderId && existingGiderIds.has((o as any).giderId))) return;

      const person = personnelList.find((p) => p.id === o.personelId);
      if (!person) return;

      const targetSite = findOdemeSite(o, person);
      if (!targetSite) return;

      const cur = o.paraBirimi || 'TRY';
      const avansRaw = Number(o.avansOdemesi) || 0;
      const resmiRaw = Number(o.resmiOdeme) || 0;
      const harcamaRaw = Number(o.yaptigiHarcama) || 0;
      const legacyRaw = avansRaw === 0 && resmiRaw === 0 && harcamaRaw === 0 ? (Number((o as any).miktar) || 0) : 0;

      const effectiveAvansRaw = avansRaw + legacyRaw;
      const totalRaw = effectiveAvansRaw + resmiRaw + harcamaRaw;
      if (totalRaw <= 0) return;

      const avansTRY = convertCurrencyToTRY(effectiveAvansRaw, cur, exchangeRates.rates);
      const resmiTRY = convertCurrencyToTRY(resmiRaw, cur, exchangeRates.rates);
      const harcamaTRY = convertCurrencyToTRY(harcamaRaw, cur, exchangeRates.rates);
      const totalTRY = avansTRY + resmiTRY + harcamaTRY;

      let odemeAltTuru: 'avans' | 'resmi' | 'harcama' | 'karma' = 'avans';
      let odemeAltTuruLabel = 'Elden / Avans Ödemesi';

      if (effectiveAvansRaw > 0 && resmiRaw > 0) {
        odemeAltTuru = 'karma';
        odemeAltTuruLabel = 'Avans + Resmi Ödeme';
      } else if (resmiRaw > 0) {
        odemeAltTuru = 'resmi';
        odemeAltTuruLabel = 'Resmi / Banka Maaş';
      } else if (harcamaRaw > 0 && effectiveAvansRaw === 0) {
        odemeAltTuru = 'harcama';
        odemeAltTuruLabel = 'Harcama İadesi';
      }

      const personTas = person.taseron?.trim();
      const isOwnStaff = !personTas || personTas.toLowerCase() === 'kendi personelimiz';
      const fullName = `${person.isim} ${person.soyisim}`;

      items.push({
        id: `pers-odeme-${o.id}`,
        santiyeId: targetSite.id,
        santiyeIsim: targetSite.isim,
        tarih: o.tarih || '',
        kaynakTuru: 'personel_odeme',
        kategori: 'Personel & İşçilik Ödemeleri',
        odemeAltTuru,
        odemeAltTuruLabel,
        personelId: person.id,
        personelAdi: fullName,
        personelKategori: person.kategori || 'Personel',
        taseronAdi: isOwnStaff ? undefined : personTas,
        isOwnStaff,
        ilgiliKisiFirma: `${fullName}${person.kategori ? ` (${person.kategori})` : ''}${!isOwnStaff ? ` • ${personTas}` : ''}`,
        aciklama: o.aciklama
          ? `${fullName} - ${o.aciklama} (${odemeAltTuruLabel})`
          : `${fullName} - ${odemeAltTuruLabel}`,
        odemeYontemi: o.odemeYontemi || (effectiveAvansRaw > 0 ? 'Elden / Nakit' : 'Banka Havalesi'),
        orijinalMiktar: totalRaw,
        paraBirimi: cur,
        tutarTRY: totalTRY,
        avansTRY,
        resmiTRY,
        harcamaTRY,
      });
    });

    return items.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  }, [giderler, cariList, cekler, firmalar, taseronlar, personnelList, odemeList, santiyeler, exchangeRates.rates, accountingBasis]);

  // Helper: Check if an item matches active expense/personnel filters
  const matchesExpenseAndPersonnelFilters = (item: UnifiedSiteExpenseItem): { included: boolean; effectiveAmountTRY: number } => {
    // 1. Date filter
    if (!matchesDatePeriod(item.tarih)) return { included: false, effectiveAmountTRY: 0 };

    // 2. Scope filter (Tümü vs Sadece Şantiye Masrafları vs Sadece Personel Ödemeleri)
    const isPersonnelPayment = item.kaynakTuru === 'personel_odeme';
    if (expenseScope === 'site_expenses' && isPersonnelPayment) {
      return { included: false, effectiveAmountTRY: 0 };
    }
    if (expenseScope === 'personnel_payments' && !isPersonnelPayment) {
      return { included: false, effectiveAmountTRY: 0 };
    }

    // 3. Site expense category filter
    if (!isPersonnelPayment) {
      if (selectedExpenseCategory !== 'all' && item.kategori !== selectedExpenseCategory) {
        return { included: false, effectiveAmountTRY: 0 };
      }
      // If user specifically filtered a single personnel or payment type while scope is 'all', keep site expenses only if no personnel-specific filter is narrowing to a single person, OR let both work independently
      return { included: true, effectiveAmountTRY: item.tutarTRY };
    }

    // 4. Personnel Payment specific filters
    if (selectedPersonnelId !== 'all' && item.personelId !== selectedPersonnelId) {
      return { included: false, effectiveAmountTRY: 0 };
    }

    if (selectedPersonnelCategory !== 'all') {
      if (selectedPersonnelCategory === 'kendi_personelimiz') {
        if (!item.isOwnStaff) return { included: false, effectiveAmountTRY: 0 };
      } else if (selectedPersonnelCategory === 'taseron_ekibi') {
        if (item.isOwnStaff) return { included: false, effectiveAmountTRY: 0 };
      } else if (item.personelKategori !== selectedPersonnelCategory) {
        return { included: false, effectiveAmountTRY: 0 };
      }
    }

    if (selectedPaymentType !== 'all') {
      if (selectedPaymentType === 'avans') {
        if (item.avansTRY <= 0) return { included: false, effectiveAmountTRY: 0 };
        return { included: true, effectiveAmountTRY: item.avansTRY };
      }
      if (selectedPaymentType === 'resmi') {
        if (item.resmiTRY <= 0) return { included: false, effectiveAmountTRY: 0 };
        return { included: true, effectiveAmountTRY: item.resmiTRY };
      }
      if (selectedPaymentType === 'harcama') {
        if (item.harcamaTRY <= 0) return { included: false, effectiveAmountTRY: 0 };
        return { included: true, effectiveAmountTRY: item.harcamaTRY };
      }
    }

    return { included: true, effectiveAmountTRY: item.tutarTRY };
  };

  // Build Unified List of ALL Site Revenue Items (Cari Hareket / Fatura & Tahsilat linked to a Site)
  const allSiteRevenueItems = useMemo<UnifiedSiteRevenueItem[]>(() => {
    const revItems: UnifiedSiteRevenueItem[] = [];
    const siteCustCollections: Record<string, Record<string, number>> = {};
    const pendingSalesInvoices: Array<{
      c: FirmaCari;
      targetSite: Santiye;
      matchingFirma?: Firma;
      custKey: string;
      rawAmt: number;
      cur: string;
      tryVal: number;
    }> = [];

    cariList.forEach((c) => {
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

      if (isSubcontractor && c.islemTuru !== 'satis_faturasi' && c.islemTuru !== 'tahsilat') {
        return;
      }
      if (c.islemTuru === 'alis_faturasi' || c.islemTuru === 'odeme') {
        return;
      }

      // Nakit esaslı hesaplamada satış faturaları gelir sayılmaz, sadece fiili tahsilatlar gelir yazılır
      if (accountingBasis === 'cash' && c.islemTuru !== 'tahsilat') {
        return;
      }

      const linkedCek = (cekler || []).find(
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
          : convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      const custKey = getCanonicalFirmKey(c.firmaId, matchingFirma?.isim, firmalar, taseronlar);

      if (c.islemTuru === 'satis_faturasi') {
        pendingSalesInvoices.push({
          c,
          targetSite,
          matchingFirma,
          custKey,
          rawAmt,
          cur,
          tryVal,
        });
        return;
      }

      // Fiili Tahsilat: müşterinin şantiyedeki tahsilatlar havuzuna ekle
      siteCustCollections[targetSite.id] = siteCustCollections[targetSite.id] || {};
      siteCustCollections[targetSite.id][custKey] = (siteCustCollections[targetSite.id][custKey] || 0) + tryVal;

      revItems.push({
        id: `rev-${c.id}`,
        cariId: c.id,
        santiyeId: targetSite.id,
        santiyeIsim: targetSite.isim,
        tarih: c.tarih || '',
        saat: c.saat,
        firmaId: c.firmaId,
        firmaAdi: matchingFirma?.isim || 'Bilinmeyen Firma',
        faturaNo: c.faturaNo || '-',
        islemTuru: 'tahsilat',
        islemTuruLabel: 'Müşteri Tahsilatı',
        aciklama: c.aciklama || 'Şantiye Tahsilatı',
        orijinalMiktar: rawAmt,
        paraBirimi: cur,
        tutarTRY: tryVal,
      });
    });

    // Faturalar Dahil modunda: Satış faturalarını FIFO ile tahsilat havuzuyla eşleştir ve yalnızca AÇIK FARKI ekle
    if (accountingBasis === 'accrual' && pendingSalesInvoices.length > 0) {
      const groups: Record<string, typeof pendingSalesInvoices> = {};
      pendingSalesInvoices.forEach((inv) => {
        const groupKey = `${inv.targetSite.id}___${inv.custKey}`;
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
          const collectedPart = alloc?.collectedAmountTRY ?? 0;
          const status = alloc?.status ?? 'tahsil_edilmedi';

          revItems.push({
            id: `rev-${inv.c.id}`,
            cariId: inv.c.id,
            santiyeId: inv.targetSite.id,
            santiyeIsim: inv.targetSite.isim,
            tarih: inv.c.tarih || '',
            saat: inv.c.saat,
            firmaId: inv.c.firmaId,
            firmaAdi: inv.matchingFirma?.isim || 'Bilinmeyen Firma',
            faturaNo: inv.c.faturaNo || '-',
            islemTuru: 'satis_faturasi',
            islemTuruLabel: status === 'tamamen_tahsil' ? 'Satış Faturası (Tahsil Edildi)' : 'Satış / Hakediş Faturası',
            aciklama: inv.c.aciklama
              ? `${inv.c.aciklama} ${status === 'tamamen_tahsil' ? '[Tamamı Tahsil Edildi - Açık Fark: 0 TL]' : status === 'kismen_tahsil' ? `[Kısmen Tahsil Edildi - Kalan Açık Fark: ${formatCurrency(openDiff)}]` : `[Açık Fatura: ${formatCurrency(openDiff)}]`}`
              : status === 'tamamen_tahsil'
              ? `[Satış Faturası - Tahsil Edildi] ${inv.matchingFirma?.isim || ''} (0 TL Açık Fark)`
              : status === 'kismen_tahsil'
              ? `[Satış Faturası - Kısmen Tahsil] ${inv.matchingFirma?.isim || ''} (Kalan Açık Fark: ${formatCurrency(openDiff)})`
              : `[Açık Satış Faturası] ${inv.matchingFirma?.isim || ''} (${formatCurrency(openDiff)})`,
            orijinalMiktar: inv.rawAmt,
            paraBirimi: inv.cur,
            tutarTRY: openDiff, // Yalnızca açık alacak farkı şantiye gelirine eklenir! Tamamen tahsil edildiyse 0 TL eklenerek mükerrerlik önlenir!
            isInvoice: true,
            faturaTutariTRY: inv.tryVal,
            tahsilEdilenTutarTRY: collectedPart,
            acikFarkTRY: openDiff,
            faturaDurum: status,
          });
        });
      });
    }

    return revItems.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  }, [cariList, cekler, firmalar, taseronlar, odemeList, santiyeler, exchangeRates.rates, accountingBasis]);

  // Calculate profitability metrics for each site
  const siteProfitabilityList = useMemo(() => {
    return santiyeler.map((site) => {
      const siteItems = allSiteExpenseItems.filter((item) => item.santiyeId === site.id);

      let siteMasrafTRY = 0;
      let sitePersonelOdemeTRY = 0;
      let siteAvansTRY = 0;
      let siteResmiTRY = 0;
      let siteExpenseReceiptCount = 0;
      let sitePersonnelPaymentCount = 0;
      const expenseByCategory: Record<string, number> = {};

      siteItems.forEach((item) => {
        const { included, effectiveAmountTRY } = matchesExpenseAndPersonnelFilters(item);
        if (!included || (effectiveAmountTRY <= 0 && !item.isInvoice)) return;

        if (item.kaynakTuru === 'personel_odeme') {
          sitePersonelOdemeTRY += effectiveAmountTRY;
          siteAvansTRY += selectedPaymentType === 'resmi' || selectedPaymentType === 'harcama' ? 0 : item.avansTRY;
          siteResmiTRY += selectedPaymentType === 'avans' || selectedPaymentType === 'harcama' ? 0 : item.resmiTRY;
          sitePersonnelPaymentCount += 1;
          expenseByCategory['Personel & İşçilik Ödemeleri'] =
            (expenseByCategory['Personel & İşçilik Ödemeleri'] || 0) + effectiveAmountTRY;
        } else {
          siteMasrafTRY += effectiveAmountTRY;
          siteExpenseReceiptCount += 1;
          const cat = item.kategori || 'Diğer';
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + effectiveAmountTRY;
        }
      });

      const sitePersonnel = personnelList.filter((p) => {
        const s = findPersonnelSite(p);
        return s?.id === site.id;
      });

      // Şantiyeye bağlı personellere yapılan ödemeler şantiye giderler hanesine eklenir:
      const totalMasraf = Math.round(siteMasrafTRY);
      const totalPersonelOdeme = Math.round(sitePersonelOdemeTRY);
      const totalGider = Math.round(siteMasrafTRY + sitePersonelOdemeTRY);

      // 3. Site Revenues (Gelirler - Cari Hareket / Fatura & Tahsilat):
      const siteRevenues = allSiteRevenueItems.filter(
        (rev) => rev.santiyeId === site.id && matchesDatePeriod(rev.tarih)
      );

      const totalGelirTRY = siteRevenues.reduce((sum, rev) => sum + rev.tutarTRY, 0);

      const totalGelir = Math.round(totalGelirTRY);
      const netKar = totalGelir - totalGider;
      const karMarji = totalGelir > 0 ? (netKar / totalGelir) * 100 : totalGider > 0 ? -100 : 0;

      return {
        site,
        totalGelir,
        revenueCount: siteRevenues.length,
        totalMasraf,
        totalPersonelOdeme,
        siteAvansTRY: Math.round(siteAvansTRY),
        siteResmiTRY: Math.round(siteResmiTRY),
        totalGider,
        netKar,
        karMarji: Math.round(karMarji * 10) / 10,
        expenseCount: siteExpenseReceiptCount,
        personnelPaymentCount: sitePersonnelPaymentCount,
        personnelCount: sitePersonnel.length,
        expenseByCategory,
      };
    });
  }, [
    santiyeler,
    allSiteExpenseItems,
    allSiteRevenueItems,
    personnelList,
    selectedYear,
    selectedMonth,
    expenseScope,
    selectedExpenseCategory,
    selectedPersonnelId,
    selectedPaymentType,
    selectedPersonnelCategory,
  ]);

  // Filtered by selected site & search query
  const filteredSiteReports = useMemo(() => {
    return siteProfitabilityList.filter((item) => {
      if (selectedSiteId !== 'all' && item.site.id !== selectedSiteId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = item.site.isim.toLowerCase();
        const client = (item.site.yetkiliFirma || '').toLowerCase();
        const city = (item.site.il || '').toLowerCase();
        const hasMatchingExpense = allSiteExpenseItems.some(
          (exp) =>
            exp.santiyeId === item.site.id &&
            (exp.aciklama.toLowerCase().includes(q) ||
              exp.ilgiliKisiFirma.toLowerCase().includes(q) ||
              exp.kategori.toLowerCase().includes(q))
        );
        const hasMatchingRevenue = allSiteRevenueItems.some(
          (rev) =>
            rev.santiyeId === item.site.id &&
            (rev.aciklama.toLowerCase().includes(q) ||
              rev.firmaAdi.toLowerCase().includes(q) ||
              rev.faturaNo.toLowerCase().includes(q))
        );
        if (!name.includes(q) && !client.includes(q) && !city.includes(q) && !hasMatchingExpense && !hasMatchingRevenue) {
          return false;
        }
      }
      return true;
    });
  }, [siteProfitabilityList, selectedSiteId, searchQuery, allSiteExpenseItems, allSiteRevenueItems]);

  // Filtered detailed revenue records for the revenue detail table
  const filteredRevenueItems = useMemo(() => {
    const allowedSiteIds = new Set(filteredSiteReports.map((r) => r.site.id));
    return allSiteRevenueItems.filter((rev) => {
      if (!allowedSiteIds.has(rev.santiyeId)) return false;
      if (!matchesDatePeriod(rev.tarih)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchText =
          rev.santiyeIsim.toLowerCase().includes(q) ||
          rev.firmaAdi.toLowerCase().includes(q) ||
          rev.faturaNo.toLowerCase().includes(q) ||
          rev.aciklama.toLowerCase().includes(q) ||
          rev.islemTuruLabel.toLowerCase().includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [allSiteRevenueItems, filteredSiteReports, selectedYear, selectedMonth, searchQuery]);

  // Filtered detailed expense & personnel payment records for the detail table
  const filteredDetailedItems = useMemo(() => {
    const allowedSiteIds = new Set(filteredSiteReports.map((r) => r.site.id));
    return allSiteExpenseItems
      .map((item) => {
        if (!allowedSiteIds.has(item.santiyeId)) return null;
        const { included, effectiveAmountTRY } = matchesExpenseAndPersonnelFilters(item);
        if (!included || (effectiveAmountTRY <= 0 && !item.isInvoice)) return null;

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchText =
            item.santiyeIsim.toLowerCase().includes(q) ||
            item.kategori.toLowerCase().includes(q) ||
            item.ilgiliKisiFirma.toLowerCase().includes(q) ||
            item.aciklama.toLowerCase().includes(q) ||
            item.odemeYontemi.toLowerCase().includes(q) ||
            (item.personelAdi && item.personelAdi.toLowerCase().includes(q));
          if (!matchText) return null;
        }

        return {
          ...item,
          effectiveAmountTRY,
        };
      })
      .filter(Boolean) as (UnifiedSiteExpenseItem & { effectiveAmountTRY: number })[];
  }, [
    allSiteExpenseItems,
    filteredSiteReports,
    selectedYear,
    selectedMonth,
    expenseScope,
    selectedExpenseCategory,
    selectedPersonnelId,
    selectedPaymentType,
    selectedPersonnelCategory,
    searchQuery,
  ]);

  // Overall Aggregates
  const totalSummary = useMemo(() => {
    let grandGelir = 0;
    let grandMasraf = 0;
    let grandPersonelOdeme = 0;
    let grandAvans = 0;
    let grandResmi = 0;
    let grandGider = 0;
    const globalCategoryMap: Record<string, number> = {};

    filteredSiteReports.forEach((item) => {
      grandGelir += item.totalGelir;
      grandMasraf += item.totalMasraf;
      grandPersonelOdeme += item.totalPersonelOdeme;
      grandAvans += item.siteAvansTRY;
      grandResmi += item.siteResmiTRY;
      grandGider += item.totalGider;
      Object.entries(item.expenseByCategory).forEach(([cat, amt]) => {
        globalCategoryMap[cat] = (globalCategoryMap[cat] || 0) + (Number(amt) || 0);
      });
    });

    const grandNetKar = grandGelir - grandGider;
    const grandMargin = grandGelir > 0 ? (grandNetKar / grandGelir) * 100 : grandGider > 0 ? -100 : 0;

    const sortedCategories = Object.entries(globalCategoryMap)
      .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt) }))
      .sort((a, b) => b.amount - a.amount);

    return {
      grandGelir,
      grandMasraf,
      grandPersonelOdeme,
      grandAvans,
      grandResmi,
      grandGider,
      grandNetKar,
      grandMargin: Math.round(grandMargin * 10) / 10,
      sortedCategories,
    };
  }, [filteredSiteReports]);

  const hasActiveFilters =
    selectedSiteId !== 'all' ||
    selectedYear !== 'all' ||
    selectedMonth !== 'all' ||
    expenseScope !== 'all' ||
    selectedExpenseCategory !== 'all' ||
    selectedPersonnelId !== 'all' ||
    selectedPaymentType !== 'all' ||
    selectedPersonnelCategory !== 'all' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    setSelectedSiteId('all');
    setSelectedYear('all');
    setSelectedMonth('all');
    setExpenseScope('all');
    setSelectedExpenseCategory('all');
    setSelectedPersonnelId('all');
    setSelectedPaymentType('all');
    setSelectedPersonnelCategory('all');
    setSearchQuery('');
  };

  // Export options for Site Profitability Summary Table
  const exportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Şantiye Kârlılık ve Gelir - Gider Raporu',
      subtitle: `Dönem: ${selectedYear === 'all' ? 'Tüm Yıllar' : `${selectedYear} Yılı`}${
        selectedMonth !== 'all' ? ` / Ay: ${selectedMonth}` : ''
      } | Şantiye Sayısı: ${filteredSiteReports.length}`,
      filename: `Santiye_Karlilik_Raporu_${selectedYear}`,
      columns: [
        { header: '#', dataKey: '__index', width: 10 },
        { header: 'Şantiye Adı', dataKey: 'siteName', width: 26 },
        { header: 'İşveren / Firma', dataKey: 'client', width: 22 },
        { header: 'Durum', dataKey: 'status', width: 14 },
        { header: 'Toplam Gelir', dataKey: 'gelir', align: 'right', width: 20 },
        { header: 'Şantiye Masrafları', dataKey: 'masraf', align: 'right', width: 20 },
        { header: 'Personel Ödemeleri', dataKey: 'personelOdeme', align: 'right', width: 20 },
        { header: 'Toplam Gider', dataKey: 'gider', align: 'right', width: 20 },
        { header: 'Net Kâr / Zarar', dataKey: 'netKar', align: 'right', width: 20 },
        { header: 'Kâr Marjı (%)', dataKey: 'margin', align: 'center', width: 14 },
      ],
      data: filteredSiteReports.map((row) => ({
        siteName: row.site.isim,
        client: row.site.yetkiliFirma || '-',
        status: row.site.durum,
        gelir: formatCurrency(row.totalGelir, 'TRY'),
        masraf: formatCurrency(row.totalMasraf, 'TRY'),
        personelOdeme: formatCurrency(row.totalPersonelOdeme, 'TRY'),
        gider: formatCurrency(row.totalGider, 'TRY'),
        netKar: formatCurrency(row.netKar, 'TRY'),
        margin: `%${row.karMarji}`,
      })),
      summaryRows: [
        { label: 'Toplam Şantiye Gelirleri', value: formatCurrency(totalSummary.grandGelir, 'TRY') },
        { label: 'Toplam Şantiye Masrafları (Gider Fişleri)', value: formatCurrency(totalSummary.grandMasraf, 'TRY') },
        { label: 'Toplam Personel Ödemeleri', value: formatCurrency(totalSummary.grandPersonelOdeme, 'TRY') },
        { label: 'Genel Toplam Şantiye Giderleri', value: formatCurrency(totalSummary.grandGider, 'TRY') },
        { label: 'Konsolide Net Kâr', value: formatCurrency(totalSummary.grandNetKar, 'TRY') },
        { label: 'Ortalama Kârlılık Marjı', value: `%${totalSummary.grandMargin}` },
      ],
      orientation: 'landscape',
    };
  }, [filteredSiteReports, selectedYear, selectedMonth, totalSummary]);

  // Export options for Detailed Filtered Expenses & Personnel Payments
  const detailedExportOptions: ExportOptions = useMemo(() => {
    return {
      title: 'Şantiye Masrafları ve Personel Ödemeleri Detay Raporu',
      subtitle: `Toplam ${filteredDetailedItems.length} Kayıt | Şantiye Masrafı: ${formatCurrency(
        totalSummary.grandMasraf,
        'TRY'
      )} | Personel Ödemesi: ${formatCurrency(totalSummary.grandPersonelOdeme, 'TRY')}`,
      filename: `Santiye_Masraf_ve_Personel_Odemeleri_${selectedYear}`,
      columns: [
        { header: '#', dataKey: '__index', width: 10, align: 'center' },
        { header: 'Tarih', dataKey: 'tarih', width: 16 },
        { header: 'Şantiye', dataKey: 'santiye', width: 24 },
        { header: 'Gider Türü', dataKey: 'giderTuru', width: 20 },
        { header: 'Kategori / Ödeme Tipi', dataKey: 'kategori', width: 22 },
        { header: 'İlgili Personel / Firma', dataKey: 'ilgili', width: 26 },
        { header: 'Açıklama', dataKey: 'aciklama', width: 32 },
        { header: 'Ödeme Yöntemi', dataKey: 'yontem', width: 18 },
        { header: 'Tutar (TRY)', dataKey: 'tutar', width: 20, align: 'right' },
      ],
      data: filteredDetailedItems.map((item) => ({
        tarih: item.tarih || '-',
        santiye: item.santiyeIsim,
        giderTuru: item.kaynakTuru === 'personel_odeme' ? 'Personel Ödemesi' : item.kaynakTuru === 'tedarikci_cari' ? 'Firma / Alış Faturası' : item.kaynakTuru === 'taseron_cari' ? 'Taşeron Cari' : 'Şantiye Masrafı',
        kategori: item.kaynakTuru === 'personel_odeme' ? (item.odemeAltTuruLabel || item.kategori) : item.kategori,
        ilgili: item.ilgiliKisiFirma,
        aciklama: item.aciklama,
        yontem: item.odemeYontemi,
        tutar: formatCurrency(Math.round(item.effectiveAmountTRY), 'TRY'),
      })),
      summaryRows: [
        { label: 'Süzülen Şantiye Masrafları Toplamı', value: formatCurrency(totalSummary.grandMasraf, 'TRY') },
        { label: 'Süzülen Personel Ödemeleri Toplamı', value: formatCurrency(totalSummary.grandPersonelOdeme, 'TRY') },
        { label: 'Genel Toplam Gider (Masraf + Personel)', value: formatCurrency(totalSummary.grandGider, 'TRY') },
      ],
      orientation: 'landscape',
    };
  }, [filteredDetailedItems, selectedYear, totalSummary]);

  return (
    <div className="space-y-6">
      {/* FILTER HEADER */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Şantiye Kârlılık ve Gelir / Gider Analizi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Projelerinizin tahakkuk eden gelirleri, kategori bazlı şantiye masrafları, şantiyeye bağlı personel ödemeleri ve net kârlılık durumları
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Filtreleri Temizle</span>
              </button>
            )}
            <ExportButton options={detailedExportOptions} buttonText="Masraf & Personel Detayını İndir" variant="secondary" />
            <ExportButton options={exportOptions} buttonText="Kârlılık Raporunu İndir" variant="primary" />
          </div>
        </div>

        {/* ROW 1: Şantiye, Yıl, Ay ve Arama Filtreleri */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Site Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Şantiye / Proje
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                setSelectedPersonnelId('all');
              }}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🏢 Tüm Şantiyeler ({santiyeler.length})</option>
              {santiyeler.map((s) => (
                <option key={s.id} value={s.id}>
                  🏗️ {s.isim}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Dönem Yılı
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">📅 Tüm Yıllar (Toplam Proje Ömrü)</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} Yılı
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Dönem Ayı
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🗓️ Tüm Aylar</option>
              {MONTHS_TR.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.value} - {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
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
                placeholder="Şantiye, personel, kategori, açıklama..."
                className="w-full pl-8 pr-7 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 1.5: Hesaplama Esası (Fiili Ödeme & Tahsilat vs Faturalar Dahil) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 p-3 rounded-2xl border border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">⚖️</span>
              <span className="text-xs font-bold text-slate-800">
                Şantiye Gelir & Gider Hesaplama Esası:
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                accountingBasis === 'cash'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
              }`}>
                {accountingBasis === 'cash' ? '💵 Sadece Fiili Ödemeler (Nakit Esaslı)' : '📑 Faturalar Dahil (Tahakkuk Esaslı)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {accountingBasis === 'cash'
                ? 'Faturalar gider/gelir sayılmaz; yalnızca fiili yapılan ödemeler masraf, fiili tahsilatlar gelir olarak hesaplanır.'
                : 'Mükerrerliği önlemek için ödenen faturalar düşülür; yalnızca firmanın şantiyedeki ödenmemiş açık fatura bakiye farkı şantiye toplamına yansıtılır.'}
            </p>
          </div>

          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setAccountingBasis('cash')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                accountingBasis === 'cash'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>💵 Fiili Ödemeler (Nakit)</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountingBasis('accrual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                accountingBasis === 'accrual'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>📑 Faturalar Dahil (Açık Bakiye Farkı)</span>
            </button>
          </div>
        </div>

        {/* ROW 2: Şantiye Masraf Kategorisi & Personel Ödemeleri Özel Süzme Paneli */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {/* Gider Kapsamı Seçici (Tümü / Şantiye Masrafları / Personel Ödemeleri) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Şantiye Masrafları (Kategori) ve Personel Ödemeleri Süzgeci</span>
            </div>

            <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setExpenseScope('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  expenseScope === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tümü (Masraf + Personel)
              </button>
              <button
                type="button"
                onClick={() => setExpenseScope('site_expenses')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  expenseScope === 'site_expenses'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sadece Şantiye Masrafları</span>
              </button>
              <button
                type="button"
                onClick={() => setExpenseScope('personnel_payments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  expenseScope === 'personnel_payments'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sadece Personel Ödemeleri</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            {/* 1. Şantiye Masraf Kategorisi Süzgeci */}
            <div className={expenseScope === 'personnel_payments' ? 'opacity-50' : ''}>
              <label className="block text-[11px] font-bold text-amber-900 mb-1 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-600" />
                <span>Şantiye Masraf Kategorisi</span>
              </label>
              <select
                value={selectedExpenseCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedExpenseCategory(val);
                  if (val !== 'all' && expenseScope === 'personnel_payments') {
                    setExpenseScope('site_expenses');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-amber-200 bg-white text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">🏷️ Tüm Masraf Kategorileri ({availableExpenseCategories.length})</option>
                {availableExpenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Personel Seçimi Süzgeci */}
            <div className={expenseScope === 'site_expenses' ? 'opacity-50' : ''}>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-indigo-600" />
                <span>Personel Ödemesi (Kişi Bazlı)</span>
              </label>
              <select
                value={selectedPersonnelId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPersonnelId(val);
                  if (val !== 'all' && expenseScope === 'site_expenses') {
                    setExpenseScope('personnel_payments');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-indigo-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">👷 Tüm Şantiye Personelleri ({siteLinkedPersonnelList.length})</option>
                {siteLinkedPersonnelList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.isim} {p.soyisim} ({p.kategori || 'Personel'}{p.santiye ? ` - ${p.santiye}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Personel Ödeme Türü (Elden Avans / Resmi Banka / Harcama) */}
            <div className={expenseScope === 'site_expenses' ? 'opacity-50' : ''}>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 uppercase tracking-wider flex items-center gap-1">
                <Wallet className="w-3 h-3 text-indigo-600" />
                <span>Personel Ödeme Türü</span>
              </label>
              <select
                value={selectedPaymentType}
                onChange={(e) => {
                  const val = e.target.value as 'all' | 'avans' | 'resmi' | 'harcama';
                  setSelectedPaymentType(val);
                  if (val !== 'all' && expenseScope === 'site_expenses') {
                    setExpenseScope('personnel_payments');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-indigo-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">💳 Tüm Ödeme Türleri (Avans + Resmi)</option>
                <option value="avans">💵 Sadece Elden / Avans Ödemeleri</option>
                <option value="resmi">🏦 Sadece Resmi / Banka Maaş Ödemeleri</option>
                <option value="harcama">🧾 Sadece Personel Harcama İadeleri</option>
              </select>
            </div>

            {/* 4. Personel Branş / Kadro Türü Süzgeci */}
            <div className={expenseScope === 'site_expenses' ? 'opacity-50' : ''}>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-600" />
                <span>Personel Kadro / Meslek Grubu</span>
              </label>
              <select
                value={selectedPersonnelCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPersonnelCategory(val);
                  if (val !== 'all' && expenseScope === 'site_expenses') {
                    setExpenseScope('personnel_payments');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-indigo-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">🛠️ Tüm Kadro ve Meslekler</option>
                <option value="kendi_personelimiz">🏢 Kendi Bünyemiz (Doğrudan Personel)</option>
                <option value="taseron_ekibi">🤝 Taşeron Ekipleri Personeli</option>
                {availablePersonnelCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    👷 {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS (5 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Toplam Gelir */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Proje Gelirleri</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
            {formatCurrency(totalSummary.grandGelir, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Müşteri hakediş fatura & tahsilatları</div>
        </div>

        {/* 2. Şantiye Masrafları (Kategori Bazlı) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/10 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-xs font-bold">Şantiye Masrafları</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-900 font-mono">
            {formatCurrency(totalSummary.grandMasraf, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium truncate">
            {selectedExpenseCategory === 'all' ? 'Tüm masraf kategorileri' : `Kategori: ${selectedExpenseCategory}`}
          </div>
        </div>

        {/* 3. Şantiye Personel Ödemeleri */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/10 shadow-xs">
          <div className="flex items-center justify-between text-indigo-800 mb-2">
            <span className="text-xs font-bold">Personel Ödemeleri</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-900 font-mono">
            {formatCurrency(totalSummary.grandPersonelOdeme, 'TRY')}
          </div>
          <div className="mt-1 text-[10px] text-indigo-700 font-medium flex items-center gap-2">
            <span>Avans: {formatCurrency(totalSummary.grandAvans, 'TRY')}</span>
            <span>•</span>
            <span>Resmi: {formatCurrency(totalSummary.grandResmi, 'TRY')}</span>
          </div>
        </div>

        {/* 4. Toplam Şantiye Giderleri (Masraf + Personel) */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/10 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-bold">Toplam Şantiye Giderleri</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-600 font-mono">
            {formatCurrency(totalSummary.grandGider, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Şantiye masrafları + personel ödemeleri</div>
        </div>

        {/* 5. Net Kâr / Zarar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Konsolide Net Kâr</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                totalSummary.grandNetKar >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              {totalSummary.grandNetKar >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div
            className={`text-lg sm:text-xl font-black font-mono ${
              totalSummary.grandNetKar >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(totalSummary.grandNetKar, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Kâr Marjı:</span>
            <span
              className={`font-bold ${
                totalSummary.grandMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              %{totalSummary.grandMargin}
            </span>
          </div>
        </div>
      </div>

      {/* İNTERAKTİF GİDER KATEGORİ DAĞILIMI ÇUBUKLARI (Tıklayarak Süzme) */}
      {totalSummary.sortedCategories.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-indigo-500" />
              <span>Gider Dağılımı (Kategoriye veya Personel Ödemelerine Tıklayarak Süzün)</span>
            </h4>
            {(selectedExpenseCategory !== 'all' || expenseScope !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedExpenseCategory('all');
                  setExpenseScope('all');
                }}
                className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Tüm Kategorileri Göster
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {totalSummary.sortedCategories.map((catItem) => {
              const pct = totalSummary.grandGider > 0 ? Math.round((catItem.amount / totalSummary.grandGider) * 100) : 0;
              const isPersonnelCat = catItem.category === 'Personel & İşçilik Ödemeleri';
              const isActive = isPersonnelCat
                ? expenseScope === 'personnel_payments'
                : selectedExpenseCategory === catItem.category;

              return (
                <button
                  key={catItem.category}
                  type="button"
                  onClick={() => {
                    if (isPersonnelCat) {
                      if (expenseScope === 'personnel_payments') {
                        setExpenseScope('all');
                      } else {
                        setExpenseScope('personnel_payments');
                        setSelectedExpenseCategory('all');
                      }
                    } else {
                      if (selectedExpenseCategory === catItem.category) {
                        setSelectedExpenseCategory('all');
                        setExpenseScope('all');
                      } else {
                        setSelectedExpenseCategory(catItem.category);
                        setExpenseScope('site_expenses');
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                      : isPersonnelCat
                      ? 'bg-indigo-50/40 hover:bg-indigo-50/80 border-indigo-200'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="truncate flex items-center gap-1.5">
                      {isPersonnelCat ? (
                        <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate">{catItem.category}</span>
                    </span>
                    <span className="text-indigo-600 font-bold">%{pct}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1 font-mono">
                    {formatCurrency(catItem.amount, 'TRY')}
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isPersonnelCat ? 'bg-indigo-600' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TABLO 1: DETAILED SITES PROFITABILITY COMPARISON TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Şantiyeler Kârlılık Karşılaştırma Tablosu</h4>
            <p className="text-xs text-slate-500">
              Şantiyeye bağlı personellere yapılan ödemeler şantiye giderler hanesine dahil edilmiştir.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Gösterilen: <strong>{filteredSiteReports.length}</strong> Şantiye
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">Şantiye</th>
                <th className="py-3 px-3">İşveren / Firma</th>
                <th className="py-3 px-3 text-right">Toplam Gelir</th>
                <th className="py-3 px-3 text-right bg-amber-50/50 text-amber-900">Şantiye Masrafları</th>
                <th className="py-3 px-3 text-right bg-indigo-50/50 text-indigo-900">Personel Ödemeleri</th>
                <th className="py-3 px-3 text-right bg-rose-50/60 text-rose-900">Toplam Gider (Masraf + Personel)</th>
                <th className="py-3 px-3 text-right">Net Kâr / Zarar</th>
                <th className="py-3 px-3 text-center">Kâr Marjı</th>
                <th className="py-3 px-3 text-center">Kârlılık Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSiteReports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    Seçilen kriterlere uygun şantiye bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredSiteReports
                  .sort((a, b) => b.netKar - a.netKar)
                  .map((item, idx) => {
                    const isProfit = item.netKar >= 0;
                    const isSelectedSite = selectedSiteId === item.site.id;
                    return (
                      <tr
                        key={item.site.id}
                        onClick={() => setSelectedSiteId(isSelectedSite ? 'all' : item.site.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelectedSite ? 'bg-emerald-50/40' : ''
                        }`}
                        title="Bu şantiyenin masraf ve personel ödemelerini süzmek için tıklayın"
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.site.isim}</span>
                            {isSelectedSite && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Seçili
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.revenueCount > 0 && (
                              <span className="text-blue-600 font-semibold">{item.revenueCount} Gelir Kaydı • </span>
                            )}
                            {item.expenseCount} Masraf Fişi • {item.personnelPaymentCount} Personel Ödemesi ({item.personnelCount} Personel)
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          <div>{item.site.yetkiliFirma || '-'}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.site.il || ''} {item.site.ilce ? `/ ${item.site.ilce}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-600 font-mono">
                          {formatCurrency(item.totalGelir, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-amber-800 bg-amber-50/20 font-mono">
                          {formatCurrency(item.totalMasraf, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-indigo-700 bg-indigo-50/20 font-mono">
                          <div>{formatCurrency(item.totalPersonelOdeme, 'TRY')}</div>
                          {item.totalPersonelOdeme > 0 && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Avans: {formatCurrency(item.siteAvansTRY, 'TRY')} | Resmi: {formatCurrency(item.siteResmiTRY, 'TRY')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-rose-600 bg-rose-50/20 font-mono">
                          {formatCurrency(item.totalGider, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right font-black font-mono">
                          <span className={isProfit ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatCurrency(item.netKar, 'TRY')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${
                              item.karMarji >= 15
                                ? 'bg-emerald-50 text-emerald-700 font-bold'
                                : item.karMarji >= 0
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            %{item.karMarji}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isProfit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <TrendingUp className="w-3 h-3" />
                              Kârda
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <TrendingDown className="w-3 h-3" />
                              Açıkta / Zararda
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
            {filteredSiteReports.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="py-3 px-3 text-right">KONSOLİDE TOPLAM:</td>
                  <td className="py-3 px-3 text-right text-blue-700 font-mono">{formatCurrency(totalSummary.grandGelir, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-amber-800 font-mono">{formatCurrency(totalSummary.grandMasraf, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-indigo-800 font-mono">{formatCurrency(totalSummary.grandPersonelOdeme, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-rose-700 font-mono">{formatCurrency(totalSummary.grandGider, 'TRY')}</td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-mono">{formatCurrency(totalSummary.grandNetKar, 'TRY')}</td>
                  <td className="py-3 px-3 text-center">%{totalSummary.grandMargin}</td>
                  <td className="py-3 px-3 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* TABLO 1.5: ŞANTİYE GELİRLERİ (CARİ HAREKET / FATURA & TAHSİLAT DÖKÜMÜ) */}
      <div className="bg-white rounded-2xl border border-blue-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-100 bg-blue-50/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-blue-600" />
              <span>Şantiye Gelirleri Dökümü (Cari Hareket / Fatura & Tahsilat Kayıtları)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Cari Hareket / Fatura Ekle veya Düzenle ekranında ilgili şantiye seçilerek kaydedilen tüm gelir, satış faturası ve tahsilatlar
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold">
              Toplam Şantiye Geliri ({filteredRevenueItems.length} Kayıt):{' '}
              <strong className="font-mono">{formatCurrency(totalSummary.grandGelir, 'TRY')}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Tarih</th>
                <th className="py-3 px-3">İlgili Şantiye / Proje</th>
                <th className="py-3 px-3">Gelir / İşlem Türü</th>
                <th className="py-3 px-3">Firma / Müşteri</th>
                <th className="py-3 px-3">Fatura / Dekont No</th>
                <th className="py-3 px-3">Açıklama</th>
                <th className="py-3 px-3 text-right">Gelir Tutarı (TRY)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRevenueItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    Seçilen kriterlere ait şantiye gelir kaydı bulunamadı. Cari Hareket / Fatura Ekle veya Düzenle ekranından &quot;İlgili Şantiye / Proje&quot; seçerek şantiye geliri ekleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredRevenueItems.map((rev, idx) => (
                  <tr key={rev.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                      {rev.tarih || '-'}
                      {rev.saat ? <span className="text-[10px] text-slate-400 ml-1">{rev.saat}</span> : null}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                        🏗️ {rev.santiyeIsim}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                          rev.islemTuru === 'tahsilat'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {rev.islemTuruLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{rev.firmaAdi}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{rev.faturaNo || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={rev.aciklama}>
                      {rev.aciklama}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-700 font-mono whitespace-nowrap">
                      {rev.isInvoice && rev.acikFarkTRY === 0 ? (
                        <div className="text-emerald-700 font-bold text-xs flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                          <span>+0 TL (Tahsil Edildi)</span>
                        </div>
                      ) : (
                        <div>+{formatCurrency(Math.round(rev.tutarTRY), 'TRY')}</div>
                      )}
                      {rev.isInvoice ? (
                        <div className="text-[10px] text-indigo-600 font-normal">
                          {rev.acikFarkTRY === 0 ? (
                            <span>Fatura: {formatCurrency(Math.round(rev.faturaTutariTRY || rev.orijinalMiktar), rev.paraBirimi)}</span>
                          ) : rev.tahsilEdilenTutarTRY && rev.tahsilEdilenTutarTRY > 0 ? (
                            <span>Açık Fark (Fatura: {formatCurrency(Math.round(rev.faturaTutariTRY || rev.orijinalMiktar), rev.paraBirimi)})</span>
                          ) : (
                            <span>Açık Fatura</span>
                          )}
                        </div>
                      ) : rev.paraBirimi !== 'TRY' ? (
                        <div className="text-[10px] text-slate-500 font-normal">
                          ({formatCurrency(rev.orijinalMiktar, rev.paraBirimi)})
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRevenueItems.length > 0 && (
              <tfoot>
                <tr className="bg-blue-50/50 font-bold text-slate-900 border-t-2 border-blue-200">
                  <td colSpan={7} className="py-3 px-3 text-right">
                    TOPLAM ŞANTİYE GELİRLERİ ({filteredRevenueItems.length} Kayıt):
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-mono">
                    {formatCurrency(totalSummary.grandGelir, 'TRY')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* TABLO 2: SÜZÜLEN ŞANTİYE MASRAFLARI VE PERSONEL ÖDEMELERİ DETAY LİSTESİ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Şantiye Masrafları ve Personel Ödemeleri Detaylı Hareket Dökümü</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Seçilen kategori ve personel filtrelerine göre şantiye giderler hanesini oluşturan tüm harcama ve ödeme kayıtları
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              Şantiye Masrafı: <strong>{formatCurrency(totalSummary.grandMasraf, 'TRY')}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
              Personel Ödemesi: <strong>{formatCurrency(totalSummary.grandPersonelOdeme, 'TRY')}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-bold">
              Toplam Gider: <strong>{formatCurrency(totalSummary.grandGider, 'TRY')}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Tarih</th>
                <th className="py-3 px-3">Şantiye</th>
                <th className="py-3 px-3">Gider Türü</th>
                <th className="py-3 px-3">Kategori / Ödeme Tipi</th>
                <th className="py-3 px-3">İlgili Personel / Firma</th>
                <th className="py-3 px-3">Açıklama</th>
                <th className="py-3 px-3">Ödeme Yöntemi</th>
                <th className="py-3 px-3 text-right">Tutar (TRY)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDetailedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                    Seçilen kategori veya personel ödeme filtrelerine uygun hareket kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredDetailedItems.map((item, idx) => {
                  const isPersonel = item.kaynakTuru === 'personel_odeme';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">{item.tarih || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.santiyeIsim}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isPersonel ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                            <Users className="w-3 h-3 text-indigo-600" />
                            <span>Personel Ödemesi</span>
                          </span>
                        ) : item.isInvoice ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                            item.acikFarkTRY === 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {item.acikFarkTRY === 0 ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Receipt className="w-3 h-3 text-orange-600" />
                            )}
                            <span>{item.acikFarkTRY === 0 ? 'Alış Faturası (Ödendi)' : 'Alış Faturası (Açık Fark)'}</span>
                          </span>
                        ) : item.kaynakTuru === 'taseron_cari' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-bold text-[11px]">
                            <Building2 className="w-3 h-3 text-teal-600" />
                            <span>Taşeron Cari</span>
                          </span>
                        ) : item.kaynakTuru === 'tedarikci_cari' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 font-bold text-[11px]">
                            <Receipt className="w-3 h-3 text-orange-600" />
                            <span>Tedarikçi Cari</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                            <Receipt className="w-3 h-3 text-amber-600" />
                            <span>Şantiye Masrafı</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {isPersonel ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                              item.odemeAltTuru === 'resmi'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : item.odemeAltTuru === 'avans'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {item.odemeAltTuru === 'resmi' ? (
                              <Landmark className="w-3 h-3" />
                            ) : (
                              <Banknote className="w-3 h-3" />
                            )}
                            <span>{item.odemeAltTuruLabel}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {item.kategori}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {item.ilgiliKisiFirma}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={item.aciklama}>
                        {item.aciklama}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{item.odemeYontemi}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                        {item.isInvoice && item.acikFarkTRY === 0 ? (
                          <div className="text-emerald-700 font-bold text-xs flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                            <span>0 TL (Ödendi)</span>
                          </div>
                        ) : (
                          <div>{formatCurrency(Math.round(item.effectiveAmountTRY), 'TRY')}</div>
                        )}
                        {item.isInvoice ? (
                          <div className="text-[10px] text-indigo-600 font-normal">
                            {item.acikFarkTRY === 0 ? (
                              <span>Fatura: {formatCurrency(Math.round(item.faturaTutariTRY || item.orijinalMiktar), item.paraBirimi)}</span>
                            ) : item.odenenTutarTRY && item.odenenTutarTRY > 0 ? (
                              <span>Açık Fark (Fatura: {formatCurrency(Math.round(item.faturaTutariTRY || item.orijinalMiktar), item.paraBirimi)})</span>
                            ) : (
                              <span>Açık Fatura</span>
                            )}
                          </div>
                        ) : item.paraBirimi !== 'TRY' ? (
                          <div className="text-[10px] text-amber-700 font-normal">
                            ({formatCurrency(item.orijinalMiktar, item.paraBirimi)})
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredDetailedItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={8} className="py-3 px-3 text-right">
                    FİLTRELENEN HAREKETLER TOPLAMI ({filteredDetailedItems.length} Kayıt):
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-mono">
                    {formatCurrency(totalSummary.grandGider, 'TRY')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
