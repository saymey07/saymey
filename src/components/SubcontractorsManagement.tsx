import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Phone, 
  User, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Users,
  Building2,
  FileText,
  ExternalLink,
  MapPin,
  Mail,
  ShieldCheck,
  Receipt,
  WalletCards
} from 'lucide-react';
import { Taseron, Personnel, Firma, FirmaCari } from '../types';
import { formatCurrency, getTodayDateString } from '../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../utils/currencyStore';
import { ExportButton } from './ExportButton';
import { ExportOptions } from '../utils/exportUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface TaseronBasket {
  borc: number;
  alacak: number;
  bakiye: number; // borc - alacak (> 0 borçluyuz, < 0 alacaklıyız)
}

const calculateTaseronBaskets = (
  t: Taseron,
  matchingFirma: Firma | undefined,
  cariList: FirmaCari[]
): { baskets: Record<string, TaseronBasket>; movements: FirmaCari[] } => {
  const baskets: Record<string, TaseronBasket> = {};
  const movements = cariList.filter(
    (c) => c.firmaId === t.id || (matchingFirma && c.firmaId === matchingFirma.id)
  );

  movements.forEach((c) => {
    const origCurr = (c.paraBirimi || 'TRY').trim().toUpperCase();
    const islemTuru = c.islemTuru || ((c.borc || 0) > 0 ? 'alis_faturasi' : 'odeme');

    if (islemTuru === 'alis_faturasi') {
      // Alış Faturası / Hakediş girişi -> Borç
      if (!baskets[origCurr]) baskets[origCurr] = { borc: 0, alacak: 0, bakiye: 0 };
      baskets[origCurr].borc += (c.borc || 0);
      baskets[origCurr].bakiye += (c.borc || 0);
    } else if (islemTuru === 'satis_faturasi') {
      // Satış Faturası -> Alacak
      if (!baskets[origCurr]) baskets[origCurr] = { borc: 0, alacak: 0, bakiye: 0 };
      baskets[origCurr].alacak += (c.alacak || 0);
      baskets[origCurr].bakiye -= (c.alacak || 0);
    } else if (islemTuru === 'odeme') {
      // Taşerona ödeme yapıldı -> hedef borç sepetinden düşer
      const targetCurr = (c.hedefParaBirimi || origCurr).trim().toUpperCase();
      const deducted = c.hedefDusulenTutar && c.hedefDusulenTutar > 0
        ? c.hedefDusulenTutar
        : (c.alacak || 0);

      if (!baskets[targetCurr]) baskets[targetCurr] = { borc: 0, alacak: 0, bakiye: 0 };
      baskets[targetCurr].alacak += deducted;
      baskets[targetCurr].bakiye -= deducted;
    } else if (islemTuru === 'tahsilat') {
      // Taşerondan tahsilat alındı
      const targetCurr = (c.hedefParaBirimi || origCurr).trim().toUpperCase();
      const deducted = c.hedefDusulenTutar && c.hedefDusulenTutar > 0
        ? c.hedefDusulenTutar
        : (c.borc || 0);

      if (!baskets[targetCurr]) baskets[targetCurr] = { borc: 0, alacak: 0, bakiye: 0 };
      baskets[targetCurr].borc += deducted;
      baskets[targetCurr].bakiye += deducted;
    }
  });

  // Eğer cari hareket yoksa ama devreden bakiye t.bakiye varsa TRY olarak kabul et
  if (movements.length === 0 && t.bakiye && t.bakiye !== 0) {
    if (!baskets['TRY']) baskets['TRY'] = { borc: 0, alacak: 0, bakiye: 0 };
    if (t.bakiye > 0) {
      baskets['TRY'].borc += t.bakiye;
      baskets['TRY'].bakiye += t.bakiye;
    } else {
      baskets['TRY'].alacak += Math.abs(t.bakiye);
      baskets['TRY'].bakiye += t.bakiye;
    }
  }

  return { baskets, movements };
};

interface SubcontractorsManagementProps {
  taseronlar: Taseron[];
  personnelList: Personnel[];
  firmalar?: Firma[];
  cariList?: FirmaCari[];
  onAddTaseron: (taseron: Taseron) => void;
  onUpdateTaseron: (taseron: Taseron) => void;
  onDeleteTaseron: (id: string) => void;
  onNavigateToCompanies?: (firmaId?: string) => void;
}

export const SubcontractorsManagement: React.FC<SubcontractorsManagementProps> = ({
  taseronlar,
  personnelList,
  firmalar = [],
  cariList = [],
  onAddTaseron,
  onUpdateTaseron,
  onDeleteTaseron,
  onNavigateToCompanies,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaseron, setEditingTaseron] = useState<Taseron | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const exchangeRates = useMemo(() => getSavedExchangeRates(), []);

  // Taşeronların tüm para birimlerindeki toplam bakiyeleri
  const overallStats = useMemo(() => {
    const totalsByCurrency: Record<string, { borc: number; alacak: number; bakiye: number }> = {};
    let totalTRYEquiv = 0;

    taseronlar.forEach((t) => {
      const matchingFirma = firmalar.find(
        (f) => f.id === t.id || f.isim.trim().toLowerCase() === t.isim.trim().toLowerCase()
      );
      const { baskets } = calculateTaseronBaskets(t, matchingFirma, cariList);

      Object.entries(baskets).forEach(([curr, b]) => {
        if (!totalsByCurrency[curr]) totalsByCurrency[curr] = { borc: 0, alacak: 0, bakiye: 0 };
        totalsByCurrency[curr].borc += b.borc;
        totalsByCurrency[curr].alacak += b.alacak;
        totalsByCurrency[curr].bakiye += b.bakiye;

        totalTRYEquiv += convertCurrencyToTRY(b.bakiye, curr, exchangeRates.rates);
      });
    });

    const activeCurrs = Object.keys(totalsByCurrency).filter(
      (c) => Math.abs(totalsByCurrency[c].bakiye) >= 0.01 || Math.abs(totalsByCurrency[c].borc) >= 0.01
    );

    return {
      totalsByCurrency,
      activeCurrs,
      totalTRYEquiv: Math.round((totalTRYEquiv + Number.EPSILON) * 100) / 100,
    };
  }, [taseronlar, firmalar, cariList, exchangeRates]);

  const [form, setForm] = useState<Partial<Taseron>>({
    isim: '',
    telefon: '',
    yetkili: '',
    uzmanlik: 'Ahşap İşleri',
    durum: 'Aktif',
    bakiye: 0,
    vergiNo: '',
    vergiDairesi: '',
    adres: '',
    email: '',
  });

  const openAddModal = () => {
    setEditingTaseron(null);
    setForm({
      isim: '',
      telefon: '',
      yetkili: '',
      uzmanlik: 'Ahşap İşleri',
      durum: 'Aktif',
      bakiye: 0,
      vergiNo: '',
      vergiDairesi: '',
      adres: '',
      email: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (t: Taseron) => {
    // If matching firma exists, populate missing vergiNo/vergiDairesi/adres/email
    const matchingFirma = firmalar.find(
      (f) => f.id === t.id || f.isim.trim().toLowerCase() === t.isim.trim().toLowerCase()
    );

    setEditingTaseron(t);
    setForm({
      ...t,
      vergiNo: t.vergiNo || matchingFirma?.vergiNo || '',
      vergiDairesi: t.vergiDairesi || matchingFirma?.vergiDairesi || '',
      adres: t.adres || matchingFirma?.adres || '',
      email: t.email || matchingFirma?.email || '',
      uzmanlik: t.uzmanlik || matchingFirma?.uzmanlik || 'Genel Taşeron',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.isim?.trim()) return;

    if (editingTaseron) {
      onUpdateTaseron({
        ...editingTaseron,
        ...form,
        isim: form.isim.trim(),
        yetkili: form.yetkili?.trim() || '',
        telefon: form.telefon?.trim() || '',
        uzmanlik: form.uzmanlik?.trim() || 'Genel Taşeron',
        vergiNo: form.vergiNo?.trim() || '',
        vergiDairesi: form.vergiDairesi?.trim() || '',
        adres: form.adres?.trim() || '',
        email: form.email?.trim() || '',
      } as Taseron);
    } else {
      onAddTaseron({
        id: `tas-${Date.now()}`,
        isim: form.isim.trim(),
        telefon: form.telefon?.trim() || '',
        yetkili: form.yetkili?.trim() || '',
        uzmanlik: form.uzmanlik?.trim() || 'Genel Taşeron',
        durum: form.durum || 'Aktif',
        bakiye: Number(form.bakiye) || 0,
        vergiNo: form.vergiNo?.trim() || '',
        vergiDairesi: form.vergiDairesi?.trim() || '',
        adres: form.adres?.trim() || '',
        email: form.email?.trim() || '',
      });
    }
    setIsModalOpen(false);
  };

  const getTaseronExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Taşeron Unvanı', dataKey: 'isim', width: 32 },
      { header: 'Yetkili Kişi', dataKey: 'yetkili', width: 22 },
      { header: 'Uzmanlık / İş Kolu', dataKey: 'uzmanlik', width: 25 },
      { header: 'Telefon', dataKey: 'telefon', width: 20 },
      { header: 'Vergi No', dataKey: 'vergiNo', width: 20 },
      { header: 'Durum', dataKey: 'durum', width: 18, align: 'center' as const },
      { header: 'Bakiye (TRY)', dataKey: 'bakiyeTRY', width: 25, align: 'right' as const },
    ];

    let totalBalanceTRY = 0;
    const data = taseronlar.map((t) => {
      const matchingFirma = firmalar.find(
        (f) => f.isim.trim().toLowerCase() === t.isim.trim().toLowerCase() || f.id === t.id
      );
      const { baskets } = calculateTaseronBaskets(t, matchingFirma, cariList);
      let taseronTotalTRY = 0;
      Object.entries(baskets).forEach(([curr, b]) => {
        taseronTotalTRY += convertCurrencyToTRY(b.bakiye, curr, exchangeRates.rates);
      });
      totalBalanceTRY += taseronTotalTRY;

      return {
        isim: t.isim,
        yetkili: t.yetkili || '-',
        uzmanlik: t.uzmanlik || 'Genel Taşeron',
        telefon: t.telefon || '-',
        vergiNo: (t.vergiDairesi || matchingFirma?.vergiDairesi) && (t.vergiNo || matchingFirma?.vergiNo)
          ? `${t.vergiDairesi || matchingFirma?.vergiDairesi} - ${t.vergiNo || matchingFirma?.vergiNo}`
          : (t.vergiNo || matchingFirma?.vergiNo || t.vergiDairesi || matchingFirma?.vergiDairesi || '-'),
        durum: t.durum,
        bakiyeTRY: formatCurrency(taseronTotalTRY),
      };
    });

    return {
      title: 'Taşeron Firmalar Listesi (Tablo 6)',
      subtitle: `Toplam ${taseronlar.length} taşeron firma`,
      filename: `Taseron_Listesi_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Taşeron Sayısı', value: `${taseronlar.length} firma` },
        { label: 'Toplam Net Bakiye Durumu (TRY)', value: formatCurrency(totalBalanceTRY) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">
              Veritabanı Tablosu 6: Taşeron Firmalar
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-800">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Firma Cari Rehberi ile 1:1 Senkronize</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kalıp, demir, elektrik, tesisat ve mekanik alt yüklenicileri. Buraya eklenen taşeronlar otomatik olarak <b>Firmalar & Cari Hesaplar</b> listesinde taşeron cari hesabı olarak yer alır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportButton
            options={getTaseronExportOptions}
            buttonText="Taşeronları Dışa Aktar"
            variant="secondary"
          />

          {onNavigateToCompanies && (
            <button
              type="button"
              onClick={() => onNavigateToCompanies()}
              className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Firma & Cari Tablosu</span>
            </button>
          )}

          <button
            onClick={openAddModal}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Yeni Taşeron Ekle</span>
          </button>
        </div>
      </div>

      {/* Genel Taşeron Döviz Bakiyeleri Özeti */}
      {taseronlar.length > 0 && overallStats.activeCurrs.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50/70 via-white to-slate-50 p-4 rounded-2xl border border-purple-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
              <WalletCards className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Taşeronlar Genel Cari Dengesi</span>
              <span className="text-[11px] text-slate-500">
                {taseronlar.length} taşeron firmanın para birimlerine göre net bakiye toplamı
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            {overallStats.activeCurrs.map((curr) => {
              const st = overallStats.totalsByCurrency[curr];
              const isBorc = st.bakiye > 0;
              return (
                <div
                  key={curr}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-2 shadow-2xs ${
                    isBorc
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                  title={`${curr} Sepeti Toplamı`}
                >
                  <span className="text-slate-500 text-[10px] font-sans uppercase font-bold tracking-wider">{curr}:</span>
                  <span>{formatCurrency(Math.abs(st.bakiye), curr)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    isBorc ? 'bg-rose-200/70 text-rose-900' : 'bg-emerald-200/70 text-emerald-900'
                  }`}>
                    {isBorc ? 'Borç' : 'Alacak'}
                  </span>
                </div>
              );
            })}

            {overallStats.activeCurrs.some((c) => c !== 'TRY') && (
              <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-mono text-xs font-bold shadow-2xs flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px] font-sans">Konsolide TL:</span>
                <span className={overallStats.totalTRYEquiv > 0 ? 'text-rose-600' : overallStats.totalTRYEquiv < 0 ? 'text-emerald-600' : 'text-slate-800'}>
                  ≈ {formatCurrency(Math.abs(overallStats.totalTRYEquiv), 'TRY')}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {overallStats.totalTRYEquiv > 0 ? '(Borç)' : overallStats.totalTRYEquiv < 0 ? '(Alacak)' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {taseronlar.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700 text-base">Henüz kayıtlı taşeron firma bulunmuyor</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Buradan ekleyeceğiniz veya Firma Cari bölümünden ekleyeceğiniz taşeronlar otomatik olarak senkronize edilir.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>İlk Taşeronu Ekle</span>
            </button>
          </div>
        ) : (
          taseronlar.map((t) => {
            const workers = personnelList.filter(
              (p) => p.taseronId === t.id || p.taseron === t.isim
            );

            // Match with firma cari ledger
            const matchingFirma = firmalar.find(
              (f) => f.id === t.id || f.isim.trim().toLowerCase() === t.isim.trim().toLowerCase()
            );

            const { baskets, movements: taseronCariMovements } = calculateTaseronBaskets(
              t,
              matchingFirma,
              cariList
            );

            const activeCurrencies = Object.keys(baskets).filter((curr) => {
              const b = baskets[curr];
              return Math.abs(b.bakiye) > 0.001 || Math.abs(b.borc) > 0.001 || Math.abs(b.alacak) > 0.001;
            });

            const nonZeroBaskets = activeCurrencies.filter(
              (curr) => Math.abs(baskets[curr].bakiye) >= 0.01
            );

            let totalNetTRY = 0;
            Object.entries(baskets).forEach(([curr, b]) => {
              totalNetTRY += convertCurrencyToTRY(b.bakiye, curr, exchangeRates.rates);
            });
            totalNetTRY = Math.round((totalNetTRY + Number.EPSILON) * 100) / 100;

            const displayVergiNo = t.vergiNo || matchingFirma?.vergiNo;
            const displayVergiDairesi = t.vergiDairesi || matchingFirma?.vergiDairesi;
            const displayAdres = t.adres || matchingFirma?.adres;
            const displayEmail = t.email || matchingFirma?.email;

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                            {t.isim}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-block text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            {t.uzmanlik || 'Genel Taşeron'}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <span>✓</span> Cari Entegre
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                        title="Düzenle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm({
                            isOpen: true,
                            title: 'Taşeronu Sil',
                            description: `"${t.isim}" taşeronunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                            onConfirm: () => onDeleteTaseron(t.id),
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Firma Yetkilisi: <strong className="text-slate-800">{t.yetkili || 'Belirtilmedi'}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Telefon: <strong className="text-slate-800 font-mono">{t.telefon || 'Belirtilmedi'}</strong></span>
                    </div>

                    {(displayVergiDairesi || displayVergiNo) && (
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Vergi: {displayVergiDairesi ? <strong className="text-slate-800">{displayVergiDairesi} / </strong> : null}
                          {displayVergiNo ? <strong className="text-slate-800 font-mono">VN: {displayVergiNo}</strong> : null}
                        </span>
                      </div>
                    )}

                    {displayAdres && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate" title={displayAdres}>Adres: {displayAdres}</span>
                      </div>
                    )}

                    {displayEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">E-Posta: {displayEmail}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Kayıtlı Personel: <strong className="text-slate-800">{workers.length} Kişi</strong></span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {taseronCariMovements.length} Cari Fatura/Fiş
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block">Net Cari Bakiye:</span>
                      {nonZeroBaskets.length > 1 && (
                        <span className="text-[10px] text-purple-700 font-semibold">
                          {nonZeroBaskets.length} Farklı Döviz
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right">
                      {nonZeroBaskets.length > 0 ? (
                        <>
                          {nonZeroBaskets.map((curr) => {
                            const b = baskets[curr];
                            const isBorc = b.bakiye > 0;
                            return (
                              <div
                                key={curr}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                                  isBorc
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                                title={`${curr} Detayı: Borç: ${formatCurrency(b.borc, curr)} | Ödeme/Alacak: ${formatCurrency(b.alacak, curr)}`}
                              >
                                <span>{formatCurrency(Math.abs(b.bakiye), curr)}</span>
                                <span className={`text-[10px] px-1 py-0.2 rounded font-bold uppercase ${
                                  isBorc ? 'bg-rose-200/60 text-rose-800' : 'bg-emerald-200/60 text-emerald-800'
                                }`}>
                                  {isBorc ? 'Borç' : 'Alacak'}
                                </span>
                              </div>
                            );
                          })}

                          {/* Birden fazla para birimi varsa veya TL haricinde döviz varsa yaklaşık konsolide TL tutarı */}
                          {(nonZeroBaskets.length > 1 || (nonZeroBaskets.length === 1 && nonZeroBaskets[0] !== 'TRY')) && (
                            <div className="text-[11px] font-semibold text-slate-600 pt-1 border-t border-slate-100 font-mono">
                              <span className="text-slate-400 text-[10px] font-sans mr-1">Konsolide TL:</span>
                              <span className={totalNetTRY > 0 ? 'text-rose-600 font-bold' : totalNetTRY < 0 ? 'text-emerald-600 font-bold' : 'text-slate-700 font-bold'}>
                                ≈ {formatCurrency(Math.abs(totalNetTRY), 'TRY')}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">
                                {totalNetTRY > 0 ? '(Borç)' : totalNetTRY < 0 ? '(Alacak)' : '(Kapalı)'}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-50 text-slate-600 border border-slate-200">
                          0,00 ₺ (Hesap Kapalı)
                        </span>
                      )}
                    </div>
                  </div>

                  {onNavigateToCompanies && (
                    <button
                      type="button"
                      onClick={() => onNavigateToCompanies(matchingFirma?.id || t.id)}
                      className="w-full py-1.5 px-2 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-800 border border-slate-200 hover:border-purple-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Cari Fatura & Hareketleri İncele</span>
                      <ExternalLink className="w-3 h-3 ml-auto text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {editingTaseron ? 'Taşeron Bilgilerini Düzenle' : 'Yeni Taşeron Firma Ekle'}
                  </h3>
                  <span className="text-[11px] text-purple-700 font-medium">
                    Firma & Cari Rehberi ile 1:1 Eşzamanlı Kayıt
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {/* Sync Informational Box */}
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-purple-900">Otomatik Cari Senkronizasyon</span>
                  <span className="text-[11px] text-purple-800 leading-tight block mt-0.5">
                    Burada kaydettiğiniz taşeron, <b>Firmalar & Cari Hesaplar (Tablo 10)</b> bölümüne "Taşeron Firma" olarak yansıtılır. Fatura veya ödeme kestiğinizde hakediş bakiyesi ortak olarak güncellenir.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taşeron Firma Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Adelsan İnşaat LTD. ŞTİ"
                  value={form.isim || ''}
                  onChange={(e) => setForm({ ...form, isim: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uzmanlık Alanı / İş Kolu
                </label>
                <input
                  type="text"
                  placeholder="Örn: Ahşap İşleri"
                  value={form.uzmanlik || ''}
                  onChange={(e) => setForm({ ...form, uzmanlik: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Yetkili Kişi
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Hüseyin Bey"
                    value={form.yetkili || ''}
                    onChange={(e) => setForm({ ...form, yetkili: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    placeholder="0533 111 22 33"
                    value={form.telefon || ''}
                    onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Kadıköy V.D."
                    value={form.vergiDairesi || ''}
                    onChange={(e) => setForm({ ...form, vergiDairesi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vergi Numarası / T.C.
                  </label>
                  <input
                    type="text"
                    placeholder="10 veya 11 haneli"
                    value={form.vergiNo || ''}
                    onChange={(e) => setForm({ ...form, vergiNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-Posta
                </label>
                <input
                  type="email"
                  placeholder="muhasebe@taseron.com"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firma / Şantiye Adresi
                </label>
                <textarea
                  rows={2}
                  placeholder="Firma resmi adresi veya şantiye irtibat yeri"
                  value={form.adres || ''}
                  onChange={(e) => setForm({ ...form, adres: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açılış Cari Bakiyesi (₺)
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.bakiye || 0}
                  onChange={(e) => setForm({ ...form, bakiye: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Geçmişten devreden alacak/borç açılış bakiyesi
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  {editingTaseron ? 'Değişiklikleri Kaydet' : 'Taşeronu & Cariyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
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

