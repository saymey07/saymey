import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  CreditCard, 
  Building, 
  Calendar, 
  DollarSign, 
  Shield, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Clock, 
  Calculator,
  Briefcase,
  HardHat,
  CheckCircle2,
  Info,
  Wallet,
  Plus,
  Trash2,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Personnel, PersonelDonemBakiye, PersonelUcretGecmisi, Santiye, Taseron } from '../types';
import { getTodayDateString, formatCurrency } from '../utils/storage';

interface PersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (personnel: Personnel) => void;
  initialData?: Personnel | null;
  santiyeler: Santiye[];
  taseronlar: Taseron[];
  existingPersonnelList?: Personnel[];
}

export const PersonnelModal: React.FC<PersonnelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  santiyeler,
  taseronlar,
  existingPersonnelList = [],
}) => {
  const [formData, setFormData] = useState<Partial<Personnel>>({
    isim: '',
    soyisim: '',
    TCNO: '',
    Iban1: '',
    Iban2: '',
    telefon: '',
    santiyeId: '',
    santiye: '',
    ucretTipi: 'yevmiye',
    yevmiye: 1600,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    resmiMaas: 28075.5,
    emekli: false,
    sigorta: true,
    maas: 48000,
    girisTarihi: getTodayDateString(),
    cikisTarihi: '',
    taseronId: '',
    taseron: '',
    durum: 'Aktif',
    kategori: 'Ahşap Ustası',
    link: '',
    resim: '',
    eskiBakiye: 0,
    eskiBakiyeDonemi: getTodayDateString().slice(0, 7),
    donemBakiyeleri: [],
    ucretGecmisi: [],
  });

  // Yeni dönem bakiyesi ekleme / düzenleme için geçici giriş state'leri
  const [newBakiyeDonem, setNewBakiyeDonem] = useState<string>(getTodayDateString().slice(0, 7));
  const [newBakiyeTutar, setNewBakiyeTutar] = useState<string>('');
  const [newBakiyeAciklama, setNewBakiyeAciklama] = useState<string>('');

  // Ücret & Maaş Değişikliği Yönetimi (Önceki dönemlere yansıtma / sadece ileriye yansıtma seçeneği)
  const [wageChangeScope, setWageChangeScope] = useState<'future_only' | 'all_periods'>('future_only');
  const [wageChangeEffectiveDonem, setWageChangeEffectiveDonem] = useState<string>(getTodayDateString().slice(0, 7));
  const [wageChangeAciklama, setWageChangeAciklama] = useState<string>('');
  const [ucretGecmisiList, setUcretGecmisiList] = useState<PersonelUcretGecmisi[]>([]);
  const [showWageHistory, setShowWageHistory] = useState<boolean>(false);

  // Manuel kademe ekleme alanları
  const [newKademeDonem, setNewKademeDonem] = useState<string>(getTodayDateString().slice(0, 7));
  const [newKademeYevmiye, setNewKademeYevmiye] = useState<string>('');
  const [newKademeMaas, setNewKademeMaas] = useState<string>('');
  const [newKademeAciklama, setNewKademeAciklama] = useState<string>('');

  // Aylık Resmi Çalışma Günü (SGK Günleri) Manuel Belirleme State'leri
  const [aylikResmiGunler, setAylikResmiGunler] = useState<Record<string, number>>(() => {
    return initialData?.aylikResmiGunler ? { ...initialData.aylikResmiGunler } : {};
  });
  const [showResmiGunSettings, setShowResmiGunSettings] = useState<boolean>(false);
  const [newResmiGunDonem, setNewResmiGunDonem] = useState<string>(getTodayDateString().slice(0, 7));
  const [newResmiGunTutar, setNewResmiGunTutar] = useState<string>('30');

  const handleAddOrUpdateResmiGun = () => {
    const parsed = parseFloat(newResmiGunTutar);
    if (isNaN(parsed) || parsed < 0 || !newResmiGunDonem) return;
    const donem = newResmiGunDonem.slice(0, 7);
    setAylikResmiGunler((prev) => ({
      ...prev,
      [donem]: Math.round(parsed * 10) / 10,
    }));
  };

  const handleDeleteResmiGun = (donem: string) => {
    setAylikResmiGunler((prev) => {
      const rest = { ...prev };
      delete rest[donem];
      return rest;
    });
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const trimmedTC = (formData.TCNO || '').trim();
  const duplicatePerson = (trimmedTC.length === 11)
    ? existingPersonnelList.find((p) => p.TCNO?.trim() === trimmedTC && p.id !== initialData?.id)
    : null;

  useEffect(() => {
    const defaultDonem = getTodayDateString().slice(0, 7);
    if (initialData) {
      const fallbackDonem =
        initialData.eskiBakiyeDonemi ||
        (initialData.girisTarihi && initialData.girisTarihi.length >= 7
          ? initialData.girisTarihi.slice(0, 7)
          : defaultDonem);

      // Mevcut donemBakiyeleri varsa al, yoksa eski tekil eskiBakiye != 0 ise otomatik listeye dönüştür
      let initialDonemBakiyeleri: PersonelDonemBakiye[] = [];
      if (Array.isArray(initialData.donemBakiyeleri) && initialData.donemBakiyeleri.length > 0) {
        initialDonemBakiyeleri = initialData.donemBakiyeleri.map((item) => ({
          id: item.id || `db-${item.donem}-${Math.random().toString(36).slice(2, 6)}`,
          donem: item.donem.slice(0, 7),
          tutar: Number(item.tutar) || 0,
          aciklama: item.aciklama || '',
        }));
      } else if (initialData.eskiBakiye && Number(initialData.eskiBakiye) !== 0) {
        initialDonemBakiyeleri = [
          {
            id: `db-${fallbackDonem}`,
            donem: fallbackDonem,
            tutar: Number(initialData.eskiBakiye) || 0,
            aciklama: 'Devreden Bakiye / Elden Harcama',
          },
        ];
      }

      // Ücret kademe geçmişi
      let initialUcretGecmisi: PersonelUcretGecmisi[] = [];
      if (Array.isArray(initialData.ucretGecmisi) && initialData.ucretGecmisi.length > 0) {
        initialUcretGecmisi = initialData.ucretGecmisi.map((item) => ({ ...item }));
      }

      setFormData({
        ...initialData,
        ucretTipi: initialData.ucretTipi || (initialData.maas && (!initialData.yevmiye || initialData.yevmiye === 0) ? 'aylik' : 'yevmiye'),
        gunlukCalismaSaati: initialData.gunlukCalismaSaati || 8,
        mesaiKatsayisi: initialData.mesaiKatsayisi !== undefined ? initialData.mesaiKatsayisi : 1.0,
        resmiMaas: initialData.resmiMaas !== undefined ? initialData.resmiMaas : 28075.5,
        eskiBakiye: initialDonemBakiyeleri.reduce((sum, b) => sum + (Number(b.tutar) || 0), 0),
        eskiBakiyeDonemi: fallbackDonem,
        donemBakiyeleri: initialDonemBakiyeleri,
        ucretGecmisi: initialUcretGecmisi,
      });
      setUcretGecmisiList(initialUcretGecmisi);
      setAylikResmiGunler(initialData.aylikResmiGunler ? { ...initialData.aylikResmiGunler } : {});
      setWageChangeScope('future_only');
      setWageChangeEffectiveDonem(defaultDonem);
      setWageChangeAciklama('');
      setShowWageHistory(false);
      setNewBakiyeDonem(defaultDonem);
      setNewBakiyeTutar('');
      setNewBakiyeAciklama('');
    } else {
      setFormData({
        isim: '',
        soyisim: '',
        TCNO: '',
        Iban1: '',
        Iban2: '',
        telefon: '',
        santiyeId: santiyeler[0]?.id || '',
        santiye: santiyeler[0]?.isim || '',
        ucretTipi: 'yevmiye',
        yevmiye: 1600,
        gunlukCalismaSaati: 8,
        mesaiKatsayisi: 1.0,
        resmiMaas: 28075.5,
        emekli: false,
        sigorta: true,
        maas: 48000,
        girisTarihi: getTodayDateString(),
        cikisTarihi: '',
        taseronId: '',
        taseron: '',
        durum: 'Aktif',
        kategori: 'Ahşap Ustası',
        link: '',
        resim: '',
        eskiBakiye: 0,
        eskiBakiyeDonemi: defaultDonem,
        donemBakiyeleri: [],
        ucretGecmisi: [],
      });
      setUcretGecmisiList([]);
      setAylikResmiGunler({});
      setWageChangeScope('future_only');
      setWageChangeEffectiveDonem(defaultDonem);
      setWageChangeAciklama('');
      setShowWageHistory(false);
      setNewBakiyeDonem(defaultDonem);
      setNewBakiyeTutar('');
      setNewBakiyeAciklama('');
    }
    setErrors({});
  }, [initialData, isOpen, santiyeler]);

  if (!isOpen) return null;

  const validate = () => {
    const err: Record<string, string> = {};
    if (!formData.isim?.trim()) err.isim = 'Ad alanı zorunludur';
    if (!formData.soyisim?.trim()) err.soyisim = 'Soyad alanı zorunludur';
    
    if (!trimmedTC) {
      err.TCNO = 'T.C. Kimlik No zorunludur';
    } else if (trimmedTC.length !== 11) {
      err.TCNO = 'T.C. Kimlik No 11 haneli olmalıdır';
    } else if (trimmedTC.startsWith('0')) {
      err.TCNO = 'T.C. Kimlik No 0 ile başlayamaz';
    } else if (duplicatePerson) {
      err.TCNO = `Bu T.C. Kimlik No zaten "${duplicatePerson.isim} ${duplicatePerson.soyisim}" personeline aittir. Aynı kişi tekrar kaydedilemez!`;
    }

    if (!formData.Iban1?.trim()) {
      err.Iban1 = 'En az 1 adet IBAN girilmelidir';
    }
    
    // Ücret tipi kontrolü: Aylık Sabit ise yevmiye girişi zorunlu DEĞİLDİR, sadece aylık maaş istenir.
    if (formData.ucretTipi === 'aylik') {
      if (!formData.maas || Number(formData.maas) <= 0) {
        err.maas = 'Geçerli bir aylık sabit maaş tutarı giriniz';
      }
    } else {
      if (!formData.yevmiye || Number(formData.yevmiye) <= 0) {
        err.yevmiye = 'Geçerli bir günlük yevmiye giriniz';
      }
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || duplicatePerson) return;

    const selectedSite = santiyeler.find((s) => s.id === formData.santiyeId);
    const selectedTaseron = taseronlar.find((t) => t.id === formData.taseronId);

    const isAylik = formData.ucretTipi === 'aylik';
    const rawMaas = Number(formData.maas) || 0;
    const rawYevmiye = Number(formData.yevmiye) || 0;

    // Aylık sabit ise yevmiye = maaş / 30; Yevmiyeli ise maaş = yevmiye * 30
    const finalMaas = isAylik ? rawMaas : (rawYevmiye > 0 ? rawYevmiye * 30 : rawMaas);
    const finalYevmiye = isAylik 
      ? (finalMaas > 0 ? Number((finalMaas / 30).toFixed(2)) : 0) 
      : rawYevmiye;

    // Eğer kullanıcının yeni bakiye kutusunda yazdığı ama "+ Dönem Bakiyesi Ekle" butonuna basmadan direkt "Kaydet"e bastığı bir tutar varsa onu da listeye dahil et
    let finalDonemBakiyeleri: PersonelDonemBakiye[] = [...(formData.donemBakiyeleri || [])].filter(
      (b) => b && b.donem && Number(b.tutar) !== 0
    );

    const pendingAmount = parseFloat(newBakiyeTutar);
    if (!isNaN(pendingAmount) && pendingAmount !== 0 && newBakiyeDonem) {
      const targetDonem = newBakiyeDonem.slice(0, 7);
      const existingIdx = finalDonemBakiyeleri.findIndex((b) => b.donem === targetDonem);
      if (existingIdx >= 0) {
        finalDonemBakiyeleri[existingIdx] = {
          ...finalDonemBakiyeleri[existingIdx],
          tutar: pendingAmount,
          aciklama: newBakiyeAciklama.trim() || finalDonemBakiyeleri[existingIdx].aciklama || 'Dönem Bakiyesi / Harcama',
        };
      } else {
        finalDonemBakiyeleri.push({
          id: `db-${targetDonem}-${Date.now()}`,
          donem: targetDonem,
          tutar: pendingAmount,
          aciklama: newBakiyeAciklama.trim() || 'Dönem Bakiyesi / Harcama',
        });
      }
    }

    // Döneme göre sırala (YYYY-MM)
    finalDonemBakiyeleri.sort((a, b) => a.donem.localeCompare(b.donem));

    const totalDonemBakiye = finalDonemBakiyeleri.reduce((sum, b) => sum + (Number(b.tutar) || 0), 0);
    const latestDonem =
      finalDonemBakiyeleri.length > 0
        ? finalDonemBakiyeleri[finalDonemBakiyeleri.length - 1].donem
        : formData.eskiBakiyeDonemi || '';

    // Ücret Değişikliği ve Kademe Geçmişi (p.ucretGecmisi) Derlemesi
    let finalUcretGecmisi: PersonelUcretGecmisi[] = [...ucretGecmisiList];

    if (initialData && hasWageChanged) {
      if (wageChangeScope === 'future_only') {
        const startDonem = wageChangeEffectiveDonem ? wageChangeEffectiveDonem.slice(0, 7) : getTodayDateString().slice(0, 7);

        // Önceki dönem (startDonem'den önceki) için temel başlangıç kademesi var mı?
        const hasEarlierBaseline = finalUcretGecmisi.some(
          (entry) => (entry.gecerlilikBaslangic || '').slice(0, 7) < startDonem
        );

        if (!hasEarlierBaseline) {
          const originalDonem =
            initialData.girisTarihi && initialData.girisTarihi.length >= 7
              ? initialData.girisTarihi.slice(0, 7)
              : '0000-01';

          finalUcretGecmisi.unshift({
            id: `ug-base-${originalDonem}`,
            gecerlilikBaslangic: originalDonem < startDonem ? originalDonem : '0000-01',
            ucretTipi: initialData.ucretTipi || 'yevmiye',
            yevmiye: originalYevmiye,
            maas: originalMaas,
            resmiMaas: initialData.resmiMaas,
            aciklama: 'Önceki Dönem Ücreti',
            degisiklikTarihi: getTodayDateString(),
          });
        }

        // Yeni dönem kaydını ekle veya güncelle
        const existingIdx = finalUcretGecmisi.findIndex(
          (entry) => (entry.gecerlilikBaslangic || '').slice(0, 7) === startDonem
        );

        const newRecord: PersonelUcretGecmisi = {
          id: existingIdx >= 0 ? finalUcretGecmisi[existingIdx].id : `ug-${startDonem}-${Date.now()}`,
          gecerlilikBaslangic: startDonem,
          ucretTipi: isAylik ? 'aylik' : 'yevmiye',
          yevmiye: finalYevmiye,
          maas: finalMaas,
          resmiMaas: formData.resmiMaas,
          aciklama: wageChangeAciklama.trim() || `${startDonem} Ücret Artışı / Değişikliği`,
          degisiklikTarihi: getTodayDateString(),
        };

        if (existingIdx >= 0) {
          finalUcretGecmisi[existingIdx] = newRecord;
        } else {
          finalUcretGecmisi.push(newRecord);
        }
      } else {
        // wageChangeScope === 'all_periods' (Tüm geçmiş dönemlere de yansıt)
        finalUcretGecmisi = [
          {
            id: `ug-all-${Date.now()}`,
            gecerlilikBaslangic: '0000-01',
            ucretTipi: isAylik ? 'aylik' : 'yevmiye',
            yevmiye: finalYevmiye,
            maas: finalMaas,
            resmiMaas: formData.resmiMaas,
            aciklama: 'Tüm Dönemler İçin Güncellendi (Geriye Dönük)',
            degisiklikTarihi: getTodayDateString(),
          },
        ];
      }
    } else if (!initialData) {
      // Yeni personel ilk kez oluşturuluyorsa
      const startDonem = formData.girisTarihi && formData.girisTarihi.length >= 7
        ? formData.girisTarihi.slice(0, 7)
        : getTodayDateString().slice(0, 7);

      finalUcretGecmisi = [
        {
          id: `ug-init-${Date.now()}`,
          gecerlilikBaslangic: startDonem,
          ucretTipi: isAylik ? 'aylik' : 'yevmiye',
          yevmiye: finalYevmiye,
          maas: finalMaas,
          resmiMaas: formData.resmiMaas,
          aciklama: 'İşe Giriş Başlangıç Ücreti',
          degisiklikTarihi: getTodayDateString(),
        },
      ];
    }

    finalUcretGecmisi.sort((a, b) => (a.gecerlilikBaslangic || '').localeCompare(b.gecerlilikBaslangic || ''));

    const personnelToSave: Personnel = {
      id: initialData?.id || `p-${Date.now()}`,
      isim: formData.isim?.trim() || '',
      soyisim: formData.soyisim?.trim() || '',
      TCNO: formData.TCNO?.trim() || '',
      Iban1: formData.Iban1?.replace(/\s+/g, '').toUpperCase() || '',
      Iban2: formData.Iban2 ? formData.Iban2.replace(/\s+/g, '').toUpperCase() : '',
      telefon: formData.telefon?.trim() || '',
      santiyeId: formData.santiyeId,
      santiye: selectedSite ? selectedSite.isim : formData.santiye,
      ucretTipi: isAylik ? 'aylik' : 'yevmiye',
      yevmiye: finalYevmiye,
      gunlukCalismaSaati: Number(formData.gunlukCalismaSaati) || 8,
      mesaiKatsayisi: formData.mesaiKatsayisi !== undefined ? Number(formData.mesaiKatsayisi) : 1.0,
      resmiMaas: formData.resmiMaas !== undefined ? Number(formData.resmiMaas) : 28075.5,
      emekli: Boolean(formData.emekli),
      sigorta: Boolean(formData.sigorta),
      maas: finalMaas,
      girisTarihi: formData.girisTarihi || getTodayDateString(),
      cikisTarihi: formData.cikisTarihi || '',
      taseronId: formData.taseronId,
      taseron: selectedTaseron ? selectedTaseron.isim : formData.taseron,
      durum: formData.durum || 'Aktif',
      kategori: formData.kategori || 'Ahşap Ustası',
      link: formData.link || '',
      resim: formData.resim || '',
      eskiBakiye: totalDonemBakiye,
      eskiBakiyeDonemi: latestDonem,
      donemBakiyeleri: finalDonemBakiyeleri,
      ucretGecmisi: finalUcretGecmisi,
      aylikResmiGunler: aylikResmiGunler,
    };

    onSave(personnelToSave);
    onClose();
  };

  const originalYevmiye = initialData ? Number(initialData.yevmiye) || 0 : 0;
  const originalMaas = initialData ? Number(initialData.maas) || (originalYevmiye * 30) : 0;
  const currentFormYevmiye = Number(formData.yevmiye) || 0;
  const currentFormMaas = Number(formData.maas) || (currentFormYevmiye * 30);
  const isFormAylik = formData.ucretTipi === 'aylik';
  const originalIsAylik = initialData
    ? initialData.ucretTipi === 'aylik' || Boolean(!initialData.ucretTipi && initialData.maas && (!initialData.yevmiye || initialData.yevmiye === 0))
    : false;

  const hasWageChanged = Boolean(
    initialData &&
    (
      Math.abs(currentFormYevmiye - originalYevmiye) > 0.01 ||
      Math.abs(currentFormMaas - originalMaas) > 0.01 ||
      isFormAylik !== originalIsAylik
    )
  );

  const handleAddCustomKademe = () => {
    if (!newKademeDonem) return;
    const yev = parseFloat(newKademeYevmiye);
    const maasVal = parseFloat(newKademeMaas);
    if ((isNaN(yev) || yev <= 0) && (isNaN(maasVal) || maasVal <= 0)) return;

    const donem = newKademeDonem.slice(0, 7);
    const calculatedYev = !isNaN(yev) && yev > 0 ? yev : (!isNaN(maasVal) ? Number((maasVal / 30).toFixed(2)) : 0);
    const calculatedMaas = !isNaN(maasVal) && maasVal > 0 ? maasVal : calculatedYev * 30;

    const newKademe: PersonelUcretGecmisi = {
      id: `ug-${donem}-${Date.now()}`,
      gecerlilikBaslangic: donem,
      ucretTipi: formData.ucretTipi || 'yevmiye',
      yevmiye: calculatedYev,
      maas: calculatedMaas,
      resmiMaas: formData.resmiMaas,
      aciklama: newKademeAciklama.trim() || `${donem} Ücret Artışı / Kademe`,
      degisiklikTarihi: getTodayDateString(),
    };

    setUcretGecmisiList((prev) => {
      const filtered = prev.filter((k) => (k.gecerlilikBaslangic || '').slice(0, 7) !== donem);
      const updated = [...filtered, newKademe];
      updated.sort((a, b) => (a.gecerlilikBaslangic || '').localeCompare(b.gecerlilikBaslangic || ''));
      return updated;
    });

    setNewKademeYevmiye('');
    setNewKademeMaas('');
    setNewKademeAciklama('');
  };

  const handleDeleteKademe = (id: string) => {
    setUcretGecmisiList((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        id="personnel-modal-container"
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <User className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {initialData ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Kartı Oluştur'}
              </h3>
              <p className="text-xs text-slate-500">
                Veritabanı Tablosu 1: Personel Kimlik, Şantiye, Maaş ve Banka Bilgileri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Bölüm 1: Temel Kimlik */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              1. Kimlik ve İletişim Bilgileri
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet"
                  value={formData.isim || ''}
                  onChange={(e) => setFormData({ ...formData, isim: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${
                    errors.isim ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-slate-900`}
                />
                {errors.isim && <p className="text-[11px] text-rose-500 mt-0.5">{errors.isim}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Soyadı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Yılmaz"
                  value={formData.soyisim || ''}
                  onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${
                    errors.soyisim ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-slate-900`}
                />
                {errors.soyisim && <p className="text-[11px] text-rose-500 mt-0.5">{errors.soyisim}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    T.C. Kimlik No <span className="text-rose-500">*</span>
                  </label>
                  {trimmedTC.length === 11 && !duplicatePerson && !trimmedTC.startsWith('0') && (
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tekil / Geçerli</span>
                    </span>
                  )}
                  {duplicatePerson && (
                    <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                      <span>⚠️ Mükerrer T.C. No!</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={11}
                  required
                  placeholder="11 Haneli TC Kimlik No"
                  value={formData.TCNO || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setFormData({ ...formData, TCNO: val });
                    if (errors.TCNO) {
                      setErrors((prev) => {
                        const rest = { ...prev };
                        delete rest.TCNO;
                        return rest;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm font-mono tracking-wider rounded-xl border transition-all ${
                    errors.TCNO || duplicatePerson
                      ? 'border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-300'
                      : trimmedTC.length === 11 && !trimmedTC.startsWith('0')
                      ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 ring-1 ring-emerald-300'
                      : 'border-slate-300 focus:ring-2 focus:ring-slate-900'
                  } focus:outline-hidden`}
                />
                {duplicatePerson ? (
                  <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-snug flex items-start gap-2 shadow-xs">
                    <span className="shrink-0 text-base leading-none">⛔</span>
                    <div>
                      <p className="font-bold text-rose-900">Mükerrer Personel Kaydı Engellendi!</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Bu T.C. Kimlik Numarası (<strong>{trimmedTC}</strong>) sistemde kayıtlı olan{' '}
                        <strong className="underline text-rose-900">{duplicatePerson.isim} {duplicatePerson.soyisim}</strong>{' '}
                        ({duplicatePerson.kategori || 'Personel'}{duplicatePerson.santiye ? ` • ${duplicatePerson.santiye}` : ''}) personeline aittir. Aynı kişi mükerrer olarak tekrar eklenemez.
                      </p>
                    </div>
                  </div>
                ) : errors.TCNO ? (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{errors.TCNO}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-0.5">Her personelin T.C. Kimlik Numarası sistemde tekil (unique) olmalıdır.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  placeholder="0532 123 45 67"
                  value={formData.telefon || ''}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Meslek / Kategori
                </label>
                <input
                  type="text"
                  placeholder="Örn: Kalıpçı, Demirci, Elektrikçi"
                  value={formData.kategori || ''}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Çalışma Durumu
                </label>
                <select
                  value={formData.durum || 'Aktif'}
                  onChange={(e) => setFormData({ ...formData, durum: e.target.value as 'Aktif' | 'Pasif' })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Aktif">Aktif Çalışıyor</option>
                  <option value="Pasif">Pasif / Çıkış Yapıldı</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bölüm 2: Banka ve IBAN Bilgileri */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              2. Banka & 2 Adet IBAN Numarası
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. IBAN Numarası <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  value={formData.Iban1 || ''}
                  onChange={(e) => setFormData({ ...formData, Iban1: e.target.value })}
                  className={`w-full px-3 py-2 text-sm font-mono uppercase rounded-xl border ${
                    errors.Iban1 ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-slate-900`}
                />
                {errors.Iban1 && <p className="text-[11px] text-rose-500 mt-0.5">{errors.Iban1}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. IBAN Numarası (Yedek / Ek Hesap)
                </label>
                <input
                  type="text"
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  value={formData.Iban2 || ''}
                  onChange={(e) => setFormData({ ...formData, Iban2: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono uppercase rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Bölüm 3: Şantiye & Taşeron İlişkisi */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              3. Görevli Şantiye ve Taşeron Seçimi
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bağlı Olduğu Şantiye
                </label>
                <select
                  value={formData.santiyeId || ''}
                  onChange={(e) => {
                    const s = santiyeler.find((site) => site.id === e.target.value);
                    setFormData({
                      ...formData,
                      santiyeId: e.target.value,
                      santiye: s ? s.isim : '',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">-- Şantiye Seçiniz --</option>
                  {santiyeler.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.isim} ({site.il})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Taşeron Firma
                </label>
                <select
                  value={formData.taseronId || ''}
                  onChange={(e) => {
                    const t = taseronlar.find((tas) => tas.id === e.target.value);
                    setFormData({
                      ...formData,
                      taseronId: e.target.value,
                      taseron: t ? t.isim : '',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">-- Şirket Bünyesi (Doğrudan) --</option>
                  {taseronlar.map((tas) => (
                    <option key={tas.id} value={tas.id}>
                      {tas.isim} ({tas.uzmanlik || 'Taşeron'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bölüm 4: Ücret Tipi, Yevmiye/Maaş & Çalışma Ayarları */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                4. Ücret Tipi, Maaş / Yevmiye & Çalışma Ayarları
              </span>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {formData.ucretTipi === 'aylik' ? '💼 Aylık Sabit Ücretli' : '👷 Günlük Yevmiyeli'}
              </span>
            </h4>

            {/* Ücret Tipi Seçici Kartları */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const currentYev = Number(formData.yevmiye) || 1600;
                  setFormData({
                    ...formData,
                    ucretTipi: 'yevmiye',
                    yevmiye: currentYev > 0 ? currentYev : 1600,
                    maas: (currentYev > 0 ? currentYev : 1600) * 30,
                  });
                  setErrors((prev) => {
                    const { maas, ...rest } = prev;
                    return rest;
                  });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  formData.ucretTipi !== 'aylik'
                    ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.ucretTipi !== 'aylik' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <HardHat className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900">Günlük Yevmiyeli</div>
                    {formData.ucretTipi !== 'aylik' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Çalıştığı gün başına yevmiye alır. Puantaj gününe göre hakediş hesaplanır (Usta, İşçi vb.).
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const currentMaas = Number(formData.maas) || (Number(formData.yevmiye) ? Number(formData.yevmiye) * 30 : 48000);
                  const newMaas = currentMaas > 0 ? currentMaas : 48000;
                  setFormData({
                    ...formData,
                    ucretTipi: 'aylik',
                    maas: newMaas,
                    yevmiye: Number((newMaas / 30).toFixed(2)),
                  });
                  setErrors((prev) => {
                    const { yevmiye, ...rest } = prev;
                    return rest;
                  });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  formData.ucretTipi === 'aylik'
                    ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.ucretTipi === 'aylik' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900">Aylık Sabit Ücretli</div>
                    {formData.ucretTipi === 'aylik' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Aylık sabit maaş alır. <b>Günlük yevmiye girmeye gerek yoktur</b> (Şef, Mimar, Formen, Bekçi vb.).
                  </div>
                </div>
              </button>
            </div>

            {/* Ücret Giriş Alanları */}
            {formData.ucretTipi === 'aylik' ? (
              /* AYLIK SABİT ÜCRETLİ: Günlük yevmiye girişine gerek yok! */
              <div className="bg-blue-50/40 p-3.5 rounded-xl border border-blue-200 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-blue-800 font-semibold mb-3">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Aylık sabit ücretli çalışan için <b>günlük yevmiye girişine gerek yoktur</b>. Yalnızca aylık sabit maaşı giriniz:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Aylık Sabit Maaş Girişi (ZORUNLU) */}
                  <div>
                    <label className="block text-xs font-bold text-blue-950 mb-1">
                      Aylık Sabit Maaş (₺) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={formData.maas === 0 ? '' : (formData.maas || '')}
                        onChange={(e) => {
                          const m = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            maas: m,
                            yevmiye: m > 0 ? Number((m / 30).toFixed(2)) : 0,
                          });
                        }}
                        placeholder="Örn: 50.000"
                        className={`w-full px-3.5 py-2.5 text-base font-bold text-blue-950 rounded-xl border ${
                          errors.maas ? 'border-rose-400 bg-rose-50/30' : 'border-blue-300 bg-white'
                        } focus:outline-hidden focus:ring-2 focus:ring-blue-600`}
                      />
                      <span className="absolute right-3 top-2.5 text-sm font-bold text-blue-400">₺ / ay</span>
                    </div>
                    {errors.maas && <p className="text-[11px] text-rose-500 font-medium mt-1">{errors.maas}</p>}

                    {/* Hızlı Maaş Butonları */}
                    <div className="mt-2 flex items-center flex-wrap gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">Hızlı:</span>
                      {[35000, 45000, 60000, 75000, 100000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              maas: amt,
                              yevmiye: Number((amt / 30).toFixed(2)),
                            })
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors cursor-pointer"
                        >
                          {amt.toLocaleString('tr-TR')} ₺
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Otomatik Günlük Yevmiye Karşılığı (Kullanıcı Girişi GEREKMEZ) */}
                  <div className="bg-white/80 p-3 rounded-xl border border-blue-100 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Otomatik Günlük Yevmiye Karşılığı (30 Güne Göre)
                      </div>
                      <div className="text-xl font-black text-slate-900 mt-1">
                        {formatCurrency(formData.maas ? Number(formData.maas) / 30 : 0)}
                        <span className="text-xs font-semibold text-slate-500 ml-1">/ gün</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex items-center gap-1 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Sistem tarafından otomatik hesaplanır. Manuel giriş gerekmez.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* GÜNLÜK YEVMİYELİ: Standart yevmiye girişi */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Günlük Yevmiye */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Günlük Yevmiye (₺) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      required
                      value={formData.yevmiye === 0 ? '' : (formData.yevmiye || '')}
                      onChange={(e) => {
                        const y = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          yevmiye: y,
                          maas: y * 30,
                        });
                      }}
                      placeholder="Örn: 1600"
                      className={`w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border ${
                        errors.yevmiye ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                      } focus:outline-hidden focus:ring-2 focus:ring-slate-900`}
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">₺ / gün</span>
                  </div>
                  {errors.yevmiye && <p className="text-[11px] text-rose-500 mt-0.5">{errors.yevmiye}</p>}

                  {/* Hızlı Yevmiye Butonları */}
                  <div className="mt-2 flex items-center flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">Hızlı:</span>
                    {[1250, 1500, 1750, 2000, 2500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            yevmiye: amt,
                            maas: amt * 30,
                          })
                        }
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        {amt.toLocaleString('tr-TR')} ₺
                      </button>
                    ))}
                  </div>
                </div>

                {/* 30 Günlük Karşılığı */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      30 Günlük Aylık Maaş Karşılığı
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {formatCurrency(Number(formData.yevmiye || 0) * 30)}
                      <span className="text-xs font-semibold text-slate-500 ml-1">/ ay</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">Yevmiye × 30 gün karşılığıdır.</span>
                </div>
              </div>
            )}

            {/* Ücret Değişikliği Tespiti & Önceki Dönemlere Yansıma Seçeneği */}
            {hasWageChanged && (
              <div className="mb-4 p-4 rounded-xl border border-amber-300 bg-amber-50/80 shadow-xs space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <span>⚡ Personel Ücretinde Değişiklik Tespit Edildi</span>
                      </span>
                      <div className="text-[11px] font-mono bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 text-amber-900">
                        <span className="line-through text-slate-400">
                          {formatCurrency(originalIsAylik ? originalMaas : originalYevmiye)}
                          {originalIsAylik ? '/ay' : '/gün'}
                        </span>
                        <span className="mx-1.5 font-bold text-amber-700">➔</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(isFormAylik ? currentFormMaas : currentFormYevmiye)}
                          {isFormAylik ? '/ay' : '/gün'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                      Yeni ücretin önceki dönem hakediş ve alacaklarına nasıl yansıyacağını seçiniz:
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-amber-200/80">
                  {/* Seçenek 1: Sadece İleriki Aylara Yansıt (Tavsiye Edilen) */}
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      wageChangeScope === 'future_only'
                        ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white/60 border-amber-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="wageChangeScope"
                        checked={wageChangeScope === 'future_only'}
                        onChange={() => setWageChangeScope('future_only')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            Önceki Dönem Alacaklarına Yansıtma (Sadece Seçilen Aydan İtibaren Geçerli Olsun)
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Tavsiye Edilen
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          Geçmiş dönemlerin hakedişleri ve sıfırlanmış hesapları (örn. Eylül ayı ve öncesi) personelin o dönemki eski ücretiyle ({formatCurrency(originalIsAylik ? originalMaas : originalYevmiye)}) sabit kalır, bozulmaz. Yeni ücret yalnızca belirttiğiniz başlangıç ayından itibaren uygulanır.
                        </p>

                        {/* Geçerlilik Başlangıç Dönemi ve Açıklama Kutusu */}
                        {wageChangeScope === 'future_only' && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/40 p-2.5 rounded-lg border border-amber-200/60">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                                Geçerlilik Başlangıç Dönemi (Ay) <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="month"
                                required
                                value={wageChangeEffectiveDonem}
                                onChange={(e) => setWageChangeEffectiveDonem(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="text-[10px] text-slate-500 mt-1 block">
                                Bu aydan (örn: {wageChangeEffectiveDonem}) önceki tüm aylar eski ücrette kalır.
                              </span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-800 mb-1">
                                Değişiklik / Zam Açıklaması
                              </label>
                              <input
                                type="text"
                                placeholder="Örn: Ekim 2026 Ücret Artışı"
                                value={wageChangeAciklama}
                                onChange={(e) => setWageChangeAciklama(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                              />
                              <span className="text-[10px] text-slate-500 mt-1 block">
                                Bordro ve raporlarda görüntülenecek açıklama.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </label>

                  {/* Seçenek 2: Tüm Dönemlere ve Geçmiş Aylara da Yansıt */}
                  <label
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      wageChangeScope === 'all_periods'
                        ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-white/60 border-amber-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="wageChangeScope"
                        checked={wageChangeScope === 'all_periods'}
                        onChange={() => setWageChangeScope('all_periods')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-900">
                          Tüm Dönemlere ve Geçmiş Aylara da Yansıt (Geriye Dönük Güncelle)
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          Yeni ücret ({formatCurrency(isFormAylik ? currentFormMaas : currentFormYevmiye)}), personelin geçmişteki tüm çalışma aylarına da uygulanır ve önceki dönem hakedişleri yeni tutara göre geriye dönük yeniden hesaplanır.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Ücret & Maaş Değişiklik Tarihçesi (Kademe Listesi Accordion) */}
            <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowWageHistory(!showWageHistory)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ücret & Maaş Değişiklik Geçmişi</span>
                  {ucretGecmisiList.length > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                      {ucretGecmisiList.length} Kademe Kayıtlı
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span>{showWageHistory ? 'Gizle' : 'Kayıtları Gör & Yönet'}</span>
                  {showWageHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {showWageHistory && (
                <div className="p-3.5 border-t border-slate-200 bg-white space-y-3">
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Personelin farklı dönemlerde aldığı yevmiye ve maaşlar aşağıda listelenmiştir. Her dönem, kendi başlangıç ayından sonraki bir sonraki kademeye kadar geçerli olur.
                  </p>

                  {ucretGecmisiList.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      Henüz geçmiş ücret kademesi bulunmuyor. Personel güncel ücret üzerinden hesaplanmaktadır.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {ucretGecmisiList.map((kademe, idx) => (
                        <div
                          key={kademe.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/70 text-xs"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
                              {kademe.gecerlilikBaslangic}
                            </span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(kademe.yevmiye)} / gün
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              ({formatCurrency(kademe.maas || kademe.yevmiye * 30)}/ay)
                            </span>
                            {kademe.aciklama && (
                              <span className="text-[11px] text-slate-500 italic max-w-[200px] truncate">
                                • {kademe.aciklama}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteKademe(kademe.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Bu kademeyi sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Yeni Özel Kademe Ekleme Satırı */}
                  <div className="pt-2 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg">
                    <div className="text-[11px] font-bold text-slate-700 mb-2">
                      + Belirli Bir Dönem İçin Yeni Ücret Kademesi Ekle:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="month"
                        value={newKademeDonem}
                        onChange={(e) => setNewKademeDonem(e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                        placeholder="Başlangıç Ayı"
                      />
                      <input
                        type="number"
                        placeholder="Günlük Yevmiye (₺)"
                        value={newKademeYevmiye}
                        onChange={(e) => {
                          const y = e.target.value;
                          setNewKademeYevmiye(y);
                          const num = parseFloat(y);
                          if (!isNaN(num) && num > 0) {
                            setNewKademeMaas(String(num * 30));
                          }
                        }}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Açıklama (Opsiyonel)"
                        value={newKademeAciklama}
                        onChange={(e) => setNewKademeAciklama(e.target.value)}
                        className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomKademe}
                        disabled={!newKademeDonem || (!newKademeYevmiye && !newKademeMaas)}
                        className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Kademe Ekle</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Çalışma Saati ve Mesai Katsayısı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Günlük Çalışma Saati */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  1 Gün Kaç Saat? (Varsayılan: 8)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={24}
                    step={1}
                    value={formData.gunlukCalismaSaati || 8}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gunlukCalismaSaati: Number(e.target.value) || 8,
                      })
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Saat / Gün</span>
                </div>
              </div>

              {/* Mesai Katsayısı */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  Mesai Katsayısı (1 Saate Kaç Saat?)
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  value={formData.mesaiKatsayisi !== undefined ? formData.mesaiKatsayisi : 1.0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mesaiKatsayisi: Number(e.target.value) || 1.0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-blue-300 bg-blue-50/30 text-blue-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Katsayı Hızlı Seçim Butonları */}
            <div className="mt-2.5 flex items-center flex-wrap gap-2">
              <span className="text-xs text-slate-500 font-medium">Hızlı Katsayı:</span>
              {[
                { val: 1.0, label: '1.0x (1 Saate 1 Saat - Standart)' },
                { val: 1.25, label: '1.25x (%25 Fazla)' },
                { val: 1.5, label: '1.5x (1 Saate 1.5 Saat)' },
                { val: 2.0, label: '2.0x (2 Katı)' },
              ].map((opt) => {
                const isSelected = (formData.mesaiKatsayisi !== undefined ? formData.mesaiKatsayisi : 1.0) === opt.val;
                return (
                  <button
                    type="button"
                    key={opt.val}
                    onClick={() => setFormData({ ...formData, mesaiKatsayisi: opt.val })}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Canlı Mesai Hesaplama Simülasyon Kutusu */}
            {(() => {
              const isAylik = formData.ucretTipi === 'aylik';
              const effectiveYev = isAylik 
                ? (formData.maas ? Number(formData.maas) / 30 : 0)
                : (Number(formData.yevmiye) || 0);
              const hours = Number(formData.gunlukCalismaSaati) || 8;
              const katsayi = formData.mesaiKatsayisi !== undefined ? Number(formData.mesaiKatsayisi) : 1.0;
              const hourly = hours > 0 ? effectiveYev / hours : 0;
              const sampleHours = 4;
              const sampleMesaiFee = sampleHours * hourly * katsayi;
              const sampleTotal = effectiveYev + sampleMesaiFee;

              return (
                <div className="mt-3.5 bg-slate-900 text-slate-100 rounded-xl p-3.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5" />
                      Mesai Hesaplama Formülü & Canlı Simülasyon ({isAylik ? 'Aylık Sabit' : 'Günlük Yevmiyeli'})
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      1 gün = {hours} saat | Katsayı: {katsayi}x
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2 font-mono">
                    <div className="bg-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Saatlik Ücret</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {formatCurrency(hourly)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({effectiveYev.toFixed(0)}₺/{hours}s)
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Mesai Katsayısı</div>
                      <div className="text-sm font-bold text-blue-400 mt-0.5">
                        {katsayi}x
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({katsayi === 1.0 ? '1 saate 1 saat' : `1 saate ${katsayi} saat`})
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-800/80 p-2 rounded-lg">
                      <div className="text-[10px] text-slate-400 uppercase">Örnek 4 Saat Mesai</div>
                      <div className="text-sm font-bold text-amber-300 mt-0.5">
                        {formatCurrency(sampleMesaiFee)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          (4 × {hourly.toFixed(0)} × {katsayi})
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-800/80 p-2 rounded-lg border border-emerald-500/30">
                      <div className="text-[10px] text-emerald-400 uppercase font-semibold">1 Gün + 4s Toplam</div>
                      <div className="text-sm font-bold text-emerald-300 mt-0.5">
                        {formatCurrency(sampleTotal)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({effectiveYev.toFixed(0)} + {sampleMesaiFee.toFixed(0)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sigorta, Emekli ve Resmi Banka Matrahı */}
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              {/* Resmi Maaş (Asgari Ücret Matrahı) */}
              <div className="lg:col-span-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-indigo-950">
                    Aylık Resmi Maaş (₺)
                  </label>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-1.5 py-0.5 rounded">
                    Resmi Banka Matrahı
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={formData.resmiMaas === 0 ? '' : (formData.resmiMaas !== undefined ? formData.resmiMaas : 28075.5)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, resmiMaas: val === '' ? 0 : parseFloat(val) || 0 });
                    }}
                    placeholder="28075.50"
                    className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600 text-indigo-950"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, resmiMaas: 28075.5 })}
                    className="px-2.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    title="Resmi Asgari Ücret Uygula (28.075,50 ₺)"
                  >
                    28.075,50 ₺
                  </button>
                </div>
                <p className="text-[11px] text-indigo-700/80 mt-1 leading-tight">
                  Puantajdaki her çalışılan gün için yevmiyesinden <b>resmi maaş / 30</b> kesinti yapılacak ve ay sonunda bankadan resmi olarak ödenecektir.
                </p>
              </div>

              {/* Sigorta ve Emekli Onayları */}
              <div className="flex flex-col justify-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.sigorta)}
                    onChange={(e) => setFormData({ ...formData, sigorta: e.target.checked })}
                    className="w-4 h-4 text-slate-900 rounded-md border-slate-300 focus:ring-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    SGK Sigortalı
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.emekli)}
                    onChange={(e) => setFormData({ ...formData, emekli: e.target.checked })}
                    className="w-4 h-4 text-slate-900 rounded-md border-slate-300 focus:ring-slate-900"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Emekli Personel
                  </span>
                </label>
              </div>
            </div>

            {/* Canlı Günlük Resmi Kesinti ve Elden Alacak Ayrımı Paneli */}
            {(() => {
              const isAylik = formData.ucretTipi === 'aylik';
              const yev = isAylik
                ? (formData.maas ? Number(formData.maas) / 30 : 0)
                : (Number(formData.yevmiye) || 0);
              const rMaas = Number(formData.resmiMaas) || 0;
              const gunlukResmiKesinti = rMaas > 0 ? rMaas / 30 : 0;
              const gunlukEldenPay = Math.max(0, yev - gunlukResmiKesinti);
              const totalMonthly = isAylik ? Number(formData.maas || 0) : yev * 30;
              const monthlyEldenPay = Math.max(0, totalMonthly - rMaas);

              return (
                <div className="mt-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-slate-100 rounded-xl p-3 text-xs border border-indigo-900/50">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-900/60 flex-wrap gap-1">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Resmi Banka Kesintisi & Elden Hakediş Dağılımı ({isAylik ? 'Aylık Sabit' : 'Günlük Yevmiyeli'})
                    </span>
                    <span className="text-[11px] text-slate-300 font-mono">
                      {isAylik ? `Aylık: ${formatCurrency(totalMonthly)}` : `Yevmiye: ${formatCurrency(yev)}`} | Resmi Banka: {formatCurrency(rMaas)}/ay
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                    <div className="bg-indigo-900/40 p-2 rounded-lg border border-indigo-500/20">
                      <div className="text-[10px] text-indigo-300 uppercase font-semibold">
                        Resmi Banka Ödemesi
                      </div>
                      <div className="text-sm font-bold text-emerald-300 mt-0.5">
                        {formatCurrency(rMaas)} / ay
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        Günlük kesinti: {formatCurrency(gunlukResmiKesinti)} • Ay sonu bankadan
                      </div>
                    </div>

                    <div className="bg-indigo-900/40 p-2 rounded-lg border border-indigo-500/20">
                      <div className="text-[10px] text-amber-300 uppercase font-semibold">
                        Elden / Kasa Hakedişi
                      </div>
                      <div className="text-sm font-bold text-amber-200 mt-0.5">
                        {formatCurrency(monthlyEldenPay)} / ay
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        Günlük elden pay: {formatCurrency(gunlukEldenPay)} • Elden ödenir
                      </div>
                    </div>

                    <div className="bg-indigo-900/40 p-2 rounded-lg border border-indigo-500/20">
                      <div className="text-[10px] text-slate-300 uppercase font-semibold">
                        Toplam Aylık Ücret
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {formatCurrency(totalMonthly)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {isAylik ? 'Aylık sabit sözleşme' : '30 tam gün karşılığı'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Aylık Resmi Çalışma Günü (SGK Günleri) Manuel Belirleme Alanı */}
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
              <div
                onClick={() => setShowResmiGunSettings((prev) => !prev)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-indigo-100/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950">
                    Aylık Resmi Çalışma Günü (SGK Günleri) Manuel Ayarı
                  </span>
                  {Object.keys(aylikResmiGunler).length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-md">
                      {Object.keys(aylikResmiGunler).length} Dönem Tanımlı
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-indigo-700">
                  {showResmiGunSettings ? 'Gizle ▲' : 'Aylık Resmi Gün Belirle ▼'}
                </span>
              </div>

              {showResmiGunSettings && (
                <div className="p-4 pt-2 border-t border-indigo-200/60 space-y-3 bg-white/70">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Normalde personelin o aydaki <b>puantaj çalışma günü</b> kadar resmi maaş kesintisi hesaplanır. Ancak belirli bir ayda SGK/Resmi çalışma gününü puantajdan bağımsız olarak (örn: 30 gün tam veya 15 gün) manuel belirlemek isterseniz buradan ekleyebilirsiniz.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Dönem (Ay / Yıl)
                      </label>
                      <input
                        type="month"
                        value={newResmiGunDonem}
                        onChange={(e) => setNewResmiGunDonem(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Resmi Çalışma Günü (0 - 30)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        step="0.5"
                        value={newResmiGunTutar}
                        onChange={(e) => setNewResmiGunTutar(e.target.value)}
                        placeholder="Örn: 30"
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddOrUpdateResmiGun}
                        className="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Dönem Resmi Günü Ekle/Güncelle</span>
                      </button>
                    </div>
                  </div>

                  {Object.keys(aylikResmiGunler).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {Object.entries(aylikResmiGunler)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([donem, gun]) => (
                          <div
                            key={donem}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs"
                          >
                            <span className="font-mono font-bold text-indigo-950">{donem}:</span>
                            <span className="font-mono font-bold text-emerald-700">{gun} Gün</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteResmiGun(donem)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                              title="Bu ayın manuel resmi gün ayarını kaldır (Otomatik puantaja dön)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bölüm 5: Dönem Bazlı Eski Kalan Bakiye & Aylık Harcama / Devreden Alacak Girişi */}
          <div className="pt-2 border-t border-slate-100">
            {(() => {
              const currentList = formData.donemBakiyeleri || [];
              const totalBakiye = currentList.reduce((sum, item) => sum + (Number(item.tutar) || 0), 0);

              const handleAddOrUpdateDonemBakiye = () => {
                const parsedTutar = parseFloat(newBakiyeTutar);
                if (isNaN(parsedTutar) || parsedTutar === 0 || !newBakiyeDonem) return;
                const targetDonem = newBakiyeDonem.slice(0, 7);
                const updated = [...currentList];
                const existingIdx = updated.findIndex((x) => x.donem === targetDonem);

                if (existingIdx >= 0) {
                  updated[existingIdx] = {
                    ...updated[existingIdx],
                    tutar: parsedTutar,
                    aciklama: newBakiyeAciklama.trim() || updated[existingIdx].aciklama || 'Dönem Bakiyesi / Elden Harcama',
                  };
                } else {
                  updated.push({
                    id: `db-${targetDonem}-${Date.now()}`,
                    donem: targetDonem,
                    tutar: parsedTutar,
                    aciklama: newBakiyeAciklama.trim() || 'Dönem Bakiyesi / Elden Harcama',
                  });
                }

                updated.sort((a, b) => a.donem.localeCompare(b.donem));
                const newTotal = updated.reduce((s, x) => s + (Number(x.tutar) || 0), 0);

                setFormData({
                  ...formData,
                  donemBakiyeleri: updated,
                  eskiBakiye: newTotal,
                  eskiBakiyeDonemi: targetDonem,
                });
                setNewBakiyeTutar('');
                setNewBakiyeAciklama('');
              };

              const handleRemoveDonemBakiye = (donemToRemove: string) => {
                const updated = currentList.filter((x) => x.donem !== donemToRemove);
                const newTotal = updated.reduce((s, x) => s + (Number(x.tutar) || 0), 0);
                setFormData({
                  ...formData,
                  donemBakiyeleri: updated,
                  eskiBakiye: newTotal,
                  eskiBakiyeDonemi: updated.length > 0 ? updated[updated.length - 1].donem : '',
                });
              };

              const handleUpdateRowAmount = (donemToUpdate: string, newAmountStr: string) => {
                const val = newAmountStr === '' ? 0 : parseFloat(newAmountStr) || 0;
                const updated = currentList.map((x) =>
                  x.donem === donemToUpdate ? { ...x, tutar: val } : x
                );
                const newTotal = updated.reduce((s, x) => s + (Number(x.tutar) || 0), 0);
                setFormData({
                  ...formData,
                  donemBakiyeleri: updated,
                  eskiBakiye: newTotal,
                });
              };

              return (
                <>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-amber-500" />
                      5. Eski Kalan Bakiye & Aylık Harcama / Devreden Alacaklar (Her Ay Ayrı Dönem)
                    </span>
                    {currentList.length > 0 ? (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                          totalBakiye > 0
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : totalBakiye < 0
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-slate-600 bg-slate-100 border-slate-200'
                        }`}
                      >
                        {currentList.length} Dönem Kayıtlı • Toplam:{' '}
                        {totalBakiye > 0 ? '+' : ''}
                        {formatCurrency(totalBakiye)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        Kayıtlı Dönem Bakiyesi Yok (0,00 ₺)
                      </span>
                    )}
                  </h4>

                  <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 space-y-4">
                    {/* Yeni Dönem Bakiyesi Ekleme Formu */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-amber-600" />
                          Yeni Dönem (Ay / Yıl) Bakiyesi veya Elden Harcama Ekle
                        </span>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                          Her ay için ayrı bakiye tanımlanabilir (Örn: Eylül ayrı, Ekim ayrı)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* 1. Ait Olduğu Dönem (Ay / Yıl) */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Ait Olduğu Dönem (Ay)
                          </label>
                          <input
                            type="month"
                            value={newBakiyeDonem}
                            onChange={(e) => setNewBakiyeDonem(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs font-bold text-slate-900 rounded-xl border border-amber-300 bg-amber-50/30 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* 2. Bakiye / Harcama Tutarı (₺) */}
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Bakiye / Harcama Tutarı (₺)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={newBakiyeTutar}
                              onChange={(e) => setNewBakiyeTutar(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddOrUpdateDonemBakiye();
                                }
                              }}
                              placeholder="Örn: 4500"
                              className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                            />
                            <span className="absolute right-2.5 top-2 text-xs font-bold text-amber-600">₺</span>
                          </div>
                        </div>

                        {/* 3. Açıklama (Opsiyonel) */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Açıklama (İsteğe Bağlı)
                          </label>
                          <input
                            type="text"
                            value={newBakiyeAciklama}
                            onChange={(e) => setNewBakiyeAciklama(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddOrUpdateDonemBakiye();
                              }
                            }}
                            placeholder="Örn: Cebinden harcama / Devir"
                            className="w-full px-2.5 py-2 text-xs text-slate-800 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* 4. Ekle Butonu */}
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={handleAddOrUpdateDonemBakiye}
                            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{currentList.some((x) => x.donem === newBakiyeDonem) ? 'Güncelle' : 'Ekle'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Yön (+ Alacaklı / - Borçlu) Hızlı Butonları */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-500 font-medium">Tutar Yönü:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = Math.abs(parseFloat(newBakiyeTutar) || 0);
                              if (cur > 0) setNewBakiyeTutar(String(cur));
                            }}
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                              (parseFloat(newBakiyeTutar) || 0) >= 0
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            + Alacaklı (Cebinden Harcama / Devir Alacak)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = Math.abs(parseFloat(newBakiyeTutar) || 0);
                              setNewBakiyeTutar(cur > 0 ? String(-cur) : '-1000');
                            }}
                            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                              (parseFloat(newBakiyeTutar) || 0) < 0
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                            }`}
                          >
                            - Borçlu (Devreden Avans Borcu)
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          İpucu: Eylül için <b>2026-09</b> seçip Ekle&apos;ye basın, ardından Ekim için <b>2026-10</b> seçip yeni tutarı ekleyin.
                        </span>
                      </div>
                    </div>

                    {/* Kayıtlı Dönem Bakiyeleri Listesi (Eylül, Ekim, Kasım vb. Ayrı Ayrı) */}
                    {currentList.length > 0 ? (
                      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                        <div className="px-3.5 py-2 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950">
                            Tanımlanmış Dönem Bakiyeleri (Her Dönem Kendi Ayında Elden Ödemeye Eklenir)
                          </span>
                          <span className="text-[11px] font-semibold text-amber-800">
                            Toplam {currentList.length} Ay
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {currentList.map((item) => {
                            const isPositive = Number(item.tutar) >= 0;
                            return (
                              <div
                                key={item.id || item.donem}
                                className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors flex-wrap sm:flex-nowrap"
                              >
                                <div className="flex items-center gap-2.5 min-w-[140px]">
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                    {item.donem}
                                  </span>
                                  <div>
                                    <div className="text-xs font-bold text-slate-800">
                                      {item.aciklama || 'Dönem Bakiyesi / Harcama'}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      Yalnızca <b>{item.donem}</b> elden ödemesine yansır
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 ml-auto">
                                  <div className="relative w-36">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.tutar === 0 ? '' : item.tutar}
                                      onChange={(e) => handleUpdateRowAmount(item.donem, e.target.value)}
                                      className={`w-full px-2.5 py-1 text-xs font-bold font-mono rounded-lg border ${
                                        isPositive
                                          ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900'
                                          : 'border-rose-300 bg-rose-50/40 text-rose-900'
                                      } focus:outline-hidden focus:ring-2 focus:ring-amber-500`}
                                    />
                                    <span className="absolute right-2 top-1 text-[11px] font-bold text-slate-500">
                                      ₺
                                    </span>
                                  </div>

                                  <span
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap ${
                                      isPositive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    {isPositive ? '+ Alacak' : '- Borç'}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDonemBakiye(item.donem)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title={`${item.donem} dönem bakiyesini sil`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/80 p-3 rounded-xl border border-amber-200/70 text-xs text-slate-600 flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Henüz dönem bazlı bakiye eklenmedi. Yukarıdan <b>Ait Olduğu Dönem (örn. 2026-09, 2026-10)</b> ve tutar girip <b>Ekle</b> butonuna basarak her ay için ayrı bakiye tanımlayabilirsiniz.
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Bölüm 6: Giriş / Çıkış Tarihi, Doküman ve Fotoğraf */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              6. Tarihler, Belge Linki ve Resim
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  İşe Giriş Tarihi
                </label>
                <input
                  type="date"
                  value={formData.girisTarihi || ''}
                  onChange={(e) => setFormData({ ...formData, girisTarihi: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  İşten Çıkış Tarihi (Varsa)
                </label>
                <input
                  type="date"
                  value={formData.cikisTarihi || ''}
                  onChange={(e) => setFormData({ ...formData, cikisTarihi: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3 text-slate-400" />
                  Evrak / Sözleşme / Arşiv Linki
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.link || ''}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-slate-400" />
                  Profil Resmi / Fotoğraf URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.resim || ''}
                  onChange={(e) => setFormData({ ...formData, resim: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {initialData ? 'Değişiklikleri Kaydet' : 'Personeli Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
