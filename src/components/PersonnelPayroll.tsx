import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  DollarSign, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Calendar, 
  Clock, 
  Trash2, 
  CheckCircle,
  FileSpreadsheet,
  Search,
  Building,
  Banknote,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  Building2,
  Sparkles,
  AlertCircle,
  Pencil,
  Tag,
  RotateCcw,
  Edit3,
  X,
  Check,
  Briefcase,
  HardHat,
  Landmark,
  BarChart3,
  PieChart
} from 'lucide-react';
import { 
  Personnel, 
  Puantaj, 
  Mesai, 
  PersonelOdeme, 
  CALISMA_DURUMU_CONFIG, 
  OdemeYontemi, 
  PersonelHakedis, 
  Taseron, 
  Santiye, 
  SantiyeGider, 
  Firma, 
  FirmaCari,
  Cek
} from '../types';
import { 
  formatCurrency, 
  getTodayDateString, 
  DEFAULT_HAKEDIS_TURLERI, 
  getSavedHakedisTurleri, 
  saveHakedisTurleri 
} from '../utils/storage';
import { 
  getEffectiveEskiBakiyeForMonth, 
  calculateEffectivePuantajGunForMonth,
  getEffectiveWageForPersonnel,
  getEffectiveResmiGunForMonth,
  isOdemeInBordroDonemi,
  getOdemeBordroDonemi
} from '../utils/personnelBalance';
import { EditPersonelOdemeModal, EditTaseronOdemeModal } from './EditPaymentModal';
import { CurrencySelector } from './CurrencySelector';
import { CurrenciesModal } from './CurrenciesModal';
import { ExportButton } from './ExportButton';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ExportOptions } from '../utils/exportUtils';
import { 
  getSavedExchangeRates, 
  convertCurrencyToTRY, 
  getCurrencyExchangeRate 
} from '../utils/currencyStore';
import { TrendingUp, Coins } from 'lucide-react';

export interface PersonelHakedisCalculated {
  personnel: Personnel;
  puantajGun: number;
  resmiGun: number;
  isManualResmiGun?: boolean;
  mesaiSaat: number;
  dailyHours: number;
  hourlyWage: number;
  katsayi: number;
  mesaiTutari: number;
  tabanHakedis: number;
  yevmiye: number;
  isAylik?: boolean;
  effectiveMaas?: number;
  resmiMaas: number;
  gunlukResmiKesinti: number;
  gunlukEldenTutar: number;
  toplamHakedis: number;
  resmiAlacak: number;
  eldenHakedis: number;
  toplamAvans: number;
  toplamResmiOdeme: number;
  kalanResmiOdeme: number;
  kalanEldenOdeme: number;
  toplamHarcama: number;
  toplamCeza: number;
  eskiBakiye: number;
  netHakedis: number;
}

interface PersonnelPayrollProps {
  personnelList: Personnel[];
  puantajList: Puantaj[];
  mesaiList: Mesai[];
  odemeList: PersonelOdeme[];
  odemeYontemleri: OdemeYontemi[];
  taseronlar?: Taseron[];
  santiyeler?: Santiye[];
  giderler?: SantiyeGider[];
  firmalar?: Firma[];
  cariList?: FirmaCari[];
  activeSubTab?: 'hakedis' | 'taseron' | 'odemeler' | 'analiz';
  onChangeSubTab?: (subTab: 'hakedis' | 'taseron' | 'odemeler' | 'analiz') => void;
  onNavigateToCompanies?: (firmaId?: string) => void;
  onUpdatePersonnel?: (personnel: Personnel) => void;
  onAddOdeme: (odeme: PersonelOdeme, cariHareket?: FirmaCari) => void;
  onAddBulkOdeme?: (odemeler: PersonelOdeme[], cariHareket?: FirmaCari) => void;
  onUpdateOdeme?: (odeme: PersonelOdeme) => void;
  onDeleteOdeme: (id: string) => void;
  onAddGider?: (gider: SantiyeGider, cariHareket?: FirmaCari) => void;
  onUpdateGider?: (gider: SantiyeGider, cariHareket?: FirmaCari) => void;
  onDeleteGider?: (id: string) => void;
  onDeleteCariHareket?: (id: string) => void;
  cekler?: Cek[];
  onAddCek?: (cek: Cek, cariHareket?: FirmaCari, ciroCariHareket?: FirmaCari) => void;
  onDeleteCek?: (id: string) => void;
}

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

export const PersonnelPayroll: React.FC<PersonnelPayrollProps> = ({
  personnelList,
  puantajList,
  mesaiList,
  odemeList,
  odemeYontemleri,
  taseronlar = [],
  santiyeler = [],
  giderler = [],
  firmalar = [],
  cariList = [],
  cekler = [],
  activeSubTab: controlledSubTab,
  onChangeSubTab,
  onNavigateToCompanies,
  onUpdatePersonnel,
  onAddOdeme,
  onAddBulkOdeme,
  onUpdateOdeme,
  onDeleteOdeme,
  onAddGider,
  onUpdateGider,
  onDeleteGider,
  onDeleteCariHareket,
  onAddCek,
  onDeleteCek,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const [internalSubTab, setInternalSubTab] = useState<'hakedis' | 'taseron' | 'odemeler' | 'analiz'>('hakedis');
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = (tab: 'hakedis' | 'taseron' | 'odemeler' | 'analiz') => {
    setInternalSubTab(tab);
    if (onChangeSubTab) onChangeSubTab(tab);
  };
  const [wageTypeFilter, setWageTypeFilter] = useState<'all' | 'aylik' | 'yevmiye'>('all');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTaseronPaymentModalOpen, setIsTaseronPaymentModalOpen] = useState(false);
  const [selectedTaseronIdForModal, setSelectedTaseronIdForModal] = useState<string>('');
  const [taseronPaymentMode, setTaseronPaymentMode] = useState<'group' | 'extra'>('group');
  const [expandedTaseronIds, setExpandedTaseronIds] = useState<Record<string, boolean>>({});

  // Editing states for payments
  const [editingPersonelOdeme, setEditingPersonelOdeme] = useState<PersonelOdeme | null>(null);
  const [editingTaseronGider, setEditingTaseronGider] = useState<SantiyeGider | null>(null);
  const [odemelerTableCategory, setOdemelerTableCategory] = useState<'all' | 'personnel' | 'taseron'>('all');
  const [selectedTaseronFilter, setSelectedTaseronFilter] = useState<string>('all');
  const [odemelerMonthFilter, setOdemelerMonthFilter] = useState<string>('all');

  // Silme Onay Modalı Durumu
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    personName?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'Kaydı Sil',
    onConfirm: () => {},
  });

  // Subcontractor group distribution payment states (Option 1: Ekibe Dağıtımlı)
  const [groupWorkerPayments, setGroupWorkerPayments] = useState<Record<string, { resmi: number; elden: number }>>({});
  const [groupPaymentDate, setGroupPaymentDate] = useState<string>(getTodayDateString());
  const [groupPaymentTime, setGroupPaymentTime] = useState<string>('14:00');
  const [groupPaymentMethod, setGroupPaymentMethod] = useState<string>(odemeYontemleri[0]?.isim || 'Nakit Şantiye Kasası');
  const [groupPaymentNote, setGroupPaymentNote] = useState<string>('');

  // Hakediş / Ödeme Türleri State & Yönetimi
  const [hakedisTurleri, setHakedisTurleri] = useState<string[]>(() => getSavedHakedisTurleri());
  const [isManageHakedisTurleriOpen, setIsManageHakedisTurleriOpen] = useState(false);
  const [newHakedisTuruInput, setNewHakedisTuruInput] = useState('');
  const [editingTurIndex, setEditingTurIndex] = useState<number | null>(null);
  const [editingTurValue, setEditingTurValue] = useState('');

  const handleAddNewHakedisTuru = (customName?: string) => {
    const val = (customName || newHakedisTuruInput).trim();
    if (!val) return;
    if (hakedisTurleri.some((t) => t.toLowerCase() === val.toLowerCase())) {
      alert('Bu hakediş türü zaten mevcut.');
      return;
    }
    const updated = [...hakedisTurleri, val];
    setHakedisTurleri(updated);
    saveHakedisTurleri(updated);
    setNewHakedisTuruInput('');
    setExtraPaymentForm((prev) => ({ ...prev, tur: val }));
  };

  const handleUpdateHakedisTuru = (index: number) => {
    const val = editingTurValue.trim();
    if (!val) return;
    const oldVal = hakedisTurleri[index];
    const updated = hakedisTurleri.map((t, idx) => (idx === index ? val : t));
    setHakedisTurleri(updated);
    saveHakedisTurleri(updated);
    if (extraPaymentForm.tur === oldVal) {
      setExtraPaymentForm((prev) => ({ ...prev, tur: val }));
    }
    setEditingTurIndex(null);
    setEditingTurValue('');
  };

  const handleDeleteHakedisTuru = (index: number) => {
    if (hakedisTurleri.length <= 1) {
      alert('En az bir hakediş türü bulunmalıdır.');
      return;
    }
    const valToDelete = hakedisTurleri[index];
    const updated = hakedisTurleri.filter((_, idx) => idx !== index);
    setHakedisTurleri(updated);
    saveHakedisTurleri(updated);
    if (extraPaymentForm.tur === valToDelete) {
      setExtraPaymentForm((prev) => ({ ...prev, tur: updated[0] }));
    }
  };

  const handleResetHakedisTurleri = () => {
    if (window.confirm('Tüm hakediş türlerini varsayılan listeye sıfırlamak istiyor musunuz?')) {
      setHakedisTurleri(DEFAULT_HAKEDIS_TURLERI);
      saveHakedisTurleri(DEFAULT_HAKEDIS_TURLERI);
      setExtraPaymentForm((prev) => ({ ...prev, tur: DEFAULT_HAKEDIS_TURLERI[0] }));
    }
  };

  // Subcontractor extra payment states (Option 2: Bağımsız Ekstra Ödeme)
  const [extraPaymentForm, setExtraPaymentForm] = useState<{
    santiyeId: string;
    miktar: number | '';
    paraBirimi: string;
    tur: string;
    odemeYontemi: string;
    tarih: string;
    aciklama: string;
  }>({
    santiyeId: santiyeler[0]?.id || '',
    miktar: '',
    paraBirimi: 'TRY',
    tur: getSavedHakedisTurleri()[0] || 'Metraj Hakedişi (Ahşap işler)',
    odemeYontemi: odemeYontemleri[0]?.isim || 'Banka Transferi (Havale / EFT)',
    tarih: getTodayDateString(),
    aciklama: '',
  });

  const [selectedPersonnelFilter, setSelectedPersonnelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [santiyeFilter, setSantiyeFilter] = useState<string>('all');

  // Exchange rates for multi-currency conversion to TRY
  const [exchangeRates, setExchangeRates] = useState(getSavedExchangeRates());
  const [isCurrenciesModalOpen, setIsCurrenciesModalOpen] = useState(false);

  // Firma Cari Otomatik Senkronizasyon Ayarları (Taşeron Hakediş Ödemeleri)
  const [syncPersonPaymentToCari, setSyncPersonPaymentToCari] = useState<boolean>(true);
  const [syncGroupPaymentToCari, setSyncGroupPaymentToCari] = useState<boolean>(true);
  const [syncExtraPaymentToCari, setSyncExtraPaymentToCari] = useState<boolean>(true);

  // Personelin seçilen aydaki Resmi Çalışma Gününü (SGK gününü) manuel değiştirme durumu
  const [editingResmiGunItem, setEditingResmiGunItem] = useState<PersonelHakedisCalculated | null>(null);
  const [resmiGunInputValue, setResmiGunInputValue] = useState<string>('');

  const handleOpenResmiGunModal = (item: PersonelHakedisCalculated) => {
    setEditingResmiGunItem(item);
    setResmiGunInputValue(String(item.resmiGun));
  };

  const handleSaveResmiGun = (customGun?: number) => {
    if (!editingResmiGunItem || !onUpdatePersonnel) return;
    const targetGun = customGun !== undefined ? customGun : parseFloat(resmiGunInputValue);
    if (isNaN(targetGun) || targetGun < 0) return;

    const currentPerson = personnelList.find(
      (p) => String(p.id).trim() === String(editingResmiGunItem.personnel.id).trim()
    ) || editingResmiGunItem.personnel;
    const currentMap = { ...(currentPerson.aylikResmiGunler || {}) };
    currentMap[selectedMonth] = Math.round(targetGun * 10) / 10;

    const updatedPersonnel: Personnel = {
      ...currentPerson,
      id: currentPerson.id,
      aylikResmiGunler: currentMap,
    };

    onUpdatePersonnel(updatedPersonnel);
    setEditingResmiGunItem(null);
  };

  const handleResetResmiGunToAuto = () => {
    if (!editingResmiGunItem || !onUpdatePersonnel) return;
    const currentPerson = personnelList.find(
      (p) => String(p.id).trim() === String(editingResmiGunItem.personnel.id).trim()
    ) || editingResmiGunItem.personnel;
    const currentMap = { ...(currentPerson.aylikResmiGunler || {}) };
    delete currentMap[selectedMonth];

    const updatedPersonnel: Personnel = {
      ...currentPerson,
      id: currentPerson.id,
      aylikResmiGunler: currentMap,
    };

    onUpdatePersonnel(updatedPersonnel);
    setEditingResmiGunItem(null);
  };

  // Taşeron ile ilişkili Firma kaydını bulma yardımcısı
  const findMatchingFirma = (tasId?: string, tasName?: string): Firma | undefined => {
    if (!tasId && !tasName) return undefined;
    return (
      firmalar.find((f) => tasId && f.id === tasId) ||
      firmalar.find(
        (f) => tasName && f.isim.trim().toLowerCase() === tasName.trim().toLowerCase()
      )
    );
  };

  // Taşeron ile ilişkili Firma kaydını bulma veya otomatik türetme yardımcısı
  const getOrCreateMatchingFirma = (tasId?: string, tasName?: string): Firma => {
    const existing = findMatchingFirma(tasId, tasName);
    if (existing) return existing;

    const currentTas = taseronlar.find(
      (t) =>
        (tasId && t.id === tasId) ||
        (tasName && t.isim.trim().toLowerCase() === tasName.trim().toLowerCase())
    );

    const id = tasId || currentTas?.id || `f-tas-${Date.now()}`;
    const name = tasName || currentTas?.isim || 'Taşeron';

    return {
      id,
      isim: name,
      tur: 'taseron',
      ilgili: currentTas?.yetkili || '',
      telefon: currentTas?.telefon || '',
      vergiNo: currentTas?.vergiNo || '',
      adres: currentTas?.adres || '',
      email: currentTas?.email || '',
      uzmanlik: currentTas?.uzmanlik || 'Genel Taşeron',
    };
  };

  // Taşeronun güncel Firma Cari hesap bakiye ve işlem özeti
  const getFirmaCariInfo = (tasId?: string, tasName?: string) => {
    const f = findMatchingFirma(tasId, tasName) || getOrCreateMatchingFirma(tasId, tasName);
    if (!f) return null;
    const records = cariList.filter((c) => c.firmaId === f.id);
    let totalBorcTRY = 0;
    let totalAlacakTRY = 0;
    records.forEach((r) => {
      const cur = r.paraBirimi || 'TRY';
      const borcTRY = convertCurrencyToTRY(r.borc || 0, cur, exchangeRates.rates);
      const alacakTRY = convertCurrencyToTRY(r.alacak || 0, cur, exchangeRates.rates);
      totalBorcTRY += borcTRY;
      totalAlacakTRY += alacakTRY;
    });
    // Hizmet sağlayıcı taşeron için:
    // Borç = Taşerona olan hakediş borcumuz
    // Alacak = Taşerona yaptığımız ödemeler
    // netBakiyeTRY = Borç - Alacak (Pozitifse taşerona borçluyuz, negatifse fazla ödedik)
    const netBakiyeTRY = totalBorcTRY - totalAlacakTRY;
    return {
      firma: f,
      recordsCount: records.length,
      totalBorcTRY,
      totalAlacakTRY,
      netBakiyeTRY,
    };
  };

  // Form for new payment record
  const [newOdeme, setNewOdeme] = useState<{
    personelId: string;
    santiyeId: string;
    tarih: string;
    saat: string;
    tur: 'avans' | 'resmi' | 'harcama' | 'ceza';
    miktar: number;
    paraBirimi: string;
    aciklama: string;
    odemeYontemi: string;
  }>({
    personelId: personnelList.find((p) => p.durum !== 'Pasif')?.id || personnelList[0]?.id || '',
    santiyeId: personnelList.find((p) => p.durum !== 'Pasif')?.santiyeId || personnelList[0]?.santiyeId || santiyeler[0]?.id || '',
    tarih: getTodayDateString(),
    saat: '14:00',
    tur: 'avans',
    miktar: 2000,
    paraBirimi: 'TRY',
    aciklama: '',
    odemeYontemi: odemeYontemleri[0]?.isim || 'Nakit Şantiye Kasası',
  });

  // Calculate Hakediş for each personnel for selectedMonth
  const payrollSummary: PersonelHakedisCalculated[] = personnelList.map((p) => {
    // Puantaj records for this personnel in the month
    const puaRecords = puantajList.filter(
      (pu) => pu.personelId === p.id && pu.tarih.startsWith(selectedMonth)
    );

    let puantajGun = 0;
    let resmiGun = 0;
    puaRecords.forEach((pu) => {
      if (pu.calismaDurumu === 'Resmi Tatil') {
        resmiGun += 1;
        puantajGun += 1;
      } else {
        puantajGun += CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0;
      }
    });

    // Ücret & Maaş Tespiti (Seçilen dönemdeki geçerli ücret: p.ucretGecmisi kademelerini dikkate alır)
    // Böylece Eylül ayında 3000 alan personelin hesabı sıfırlandıktan sonra Ekim ayında 3500'e çıktığında
    // önceki aylara (Eylül ve öncesine) yansımadan Eylül alacağı sıfır kalır, Ekim 3500 üzerinden tahakkuk eder!
    const wageInfo = getEffectiveWageForPersonnel(p, selectedMonth);
    const isAylik = wageInfo.isAylik;
    const aylikMaas = wageInfo.effectiveMaas;
    const effectiveYevmiye = wageInfo.effectiveYevmiye;
    const dailyHours = wageInfo.dailyHours;
    const katsayi = wageInfo.mesaiKatsayisi;
    const resmiMaas = wageInfo.resmiMaas;

    // Aylık sabit çalışanlarda cari/geçmiş aylarda girilmeyen günler otomatik Tam Gün varsayılır,
    // ancak ileri tarihli aylarda (Kasım, Aralık, 2027 Ocak vb.) "Maaşlıları Doldur" denilene kadar boş (0 gün) gelir.
    const effectivePuantajGun = calculateEffectivePuantajGunForMonth(p, selectedMonth, puantajList);
    const { resmiGun: effectiveResmiGun, isManual: isManualResmiGun } = getEffectiveResmiGunForMonth(
      p,
      selectedMonth,
      effectivePuantajGun
    );

    // Mesai hours in the month
    const mesaiSaat = mesaiList
      .filter((m) => m.personelId === p.id && m.tarih.startsWith(selectedMonth))
      .reduce((sum, m) => sum + m.saat, 0);

    const hourlyWage = effectiveYevmiye / dailyHours;
    const mesaiTutari = mesaiSaat * hourlyWage * katsayi;
    const tabanHakedis = effectivePuantajGun * effectiveYevmiye;

    // Eski Kalan Bakiye (Personelin geçmiş dönemden / önceki şantiyeden devreden bakiye alacağı veya borcu)
    // Önceki aylarda yapılan ödemelerle bu eski bakiye sıfırlanmışsa sonraki dönem alacaklarına tekrar eklenmez.
    const eskiBakiye = getEffectiveEskiBakiyeForMonth(
      p,
      selectedMonth,
      puantajList,
      mesaiList,
      odemeList,
      exchangeRates.rates
    );

    // Hak Edilen Toplam = Taban Hakediş + Mesai Tutarı + Devreden Eski Bakiye
    const toplamHakedis = tabanHakedis + mesaiTutari + eskiBakiye;

    // Resmi Maaş ve Gün Başına Kesinti Ayrımı
    // Kullanıcı kuralı: Personel bilgileri tanımlama bölümünde resmi maaş girilir.
    // Resmi maaş / 30 günlük yapılacak kesintiyi verir.
    // Resmi çalışma günü manuel belirlenmişse (p.aylikResmiGunler[selectedMonth]) o gün sayısı, aksi halde puantaj gün sayısı baz alınır.
    // Kesinti ay sonunda toplu bankadan ödenir. Avans ödemeleri elden ödeme olarak hesaplanır.
    const gunlukResmiKesinti = resmiMaas > 0 ? (resmiMaas / 30) : 0;
    const gunlukEldenTutar = Math.max(0, effectiveYevmiye - gunlukResmiKesinti);

    // Hak Edilen Resmi Alacak = Resmi Çalışma Gün Sayısı * (Resmi Maaş / 30)
    const resmiAlacak = effectiveResmiGun * gunlukResmiKesinti;

    // Hak Edilen Elden Hakediş = Toplam Hakedişten Resmi Alacak düşüldükten sonra kalan tutar
    // (Böylece personelin toplam hak edişi eksiksiz korunur, resmi ve elden dengelenir)
    const eldenHakedis = Math.max(0, toplamHakedis - resmiAlacak);

    // Payments in this month (Amounts converted to TL via daily exchange rates)
    const monthOdemeler = odemeList.filter(
      (o) => o.personelId === p.id && isOdemeInBordroDonemi(o, selectedMonth)
    );

    const toplamAvans = monthOdemeler.reduce((sum, o) => {
      const anyO = o as any;
      const val =
        typeof o.avansOdemesi === 'number' && o.avansOdemesi > 0
          ? o.avansOdemesi
          : anyO.tur === 'avans' && typeof anyO.miktar === 'number'
          ? anyO.miktar
          : (o.avansOdemesi || 0);
      const valInTRY = convertCurrencyToTRY(val, o.paraBirimi, exchangeRates.rates);
      return sum + valInTRY;
    }, 0);

    const toplamResmiOdeme = monthOdemeler.reduce((sum, o) => {
      const anyO = o as any;
      const val =
        typeof o.resmiOdeme === 'number' && o.resmiOdeme > 0
          ? o.resmiOdeme
          : anyO.tur === 'resmi' && typeof anyO.miktar === 'number'
          ? anyO.miktar
          : (o.resmiOdeme || 0);
      const valInTRY = convertCurrencyToTRY(val, o.paraBirimi, exchangeRates.rates);
      return sum + valInTRY;
    }, 0);
    const toplamHarcama = monthOdemeler.reduce((sum, o) => {
      const valInTRY = convertCurrencyToTRY(o.yaptigiHarcama || 0, o.paraBirimi, exchangeRates.rates);
      return sum + valInTRY;
    }, 0);
    const toplamCeza = monthOdemeler.reduce((sum, o) => {
      const valInTRY = convertCurrencyToTRY(o.cezaMiktari || 0, o.paraBirimi, exchangeRates.rates);
      return sum + valInTRY;
    }, 0);

    // Kalan Resmi Ödeme (Ay Sonu Bankadan Yapılacak Toplu Ödeme)
    const kalanResmiOdeme = resmiAlacak - toplamResmiOdeme;

    // Kalan Elden Ödeme (Avans alacağı: Elden hakediş [Eski Bakiye Dahil] + Harcama iadesi - Elden çekilen avanslar - Cezalar)
    const kalanEldenOdeme = (eldenHakedis + toplamHarcama) - toplamAvans - toplamCeza;

    // Net Genel Kalan = Kalan Resmi + Kalan Elden
    const netHakedis = kalanResmiOdeme + kalanEldenOdeme;

    return {
      personnel: p,
      puantajGun: effectivePuantajGun,
      resmiGun: effectiveResmiGun,
      isManualResmiGun,
      mesaiSaat,
      dailyHours,
      hourlyWage,
      katsayi,
      mesaiTutari,
      tabanHakedis,
      yevmiye: effectiveYevmiye,
      isAylik,
      effectiveMaas: aylikMaas,
      resmiMaas,
      gunlukResmiKesinti,
      gunlukEldenTutar,
      resmiAlacak,
      eldenHakedis,
      kalanResmiOdeme,
      kalanEldenOdeme,
      toplamHakedis,
      toplamAvans,
      toplamResmiOdeme,
      toplamHarcama,
      toplamCeza,
      eskiBakiye,
      netHakedis,
    };
  });

  // Durumu Pasif ve bakiyesi sıfır veya negatif olan personelleri (alacağı kalmamışsa)
  // ödeme ve hakediş listelerinden filtrele (Aktif personeller ve tahakkuk etmiş alacağı olan pasif personeller görünür)
  const activeOrBalancePayrollSummary = useMemo(() => {
    return payrollSummary.filter((item) => {
      const p = item.personnel;
      const isPasif = String(p.durum || '').trim().toLowerCase() === 'pasif';
      if (!isPasif) return true;
      const hasPositiveBalance =
        item.kalanResmiOdeme > 0.5 ||
        item.kalanEldenOdeme > 0.5 ||
        item.netHakedis > 0.5;
      return hasPositiveBalance;
    });
  }, [payrollSummary]);

  const selectablePersonnelList = useMemo(() => {
    return activeOrBalancePayrollSummary
      .map((item) => item.personnel)
      .filter((p) => {
        const isPasif = String(p.durum || '').trim().toLowerCase() === 'pasif';
        if (!isPasif) return true;
        const found = activeOrBalancePayrollSummary.find((item) => item.personnel.id === p.id);
        if (!found) return false;
        return found.kalanResmiOdeme > 0.5 || found.kalanEldenOdeme > 0.5 || found.netHakedis > 0.5;
      });
  }, [activeOrBalancePayrollSummary]);

  // Filtered payments list (Personnel)
  const filteredOdemeler = odemeList.filter((o) => {
    const matchesMonth = odemelerMonthFilter === 'all' || isOdemeInBordroDonemi(o, odemelerMonthFilter);
    const matchesPerson = selectedPersonnelFilter === 'all' || o.personelId === selectedPersonnelFilter;
    if (!matchesMonth || !matchesPerson) return false;

    return true;
  });

  // All subcontractor payments (combining direct giderler, Firma & Cari payments, and Çek Takibi check payments)
  const allTaseronPayments = useMemo(() => {
    // 1. Direct giderler for subcontractors
    const directGiderler = giderler
      .filter((g) => g.kategori === 'Taşeron Hakediş' || !!g.taseron)
      .map((g) => {
        const matchingCek = g.cekId
          ? cekler.find((chk) => chk.id === g.cekId)
          : cekler.find(
              (chk) =>
                (g.cariHareketId && (chk.cariHareketId === g.cariHareketId || chk.ciroCariHareketId === g.cariHareketId)) ||
                (chk.cekNo && (g.aciklama?.includes(chk.cekNo) || g.odemeYontemi?.includes(chk.cekNo)))
            );
        return {
          ...g,
          cekId: g.cekId || matchingCek?.id,
          cekNo: g.cekNo || matchingCek?.cekNo,
        };
      });

    const existingCariIdsInGiderler = new Set(
      directGiderler.map((g) => g.cariHareketId).filter(Boolean)
    );
    const existingGiderIds = new Set(directGiderler.map((g) => g.id));
    const existingCekIdsInGiderler = new Set(directGiderler.map((g) => g.cekId).filter(Boolean));

    // 2. Extra payments from cariList that are not yet represented in directGiderler
    const cariPayments: (SantiyeGider & { isFromCariOnly?: boolean; cekId?: string; cekNo?: string })[] = [];

    cariList.forEach((c) => {
      const isPayment = c.islemTuru === 'odeme' || ((c.alacak || 0) > 0 && c.islemTuru !== 'satis_faturasi');
      if (!isPayment) return;

      // Skip if already in giderler
      if (c.giderId && existingGiderIds.has(c.giderId)) return;
      if (existingCariIdsInGiderler.has(c.id)) return;

      const firma = firmalar.find((f) => f.id === c.firmaId);
      const matchingTas = taseronlar.find(
        (t) => t.id === c.firmaId || (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()))
      ) || (firma?.tur === 'taseron' ? { id: firma.id, isim: firma.isim } : null);

      if (!matchingTas && firma?.tur !== 'taseron') return;

      const tasName = matchingTas?.isim || firma?.isim || 'Taşeron';

      // Çek Tespiti:
      const matchingCek = c.cekId
        ? cekler.find((chk) => chk.id === c.cekId)
        : cekler.find(
            (chk) =>
              chk.cariHareketId === c.id ||
              chk.ciroCariHareketId === c.id ||
              (chk.cekNo && (c.faturaNo?.includes(chk.cekNo) || c.aciklama?.includes(chk.cekNo)))
          );

      const isCek = Boolean(
        c.cekId ||
        matchingCek ||
        c.faturaNo?.toLowerCase().includes('çek') ||
        c.faturaNo?.toLowerCase().includes('ciro') ||
        c.aciklama?.toLowerCase().includes('çek') ||
        c.aciklama?.toLowerCase().includes('ciro')
      );

      const isCiro = c.faturaNo?.toUpperCase().startsWith('CİRO') || matchingCek?.durum === 'Ciro Edildi';
      const resolvedCekNo = matchingCek?.cekNo || c.faturaNo?.replace(/^(ÇEK-|CİRO-)/i, '') || '';
      
      const odemeYontemiLabel = isCek
        ? (isCiro ? `Ciro Edilen Çek${resolvedCekNo ? ` (${resolvedCekNo})` : ''}` : `Verilen Çek${resolvedCekNo ? ` (${resolvedCekNo})` : ''}`)
        : (c.odemeYontemi || 'Firma Cari Hesabı');

      const resolvedSite =
        (c.santiyeId && santiyeler.find((s) => s.id === c.santiyeId || s.isim.trim().toLowerCase() === c.santiyeId!.trim().toLowerCase())) ||
        (c.santiyeAdi && santiyeler.find((s) => s.isim.trim().toLowerCase() === c.santiyeAdi!.trim().toLowerCase())) ||
        (matchingCek &&
          (isCiro
            ? (matchingCek.ciroSantiyeId && santiyeler.find((s) => s.id === matchingCek.ciroSantiyeId)) ||
              (matchingCek.ciroSantiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === matchingCek.ciroSantiyeProje!.trim().toLowerCase())) ||
              (matchingCek.santiyeId && santiyeler.find((s) => s.id === matchingCek.santiyeId)) ||
              (matchingCek.santiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === matchingCek.santiyeProje!.trim().toLowerCase()))
            : (matchingCek.santiyeId && santiyeler.find((s) => s.id === matchingCek.santiyeId)) ||
              (matchingCek.santiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === matchingCek.santiyeProje!.trim().toLowerCase())))) ||
        santiyeler.find((s) => c.aciklama && c.aciklama.toLowerCase().includes(s.isim.toLowerCase()));

      cariPayments.push({
        id: c.giderId || `sg-cari-${c.id}`,
        santiyeId: resolvedSite?.id || '',
        odeyen: isCek ? 'Şirket Yönetimi (Çek Portföyü)' : 'Şirket Yönetimi (Firma Cari)',
        odemeYontemi: odemeYontemiLabel,
        tarih: c.tarih || getTodayDateString(),
        kategori: isCek ? 'Çek Ödemesi' : 'Firma Cari Ödemesi',
        aciklama: c.aciklama ? `${c.aciklama}` : `[${isCek ? 'Çek Ödemesi' : 'Firma Cari Ödemesi'}] ${tasName}`,
        odemeYapilanFirma: tasName,
        durum: 'Ödendi',
        taseron: tasName,
        miktar: Number(c.alacak || 0),
        paraBirimi: c.paraBirimi || 'TRY',
        cariHareketId: c.id,
        cariFirmaId: c.firmaId,
        isFromCariOnly: true,
        cekId: c.cekId || matchingCek?.id,
        cekNo: resolvedCekNo,
      });
    });

    // 3. Çek Takibinden doğrudan taşerona verilen veya ciro edilen çekler (henüz cari veya giderde yoksa)
    const directCekPayments: (SantiyeGider & { isFromCariOnly?: boolean; cekId?: string; cekNo?: string })[] = [];
    const alreadyProcessedCekIds = new Set([
      ...existingCekIdsInGiderler,
      ...cariPayments.map((cp) => cp.cekId).filter(Boolean),
    ]);

    cekler.forEach((chk) => {
      if (alreadyProcessedCekIds.has(chk.id)) return;

      const isVerilen = chk.cekTuru === 'verilen_cek';
      const isCiro = chk.durum === 'Ciro Edildi';
      if (!isVerilen && !isCiro) return;

      let tasName: string | undefined = undefined;
      let matchedFirmaId: string | undefined = undefined;

      if (isVerilen) {
        const matchingFirma = firmalar.find((f) => f.id === chk.firmaId);
        const matchingTas = taseronlar.find(
          (t) =>
            t.id === chk.firmaId ||
            (matchingFirma && (t.id === matchingFirma.id || t.isim.trim().toLowerCase() === matchingFirma.isim.trim().toLowerCase())) ||
            (chk.hamil && t.isim.trim().toLowerCase() === chk.hamil.trim().toLowerCase())
        );
        if (matchingTas || matchingFirma?.tur === 'taseron') {
          tasName = matchingTas?.isim || matchingFirma?.isim || chk.hamil;
          matchedFirmaId = matchingFirma?.id || matchingTas?.id;
        }
      } else if (isCiro && (chk.ciroFirmaId || chk.ciroEdilenFirma)) {
        const matchingFirma = firmalar.find((f) => f.id === chk.ciroFirmaId);
        const matchingTas = taseronlar.find(
          (t) =>
            t.id === chk.ciroFirmaId ||
            (matchingFirma && (t.id === matchingFirma.id || t.isim.trim().toLowerCase() === matchingFirma.isim.trim().toLowerCase())) ||
            (chk.ciroEdilenFirma && t.isim.trim().toLowerCase() === chk.ciroEdilenFirma.trim().toLowerCase())
        );
        if (matchingTas || matchingFirma?.tur === 'taseron') {
          tasName = matchingTas?.isim || matchingFirma?.isim || chk.ciroEdilenFirma;
          matchedFirmaId = matchingFirma?.id || matchingTas?.id;
        }
      }

      if (!tasName) return;

      const resolvedCekSite = isCiro
        ? (chk.ciroSantiyeId && santiyeler.find((s) => s.id === chk.ciroSantiyeId)) ||
          (chk.ciroSantiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === chk.ciroSantiyeProje!.trim().toLowerCase())) ||
          (chk.santiyeId && santiyeler.find((s) => s.id === chk.santiyeId)) ||
          (chk.santiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === chk.santiyeProje!.trim().toLowerCase()))
        : (chk.santiyeId && santiyeler.find((s) => s.id === chk.santiyeId)) ||
          (chk.santiyeProje && santiyeler.find((s) => s.isim.trim().toLowerCase() === chk.santiyeProje!.trim().toLowerCase()));

      directCekPayments.push({
        id: `sg-chk-${chk.id}`,
        santiyeId: resolvedCekSite?.id || '',
        odeyen: 'Şirket Yönetimi (Çek Portföyü)',
        odemeYontemi: isCiro ? `Ciro Edilen Çek (${chk.cekNo})` : `Verilen Çek (${chk.cekNo})`,
        tarih: isCiro ? (chk.ciroTarihi || chk.alinanTarih) : chk.alinanTarih,
        kategori: 'Çek Ödemesi',
        aciklama: `[Çek Takibi - ${isCiro ? 'Ciro Çek' : 'Verilen Çek'}] ${chk.bankaAdi} - Çek No: ${chk.cekNo} - Vade: ${chk.vadeTarihi}${chk.aciklama ? ' - ' + chk.aciklama : ''}`,
        odemeYapilanFirma: tasName,
        durum: 'Ödendi',
        taseron: tasName,
        miktar: Number(chk.miktar || 0),
        paraBirimi: chk.paraBirimi || 'TRY',
        cariHareketId: chk.cariHareketId || chk.ciroCariHareketId,
        cariFirmaId: matchedFirmaId,
        isFromCariOnly: true,
        cekId: chk.id,
        cekNo: chk.cekNo,
      });
    });

    return [...directGiderler, ...cariPayments, ...directCekPayments].sort((a, b) => {
      return (b.tarih || '').localeCompare(a.tarih || '');
    });
  }, [giderler, cariList, firmalar, taseronlar, santiyeler, cekler]);

  // Filtered direct subcontractor hakedis & cari payments
  const filteredTaseronGiderler = allTaseronPayments.filter((g) => {
    const matchesMonth = odemelerMonthFilter === 'all' || (g.tarih && g.tarih.startsWith(odemelerMonthFilter));
    const matchesTas =
      selectedTaseronFilter === 'all' ||
      g.taseron === selectedTaseronFilter ||
      g.odemeYapilanFirma === selectedTaseronFilter;
    return matchesMonth && matchesTas;
  });

  // Available months across personnel payments and subcontractor payments for Tablo 5 filter
  const odemelerAvailableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    if (selectedMonth) monthSet.add(selectedMonth);
    odemeList.forEach((o) => {
      const donem = getOdemeBordroDonemi(o);
      if (donem && donem.length >= 7) monthSet.add(donem.slice(0, 7));
    });
    allTaseronPayments.forEach((g) => {
      if (g.tarih && g.tarih.length >= 7) monthSet.add(g.tarih.slice(0, 7));
    });
    return Array.from(monthSet).sort().reverse();
  }, [odemeList, allTaseronPayments, selectedMonth]);

  // Grand totals across all personnel
  const totalHakEdilen = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.toplamHakedis, 0);
  const totalResmiAlacak = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.resmiAlacak, 0);
  const totalOdenenResmi = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.toplamResmiOdeme, 0);
  const totalKalanResmi = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.kalanResmiOdeme, 0);

  const totalEldenAlacak = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.eldenHakedis, 0);
  const totalOdenenAvans = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.toplamAvans, 0);
  const totalKalanElden = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.kalanEldenOdeme, 0);

  const totalOdenenGenel = totalOdenenResmi + totalOdenenAvans;
  const totalNetKalan = activeOrBalancePayrollSummary.reduce((acc, curr) => acc + curr.netHakedis, 0);

  // Aylık Sabit ve Günlük Yevmiyeli Kadro Ayrımı ve Bağımsız Analizi
  const aylikWorkers = useMemo(() => {
    return activeOrBalancePayrollSummary.filter((w) => w.isAylik);
  }, [activeOrBalancePayrollSummary]);

  const yevmiyeWorkers = useMemo(() => {
    return activeOrBalancePayrollSummary.filter((w) => !w.isAylik);
  }, [activeOrBalancePayrollSummary]);

  const computeGroupStats = (workers: PersonelHakedisCalculated[]) => {
    const personCount = workers.length;
    const grandHakedis = workers.reduce((acc, curr) => acc + curr.toplamHakedis, 0);
    const grandResmiAlacak = workers.reduce((acc, curr) => acc + curr.resmiAlacak, 0);
    const grandResmiPaid = workers.reduce((acc, curr) => acc + curr.toplamResmiOdeme, 0);
    const grandKalanResmi = workers.reduce((acc, curr) => acc + curr.kalanResmiOdeme, 0);

    const grandEldenHakedis = workers.reduce((acc, curr) => acc + curr.eldenHakedis, 0);
    const grandEldenPaid = workers.reduce((acc, curr) => acc + curr.toplamAvans, 0);
    const grandKalanElden = workers.reduce((acc, curr) => acc + curr.kalanEldenOdeme, 0);

    const grandOdenen = grandResmiPaid + grandEldenPaid;
    const grandKalan = grandKalanResmi + grandKalanElden;

    const totalPuantajGun = workers.reduce((acc, curr) => acc + curr.puantajGun, 0);
    const totalMesaiSaat = workers.reduce((acc, curr) => acc + curr.mesaiSaat, 0);
    const totalMesaiTutari = workers.reduce((acc, curr) => acc + curr.mesaiTutari, 0);
    const totalHarcama = workers.reduce((acc, curr) => acc + curr.toplamHarcama, 0);
    const totalCeza = workers.reduce((acc, curr) => acc + curr.toplamCeza, 0);

    const avgRate = personCount > 0 
      ? workers.reduce((acc, curr) => acc + (curr.isAylik ? (curr.effectiveMaas || curr.yevmiye * 30) : curr.yevmiye), 0) / personCount 
      : 0;

    return {
      personCount,
      grandHakedis,
      grandResmiAlacak,
      grandResmiPaid,
      grandKalanResmi,
      grandEldenHakedis,
      grandEldenPaid,
      grandKalanElden,
      grandOdenen,
      grandKalan,
      totalPuantajGun,
      totalMesaiSaat,
      totalMesaiTutari,
      totalHarcama,
      totalCeza,
      avgRate,
    };
  };

  const aylikStats = useMemo(() => computeGroupStats(aylikWorkers), [aylikWorkers]);
  const yevmiyeStats = useMemo(() => computeGroupStats(yevmiyeWorkers), [yevmiyeWorkers]);

  // Selected personnel object for modal calculations
  const selectedModalPersonHakedis = payrollSummary.find((item) => item.personnel.id === newOdeme.personelId);

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOdeme.personelId || newOdeme.miktar <= 0) return;

    const person = selectedModalPersonHakedis?.personnel;
    const tasName = person?.taseron;
    const tasId = person?.taseronId;
    const hasTaseron = Boolean(tasName?.trim() || tasId?.trim());
    const matchingFirma = hasTaseron ? getOrCreateMatchingFirma(tasId, tasName) : undefined;

    const chosenSite =
      santiyeler.find((s) => s.id === newOdeme.santiyeId) ||
      santiyeler.find((s) => person?.santiyeId && (s.id === person.santiyeId || s.isim.trim().toLowerCase() === person.santiyeId.trim().toLowerCase())) ||
      santiyeler.find((s) => person?.santiye && (s.isim.trim().toLowerCase() === person.santiye.trim().toLowerCase() || s.id === person.santiye.trim()));

    const effectiveSantiyeId = chosenSite?.id || newOdeme.santiyeId || person?.santiyeId;
    const effectiveSantiyeAdi = chosenSite?.isim || person?.santiye;

    const nowTs = Date.now();
    let cariHareket: FirmaCari | undefined = undefined;
    let cariHareketId: string | undefined = undefined;
    let taseronFirmaId: string | undefined = undefined;

    if (
      syncPersonPaymentToCari &&
      matchingFirma &&
      (newOdeme.tur === 'avans' || newOdeme.tur === 'resmi')
    ) {
      cariHareketId = `fc-po-${nowTs}`;
      taseronFirmaId = matchingFirma.id;
      const numMiktar = Number(newOdeme.miktar);
      cariHareket = {
        id: cariHareketId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: numMiktar,
        paraBirimi: newOdeme.paraBirimi || 'TRY',
        tarih: newOdeme.tarih,
        saat: newOdeme.saat,
        faturaNo: `HAK-PERS-${nowTs.toString().slice(-4)}`,
        aciklama: `[Taşeron Personeli Hakediş] ${person?.isim} ${person?.soyisim} (${
          newOdeme.tur === 'avans' ? 'Elden Avans' : 'Resmi Banka'
        })${chosenSite ? ` [${chosenSite.isim}]` : ''}${newOdeme.aciklama ? ` - ${newOdeme.aciklama}` : ''}`,
        islemTuru: 'odeme',
        hedefParaBirimi: newOdeme.paraBirimi || 'TRY',
        hedefDusulenTutar: numMiktar,
        odemeId: `po-${nowTs}`,
        santiyeId: effectiveSantiyeId,
        santiyeAdi: effectiveSantiyeAdi,
      };
    }

    const record: PersonelOdeme = {
      id: `po-${nowTs}`,
      personelId: newOdeme.personelId,
      santiyeId: effectiveSantiyeId,
      santiyeAdi: effectiveSantiyeAdi,
      tarih: newOdeme.tarih,
      saat: newOdeme.saat,
      bordroDonemi: selectedMonth,
      avansOdemesi: newOdeme.tur === 'avans' ? Number(newOdeme.miktar) : 0,
      resmiOdeme: newOdeme.tur === 'resmi' ? Number(newOdeme.miktar) : 0,
      yaptigiHarcama: newOdeme.tur === 'harcama' ? Number(newOdeme.miktar) : 0,
      cezaMiktari: newOdeme.tur === 'ceza' ? Number(newOdeme.miktar) : 0,
      eskiBakiyesi: 0,
      aciklama: newOdeme.aciklama,
      odemeYontemi: newOdeme.odemeYontemi,
      paraBirimi: newOdeme.paraBirimi || 'TRY',
      cariHareketId,
      taseronFirmaId,
    };

    onAddOdeme(record, cariHareket);
    setIsPaymentModalOpen(false);
  };

  // Taşeron Ödeme Fonksiyonları
  const toggleTaseronAccordion = (tId: string) => {
    setExpandedTaseronIds((prev) => ({ ...prev, [tId]: !prev[tId] }));
  };

  const openTaseronPaymentModal = (taseronId?: string, mode: 'group' | 'extra' = 'group') => {
    const targetId = taseronId || (taseronlar[0]?.id || '');
    setSelectedTaseronIdForModal(targetId);
    setTaseronPaymentMode(mode);
    setGroupPaymentDate(getTodayDateString());
    setGroupPaymentTime('14:00');
    setGroupPaymentNote('');
    setExtraPaymentForm({
      santiyeId: santiyeler[0]?.id || '',
      miktar: '',
      tur: 'Metraj Hakedişi (Ahşap işleri)',
      odemeYontemi: odemeYontemleri[0]?.isim || 'Banka Transferi (Havale / EFT)',
      tarih: getTodayDateString(),
      aciklama: '',
    });

    const targetTas = taseronlar.find((t) => t.id === targetId) || taseronlar[0];
    const initialMap: Record<string, { resmi: number; elden: number }> = {};
    if (targetTas) {
      activeOrBalancePayrollSummary
        .filter((w) => w.personnel.taseronId === targetTas.id || w.personnel.taseron === targetTas.isim)
        .forEach((w) => {
          initialMap[w.personnel.id] = { resmi: 0, elden: 0 };
        });
    }
    setGroupWorkerPayments(initialMap);
    setIsTaseronPaymentModalOpen(true);
  };

  const handleWorkerResmiChange = (workerId: string, val: number) => {
    setGroupWorkerPayments((prev) => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || { resmi: 0, elden: 0 }),
        resmi: isNaN(val) ? 0 : Math.max(0, val),
      },
    }));
  };

  const handleWorkerEldenChange = (workerId: string, val: number) => {
    setGroupWorkerPayments((prev) => ({
      ...prev,
      [workerId]: {
        ...(prev[workerId] || { resmi: 0, elden: 0 }),
        elden: isNaN(val) ? 0 : Math.max(0, val),
      },
    }));
  };

  const handleFillAllAvans = (workers: PersonelHakedisCalculated[]) => {
    setGroupWorkerPayments((prev) => {
      const next = { ...prev };
      workers.forEach((w) => {
        next[w.personnel.id] = {
          ...(next[w.personnel.id] || { resmi: 0, elden: 0 }),
          elden: round2(Math.max(0, w.kalanEldenOdeme)),
        };
      });
      return next;
    });
  };

  const handleFillAllResmi = (workers: PersonelHakedisCalculated[]) => {
    setGroupWorkerPayments((prev) => {
      const next = { ...prev };
      workers.forEach((w) => {
        next[w.personnel.id] = {
          ...(next[w.personnel.id] || { resmi: 0, elden: 0 }),
          resmi: round2(Math.max(0, w.kalanResmiOdeme)),
        };
      });
      return next;
    });
  };

  const handleFillAllBoth = (workers: PersonelHakedisCalculated[]) => {
    setGroupWorkerPayments((prev) => {
      const next = { ...prev };
      workers.forEach((w) => {
        next[w.personnel.id] = {
          resmi: round2(Math.max(0, w.kalanResmiOdeme)),
          elden: round2(Math.max(0, w.kalanEldenOdeme)),
        };
      });
      return next;
    });
  };

  const handleClearAllGroup = (workers: PersonelHakedisCalculated[]) => {
    setGroupWorkerPayments((prev) => {
      const next = { ...prev };
      workers.forEach((w) => {
        next[w.personnel.id] = { resmi: 0, elden: 0 };
      });
      return next;
    });
  };

  const handleSaveGroupPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const currentTas = taseronlar.find((t) => t.id === selectedTaseronIdForModal) || taseronlar[0];
    if (!currentTas) return;

    const teamWorkers = activeOrBalancePayrollSummary.filter(
      (w) => w.personnel.taseronId === currentTas.id || w.personnel.taseron === currentTas.isim
    );

    const newOdemeler: PersonelOdeme[] = [];
    const nowTimestamp = Date.now();

    teamWorkers.forEach((w, idx) => {
      const pPay = groupWorkerPayments[w.personnel.id];
      if (!pPay) return;

      const eldenMiktar = round2(Number(pPay.elden) || 0);
      const resmiMiktar = round2(Number(pPay.resmi) || 0);

      // 1. Elden Avans Ödemesi (Avans alacağından ve elden hakedişten düşer)
      if (eldenMiktar > 0) {
        newOdemeler.push({
          id: `po-${nowTimestamp}-${idx}-${w.personnel.id}-elden`,
          personelId: w.personnel.id,
          santiyeId: w.personnel.santiyeId,
          santiyeAdi: w.personnel.santiye,
          tarih: groupPaymentDate || getTodayDateString(),
          saat: groupPaymentTime || '14:00',
          bordroDonemi: selectedMonth,
          avansOdemesi: eldenMiktar,
          resmiOdeme: 0,
          yaptigiHarcama: 0,
          cezaMiktari: 0,
          eskiBakiyesi: round2(w.kalanEldenOdeme),
          odemeYontemi: groupPaymentMethod || 'Nakit',
          aciklama: `[Taşeron: ${currentTas.isim}] Ekip Elden / Avans Ödemesi${groupPaymentNote ? ` - ${groupPaymentNote}` : ''}`,
        });
      }

      // 2. Resmi Banka Ödemesi (Resmi asgari kesinti alacağından düşer)
      if (resmiMiktar > 0) {
        newOdemeler.push({
          id: `po-${nowTimestamp}-${idx}-${w.personnel.id}-resmi`,
          personelId: w.personnel.id,
          santiyeId: w.personnel.santiyeId,
          santiyeAdi: w.personnel.santiye,
          tarih: groupPaymentDate || getTodayDateString(),
          saat: groupPaymentTime || '14:00',
          bordroDonemi: selectedMonth,
          avansOdemesi: 0,
          resmiOdeme: resmiMiktar,
          yaptigiHarcama: 0,
          cezaMiktari: 0,
          eskiBakiyesi: round2(w.kalanResmiOdeme),
          odemeYontemi: groupPaymentMethod || 'Banka Transferi (Havale / EFT)',
          aciklama: `[Taşeron: ${currentTas.isim}] Ekip Resmi Maaş Ödemesi${groupPaymentNote ? ` - ${groupPaymentNote}` : ''}`,
        });
      }
    });

    if (newOdemeler.length === 0) {
      alert('Lütfen en az bir personel için ödenecek avans veya resmi tutar giriniz.');
      return;
    }

    const matchingFirma = getOrCreateMatchingFirma(currentTas.id, currentTas.isim);
    const totalGroupPaid = round2(
      newOdemeler.reduce((acc, curr) => acc + curr.avansOdemesi + curr.resmiOdeme, 0)
    );

    let groupCariHareket: FirmaCari | undefined = undefined;
    if (syncGroupPaymentToCari && matchingFirma && totalGroupPaid > 0) {
      const groupCariId = `fc-grp-${nowTimestamp}`;
      groupCariHareket = {
        id: groupCariId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: totalGroupPaid,
        paraBirimi: 'TRY',
        tarih: groupPaymentDate || getTodayDateString(),
        saat: groupPaymentTime || '14:00',
        faturaNo: `HAK-EKIP-${nowTimestamp.toString().slice(-4)}`,
        aciklama: `[Taşeron Ekip Hakediş Ödemesi] ${currentTas.isim} (${newOdemeler.length} Personel Dağıtımı)${
          groupPaymentNote ? ` - ${groupPaymentNote}` : ''
        }`,
        islemTuru: 'odeme',
        hedefParaBirimi: 'TRY',
        hedefDusulenTutar: totalGroupPaid,
      };

      // Bağlantı id'lerini ödeme satırlarına ekle
      newOdemeler.forEach((o) => {
        o.cariHareketId = groupCariId;
        o.taseronFirmaId = matchingFirma.id;
      });
    }

    if (onAddBulkOdeme) {
      onAddBulkOdeme(newOdemeler, groupCariHareket);
    } else {
      newOdemeler.forEach((od) => onAddOdeme(od, groupCariHareket));
    }

    // Modal bakiye girişlerini temizle ve modalı kapat
    const resetMap: Record<string, { resmi: number; elden: number }> = {};
    teamWorkers.forEach((w) => {
      resetMap[w.personnel.id] = { resmi: 0, elden: 0 };
    });
    setGroupWorkerPayments(resetMap);
    setIsTaseronPaymentModalOpen(false);
  };

  const handleSaveExtraPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const currentTas = taseronlar.find((t) => t.id === selectedTaseronIdForModal) || taseronlar[0];
    if (!currentTas) return;

    const amount = Number(extraPaymentForm.miktar);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Lütfen geçerli bir ekstra ödeme tutarı giriniz.');
      return;
    }

    const nowTs = Date.now();
    const giderId = `sg-tas-${nowTs}`;
    const matchingFirma = getOrCreateMatchingFirma(currentTas.id, currentTas.isim);
    let extraCariHareket: FirmaCari | undefined = undefined;
    let cariHareketId: string | undefined = undefined;
    let cariFirmaId: string | undefined = undefined;

    const chosenSite = santiyeler.find((s) => s.id === (extraPaymentForm.santiyeId || santiyeler[0]?.id));

    if (syncExtraPaymentToCari && matchingFirma) {
      cariHareketId = `fc-tas-gider-${nowTs}`;
      cariFirmaId = matchingFirma.id;
      extraCariHareket = {
        id: cariHareketId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: amount,
        paraBirimi: extraPaymentForm.paraBirimi || 'TRY',
        tarih: extraPaymentForm.tarih || getTodayDateString(),
        saat: '12:00',
        faturaNo: `HAK-EXT-${nowTs.toString().slice(-4)}`,
        aciklama: `[Taşeron Hakediş Ödemesi] ${currentTas.isim} (${extraPaymentForm.tur})${chosenSite ? ` [${chosenSite.isim}]` : ''}${
          extraPaymentForm.aciklama ? ` - ${extraPaymentForm.aciklama}` : ''
        }`.trim(),
        islemTuru: 'odeme',
        hedefParaBirimi: extraPaymentForm.paraBirimi || 'TRY',
        hedefDusulenTutar: amount,
        giderId: giderId,
        santiyeId: chosenSite?.id,
        santiyeAdi: chosenSite?.isim,
      };
    }

    if (onAddGider) {
      onAddGider(
        {
          id: giderId,
          santiyeId: extraPaymentForm.santiyeId || santiyeler[0]?.id || '',
          odeyen: 'Şirket Yönetimi / Muhasebe',
          odemeYontemi: extraPaymentForm.odemeYontemi,
          tarih: extraPaymentForm.tarih || getTodayDateString(),
          kategori: 'Taşeron Hakediş',
          aciklama: `[${extraPaymentForm.tur}] ${currentTas.isim} Taşeron Ekstra Hakediş: ${extraPaymentForm.aciklama}`.trim(),
          odemeYapilanFirma: currentTas.isim,
          durum: 'Ödendi',
          taseron: currentTas.isim,
          miktar: amount,
          paraBirimi: extraPaymentForm.paraBirimi || 'TRY',
          cariHareketId,
          cariFirmaId,
        },
        extraCariHareket
      );
    }

    setIsTaseronPaymentModalOpen(false);
  };

  // Taşeron İstatistik & Alacak Hesaplamaları
  const taseronStats = taseronlar.map((tas) => {
    const workers = activeOrBalancePayrollSummary.filter(
      (w) => w.personnel.taseronId === tas.id || w.personnel.taseron === tas.isim
    );
    const ekipSayisi = workers.length;
    const puantajGun = workers.reduce((s, w) => s + w.puantajGun, 0);
    const mesaiSaat = workers.reduce((s, w) => s + w.mesaiSaat, 0);
    const toplamHakedis = workers.reduce((s, w) => s + w.toplamHakedis, 0);
    const resmiAlacak = workers.reduce((s, w) => s + w.resmiAlacak, 0);
    const odenenResmi = workers.reduce((s, w) => s + w.toplamResmiOdeme, 0);
    const kalanResmi = workers.reduce((s, w) => s + w.kalanResmiOdeme, 0);
    const eldenHakedis = workers.reduce((s, w) => s + w.eldenHakedis, 0);
    const odenenAvans = workers.reduce((s, w) => s + w.toplamAvans, 0);
    const kalanElden = workers.reduce((s, w) => s + w.kalanEldenOdeme, 0);
    const netKalan = workers.reduce((s, w) => s + w.netHakedis, 0);

    const ekstraOdemeler = allTaseronPayments.filter(
      (g) =>
        (g.taseron === tas.isim || g.odemeYapilanFirma === tas.isim) &&
        g.tarih.startsWith(selectedMonth)
    );
    const toplamEkstra = ekstraOdemeler.reduce((s, g) => s + g.miktar, 0);

    // Bağlı Firma Cari Hesap Bilgileri
    const cariInfo = getFirmaCariInfo(tas.id, tas.isim);

    return {
      taseron: tas,
      cariInfo,
      workers,
      ekipSayisi,
      puantajGun,
      mesaiSaat,
      toplamHakedis,
      resmiAlacak,
      odenenResmi,
      kalanResmi,
      eldenHakedis,
      odenenAvans,
      kalanElden,
      netKalan,
      ekstraOdemeler,
      toplamEkstra,
    };
  });

  const totalTaseronEkip = taseronStats.reduce((s, t) => s + t.ekipSayisi, 0);
  const totalTaseronKalanResmi = taseronStats.reduce((s, t) => s + t.kalanResmi, 0);
  const totalTaseronKalanElden = taseronStats.reduce((s, t) => s + t.kalanElden, 0);
  const totalTaseronNetKalan = taseronStats.reduce((s, t) => s + t.netKalan, 0);
  const totalTaseronEkstra = taseronStats.reduce((s, t) => s + t.toplamEkstra, 0);

  // Filtered payroll items for Tablo 2
  const filteredPayrollSummary = activeOrBalancePayrollSummary.filter((item) => {
    const p = item.personnel;
    const matchesSearch = 
      `${p.isim} ${p.soyisim}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.TCNO && p.TCNO.includes(searchTerm)) ||
      (p.kategori && p.kategori.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.santiye && p.santiye.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSantiye = santiyeFilter === 'all' || p.santiyeId === santiyeFilter;

    const isAylik = p.ucretTipi === 'aylik' || Boolean(!p.ucretTipi && p.maas && (!p.yevmiye || p.yevmiye === 0));
    const matchesWageType =
      wageTypeFilter === 'all' ? true : wageTypeFilter === 'aylik' ? isAylik : !isAylik;

    return matchesSearch && matchesSantiye && matchesWageType;
  });

  // Unique sites for filter
  const uniqueSites: { id: string; name: string }[] = Array.from(
    new Map<string, { id: string; name: string }>(
      personnelList
        .filter((p) => p.santiyeId && p.santiye)
        .map((p) => [p.santiyeId as string, { id: p.santiyeId as string, name: p.santiye as string }])
    ).values()
  );

  // Export options for Tablo 2: Hakediş Cetveli
  const getPayrollExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Personel', dataKey: 'personel', width: 30 },
      { header: 'Görev', dataKey: 'kategori', width: 20 },
      { header: 'Şantiye', dataKey: 'santiye', width: 20 },
      { header: 'Yevmiye', dataKey: 'yevmiye', width: 20, align: 'right' as const },
      { header: 'Puantaj Gün', dataKey: 'puantajGun', width: 15, align: 'center' as const },
      { header: 'Mesai (Saat)', dataKey: 'mesaiSaat', width: 15, align: 'center' as const },
      { header: 'Hak Edilen Toplam', dataKey: 'hakEdilenToplam', width: 25, align: 'right' as const },
      { header: 'Resmi Alacak', dataKey: 'resmiHakEdilen', width: 22, align: 'right' as const },
      { header: 'Resmi Ödenen', dataKey: 'resmiOdenen', width: 22, align: 'right' as const },
      { header: 'Resmi Kalan', dataKey: 'resmiKalan', width: 22, align: 'right' as const },
      { header: 'Elden Alacak', dataKey: 'eldenHakEdilen', width: 22, align: 'right' as const },
      { header: 'Devir Bakiye', dataKey: 'devirBakiye', width: 20, align: 'right' as const },
      { header: 'Elden Avans', dataKey: 'eldenOdenenAvans', width: 22, align: 'right' as const },
      { header: 'Elden Kalan', dataKey: 'eldenKalan', width: 22, align: 'right' as const },
      { header: 'Genel Net Kalan', dataKey: 'genelKalanBakiye', width: 25, align: 'right' as const },
    ];

    let totalHakEdilen = 0;
    let totalResmiKalan = 0;
    let totalEldenKalan = 0;
    let totalNetKalan = 0;

    const data = filteredPayrollSummary.map((item) => {
      const p = item.personnel;
      totalHakEdilen += item.toplamHakedis || 0;
      totalResmiKalan += item.kalanResmiOdeme || 0;
      totalEldenKalan += item.kalanEldenOdeme || 0;
      totalNetKalan += item.netHakedis || 0;

      return {
        personel: `${p.isim} ${p.soyisim}`,
        kategori: p.kategori || '-',
        santiye: p.santiye || '-',
        yevmiye: formatCurrency(item.yevmiye || 0),
        puantajGun: `${item.puantajGun || 0} gün`,
        mesaiSaat: `${item.mesaiSaat || 0} sa`,
        hakEdilenToplam: formatCurrency(item.toplamHakedis || 0),
        resmiHakEdilen: formatCurrency(item.resmiAlacak || 0),
        resmiOdenen: formatCurrency(item.toplamResmiOdeme || 0),
        resmiKalan: formatCurrency(item.kalanResmiOdeme || 0),
        eldenHakEdilen: formatCurrency(item.eldenHakedis || 0),
        devirBakiye: item.eskiBakiye !== 0 ? formatCurrency(item.eskiBakiye) : '-',
        eldenOdenenAvans: formatCurrency(item.toplamAvans || 0),
        eldenKalan: formatCurrency(item.kalanEldenOdeme || 0),
        genelKalanBakiye: formatCurrency(item.netHakedis || 0),
      };
    });

    return {
      title: `Personel Bordro & Hakediş Cetveli (${selectedMonth})`,
      subtitle: `Dönem: ${selectedMonth} | Personel Sayısı: ${filteredPayrollSummary.length} kişi`,
      filename: `Bordro_Hakedis_${selectedMonth}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Hak Edilen Bordro', value: formatCurrency(totalHakEdilen) },
        { label: 'Kalan Resmi Alacak (Banka)', value: formatCurrency(totalResmiKalan) },
        { label: 'Kalan Elden Alacak (Nakit)', value: formatCurrency(totalEldenKalan) },
        { label: 'Ödenecek Genel Net Kalan', value: formatCurrency(totalNetKalan) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Kolay Erişilebilir Sabit (Sticky) Hakediş & Ödeme Alt Menü Kartları */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* 4 Büyük Erişim Kartı / Sekmesi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
            {/* 1. Tablo 2: Hakediş Cetveli */}
            <button
              type="button"
              onClick={() => setActiveSubTab('hakedis')}
              className={`group flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'hakedis'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-slate-50/80 hover:bg-emerald-50/60 text-slate-800 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeSubTab === 'hakedis'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    Tablo 2: Hakediş Cetveli
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      activeSubTab === 'hakedis' ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    Personel Bordro & Alacaklar
                  </div>
                </div>
              </div>
              <span
                className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-extrabold shrink-0 ${
                  activeSubTab === 'hakedis'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {activeOrBalancePayrollSummary.length}
              </span>
            </button>

            {/* 2. Taşeron Hakediş & Ekipleri */}
            <button
              type="button"
              onClick={() => setActiveSubTab('taseron')}
              className={`group flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'taseron'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/80 hover:bg-indigo-50/60 text-slate-800 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeSubTab === 'taseron'
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    Taşeron Hakediş & Ekipleri
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      activeSubTab === 'taseron' ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    Ekip Dağıtımı & Metraj
                  </div>
                </div>
              </div>
              <span
                className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-extrabold shrink-0 ${
                  activeSubTab === 'taseron'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {taseronlar.length}
              </span>
            </button>

            {/* 3. Tablo 5: Ödeme & Avans Hareketleri */}
            <button
              type="button"
              onClick={() => setActiveSubTab('odemeler')}
              className={`group flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'odemeler'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-500/20'
                  : 'bg-slate-50/80 hover:bg-amber-50/60 text-slate-800 border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeSubTab === 'odemeler'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    Tablo 5: Ödeme & Avans Hareketleri
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      activeSubTab === 'odemeler' ? 'text-amber-100' : 'text-slate-500'
                    }`}
                  >
                    Maaş, Avans & Hakediş Dökümü
                  </div>
                </div>
              </div>
              <span
                className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-extrabold shrink-0 ${
                  activeSubTab === 'odemeler'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {filteredOdemeler.length + filteredTaseronGiderler.length}
              </span>
            </button>

            {/* 4. Aylık / Yevmiyeli Analizi (Kadro) */}
            <button
              type="button"
              onClick={() => setActiveSubTab('analiz')}
              className={`group flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeSubTab === 'analiz'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-slate-50/80 hover:bg-blue-50/60 text-slate-800 border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeSubTab === 'analiz'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">
                    Aylık / Yevmiyeli Analizi
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      activeSubTab === 'analiz' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    Sabit Maaş & Günlük Kıyaslama
                  </div>
                </div>
              </div>
              <span
                className={`ml-2 px-2 py-0.5 rounded-lg text-[11px] font-extrabold shrink-0 ${
                  activeSubTab === 'analiz'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                Kadro
              </span>
            </button>
          </div>
        </div>

        {/* Dönem Seçici & Hızlı Ödeme Aksiyon Butonları */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">Bordro Dönemi:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
            <button
              type="button"
              onClick={() => setIsManageHakedisTurleriOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              title="Taşeron Hakediş & Ödeme Türlerini Tanımla veya Düzenle"
            >
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Hakediş Türleri</span>
            </button>

            <button
              onClick={() => openTaseronPaymentModal()}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              title="Taşeron ekibine dağıtımlı veya ekstra hakediş ödemesi yap"
            >
              <Layers className="w-4 h-4 text-indigo-200" />
              <span>Taşeron Ödemesi Yap</span>
            </button>

            <button
              onClick={() => {
                const currentSelectedExists = selectablePersonnelList.some(
                  (p) => p.id === newOdeme.personelId
                );
                let targetPerson = selectablePersonnelList.find((p) => p.id === newOdeme.personelId);
                if (!currentSelectedExists && selectablePersonnelList.length > 0) {
                  targetPerson = selectablePersonnelList[0];
                }
                const found = targetPerson
                  ? activeOrBalancePayrollSummary.find((item) => item.personnel.id === targetPerson.id)
                  : undefined;
                setNewOdeme((prev) => ({
                  ...prev,
                  personelId: targetPerson?.id || prev.personelId,
                  santiyeId: targetPerson?.santiyeId || santiyeler[0]?.id || prev.santiyeId || '',
                  miktar: round2(
                    found && prev.tur === 'resmi'
                      ? found.kalanResmiOdeme > 0
                        ? found.kalanResmiOdeme
                        : 0
                      : found && found.kalanEldenOdeme > 0
                      ? found.kalanEldenOdeme
                      : 2000
                  ),
                }));
                setIsPaymentModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Personel Ödeme / Avans</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Stat Banner - 4 Bölümlü Resmi / Elden Ayrımı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Kart 1: Toplam Hakediş */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {selectedMonth} Toplam Hakediş
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 font-mono">
              {formatCurrency(totalHakEdilen)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Taban Yevmiye + Fazla Mesai Toplamı
            </p>
          </div>
        </div>

        {/* Kart 2: Resmi Kesinti & Alacak (Ay Sonu Banka) */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              Resmi Alacak (Banka)
            </span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
              Ay Sonu Toplu
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Hak Edilen Resmi:</span>
              <span className="text-sm font-bold text-indigo-950 font-mono">
                {formatCurrency(totalResmiAlacak)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-500 mt-0.5">
              <span>Banka Ödenen:</span>
              <span className="font-semibold text-emerald-600 font-mono">
                {formatCurrency(totalOdenenResmi)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs font-bold text-indigo-900 mt-1 pt-1 border-t border-indigo-100">
              <span>Kalan Resmi Bakiye:</span>
              <span className="text-sm font-black text-indigo-700 font-mono">
                {formatCurrency(totalKalanResmi)}
              </span>
            </div>
          </div>
        </div>

        {/* Kart 3: Elden Alacak (Avans Hesabı) */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-amber-600" />
              Elden Alacak (Avans)
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              Elden / Kasa
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Hak Edilen Elden:</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(totalEldenAlacak)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-500 mt-0.5">
              <span>Çekilen Avanslar:</span>
              <span className="font-semibold text-amber-600 font-mono">
                -{formatCurrency(totalOdenenAvans)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs font-bold text-amber-900 mt-1 pt-1 border-t border-amber-100">
              <span>Kalan Elden Bakiye:</span>
              <span className="text-sm font-black text-amber-700 font-mono">
                {formatCurrency(totalKalanElden)}
              </span>
            </div>
          </div>
        </div>

        {/* Kart 4: Kalan Personel Alacağı */}
        <div className="p-4 rounded-2xl border border-slate-900/40 shadow-sm flex flex-col justify-between bg-slate-950 text-white relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-400" />
                Kalan Personel Alacağı
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-bold px-2 py-0.5 rounded-full">
                Net Bakiye
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {formatCurrency(totalNetKalan)}
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                Ödenen: <strong className="text-white font-mono">{formatCurrency(totalOdenenGenel)}</strong>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/90 space-y-1.5 text-xs">
            {/* Resmi Banka Kırılımı */}
            <div className="flex items-center justify-between bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1 text-[11px]">
                <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                Resmi (Banka):
              </span>
              <div className="text-right font-mono">
                <span className="font-bold text-indigo-300 text-xs">Kalan: {formatCurrency(totalKalanResmi)}</span>
                <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                  (Ödenen: <strong className="text-emerald-400">{formatCurrency(totalOdenenResmi)}</strong>)
                </span>
              </div>
            </div>

            {/* Elden Avans Kırılımı */}
            <div className="flex items-center justify-between bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold flex items-center gap-1 text-[11px]">
                <Banknote className="w-3.5 h-3.5 text-amber-400" />
                Elden (Avans):
              </span>
              <div className="text-right font-mono">
                <span className="font-bold text-amber-300 text-xs">Kalan: {formatCurrency(totalKalanElden)}</span>
                <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                  (Ödenen: <strong className="text-emerald-400">{formatCurrency(totalOdenenAvans)}</strong>)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: TABLO 2 - HAKEDİŞ CETVELİ */}
      {activeSubTab === 'hakedis' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header & Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Veritabanı Tablosu 2: Personel Hakediş Cetveli ({selectedMonth})
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                    Resmi Kesinti = Resmi Maaş ÷ 30 | Kalan = Elden Alacak
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Çalışılan her gün için yevmiyeden asgari resmi kesinti yapılır ve ay sonunda toplu bankadan ödenir. Avanslar ise elden hakedişten düşer.
                </p>
              </div>

              {/* Arama & Şantiye Filtresi & Ücret Modeli Filtresi */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Ücret Modeli Filtre Pilleri */}
                <div className="flex items-center p-0.5 bg-slate-200/70 rounded-xl text-xs font-semibold shrink-0">
                  <button
                    type="button"
                    onClick={() => setWageTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      wageTypeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tümü ({activeOrBalancePayrollSummary.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWageTypeFilter('aylik')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      wageTypeFilter === 'aylik'
                        ? 'bg-white text-blue-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-blue-800'
                    }`}
                  >
                    <Briefcase className="w-3 h-3 text-blue-600" />
                    <span>Aylık Sabit ({aylikWorkers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWageTypeFilter('yevmiye')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      wageTypeFilter === 'yevmiye'
                        ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-emerald-800'
                    }`}
                  >
                    <HardHat className="w-3 h-3 text-emerald-600" />
                    <span>Günlük Yevmiyeli ({yevmiyeWorkers.length})</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Personel, TC, kategori veya şantiye ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <select
                  value={santiyeFilter}
                  onChange={(e) => setSantiyeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                >
                  <option value="all">Tüm Şantiyeler</option>
                  {uniqueSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <ExportButton
                  options={getPayrollExportOptions}
                  buttonText="Bordroyu Dışa Aktar"
                  variant="secondary"
                />
              </div>
            </div>

            {/* Bilgilendirme Notu */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 flex items-start gap-2 text-xs text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <b>Hesaplama Sistemi:</b> Personel kaç gün çalıştıysa <i>(Örn: 10 gün)</i>, tanımlı resmi maaşından günlük kesinti <i>(28.000 ÷ 30 = 933,33 ₺)</i> hesaplanıp <b>Resmi Alacak</b> hanesine yazılır ve ay sonunda bankadan toplu ödenir. Yevmiyesinden geriye kalan tutar <i>(3.000 - 933,33 = 2.066,67 ₺/gün)</i> ve mesailer <b>Elden Hakediş</b> olarak ayrılır; personelin çektiği avanslar bu elden hakedişten mahsup edilir.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3">Personel</th>
                  <th className="px-3 py-3">Yevmiye & Kesinti</th>
                  <th className="px-3 py-3 text-center">Puantaj / Mesai</th>
                  <th className="px-3 py-3 text-right">Hak Edilen Toplam</th>
                  <th className="px-3 py-3 text-right bg-indigo-50/40">
                    <span className="text-indigo-900 font-bold block">Resmi Alacak (Banka)</span>
                    <span className="text-[10px] text-indigo-600 font-normal">Hak Edilen • Ödenen • Kalan</span>
                  </th>
                  <th className="px-3 py-3 text-right bg-amber-50/40">
                    <span className="text-amber-950 font-bold block">Elden Alacak (Avans)</span>
                    <span className="text-[10px] text-amber-700 font-normal">Hak Edilen • Avans • Kalan</span>
                  </th>
                  <th className="px-4 py-3 text-right bg-slate-100/60 font-bold text-slate-900">
                    Genel Net Kalan
                  </th>
                  <th className="px-3 py-3 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayrollSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Arama kriterlerine uygun personel bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredPayrollSummary.map((item) => {
                    const p = item.personnel;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Personel Bilgisi */}
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{p.isim} {p.soyisim}</span>
                            {p.ucretTipi === 'aylik' || Boolean(!p.ucretTipi && p.maas && (!p.yevmiye || p.yevmiye === 0)) ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <Briefcase className="w-2.5 h-2.5 text-blue-600" />
                                Aylık Sabit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <HardHat className="w-2.5 h-2.5 text-emerald-600" />
                                Günlük
                              </span>
                            )}
                            {p.sigorta && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                SGK
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{p.kategori}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{p.santiye || 'Şantiye yok'}</span>
                          </div>
                        </td>

                        {/* Yevmiye & Günlük Kesinti Dağılımı */}
                        <td className="px-3 py-3">
                          {item.personnel.ucretTipi === 'aylik' ? (
                            <div>
                              <div className="font-bold text-blue-900 font-mono text-xs flex items-center gap-1">
                                {formatCurrency(item.personnel.maas || item.yevmiye * 30)}
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-sm font-sans font-bold">Aylık</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Günlük: {formatCurrency(item.yevmiye)}/g
                              </div>
                              <div className="text-[11px] text-indigo-700 font-mono mt-0.5" title={`Resmi Maaş: ${formatCurrency(item.resmiMaas)}/30`}>
                                Resmi: <span className="font-semibold">{formatCurrency(item.gunlukResmiKesinti)}/g</span>
                              </div>
                              <div className="text-[11px] text-amber-700 font-mono">
                                Elden: <span className="font-semibold">{formatCurrency(item.gunlukEldenTutar)}/g</span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-slate-900 font-mono text-xs">
                                {formatCurrency(item.yevmiye)}
                              </div>
                              <div className="text-[11px] text-indigo-700 font-mono mt-0.5" title={`Resmi Maaş: ${formatCurrency(item.resmiMaas)}/30`}>
                                Resmi: <span className="font-semibold">{formatCurrency(item.gunlukResmiKesinti)}/g</span>
                              </div>
                              <div className="text-[11px] text-amber-700 font-mono">
                                Elden: <span className="font-semibold">{formatCurrency(item.gunlukEldenTutar)}/g</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Puantaj & Mesai */}
                        <td className="px-3 py-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold text-xs">
                            {item.puantajGun.toFixed(1)} Gün
                          </span>
                          {item.mesaiSaat > 0 ? (
                            <div className="mt-1">
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px]">
                                {item.mesaiSaat}s Mesai (+{formatCurrency(item.mesaiTutari)})
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 mt-0.5">Mesai yok</div>
                          )}
                        </td>

                        {/* Hak Edilen Toplam (Brüt) */}
                        <td className="px-3 py-3 text-right font-bold text-slate-900 font-mono">
                          <div>{formatCurrency(item.toplamHakedis)}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            Taban: {formatCurrency(item.tabanHakedis)}
                          </div>
                        </td>

                        {/* Resmi Alacak (Ay Sonu Banka) */}
                        <td className="px-3 py-3 text-right bg-indigo-50/30">
                          <div className="text-xs text-indigo-950 font-bold font-mono">
                            {formatCurrency(item.resmiAlacak)}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Ödenen: <span className="text-emerald-700">{formatCurrency(item.toplamResmiOdeme)}</span>
                          </div>
                          <div className="mt-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-100 text-indigo-900 border border-indigo-200">
                              Kalan: {formatCurrency(item.kalanResmiOdeme)}
                            </span>
                          </div>
                          <div className="mt-1 pt-1 border-t border-indigo-100 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenResmiGunModal(item)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                                item.isManualResmiGun
                                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 shadow-xs'
                                  : 'bg-indigo-100/70 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                              }`}
                              title={`${selectedMonth} dönemi resmi çalışma gününü manuel değiştir (${item.isManualResmiGun ? 'Manuel ayarlandı' : 'Puantaj gününe eşit'})`}
                            >
                              <span>Resmi: {item.resmiGun}g</span>
                              {item.isManualResmiGun ? (
                                <span className="text-[9px] px-1 rounded bg-amber-500 text-white font-sans font-bold">Manuel</span>
                              ) : null}
                              <Pencil className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          </div>
                        </td>

                        {/* Elden Alacak (Avans Hesabı) */}
                        <td className="px-3 py-3 text-right bg-amber-50/30">
                          <div className="text-xs text-amber-950 font-bold font-mono">
                            {formatCurrency(item.eldenHakedis)}
                          </div>
                          {item.eskiBakiye !== 0 && (
                            <div className={`text-[10px] font-mono font-semibold ${item.eskiBakiye > 0 ? 'text-emerald-700' : 'text-rose-600'}`} title="Devreden Eski Bakiye bu tutara dahildir">
                              (Devir Dahil: {item.eskiBakiye > 0 ? '+' : ''}{formatCurrency(item.eskiBakiye)})
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 font-mono">
                            Avans: <span className="text-amber-700">-{formatCurrency(item.toplamAvans)}</span>
                          </div>
                          {item.toplamCeza > 0 && (
                            <div className="text-[10px] text-rose-500 font-mono">
                              Ceza: -{formatCurrency(item.toplamCeza)}
                            </div>
                          )}
                          <div className="mt-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-200">
                              Kalan: {formatCurrency(item.kalanEldenOdeme)}
                            </span>
                          </div>
                        </td>

                        {/* Genel Net Kalan */}
                        <td className="px-4 py-3 text-right bg-slate-100/40">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono block text-right ${
                              item.netHakedis > 0
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {formatCurrency(item.netHakedis)}
                          </span>
                        </td>

                        {/* Hızlı İşlem */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => {
                              setNewOdeme({
                                ...newOdeme,
                                personelId: p.id,
                                santiyeId: p.santiyeId || santiyeler[0]?.id || '',
                                miktar: round2(item.kalanEldenOdeme > 0 ? item.kalanEldenOdeme : (item.kalanResmiOdeme > 0 ? item.kalanResmiOdeme : 2000)),
                                tur: item.kalanEldenOdeme > 0 ? 'avans' : 'resmi',
                              });
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 mx-auto"
                            title="Ödeme veya Avans Ekle"
                          >
                            <Plus className="w-3 h-3 text-emerald-600" />
                            <span>Ödeme</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW: TAŞERON HAKEDİŞ & EKİP ALACAKLARI */}
      {activeSubTab === 'taseron' && (
        <div className="space-y-4">
          {/* Subcontractor Aggregate Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Kayıtlı Taşeron
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 font-mono">
                  {taseronlar.length}
                </span>
                <span className="text-xs text-slate-400">Firma</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Ekip Personeli
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-700 font-mono">
                  {totalTaseronEkip}
                </span>
                <span className="text-xs text-slate-400">Kişi</span>
              </div>
            </div>

            <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
                Kalan Resmi (Banka)
              </span>
              <div className="mt-1">
                <span className="text-lg font-black text-indigo-900 font-mono">
                  {formatCurrency(totalTaseronKalanResmi)}
                </span>
              </div>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-100 shadow-xs">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                Kalan Elden / Avans
              </span>
              <div className="mt-1">
                <span className="text-lg font-black text-amber-900 font-mono">
                  {formatCurrency(totalTaseronKalanElden)}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                Net Kalan Toplam
              </span>
              <div className="mt-1">
                <span className="text-lg font-black text-emerald-900 font-mono">
                  {formatCurrency(totalTaseronNetKalan)}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                Doğrudan Ekstra Hakediş
              </span>
              <div className="mt-1">
                <span className="text-lg font-black text-amber-300 font-mono">
                  {formatCurrency(totalTaseronEkstra)}
                </span>
              </div>
            </div>
          </div>

          {/* Subcontractor Cards Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Taşeron Grupları ve Ekip Alacakları ({selectedMonth})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Taşerona bağlı personellerin avans ve resmi alacakları ayrı ayrı listelenir. Taşerona yapılan ödemeler personellerin hakedişinden düşülür veya bağımsız ekstra hakediş olarak işlenebilir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allExpanded = taseronlar.every((t) => expandedTaseronIds[t.id]);
                  const newState: Record<string, boolean> = {};
                  taseronlar.forEach((t) => {
                    newState[t.id] = !allExpanded;
                  });
                  setExpandedTaseronIds(newState);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
              >
                {taseronlar.every((t) => expandedTaseronIds[t.id])
                  ? 'Tüm Ekipleri Daralt'
                  : 'Tüm Ekipleri Genişlet'}
              </button>
            </div>
          </div>

          {/* Subcontractor List */}
          {taseronStats.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Henüz Kayıtlı Taşeron Bulunmuyor</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Taşeron ödemesi yapabilmek ve ekiplerin alacaklarını takip edebilmek için "Taşeron & Tedarikçi" menüsünden taşeron ekleyebilir ve personelleri ilgili taşerona bağlayabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {taseronStats.map((stat) => {
                const isExpanded = !!expandedTaseronIds[stat.taseron.id];
                return (
                  <div
                    key={stat.taseron.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Taşeron Kart Üst Başlık */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/40">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-black text-slate-900 text-base sm:text-lg">
                            {stat.taseron.isim}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/50">
                            {stat.taseron.uzmanlik}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                            Ekip: {stat.ekipSayisi} Personel
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {stat.taseron.yetkili && (
                            <span>
                              Yetkili: <strong className="text-slate-700">{stat.taseron.yetkili}</strong>
                            </span>
                          )}
                          {stat.taseron.telefon && (
                            <span>
                              Tel: <strong className="text-slate-700">{stat.taseron.telefon}</strong>
                            </span>
                          )}
                          {stat.taseron.santiyeler && stat.taseron.santiyeler.length > 0 && (
                            <span>
                              Şantiyeler: <strong className="text-slate-700">{stat.taseron.santiyeler.join(', ')}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Aksiyon Butonları */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={() => openTaseronPaymentModal(stat.taseron.id, 'group')}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                          title="Taşeron ekibindeki personellerin avans veya resmi hakedişlerinden düşecek şekilde ödeme yap"
                        >
                          <Banknote className="w-4 h-4 text-indigo-200" />
                          <span>Taşeron Ekip Ödemesi</span>
                        </button>

                        <button
                          onClick={() => openTaseronPaymentModal(stat.taseron.id, 'extra')}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                          title="Personel hakedişinden bağımsız olarak taşerona doğrudan sözleşme, metraj veya ekstra ödeme yap"
                        >
                          <Sparkles className="w-4 h-4 text-amber-200" />
                          <span>Ekstra Hakediş Öde</span>
                        </button>

                        <button
                          onClick={() => toggleTaseronAccordion(stat.taseron.id)}
                          className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title={isExpanded ? 'Ekip listesini gizle' : 'Ekip listesini göster'}
                        >
                          <span>{isExpanded ? 'Gizle' : 'Detay'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Finansal Özet Çubuğu */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-100 border-t border-b border-slate-200 bg-white">
                      <div className="p-3">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Toplam Hak Edilen
                        </span>
                        <span className="text-sm sm:text-base font-bold text-slate-800 font-mono block mt-0.5">
                          {formatCurrency(stat.toplamHakedis)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {stat.puantajGun} Gün Puantaj • {stat.mesaiSaat} Sa. Mesai
                        </span>
                      </div>

                      <div className="p-3 bg-indigo-50/40">
                        <span className="text-[11px] font-bold text-indigo-900 block">
                          Kalan Resmi Alacak (Banka)
                        </span>
                        <span className="text-sm sm:text-base font-black text-indigo-700 font-mono block mt-0.5">
                          {formatCurrency(stat.kalanResmi)}
                        </span>
                        <span className="text-[10px] text-indigo-600">
                          Ödenen: {formatCurrency(stat.odenenResmi)}
                        </span>
                      </div>

                      <div className="p-3 bg-amber-50/40">
                        <span className="text-[11px] font-bold text-amber-900 block">
                          Kalan Elden / Avans Alacak
                        </span>
                        <span className="text-sm sm:text-base font-black text-amber-700 font-mono block mt-0.5">
                          {formatCurrency(stat.kalanElden)}
                        </span>
                        <span className="text-[10px] text-amber-600">
                          Çekilen Avans: {formatCurrency(stat.odenenAvans)}
                        </span>
                      </div>

                      <div className="p-3 bg-emerald-50/40">
                        <span className="text-[11px] font-bold text-emerald-900 block">
                          Net Kalan Toplam Alacak
                        </span>
                        <span className="text-sm sm:text-base font-black text-emerald-700 font-mono block mt-0.5">
                          {formatCurrency(stat.netKalan)}
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          Resmi + Elden Toplamı
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Doğrudan Ekstra Hakediş
                        </span>
                        <span className="text-sm sm:text-base font-black text-slate-900 font-mono block mt-0.5">
                          {formatCurrency(stat.toplamEkstra)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Personel hakedişinden bağımsız
                        </span>
                      </div>

                      <div className="p-3 bg-cyan-50/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-cyan-950 block truncate">
                              Firma Cari Bakiye
                            </span>
                            {onNavigateToCompanies && stat.cariInfo?.firma && (
                              <button
                                type="button"
                                onClick={() => onNavigateToCompanies(stat.cariInfo?.firma?.id)}
                                className="text-[10px] text-cyan-700 hover:text-cyan-950 font-bold underline cursor-pointer shrink-0"
                                title="Taşeronun Firma Cari Hareketlerini İncele"
                              >
                                Cari ↗
                              </button>
                            )}
                          </div>
                          <span
                            className={`text-sm sm:text-base font-black font-mono block mt-0.5 ${
                              (stat.cariInfo?.netBakiyeTRY || 0) > 0
                                ? 'text-amber-700'
                                : (stat.cariInfo?.netBakiyeTRY || 0) < 0
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {formatCurrency(Math.abs(stat.cariInfo?.netBakiyeTRY || 0))}
                          </span>
                        </div>
                        <span className="text-[10px] text-cyan-800 font-medium truncate">
                          {(stat.cariInfo?.netBakiyeTRY || 0) > 0
                            ? 'Taşerona Borçlu'
                            : (stat.cariInfo?.netBakiyeTRY || 0) < 0
                            ? 'Taşeron Alacaklı'
                            : 'Bakiye Sıfır'}
                          {stat.cariInfo?.recordsCount ? ` (${stat.cariInfo.recordsCount} Hrk)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Genişletilmiş Ekip Personel Tablosu (Avans ve Resmi Alacaklar Ayrı Ayrı) */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-600" />
                            <span>{stat.taseron.isim} Ekibine Dahil Personeller ve Alacak Durumları</span>
                          </h4>
                          <span className="text-xs text-slate-500 font-medium">
                            Toplam {stat.workers.length} çalışan
                          </span>
                        </div>

                        {stat.workers.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                            Bu taşerona atanmış personel bulunamadı. Personel kartından "Taşeron" alanını bu taşeron olarak seçebilirsiniz.
                          </div>
                        ) : (
                          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                                <tr>
                                  <th className="px-3 py-2.5">Personel Adı Soyadı</th>
                                  <th className="px-3 py-2.5">Meslek / Görev</th>
                                  <th className="px-3 py-2.5 text-center">Puantaj / Mesai</th>
                                  <th className="px-3 py-2.5 text-right">Yevmiye / Maaş</th>
                                  <th className="px-3 py-2.5 text-right bg-indigo-50/50 text-indigo-900">
                                    Resmi Alacak (Banka)
                                  </th>
                                  <th className="px-3 py-2.5 text-right bg-indigo-50/50 text-indigo-900 font-bold">
                                    Kalan Resmi
                                  </th>
                                  <th className="px-3 py-2.5 text-right bg-amber-50/50 text-amber-900">
                                    Elden Alacak
                                  </th>
                                  <th className="px-3 py-2.5 text-right bg-amber-50/50 text-amber-900 font-bold">
                                    Kalan Elden / Avans
                                  </th>
                                  <th className="px-3 py-2.5 text-right bg-emerald-50/50 text-emerald-900 font-bold">
                                    Net Kalan Alacak
                                  </th>
                                  <th className="px-3 py-2.5 text-center">İşlem</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {stat.workers.map((item) => {
                                  const p = item.personnel;
                                  return (
                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="px-3 py-2.5 font-bold text-slate-900">
                                        <div className="flex items-center gap-1.5">
                                          <span>{p.isim} {p.soyisim}</span>
                                        </div>
                                        {p.TCNO && (
                                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                                            TC: {p.TCNO}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-600">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium">
                                          {p.kategori || 'Usta'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono">
                                        <span className="font-semibold text-slate-800">{item.puantajGun} Gün</span>
                                        {item.mesaiSaat > 0 && (
                                          <span className="text-[10px] text-amber-700 block font-medium">
                                            +{item.mesaiSaat} Sa.
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                                        <div>{formatCurrency(item.yevmiye)}/gün</div>
                                        <div className="text-[10px] text-slate-400">
                                          Maaş: {formatCurrency(item.resmiMaas)}
                                        </div>
                                      </td>

                                      {/* Resmi Alacak & Kalan Resmi */}
                                      <td className="px-3 py-2.5 text-right font-mono bg-indigo-50/20 text-slate-700">
                                        <div>{formatCurrency(item.resmiAlacak)}</div>
                                        <div className="text-[10px] text-slate-400">
                                          Ödenen: {formatCurrency(item.toplamResmiOdeme)}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono bg-indigo-50/40">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                                          item.kalanResmiOdeme > 0
                                            ? 'text-indigo-800 bg-indigo-100'
                                            : 'text-slate-400'
                                        }`}>
                                          {formatCurrency(item.kalanResmiOdeme)}
                                        </span>
                                      </td>

                                      {/* Elden Alacak & Kalan Avans/Elden */}
                                      <td className="px-3 py-2.5 text-right font-mono bg-amber-50/20 text-slate-700">
                                        <div>{formatCurrency(item.eldenHakedis)}</div>
                                        <div className="text-[10px] text-slate-400">
                                          Avans: {formatCurrency(item.toplamAvans)}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono bg-amber-50/40">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                                          item.kalanEldenOdeme > 0
                                            ? 'text-amber-900 bg-amber-100'
                                            : 'text-slate-400'
                                        }`}>
                                          {formatCurrency(item.kalanEldenOdeme)}
                                        </span>
                                      </td>

                                      {/* Net Kalan */}
                                      <td className="px-3 py-2.5 text-right font-mono bg-emerald-50/30">
                                        <span className={`px-2 py-0.5 rounded-md font-black text-xs ${
                                          item.netHakedis > 0
                                            ? 'text-emerald-900 bg-emerald-100'
                                            : 'text-slate-400'
                                        }`}>
                                          {formatCurrency(item.netHakedis)}
                                        </span>
                                      </td>

                                      {/* Bireysel Öde Butonu */}
                                      <td className="px-3 py-2.5 text-center">
                                        <button
                                          onClick={() => {
                                            setNewOdeme({
                                              ...newOdeme,
                                              personelId: p.id,
                                              miktar: round2(
                                                item.kalanEldenOdeme > 0
                                                  ? item.kalanEldenOdeme
                                                  : item.kalanResmiOdeme > 0
                                                  ? item.kalanResmiOdeme
                                                  : 2000
                                              ),
                                              tur: item.kalanEldenOdeme > 0 ? 'avans' : 'resmi',
                                              aciklama: `[Taşeron: ${stat.taseron.isim}] Bireysel ödeme`,
                                            });
                                            setIsPaymentModalOpen(true);
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer whitespace-nowrap"
                                          title="Bu personele doğrudan bireysel ödeme yap"
                                        >
                                          Bireysel Öde
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 2. Bölüm: Taşerona Doğrudan Yapılan Hakediş & Ekstra Ödemeler */}
                        <div className="mt-5 pt-4 border-t border-slate-200/80">
                          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                <span>{stat.taseron.isim} — Doğrudan Yapılan Hakediş & Ekstra Ödemeler ({stat.ekstraOdemeler.length})</span>
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Ekip dağıtımı dışında doğrudan taşeron firmasına / ustabaşına kesilen metraj ve hakediş ödemeleri
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openTaseronPaymentModal(stat.taseron.id, 'extra')}
                              className="px-2.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Yeni Hakediş Öde</span>
                            </button>
                          </div>

                          {stat.ekstraOdemeler.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                              Bu dönemde {stat.taseron.isim} taşeronuna doğrudan yapılmış metraj veya ekstra hakediş ödemesi kaydı bulunmuyor.
                            </div>
                          ) : (
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-amber-50/40 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                                  <tr>
                                    <th className="px-3 py-2.5">Tarih</th>
                                    <th className="px-3 py-2.5">Hakediş Başlığı / Açıklama</th>
                                    <th className="px-3 py-2.5">Şantiye</th>
                                    <th className="px-3 py-2.5">Ödeme Yöntemi</th>
                                    <th className="px-3 py-2.5 text-right">Tutar</th>
                                    <th className="px-3 py-2.5 text-center">Durum</th>
                                    <th className="px-3 py-2.5 text-right">İşlemler</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {stat.ekstraOdemeler.map((g) => {
                                    const site = santiyeler.find((s) => s.id === g.santiyeId);
                                    return (
                                      <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                                          {g.tarih}
                                        </td>
                                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                                          {g.aciklama || 'Taşeron Hakediş'}
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600">
                                          {site ? site.isim : (g.santiyeId || '-')}
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600">
                                          {g.odemeYontemi || 'Banka Transferi'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-black font-mono text-slate-900 text-sm">
                                          {formatCurrency(g.miktar)}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            g.durum === 'Ödendi' 
                                              ? 'bg-emerald-100 text-emerald-800' 
                                              : g.durum === 'Beklemede' 
                                              ? 'bg-amber-100 text-amber-800' 
                                              : 'bg-rose-100 text-rose-800'
                                          }`}>
                                            {g.durum || 'Ödendi'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => setEditingTaseronGider(g)}
                                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                              title="Hakediş Ödemesini Düzenle"
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => {
                                                const tName = stat.taseron?.isim || 'Taşeron';
                                                setDeleteConfirm({
                                                  isOpen: true,
                                                  title: 'Hakediş Ödemesini Sil',
                                                  description: `${tName} için kaydedilen ${g.tarih} tarihli ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki hakediş ödeme kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                                  onConfirm: () => onDeleteGider && onDeleteGider(g.id),
                                                });
                                              }}
                                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                              title="Kaydı Sil"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: TABLO 5 - PERSONEL & TAŞERON ÖDEME VE HAKEDİŞ HAREKETLERİ */}
      {activeSubTab === 'odemeler' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Veritabanı Tablosu 5: Ödeme & Hakediş Hareketleri
                </h3>
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-[11px] font-bold">
                  {odemelerTableCategory === 'all' 
                    ? filteredOdemeler.length + filteredTaseronGiderler.length 
                    : odemelerTableCategory === 'personnel' 
                    ? filteredOdemeler.length 
                    : filteredTaseronGiderler.length} Kayıt
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Personele elden veya bankadan yapılan ödemeler ile taşeronlara yapılan hakedişler. Kayıtları düzenleyebilir veya silebilirsiniz.
              </p>
            </div>

            {/* Filtre ve Kategori Seçenekleri */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dönem / Ay Filtresi (Tablo 5 Hareketleri Sıfırlanmasın, Tüm Zamanlar veya İstenen Ay Görülsün) */}
              <div className="w-full sm:w-48">
                <select
                  value={odemelerMonthFilter}
                  onChange={(e) => setOdemelerMonthFilter(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-indigo-200 bg-white font-bold text-indigo-950 shadow-2xs cursor-pointer hover:border-indigo-400"
                  title="Dönem Filtresi (Tüm hareketler için 'Tüm Dönemler' seçebilirsiniz)"
                >
                  <option value="all">📅 Tüm Dönemler (Tüm Zamanlar)</option>
                  {odemelerAvailableMonths.map((m) => (
                    <option key={m} value={m}>
                      📅 {m} Dönemi {m === selectedMonth ? ' (Bordro Ayı)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Switcher */}
              <div className="flex items-center p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setOdemelerTableCategory('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    odemelerTableCategory === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tümü ({filteredOdemeler.length + filteredTaseronGiderler.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOdemelerTableCategory('personnel')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    odemelerTableCategory === 'personnel'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Personel ({filteredOdemeler.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOdemelerTableCategory('taseron')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    odemelerTableCategory === 'taseron'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Taşeron ({filteredTaseronGiderler.length})
                </button>
              </div>

              {/* Personel Filtresi */}
              {odemelerTableCategory !== 'taseron' && (
                <div className="w-full sm:w-44">
                  <select
                    value={selectedPersonnelFilter}
                    onChange={(e) => setSelectedPersonnelFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
                  >
                    <option value="all">Tüm Personel</option>
                    {selectablePersonnelList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isim} {p.soyisim}{p.durum === 'Pasif' ? ' (Pasif - Bakiyeli)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Taşeron Filtresi */}
              {odemelerTableCategory !== 'personnel' && (
                <div className="w-full sm:w-44">
                  <select
                    value={selectedTaseronFilter}
                    onChange={(e) => setSelectedTaseronFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
                  >
                    <option value="all">Tüm Taşeronlar</option>
                    {Array.from(
                      new Set([
                        ...taseronlar.map((t) => t.isim),
                        ...firmalar.filter((f) => f.tur === 'taseron').map((f) => f.isim),
                        ...allTaseronPayments.map((g) => g.taseron || g.odemeYapilanFirma || '').filter(Boolean),
                      ])
                    ).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3">Hak Sahibi / Alıcı</th>
                  <th className="px-4 py-3">Tarih & Saat</th>
                  <th className="px-4 py-3">Ödeme Türü</th>
                  <th className="px-4 py-3">Ödeme Yöntemi</th>
                  <th className="px-4 py-3 text-right">Tutar</th>
                  <th className="px-4 py-3">Açıklama / Şantiye</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Personel Ödemeleri */}
                {(odemelerTableCategory === 'all' || odemelerTableCategory === 'personnel') &&
                  filteredOdemeler.map((o) => {
                    const person = personnelList.find((p) => p.id === o.personelId);

                    const anyO = o as any;
                    let typeLabel = 'Elden Avans';
                    let typeBadge = 'bg-amber-50 text-amber-800 border-amber-200';
                    let amount = (typeof o.avansOdemesi === 'number' && o.avansOdemesi > 0)
                      ? o.avansOdemesi
                      : (anyO.tur === 'avans' && typeof anyO.miktar === 'number')
                      ? anyO.miktar
                      : (o.avansOdemesi || 0);

                    if (o.resmiOdeme > 0 || anyO.tur === 'resmi') {
                      typeLabel = 'Resmi Banka Ödemesi';
                      typeBadge = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                      amount = o.resmiOdeme || anyO.miktar || 0;
                    } else if (o.yaptigiHarcama > 0 || anyO.tur === 'harcama') {
                      typeLabel = 'Yaptığı Harcama (İade)';
                      typeBadge = 'bg-blue-50 text-blue-800 border-blue-200';
                      amount = o.yaptigiHarcama || anyO.miktar || 0;
                    } else if (o.cezaMiktari > 0 || anyO.tur === 'ceza') {
                      typeLabel = 'Ceza / Kesinti';
                      typeBadge = 'bg-rose-50 text-rose-800 border-rose-200';
                      amount = o.cezaMiktari || anyO.miktar || 0;
                    } else if (o.avansOdemesi > 0 || anyO.tur === 'avans') {
                      typeLabel = 'Elden Avans';
                      typeBadge = 'bg-amber-50 text-amber-800 border-amber-200';
                      amount = o.avansOdemesi || anyO.miktar || 0;
                    }

                    const isFx = o.paraBirimi && o.paraBirimi !== 'TRY';
                    const tlEquiv = isFx ? convertCurrencyToTRY(amount, o.paraBirimi, exchangeRates.rates) : amount;

                    return (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span>{person ? `${person.isim} ${person.soyisim}` : 'Bilinmeyen'}</span>
                            {person?.taseron && (
                              <span className="text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                {person.taseron}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                          <div>{o.tarih} {o.saat}</div>
                          <div className="text-[10px] text-indigo-700 font-sans font-semibold mt-0.5">
                            Bordro: {getOdemeBordroDonemi(o)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${typeBadge}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {o.odemeYontemi || 'Nakit'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <div className="font-bold text-slate-900">
                            {formatCurrency(amount, o.paraBirimi || 'TRY')}
                          </div>
                          {isFx && (
                            <div className="text-[10px] text-indigo-700 font-semibold mt-0.5" title={`Kur: ${getCurrencyExchangeRate(o.paraBirimi, exchangeRates.rates)} ₺`}>
                              ≈ {formatCurrency(tlEquiv, 'TRY')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          <div>{o.aciklama || '-'}</div>
                          {(() => {
                            const siteName = o.santiyeAdi || santiyeler.find((s) => s.id === o.santiyeId)?.isim || person?.santiye;
                            if (siteName) {
                              return (
                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-md px-1.5 py-0.5">
                                  <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>Şantiye: {siteName}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingPersonelOdeme(o)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Personel Ödeme Kaydını Düzenle"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const targetPerson = personnelList.find((p) => p.id === o.personelId);
                                const personLabel = targetPerson ? `${targetPerson.isim} ${targetPerson.soyisim}` : 'Personel';
                                const paymentAmount = (o.avansOdemesi || 0) > 0 ? o.avansOdemesi : (o.resmiOdeme || 0) > 0 ? o.resmiOdeme : (o as any).miktar || 0;
                                const isCekOdeme = Boolean(
                                  o.cekId ||
                                  o.odemeYontemi?.toLowerCase().includes('çek') ||
                                  o.odemeYontemi?.toLowerCase().includes('cek') ||
                                  o.aciklama?.toLowerCase().includes('çek')
                                );

                                setDeleteConfirm({
                                  isOpen: true,
                                  title: isCekOdeme ? 'Çek Ödeme Kaydını Sil' : 'Ödeme Kaydını Sil',
                                  description: isCekOdeme
                                    ? `${personLabel} için verilen ${o.tarih} tarihli ${formatCurrency(paymentAmount, o.paraBirimi || 'TRY')} tutarındaki çek ödemesini silmek istediğinize emin misiniz? Çift yönlü tam senkronizasyon gereğince bu işlem Firma Cari Hesabından ve Çek Takibi bölümünden ilgili çeki de otomatik olarak silecektir.`
                                    : `${personLabel} için kaydedilen ${o.tarih} tarihli ${formatCurrency(paymentAmount, o.paraBirimi || 'TRY')} tutarındaki ödeme kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                  onConfirm: () => {
                                    if (o.cekId && onDeleteCek) {
                                      onDeleteCek(o.cekId);
                                    } else {
                                      onDeleteOdeme(o.id);
                                    }
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Kaydı Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {/* 2. Taşeron Hakediş & Firma Cari Ödemeleri */}
                {(odemelerTableCategory === 'all' || odemelerTableCategory === 'taseron') &&
                  filteredTaseronGiderler.map((g) => {
                    const site = santiyeler.find((s) => s.id === g.santiyeId);
                    const taseronName = g.taseron || g.odemeYapilanFirma || 'Taşeron';
                    const isFxGider = g.paraBirimi && g.paraBirimi !== 'TRY';
                    const tlEquivGider = isFxGider ? convertCurrencyToTRY(g.miktar, g.paraBirimi, exchangeRates.rates) : g.miktar;
                    const isFromCari = (g as any).isFromCariOnly || g.kategori === 'Firma Cari Ödemesi' || g.odemeYontemi === 'Firma Cari Hesabı';
                    const isCek = Boolean(
                      (g as any).cekId ||
                      (g as any).cekNo ||
                      g.kategori === 'Çek Ödemesi' ||
                      g.odemeYontemi?.toLowerCase().includes('çek') ||
                      g.odemeYontemi?.toLowerCase().includes('cek') ||
                      g.odemeYontemi?.toLowerCase().includes('ciro') ||
                      g.aciklama?.toLowerCase().includes('çek') ||
                      g.aciklama?.toLowerCase().includes('ciro')
                    );
                    const cekNum = (g as any).cekNo;

                    return (
                      <tr key={g.id} className={`hover:bg-amber-50/30 transition-colors ${isCek ? 'bg-emerald-50/15' : isFromCari ? 'bg-indigo-50/15' : 'bg-amber-50/10'}`}>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`w-2 h-2 rounded-full ${isCek ? 'bg-emerald-500' : isFromCari ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                            <span className="font-bold text-slate-900">{taseronName}</span>
                            {isCek ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-emerald-800 bg-emerald-50 border-emerald-300 flex items-center gap-1">
                                🎫 {cekNum ? `Çek (${cekNum})` : 'Çek Ödemesi'}
                              </span>
                            ) : (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                isFromCari 
                                  ? 'text-indigo-800 bg-indigo-50 border-indigo-200' 
                                  : 'text-amber-800 bg-amber-100 border-amber-300'
                              }`}>
                                {isFromCari ? 'Firma & Cari' : 'Taşeron Hakediş'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                          {g.tarih}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            isCek
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isFromCari 
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200' 
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}>
                            {g.kategori || (isCek ? 'Çek Ödemesi' : isFromCari ? 'Firma Cari Ödemesi' : 'Taşeron Hakediş')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {g.odemeYontemi || (isFromCari ? 'Firma Cari Hesabı' : 'Banka Transferi')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <div className="font-black text-slate-900">
                            {formatCurrency(g.miktar, g.paraBirimi || 'TRY')}
                          </div>
                          {isFxGider && (
                            <div className="text-[10px] text-amber-800 font-bold mt-0.5" title={`Kur: ${getCurrencyExchangeRate(g.paraBirimi, exchangeRates.rates)} ₺`}>
                              ≈ {formatCurrency(tlEquivGider, 'TRY')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          <div className="font-medium text-slate-800">{g.aciklama || '-'}</div>
                          {site && (
                            <div className="text-[11px] text-slate-400">Şantiye: {site.isim}</div>
                          )}
                          {isCek && (
                            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                              <span>🔗 Çek Takibi & Cari Entegrasyonlu</span>
                            </div>
                          )}
                          {isFromCari && !isCek && (
                            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                              <span>🔗 Firma & Cari Hareketlerinden</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingTaseronGider(g)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Taşeron Ödeme / Hakediş Kaydını Düzenle"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({
                                  isOpen: true,
                                  title: isCek 
                                    ? 'Çek Hakediş / Ödeme Kaydını Sil' 
                                    : (isFromCari ? 'Firma & Cari Ödeme Kaydını Sil' : 'Taşeron Hakediş Kaydını Sil'),
                                  description: isCek
                                    ? `${taseronName} için kaydedilen ${g.tarih} tarihli ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki çek ödemesini silmek istediğinize emin misiniz? Çift yönlü tam senkronizasyon gereğince bu işlem Firma Cari Hesabından ve Çek Takibi bölümünden ilgili çeki de otomatik olarak silecektir.`
                                    : `${taseronName} için kaydedilen ${g.tarih} tarihli ${formatCurrency(g.miktar, g.paraBirimi || 'TRY')} tutarındaki ödeme/hakediş kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                  onConfirm: () => {
                                    const cekId = (g as any).cekId;
                                    if (cekId && onDeleteCek) {
                                      onDeleteCek(cekId);
                                    } else if (g.cariHareketId && onDeleteCariHareket && (g as any).isFromCariOnly) {
                                      onDeleteCariHareket(g.cariHareketId);
                                    } else if (onDeleteGider) {
                                      onDeleteGider(g.id);
                                    }
                                  },
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Kaydı Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {/* Kayıt Yoksa */}
                {((odemelerTableCategory === 'all' && filteredOdemeler.length === 0 && filteredTaseronGiderler.length === 0) ||
                  (odemelerTableCategory === 'personnel' && filteredOdemeler.length === 0) ||
                  (odemelerTableCategory === 'taseron' && filteredTaseronGiderler.length === 0)) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Bu döneme ait herhangi bir ödeme veya hakediş kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: AYLIK SABİT ÜCRETLİ VE GÜNLÜK YEVMİYELİ ANALİZİ */}
      {activeSubTab === 'analiz' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-indigo-900/40">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Aylık Sabit Ücretli ve Günlük Yevmiyeli Personel Analizi ({selectedMonth})
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Ofis/Teknik kadro (aylık sabit) ile şantiye usta/işçi kadrosunun (günlük yevmiyeli) hakedişleri, banka (resmi) ödemeleri, elden avansları ve kalan alacakları ayrıştırılmış olarak aşağıda listelenmiştir.
                </p>
              </div>

              {/* Hızlı Özet Oranları */}
              <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/80 shrink-0">
                <div className="px-3 py-1 text-center border-r border-slate-700">
                  <div className="text-[10px] text-blue-300 font-bold uppercase">Aylık Kadro</div>
                  <div className="text-sm font-black text-white">{aylikStats.personCount} Kişi</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatCurrency(aylikStats.grandHakedis)}</div>
                </div>
                <div className="px-3 py-1 text-center">
                  <div className="text-[10px] text-emerald-300 font-bold uppercase">Yevmiyeli Kadro</div>
                  <div className="text-sm font-black text-white">{yevmiyeStats.personCount} Kişi</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formatCurrency(yevmiyeStats.grandHakedis)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* İki Kadronun Karşılaştırmalı Özet Kartları */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. KADRO: AYLIK SABİT ÜCRETLİLER */}
            <div className="bg-white rounded-2xl border-2 border-blue-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        Aylık Sabit Ücretli Kadro
                      </h4>
                      <div className="text-xs text-blue-800 font-medium">
                        Ofis, Teknik ve Sabit Personel ({aylikStats.personCount} Kişi)
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-full border border-blue-200">
                    Aylık Maaş Sistemi
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3.5">
                {/* Genel Hakediş ve Ödeme Durumu */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">Toplam Hakediş</span>
                    <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                      {formatCurrency(aylikStats.grandHakedis)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Ort. Maaş: {formatCurrency(aylikStats.avgRate)}
                    </span>
                  </div>
                  <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Toplam Yapılan Ödeme</span>
                    <span className="text-base font-black text-emerald-700 font-mono block mt-0.5">
                      {formatCurrency(aylikStats.grandOdenen)}
                    </span>
                    <span className="text-[10px] text-emerald-600">
                      Banka + Elden Nakit
                    </span>
                  </div>
                </div>

                {/* Resmi vs Elden Ayrımı */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Resmi Banka */}
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-950 mb-2">
                      <span className="flex items-center gap-1">
                        <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                        Resmi (Banka)
                      </span>
                      <span className="text-[10px] bg-indigo-200/60 text-indigo-900 px-1.5 py-0.2 rounded font-mono">Banka</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Hak Edilen:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatCurrency(aylikStats.grandResmiAlacak)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Banka Ödenen:</span>
                        <span className="font-semibold font-mono text-emerald-700">{formatCurrency(aylikStats.grandResmiPaid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-indigo-950 pt-1 border-t border-indigo-200">
                        <span>Kalan Resmi Alacak:</span>
                        <span className="font-mono text-indigo-700">{formatCurrency(aylikStats.grandKalanResmi)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Elden Avans */}
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-950 mb-2">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-amber-600" />
                        Elden (Avans Hesabı)
                      </span>
                      <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-mono">Nakit</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Hak Edilen:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatCurrency(aylikStats.grandEldenHakedis)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Verilen Avans:</span>
                        <span className="font-semibold font-mono text-amber-700">{formatCurrency(aylikStats.grandEldenPaid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-950 pt-1 border-t border-amber-200">
                        <span>Kalan Elden Alacak:</span>
                        <span className="font-mono text-amber-700">{formatCurrency(aylikStats.grandKalanElden)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Kalan Bakiye Şeridi */}
                <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 font-semibold block">Aylık Kadro Kalan Net Alacak</span>
                    <span className="text-[11px] text-slate-400">
                      Resmi Kalan: {formatCurrency(aylikStats.grandKalanResmi)} | Elden Kalan: {formatCurrency(aylikStats.grandKalanElden)}
                    </span>
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {formatCurrency(aylikStats.grandKalan)}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. KADRO: GÜNLÜK YEVMİYELİLER */}
            <div className="bg-white rounded-2xl border-2 border-emerald-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        Günlük Yevmiyeli Kadro
                      </h4>
                      <div className="text-xs text-emerald-800 font-medium">
                        Saha, Usta ve İşçi Kadrosu ({yevmiyeStats.personCount} Kişi)
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                    Günlük Yevmiye Sistemi
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-3.5">
                {/* Genel Hakediş ve Ödeme Durumu */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">Toplam Hakediş</span>
                    <span className="text-base font-black text-slate-900 font-mono block mt-0.5">
                      {formatCurrency(yevmiyeStats.grandHakedis)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Ort. Yevmiye: {formatCurrency(yevmiyeStats.avgRate)}/gün
                    </span>
                  </div>
                  <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Toplam Yapılan Ödeme</span>
                    <span className="text-base font-black text-emerald-700 font-mono block mt-0.5">
                      {formatCurrency(yevmiyeStats.grandOdenen)}
                    </span>
                    <span className="text-[10px] text-emerald-600">
                      Banka + Elden Nakit
                    </span>
                  </div>
                </div>

                {/* Resmi vs Elden Ayrımı */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Resmi Banka */}
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-950 mb-2">
                      <span className="flex items-center gap-1">
                        <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                        Resmi (Banka)
                      </span>
                      <span className="text-[10px] bg-indigo-200/60 text-indigo-900 px-1.5 py-0.2 rounded font-mono">Banka</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Hak Edilen:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatCurrency(yevmiyeStats.grandResmiAlacak)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Banka Ödenen:</span>
                        <span className="font-semibold font-mono text-emerald-700">{formatCurrency(yevmiyeStats.grandResmiPaid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-indigo-950 pt-1 border-t border-indigo-200">
                        <span>Kalan Resmi Alacak:</span>
                        <span className="font-mono text-indigo-700">{formatCurrency(yevmiyeStats.grandKalanResmi)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Elden Avans */}
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-950 mb-2">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5 text-amber-600" />
                        Elden (Avans Hesabı)
                      </span>
                      <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded font-mono">Nakit</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Hak Edilen:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatCurrency(yevmiyeStats.grandEldenHakedis)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Verilen Avans:</span>
                        <span className="font-semibold font-mono text-amber-700">{formatCurrency(yevmiyeStats.grandEldenPaid)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-950 pt-1 border-t border-amber-200">
                        <span>Kalan Elden Alacak:</span>
                        <span className="font-mono text-amber-700">{formatCurrency(yevmiyeStats.grandKalanElden)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Kalan Bakiye Şeridi */}
                <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 font-semibold block">Yevmiyeli Kadro Kalan Net Alacak</span>
                    <span className="text-[11px] text-slate-400">
                      Resmi Kalan: {formatCurrency(yevmiyeStats.grandKalanResmi)} | Elden Kalan: {formatCurrency(yevmiyeStats.grandKalanElden)}
                    </span>
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {formatCurrency(yevmiyeStats.grandKalan)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1. AYRI TABLO: AYLIK SABİT KADRO LİSTESİ */}
          <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-50/70 to-white border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  1. Aylık Sabit Ücretli Personel Detay Cetveli ({aylikWorkers.length} Kişi)
                </h4>
              </div>
              <div className="text-xs text-blue-950 font-semibold">
                Kalan Toplam Net: <span className="font-bold font-mono text-blue-700">{formatCurrency(aylikStats.grandKalan)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Personel</th>
                    <th className="px-3 py-3">Sabit Maaş</th>
                    <th className="px-3 py-3 text-center">Puantaj / Mesai</th>
                    <th className="px-3 py-3 text-right">Hak Edilen Toplam</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/40">Resmi Alacak</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/40">Resmi Ödenen</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/70 font-bold text-indigo-950">Kalan Resmi</th>
                    <th className="px-3 py-3 text-right bg-amber-50/40">Elden Hakediş</th>
                    <th className="px-3 py-3 text-right bg-amber-50/40">Alınan Avans</th>
                    <th className="px-3 py-3 text-right bg-amber-50/70 font-bold text-amber-950">Kalan Elden</th>
                    <th className="px-4 py-3 text-right bg-slate-900 text-white font-bold">Kalan Net Alacak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aylikWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        Aylık sabit ücretli kayıtlı personel bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    aylikWorkers.map((item) => {
                      const p = item.personnel;
                      return (
                        <tr key={p.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div>{p.isim} {p.soyisim}</div>
                            <div className="text-[11px] text-slate-400">{p.kategori} • {p.santiye || 'Şantiye yok'}</div>
                          </td>
                          <td className="px-3 py-3 font-mono">
                            <div className="font-bold text-blue-900">{formatCurrency(p.maas || item.yevmiye * 30)}</div>
                            <div className="text-[10px] text-slate-500">{formatCurrency(item.yevmiye)}/gün</div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-semibold text-slate-800">{item.puantajGun} gün</span>
                            {item.mesaiSaat > 0 && (
                              <div className="text-[10px] text-indigo-600 font-mono">+{item.mesaiSaat} sa</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.toplamHakedis)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-indigo-900 bg-indigo-50/20">
                            {formatCurrency(item.resmiAlacak)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-700 bg-indigo-50/20">
                            {formatCurrency(item.toplamResmiOdeme)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40">
                            {formatCurrency(item.kalanResmiOdeme)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-amber-900 bg-amber-50/20">
                            {formatCurrency(item.eldenHakedis)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-amber-700 bg-amber-50/20">
                            {formatCurrency(item.toplamAvans)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-amber-700 bg-amber-50/40">
                            {formatCurrency(item.kalanEldenOdeme)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 bg-slate-50">
                            {formatCurrency(item.netHakedis)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {aylikWorkers.length > 0 && (
                  <tfoot className="bg-blue-50/60 font-bold border-t-2 border-blue-200 text-xs">
                    <tr>
                      <td className="px-4 py-2.5 text-blue-950 font-black">Aylık Kadro Toplamı</td>
                      <td className="px-3 py-2.5 font-mono text-blue-900">
                        {formatCurrency(aylikStats.avgRate)} (Ort)
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {aylikStats.totalPuantajGun} gün
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-900 font-black">
                        {formatCurrency(aylikStats.grandHakedis)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-indigo-900">
                        {formatCurrency(aylikStats.grandResmiAlacak)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                        {formatCurrency(aylikStats.grandResmiPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-indigo-700 font-black">
                        {formatCurrency(aylikStats.grandKalanResmi)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-900">
                        {formatCurrency(aylikStats.grandEldenHakedis)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                        {formatCurrency(aylikStats.grandEldenPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 font-black">
                        {formatCurrency(aylikStats.grandKalanElden)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-black">
                        {formatCurrency(aylikStats.grandKalan)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* 2. AYRI TABLO: GÜNLÜK YEVMİYELİ KADRO LİSTESİ */}
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-emerald-50/70 to-white border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <HardHat className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  2. Günlük Yevmiyeli Personel Detay Cetveli ({yevmiyeWorkers.length} Kişi)
                </h4>
              </div>
              <div className="text-xs text-emerald-950 font-semibold">
                Kalan Toplam Net: <span className="font-bold font-mono text-emerald-700">{formatCurrency(yevmiyeStats.grandKalan)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Personel</th>
                    <th className="px-3 py-3">Günlük Yevmiye</th>
                    <th className="px-3 py-3 text-center">Puantaj / Mesai</th>
                    <th className="px-3 py-3 text-right">Hak Edilen Toplam</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/40">Resmi Alacak</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/40">Resmi Ödenen</th>
                    <th className="px-3 py-3 text-right bg-indigo-50/70 font-bold text-indigo-950">Kalan Resmi</th>
                    <th className="px-3 py-3 text-right bg-amber-50/40">Elden Hakediş</th>
                    <th className="px-3 py-3 text-right bg-amber-50/40">Alınan Avans</th>
                    <th className="px-3 py-3 text-right bg-amber-50/70 font-bold text-amber-950">Kalan Elden</th>
                    <th className="px-4 py-3 text-right bg-slate-900 text-white font-bold">Kalan Net Alacak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yevmiyeWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        Günlük yevmiyeli kayıtlı personel bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    yevmiyeWorkers.map((item) => {
                      const p = item.personnel;
                      return (
                        <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div>{p.isim} {p.soyisim}</div>
                            <div className="text-[11px] text-slate-400">{p.kategori} • {p.santiye || 'Şantiye yok'}</div>
                          </td>
                          <td className="px-3 py-3 font-mono">
                            <div className="font-bold text-slate-900">{formatCurrency(item.yevmiye)}/gün</div>
                            <div className="text-[10px] text-slate-500">Resmi: {formatCurrency(item.gunlukResmiKesinti)} | Elden: {formatCurrency(item.gunlukEldenTutar)}</div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-semibold text-slate-800">{item.puantajGun} gün</span>
                            {item.mesaiSaat > 0 && (
                              <div className="text-[10px] text-indigo-600 font-mono">+{item.mesaiSaat} sa</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(item.toplamHakedis)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-indigo-900 bg-indigo-50/20">
                            {formatCurrency(item.resmiAlacak)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-700 bg-indigo-50/20">
                            {formatCurrency(item.toplamResmiOdeme)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40">
                            {formatCurrency(item.kalanResmiOdeme)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-amber-900 bg-amber-50/20">
                            {formatCurrency(item.eldenHakedis)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-amber-700 bg-amber-50/20">
                            {formatCurrency(item.toplamAvans)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-amber-700 bg-amber-50/40">
                            {formatCurrency(item.kalanEldenOdeme)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 bg-slate-50">
                            {formatCurrency(item.netHakedis)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {yevmiyeWorkers.length > 0 && (
                  <tfoot className="bg-emerald-50/60 font-bold border-t-2 border-emerald-200 text-xs">
                    <tr>
                      <td className="px-4 py-2.5 text-emerald-950 font-black">Yevmiyeli Kadro Toplamı</td>
                      <td className="px-3 py-2.5 font-mono text-emerald-900">
                        {formatCurrency(yevmiyeStats.avgRate)}/gün (Ort)
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {yevmiyeStats.totalPuantajGun} gün
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-900 font-black">
                        {formatCurrency(yevmiyeStats.grandHakedis)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-indigo-900">
                        {formatCurrency(yevmiyeStats.grandResmiAlacak)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                        {formatCurrency(yevmiyeStats.grandResmiPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-indigo-700 font-black">
                        {formatCurrency(yevmiyeStats.grandKalanResmi)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-900">
                        {formatCurrency(yevmiyeStats.grandEldenHakedis)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                        {formatCurrency(yevmiyeStats.grandEldenPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 font-black">
                        {formatCurrency(yevmiyeStats.grandKalanElden)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-black">
                        {formatCurrency(yevmiyeStats.grandKalan)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ödeme / Avans Ekleme Modalı */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900">Personel Ödeme / Avans Kaydı</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4">
              {/* Bordro Dönemi ve Personel Seçimi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Bordro Dönemi <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      if (!newMonth) return;
                      setSelectedMonth(newMonth);
                    }}
                    className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50/40 text-indigo-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-[10px] text-indigo-700/80 mt-0.5">
                    Bu ödeme seçilen bordro döneminin alacak ve hakedişinden mahsup edilir.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Personel Seçiniz <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newOdeme.personelId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = activeOrBalancePayrollSummary.find(item => item.personnel.id === selectedId);
                      const targetP = personnelList.find(p => p.id === selectedId);
                      setNewOdeme({ 
                        ...newOdeme, 
                        personelId: selectedId,
                        santiyeId: targetP?.santiyeId || santiyeler[0]?.id || newOdeme.santiyeId,
                        miktar: round2(found && newOdeme.tur === 'resmi' ? (found.kalanResmiOdeme > 0 ? found.kalanResmiOdeme : 0) : (found && found.kalanEldenOdeme > 0 ? found.kalanEldenOdeme : 2000))
                      });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    required
                  >
                    {selectablePersonnelList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isim} {p.soyisim} ({p.kategori} - {p.santiye}){p.durum === 'Pasif' ? ' [Pasif - Bakiyeli]' : ''}
                      </option>
                    ))}
                    {!selectablePersonnelList.some(p => p.id === newOdeme.personelId) && personnelList.find(p => p.id === newOdeme.personelId) && (() => {
                      const curP = personnelList.find(p => p.id === newOdeme.personelId)!;
                      return (
                        <option key={curP.id} value={curP.id}>
                          {curP.isim} {curP.soyisim} ({curP.kategori} - {curP.santiye}) [Bu Dönemde Bakiyesi Yok]
                        </option>
                      );
                    })()}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>İlgili Şantiye (Gider Yazılacak Şantiye) <span className="text-rose-500">*</span></span>
                  </label>
                  <select
                    value={newOdeme.santiyeId}
                    onChange={(e) => setNewOdeme({ ...newOdeme, santiyeId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    required
                  >
                    {santiyeler.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.isim}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Bu ödeme seçilen şantiyenin giderlerine işlenir. Personel ileride başka bir şantiyeye geçse dahi bu ödeme eski şantiyede sabit kalır.
                  </p>
                </div>
              </div>

              {/* Seçilen Personelin Anlık Resmi ve Elden Bakiye Durumu Bilgi Kartı */}
              {selectedModalPersonHakedis && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>{selectedModalPersonHakedis.personnel.isim} {selectedModalPersonHakedis.personnel.soyisim} - {selectedMonth} Dönem Bakiyesi</span>
                    <span className="font-mono text-slate-700">{selectedModalPersonHakedis.puantajGun.toFixed(1)} Gün Çalışma</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Resmi Bakiye */}
                    <div className="bg-indigo-50/80 p-2 rounded-lg border border-indigo-200">
                      <div className="text-[10px] text-indigo-700 uppercase font-semibold">Resmi Alacak (Banka)</div>
                      <div className="text-sm font-black text-indigo-950 font-mono mt-0.5">
                        {formatCurrency(selectedModalPersonHakedis.kalanResmiOdeme)}
                      </div>
                      <div className="text-[10px] text-indigo-700/80 mt-0.5">
                        (Hak Edilen: {formatCurrency(selectedModalPersonHakedis.resmiAlacak)})
                      </div>
                      {selectedModalPersonHakedis.kalanResmiOdeme > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewOdeme({ ...newOdeme, tur: 'resmi', miktar: round2(Math.max(0, selectedModalPersonHakedis.kalanResmiOdeme)), odemeYontemi: 'Banka Havalesi' })}
                          className="mt-1 text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                        >
                          Kalan Resmiyi Doldur ↗
                        </button>
                      )}
                    </div>

                    {/* Elden Bakiye */}
                    <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                      <div className="text-[10px] text-amber-800 uppercase font-semibold">Kalan Elden (Avans)</div>
                      <div className="text-sm font-black text-amber-950 font-mono mt-0.5">
                        {formatCurrency(selectedModalPersonHakedis.kalanEldenOdeme)}
                      </div>
                      <div className="text-[10px] text-amber-700/80 mt-0.5">
                        (Elden Alacak: {formatCurrency(selectedModalPersonHakedis.eldenHakedis)})
                        {selectedModalPersonHakedis.eskiBakiye !== 0 && (
                          <span className={`ml-1 font-semibold ${selectedModalPersonHakedis.eskiBakiye > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            • Devir Dahil: {selectedModalPersonHakedis.eskiBakiye > 0 ? '+' : ''}{formatCurrency(selectedModalPersonHakedis.eskiBakiye)}
                          </span>
                        )}
                      </div>
                      {selectedModalPersonHakedis.kalanEldenOdeme > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewOdeme({ ...newOdeme, tur: 'avans', miktar: round2(Math.max(0, selectedModalPersonHakedis.kalanEldenOdeme)), odemeYontemi: 'Nakit' })}
                          className="mt-1 text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                        >
                          Kalan Elden'i Doldur ↗
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    İşlem Tarihi
                  </label>
                  <input
                    type="date"
                    value={newOdeme.tarih}
                    onChange={(e) => setNewOdeme({ ...newOdeme, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Saat
                  </label>
                  <input
                    type="time"
                    value={newOdeme.saat}
                    onChange={(e) => setNewOdeme({ ...newOdeme, saat: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  İşlem Türü
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'avans', label: 'Elden Avans' },
                    { id: 'resmi', label: 'Resmi Banka' },
                    { id: 'harcama', label: 'Harcama İadesi' },
                    { id: 'ceza', label: 'Ceza / Kesinti' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const newTur = t.id as any;
                        let autoAmount = newOdeme.miktar;
                        let autoMethod = newOdeme.odemeYontemi;

                        if (selectedModalPersonHakedis) {
                          if (newTur === 'resmi') {
                            autoAmount = round2(selectedModalPersonHakedis.kalanResmiOdeme > 0 ? selectedModalPersonHakedis.kalanResmiOdeme : 0);
                            autoMethod = 'Banka Havalesi';
                          } else if (newTur === 'avans') {
                            autoAmount = round2(selectedModalPersonHakedis.kalanEldenOdeme > 0 ? selectedModalPersonHakedis.kalanEldenOdeme : 2000);
                            autoMethod = 'Nakit';
                          }
                        }

                        setNewOdeme({ 
                          ...newOdeme, 
                          tur: newTur,
                          miktar: autoAmount,
                          odemeYontemi: autoMethod
                        });
                      }}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                        newOdeme.tur === t.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {newOdeme.tur === 'avans' && '• Elden ödeme olarak hesaplanır ve elden hakedişten düşer.'}
                  {newOdeme.tur === 'resmi' && '• Bankadan toplu ödenen resmi asgari kesinti alacağından düşer.'}
                  {newOdeme.tur === 'harcama' && '• Personelin cebinden yaptığı şantiye harcamasının geri ödemesidir.'}
                  {newOdeme.tur === 'ceza' && '• Personelin hakedişinden düşülecek ceza veya malzeme kesintisidir.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tutar <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={newOdeme.miktar === 0 ? '' : newOdeme.miktar}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewOdeme({
                        ...newOdeme,
                        miktar: val === '' ? 0 : parseFloat(val) || 0,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Para Birimi
                  </label>
                  <CurrencySelector
                    value={newOdeme.paraBirimi}
                    onChange={(c) => setNewOdeme({ ...newOdeme, paraBirimi: c })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                  />
                </div>
              </div>

              {newOdeme.paraBirimi && newOdeme.paraBirimi !== 'TRY' && (
                <div className="text-xs text-indigo-800 font-medium bg-indigo-50/90 p-2.5 rounded-xl border border-indigo-200 flex items-center justify-between">
                  <span>
                    Günlük Kur: 1 {newOdeme.paraBirimi} = <strong>{getCurrencyExchangeRate(newOdeme.paraBirimi, exchangeRates.rates)} ₺</strong>
                  </span>
                  <span className="font-mono font-bold">
                    ≈ {formatCurrency(convertCurrencyToTRY(newOdeme.miktar, newOdeme.paraBirimi, exchangeRates.rates), 'TRY')}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ödeme Yöntemi
                </label>
                <select
                  value={newOdeme.odemeYontemi}
                  onChange={(e) => setNewOdeme({ ...newOdeme, odemeYontemi: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                >
                  {odemeYontemleri.map((oy) => (
                    <option key={oy.id} value={oy.isim}>
                      {oy.isim}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Not
                </label>
                <input
                  type="text"
                  placeholder="Örn: Ay sonu toplu resmi maaş ödemesi / 1. Hafta elden avans"
                  value={newOdeme.aciklama}
                  onChange={(e) => setNewOdeme({ ...newOdeme, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Taşeron Personeli İse Firma Cari Senkronizasyon Seçeneği */}
              {selectedModalPersonHakedis?.personnel.taseron && (newOdeme.tur === 'avans' || newOdeme.tur === 'resmi') && (
                <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="syncPersonPaymentToCari"
                    checked={syncPersonPaymentToCari}
                    onChange={(e) => setSyncPersonPaymentToCari(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded-sm border-cyan-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="syncPersonPaymentToCari" className="text-xs font-semibold text-cyan-950 cursor-pointer">
                    Bu ödemeyi personelin bağlı olduğu <strong>{selectedModalPersonHakedis.personnel.taseron}</strong> Firma Cari hesabına otomatik işle
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer shadow-xs"
                >
                  Ödemeyi Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAŞERON ÖDEME MODALI (OPSİYON 1: EKİBE DAĞITIMLI / OPSİYON 2: BAĞIMSIZ EKSTRA) */}
      {isTaseronPaymentModalOpen && (() => {
        const activeModalTaseron =
          taseronlar.find((t) => t.id === selectedTaseronIdForModal) || taseronlar[0];
        const activeModalTeamWorkers = activeModalTaseron
          ? activeOrBalancePayrollSummary.filter(
              (w) =>
                w.personnel.taseronId === activeModalTaseron.id ||
                w.personnel.taseron === activeModalTaseron.isim
            )
          : [];

        const modalTotalResmiPaid = activeModalTeamWorkers.reduce(
          (sum, w) => sum + (groupWorkerPayments[w.personnel.id]?.resmi || 0),
          0
        );
        const modalTotalEldenPaid = activeModalTeamWorkers.reduce(
          (sum, w) => sum + (groupWorkerPayments[w.personnel.id]?.elden || 0),
          0
        );
        const modalGrandTotalPaid = modalTotalResmiPaid + modalTotalEldenPaid;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
              {/* Modal Başlık */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      Taşeron Hakediş & Ekip Ödemesi
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ekip çalışanlarının avans/resmi alacaklarından düşüş yapın veya bağımsız ekstra hakediş kaydedin.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTaseronPaymentModalOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Taşeron Seçimi & Opsiyon Sekmeleri */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-4 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  {/* Bordro Dönemi Seçimi */}
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Bordro Dönemi <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        const newMonth = e.target.value;
                        if (!newMonth) return;
                        setSelectedMonth(newMonth);
                        setGroupWorkerPayments({});
                        const todayStr = getTodayDateString();
                        const newDate = todayStr.startsWith(newMonth) ? todayStr : `${newMonth}-15`;
                        setGroupPaymentDate(newDate);
                        setExtraPaymentForm((prev) => ({ ...prev, tarih: newDate }));
                      }}
                      className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50/40 text-indigo-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <p className="text-[10px] text-indigo-700/80 mt-0.5">
                      Bu dönemin hakediş ve ekip puantajı yüklenir.
                    </p>
                  </div>

                  {/* Taşeron Firma Seçimi */}
                  <div className="sm:col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Ödeme Yapılacak Taşeron Firma: <span className="text-rose-500">*</span>
                      </label>
                      {activeModalTaseron && (
                        <span className="text-[11px] font-medium text-slate-500">
                          Ekip: <strong className="text-indigo-700 font-bold">{activeModalTeamWorkers.length} Kişi</strong> ({selectedMonth})
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedTaseronIdForModal}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedTaseronIdForModal(newId);
                        const targetTas = taseronlar.find((t) => t.id === newId);
                        const initialMap: Record<string, { resmi: number; elden: number }> = {};
                        if (targetTas) {
                          activeOrBalancePayrollSummary
                            .filter(
                              (w) =>
                                w.personnel.taseronId === targetTas.id ||
                                w.personnel.taseron === targetTas.isim
                            )
                            .forEach((w) => {
                              initialMap[w.personnel.id] = { resmi: 0, elden: 0 };
                            });
                        }
                        setGroupWorkerPayments(initialMap);
                      }}
                      className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      {taseronlar.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.isim} ({t.uzmanlik}) {t.yetkili ? `• Yetkili: ${t.yetkili}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bağlı Firma Cari Bilgi Kartı */}
                {activeModalTaseron && (() => {
                  const cariInfo = getFirmaCariInfo(activeModalTaseron.id, activeModalTaseron.isim);
                  return (
                    <div className="p-3 bg-cyan-50/70 border border-cyan-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-600 text-white shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-950 font-bold">
                              Bağlı Firma Cari: {cariInfo?.firma?.isim || activeModalTaseron.isim}
                            </span>
                            <span className="text-[10px] bg-cyan-200/70 text-cyan-900 font-bold px-1.5 py-0.5 rounded">
                              Otomatik Senkronize
                            </span>
                          </div>
                          <span className="text-cyan-800 block text-[11px] mt-0.5">
                            Cari Net Bakiye:{' '}
                            <strong className="font-mono font-bold">
                              {formatCurrency(Math.abs(cariInfo?.netBakiyeTRY || 0))}
                            </strong>{' '}
                            (
                            {(cariInfo?.netBakiyeTRY || 0) > 0
                              ? 'Taşerona Borçluyuz'
                              : (cariInfo?.netBakiyeTRY || 0) < 0
                              ? 'Taşeron Alacaklı'
                              : 'Bakiye Kapalı / 0 ₺'}
                            ) • Toplam {cariInfo?.recordsCount || 0} Cari Hareket Kayıtlı
                          </span>
                        </div>
                      </div>

                      {onNavigateToCompanies && cariInfo?.firma && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsTaseronPaymentModalOpen(false);
                            onNavigateToCompanies(cariInfo.firma.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-cyan-900 hover:text-cyan-950 bg-cyan-100 hover:bg-cyan-200 border border-cyan-300 rounded-lg cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
                        >
                          Cariyi Aç ↗
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* 2 Opsiyon Seçim Düğmeleri */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTaseronPaymentMode('group')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      taseronPaymentMode === 'group'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${
                      taseronPaymentMode === 'group' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          1. Taşeron Ekibine Dağıtımlı Ödeme
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-md">
                          Personelden Düşer
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Taşeron grubuna bağlı çalışanların resmi veya avans alacaklarına ödeme yapılır ve bakiyelerinden düşülür.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaseronPaymentMode('extra')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      taseronPaymentMode === 'extra'
                        ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${
                      taseronPaymentMode === 'extra' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          2. Bağımsız Ekstra Taşeron Ödemesi
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-md">
                          Şantiye Gideri
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Personel hakedişinden bağımsız olarak taşerona doğrudan sözleşme, metraj veya ekstra işçilik bedeli ödenir.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modal İçerik Gövdesi */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                {/* OPSİYON 1: EKİBE DAĞITIMLI ÖDEME FORMU */}
                {taseronPaymentMode === 'group' && (
                  <form onSubmit={handleSaveGroupPayment} className="space-y-4">
                    {/* Hızlı doldurma araçları */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Hızlı Dağıtım Araçları:</span>
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleFillAllAvans(activeModalTeamWorkers)}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold cursor-pointer transition-colors"
                        >
                          ⚡ Tüm Kalan Avansları Doldur
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFillAllResmi(activeModalTeamWorkers)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-semibold cursor-pointer transition-colors"
                        >
                          ⚡ Tüm Kalan Resmileri Doldur
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFillAllBoth(activeModalTeamWorkers)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold cursor-pointer transition-colors"
                        >
                          ⚡ Tüm Hakedişleri Doldur
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearAllGroup(activeModalTeamWorkers)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer transition-colors"
                        >
                          Sıfırla
                        </button>
                      </div>
                    </div>

                    {/* Ekip Personelleri Tablosu */}
                    {activeModalTeamWorkers.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        Bu taşerona atanmış personel bulunamadı. Lütfen Personel Yönetimi bölümünden ilgili personellerin taşeron alanını bu taşeron olarak ayarlayın.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="px-3 py-2.5">Personel</th>
                              <th className="px-3 py-2.5 text-right bg-indigo-50/60 text-indigo-950">
                                Kalan Resmi Alacak
                              </th>
                              <th className="px-3 py-2.5 text-center bg-indigo-50/60 text-indigo-950 w-36">
                                Ödenecek Resmi (₺)
                              </th>
                              <th className="px-3 py-2.5 text-right bg-amber-50/60 text-amber-950">
                                Kalan Elden / Avans
                              </th>
                              <th className="px-3 py-2.5 text-center bg-amber-50/60 text-amber-950 w-36">
                                Ödenecek Elden (₺)
                              </th>
                              <th className="px-3 py-2.5 text-right bg-emerald-50/60 text-emerald-950">
                                Kalan Son Bakiye
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {activeModalTeamWorkers.map((w) => {
                              const p = w.personnel;
                              const pPay = groupWorkerPayments[p.id] || { resmi: 0, elden: 0 };
                              const projKalanResmi = w.kalanResmiOdeme - (pPay.resmi || 0);
                              const projKalanElden = w.kalanEldenOdeme - (pPay.elden || 0);
                              const projNet = projKalanResmi + projKalanElden;

                              return (
                                <tr key={p.id} className="hover:bg-slate-50/60">
                                  <td className="px-3 py-2.5">
                                    <div className="font-bold text-slate-900">
                                      {p.isim} {p.soyisim}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {p.kategori || 'Usta'} {p.TCNO ? `• TC: ${p.TCNO}` : ''}
                                    </div>
                                  </td>

                                  {/* Kalan Resmi Alacak */}
                                  <td className="px-3 py-2.5 text-right font-mono bg-indigo-50/10">
                                    <span className="font-bold text-indigo-900">
                                      {formatCurrency(w.kalanResmiOdeme)}
                                    </span>
                                  </td>

                                  {/* Ödenecek Resmi Input */}
                                  <td className="px-3 py-2 bg-indigo-50/20">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={pPay.resmi === 0 ? '' : pPay.resmi}
                                        placeholder="0"
                                        onChange={(e) =>
                                          handleWorkerResmiChange(p.id, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-full px-2 py-1 text-xs rounded-lg border border-indigo-200 bg-white font-mono font-bold text-indigo-950 text-right focus:outline-indigo-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleWorkerResmiChange(p.id, round2(Math.max(0, w.kalanResmiOdeme)))
                                        }
                                        className="px-1.5 py-1 text-[10px] font-bold rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 cursor-pointer whitespace-nowrap"
                                        title="Kalan resmi tutarın tamamını doldur"
                                      >
                                        Hepsi
                                      </button>
                                    </div>
                                  </td>

                                  {/* Kalan Elden / Avans Alacak */}
                                  <td className="px-3 py-2.5 text-right font-mono bg-amber-50/10">
                                    <span className="font-bold text-amber-900">
                                      {formatCurrency(w.kalanEldenOdeme)}
                                    </span>
                                  </td>

                                  {/* Ödenecek Elden Input */}
                                  <td className="px-3 py-2 bg-amber-50/20">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={pPay.elden === 0 ? '' : pPay.elden}
                                        placeholder="0"
                                        onChange={(e) =>
                                          handleWorkerEldenChange(p.id, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-full px-2 py-1 text-xs rounded-lg border border-amber-200 bg-white font-mono font-bold text-amber-950 text-right focus:outline-amber-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleWorkerEldenChange(p.id, round2(Math.max(0, w.kalanEldenOdeme)))
                                        }
                                        className="px-1.5 py-1 text-[10px] font-bold rounded bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer whitespace-nowrap"
                                        title="Kalan elden/avans tutarın tamamını doldur"
                                      >
                                        Hepsi
                                      </button>
                                    </div>
                                  </td>

                                  {/* Ödeme Sonrası Tahmini Net Kalan */}
                                  <td className="px-3 py-2.5 text-right font-mono bg-emerald-50/10">
                                    <span className={`font-bold ${
                                      projNet <= 0 ? 'text-slate-400' : 'text-emerald-700'
                                    }`}>
                                      {formatCurrency(projNet)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Dağıtım Toplamları Özeti */}
                    <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            Dağıtılan Resmi (Banka)
                          </span>
                          <span className="text-sm sm:text-base font-bold text-indigo-300 font-mono">
                            {formatCurrency(modalTotalResmiPaid)}
                          </span>
                        </div>
                        <span className="text-slate-600 text-lg">+</span>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">
                            Dağıtılan Elden / Avans
                          </span>
                          <span className="text-sm sm:text-base font-bold text-amber-300 font-mono">
                            {formatCurrency(modalTotalEldenPaid)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Genel Toplam Taşeron Ekip Ödemesi
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                          {formatCurrency(modalGrandTotalPaid)}
                        </span>
                      </div>
                    </div>

                    {/* Ödeme Parametreleri */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ödeme Tarihi
                        </label>
                        <input
                          type="date"
                          value={groupPaymentDate}
                          onChange={(e) => setGroupPaymentDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ödeme Yöntemi
                        </label>
                        <select
                          value={groupPaymentMethod}
                          onChange={(e) => setGroupPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white"
                        >
                          {odemeYontemleri.map((oy) => (
                            <option key={oy.id} value={oy.isim}>
                              {oy.isim}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Açıklama / Dekont Notu
                        </label>
                        <input
                          type="text"
                          placeholder="Örn: 2. Hakediş Taşeron Ekip Dağıtımı"
                          value={groupPaymentNote}
                          onChange={(e) => setGroupPaymentNote(e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300"
                        />
                      </div>
                    </div>

                    {/* Firma Cari Otomatik Senkronizasyon Kutusu */}
                    <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncGroupPaymentToCari}
                          onChange={(e) => setSyncGroupPaymentToCari(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded-sm border-cyan-300 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-cyan-950">
                          Ödemeyi Taşeronun Firma Cari Hesabına Otomatik İşle (Alacak / Tahsilat)
                        </span>
                      </label>
                      <span className="text-[11px] font-semibold text-cyan-800 shrink-0">
                        {modalGrandTotalPaid > 0 ? formatCurrency(modalGrandTotalPaid) : '0,00 ₺'} Cari Hareketi
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsTaseronPaymentModalOpen(false)}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="submit"
                        disabled={modalGrandTotalPaid <= 0}
                        className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-2 ${
                          modalGrandTotalPaid > 0
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Ödemeleri Kaydet ve Personellerden Düş ({formatCurrency(modalGrandTotalPaid)})
                        </span>
                      </button>
                    </div>
                  </form>
                )}

                {/* OPSİYON 2: BAĞIMSIZ EKSTRA TAŞERON HAKEDİŞ ÖDEMESİ */}
                {taseronPaymentMode === 'extra' && (
                  <form onSubmit={handleSaveExtraPayment} className="space-y-4 max-w-2xl mx-auto py-2">
                    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Personel Hakedişinden Bağımsız Ekstra Ödeme</span>
                      </div>
                      <p className="text-amber-800">
                        Taşerona doğrudan sözleşme ara hakedişi, metraj hakedişi, prim veya ekstra imalat bedeli olarak ödeme yapabilirsiniz. Bu ödeme ekibin bireysel personel hakedişlerinden <strong>DÜŞMEZ</strong>; doğrudan Şantiye Giderleri tablosuna "Taşeron Hakediş" kategorisinde işlenir.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Şantiye
                        </label>
                        <select
                          value={extraPaymentForm.santiyeId}
                          onChange={(e) => setExtraPaymentForm({ ...extraPaymentForm, santiyeId: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                          required
                        >
                          {santiyeler.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.isim}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ödeme Tutarı <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="Örn: 75000"
                          value={extraPaymentForm.miktar}
                          onChange={(e) =>
                            setExtraPaymentForm({
                              ...extraPaymentForm,
                              miktar: e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono font-bold text-slate-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Para Birimi
                        </label>
                        <CurrencySelector
                          value={extraPaymentForm.paraBirimi}
                          onChange={(c) => setExtraPaymentForm({ ...extraPaymentForm, paraBirimi: c })}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                        />
                      </div>
                    </div>

                    {extraPaymentForm.paraBirimi && extraPaymentForm.paraBirimi !== 'TRY' && (
                      <div className="text-xs text-amber-800 font-medium bg-amber-50/90 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                        <span>
                          Günlük Kur: 1 {extraPaymentForm.paraBirimi} = <strong>{getCurrencyExchangeRate(extraPaymentForm.paraBirimi, exchangeRates.rates)} ₺</strong>
                        </span>
                        <span className="font-mono font-bold">
                          ≈ {formatCurrency(convertCurrencyToTRY(Number(extraPaymentForm.miktar) || 0, extraPaymentForm.paraBirimi, exchangeRates.rates), 'TRY')}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Hakediş / Ödeme Türü
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsManageHakedisTurleriOpen(true)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Türleri Düzenle & Ekle</span>
                          </button>
                        </div>
                        <select
                          value={extraPaymentForm.tur}
                          onChange={(e) => {
                            if (e.target.value === '__NEW__') {
                              setIsManageHakedisTurleriOpen(true);
                            } else {
                              setExtraPaymentForm({ ...extraPaymentForm, tur: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                        >
                          {hakedisTurleri.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value="__NEW__">+ Yeni Hakediş / Ödeme Türü Tanımla...</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ödeme Yöntemi
                        </label>
                        <select
                          value={extraPaymentForm.odemeYontemi}
                          onChange={(e) => setExtraPaymentForm({ ...extraPaymentForm, odemeYontemi: e.target.value })}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ödeme Tarihi
                        </label>
                        <input
                          type="date"
                          value={extraPaymentForm.tarih}
                          onChange={(e) => setExtraPaymentForm({ ...extraPaymentForm, tarih: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Açıklama / Metraj Detayı
                        </label>
                        <input
                          type="text"
                          placeholder="Örn: A Blok 3. Kat Kolon Kalıbı 450 m² hakedişi"
                          value={extraPaymentForm.aciklama}
                          onChange={(e) => setExtraPaymentForm({ ...extraPaymentForm, aciklama: e.target.value })}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                        />
                      </div>
                    </div>

                    {/* Firma Cari Otomatik Senkronizasyon Kutusu */}
                    <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={syncExtraPaymentToCari}
                          onChange={(e) => setSyncExtraPaymentToCari(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded-sm border-cyan-300 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-cyan-950">
                          Bu Hakediş Ödemesini Taşeronun Firma Cari Hesabına Otomatik İşle
                        </span>
                      </label>
                      <span className="text-[11px] font-semibold text-cyan-800 shrink-0">
                        {extraPaymentForm.miktar ? formatCurrency(Number(extraPaymentForm.miktar)) : '0,00 ₺'} Cari Hareketi
                      </span>
                    </div>

                    <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsTaseronPaymentModalOpen(false)}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          Taşerona Ekstra Ödemeyi Kaydet
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1. Personel Ödeme / Avans Düzenleme Modalı */}
      <EditPersonelOdemeModal
        isOpen={!!editingPersonelOdeme}
        onClose={() => setEditingPersonelOdeme(null)}
        odeme={editingPersonelOdeme}
        personnelList={
          editingPersonelOdeme &&
          !selectablePersonnelList.some((p) => p.id === editingPersonelOdeme.personelId)
            ? [
                ...selectablePersonnelList,
                ...personnelList.filter((p) => p.id === editingPersonelOdeme.personelId),
              ]
            : selectablePersonnelList
        }
        odemeYontemleri={odemeYontemleri}
        santiyeler={santiyeler}
        payrollSummary={payrollSummary}
        onSave={(updated) => {
          if (onUpdateOdeme) {
            onUpdateOdeme(updated);
          }
          setEditingPersonelOdeme(null);
        }}
      />

      {/* 2. Taşeron Hakediş / Ekstra Ödeme Düzenleme Modalı */}
      <EditTaseronOdemeModal
        isOpen={!!editingTaseronGider}
        onClose={() => setEditingTaseronGider(null)}
        gider={editingTaseronGider}
        taseronlar={taseronlar}
        firmalar={firmalar}
        santiyeler={santiyeler}
        odemeYontemleri={odemeYontemleri}
        onSave={(updated, cariHareket) => {
          if (onUpdateGider) {
            onUpdateGider(updated, cariHareket);
          }
          setEditingTaseronGider(null);
        }}
      />

      {/* Günlük Döviz Kurları ve Para Birimleri Modalı */}
      <CurrenciesModal
        isOpen={isCurrenciesModalOpen}
        onClose={() => setIsCurrenciesModalOpen(false)}
        onCurrencyUpdated={() => {
          setExchangeRates(getSavedExchangeRates());
        }}
      />

      {/* 3. HAKEDİŞ / ÖDEME TÜRÜ EKLEME VE DÜZENLEME MODALI */}
      {isManageHakedisTurleriOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/80 rounded-xl text-white">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Hakediş & Ödeme Türleri</h3>
                  <p className="text-xs text-indigo-200">
                    Taşeron hakediş ve ekstra ödemelerinde kullanılan türleri tanımlayın ve düzenleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageHakedisTurleriOpen(false);
                  setEditingTurIndex(null);
                  setEditingTurValue('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Yeni Tür Ekleme Kartı */}
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-indigo-950">
                  Yeni Hakediş / Ödeme Türü Ekle
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Örn: Asansör Kuyu İmalatı, Çelik Çatı Montajı..."
                    value={newHakedisTuruInput}
                    onChange={(e) => setNewHakedisTuruInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewHakedisTuru();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-xl border border-indigo-200 bg-white focus:outline-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddNewHakedisTuru()}
                    disabled={!newHakedisTuruInput.trim()}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      newHakedisTuruInput.trim()
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ekle</span>
                  </button>
                </div>
              </div>

              {/* Mevcut Türler Listesi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    Tanımlı Hakediş Türleri ({hakedisTurleri.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetHakedisTurleri}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Varsayılan standart türlere geri döndür"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Varsayılana Sıfırla</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {hakedisTurleri.map((tur, idx) => {
                    const isEditing = editingTurIndex === idx;

                    if (isEditing) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-300 rounded-xl"
                        >
                          <input
                            type="text"
                            value={editingTurValue}
                            onChange={(e) => setEditingTurValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUpdateHakedisTuru(idx);
                              } else if (e.key === 'Escape') {
                                setEditingTurIndex(null);
                                setEditingTurValue('');
                              }
                            }}
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-amber-400 bg-white font-medium focus:outline-amber-600"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateHakedisTuru(idx)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="Kaydet"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTurIndex(null);
                              setEditingTurValue('');
                            }}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                            title="İptal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                            {tur}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTurIndex(idx);
                              setEditingTurValue(tur);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirm({
                                isOpen: true,
                                title: 'Hakediş Türünü Sil',
                                description: `"${tur}" hakediş türünü silmek istediğinize emin misiniz?`,
                                onConfirm: () => handleDeleteHakedisTuru(idx),
                              });
                            }}
                            disabled={hakedisTurleri.length <= 1}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hakedisTurleri.length <= 1
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={
                              hakedisTurleri.length <= 1
                                ? 'En az bir tür bulunmalıdır'
                                : 'Sil'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Seçim yaptığınızda otomatik olarak formunuza yansır.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsManageHakedisTurleriOpen(false);
                  setEditingTurIndex(null);
                  setEditingTurValue('');
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PERSONEL RESMİ ÇALIŞMA GÜNÜ MANUEL BELİRLEME MODALI */}
      {editingResmiGunItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Resmi Çalışma Günü Belirle
                  </h3>
                  <p className="text-[11px] text-indigo-200">
                    {editingResmiGunItem.personnel.isim} {editingResmiGunItem.personnel.soyisim} • {selectedMonth} Dönemi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingResmiGunItem(null)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Bilgilendirme Kartı */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Puantaj Fiili Çalışma Günü:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {editingResmiGunItem.puantajGun.toFixed(1)} Gün
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Resmi Maaş (SGK Matrahı):</span>
                  <span className="font-mono font-bold text-indigo-900">
                    {formatCurrency(editingResmiGunItem.resmiMaas)}
                    <span className="text-[10px] text-slate-500 ml-1">({formatCurrency(editingResmiGunItem.gunlukResmiKesinti)}/g)</span>
                  </span>
                </div>
                <div className="pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-950 leading-relaxed">
                  ℹ️ Bu ay için resmi SGK çalışma gününü değiştirdiğinizde, personelin bankadan yatacak <b>Resmi Alacak</b> tutarı güncellenir ve personelin toplam hakedişi bozulmadan <b>Elden Alacak</b> tutarı ile otomatik dengelenir.
                </div>
              </div>

              {/* Gün Girişi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {selectedMonth} Dönemi Resmi Çalışma Günü (Gün) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="31"
                    value={resmiGunInputValue}
                    onChange={(e) => setResmiGunInputValue(e.target.value)}
                    placeholder="Örn: 30"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                    autoFocus
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                    GÜN
                  </span>
                </div>
              </div>

              {/* Hızlı Seçim Butonları */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">Hızlı Gün Seçenekleri:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResmiGunInputValue('30')}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer text-center"
                  >
                    30 Gün (Tam Ay SGK)
                  </button>
                  <button
                    type="button"
                    onClick={() => setResmiGunInputValue(String(editingResmiGunItem.puantajGun))}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer text-center"
                  >
                    Puantaj Günü ({editingResmiGunItem.puantajGun.toFixed(1)}g)
                  </button>
                </div>
              </div>

              {/* Anlık Hesaplama Önizlemesi */}
              {(() => {
                const previewGun = parseFloat(resmiGunInputValue);
                if (isNaN(previewGun) || previewGun < 0) return null;
                const simResmiAlacak = previewGun * editingResmiGunItem.gunlukResmiKesinti;
                const simEldenHakedis = Math.max(0, editingResmiGunItem.toplamHakedis - simResmiAlacak);
                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>Yeni Resmi Alacak:</span>
                      <span className="font-bold text-indigo-700">{formatCurrency(simResmiAlacak)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Yeni Elden Hakediş:</span>
                      <span className="font-bold text-amber-700">{formatCurrency(simEldenHakedis)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 pt-1 border-t border-slate-200 font-bold">
                      <span>Toplam Hak Edilen:</span>
                      <span>{formatCurrency(editingResmiGunItem.toplamHakedis)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <div>
                {editingResmiGunItem.isManualResmiGun && (
                  <button
                    type="button"
                    onClick={handleResetResmiGunToAuto}
                    className="text-xs text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Otomatik Puantaja Dön</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingResmiGunItem(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveResmiGun()}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Resmi Günü Kaydet</span>
                </button>
              </div>
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
        personName={deleteConfirm.personName}
      />
    </div>
  );
};
