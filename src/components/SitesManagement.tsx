import React, { useState, useMemo } from 'react';
import { 
  HardHat, 
  Building2, 
  MapPin, 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  Receipt, 
  Coins, 
  Layers, 
  CheckCircle, 
  Clock, 
  Filter,
  Tag,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Search,
  X,
  Check,
  Users,
  User,
  Wallet
} from 'lucide-react';
import { 
  Santiye, 
  SantiyeGider, 
  Taseron, 
  OdemeYontemi, 
  Firma, 
  KrediKarti, 
  KrediKartiHarcama,
  FirmaCari,
  Cek,
  Personnel,
  PersonelOdeme
} from '../types';
import { formatCurrency, getCurrencySymbol, getTodayDateString, DEFAULT_SANTIYE_GIDER_KATEGORILERI } from '../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../utils/currencyStore';
import { CurrencySelector } from './CurrencySelector';
import { ExportButton } from './ExportButton';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ExportOptions } from '../utils/exportUtils';
import { 
  getCanonicalFirmKey, 
  allocateInvoicePaymentsFIFO, 
  allocateInvoiceCollectionsFIFO 
} from '../utils/siteAccountingUtils';

export type UnifiedSantiyeGider = SantiyeGider & {
  kaynakTuru: 'dogrudan' | 'taseron_cari' | 'taseron_personel';
  kaynakId?: string;
  personelAdi?: string;
  isFromCariOnly?: boolean;
  isFromPersonnelOnly?: boolean;
  isInvoice?: boolean;
  faturaNo?: string;
  faturaTutari?: number;
  odenenTutar?: number;
  acikFark?: number;
  faturaDurum?: 'tamamen_odendi' | 'kismen_odendi' | 'odenmedi';
};

export const getSiteSubcontractors = (site: Santiye): string[] => {
  const result: string[] = [];
  if (Array.isArray(site.taseronlar)) {
    site.taseronlar.forEach((t) => {
      const trimmed = t?.trim();
      if (trimmed && !result.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
        result.push(trimmed);
      }
    });
  }
  if (site.taseron) {
    site.taseron.split(',').forEach((t) => {
      const trimmed = t?.trim();
      if (trimmed && !result.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
        result.push(trimmed);
      }
    });
  }
  return result;
};

interface SitesManagementProps {
  santiyeler: Santiye[];
  giderler: SantiyeGider[];
  cariList?: FirmaCari[];
  cekler?: Cek[];
  personnelList?: Personnel[];
  odemeList?: PersonelOdeme[];
  taseronlar: Taseron[];
  firmalar: Firma[];
  odemeYontemleri: OdemeYontemi[];
  kategoriler?: string[];
  krediKartlari?: KrediKarti[];
  kartHarcamalari?: KrediKartiHarcama[];
  onAddKategori?: (kategori: string) => void;
  onDeleteKategori?: (kategori: string) => void;
  defaultSubTab?: 'sites' | 'expenses';
  onAddSantiye: (santiye: Santiye) => void;
  onUpdateSantiye: (santiye: Santiye) => void;
  onDeleteSantiye: (id: string) => void;
  onAddGider: (gider: SantiyeGider) => void;
  onUpdateGider: (gider: SantiyeGider) => void;
  onDeleteGider: (id: string) => void;
  onAddFirma?: (firma: Firma) => void;
  onDeleteCariHareket?: (id: string) => void;
  onDeleteOdeme?: (id: string) => void;
  onOpenCurrencies?: () => void;
  allowedSantiyeIds?: string[];
  onlyExpenseMode?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SitesManagement: React.FC<SitesManagementProps> = ({
  santiyeler: rawSantiyeler,
  giderler,
  cariList = [],
  cekler = [],
  personnelList = [],
  odemeList = [],
  taseronlar,
  firmalar,
  odemeYontemleri,
  kategoriler,
  krediKartlari = [],
  kartHarcamalari = [],
  onAddKategori,
  onDeleteKategori,
  defaultSubTab = 'sites',
  onAddSantiye,
  onUpdateSantiye,
  onDeleteSantiye,
  onAddGider,
  onUpdateGider,
  onDeleteGider,
  onAddFirma,
  onDeleteCariHareket,
  onDeleteOdeme,
  onOpenCurrencies,
  allowedSantiyeIds = [],
  onlyExpenseMode = false,
  canEdit = true,
  canDelete = true,
}) => {
  const santiyeler = useMemo(() => {
    if (!allowedSantiyeIds || allowedSantiyeIds.length === 0) return rawSantiyeler;
    return rawSantiyeler.filter((s) => allowedSantiyeIds.includes(s.id));
  }, [rawSantiyeler, allowedSantiyeIds]);

  const [subTab, setSubTab] = useState<'sites' | 'expenses' | 'revenues'>(onlyExpenseMode ? 'expenses' : defaultSubTab);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'all' | 'dogrudan' | 'taseron_cari' | 'taseron_personel'>('all');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>('');

  // Hesaplama Esası: 'cash' (Varsayılan: Sadece Fiili Ödemeler & Tahsilatlar) vs 'accrual' (Faturalar Dahil)
  const [accountingBasis, setAccountingBasis] = useState<'cash' | 'accrual'>('cash');

  const exchangeRates = getSavedExchangeRates();

  // Modals
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Santiye | null>(null);
  const [isGiderModalOpen, setIsGiderModalOpen] = useState(false);
  const [editingGider, setEditingGider] = useState<SantiyeGider | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Silme Onay Modalı Durumu
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'Kaydı Sil',
    description: '',
    onConfirm: () => {},
  });

  // Category management state
  const activeCategories = kategoriler && kategoriler.length > 0 ? kategoriler : DEFAULT_SANTIYE_GIDER_KATEGORILERI;
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Form states
  const [siteForm, setSiteForm] = useState<Partial<Santiye> & { taseronlar?: string[] }>({
    isim: '',
    yetkiliFirma: '',
    taseron: '',
    taseronlar: [],
    baslangicTarihi: getTodayDateString(),
    bitisTarihi: '',
    durum: 'Aktif',
    ulke: 'Türkiye',
    il: 'İstanbul',
    ilce: '',
    adres: '',
    aciklama: '',
  });

  const [newSubcontractorInput, setNewSubcontractorInput] = useState('');

  const handleAddSubcontractorToSite = (tasName: string) => {
    const trimmed = tasName.trim();
    if (!trimmed) return;
    const currentList = siteForm.taseronlar || [];
    if (!currentList.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...currentList, trimmed];
      setSiteForm({
        ...siteForm,
        taseronlar: updated,
        taseron: updated.join(', '),
      });
    }
    setNewSubcontractorInput('');
  };

  const handleRemoveSubcontractorFromSite = (tasName: string) => {
    const currentList = siteForm.taseronlar || [];
    const updated = currentList.filter((t) => t.toLowerCase() !== tasName.toLowerCase());
    setSiteForm({
      ...siteForm,
      taseronlar: updated,
      taseron: updated.join(', '),
    });
  };

  // Kayıtlı Müşteriler ve Diğer Firmalar
  const musteriFirmalar = useMemo(() => {
    return (firmalar || []).filter((f) => f.tur === 'musteri');
  }, [firmalar]);

  const digerFirmalar = useMemo(() => {
    return (firmalar || []).filter((f) => f.tur !== 'musteri');
  }, [firmalar]);

  // Firma Cari Bölümündeki Tüm Kayıtlar (Firmalar + Taşeronlar birleşik liste)
  const combinedCariFirmalar = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        isim: string;
        tur: 'tedarikci' | 'taseron' | 'musteri';
        isTaseron: boolean;
        ilgili?: string;
        telefon?: string;
        vergiNo?: string;
        vergiDairesi?: string;
        uzmanlik?: string;
      }
    >();

    (firmalar || []).forEach((f) => {
      const matchingTas = (taseronlar || []).find(
        (t) => t.id === f.id || t.isim.trim().toLowerCase() === f.isim.trim().toLowerCase()
      );
      const isTas = f.tur === 'taseron' || Boolean(matchingTas);
      map.set(f.id, {
        id: f.id,
        isim: f.isim,
        tur: isTas ? 'taseron' : (f.tur || 'tedarikci'),
        isTaseron: isTas,
        ilgili: f.ilgili || matchingTas?.yetkili,
        telefon: f.telefon || matchingTas?.telefon,
        vergiNo: f.vergiNo || matchingTas?.vergiNo,
        vergiDairesi: f.vergiDairesi || matchingTas?.vergiDairesi,
        uzmanlik: f.uzmanlik || matchingTas?.uzmanlik,
      });
    });

    (taseronlar || []).forEach((t) => {
      const existing = Array.from(map.values()).find(
        (item) => item.isim.trim().toLowerCase() === t.isim.trim().toLowerCase()
      );
      if (!existing) {
        map.set(t.id, {
          id: t.id,
          isim: t.isim,
          tur: 'taseron',
          isTaseron: true,
          ilgili: t.yetkili,
          telefon: t.telefon,
          vergiNo: t.vergiNo,
          vergiDairesi: t.vergiDairesi,
          uzmanlik: t.uzmanlik,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
  }, [firmalar, taseronlar]);

  // Manuel / Listeden seçim durumları
  const [isCustomFirma, setIsCustomFirma] = useState<boolean>(false);
  const [isCustomTaseron, setIsCustomTaseron] = useState<boolean>(false);
  const [isCustomGiderFirma, setIsCustomGiderFirma] = useState<boolean>(false);
  const [addManualFirmaToCari, setAddManualFirmaToCari] = useState<boolean>(false);

  // Tablodan Seçim Modalları Durumları
  const [isTaseronPickerOpen, setIsTaseronPickerOpen] = useState(false);
  const [taseronSearchQuery, setTaseronSearchQuery] = useState('');
  const [isMusteriPickerOpen, setIsMusteriPickerOpen] = useState(false);
  const [firmaPickerTarget, setFirmaPickerTarget] = useState<'site' | 'gider'>('site');
  const [musteriSearchQuery, setMusteriSearchQuery] = useState('');
  const [musteriFilterTab, setMusteriFilterTab] = useState<'all' | 'tedarikci' | 'taseron' | 'musteri'>('musteri');

  // Filtrelenmiş Taşeronlar Tablosu
  const filteredTaseronlar = useMemo(() => {
    const q = taseronSearchQuery.trim().toLowerCase();
    if (!q) return taseronlar || [];
    return (taseronlar || []).filter(
      (t) =>
        t.isim.toLowerCase().includes(q) ||
        (t.uzmanlik && t.uzmanlik.toLowerCase().includes(q)) ||
        (t.yetkili && t.yetkili.toLowerCase().includes(q)) ||
        (t.telefon && t.telefon.toLowerCase().includes(q))
    );
  }, [taseronlar, taseronSearchQuery]);

  // Filtrelenmiş Müşteriler / Cari Firmalar Tablosu
  const filteredMusteriler = useMemo(() => {
    const q = musteriSearchQuery.trim().toLowerCase();
    let base = combinedCariFirmalar;
    if (musteriFilterTab === 'musteri') {
      base = base.filter((f) => f.tur === 'musteri');
    } else if (musteriFilterTab === 'tedarikci') {
      base = base.filter((f) => f.tur === 'tedarikci');
    } else if (musteriFilterTab === 'taseron') {
      base = base.filter((f) => f.isTaseron || f.tur === 'taseron');
    }
    if (!q) return base;
    return base.filter(
      (f) =>
        f.isim.toLowerCase().includes(q) ||
        (f.ilgili && f.ilgili.toLowerCase().includes(q)) ||
        (f.telefon && f.telefon.toLowerCase().includes(q)) ||
        (f.vergiNo && f.vergiNo.toLowerCase().includes(q)) ||
        (f.uzmanlik && f.uzmanlik.toLowerCase().includes(q))
    );
  }, [combinedCariFirmalar, musteriSearchQuery, musteriFilterTab]);

  // Seçili Firma ve Taşeron detayları
  const selectedFirmaDetails = useMemo(() => {
    if (!siteForm.yetkiliFirma) return null;
    return (firmalar || []).find((f) => f.isim === siteForm.yetkiliFirma) || null;
  }, [firmalar, siteForm.yetkiliFirma]);

  const selectedTaseronDetails = useMemo(() => {
    if (!siteForm.taseron) return null;
    return (taseronlar || []).find((t) => t.isim === siteForm.taseron) || null;
  }, [taseronlar, siteForm.taseron]);

  const [giderForm, setGiderForm] = useState<Partial<SantiyeGider>>({
    santiyeId: santiyeler[0]?.id || '',
    odeyen: 'Şantiye Şefi',
    odemeYontemi: odemeYontemleri[0]?.isim || 'Nakit Şantiye Kasası',
    tarih: getTodayDateString(),
    kategori: 'Malzeme',
    aciklama: '',
    odemeYapilanFirma: '',
    durum: 'Ödendi',
    taseron: '',
    miktar: 0,
    paraBirimi: 'TRY',
    kartId: '',
    taksitSayisi: 1,
  });

  const getCardBalance = (cardId: string) => {
    const card = (krediKartlari || []).find((c) => c.id === cardId);
    if (!card) return { debt: 0, available: 0, limit: 0 };
    let totalHarcama = 0;
    let totalOdeme = 0;
    (kartHarcamalari || []).forEach((tx) => {
      if (tx.kartId === cardId) {
        if (tx.islemTipi === 'Harcama') totalHarcama += Number(tx.tutar || 0);
        else if (tx.islemTipi === 'Kart Ödemesi' || tx.islemTipi === 'İade') totalOdeme += Number(tx.tutar || 0);
      }
    });
    const debt = Math.max(0, totalHarcama - totalOdeme);
    const available = Math.max(0, card.kartLimiti - debt);
    return { debt, available, limit: card.kartLimiti };
  };

  const openAddGiderModal = () => {
    setEditingGider(null);
    const defaultKart = krediKartlari && krediKartlari.length > 0 ? krediKartlari[0].id : '';
    setIsCustomGiderFirma(combinedCariFirmalar.length === 0);
    setAddManualFirmaToCari(false);
    setGiderForm({
      santiyeId: santiyeler[0]?.id || '',
      odeyen: 'Şantiye Şefi',
      odemeYontemi: odemeYontemleri[0]?.isim || 'Nakit Şantiye Kasası',
      tarih: getTodayDateString(),
      kategori: 'Malzeme',
      aciklama: '',
      odemeYapilanFirma: '',
      cariFirmaId: undefined,
      durum: 'Ödendi',
      taseron: '',
      miktar: 0,
      paraBirimi: 'TRY',
      kartId: defaultKart,
      taksitSayisi: 1,
    });
    setIsGiderModalOpen(true);
  };

  const openEditGiderModal = (gider: SantiyeGider) => {
    setEditingGider(gider);
    setIsCustomGiderFirma(combinedCariFirmalar.length === 0);
    setAddManualFirmaToCari(false);
    const rawFirmaName = (gider.odemeYapilanFirma || '').trim();
    const matchedCariFirma = combinedCariFirmalar.find((f) => {
      if (rawFirmaName) {
        return f.isim.trim().toLowerCase() === rawFirmaName.toLowerCase();
      }
      return Boolean(gider.cariFirmaId && f.id === gider.cariFirmaId);
    });
    setGiderForm({
      ...gider,
      odemeYapilanFirma: matchedCariFirma ? matchedCariFirma.isim : rawFirmaName,
      cariFirmaId: matchedCariFirma ? matchedCariFirma.id : undefined,
      paraBirimi: gider.paraBirimi || 'TRY',
      kartId: gider.kartId || (krediKartlari && krediKartlari.length > 0 ? krediKartlari[0].id : ''),
      taksitSayisi: gider.taksitSayisi || 1,
    });
    setIsGiderModalOpen(true);
  };

  const openAddSiteModal = () => {
    setEditingSite(null);
    const hasCompanies = (firmalar || []).length > 0;
    const hasTaseronlar = (taseronlar || []).length > 0;
    setIsCustomFirma(!hasCompanies);
    setIsCustomTaseron(!hasTaseronlar);
    setSiteForm({
      isim: '',
      yetkiliFirma: '',
      taseron: '',
      taseronlar: [],
      baslangicTarihi: getTodayDateString(),
      bitisTarihi: '',
      durum: 'Aktif',
      ulke: 'Türkiye',
      il: 'İstanbul',
      ilce: '',
      adres: '',
      aciklama: '',
    });
    setNewSubcontractorInput('');
    setIsSiteModalOpen(true);
  };

  const openEditSiteModal = (santiye: Santiye) => {
    setEditingSite(santiye);
    const subs = getSiteSubcontractors(santiye);
    setSiteForm({
      ...santiye,
      taseronlar: subs,
      taseron: subs.join(', '),
    });
    setNewSubcontractorInput('');
    const firmaExists = (firmalar || []).some((f) => f.isim.trim().toLowerCase() === (santiye.yetkiliFirma || '').trim().toLowerCase());
    setIsCustomFirma(!firmaExists && Boolean(santiye.yetkiliFirma?.trim()));
    setIsSiteModalOpen(true);
  };

  const handleSaveSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm.isim?.trim()) return;

    const subs = siteForm.taseronlar || [];
    const primaryTas = subs.length > 0 ? subs.join(', ') : (siteForm.taseron || '');

    if (editingSite) {
      onUpdateSantiye({
        ...editingSite,
        ...siteForm,
        taseronlar: subs,
        taseron: primaryTas,
        isim: siteForm.isim.trim(),
      } as Santiye);
    } else {
      onAddSantiye({
        id: `s-${Date.now()}`,
        isim: siteForm.isim.trim(),
        yetkiliFirma: siteForm.yetkiliFirma || '',
        taseron: primaryTas,
        taseronlar: subs,
        baslangicTarihi: siteForm.baslangicTarihi || getTodayDateString(),
        bitisTarihi: siteForm.bitisTarihi || '',
        durum: siteForm.durum || 'Aktif',
        ulke: siteForm.ulke || 'Türkiye',
        il: siteForm.il || '',
        ilce: siteForm.ilce || '',
        adres: siteForm.adres || '',
        aciklama: siteForm.aciklama || '',
      });
    }
    setIsSiteModalOpen(false);
  };

  const handleSaveGider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!giderForm.santiyeId || !giderForm.miktar || giderForm.miktar <= 0) return;

    const isCard =
      giderForm.odemeYontemi?.toLowerCase().includes('kart') ||
      giderForm.odemeYontemi?.toLowerCase().includes('kredi') ||
      Boolean(giderForm.kartId && giderForm.odemeYontemi === 'Firma Kredi Kartı');

    const selectedKartId = isCard ? (giderForm.kartId || (krediKartlari?.[0]?.id || '')) : undefined;
    const selectedTaksit = isCard ? (Number(giderForm.taksitSayisi) || 1) : undefined;
    const rawFirmaName = (giderForm.odemeYapilanFirma || '').trim();
    const matchedCariFirma = combinedCariFirmalar.find((f) => {
      if (rawFirmaName) {
        return f.isim.trim().toLowerCase() === rawFirmaName.toLowerCase();
      }
      return Boolean(giderForm.cariFirmaId && f.id === giderForm.cariFirmaId);
    });

    if (editingGider) {
      onUpdateGider({
        ...editingGider,
        santiyeId: giderForm.santiyeId,
        odeyen: giderForm.odeyen || 'Şantiye Yetkilisi',
        odemeYontemi: giderForm.odemeYontemi || 'Nakit',
        tarih: giderForm.tarih || getTodayDateString(),
        kategori: giderForm.kategori || 'Genel',
        aciklama: giderForm.aciklama || '',
        odemeYapilanFirma: matchedCariFirma ? matchedCariFirma.isim : rawFirmaName,
        cariFirmaId: matchedCariFirma ? matchedCariFirma.id : undefined,
        durum: giderForm.durum || 'Ödendi',
        taseron: giderForm.taseron || '',
        miktar: Number(giderForm.miktar) || 0,
        paraBirimi: giderForm.paraBirimi || 'TRY',
        kartId: selectedKartId,
        taksitSayisi: selectedTaksit,
        cariyeEkle: Boolean(!matchedCariFirma && rawFirmaName && addManualFirmaToCari),
      } as any);
    } else {
      onAddGider({
        id: `sg-${Date.now()}`,
        santiyeId: giderForm.santiyeId,
        odeyen: giderForm.odeyen || 'Şantiye Yetkilisi',
        odemeYontemi: giderForm.odemeYontemi || 'Nakit',
        tarih: giderForm.tarih || getTodayDateString(),
        kategori: giderForm.kategori || 'Genel',
        aciklama: giderForm.aciklama || '',
        odemeYapilanFirma: matchedCariFirma ? matchedCariFirma.isim : rawFirmaName,
        cariFirmaId: matchedCariFirma ? matchedCariFirma.id : undefined,
        durum: giderForm.durum || 'Ödendi',
        taseron: giderForm.taseron || '',
        miktar: Number(giderForm.miktar) || 0,
        paraBirimi: giderForm.paraBirimi || 'TRY',
        kartId: selectedKartId,
        taksitSayisi: selectedTaksit,
        cariyeEkle: Boolean(!matchedCariFirma && rawFirmaName && addManualFirmaToCari),
      } as any);
    }
    setIsGiderModalOpen(false);
    setEditingGider(null);
  };

  // Birleştirilmiş Şantiye Giderleri (Doğrudan Harcamalar + Taşeron Cari Ödemeleri + Taşeron Personel Ödemeleri)
  const allUnifiedExpenses = useMemo<UnifiedSantiyeGider[]>(() => {
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

    // 1. Doğrudan Şantiye Giderleri
    const directGiderler: UnifiedSantiyeGider[] = [];
    giderler.forEach((g) => {
      // Eğer gider bir çek veya cari hareketten türetilmişse ve çekte özel bir şantiye seçilmişse onu baz al
      const linkedCek = (cekler || []).find(
        (ck) =>
          (g.cekId && ck.id === g.cekId) ||
          (g.cariHareketId && (ck.cariHareketId === g.cariHareketId || ck.ciroCariHareketId === g.cariHareketId))
      );
      const linkedCari = g.cariHareketId
        ? (cariList || []).find((c) => c.id === g.cariHareketId)
        : undefined;

      let effectiveSantiyeId = g.santiyeId;
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
        if (cekSite) {
          effectiveSantiyeId = cekSite.id;
        }
      } else if (linkedCari && (linkedCari.santiyeId || linkedCari.santiyeAdi)) {
        const cariSite = findSiteByIdOrName(linkedCari.santiyeId, linkedCari.santiyeAdi);
        if (cariSite) {
          effectiveSantiyeId = cariSite.id;
        }
      }

      const cur = g.paraBirimi || 'TRY';
      const tryVal = convertCurrencyToTRY(g.miktar, cur, exchangeRates.rates);
      const firmKey = getCanonicalFirmKey(g.cariFirmaId, g.taseron || g.odemeYapilanFirma, firmalar, taseronlar);
      siteFirmPayments[effectiveSantiyeId] = siteFirmPayments[effectiveSantiyeId] || {};
      siteFirmPayments[effectiveSantiyeId][firmKey] = (siteFirmPayments[effectiveSantiyeId][firmKey] || 0) + tryVal;

      directGiderler.push({
        ...g,
        santiyeId: effectiveSantiyeId,
        kaynakTuru: 'dogrudan',
      });
    });

    const existingGiderIds = new Set(giderler.map((g) => g.id));
    const existingCariIdsInGiderler = new Set(
      giderler.map((g) => g.cariHareketId).filter(Boolean) as string[]
    );
    const existingCekIdsInGiderler = new Set(
      giderler.map((g) => g.cekId).filter(Boolean) as string[]
    );
    const processedCekIds = new Set<string>(existingCekIdsInGiderler);

    // 2. Cari Kayıtlardan Şantiyeye Ait Masraflar (Taşeron, Tedarikçi, Alış Faturaları ve Ödemeler)
    const cariExpenses: UnifiedSantiyeGider[] = [];
    (cariList || []).forEach((c) => {
      const isAlisFaturasi = c.islemTuru === 'alis_faturasi';
      const isOdeme = c.islemTuru === 'odeme';
      const isExplicitRevenue = c.islemTuru === 'satis_faturasi' || c.islemTuru === 'tahsilat';
      if (isExplicitRevenue) return;

      const firma = (firmalar || []).find((f) => f.id === c.firmaId);
      const isCustomer = firma?.tur === 'musteri';
      if (isCustomer && !isAlisFaturasi) return;

      const isExpense = isAlisFaturasi || isOdeme || ((c.alacak || 0) > 0) || ((c.borc || 0) > 0);
      if (!isExpense) return;

      // Nakit esaslı modda alış faturaları gider sayılmaz, sadece fiili ödemeler dahil edilir
      if (accountingBasis === 'cash' && isAlisFaturasi) return;

      if (c.giderId && existingGiderIds.has(c.giderId)) return;
      if (existingCariIdsInGiderler.has(c.id)) return;

      // Personel ödemesinden türetilmiş hareketleri personel listesinden alacağız, mükerreri önle
      const isLinkedToPersonel = Boolean(
        c.odemeId ||
        (odemeList || []).some((o) => o.cariHareketId === c.id) ||
        c.aciklama?.includes('[Taşeron Personeli Hakediş]') ||
        c.aciklama?.includes('[Taşeron Ekip Hakediş Ödemesi]')
      );
      if (isLinkedToPersonel) return;

      const matchingTas = (taseronlar || []).find(
        (t) => t.id === c.firmaId || (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()))
      ) || (firma?.tur === 'taseron' ? { id: firma.id, isim: firma.isim } : null);

      const isTas = Boolean(matchingTas || firma?.tur === 'taseron');
      const tasName = matchingTas?.isim || firma?.isim || 'Firma / Tedarikçi';

      // İlişkili çek kaydı var mı?
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

      // SADECE seçilen şantiyeye göre eşleştir (taşeronun baktığı tüm şantiyelere dağıtma!)
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

      // Şantiye seçilmemişse hiçbir şantiyeye masraf olarak ekleme
      if (!targetSite) return;

      const cur = (c.paraBirimi || 'TRY').trim().toUpperCase();
      const rawAmt = Math.max(Number(c.alacak || 0), Number(c.borc || 0));
      if (rawAmt <= 0) return;
      const tryVal =
        c.tlKarsiligi && c.tlKarsiligi > 0
          ? c.tlKarsiligi
          : c.dovizKuru && c.dovizKuru > 0 && cur !== 'TRY'
          ? rawAmt * c.dovizKuru
          : convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      const firmKey = getCanonicalFirmKey(c.firmaId, tasName, firmalar, taseronlar);

      if (isAlisFaturasi) {
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

      const odeyenLabel = linkedCek
        ? 'Şirket Yönetimi (Çek Portföyü)'
        : 'Şirket Yönetimi (Cari Hesaptan)';

      cariExpenses.push({
        id: `cari-gider-${c.id}`,
        santiyeId: targetSite.id,
        odeyen: odeyenLabel,
        odemeYontemi: odemeYontemiLabel,
        tarih: c.tarih || getTodayDateString(),
        kategori: kategoriLabel,
        aciklama: c.aciklama ? `${c.aciklama}` : `[Cari Ödeme] ${tasName}`,
        odemeYapilanFirma: tasName,
        taseron: isTas ? tasName : undefined,
        durum: 'Ödendi',
        miktar: rawAmt,
        paraBirimi: cur,
        cariHareketId: c.id,
        cekId: linkedCek?.id || c.cekId,
        cekNo: linkedCek?.cekNo,
        kaynakTuru: isTas ? 'taseron_cari' : 'dogrudan',
        kaynakId: c.id,
        isFromCariOnly: true,
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
        const firma = (firmalar || []).find((f) => f.id === ck.ciroFirmaId);
        const matchingTas = (taseronlar || []).find(
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
        const firma = (firmalar || []).find((f) => f.id === ck.firmaId);
        const matchingTas = (taseronlar || []).find(
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

      // Sadece çek üzerinde seçilen şantiyeye ekle
      const targetSite = isCiro
        ? findSiteByIdOrName(ck.ciroSantiyeId || ck.santiyeId, ck.ciroSantiyeProje || ck.santiyeProje)
        : findSiteByIdOrName(ck.santiyeId, ck.santiyeProje);

      if (!targetSite) return;

      const rawAmt = Number(ck.miktar || 0);
      if (rawAmt <= 0) return;
      const cur = ck.paraBirimi || 'TRY';
      const tryVal = convertCurrencyToTRY(rawAmt, cur, exchangeRates.rates);

      const firmKey = getCanonicalFirmKey(firmId, tasName, firmalar, taseronlar);
      siteFirmPayments[targetSite.id] = siteFirmPayments[targetSite.id] || {};
      siteFirmPayments[targetSite.id][firmKey] = (siteFirmPayments[targetSite.id][firmKey] || 0) + tryVal;

      cariExpenses.push({
        id: `cek-gider-${ck.id}`,
        santiyeId: targetSite.id,
        odeyen: 'Şirket Yönetimi (Çek Portföyü)',
        odemeYontemi: `${isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'} (${ck.cekNo})`,
        tarih: (isCiro ? ck.ciroTarihi : ck.alinanTarih) || getTodayDateString(),
        kategori: 'Taşeron Çek Ödemesi',
        aciklama: `[${isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'}] ${ck.bankaAdi} - Çek No: ${ck.cekNo} (Vade: ${ck.vadeTarihi || '-'}) [${targetSite.isim}]${ck.aciklama ? ` - ${ck.aciklama}` : ''}`,
        odemeYapilanFirma: tasName,
        taseron: tasName,
        durum: 'Ödendi',
        miktar: rawAmt,
        paraBirimi: cur,
        cekId: ck.id,
        cekNo: ck.cekNo,
        kaynakTuru: 'taseron_cari',
        kaynakId: ck.cariHareketId || ck.ciroCariHareketId,
        isFromCariOnly: true,
      });
    });

    // 2C. Faturalar Dahil modunda: Alış faturalarını FIFO ile eşleştir ve yalnızca AÇIK FARKI ekle
    if (accountingBasis === 'accrual' && pendingPurchaseInvoices.length > 0) {
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

          cariExpenses.push({
            id: `cari-gider-${inv.c.id}`,
            santiyeId: inv.targetSite.id,
            odeyen: 'Şirket (Alış Faturası)',
            odemeYontemi: 'Alış Faturası (Cari)',
            tarih: inv.c.tarih || getTodayDateString(),
            kategori: 'Alış Faturası / Malzeme Alımı',
            aciklama: inv.c.aciklama
              ? `${inv.c.aciklama} ${status === 'tamamen_odendi' ? '[Tamamı Ödendi - Açık Fark: 0 TL]' : status === 'kismen_odendi' ? `[Kısmen Ödendi - Kalan Açık Fark: ${formatCurrency(openDiff)}]` : `[Açık Fatura: ${formatCurrency(openDiff)}]`}`
              : status === 'tamamen_odendi'
              ? `[Alış Faturası - Ödendi] ${inv.tasName} (0 TL Açık Fark)`
              : status === 'kismen_odendi'
              ? `[Alış Faturası - Kısmen Ödendi] ${inv.tasName} (Kalan Açık Fark: ${formatCurrency(openDiff)})`
              : `[Açık Alış Faturası] ${inv.tasName} (${formatCurrency(openDiff)})`,
            odemeYapilanFirma: inv.tasName,
            taseron: inv.isTas ? inv.tasName : undefined,
            durum: status === 'tamamen_odendi' ? 'Ödendi' : 'Beklemede',
            miktar: openDiff, // Mükerrerliği önlemek için yalnızca ödenmemiş açık fark eklenir!
            paraBirimi: 'TRY',
            cariHareketId: inv.c.id,
            kaynakTuru: inv.isTas ? 'taseron_cari' : 'dogrudan',
            kaynakId: inv.c.id,
            isFromCariOnly: true,
            isInvoice: true,
            faturaNo: inv.c.faturaNo,
            faturaTutari: inv.tryVal,
            odenenTutar: paidPart,
            acikFark: openDiff,
            faturaDurum: status,
          });
        });
      });
    }

    // 3. Şantiyeye Bağlı Personeller Üzerinden Yapılan Tüm Ödemeler (Sadece personelin kendi seçili şantiyesine göre)
    const personelExpenses: UnifiedSantiyeGider[] = [];
    (odemeList || []).forEach((o) => {
      const avans = Number(o.avansOdemesi) || 0;
      const resmi = Number(o.resmiOdeme) || 0;
      const harcama = Number(o.yaptigiHarcama) || 0;
      const legacyMiktar = avans === 0 && resmi === 0 && harcama === 0 ? (Number((o as any).miktar) || 0) : 0;
      const amount = avans + resmi + harcama + legacyMiktar;
      if (amount <= 0) return;

      if (existingGiderIds.has(o.id) || ((o as any).giderId && existingGiderIds.has((o as any).giderId))) return;

      const person = (personnelList || []).find((p) => p.id === o.personelId);
      if (!person) return;

      const personTas = person.taseron?.trim();
      const isOwnStaff = !personTas || personTas.toLowerCase() === 'kendi personelimiz';

      // Ödemenin yapıldığı şantiyeyi öncelikle ödeme kaydındaki santiyeId / santiyeAdi alanından al,
      // böylece personel şantiye değiştirse dahi eski şantiyede yapılan ödemeler eski şantiyede kalır.
      const paymentSiteId = (o as any).santiyeId;
      const paymentSiteName = (o as any).santiyeAdi || (o as any).santiye;
      const targetSite = santiyeler.find(
        (s) =>
          (paymentSiteId && (s.id === paymentSiteId || s.isim.trim().toLowerCase() === paymentSiteId.trim().toLowerCase())) ||
          (paymentSiteName && s.isim.trim().toLowerCase() === paymentSiteName.trim().toLowerCase()) ||
          (!paymentSiteId && !paymentSiteName && person.santiyeId && (s.id === person.santiyeId || s.isim.trim().toLowerCase() === person.santiyeId.trim().toLowerCase())) ||
          (!paymentSiteId && !paymentSiteName && person.santiye && (s.isim.trim().toLowerCase() === person.santiye.trim().toLowerCase() || s.id === person.santiye.trim()))
      );

      if (!targetSite) return;

      const payType =
        avans > 0 && resmi > 0
          ? 'Avans + Resmi'
          : avans > 0
          ? 'Elden Avans'
          : resmi > 0
          ? 'Resmi / Banka'
          : harcama > 0
          ? 'Harcama İadesi'
          : 'Hakediş';

      const kategoriLabel = isOwnStaff ? 'Personel Ödemesi' : 'Taşeron Personel Ödemesi';
      const ilgiliLabel = isOwnStaff
        ? `${person.isim} ${person.soyisim}${person.kategori ? ` (${person.kategori})` : ''}`
        : personTas!;

      personelExpenses.push({
        id: `pers-gider-${o.id}`,
        santiyeId: targetSite.id,
        odeyen: o.odemeYontemi || 'Şirket Kasası / Banka',
        odemeYontemi: o.odemeYontemi || (avans > 0 ? 'Elden Avans' : 'Banka Havalesi'),
        tarih: o.tarih || getTodayDateString(),
        kategori: kategoriLabel,
        aciklama: `[Personel Ödemesi] ${person.isim} ${person.soyisim}${o.aciklama ? ` - ${o.aciklama}` : ''} (${payType})`,
        odemeYapilanFirma: ilgiliLabel,
        taseron: isOwnStaff ? '' : personTas,
        durum: 'Ödendi',
        miktar: amount,
        paraBirimi: o.paraBirimi || 'TRY',
        kaynakTuru: 'taseron_personel',
        kaynakId: o.id,
        personelAdi: `${person.isim} ${person.soyisim}`,
        isFromPersonnelOnly: true,
      });
    });

    return [...directGiderler, ...cariExpenses, ...personelExpenses].sort((a, b) => {
      return (b.tarih || '').localeCompare(a.tarih || '');
    });
  }, [giderler, cariList, cekler, personnelList, odemeList, santiyeler, taseronlar, firmalar, accountingBasis]);

  // Şantiye Gelirleri (Cari Hareket / Fatura Ekle veya Düzenle ekranında İlgili Şantiye seçilen kayıtlar)
  const allSiteRevenues = useMemo(() => {
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

    const items: Array<{
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
      miktar: number;
      paraBirimi: string;
      tutarTRY: number;
      isInvoice?: boolean;
      faturaTutari?: number;
      tahsilEdilenTutar?: number;
      acikFark?: number;
      faturaDurum?: 'tamamen_tahsil' | 'kismen_tahsil' | 'tahsil_edilmedi';
    }> = [];

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

    (cariList || []).forEach((c) => {
      if (c.giderId || c.odemeId) return;
      const isLinkedToPersonel = Boolean(
        (odemeList || []).some((o) => o.cariHareketId === c.id) ||
          c.aciklama?.includes('[Taşeron Personeli Hakediş]') ||
          c.aciklama?.includes('[Taşeron Ekip Hakediş Ödemesi]')
      );
      if (isLinkedToPersonel) return;

      const matchingFirma = (firmalar || []).find((f) => f.id === c.firmaId);
      const matchingTas =
        (taseronlar || []).find(
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

      items.push({
        id: `santiye-gelir-${c.id}`,
        cariId: c.id,
        santiyeId: targetSite.id,
        santiyeIsim: targetSite.isim,
        tarih: c.tarih || getTodayDateString(),
        saat: c.saat,
        firmaId: c.firmaId,
        firmaAdi: matchingFirma?.isim || 'Bilinmeyen Firma',
        faturaNo: c.faturaNo || '-',
        islemTuru: 'tahsilat',
        islemTuruLabel: 'Müşteri Tahsilatı',
        aciklama: c.aciklama || 'Şantiye Gelir / Fatura Kaydı',
        miktar: rawAmt,
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

          items.push({
            id: `santiye-gelir-${inv.c.id}`,
            cariId: inv.c.id,
            santiyeId: inv.targetSite.id,
            santiyeIsim: inv.targetSite.isim,
            tarih: inv.c.tarih || getTodayDateString(),
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
            miktar: openDiff, // Yalnızca açık fark eklenir; mükerrerlik önlenir!
            paraBirimi: 'TRY',
            tutarTRY: openDiff,
            isInvoice: true,
            faturaTutari: inv.tryVal,
            tahsilEdilenTutar: collectedPart,
            acikFark: openDiff,
            faturaDurum: status,
          });
        });
      });
    }

    return items.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  }, [cariList, cekler, firmalar, taseronlar, odemeList, santiyeler, exchangeRates.rates, accountingBasis]);

  const filteredGelirler = useMemo(() => {
    return allSiteRevenues.filter((rev) => {
      const matchesSite = selectedSiteFilter === 'all' || rev.santiyeId === selectedSiteFilter;
      let matchesSearch = true;
      if (expenseSearchQuery.trim()) {
        const q = expenseSearchQuery.trim().toLowerCase();
        matchesSearch = Boolean(
          rev.santiyeIsim.toLowerCase().includes(q) ||
            rev.firmaAdi.toLowerCase().includes(q) ||
            rev.faturaNo.toLowerCase().includes(q) ||
            rev.aciklama.toLowerCase().includes(q) ||
            rev.islemTuruLabel.toLowerCase().includes(q)
        );
      }
      return matchesSite && matchesSearch;
    });
  }, [allSiteRevenues, selectedSiteFilter, expenseSearchQuery]);

  const totalRevenueFiltered = useMemo(() => {
    return filteredGelirler.reduce((acc, curr) => acc + curr.tutarTRY, 0);
  }, [filteredGelirler]);

  // Tüm filtre kategorileri (Tanımlı kategoriler + Personel/Taşeron ödeme kategorileri)
  const filterCategoryOptions = useMemo(() => {
    const set = new Set<string>(activeCategories);
    allUnifiedExpenses.forEach((g) => {
      if (g.kategori) set.add(g.kategori);
    });
    return Array.from(set);
  }, [activeCategories, allUnifiedExpenses]);

  // Filtrelenmiş Şantiye Giderleri
  const filteredGiderler = useMemo(() => {
    return allUnifiedExpenses.filter((g) => {
      const matchesSite = selectedSiteFilter === 'all' || g.santiyeId === selectedSiteFilter;
      const matchesCat = selectedCategoryFilter === 'all' || g.kategori === selectedCategoryFilter;
      const matchesSource = selectedSourceFilter === 'all' || g.kaynakTuru === selectedSourceFilter;

      let matchesSearch = true;
      if (expenseSearchQuery.trim()) {
        const q = expenseSearchQuery.trim().toLowerCase();
        const site = santiyeler.find((s) => s.id === g.santiyeId);
        matchesSearch = Boolean(
          (g.aciklama && g.aciklama.toLowerCase().includes(q)) ||
          (g.odemeYapilanFirma && g.odemeYapilanFirma.toLowerCase().includes(q)) ||
          (g.taseron && g.taseron.toLowerCase().includes(q)) ||
          (g.personelAdi && g.personelAdi.toLowerCase().includes(q)) ||
          (g.odeyen && g.odeyen.toLowerCase().includes(q)) ||
          (g.kategori && g.kategori.toLowerCase().includes(q)) ||
          (site && site.isim.toLowerCase().includes(q))
        );
      }

      return matchesSite && matchesCat && matchesSource && matchesSearch;
    });
  }, [allUnifiedExpenses, selectedSiteFilter, selectedCategoryFilter, selectedSourceFilter, expenseSearchQuery, santiyeler]);

  const totalExpense = useMemo(() => {
    return filteredGiderler.reduce(
      (acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates),
      0
    );
  }, [filteredGiderler, exchangeRates.rates]);

  const expenseBreakdown = useMemo(() => {
    let directTRY = 0;
    let directCount = 0;
    let cariTRY = 0;
    let cariCount = 0;
    let persTRY = 0;
    let persCount = 0;

    filteredGiderler.forEach((g) => {
      const tryVal = convertCurrencyToTRY(g.miktar, g.paraBirimi, exchangeRates.rates);
      if (g.kaynakTuru === 'dogrudan') {
        directTRY += tryVal;
        directCount += 1;
      } else if (g.kaynakTuru === 'taseron_cari') {
        cariTRY += tryVal;
        cariCount += 1;
      } else if (g.kaynakTuru === 'taseron_personel') {
        persTRY += tryVal;
        persCount += 1;
      }
    });

    return { directTRY, directCount, cariTRY, cariCount, persTRY, persCount };
  }, [filteredGiderler, exchangeRates.rates]);

  const getExpensesExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Tarih', dataKey: 'tarih', width: 20 },
      { header: 'Şantiye', dataKey: 'santiye', width: 25 },
      { header: 'Kategori', dataKey: 'kategori', width: 22 },
      { header: 'Kaynak Türü', dataKey: 'kaynakTuru', width: 20 },
      { header: 'Açıklama', dataKey: 'aciklama', width: 35 },
      { header: 'Ödeyen / Yöntem', dataKey: 'odeyen', width: 25 },
      { header: 'Firma / Taşeron', dataKey: 'ilgili', width: 25 },
      { header: 'Tutar (TRY)', dataKey: 'tutarTRY', width: 22, align: 'right' as const },
      { header: 'Durum', dataKey: 'durum', width: 18, align: 'center' as const },
    ];

    let grandTotal = 0;
    const data = filteredGiderler.map((g) => {
      const site = santiyeler.find((s) => s.id === g.santiyeId);
      const tryVal = convertCurrencyToTRY(g.miktar, g.paraBirimi, exchangeRates.rates);
      grandTotal += tryVal;

      const kaynakLabel =
        g.kaynakTuru === 'dogrudan'
          ? 'Doğrudan Fiş'
          : g.kaynakTuru === 'taseron_cari'
          ? 'Taşeron Cari'
          : 'Personel Ödemesi';

      return {
        tarih: g.tarih,
        santiye: site ? site.isim : '-',
        kategori: g.kategori || '-',
        kaynakTuru: kaynakLabel,
        aciklama: g.aciklama || '-',
        odeyen: g.odeyen || g.odemeYontemi || '-',
        ilgili: g.odemeYapilanFirma || g.taseron || g.personelAdi || '-',
        tutarTRY: formatCurrency(tryVal),
        durum: g.durum || 'Ödendi',
      };
    });

    return {
      title: 'Şantiye Giderleri ve Taşeron/Personel Ödemeleri Listesi',
      subtitle: `Toplam ${filteredGiderler.length} adet harcama kaydı`,
      filename: `Santiye_Giderleri_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Harcama Kaydı', value: `${filteredGiderler.length} adet` },
        { label: 'Doğrudan Şantiye Giderleri', value: `${formatCurrency(expenseBreakdown.directTRY)} (${expenseBreakdown.directCount} adet)` },
        { label: 'Taşeron Cari Ödemeleri', value: `${formatCurrency(expenseBreakdown.cariTRY)} (${expenseBreakdown.cariCount} adet)` },
        { label: 'Taşeron Personel Ödemeleri', value: `${formatCurrency(expenseBreakdown.persTRY)} (${expenseBreakdown.persCount} adet)` },
        { label: 'Genel Toplam Tutar (TRY)', value: formatCurrency(grandTotal) },
      ],
      orientation: 'landscape',
    };
  };

  const getSitesExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Şantiye Adı', dataKey: 'isim', width: 28 },
      { header: 'Yetkili Firma (Müşteri)', dataKey: 'yetkiliFirma', width: 26 },
      { header: 'Bağlı Taşeronlar', dataKey: 'taseronlar', width: 28 },
      { header: 'Konum / Adres', dataKey: 'konum', width: 30 },
      { header: 'Durum', dataKey: 'durum', width: 16, align: 'center' as const },
      { header: 'Başlangıç Tarihi', dataKey: 'baslangicTarihi', width: 20 },
      { header: 'Bitiş Tarihi', dataKey: 'bitisTarihi', width: 20 },
      { header: 'Toplam Harcama (TRY)', dataKey: 'toplamHarcama', width: 26, align: 'right' as const },
    ];

    let grandTotal = 0;
    const data = santiyeler.map((s) => {
      const siteExpenses = allUnifiedExpenses.filter((g) => g.santiyeId === s.id);
      const siteTotalExp = siteExpenses.reduce(
        (acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates),
        0
      );
      grandTotal += siteTotalExp;

      const subs = getSiteSubcontractors(s);

      return {
        isim: s.isim,
        yetkiliFirma: s.yetkiliFirma || '-',
        taseronlar: subs.length > 0 ? subs.join(', ') : '-',
        konum: s.adres ? `${s.il}/${s.ilce} - ${s.adres}` : `${s.il}/${s.ilce}`,
        durum: s.durum,
        baslangicTarihi: s.baslangicTarihi || '-',
        bitisTarihi: s.bitisTarihi || '-',
        toplamHarcama: formatCurrency(siteTotalExp),
      };
    });

    return {
      title: 'Şantiyeler Listesi ve Harcama İcmali',
      subtitle: `Toplam ${santiyeler.length} şantiye`,
      filename: `Santiyeler_Listesi_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Şantiye Sayısı', value: `${santiyeler.length} adet` },
        { label: 'Tüm Şantiyeler Toplam Harcaması', value: formatCurrency(grandTotal) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Subtab navigation */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl">
          <button
            onClick={() => setSubTab('sites')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'sites'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardHat className="w-4 h-4 text-amber-500" />
            <span>Şantiyeler</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              subTab === 'sites' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {santiyeler.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('expenses')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'expenses'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 text-rose-600" />
            <span>Şantiye Giderleri</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              subTab === 'expenses' ? 'bg-rose-100 text-rose-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {allUnifiedExpenses.length}
            </span>
          </button>
          <button
            onClick={() => setSubTab('revenues')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === 'revenues'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Şantiye Gelirleri</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              subTab === 'revenues' ? 'bg-blue-100 text-blue-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {allSiteRevenues.length}
            </span>
          </button>

          {/* Hesaplama Modu Seçici (Nakit vs Tahakkuk) */}
          <div className="hidden md:inline-flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg ml-2">
            <button
              type="button"
              onClick={() => setAccountingBasis('cash')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                accountingBasis === 'cash'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Faturalar hariç, sadece fiili ödeme ve tahsilatlar şantiyeye yansıtılır"
            >
              💵 Fiili Ödemeler (Nakit)
            </button>
            <button
              type="button"
              onClick={() => setAccountingBasis('accrual')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                accountingBasis === 'accrual'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mükerrerliği önlemek için firmanın şantiyedeki ödenmemiş açık fatura bakiye farkı dahil edilir"
            >
              📑 Faturalar Dahil (Açık Fark)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenCurrencies && (
            <button
              type="button"
              onClick={onOpenCurrencies}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
              title="Günlük Döviz Kurları ve Para Birimlerini Yönet"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Döviz Kurları</span>
            </button>
          )}
          {subTab === 'sites' ? (
            <div className="flex items-center gap-2">
              <ExportButton
                options={getSitesExportOptions}
                buttonText="Şantiyeleri Dışa Aktar"
                variant="secondary"
              />
              <button
                onClick={openAddSiteModal}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Yeni Şantiye Ekle</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ExportButton
                options={getExpensesExportOptions}
                buttonText="Giderleri Dışa Aktar"
                variant="secondary"
              />
              <button
                onClick={() => {
                  setNewCategoryInput('');
                  setCategoryError('');
                  setIsCategoryModalOpen(true);
                }}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                title="Şantiye Gider Kategorilerini Yönet veya Yeni Kategori Ekle"
              >
                <Tag className="w-3.5 h-3.5 text-amber-700" />
                <span>Kategori Ekle / Yönet</span>
              </button>
              <button
                onClick={openAddGiderModal}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Gider Fişi / Harcama Gir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: SITES (Tablo 7) */}
      {subTab === 'sites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {santiyeler.map((site) => {
            const siteExpenses = allUnifiedExpenses.filter((g) => g.santiyeId === site.id);
            const siteTotalExp = siteExpenses.reduce(
              (acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates),
              0
            );
            const siteRevenues = allSiteRevenues.filter((r) => r.santiyeId === site.id);
            const siteTotalRev = siteRevenues.reduce((acc, curr) => acc + curr.tutarTRY, 0);
            const siteNetProfit = siteTotalRev - siteTotalExp;
            const directExp = siteExpenses.filter(g => g.kaynakTuru === 'dogrudan').reduce((acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates), 0);
            const cariExp = siteExpenses.filter(g => g.kaynakTuru === 'taseron_cari').reduce((acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates), 0);
            const persExp = siteExpenses.filter(g => g.kaynakTuru === 'taseron_personel').reduce((acc, curr) => acc + convertCurrencyToTRY(curr.miktar, curr.paraBirimi, exchangeRates.rates), 0);
            const siteSubs = getSiteSubcontractors(site);

            return (
              <div
                key={site.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {site.isim}
                        </h4>
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                            site.durum === 'Aktif'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {site.durum}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditSiteModal(site)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Düzenle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            title: 'Şantiyeyi Sil',
                            description: `"${site.ad}" şantiyesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                            onConfirm: () => onDeleteSantiye(site.id),
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Site Info */}
                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Yetkili Firma: <b>{site.yetkiliFirma || '-'}</b></span>
                    </div>

                    {/* Bağlı Taşeronlar */}
                    <div className="flex items-start gap-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-slate-600 font-medium">Bağlı Taşeronlar ({siteSubs.length}): </span>
                        {siteSubs.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {siteSubs.map((sub, sIdx) => {
                              const tasObj = (taseronlar || []).find((t) => t.isim.trim().toLowerCase() === sub.trim().toLowerCase());
                              return (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold"
                                >
                                  <span>{sub}</span>
                                  {tasObj?.uzmanlik && <span className="text-[10px] text-indigo-500 font-normal">({tasObj.uzmanlik})</span>}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Taşeron atanmadı</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{site.il} / {site.ilce} - {site.adres}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Başlangıç: {site.baslangicTarihi} {site.bitisTarihi && `• Bitiş: ${site.bitisTarihi}`}</span>
                    </div>
                  </div>

                  {site.aciklama && (
                    <p className="mt-3 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {site.aciklama}
                    </p>
                  )}
                </div>

                {/* Revenue, Expense & Profitability Summary + Quick Navigation */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                    <div>
                      <div className="text-[10px] font-semibold text-blue-700">Toplam Gelir</div>
                      <div className="font-bold text-blue-700 font-mono text-xs sm:text-sm truncate">
                        {formatCurrency(siteTotalRev)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-rose-700">Toplam Gider</div>
                      <div className="font-bold text-rose-700 font-mono text-xs sm:text-sm truncate">
                        {formatCurrency(siteTotalExp)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-600">Net Kâr / Zarar</div>
                      <div
                        className={`font-black font-mono text-xs sm:text-sm truncate ${
                          siteNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(siteNetProfit)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSiteFilter(site.id);
                        setSubTab('revenues');
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border border-blue-200"
                      title={`${site.isim} şantiyesine ait gelir (Cari / Fatura) kayıtlarını listele`}
                    >
                      <span>Gelirleri Gör ({siteRevenues.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSiteFilter(site.id);
                        setSelectedSourceFilter('all');
                        setSubTab('expenses');
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border border-amber-200"
                      title={`${site.isim} şantiyesine ait tüm gider ve ödemeleri listele`}
                    >
                      <span>Giderleri Gör ({siteExpenses.length})</span>
                    </button>
                  </div>

                  {siteExpenses.length > 0 && (
                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5 pt-1 border-t border-slate-100">
                      <span>Fiş: <strong className="text-slate-700">{formatCurrency(directExp)}</strong></span>
                      <span>•</span>
                      <span>Cari: <strong className="text-teal-700">{formatCurrency(cariExp)}</strong></span>
                      <span>•</span>
                      <span>Personel: <strong className="text-indigo-700">{formatCurrency(persExp)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: SITE REVENUES (Şantiye Gelirleri - Cari Hareket & Faturalar) */}
      {subTab === 'revenues' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-2xs">
              <div className="text-xs font-bold text-blue-800 mb-0.5">Toplam Şantiye Gelirleri</div>
              <div className="text-lg sm:text-xl font-black text-blue-900 font-mono">
                {formatCurrency(totalRevenueFiltered)}
              </div>
              <div className="text-[11px] text-blue-600 mt-1 font-medium">
                {filteredGelirler.length} adet cari hareket / fatura & tahsilat kaydı
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/10 shadow-2xs">
              <div className="text-xs font-bold text-rose-800 mb-0.5">Toplam Şantiye Giderleri</div>
              <div className="text-lg sm:text-xl font-black text-rose-700 font-mono">
                {formatCurrency(totalExpense)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {filteredGiderler.length} adet masraf fişi & ödeme
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-700 mb-0.5">Seçili Kapsam Net Kâr / Zarar</div>
              <div
                className={`text-lg sm:text-xl font-black font-mono ${
                  totalRevenueFiltered - totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(totalRevenueFiltered - totalExpense)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Cari Hareket / Fatura ekranından şantiye seçilen gelirler dahil
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                <select
                  value={selectedSiteFilter}
                  onChange={(e) => setSelectedSiteFilter(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
                >
                  <option value="all">Tüm Şantiyeler ({allSiteRevenues.length} Gelir Kaydı)</option>
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏗️ {s.isim}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    placeholder="Firma, fatura no, şantiye veya açıklama ara..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>
              {selectedSiteFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedSiteFilter('all')}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 cursor-pointer"
                >
                  Tüm Şantiyeleri Göster
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <th className="py-3 px-4 w-10 text-center">#</th>
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">İlgili Şantiye / Proje</th>
                    <th className="py-3 px-4">İşlem Türü</th>
                    <th className="py-3 px-4">Firma / Müşteri</th>
                    <th className="py-3 px-4">Fatura / Dekont No</th>
                    <th className="py-3 px-4">Açıklama</th>
                    <th className="py-3 px-4 text-right">Gelir Tutarı (TRY)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGelirler.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                        Şantiye gelir kaydı bulunamadı. <strong>Firmalar &amp; Cari Hesaplar</strong> sekmesinde <strong>Cari Hareket / Fatura Ekle veya Düzenle</strong> ekranından &quot;İlgili Şantiye / Proje&quot; seçerek şantiye geliri ekleyebilirsiniz.
                      </td>
                    </tr>
                  ) : (
                    filteredGelirler.map((rev, index) => (
                      <tr key={rev.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {rev.tarih}
                          {rev.saat ? <span className="text-[10px] text-slate-400 ml-1">{rev.saat}</span> : null}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            🏗️ {rev.santiyeIsim}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              rev.islemTuru === 'tahsilat'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {rev.islemTuruLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {rev.firmaAdi}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{rev.faturaNo || '-'}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={rev.aciklama}>
                          {rev.aciklama}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-700 font-mono whitespace-nowrap">
                          {rev.isInvoice && rev.acikFark === 0 ? (
                            <div className="text-emerald-700 font-bold text-xs flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                              <span>+0 TL (Tahsil Edildi)</span>
                            </div>
                          ) : (
                            <div>+{formatCurrency(rev.tutarTRY)}</div>
                          )}
                          {rev.isInvoice ? (
                            <div className="text-[10px] text-indigo-600 font-normal">
                              {rev.acikFark === 0 ? (
                                <span>Fatura: {formatCurrency(rev.faturaTutari || rev.miktar)}</span>
                              ) : rev.tahsilEdilenTutar && rev.tahsilEdilenTutar > 0 ? (
                                <span>Açık Fark (Fatura: {formatCurrency(rev.faturaTutari || rev.miktar)})</span>
                              ) : (
                                <span>Açık Fatura</span>
                              )}
                            </div>
                          ) : rev.paraBirimi !== 'TRY' ? (
                            <div className="text-[10px] text-slate-500 font-normal">
                              ({formatCurrency(rev.miktar, rev.paraBirimi)})
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: EXPENSES (Tablo 8) */}
      {subTab === 'expenses' && (
        <div className="space-y-4">
          {/* Summary Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 mb-0.5">Toplam Filtrelenen Harcama</div>
              <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                {formatCurrency(totalExpense)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Toplam {filteredGiderler.length} adet işlem kaydı
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-0.5">
                <span>Doğrudan Harcamalar</span>
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-800 font-mono">
                {formatCurrency(expenseBreakdown.directTRY)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {expenseBreakdown.directCount} adet doğrudan fiş/fatura
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-teal-200/80 bg-teal-50/20 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-800 mb-0.5">
                <span>Taşeron Cari Ödemeleri</span>
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-teal-900 font-mono">
                {formatCurrency(expenseBreakdown.cariTRY)}
              </div>
              <div className="text-[11px] text-teal-600 mt-1 font-medium">
                {expenseBreakdown.cariCount} adet taşeron cari hesabı ödemesi
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-800 mb-0.5">
                <span>Personel Hakediş / Avans</span>
                <Users className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-indigo-900 font-mono">
                {formatCurrency(expenseBreakdown.persTRY)}
              </div>
              <div className="text-[11px] text-indigo-600 mt-1 font-medium">
                {expenseBreakdown.persCount} adet şantiye personel ödemesi
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Şantiye</label>
                  <select
                    value={selectedSiteFilter}
                    onChange={(e) => setSelectedSiteFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="all">Tüm Şantiyeler ({santiyeler.length})</option>
                    {santiyeler.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.isim}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Kategori</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="all">Tüm Kategoriler ({filterCategoryOptions.length})</option>
                    {filterCategoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Kaynak / İşlem Türü</label>
                  <select
                    value={selectedSourceFilter}
                    onChange={(e) => setSelectedSourceFilter(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
                  >
                    <option value="all">Tüm Harcama ve Ödemeler</option>
                    <option value="dogrudan">Sadece Doğrudan Fişler</option>
                    <option value="taseron_cari">Sadece Taşeron Cari Ödemeleri</option>
                    <option value="taseron_personel">Sadece Personel Ödemeleri</option>
                  </select>
                </div>
              </div>

              {/* Search input */}
              <div className="w-full lg:w-72">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-0.5">Arama</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Açıklama, firma, personel..."
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500"
                  />
                  {expenseSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExpenseSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Şantiye</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Kaynak</th>
                    <th className="px-4 py-3">Açıklama</th>
                    <th className="px-4 py-3">Ödeyen & Yöntem</th>
                    <th className="px-4 py-3">Firma / Taşeron</th>
                    <th className="px-4 py-3 text-right">Miktar (₺)</th>
                    <th className="px-4 py-3 text-center">Durum</th>
                    <th className="px-4 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGiderler.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        Filtrelere uygun gider veya ödeme kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredGiderler.map((g) => {
                      const site = santiyeler.find((s) => s.id === g.santiyeId);
                      const linkedCard = (krediKartlari || []).find((c) => c.id === g.kartId);
                      return (
                        <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                            {g.tarih}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {site ? site.isim : 'Şantiye Belirtilmedi'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-xs">
                              {g.kategori}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {g.kaynakTuru === 'dogrudan' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                                <Receipt className="w-3 h-3 text-slate-500" />
                                <span>Doğrudan Fiş</span>
                              </span>
                            ) : g.kaynakTuru === 'taseron_cari' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold text-[11px] border border-teal-200">
                                <Building2 className="w-3 h-3 text-teal-600" />
                                <span>Taşeron Cari</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-200">
                                <Users className="w-3 h-3 text-indigo-600" />
                                <span>Personel Ödemesi</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs">
                            <div className="truncate font-medium text-slate-800">{g.aciklama}</div>
                            {g.personelAdi && (
                              <div className="text-[11px] text-indigo-600 font-bold mt-0.5 flex items-center gap-1">
                                <User className="w-3 h-3 text-indigo-500" />
                                <span>Personel: {g.personelAdi}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-medium text-slate-800">{g.odeyen}</div>
                            <div className="text-[11px] text-slate-500">{g.odemeYontemi}</div>
                            {linkedCard && (
                              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold" title={`Kredi Kartı Harcaması: ${linkedCard.kartAdi}`}>
                                <CreditCard className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>{linkedCard.kartAdi || linkedCard.banka} (•• {linkedCard.kartNumarasiSon4})</span>
                                {g.taksitSayisi && g.taksitSayisi > 1 && (
                                  <span className="ml-0.5 px-1 py-0.2 rounded bg-purple-200 text-purple-900 text-[9px] font-bold">
                                    {g.taksitSayisi} Taksit
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-semibold text-slate-800">{g.odemeYapilanFirma || '-'}</div>
                            {g.taseron && <div className="text-[11px] text-indigo-600 font-medium">Taşeron: {g.taseron}</div>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <span>{formatCurrency(g.miktar, g.paraBirimi)}</span>
                              {g.paraBirimi && g.paraBirimi !== 'TRY' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  {g.paraBirimi}
                                </span>
                              )}
                            </div>
                            {g.paraBirimi && g.paraBirimi !== 'TRY' && (
                              <div className="text-[10px] text-slate-400 font-mono font-normal">
                                ≈ {formatCurrency(convertCurrencyToTRY(g.miktar, g.paraBirimi, exchangeRates.rates))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                g.durum === 'Ödendi'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {g.durum}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {g.kaynakTuru === 'dogrudan' ? (
                                <>
                                  <button
                                    onClick={() => openEditGiderModal(g)}
                                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                                    title="Gideri Düzenle"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const site = santiyeler.find((s) => s.id === g.santiyeId);
                                      const siteLabel = site ? ` (${site.isim})` : '';
                                      setDeleteConfirm({
                                        isOpen: true,
                                        title: 'Gider Kaydını Sil',
                                        description: `${g.tarih} tarihli, ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki "${g.aciklama || g.kategori}" gider kaydını${siteLabel} silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                        onConfirm: () => onDeleteGider(g.id),
                                      });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                    title="Gideri Sil"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : g.kaynakTuru === 'taseron_cari' ? (
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      isOpen: true,
                                      title: 'Taşeron Cari Ödemesini Sil',
                                      description: `${g.tarih} tarihli, ${g.odemeYapilanFirma} taşeronuna ait ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki cari ödeme kaydını silmek istediğinize emin misiniz? Bu işlem taşeronun cari hesabından da silinecektir.`,
                                      onConfirm: () => {
                                        if (g.kaynakId && onDeleteCariHareket) {
                                          onDeleteCariHareket(g.kaynakId);
                                        }
                                      },
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Taşeron Cari Ödemesini Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      isOpen: true,
                                      title: 'Personel Ödemesini Sil',
                                      description: `${g.tarih} tarihli, ${g.personelAdi || 'Personel'} adına yapılmış ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki hakediş/avans ödemesini silmek istediğinize emin misiniz? Bu işlem personelin hakediş ve cari hesap kayıtlarından da silinecektir.`,
                                      onConfirm: () => {
                                        if (g.kaynakId && onDeleteOdeme) {
                                          onDeleteOdeme(g.kaynakId);
                                        }
                                      },
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="Personel Hakediş/Avans Ödemesini Sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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

      {/* Şantiye Ekle/Düzenle Modal */}
      {isSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900">
                  {editingSite ? 'Şantiye Bilgilerini Düzenle' : 'Yeni Şantiye / Proje Ekle'}
                </h3>
              </div>
              <button
                onClick={() => setIsSiteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Şantiye / Proje Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Merkez Plaza Kule Projesi"
                  value={siteForm.isim || ''}
                  onChange={(e) => setSiteForm({ ...siteForm, isim: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Yetkili Firma (Müşteri) Seçimi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Yetkili Firma (Müşteri)</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      {(firmalar || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFirmaPickerTarget('site');
                            setMusteriSearchQuery('');
                            setMusteriFilterTab('musteri');
                            setIsMusteriPickerOpen(true);
                          }}
                          className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          title="Kayıtlı müşteriler tablosunu aç ve doğrudan tablodan seç"
                        >
                          <Building2 className="w-3 h-3 text-blue-600" />
                          <span>Müşterilerden Seç ({musteriFirmalar.length})</span>
                        </button>
                      )}

                      {(firmalar || []).length > 0 && (
                        <button
                          id="btn-toggle-firma-mode"
                          type="button"
                          onClick={() => {
                            const nextMode = !isCustomFirma;
                            setIsCustomFirma(nextMode);
                            if (!nextMode && !siteForm.yetkiliFirma && musteriFirmalar.length > 0) {
                              setSiteForm({ ...siteForm, yetkiliFirma: musteriFirmalar[0].isim });
                            }
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          {isCustomFirma ? '← Listeden Seç' : '✍️ Manuel'}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCustomFirma && (firmalar || []).length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        id="select-site-customer"
                        value={siteForm.yetkiliFirma || ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomFirma(true);
                            setSiteForm({ ...siteForm, yetkiliFirma: '' });
                          } else {
                            setSiteForm({ ...siteForm, yetkiliFirma: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Müşteri / Yetkili Firma Seçiniz --</option>
                        {musteriFirmalar.length > 0 && (
                          <optgroup label={`Kayıtlı Müşteriler (${musteriFirmalar.length})`}>
                            {musteriFirmalar.map((m) => (
                              <option key={m.id} value={m.isim}>
                                {m.isim} {m.ilgili ? `(Yetkili: ${m.ilgili})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {digerFirmalar.length > 0 && (
                          <optgroup label={`Diğer Firmalar (${digerFirmalar.length})`}>
                            {digerFirmalar.map((f) => (
                              <option key={f.id} value={f.isim}>
                                {f.isim} {f.tur === 'tedarikci' ? '(Tedarikçi)' : f.tur === 'taseron' ? '(Taşeron)' : `(${f.tur || 'Firma'})`}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value="__custom__">✍️ + Listede Yok (Manuel Firma Yaz)...</option>
                      </select>

                      {selectedFirmaDetails && (
                        <div className="text-[11px] bg-blue-50/80 text-blue-900 p-2.5 rounded-lg border border-blue-200/70 flex items-center justify-between gap-2">
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold">{selectedFirmaDetails.isim}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                                {selectedFirmaDetails.tur === 'musteri' ? 'Kayıtlı Müşteri' : (selectedFirmaDetails.tur || 'Firma')}
                              </span>
                            </div>
                            <div className="text-slate-600 mt-0.5 flex items-center gap-2">
                              {selectedFirmaDetails.ilgili && <span>Yetkili: <b>{selectedFirmaDetails.ilgili}</b></span>}
                              {selectedFirmaDetails.telefon && <span>• Tel: <b>{selectedFirmaDetails.telefon}</b></span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(selectedFirmaDetails.vergiDairesi || selectedFirmaDetails.vergiNo) && (
                              <span className="font-mono text-[10px] text-blue-700 font-semibold">
                                {selectedFirmaDetails.vergiDairesi ? `${selectedFirmaDetails.vergiDairesi} - ` : ''}VN: {selectedFirmaDetails.vergiNo || '-'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSiteForm({ ...siteForm, yetkiliFirma: '' })}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                              title="Seçimi Temizle"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        id="input-site-customer-manual"
                        type="text"
                        placeholder="Örn: Zirve Yapı A.Ş."
                        value={siteForm.yetkiliFirma || ''}
                        onChange={(e) => setSiteForm({ ...siteForm, yetkiliFirma: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                      />
                      {(firmalar || []).length === 0 ? (
                        <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                          Sistemde henüz kayıtlı firma/müşteri yok. Manuel yazabilir veya Firmalar modülünden müşteri kaydedebilirsiniz.
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Özel veya listede bulunmayan müşteri/işveren firma adını yazabilirsiniz.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Bağlı Taşeronlar (Birden Fazla Eklenebilir) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Bağlı Taşeronlar</span>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {(siteForm.taseronlar || []).length} Taşeron
                      </span>
                    </label>

                    {(taseronlar || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTaseronSearchQuery('');
                          setIsTaseronPickerOpen(true);
                        }}
                        className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Taşeronlar tablosundan seçerek ekle"
                      >
                        <Layers className="w-3 h-3 text-indigo-600" />
                        <span>Taşeron Tablosundan Seç ({taseronlar.length})</span>
                      </button>
                    )}
                  </div>

                  {/* List of currently selected subcontractors as tags/chips */}
                  {(siteForm.taseronlar && siteForm.taseronlar.length > 0) ? (
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px] items-center">
                      {siteForm.taseronlar.map((tasName, idx) => {
                        const tasObj = (taseronlar || []).find((t) => t.isim.trim().toLowerCase() === tasName.trim().toLowerCase());
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 shadow-2xs text-xs font-medium"
                          >
                            <span className="font-semibold">{tasName}</span>
                            {tasObj?.uzmanlik && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-normal">
                                {tasObj.uzmanlik}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSubcontractorFromSite(tasName)}
                              className="text-slate-400 hover:text-rose-600 rounded p-0.5 cursor-pointer ml-0.5"
                              title="Taşeronu Şantiyeden Çıkar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                      Henüz şantiyeye bağlı taşeron eklenmedi. Aşağıdaki listeden seçebilir veya manuel yazıp ekleyebilirsiniz.
                    </div>
                  )}

                  {/* Add Subcontractor Control: Dropdown or Manual input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Quick Dropdown Add from Registered Subcontractors */}
                    {(taseronlar || []).length > 0 && (
                      <div>
                        <select
                          id="select-site-subcontractor"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddSubcontractorToSite(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">+ Kayıtlı Taşeron Ekle...</option>
                          {taseronlar.map((t) => {
                            const isAlreadyAdded = (siteForm.taseronlar || []).some(
                              (s) => s.toLowerCase() === t.isim.toLowerCase()
                            );
                            return (
                              <option key={t.id} value={t.isim} disabled={isAlreadyAdded}>
                                {isAlreadyAdded ? `✓ ${t.isim} (Eklendi)` : `${t.isim} ${t.uzmanlik ? `(${t.uzmanlik})` : ''}`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Manual entry for custom subcontractor */}
                    <div className="flex items-center gap-1.5">
                      <input
                        id="input-site-subcontractor-manual"
                        type="text"
                        placeholder="Örn: Özel Kalıp Ustası..."
                        value={newSubcontractorInput}
                        onChange={(e) => setNewSubcontractorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubcontractorToSite(newSubcontractorInput);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSubcontractorToSite(newSubcontractorInput)}
                        disabled={!newSubcontractorInput.trim()}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ekle</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">İl</label>
                  <input
                    type="text"
                    placeholder="İstanbul"
                    value={siteForm.il || ''}
                    onChange={(e) => setSiteForm({ ...siteForm, il: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">İlçe</label>
                  <input
                    type="text"
                    placeholder="Ataşehir"
                    value={siteForm.ilce || ''}
                    onChange={(e) => setSiteForm({ ...siteForm, ilce: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Durum</label>
                  <select
                    value={siteForm.durum || 'Aktif'}
                    onChange={(e) => setSiteForm({ ...siteForm, durum: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tamamlandı">Tamamlandı</option>
                    <option value="Askıda">Askıda</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adres</label>
                <input
                  type="text"
                  placeholder="Detaylı sokak/cadde adresi"
                  value={siteForm.adres || ''}
                  onChange={(e) => setSiteForm({ ...siteForm, adres: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={siteForm.baslangicTarihi || ''}
                    onChange={(e) => setSiteForm({ ...siteForm, baslangicTarihi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tahmini Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={siteForm.bitisTarihi || ''}
                    onChange={(e) => setSiteForm({ ...siteForm, bitisTarihi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Açıklama / Proje Detayı</label>
                <textarea
                  rows={2}
                  placeholder="Proje kapsamı ve şantiye notları..."
                  value={siteForm.aciklama || ''}
                  onChange={(e) => setSiteForm({ ...siteForm, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSiteModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {editingSite ? 'Güncelle' : 'Şantiyeyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Şantiye Gider Ekle / Düzenle Modal */}
      {isGiderModalOpen && (() => {
        const isCardPayment =
          giderForm.odemeYontemi?.toLowerCase().includes('kart') ||
          giderForm.odemeYontemi?.toLowerCase().includes('kredi') ||
          Boolean(giderForm.kartId && giderForm.odemeYontemi === 'Firma Kredi Kartı');
        
        const selectedCard = (krediKartlari || []).find((c) => c.id === giderForm.kartId);
        const selectedCardBal = selectedCard ? getCardBalance(selectedCard.id) : null;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                {editingGider ? (
                  <Edit3 className="w-5 h-5 text-amber-600" />
                ) : (
                  <Coins className="w-5 h-5 text-amber-500" />
                )}
                <h3 className="font-bold text-slate-900">
                  {editingGider ? 'Şantiye Gider Fişini Düzenle' : 'Yeni Şantiye Gider Fişi Gir'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsGiderModalOpen(false);
                  setEditingGider(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGider} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Şantiye Seçiniz <span className="text-rose-500">*</span>
                </label>
                <select
                  value={giderForm.santiyeId}
                  onChange={(e) => setGiderForm({ ...giderForm, santiyeId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isim} ({s.il})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gider Tarihi</label>
                  <input
                    type="date"
                    value={giderForm.tarih}
                    onChange={(e) => setGiderForm({ ...giderForm, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Kategori</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryInput('');
                        setCategoryError('');
                        setIsCategoryModalOpen(true);
                      }}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Kategori Ekle</span>
                    </button>
                  </div>
                  <select
                    value={giderForm.kategori}
                    onChange={(e) => setGiderForm({ ...giderForm, kategori: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tutar <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Para Birimi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                        {getCurrencySymbol(giderForm.paraBirimi || 'TRY')}
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={giderForm.miktar === 0 ? '' : giderForm.miktar}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGiderForm({ ...giderForm, miktar: val === '' ? 0 : parseFloat(val) || 0 });
                        }}
                        className="w-full pl-8 pr-3 py-2 text-sm font-bold rounded-xl border border-slate-300 font-mono"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <CurrencySelector
                        value={giderForm.paraBirimi || 'TRY'}
                        onChange={(curr) => setGiderForm({ ...giderForm, paraBirimi: curr })}
                      />
                    </div>
                  </div>
                  {giderForm.paraBirimi && giderForm.paraBirimi !== 'TRY' && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-1.5 mt-1 border border-amber-200/80 font-mono flex items-center justify-between">
                      <span>≈ {formatCurrency(convertCurrencyToTRY(Number(giderForm.miktar) || 0, giderForm.paraBirimi, exchangeRates.rates))}</span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        1 {giderForm.paraBirimi} = {exchangeRates.rates[giderForm.paraBirimi] || '-'} ₺
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ödeme Yöntemi</label>
                  <select
                    value={giderForm.odemeYontemi}
                    onChange={(e) => {
                      const newMethod = e.target.value;
                      const isNowCard =
                        newMethod.toLowerCase().includes('kart') ||
                        newMethod.toLowerCase().includes('kredi') ||
                        newMethod === 'Firma Kredi Kartı';
                      setGiderForm({
                        ...giderForm,
                        odemeYontemi: newMethod,
                        kartId: isNowCard ? (giderForm.kartId || (krediKartlari[0]?.id || '')) : giderForm.kartId,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    {odemeYontemleri.map((oy) => (
                      <option key={oy.id} value={oy.isim}>
                        {oy.isim}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kredi Kartı ile Ödeme Bölümü */}
              {isCardPayment && (
                <div className="bg-purple-50/80 p-4 rounded-xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-950 uppercase flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>Kredi Kartı ile Ödeme (Kart Sistemine Kayıt)</span>
                    </label>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
                      Ekstreye Otomatik İşlenir
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Ödemenin Çekileceği Kredi Kartı <span className="text-rose-500">*</span>
                    </label>
                    {krediKartlari && krediKartlari.length > 0 ? (
                      <select
                        value={giderForm.kartId || ''}
                        onChange={(e) => setGiderForm({ ...giderForm, kartId: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-purple-500"
                        required={isCardPayment}
                      >
                        <option value="">-- Kredi Kartı Seçiniz --</option>
                        {krediKartlari.map((k) => {
                          const bal = getCardBalance(k.id);
                          return (
                            <option key={k.id} value={k.id}>
                              {k.banka} - {k.kartAdi} (Son 4: •••• {k.kartNumarasiSon4}) | Kalan Limit: {formatCurrency(bal.available)}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Tanımlı Kredi Kartı Bulunamadı:</strong> Henüz sisteme kayıtlı aktif kredi kartı yok. "Kredi Kartları" menüsünden kart tanımlayabilirsiniz.
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedCard && selectedCardBal && (
                    <div className="p-2.5 rounded-lg bg-white border border-purple-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-purple-950 font-semibold">
                        <span>{selectedCard.banka} - {selectedCard.kartAdi}</span>
                        <span className="font-mono text-[11px] text-purple-700">•••• {selectedCard.kartNumarasiSon4} ({selectedCard.kartSahibi})</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-purple-100">
                        <span>Kullanılabilir Kart Limiti:</span>
                        <strong className="text-emerald-700 font-mono">{formatCurrency(selectedCardBal.available)}</strong>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">Taksit Sayısı</label>
                      <select
                        value={giderForm.taksitSayisi || 1}
                        onChange={(e) => setGiderForm({ ...giderForm, taksitSayisi: Number(e.target.value) || 1 })}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white"
                      >
                        <option value={1}>1 (Tek Çekim)</option>
                        <option value={2}>2 Taksit</option>
                        <option value={3}>3 Taksit</option>
                        <option value={4}>4 Taksit</option>
                        <option value={5}>5 Taksit</option>
                        <option value={6}>6 Taksit</option>
                        <option value={9}>9 Taksit</option>
                        <option value={12}>12 Taksit</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1 text-[11px] text-purple-800">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Kredi kartı hareketlerine {giderForm.miktar ? formatCurrency(Number(giderForm.miktar)) : '0 ₺'} harcama yazılacak.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Harcamayı Yapan (Ödeyen)</label>
                  <input
                    type="text"
                    placeholder="Örn: Ali Şantiye Şefi"
                    value={giderForm.odeyen}
                    onChange={(e) => setGiderForm({ ...giderForm, odeyen: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Ödeme Yapılan Firma</span>
                    </label>
                    {combinedCariFirmalar.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setFirmaPickerTarget('gider');
                            setMusteriSearchQuery('');
                            setMusteriFilterTab('all');
                            setIsMusteriPickerOpen(true);
                          }}
                          className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          title="Firma Cari bölümündeki kayıtlardan ara ve seç"
                        >
                          <Search className="w-2.5 h-2.5 text-blue-600" />
                          <span>Cari Tablodan Seç ({combinedCariFirmalar.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextMode = !isCustomGiderFirma;
                            setIsCustomGiderFirma(nextMode);
                            if (nextMode) {
                              const alreadyInList = combinedCariFirmalar.some(
                                (f) => f.isim.trim().toLowerCase() === (giderForm.odemeYapilanFirma || '').trim().toLowerCase()
                              );
                              if (alreadyInList) {
                                setGiderForm({ ...giderForm, odemeYapilanFirma: '', cariFirmaId: undefined });
                              }
                            }
                          }}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          {isCustomGiderFirma ? '← Cari Listeden Seç' : '✍️ Manuel'}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCustomGiderFirma && combinedCariFirmalar.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={giderForm.odemeYapilanFirma || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomGiderFirma(true);
                            setGiderForm({ ...giderForm, odemeYapilanFirma: '', cariFirmaId: undefined });
                          } else {
                            const matched = combinedCariFirmalar.find((f) => f.isim === val);
                            setGiderForm({
                              ...giderForm,
                              odemeYapilanFirma: val,
                              cariFirmaId: matched ? matched.id : undefined,
                              taseron: matched?.isTaseron && !giderForm.taseron ? matched.isim : giderForm.taseron,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Firma Cari Kayıtlarından Seçiniz --</option>
                        {giderForm.odemeYapilanFirma &&
                          !combinedCariFirmalar.some(
                            (f) => f.isim.trim().toLowerCase() === (giderForm.odemeYapilanFirma || '').trim().toLowerCase()
                          ) && (
                            <optgroup label="Mevcut Gider Fişi Kaydı">
                              <option value={giderForm.odemeYapilanFirma}>
                                📌 {giderForm.odemeYapilanFirma} (Kayıtlı Metin)
                              </option>
                            </optgroup>
                          )}
                        {combinedCariFirmalar.filter((f) => f.tur === 'tedarikci').length > 0 && (
                          <optgroup label={`Tedarikçi & Cari Firmalar (${combinedCariFirmalar.filter((f) => f.tur === 'tedarikci').length})`}>
                            {combinedCariFirmalar
                              .filter((f) => f.tur === 'tedarikci')
                              .map((f) => (
                                <option key={`ted-${f.id}`} value={f.isim}>
                                  🏢 {f.isim} {f.ilgili ? `(${f.ilgili})` : ''}
                                </option>
                              ))}
                          </optgroup>
                        )}
                        {combinedCariFirmalar.filter((f) => f.isTaseron || f.tur === 'taseron').length > 0 && (
                          <optgroup label={`Taşeron Firmalar (${combinedCariFirmalar.filter((f) => f.isTaseron || f.tur === 'taseron').length})`}>
                            {combinedCariFirmalar
                              .filter((f) => f.isTaseron || f.tur === 'taseron')
                              .map((f) => (
                                <option key={`tas-${f.id}`} value={f.isim}>
                                  🏗️ {f.isim} {f.uzmanlik ? `(${f.uzmanlik})` : ''}
                                </option>
                              ))}
                          </optgroup>
                        )}
                        {combinedCariFirmalar.filter((f) => f.tur === 'musteri').length > 0 && (
                          <optgroup label={`Müşteri / İşveren Firmalar (${combinedCariFirmalar.filter((f) => f.tur === 'musteri').length})`}>
                            {combinedCariFirmalar
                              .filter((f) => f.tur === 'musteri')
                              .map((f) => (
                                <option key={`mus-${f.id}`} value={f.isim}>
                                  👤 {f.isim} {f.ilgili ? `(${f.ilgili})` : ''}
                                </option>
                              ))}
                          </optgroup>
                        )}
                        <option value="__custom__">✍️ + Listede Yok (Manuel Firma Adı Yaz)...</option>
                      </select>

                      {(() => {
                        const selectedCari = combinedCariFirmalar.find(
                          (f) => f.isim.trim().toLowerCase() === (giderForm.odemeYapilanFirma || '').trim().toLowerCase()
                        );
                        if (selectedCari) {
                          return (
                            <div className="text-[11px] bg-blue-50/80 text-blue-900 px-2.5 py-1.5 rounded-lg border border-blue-200/70 flex items-center justify-between gap-2">
                              <div className="truncate">
                                <span className="font-bold">{selectedCari.isim}</span>
                                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                                  {selectedCari.isTaseron ? 'Taşeron Cari' : selectedCari.tur === 'musteri' ? 'Müşteri Cari' : 'Tedarikçi Cari'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setGiderForm({ ...giderForm, odemeYapilanFirma: '', cariFirmaId: undefined })}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer shrink-0"
                                title="Seçimi Temizle"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }
                        if ((giderForm.odemeYapilanFirma || '').trim() && onAddFirma) {
                          const trimmed = (giderForm.odemeYapilanFirma || '').trim();
                          return (
                            <div className="text-[11px] bg-amber-50/80 text-amber-900 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2">
                              <span className="truncate">
                                <strong>{trimmed}</strong> (Cari kayıtlarda yok)
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newId = `f-ted-${Date.now()}`;
                                  onAddFirma({
                                    id: newId,
                                    isim: trimmed,
                                    tur: 'tedarikci',
                                    ilgili: '',
                                    telefon: '',
                                    vergiNo: '',
                                    vergiDairesi: '',
                                    adres: '',
                                    email: '',
                                  });
                                  setGiderForm({
                                    ...giderForm,
                                    odemeYapilanFirma: trimmed,
                                    cariFirmaId: newId,
                                  });
                                }}
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md cursor-pointer shrink-0 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tedarikçi Olarak Cariye Ekle</span>
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          list="gider-firma-cari-datalist"
                          placeholder="Örn: Opet Petrol (Firma adı yazın)"
                          value={giderForm.odemeYapilanFirma || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matched = combinedCariFirmalar.find(
                              (f) => f.isim.trim().toLowerCase() === val.trim().toLowerCase()
                            );
                            setGiderForm({
                              ...giderForm,
                              odemeYapilanFirma: val,
                              cariFirmaId: matched ? matched.id : undefined,
                            });
                          }}
                          autoFocus
                          className="flex-1 px-3 py-2 text-sm rounded-xl border border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                        {onAddFirma &&
                          (giderForm.odemeYapilanFirma || '').trim() &&
                          !combinedCariFirmalar.some(
                            (f) => f.isim.trim().toLowerCase() === (giderForm.odemeYapilanFirma || '').trim().toLowerCase()
                          ) && (
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = (giderForm.odemeYapilanFirma || '').trim();
                                if (!trimmed) return;
                                const newId = `f-ted-${Date.now()}`;
                                onAddFirma({
                                  id: newId,
                                  isim: trimmed,
                                  tur: 'tedarikci',
                                  ilgili: '',
                                  telefon: '',
                                  vergiNo: '',
                                  vergiDairesi: '',
                                  adres: '',
                                  email: '',
                                });
                                setGiderForm({
                                  ...giderForm,
                                  odemeYapilanFirma: trimmed,
                                  cariFirmaId: newId,
                                });
                                setAddManualFirmaToCari(false);
                                setIsCustomGiderFirma(false);
                              }}
                              className="px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                              title="Firma Cari Kayıtlarına Tedarikçi olarak hemen ekle ve seç"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tedarikçi Ekle</span>
                            </button>
                          )}
                      </div>
                      <datalist id="gider-firma-cari-datalist">
                        {combinedCariFirmalar.map((f) => (
                          <option key={f.id} value={f.isim}>
                            {f.isTaseron ? 'Taşeron' : f.tur === 'tedarikci' ? 'Tedarikçi' : 'Firma Cari'}
                          </option>
                        ))}
                      </datalist>
                      {(giderForm.odemeYapilanFirma || '').trim() ? (
                        combinedCariFirmalar.some(
                          (f) => f.isim.trim().toLowerCase() === (giderForm.odemeYapilanFirma || '').trim().toLowerCase()
                        ) ? (
                          <div className="text-[11px] bg-blue-50 text-blue-800 px-2.5 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Mevcut firma cari kaydı ile eşleşti (Cari hesaba işlenecek).</span>
                          </div>
                        ) : (
                          <label className="flex items-start gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={addManualFirmaToCari}
                              onChange={(e) => setAddManualFirmaToCari(e.target.checked)}
                              className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="text-[11px] leading-snug">
                              <span className="font-bold text-slate-800 block">
                                "{(giderForm.odemeYapilanFirma || '').trim()}" firmasını Firma Cari Kayıtlarına "Tedarikçi" olarak ekle
                              </span>
                              <span className="text-slate-500">
                                {addManualFirmaToCari
                                  ? 'İşaretli: Kaydedildiğinde Firma Cari Kayıtlarına tedarikçi olarak eklenecek ve ödeme cari hesabına işlenecektir.'
                                  : 'İşaretsiz: Firma Cari Kayıtlarına eklenmez, yalnızca bu gider fişinde firma adı olarak görünür.'}
                              </span>
                            </div>
                          </label>
                        )
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Firma adını yazdıktan sonra isterseniz <strong>Tedarikçi olarak cariye ekleyebilir</strong> veya cariye eklemeden sadece bu fiş için kaydedebilirsiniz.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gider Durumu</label>
                  <select
                    value={giderForm.durum || 'Ödendi'}
                    onChange={(e) => setGiderForm({ ...giderForm, durum: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="Ödendi">Ödendi</option>
                    <option value="Beklemede">Beklemede</option>
                    <option value="İptal">İptal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">İlgili Taşeron (Opsiyonel)</label>
                  <select
                    value={giderForm.taseron || ''}
                    onChange={(e) => setGiderForm({ ...giderForm, taseron: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Taşeron Yok / Genel Gider --</option>
                    {(() => {
                      const currentSite = santiyeler.find((s) => s.id === giderForm.santiyeId);
                      const siteSubs = currentSite ? getSiteSubcontractors(currentSite) : [];
                      return (
                        <>
                          {siteSubs.length > 0 && (
                            <optgroup label={`Şantiyeye Bağlı Taşeronlar (${siteSubs.length})`}>
                              {siteSubs.map((subName, i) => (
                                <option key={`site-sub-${i}`} value={subName}>
                                  ★ {subName} (Şantiyeye Bağlı)
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Tüm Kayıtlı Taşeronlar">
                            {taseronlar.map((t) => (
                              <option key={t.id} value={t.isim}>
                                {t.isim} {t.uzmanlik ? `(${t.uzmanlik})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </>
                      );
                    })()}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Açıklama / Fatura Detayı</label>
                <input
                  type="text"
                  placeholder="Örn: 20 Torba Çimento ve kum nakliyesi"
                  value={giderForm.aciklama}
                  onChange={(e) => setGiderForm({ ...giderForm, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsGiderModalOpen(false);
                    setEditingGider(null);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
                >
                  {editingGider ? 'Değişiklikleri Kaydet' : 'Gideri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* MODAL: TAŞERON LİSTESİNDEN ÇOKLU SEÇİM MODALI */}
      {isTaseronPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Şantiyeye Taşeron Ekle & Seç
                  </h3>
                  <p className="text-xs text-slate-500">
                    Listeden taşeronları seçerek şantiyeye dahil edin veya çıkarın
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTaseronPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Arama Inputu */}
            <div className="mt-4 mb-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Taşeron adı, uzmanlık alanı, yetkili veya telefon ara..."
                  value={taseronSearchQuery}
                  onChange={(e) => setTaseronSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Taşeronlar Listesi */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px]">
              {filteredTaseronlar.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Aranan kriterde taşeron bulunamadı.
                </div>
              ) : (
                filteredTaseronlar.map((t) => {
                  const isAttached = (siteForm.taseronlar || []).some(
                    (s) => s.toLowerCase() === t.isim.toLowerCase()
                  );
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isAttached
                          ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{t.isim}</span>
                          {t.uzmanlik && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              {t.uzmanlik}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                          {t.yetkili && <span>Yetkili: <strong className="text-slate-700">{t.yetkili}</strong></span>}
                          {t.telefon && <span>Tel: <strong className="text-slate-700">{t.telefon}</strong></span>}
                          {t.bakiye !== undefined && (
                            <span>Bakiye: <strong className={t.bakiye > 0 ? 'text-rose-600' : 'text-slate-700'}>{formatCurrency(t.bakiye)}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAttached ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubcontractorFromSite(t.isim)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Eklendi (Kaldır)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddSubcontractorToSite(t.isim)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Şantiyeye Ekle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Alt Bar */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-600">
                Şantiyeye Seçili: <strong className="text-indigo-700 font-bold">{(siteForm.taseronlar || []).length} Taşeron</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsTaseronPickerOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MÜŞTERİ / FİRMA CARİ SEÇİM MODALI */}
      {isMusteriPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {firmaPickerTarget === 'gider'
                      ? 'Firma Cari Kayıtlarından Ödeme Yapılan Firmayı Seçin'
                      : 'Müşteri / İşveren Firma Seçimi'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {firmaPickerTarget === 'gider'
                      ? 'Firma Cari bölümündeki tedarikçi, taşeron ve diğer firmalar arasından doğrudan seçin'
                      : 'Şantiyenin yetkili müşterisini tablodan doğrudan seçin'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMusteriPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Arama & Sekmeler */}
            <div className="mt-4 mb-3 space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Firma adı, yetkili, uzmanlık, vergi no veya telefon ara..."
                    value={musteriSearchQuery}
                    onChange={(e) => setMusteriSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMusteriFilterTab('all')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      musteriFilterTab === 'all' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tümü ({combinedCariFirmalar.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMusteriFilterTab('tedarikci')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      musteriFilterTab === 'tedarikci' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tedarikçiler
                  </button>
                  <button
                    type="button"
                    onClick={() => setMusteriFilterTab('taseron')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      musteriFilterTab === 'taseron' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Taşeronlar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMusteriFilterTab('musteri')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      musteriFilterTab === 'musteri' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Müşteriler
                  </button>
                </div>
              </div>
            </div>

            {/* Firmalar Listesi */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px]">
              {filteredMusteriler.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="text-slate-400 text-sm">
                    Aranan kriterde firma cari kaydı bulunamadı.
                  </div>
                  {onAddFirma && musteriSearchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = musteriSearchQuery.trim();
                        const newId = `f-ted-${Date.now()}`;
                        onAddFirma({
                          id: newId,
                          isim: trimmed,
                          tur: firmaPickerTarget === 'gider' ? 'tedarikci' : 'musteri',
                          ilgili: '',
                          telefon: '',
                          vergiNo: '',
                          vergiDairesi: '',
                          adres: '',
                          email: '',
                        });
                        if (firmaPickerTarget === 'gider') {
                          setGiderForm({
                            ...giderForm,
                            odemeYapilanFirma: trimmed,
                            cariFirmaId: newId,
                          });
                          setIsCustomGiderFirma(false);
                        } else {
                          setSiteForm({ ...siteForm, yetkiliFirma: trimmed });
                          setIsCustomFirma(false);
                        }
                        setIsMusteriPickerOpen(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        "{musteriSearchQuery.trim()}" Firmasını Yeni {firmaPickerTarget === 'gider' ? 'Tedarikçi' : 'Müşteri'} Olarak Cariye Ekle ve Seç
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                filteredMusteriler.map((f) => {
                  const isSelected =
                    firmaPickerTarget === 'gider'
                      ? (giderForm.odemeYapilanFirma || '').trim().toLowerCase() === f.isim.trim().toLowerCase()
                      : siteForm.yetkiliFirma === f.isim;
                  return (
                    <div
                      key={f.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{f.isim}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              f.isTaseron
                                ? 'bg-indigo-100 text-indigo-800'
                                : f.tur === 'musteri'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {f.isTaseron ? 'Taşeron' : f.tur === 'musteri' ? 'Müşteri' : 'Tedarikçi / Cari'}
                          </span>
                          {f.uzmanlik && (
                            <span className="text-[10px] text-slate-500 font-medium">({f.uzmanlik})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                          {f.ilgili && <span>Yetkili: <strong className="text-slate-700">{f.ilgili}</strong></span>}
                          {f.telefon && <span>Tel: <strong className="text-slate-700">{f.telefon}</strong></span>}
                          {f.vergiNo && <span className="font-mono text-[11px]">VN: {f.vergiNo}</span>}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (firmaPickerTarget === 'gider') {
                              setGiderForm({
                                ...giderForm,
                                odemeYapilanFirma: f.isim,
                                cariFirmaId: f.id,
                                taseron: f.isTaseron && !giderForm.taseron ? f.isim : giderForm.taseron,
                              });
                              setIsCustomGiderFirma(false);
                            } else {
                              setSiteForm({ ...siteForm, yetkiliFirma: f.isim });
                              setIsCustomFirma(false);
                            }
                            setIsMusteriPickerOpen(false);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Seçili</span>
                            </>
                          ) : (
                            <span>Seç</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Alt Bar */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsMusteriPickerOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KATEGORİ YÖNETİMİ & YENİ KATEGORİ EKLE */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Şantiye Gider Kategorileri
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gider fişlerinde kullanılan kategorileri yönetin ve yeni kategori ekleyin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Yeni Kategori Ekle Formu */}
            <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
              <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide mb-1.5">
                + Yeni Kategori Ekle
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Örn: İskele & Kalıp Kirası, Ruhsat & Harçlar..."
                  value={newCategoryInput}
                  onChange={(e) => {
                    setNewCategoryInput(e.target.value);
                    if (categoryError) setCategoryError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = newCategoryInput.trim();
                      if (!trimmed) {
                        setCategoryError('Kategori adı boş olamaz.');
                        return;
                      }
                      if (activeCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
                        setCategoryError('Bu isimde bir kategori zaten mevcut.');
                        return;
                      }
                      onAddKategori?.(trimmed);
                      setGiderForm((prev) => ({ ...prev, kategori: trimmed }));
                      setNewCategoryInput('');
                      setCategoryError('');
                    }
                  }}
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newCategoryInput.trim();
                    if (!trimmed) {
                      setCategoryError('Kategori adı boş olamaz.');
                      return;
                    }
                    if (activeCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
                      setCategoryError('Bu isimde bir kategori zaten mevcut.');
                      return;
                    }
                    onAddKategori?.(trimmed);
                    setGiderForm((prev) => ({ ...prev, kategori: trimmed }));
                    setNewCategoryInput('');
                    setCategoryError('');
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ekle</span>
                </button>
              </div>
              {categoryError && (
                <p className="text-xs text-rose-600 font-semibold mt-1.5">
                  {categoryError}
                </p>
              )}
            </div>

            {/* Mevcut Kategoriler Listesi */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Mevcut Kategoriler ({activeCategories.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Gider fişlerinde kayıtlı kategoriler silinemez
                </span>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {activeCategories.map((cat) => {
                  const expenseCount = giderler.filter((g) => g.kategori === cat).length;
                  const isDeletable = expenseCount === 0;

                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {cat}
                        </span>
                        {cat === giderForm.kategori && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                            Seçili
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          expenseCount > 0
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {expenseCount} Gider Fişi
                        </span>

                        {isDeletable && onDeleteKategori ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirm({
                                isOpen: true,
                                title: 'Kategoriyi Sil',
                                description: `"${cat}" gider kategorisini silmek istediğinize emin misiniz?`,
                                onConfirm: () => onDeleteKategori(cat),
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Kategoriyi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Global Deletion Confirmation Modal */}
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
