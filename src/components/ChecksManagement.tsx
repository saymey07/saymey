import React, { useState, useMemo } from 'react';
import { 
  BookOpenCheck, 
  Calendar, 
  Building2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Search,
  X,
  Layers,
  Info,
  CheckCircle,
  AlertCircle,
  Share2,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { Cek, Santiye, Firma, FirmaCari } from '../types';
import { formatCurrency, getCurrencySymbol, getTodayDateString } from '../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates, getCurrencyExchangeRate } from '../utils/currencyStore';
import { CurrencySelector } from './CurrencySelector';
import { ExportButton } from './ExportButton';
import { ExportOptions } from '../utils/exportUtils';

interface ChecksManagementProps {
  cekler: Cek[];
  santiyeler: Santiye[];
  firmalar: Firma[];
  cariList: FirmaCari[];
  onAddCek: (cek: Cek, cariHareket?: FirmaCari, ciroCariHareket?: FirmaCari) => void;
  onUpdateCek?: (cek: Cek, cariHareket?: FirmaCari, ciroCariHareket?: FirmaCari) => void;
  onUpdateStatus: (id: string, status: Cek['durum']) => void;
  onCiroCek?: (cekId: string, ciroFirmaId: string, ciroTarihi: string, cariHesabaIsle: boolean, ciroAciklama?: string, santiyeId?: string, santiyeProje?: string) => void;
  onCancelCiroCek?: (cekId: string) => void;
  onDeleteCek: (id: string) => void;
  onOpenCurrencies?: () => void;
}

const POPULAR_BANKS = [
  'Garanti BBVA',
  'Türkiye İş Bankası',
  'Yapı Kredi Bankası',
  'Akbank',
  'Ziraat Bankası',
  'Vakıfbank',
  'Halkbank',
  'QNB Finansbank',
  'Denizbank',
  'Kuveyt Türk',
  'TEB'
];

export const ChecksManagement: React.FC<ChecksManagementProps> = ({
  cekler,
  santiyeler,
  firmalar,
  cariList,
  onAddCek,
  onUpdateCek,
  onUpdateStatus,
  onCiroCek,
  onCancelCiroCek,
  onDeleteCek,
  onOpenCurrencies,
}) => {
  const exchangeRates = getSavedExchangeRates();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTur, setSelectedTur] = useState<'all' | 'alinan_cek' | 'verilen_cek'>('all');
  const [selectedFirmaFilter, setSelectedFirmaFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCek, setEditingCek] = useState<Cek | null>(null);
  const [deletingCek, setDeletingCek] = useState<Cek | null>(null);

  // Ciro Modal State
  const [ciroModalCek, setCiroModalCek] = useState<Cek | null>(null);
  const [ciroForm, setCiroForm] = useState<{
    firmaId: string;
    tarih: string;
    cariHesabaIsle: boolean;
    aciklama: string;
    santiyeProje: string;
  }>({
    firmaId: '',
    tarih: getTodayDateString(),
    cariHesabaIsle: true,
    aciklama: '',
    santiyeProje: '',
  });

  // Form State
  const initialFormState: Partial<Cek> = {
    cekNo: '',
    miktar: 0,
    paraBirimi: 'TRY',
    alinanTarih: getTodayDateString(),
    vadeTarihi: '',
    bankaAdi: 'Garanti BBVA',
    hamil: 'Şirket Portföyü',
    hesapSahibi: '',
    santiyeProje: santiyeler[0]?.isim || '',
    durum: 'Portföyde',
    aciklama: '',
    cekTuru: 'verilen_cek', // Default to given check to make firm ledger payment easy
    firmaId: firmalar[0]?.id || '',
    cariHesabaIsle: true,
    ciroFirmaId: '',
    ciroEdilenFirma: '',
    ciroTarihi: getTodayDateString(),
    ciroCariHesabaIsle: true,
    ciroAciklama: '',
  };

  const [form, setForm] = useState<Partial<Cek>>(initialFormState);

  // Helper to open Add Modal
  const handleOpenAddModal = (defaultType: 'alinan_cek' | 'verilen_cek' = 'verilen_cek') => {
    setEditingCek(null);
    const defaultFirma = firmalar[0];
    setForm({
      cekNo: `CK-${Math.floor(100000 + Math.random() * 900000)}`,
      miktar: 0,
      paraBirimi: 'TRY',
      alinanTarih: getTodayDateString(),
      vadeTarihi: '',
      bankaAdi: 'Garanti BBVA',
      hamil: defaultType === 'verilen_cek' ? (defaultFirma?.isim || 'Tedarikçi Firma') : 'Şirket Portföyü',
      hesapSahibi: defaultType === 'alinan_cek' ? (defaultFirma?.isim || 'Keşideci') : 'Şirketimiz (Kendi Hesabımız)',
      santiyeProje: santiyeler[0]?.isim || '',
      durum: defaultType === 'verilen_cek' ? 'Portföyde' : 'Portföyde',
      aciklama: '',
      cekTuru: defaultType,
      firmaId: defaultFirma?.id || '',
      cariHesabaIsle: true,
      ciroFirmaId: '',
      ciroEdilenFirma: '',
      ciroTarihi: getTodayDateString(),
      ciroCariHesabaIsle: true,
      ciroAciklama: '',
    });
    setIsModalOpen(true);
  };

  // Helper to open Edit Modal
  const handleOpenEditModal = (cek: Cek) => {
    setEditingCek(cek);
    setForm({
      ...cek,
      paraBirimi: cek.paraBirimi || 'TRY',
      cekTuru: cek.cekTuru || (cek.durum === 'Ciro Edildi' ? 'verilen_cek' : 'alinan_cek'),
      cariHesabaIsle: cek.cariHesabaIsle ?? !!cek.cariHareketId,
      ciroFirmaId: cek.ciroFirmaId || '',
      ciroEdilenFirma: cek.ciroEdilenFirma || '',
      ciroTarihi: cek.ciroTarihi || getTodayDateString(),
      ciroCariHesabaIsle: cek.ciroCariHesabaIsle ?? true,
      ciroAciklama: cek.ciroAciklama || '',
    });
    setIsModalOpen(true);
  };

  // Helper to open Ciro Modal
  const handleOpenCiroModal = (cek: Cek) => {
    const existingCiroFirma = firmalar.find(
      (f) => f.id === cek.ciroFirmaId || f.isim === cek.ciroEdilenFirma || f.isim === cek.hamil
    );
    const defaultFirma =
      existingCiroFirma || firmalar.find((f) => f.tur === 'tedarikci' || f.tur === 'taseron') || firmalar[0];

    setCiroModalCek(cek);
    setCiroForm({
      firmaId: defaultFirma?.id || '',
      tarih: cek.ciroTarihi || getTodayDateString(),
      cariHesabaIsle: cek.ciroCariHesabaIsle ?? true,
      aciklama: cek.ciroAciklama || `${cek.cekNo} nolu ${cek.bankaAdi} çeki ciro edildi.`,
      santiyeProje: cek.ciroSantiyeProje || cek.santiyeProje || '',
    });
  };

  // Helper to confirm Ciro
  const handleConfirmCiro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ciroModalCek || !ciroForm.firmaId) return;

    const matchedSite = santiyeler.find(
      (s) => s.isim.trim().toLowerCase() === (ciroForm.santiyeProje || '').trim().toLowerCase() || s.id === ciroForm.santiyeProje
    );

    if (onCiroCek) {
      onCiroCek(
        ciroModalCek.id,
        ciroForm.firmaId,
        ciroForm.tarih || getTodayDateString(),
        ciroForm.cariHesabaIsle,
        ciroForm.aciklama,
        matchedSite?.id,
        matchedSite?.isim || ciroForm.santiyeProje || ''
      );
    } else {
      // Fallback
      const targetFirma = firmalar.find((f) => f.id === ciroForm.firmaId);
      const updatedCek: Cek = {
        ...ciroModalCek,
        durum: 'Ciro Edildi',
        ciroFirmaId: ciroForm.firmaId,
        ciroEdilenFirma: targetFirma?.isim,
        ciroTarihi: ciroForm.tarih,
        ciroCariHesabaIsle: ciroForm.cariHesabaIsle,
        ciroAciklama: ciroForm.aciklama,
        ciroSantiyeId: matchedSite?.id,
        ciroSantiyeProje: matchedSite?.isim || ciroForm.santiyeProje || undefined,
        santiyeId: matchedSite?.id || ciroModalCek.santiyeId,
        santiyeProje: matchedSite?.isim || ciroForm.santiyeProje || ciroModalCek.santiyeProje,
        hamil: targetFirma ? targetFirma.isim : ciroModalCek.hamil,
      };
      if (onUpdateCek) {
        onUpdateCek(updatedCek);
      } else {
        onUpdateStatus(ciroModalCek.id, 'Ciro Edildi');
      }
    }
    setCiroModalCek(null);
  };

  // Helper to cancel Ciro
  const handleCancelCiro = (cek: Cek) => {
    if (onCancelCiroCek) {
      onCancelCiroCek(cek.id);
    } else {
      onUpdateStatus(cek.id, 'Portföyde');
    }
    setCiroModalCek(null);
  };

  // Calculate Company Balance Helper
  const getFirmaBalance = (firmaId: string) => {
    const movements = cariList.filter((c) => c.firmaId === firmaId);
    const totalBorc = movements.reduce((s, m) => s + (m.borc || 0), 0);
    const totalAlacak = movements.reduce((s, m) => s + (m.alacak || 0), 0);
    return {
      borc: totalBorc,
      alacak: totalAlacak,
      netBakiye: totalBorc - totalAlacak, // > 0: Firmaya borçluyuz, < 0: Firmadan alacaklıyız
    };
  };

  // When form firmaId changes, update hamil / hesapSahibi if applicable
  const handleFirmaChange = (firmaId: string) => {
    const selectedFirma = firmalar.find((f) => f.id === firmaId);
    if (!selectedFirma) {
      setForm((prev) => ({ ...prev, firmaId: '', cariHesabaIsle: false }));
      return;
    }

    setForm((prev) => {
      const isVerilen = prev.cekTuru === 'verilen_cek';
      return {
        ...prev,
        firmaId: selectedFirma.id,
        cariHesabaIsle: true,
        hamil: isVerilen ? selectedFirma.isim : prev.hamil,
        hesapSahibi: !isVerilen ? selectedFirma.isim : (prev.hesapSahibi || 'Şirketimiz (Kendi Hesabımız)'),
      };
    });
  };

  // When check type toggles
  const handleCheckTypeToggle = (type: 'alinan_cek' | 'verilen_cek') => {
    const selectedFirma = firmalar.find((f) => f.id === form.firmaId);
    setForm((prev) => {
      const isVerilen = type === 'verilen_cek';
      return {
        ...prev,
        cekTuru: type,
        hamil: isVerilen ? (selectedFirma?.isim || 'Tedarikçi Firma') : 'Şirket Portföyü',
        hesapSahibi: !isVerilen ? (selectedFirma?.isim || 'Keşideci Firma') : 'Şirketimiz (Kendi Hesabımız)',
        durum: prev.durum || 'Portföyde',
      };
    });
  };

  // Filter Logic
  const filteredCekler = useMemo(() => {
    return cekler.filter((c) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const f = firmalar.find((firm) => firm.id === c.firmaId);
        const ciroF = firmalar.find((firm) => firm.id === c.ciroFirmaId);
        const matchesNo = c.cekNo.toLowerCase().includes(q);
        const matchesBank = c.bankaAdi.toLowerCase().includes(q);
        const matchesOwner = c.hesapSahibi.toLowerCase().includes(q);
        const matchesHamil = c.hamil.toLowerCase().includes(q);
        const matchesDesc = c.aciklama?.toLowerCase().includes(q);
        const matchesFirma = f?.isim.toLowerCase().includes(q);
        const matchesCiroFirma = c.ciroEdilenFirma?.toLowerCase().includes(q) || ciroF?.isim.toLowerCase().includes(q);
        if (!matchesNo && !matchesBank && !matchesOwner && !matchesHamil && !matchesDesc && !matchesFirma && !matchesCiroFirma) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'all' && c.durum !== selectedStatus) {
        return false;
      }

      // Type filter
      if (selectedTur !== 'all') {
        const isVerilen = c.cekTuru === 'verilen_cek';
        if (selectedTur === 'verilen_cek' && !isVerilen) return false;
        if (selectedTur === 'alinan_cek' && isVerilen) return false;
      }

      // Firma filter
      if (selectedFirmaFilter !== 'all') {
        if (selectedFirmaFilter === 'unassigned' && (c.firmaId || c.ciroFirmaId)) return false;
        if (selectedFirmaFilter !== 'unassigned' && c.firmaId !== selectedFirmaFilter && c.ciroFirmaId !== selectedFirmaFilter) return false;
      }

      return true;
    });
  }, [cekler, searchQuery, selectedStatus, selectedTur, selectedFirmaFilter, firmalar]);

  // Statistics
  const totalAlinanPortfolio = useMemo(() => {
    return cekler
      .filter((c) => (c.cekTuru === 'alinan_cek' || !c.cekTuru) && (c.durum === 'Portföyde' || c.durum === 'Tahsilde'))
      .reduce((sum, c) => sum + convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates), 0);
  }, [cekler, exchangeRates]);

  const totalVerilenBekleyen = useMemo(() => {
    return cekler
      .filter((c) => c.cekTuru === 'verilen_cek' && c.durum !== 'Tahsil Edildi' && c.durum !== 'Ödendi')
      .reduce((sum, c) => sum + convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates), 0);
  }, [cekler, exchangeRates]);

  const totalCollected = useMemo(() => {
    return cekler
      .filter((c) => c.durum === 'Tahsil Edildi' || c.durum === 'Ödendi')
      .reduce((sum, c) => sum + convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates), 0);
  }, [cekler, exchangeRates]);

  const totalEndorsed = useMemo(() => {
    return cekler
      .filter((c) => c.durum === 'Ciro Edildi')
      .reduce((sum, c) => sum + convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates), 0);
  }, [cekler, exchangeRates]);

  const totalCariIslenen = useMemo(() => {
    return cekler
      .filter((c) => c.cariHesabaIsle || c.cariHareketId || c.ciroCariHareketId)
      .reduce((sum, c) => sum + convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates), 0);
  }, [cekler, exchangeRates]);

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cekNo?.trim() || !form.miktar || form.miktar <= 0) return;

    const checkId = editingCek ? editingCek.id : `cek-${Date.now()}`;
    const cekTuru = form.cekTuru || 'verilen_cek';
    const isVerilen = cekTuru === 'verilen_cek';
    const miktar = Number(form.miktar);
    const selectedFirma = firmalar.find((f) => f.id === form.firmaId);
    const matchedSite = santiyeler.find(
      (s) => s.isim.trim().toLowerCase() === (form.santiyeProje || '').trim().toLowerCase() || s.id === form.santiyeProje
    );
    const resolvedSantiyeId = matchedSite?.id || undefined;
    const resolvedSantiyeAdi = matchedSite?.isim || form.santiyeProje || undefined;

    // 1. Birincil Cari Hareket (Çekin ilk ait olduğu firma)
    let cariHareket: FirmaCari | undefined;
    let cariHareketId = editingCek?.cariHareketId;

    if (form.cariHesabaIsle && selectedFirma) {
      if (!cariHareketId) {
        cariHareketId = `fc-cek-${Date.now()}`;
      }

      if (isVerilen) {
        // Firmaya kesilen çek: Biz firmaya ödeme yapıyoruz -> Firmanın cari hesabına 'odeme' olarak eklenir, borcumuzdan düşer.
        const curr = form.paraBirimi || 'TRY';
        const rate = getCurrencyExchangeRate(curr, exchangeRates.rates);
        cariHareket = {
          id: cariHareketId,
          firmaId: selectedFirma.id,
          borc: 0,
          alacak: miktar,
          paraBirimi: curr,
          dovizKuru: rate,
          tlKarsiligi: convertCurrencyToTRY(miktar, curr, exchangeRates.rates),
          hedefParaBirimi: curr,
          hedefKur: 1,
          hedefDusulenTutar: miktar,
          islemTuru: 'odeme',
          tarih: form.alinanTarih || getTodayDateString(),
          saat: '12:00',
          faturaNo: `ÇEK-${form.cekNo.trim()}`,
          aciklama: `Verilen Çek Ödemesi (${form.bankaAdi} - Vade: ${form.vadeTarihi || 'Belirtilmedi'})${resolvedSantiyeAdi ? ` [${resolvedSantiyeAdi}]` : ''}${form.aciklama ? ' - ' + form.aciklama.trim() : ''}`,
          cekId: checkId,
          santiyeId: resolvedSantiyeId,
          santiyeAdi: resolvedSantiyeAdi,
        };
      } else {
        // Alınan çek: Müşteriden veya firmadan tahsilat alındı -> 'tahsilat'
        const curr = form.paraBirimi || 'TRY';
        const rate = getCurrencyExchangeRate(curr, exchangeRates.rates);
        cariHareket = {
          id: cariHareketId,
          firmaId: selectedFirma.id,
          borc: miktar,
          alacak: 0,
          paraBirimi: curr,
          dovizKuru: rate,
          tlKarsiligi: convertCurrencyToTRY(miktar, curr, exchangeRates.rates),
          hedefParaBirimi: curr,
          hedefKur: 1,
          hedefDusulenTutar: miktar,
          islemTuru: 'tahsilat',
          tarih: form.alinanTarih || getTodayDateString(),
          saat: '12:00',
          faturaNo: `ÇEK-${form.cekNo.trim()}`,
          aciklama: `Alınan Çek Tahsilatı (${form.bankaAdi} - Vade: ${form.vadeTarihi || 'Belirtilmedi'})${resolvedSantiyeAdi ? ` [${resolvedSantiyeAdi}]` : ''}${form.aciklama ? ' - ' + form.aciklama.trim() : ''}`,
          cekId: checkId,
          santiyeId: resolvedSantiyeId,
          santiyeAdi: resolvedSantiyeAdi,
        };
      }
    }

    // 2. Ciro Cari Hareketi (Çek başka bir firmaya ciro edildiyse)
    let ciroCariHareket: FirmaCari | undefined;
    let ciroCariId = editingCek?.ciroCariHareketId;
    const selectedCiroFirma = firmalar.find((f) => f.id === form.ciroFirmaId);

    if (form.durum === 'Ciro Edildi' && (form.ciroCariHesabaIsle ?? true) && selectedCiroFirma) {
      if (!ciroCariId) {
        ciroCariId = `fc-ciro-${Date.now()}`;
      }
      const curr = form.paraBirimi || 'TRY';
      const rate = getCurrencyExchangeRate(curr, exchangeRates.rates);
      ciroCariHareket = {
        id: ciroCariId,
        firmaId: selectedCiroFirma.id,
        borc: 0,
        alacak: miktar,
        paraBirimi: curr,
        dovizKuru: rate,
        tlKarsiligi: convertCurrencyToTRY(miktar, curr, exchangeRates.rates),
        hedefParaBirimi: curr,
        hedefKur: 1,
        hedefDusulenTutar: miktar,
        islemTuru: 'odeme',
        tarih: form.ciroTarihi || getTodayDateString(),
        saat: '12:00',
        faturaNo: `CİRO-${form.cekNo.trim()}`,
        aciklama: `Ciro Edilen Çek Ödemesi (${form.bankaAdi} - Vade: ${form.vadeTarihi || 'Belirtilmedi'})${resolvedSantiyeAdi ? ` [${resolvedSantiyeAdi}]` : ''}${form.ciroAciklama ? ' - ' + form.ciroAciklama.trim() : ''}`,
        cekId: checkId,
        santiyeId: resolvedSantiyeId,
        santiyeAdi: resolvedSantiyeAdi,
      };
    }

    const finalCek: Cek = {
      id: checkId,
      cekNo: form.cekNo.trim(),
      miktar,
      paraBirimi: form.paraBirimi || 'TRY',
      alinanTarih: form.alinanTarih || getTodayDateString(),
      vadeTarihi: form.vadeTarihi || getTodayDateString(),
      bankaAdi: form.bankaAdi || 'Banka',
      hamil: form.durum === 'Ciro Edildi' && selectedCiroFirma ? selectedCiroFirma.isim : (form.hamil || (isVerilen ? selectedFirma?.isim || 'Tedarikçi' : 'Şirket Portföyü')),
      hesapSahibi: form.hesapSahibi || (isVerilen ? 'Şirketimiz' : selectedFirma?.isim || 'Keşideci'),
      santiyeId: resolvedSantiyeId,
      santiyeProje: resolvedSantiyeAdi || '',
      durum: form.durum || 'Portföyde',
      aciklama: form.aciklama || '',
      cekTuru,
      firmaId: form.cariHesabaIsle && selectedFirma ? selectedFirma.id : undefined,
      cariHesabaIsle: !!(form.cariHesabaIsle && selectedFirma),
      cariHareketId: form.cariHesabaIsle && selectedFirma ? cariHareketId : undefined,
      ciroFirmaId: form.durum === 'Ciro Edildi' && selectedCiroFirma ? selectedCiroFirma.id : undefined,
      ciroEdilenFirma: form.durum === 'Ciro Edildi' && selectedCiroFirma ? selectedCiroFirma.isim : undefined,
      ciroTarihi: form.durum === 'Ciro Edildi' ? (form.ciroTarihi || getTodayDateString()) : undefined,
      ciroCariHesabaIsle: form.durum === 'Ciro Edildi' && selectedCiroFirma ? !!form.ciroCariHesabaIsle : false,
      ciroCariHareketId: form.durum === 'Ciro Edildi' && selectedCiroFirma && form.ciroCariHesabaIsle ? ciroCariId : undefined,
      ciroAciklama: form.durum === 'Ciro Edildi' ? form.ciroAciklama : undefined,
      ciroSantiyeId: form.durum === 'Ciro Edildi' ? resolvedSantiyeId : undefined,
      ciroSantiyeProje: form.durum === 'Ciro Edildi' ? resolvedSantiyeAdi : undefined,
    };

    if (editingCek) {
      if (onUpdateCek) {
        onUpdateCek(finalCek, cariHareket, ciroCariHareket);
      } else {
        onAddCek(finalCek, cariHareket, ciroCariHareket);
      }
    } else {
      onAddCek(finalCek, cariHareket, ciroCariHareket);
    }

    setIsModalOpen(false);
    setEditingCek(null);
  };

  const getStatusBadge = (status: Cek['durum']) => {
    switch (status) {
      case 'Portföyde':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Tahsilde':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Tahsil Edildi':
      case 'Ödendi':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      case 'Ciro Edildi':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Karşılıksız':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Active selected firm in form
  const activeSelectedFirma = firmalar.find((f) => f.id === form.firmaId);
  const activeFirmaBalance = activeSelectedFirma ? getFirmaBalance(activeSelectedFirma.id) : null;

  const getChecksExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Çek No', dataKey: 'cekNo', width: 22 },
      { header: 'İşlem Türü', dataKey: 'tur', width: 20 },
      { header: 'İlişkili Firma', dataKey: 'firmaAdi', width: 32 },
      { header: 'Vade Tarihi', dataKey: 'vadeTarihi', width: 20 },
      { header: 'Tutar (TRY)', dataKey: 'tutarTRY', width: 22, align: 'right' as const },
      { header: 'Banka', dataKey: 'banka', width: 25 },
      { header: 'Keşideci', dataKey: 'kesideci', width: 25 },
      { header: 'Durum', dataKey: 'durum', width: 20, align: 'center' as const },
      { header: 'Açıklama', dataKey: 'aciklama', width: 35 },
    ];

    let totalTRY = 0;
    const data = filteredCekler.map((c) => {
      const firm = firmalar.find((f) => f.id === c.firmaId);
      const valTRY = convertCurrencyToTRY(c.tutar, c.paraBirimi || 'TRY', exchangeRates.rates);
      totalTRY += valTRY;

      return {
        cekNo: c.cekNo || '-',
        tur: c.tur === 'alinan' ? 'Alınan Çek' : 'Verilen Çek',
        firmaAdi: firm ? firm.isim : c.kesideci || '-',
        vadeTarihi: c.vadeTarihi,
        tutarTRY: formatCurrency(valTRY),
        banka: c.bankaAdi || '-',
        kesideci: c.kesideci || '-',
        durum: c.durum === 'beklemede' ? 'Bekliyor' : c.durum === 'odendi' ? 'Tahsil/Ödendi' : c.durum === 'ciro_edildi' ? 'Ciro Edildi' : c.durum,
        aciklama: c.aciklama || '-',
      };
    });

    return {
      title: 'Çek Portföyü Listesi (Tablo 12)',
      subtitle: `Toplam Çek: ${filteredCekler.length} adet`,
      filename: `Cek_Portfoyu_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Çek Adedi', value: `${filteredCekler.length} adet` },
        { label: 'Toplam Portföy Tutarı (TRY)', value: formatCurrency(totalTRY) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Stat Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kasadaki Alınan Çekler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Kasada Alınan Çekler</span>
            </span>
            <div className="text-xl font-bold text-blue-600 mt-1 font-mono">
              {formatCurrency(totalAlinanPortfolio)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Müşteri / Hakediş portföyü</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <BookOpenCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Firmalara Kesilen / Verilen Çekler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
              <span>Firmalara Kesilen Çekler</span>
            </span>
            <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
              {formatCurrency(totalVerilenBekleyen)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Tedarikçi ödeme vadeli çekleri</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Tahsil Edilen / Ödenen */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tahsil / Hesaptan Ödenen</span>
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
              {formatCurrency(totalCollected)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">İşlemi tamamlanmış çekler</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Cari Hesaba İşlenen Çek Toplamı */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-700 uppercase flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Cari Hesaba İşlenen Çekler</span>
            </span>
            <div className="text-xl font-bold text-purple-700 mt-1 font-mono">
              {formatCurrency(totalCariIslenen)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Firma carisinden düşülen / eklenen</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Çek no, firma, banka, keşideci..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Çek Yönü / Türü Filtresi */}
            <div className="w-full sm:w-48">
              <select
                value={selectedTur}
                onChange={(e) => setSelectedTur(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="all">Tüm Çekler (Alınan & Verilen)</option>
                <option value="verilen_cek">📤 Firmalara Verilen / Kesilen Çekler</option>
                <option value="alinan_cek">📥 Alınan Çekler (Portföy)</option>
              </select>
            </div>

            {/* Çek Durumu Filtresi */}
            <div className="w-full sm:w-40">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="all">Tüm Durumlar ({cekler.length})</option>
                <option value="Portföyde">Portföyde</option>
                <option value="Tahsilde">Tahsilde</option>
                <option value="Tahsil Edildi">Tahsil Edildi</option>
                <option value="Ödendi">Ödendi</option>
                <option value="Ciro Edildi">Ciro Edildi</option>
                <option value="Karşılıksız">Karşılıksız</option>
              </select>
            </div>

            {/* Firma Filtresi */}
            <div className="w-full sm:w-48">
              <select
                value={selectedFirmaFilter}
                onChange={(e) => setSelectedFirmaFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="all">Tüm Firmalar / Cariler</option>
                <option value="unassigned">Firma Bağımsız Çekler</option>
                {firmalar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.isim}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenAddModal('verilen_cek')}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Tedarikçi firmaya borcumuzu kapatmak için çek keşide et"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Firmaya Çek Kes (Ödeme)</span>
            </button>

            <button
              onClick={() => handleOpenAddModal('alinan_cek')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Müşteriden veya firmadan gelen çeki portföye kaydet"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Alınan Çek Girişi</span>
            </button>
          </div>
        </div>

        {/* Active Filter Bar Info */}
        {(selectedTur !== 'all' || selectedStatus !== 'all' || selectedFirmaFilter !== 'all' || searchQuery) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filtrelenen: <strong>{filteredCekler.length}</strong> çek kaydı listeleniyor.</span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedTur('all');
                setSelectedFirmaFilter('all');
              }}
              className="text-indigo-600 hover:underline cursor-pointer font-medium"
            >
              Filtreleri Temizle
            </button>
          </div>
        )}
      </div>

      {/* Table (Tablo 12) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Veritabanı Tablosu 12: Alınan ve Firmalara Verilen Çekler Portföyü</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-200 text-slate-700">
                {filteredCekler.length} Adet
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tedarikçi cari hesaplarından düşülen verilen çekler ve müşteri hakedişlerinden alınan çekler portföyü
            </p>
          </div>
          <ExportButton
            options={getChecksExportOptions}
            buttonText="Çekleri Dışa Aktar"
            variant="secondary"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="px-4 py-3">Çek No</th>
                <th className="px-4 py-3">İşlem Türü</th>
                <th className="px-4 py-3">İlişkili Firma / Cari</th>
                <th className="px-4 py-3">Vade Tarihi</th>
                <th className="px-4 py-3 text-right">Tutar (₺)</th>
                <th className="px-4 py-3">Banka & Keşideci</th>
                <th className="px-4 py-3">Hamil / Şantiye</th>
                <th className="px-4 py-3 text-center">Durum</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCekler.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    Kayıtlı çek bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredCekler.map((c) => {
                  const isVerilen = c.cekTuru === 'verilen_cek';
                  const linkedFirma = firmalar.find((f) => f.id === c.firmaId);
                  const isCariIntegrated = c.cariHesabaIsle || !!c.cariHareketId;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      {/* Çek No */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900">
                          {c.cekNo}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Giriş: {c.alinanTarih}
                        </div>
                      </td>

                      {/* İşlem Türü (Verilen Çek vs Alınan Çek) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isVerilen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                            <span>Firmaya Verilen Çek</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                            <span>Alınan Çek (Portföy)</span>
                          </span>
                        )}
                      </td>

                      {/* İlişkili Firma / Cari */}
                      <td className="px-4 py-3">
                        {linkedFirma ? (
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{linkedFirma.isim}</span>
                            </div>
                            {isCariIntegrated ? (
                              <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>{isVerilen ? 'Cari Borçtan Düşüldü' : 'Cariye Tahsilat İşlendi'}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">Cariye işlenmedi</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Bağımsız / Diğer</span>
                        )}
                      </td>

                      {/* Vade Tarihi */}
                      <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.vadeTarihi}</span>
                        </div>
                      </td>

                      {/* Miktar */}
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono text-sm whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatCurrency(c.miktar, c.paraBirimi)}</span>
                          {c.paraBirimi && c.paraBirimi !== 'TRY' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-sans font-bold">
                              {c.paraBirimi}
                            </span>
                          )}
                        </div>
                        {c.paraBirimi && c.paraBirimi !== 'TRY' && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            ≈ {formatCurrency(convertCurrencyToTRY(c.miktar, c.paraBirimi, exchangeRates.rates))}
                          </div>
                        )}
                      </td>

                      {/* Banka & Keşideci */}
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium text-slate-900">{c.bankaAdi}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          Keşideci: {c.hesapSahibi}
                        </div>
                        {c.aciklama && (
                          <div className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            {c.aciklama}
                          </div>
                        )}
                      </td>

                      {/* Hamil / Şantiye & Ciro Bilgisi */}
                      <td className="px-4 py-3 text-slate-600">
                        {c.durum === 'Ciro Edildi' ? (
                          <div className="space-y-1">
                            <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                              <Share2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span className="truncate max-w-[170px]" title={c.ciroEdilenFirma || c.hamil}>
                                {c.ciroEdilenFirma || c.hamil}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {c.ciroTarihi && (
                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{c.ciroTarihi}</span>
                                </span>
                              )}
                              {c.ciroCariHesabaIsle || c.ciroCariHareketId ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <CheckCircle className="w-2.5 h-2.5 text-purple-600" />
                                  <span>Carisine İşlendi</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Cariye işlenmedi</span>
                              )}
                            </div>
                            {c.santiyeProje && (
                              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                <span>{c.santiyeProje}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-slate-800">{c.hamil}</div>
                            {c.santiyeProje && (
                              <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                <span>{c.santiyeProje}</span>
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Durum Dropdown & Hızlı Ciro Butonu */}
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <select
                            value={c.durum}
                            onChange={(e) => {
                              const newStatus = e.target.value as Cek['durum'];
                              if (newStatus === 'Ciro Edildi') {
                                handleOpenCiroModal(c);
                              } else if (c.durum === 'Ciro Edildi') {
                                handleCancelCiro(c);
                                onUpdateStatus(c.id, newStatus);
                              } else {
                                onUpdateStatus(c.id, newStatus);
                              }
                            }}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer ${getStatusBadge(c.durum)}`}
                          >
                            <option value="Portföyde">Portföyde</option>
                            <option value="Tahsilde">Tahsilde</option>
                            <option value="Tahsil Edildi">Tahsil Edildi</option>
                            <option value="Ödendi">Ödendi</option>
                            <option value="Ciro Edildi">Ciro Edildi</option>
                            <option value="Karşılıksız">Karşılıksız</option>
                          </select>

                          {c.durum === 'Ciro Edildi' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCiroModal(c)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md cursor-pointer transition-colors"
                              title="Ciro bilgilerini incele / güncelle"
                            >
                              <Share2 className="w-3 h-3 text-purple-600" />
                              <span>Ciro Detayı</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCiroModal(c)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded-md cursor-pointer transition-colors"
                              title="Bu çeki firmaya ciro et ve carisine işle"
                            >
                              <Share2 className="w-3 h-3 text-purple-600" />
                              <span>Ciro Et</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* İşlem */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Çeki Düzenle"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCek(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Çeki Sil"
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

      {/* ========================================================================= */}
      {/* ÇEK EKLE / DÜZENLE MODAL                                                 */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingCek ? 'Çek Kaydını Düzenle' : 'Yeni Çek Girişi & Cari Entegrasyonu'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingCek(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* 1. Çek Yönü / Türü Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Çek Yönü ve İşlem Türü <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleCheckTypeToggle('verilen_cek')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      form.cekTuru === 'verilen_cek'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ArrowUpRight className={`w-5 h-5 shrink-0 mt-0.5 ${form.cekTuru === 'verilen_cek' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-xs sm:text-sm">Firmaya Kesilen / Verilen Çek</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Tedarikçiye ödeme. Firmanın cari borcundan düşer.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCheckTypeToggle('alinan_cek')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      form.cekTuru === 'alinan_cek'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-950 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ArrowDownLeft className={`w-5 h-5 shrink-0 mt-0.5 ${form.cekTuru === 'alinan_cek' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-xs sm:text-sm">Alınan Çek (Portföy)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Müşteri/hakediş tahsilatı. Kasaya/portföye girer.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Firma Seçimi & Cari Hesap Entegrasyonu */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>İlişkili Firma (Cari Hesap)</span>
                  </label>
                  {form.firmaId && activeFirmaBalance && (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      Mevcut Borç: {formatCurrency(Math.max(0, activeFirmaBalance.netBakiye))}
                    </span>
                  )}
                </div>

                <div>
                  <select
                    value={form.firmaId || ''}
                    onChange={(e) => handleFirmaChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-900"
                  >
                    <option value="">-- Firma Seçiniz (Cari Hesaba Bağla) --</option>
                    {firmalar.map((f) => {
                      const bal = getFirmaBalance(f.id);
                      return (
                        <option key={f.id} value={f.id}>
                          {f.isim} {bal.netBakiye > 0 ? `(Borcumuz: ${formatCurrency(bal.netBakiye)})` : bal.netBakiye < 0 ? `(Alacağımız: ${formatCurrency(Math.abs(bal.netBakiye))})` : '(Bakiye Sıfır)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Cari Hesaba İşle Onay Kutusu */}
                {form.firmaId && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.cariHesabaIsle ?? true}
                        onChange={(e) => setForm({ ...form, cariHesabaIsle: e.target.checked })}
                        className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          Bu çeki firmanın cari hesabına otomatik olarak işle
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {form.cekTuru === 'verilen_cek'
                            ? `Seçilen firmanın cari hesabına ${form.miktar ? formatCurrency(form.miktar) : 'belirtilen tutar'} 'Ödeme' olarak yansıtılır ve firmaya olan borçtan düşülür.`
                            : `Seçilen firmanın cari hesabına ${form.miktar ? formatCurrency(form.miktar) : 'belirtilen tutar'} 'Tahsilat' olarak işlenir.`}
                        </p>
                      </div>
                    </label>

                    {/* Dinamik Bilgi Notu */}
                    {form.cariHesabaIsle && activeSelectedFirma && form.miktar && form.miktar > 0 ? (
                      <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Otomatik Cari Etkisi:</strong>{' '}
                          {form.cekTuru === 'verilen_cek' ? (
                            <>
                              <strong>{activeSelectedFirma.isim}</strong> carisine <strong>{formatCurrency(form.miktar)}</strong> tutarında <em>Verilen Çek Ödemesi</em> kaydı oluşturulacaktır.
                            </>
                          ) : (
                            <>
                              <strong>{activeSelectedFirma.isim}</strong> carisine <strong>{formatCurrency(form.miktar)}</strong> tutarında <em>Alınan Çek Tahsilatı</em> kaydı oluşturulacaktır.
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 3. Çek Temel Bilgileri */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Çek Seri No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: CK-928194"
                    value={form.cekNo || ''}
                    onChange={(e) => setForm({ ...form, cekNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <CurrencySelector
                    value={form.paraBirimi || 'TRY'}
                    onChange={(curr) => setForm({ ...form, paraBirimi: curr })}
                    label="Para Birimi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tutar ({getCurrencySymbol(form.paraBirimi || 'TRY')}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={form.miktar === 0 ? '' : (form.miktar || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, miktar: val === '' ? 0 : parseFloat(val) || 0 });
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {/* Vade & Düzenlenme Tarihi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vade Tarihi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.vadeTarihi || ''}
                    onChange={(e) => setForm({ ...form, vadeTarihi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giriş / Düzenleme Tarihi
                  </label>
                  <input
                    type="date"
                    value={form.alinanTarih || ''}
                    onChange={(e) => setForm({ ...form, alinanTarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Banka Adı & Hızlı Banka Seçimi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Banka Adı <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_BANKS.slice(0, 6).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setForm({ ...form, bankaAdi: b })}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        form.bankaAdi === b
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Örn: Garanti BBVA"
                  value={form.bankaAdi || ''}
                  onChange={(e) => setForm({ ...form, bankaAdi: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Keşideci & Hamil */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {form.cekTuru === 'verilen_cek' ? 'Keşide Eden (Şirketimiz)' : 'Keşideci (Hesap Sahibi)'}
                  </label>
                  <input
                    type="text"
                    placeholder="Hesap sahibi veya keşideci"
                    value={form.hesapSahibi || ''}
                    onChange={(e) => setForm({ ...form, hesapSahibi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {form.cekTuru === 'verilen_cek' ? 'Teslim Edilen (Hamil / Alacaklı)' : 'Hamil / Kimde'}
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Firma ünvanı veya Portföy"
                    value={form.hamil || ''}
                    onChange={(e) => setForm({ ...form, hamil: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Şantiye & Durum */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">İlişkili Şantiye/Proje</label>
                  <select
                    value={form.santiyeProje || ''}
                    onChange={(e) => setForm({ ...form, santiyeProje: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="">-- Şantiye Seçiniz --</option>
                    {santiyeler.map((s) => (
                      <option key={s.id} value={s.isim}>
                        {s.isim}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Çek Durumu</label>
                  <select
                    value={form.durum || 'Portföyde'}
                    onChange={(e) => setForm({ ...form, durum: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="Portföyde">Portföyde (Kasada / Bekliyor)</option>
                    <option value="Tahsilde">Tahsilde (Bankaya Verildi)</option>
                    <option value="Tahsil Edildi">Tahsil Edildi</option>
                    <option value="Ödendi">Ödendi (Hesaptan Düştü)</option>
                    <option value="Ciro Edildi">Ciro Edildi (Firmaya Devredildi)</option>
                    <option value="Karşılıksız">Karşılıksız</option>
                  </select>
                </div>
              </div>

              {/* Ciro Edildi Seçildiğinde Açılan Ciro & Cari Bölümü */}
              {form.durum === 'Ciro Edildi' && (
                <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-950 uppercase flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-purple-600" />
                      <span>Ciro Edilen Firma & Cari Hesap Entegrasyonu</span>
                    </label>
                    {form.ciroFirmaId && (
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-purple-200 text-purple-800">
                        {(() => {
                          const bal = getFirmaBalance(form.ciroFirmaId);
                          return bal.netBakiye > 0 ? `Mevcut Borç: ${formatCurrency(bal.netBakiye)}` : `Bakiye: ${formatCurrency(bal.netBakiye)}`;
                        })()}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-purple-900 mb-1">
                      Ciro Edilecek Firma (Kayıtlı Firmalardan Seçin) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.ciroFirmaId || ''}
                      onChange={(e) => {
                        const targetF = firmalar.find((f) => f.id === e.target.value);
                        setForm({
                          ...form,
                          ciroFirmaId: e.target.value,
                          ciroEdilenFirma: targetF?.isim || '',
                          hamil: targetF ? targetF.isim : form.hamil,
                        });
                      }}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white font-medium text-slate-900"
                    >
                      <option value="">-- Ciro Edilecek Firma Seçiniz --</option>
                      {firmalar.map((f) => {
                        const bal = getFirmaBalance(f.id);
                        return (
                          <option key={f.id} value={f.id}>
                            {f.isim} ({f.tur === 'taseron' ? 'Taşeron' : f.tur === 'tedarikci' ? 'Tedarikçi' : 'Müşteri / Firma'}) {bal.netBakiye > 0 ? `- Borcumuz: ${formatCurrency(bal.netBakiye)}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">Ciro Tarihi</label>
                      <input
                        type="date"
                        value={form.ciroTarihi || getTodayDateString()}
                        onChange={(e) => setForm({ ...form, ciroTarihi: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-purple-900 mb-1">Ciro Açıklaması</label>
                      <input
                        type="text"
                        placeholder="Örn: Malzeme alımına mahsuben"
                        value={form.ciroAciklama || ''}
                        onChange={(e) => setForm({ ...form, ciroAciklama: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-purple-300 bg-white"
                      />
                    </div>
                  </div>

                  {form.ciroFirmaId && (
                    <div className="pt-2 border-t border-purple-200/60">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.ciroCariHesabaIsle ?? true}
                          onChange={(e) => setForm({ ...form, ciroCariHesabaIsle: e.target.checked })}
                          className="w-4 h-4 mt-0.5 text-purple-600 rounded border-purple-300 focus:ring-purple-500 cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-purple-950">
                            Ciro edilen firmanın cari hesabına (ödeme / mahsup olarak) otomatik işle
                          </span>
                          <p className="text-[11px] text-purple-800 mt-0.5">
                            Firmanın cari ekstresine {form.miktar ? formatCurrency(Number(form.miktar)) : 'çek tutarı kadar'} 'Ödeme' kaydı eklenir ve firmaya olan borcunuz düşer.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Açıklama */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Açıklama / Fatura Notu</label>
                <input
                  type="text"
                  placeholder="Örn: Demir faturası karşılığı ciro edildi / Hakediş tahsilatı"
                  value={form.aciklama || ''}
                  onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCek(null);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  {editingCek ? 'Çeki ve Cariyi Güncelle' : 'Çeki Kaydet & Cari Hesaba İşle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ÇEK SİLME ONAY MODAL                                                      */}
      {/* ========================================================================= */}
      {deletingCek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-rose-50/50">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Çek Kaydını Sil</h3>
                <p className="text-xs text-slate-500">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700">
                <strong className="font-mono text-slate-900">{deletingCek.cekNo}</strong> seri nolu,{' '}
                <strong>{formatCurrency(deletingCek.miktar)}</strong> tutarındaki çeki silmek istediğinizden emin misiniz?
              </p>

              {(deletingCek.cariHesabaIsle || deletingCek.cariHareketId || deletingCek.ciroCariHareketId) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Cari Hesap Uyarısı:</strong> Bu çek firma cari hesabına işlenmiştir. Çek silindiğinde, firmanın cari hareketlerindeki ilişkili ödeme/tahsilat ve ciro kayıtları da otomatik olarak silinecektir.
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingCek(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteCek(deletingCek.id);
                    setDeletingCek(null);
                  }}
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Evet, Çeki Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ÇEK CİRO ETME & CARİ ENTEGRASYON MODALI                                  */}
      {/* ========================================================================= */}
      {ciroModalCek && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {ciroModalCek.durum === 'Ciro Edildi' ? 'Çek Ciro & Cari Bilgilerini Güncelle' : 'Çeki Firmaya Ciro Et & Cari Hesaba İşle'}
                  </h3>
                  <p className="text-xs text-purple-800">
                    Kayıtlı bir firmayı seçerek çeki devredin ve firmanın cari borcundan düşün.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCiroModalCek(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCiro} className="p-6 space-y-4 overflow-y-auto">
              {/* Çek Özeti Kartı */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 font-mono text-sm">
                    <span>{ciroModalCek.cekNo}</span>
                    <span className="text-slate-400 font-normal">|</span>
                    <span className="text-slate-700 font-semibold text-xs">{ciroModalCek.bankaAdi}</span>
                  </div>
                  <div className="font-mono font-bold text-base text-slate-900">
                    {formatCurrency(ciroModalCek.miktar, ciroModalCek.paraBirimi)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400">Vade Tarihi:</span>{' '}
                    <strong className="text-slate-800">{ciroModalCek.vadeTarihi}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Keşideci:</span>{' '}
                    <strong className="text-slate-800">{ciroModalCek.hesapSahibi || 'Belirtilmedi'}</strong>
                  </div>
                  {ciroModalCek.firmaId && (
                    <div className="col-span-2 text-slate-500">
                      <span className="text-slate-400">İlk Alındığı/Verildiği Firma:</span>{' '}
                      <strong>{firmalar.find((f) => f.id === ciroModalCek.firmaId)?.isim || 'Kayıtlı Firma'}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Ciro Edilecek Firma Seçimi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span>Ciro Edilecek Firma (Kayıtlı Firmalar Listesi) *</span>
                </label>
                <select
                  required
                  value={ciroForm.firmaId}
                  onChange={(e) => setCiroForm({ ...ciroForm, firmaId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-purple-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- Ciro Edilecek Firma Seçiniz --</option>
                  {firmalar.map((f) => {
                    const bal = getFirmaBalance(f.id);
                    return (
                      <option key={f.id} value={f.id}>
                        {f.isim} ({f.tur === 'taseron' ? 'Taşeron' : f.tur === 'tedarikci' ? 'Tedarikçi' : 'Müşteri / Firma'}) {bal.netBakiye > 0 ? `- Borcumuz: ${formatCurrency(bal.netBakiye)}` : bal.netBakiye < 0 ? `- Alacağımız: ${formatCurrency(Math.abs(bal.netBakiye))}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500">
                  Taşeronlar ve Firmalar bölümündeki tüm firmalar eşzamanlı olarak burada listelenir.
                </p>
              </div>

              {/* Seçilen Firma Bilgi Kartı */}
              {(() => {
                const chosenFirma = firmalar.find((f) => f.id === ciroForm.firmaId);
                if (!chosenFirma) return null;
                const bal = getFirmaBalance(chosenFirma.id);
                return (
                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950">{chosenFirma.isim}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        {chosenFirma.tur === 'taseron' ? 'Taşeron' : chosenFirma.tur === 'tedarikci' ? 'Tedarikçi Firma' : 'Firma'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Mevcut Cari Bakiyemiz:</span>
                      <strong className={bal.netBakiye > 0 ? 'text-amber-700 font-mono' : 'text-slate-800 font-mono'}>
                        {bal.netBakiye > 0
                          ? `Firmaya ${formatCurrency(bal.netBakiye)} Borçluyuz`
                          : bal.netBakiye < 0
                          ? `Firmadan ${formatCurrency(Math.abs(bal.netBakiye))} Alacaklıyız`
                          : 'Bakiye Sıfır'}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Ciro Edilecek Şantiye Seçimi */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  İlgili Şantiye / Proje (Hangi şantiyenin masrafına işlenecek?)
                </label>
                <select
                  value={ciroForm.santiyeProje || ''}
                  onChange={(e) => setCiroForm({ ...ciroForm, santiyeProje: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-900"
                >
                  <option value="">-- Şantiye Seçiniz (Opsiyonel / Genel Cari) --</option>
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.isim}>
                      {s.isim}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Taşeron birden fazla şantiyede çalışıyorsa çek sadece burada seçilen şantiyenin masraflarına eklenir.
                </p>
              </div>

              {/* Ciro Tarihi & Açıklama */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ciro Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={ciroForm.tarih}
                    onChange={(e) => setCiroForm({ ...ciroForm, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ciro Notu / Fatura No</label>
                  <input
                    type="text"
                    placeholder="Örn: Malzeme faturasına mahsuben"
                    value={ciroForm.aciklama}
                    onChange={(e) => setCiroForm({ ...ciroForm, aciklama: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Cari Hesaba İşleme Seçeneği (Opsiyon) */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ciroForm.cariHesabaIsle}
                    onChange={(e) => setCiroForm({ ...ciroForm, cariHesabaIsle: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-purple-600 rounded border-purple-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-purple-950">
                      Seçilen firmanın cari hesabına (ödeme / mahsup olarak) otomatik işle
                    </span>
                    <p className="text-[11px] text-purple-800 mt-0.5 leading-relaxed">
                      Bu seçenek işaretlendiğinde, firmanın cari ekstresine {formatCurrency(ciroModalCek.miktar, ciroModalCek.paraBirimi)} tutarında 'Ciro Edilen Çek Ödemesi' işlenir ve firmaya olan borcunuz otomatik olarak düşülür.
                    </p>
                  </div>
                </label>

                {/* Dinamik Önizleme */}
                {ciroForm.cariHesabaIsle && ciroForm.firmaId && (
                  <div className="mt-2 p-2 rounded-lg bg-white border border-purple-200 text-[11px] text-purple-900 flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      {(() => {
                        const targetF = firmalar.find((f) => f.id === ciroForm.firmaId);
                        const bal = targetF ? getFirmaBalance(targetF.id) : null;
                        const newBal = bal ? bal.netBakiye - ciroModalCek.miktar : 0;
                        return (
                          <span>
                            <strong>{targetF?.isim}</strong> carisine <strong>{formatCurrency(ciroModalCek.miktar)}</strong> ödeme eklenecektir.{' '}
                            {bal && bal.netBakiye > 0 ? (
                              <>Mevcut Borç: <strong>{formatCurrency(bal.netBakiye)}</strong> → Yeni Borç: <strong className="text-emerald-700">{formatCurrency(Math.max(0, newBal))}</strong></>
                            ) : null}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Butonları */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {ciroModalCek.durum === 'Ciro Edildi' && (
                    <button
                      type="button"
                      onClick={() => handleCancelCiro(ciroModalCek)}
                      className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Ciroyu kaldır ve çeki portföye geri al"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ciroyu İptal Et (Portföye Al)</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCiroModalCek(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={!ciroForm.firmaId}
                    className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Çeki Ciro Et & Kaydet</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
