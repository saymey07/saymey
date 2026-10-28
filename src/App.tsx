import React, { useState, useEffect, useRef } from 'react';
import { 
  Personnel, 
  Puantaj, 
  Mesai, 
  PersonelOdeme, 
  Santiye, 
  SantiyeGider, 
  Taseron, 
  Firma, 
  FirmaCari, 
  Cek, 
  OdemeYontemi, 
  CalismaDurumu,
  KrediKarti,
  KrediKartiHarcama,
  AppUser
} from './types';
import { 
  INITIAL_PERSONNEL, 
  INITIAL_SANTIYELER, 
  INITIAL_TASERONLAR, 
  INITIAL_FIRMALAR, 
  INITIAL_FIRMA_CARI, 
  INITIAL_CEKLER, 
  INITIAL_SANTIYE_GIDERLERI, 
  INITIAL_MESAI, 
  INITIAL_PERSONEL_ODEMELERI, 
  INITIAL_ODEME_YONTEMLERI, 
  INITIAL_PUANTAJ,
  INITIAL_KREDI_KARTLARI,
  INITIAL_KART_HARCAMALARI,
  INITIAL_USERS,
  getInitialPuantaj, 
  getStoredData, 
  setStoredData,
  clearAllStoredData,
  formatCurrency,
  DEFAULT_SANTIYE_GIDER_KATEGORILERI,
  getCurrentUserSession,
  setCurrentUserSession,
  normalizeUser,
} from './utils/storage';
import {
  calculateEffectivePuantajGunForMonth,
  getActiveMonthsForPersonnelInPeriod,
  getEffectiveEskiBakiyeForMonth,
  getEffectiveWageForPersonnel,
  getEffectiveResmiGunForMonth,
  isOdemeInBordroDonemi,
} from './utils/personnelBalance';
import { CALISMA_DURUMU_CONFIG } from './types';
import { 
  subscribeToErpDatabase, 
  saveModuleToFirestore, 
  saveAllModulesToFirestore, 
  resetAllModules,
  markItemDeleted,
  SyncStatus 
} from './services/firestoreSync';
import { Navbar, ActiveTabType, PayrollSubTabType } from './components/Navbar';
import { PersonnelList } from './components/PersonnelList';
import { PersonnelModal } from './components/PersonnelModal';
import { AttendanceManager } from './components/AttendanceManager';
import { PersonnelPayroll } from './components/PersonnelPayroll';
import { SitesManagement } from './components/SitesManagement';
import { SubcontractorsManagement } from './components/SubcontractorsManagement';
import { CompaniesAndLedger } from './components/CompaniesAndLedger';
import { ChecksManagement } from './components/ChecksManagement';
import { CreditCardsManagement } from './components/CreditCardsManagement';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CurrenciesModal } from './components/CurrenciesModal';
import { ResetDataModal } from './components/ResetDataModal';
import { DashboardView } from './components/DashboardView';
import { ReportsCenter } from './components/ReportsCenter';
import { LoginScreen } from './components/LoginScreen';
import { UserManagement } from './components/UserManagement';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { convertCurrencyToTRY, getSavedExchangeRates } from './utils/currencyStore';
import { 
  Check, 
  Info, 
  AlertCircle,
  Building2,
  Users,
  Clock,
  Banknote,
  Receipt,
  ChevronRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTabType>('dashboard');
  const [payrollSubTab, setPayrollSubTab] = useState<PayrollSubTabType>('hakedis');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // 12 Database Tables in State with initial fallbacks
  const [personnelList, setPersonnelList] = useState<Personnel[]>(() => {
    const raw = getStoredData<Personnel[] | null>('personnel', null);
    if (Array.isArray(raw)) {
      const seen = new Set<string>();
      const deduped: Personnel[] = [];
      for (const p of raw) {
        if (p && p.id && !seen.has(p.id)) {
          seen.add(p.id);
          deduped.push({
            ...p,
            gunlukCalismaSaati: p.gunlukCalismaSaati || 8,
            mesaiKatsayisi: p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0,
          });
        }
      }
      return deduped;
    }
    return [];
  });
  const [puantajList, setPuantajList] = useState<Puantaj[]>(() => {
    const raw = getStoredData<Puantaj[] | null>('puantaj', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [mesaiList, setMesaiList] = useState<Mesai[]>(() => {
    const raw = getStoredData<Mesai[] | null>('mesai', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [odemeList, setOdemeList] = useState<PersonelOdeme[]>(() => {
    const raw = getStoredData<PersonelOdeme[] | null>('odemeler', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [santiyeler, setSantiyeler] = useState<Santiye[]>(() => {
    const raw = getStoredData<Santiye[] | null>('santiyeler', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [giderler, setGiderler] = useState<SantiyeGider[]>(() => {
    const raw = getStoredData<SantiyeGider[] | null>('giderler', null);
    const list = Array.isArray(raw) ? raw : [];
    return list.filter((g) => {
      const isAutoInvoice =
        g.id.startsWith('sg-cari-') &&
        !g.id.startsWith('sg-cari-odeme-') &&
        (g.kategori === 'Alış Faturası / Malzeme Alımı' ||
          g.odemeYontemi === 'Alış Faturası / Cari' ||
          (g.aciklama && g.aciklama.includes('[Alış Faturası]')));
      return !isAutoInvoice;
    });
  });
  const [taseronlar, setTaseronlar] = useState<Taseron[]>(() => {
    const raw = getStoredData<Taseron[] | null>('taseronlar', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [firmalar, setFirmalar] = useState<Firma[]>(() => {
    const raw = getStoredData<Firma[] | null>('firmalar', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [cariList, setCariList] = useState<FirmaCari[]>(() => {
    const raw = getStoredData<FirmaCari[] | null>('cari', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [cekler, setCekler] = useState<Cek[]>(() => {
    const raw = getStoredData<Cek[] | null>('cekler', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [odemeYontemleri, setOdemeYontemleri] = useState<OdemeYontemi[]>(() =>
    getStoredData<OdemeYontemi[]>('odeme_yontemleri', INITIAL_ODEME_YONTEMLERI)
  );
  const [giderKategorileri, setGiderKategorileri] = useState<string[]>(() =>
    getStoredData<string[]>('gider_kategorileri', DEFAULT_SANTIYE_GIDER_KATEGORILERI)
  );
  const [krediKartlari, setKrediKartlari] = useState<KrediKarti[]>(() => {
    const raw = getStoredData<KrediKarti[] | null>('kredi_kartlari', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [kartHarcamalari, setKartHarcamalari] = useState<KrediKartiHarcama[]>(() => {
    const raw = getStoredData<KrediKartiHarcama[] | null>('kart_harcamalari', null);
    return Array.isArray(raw) ? raw : [];
  });
  const [users, setUsers] = useState<AppUser[]>(() => {
    const raw = getStoredData<AppUser[] | null>('users', null);
    return Array.isArray(raw) && raw.length > 0 ? raw : INITIAL_USERS;
  });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const session = getCurrentUserSession();
    if (!session) return null;
    const rawUsers = getStoredData<AppUser[] | null>('users', null);
    if (Array.isArray(rawUsers) && rawUsers.length > 0) {
      const matched = rawUsers.find((u) => u.id === session.id);
      if (matched) {
        if (matched.durum === 'Pasif') {
          setCurrentUserSession(null);
          return null;
        }
        setCurrentUserSession(matched);
        return matched;
      }
    }
    return session;
  });

  // Action Permissions (Silme ve Düzenleme Yetkisi - Doğrudan kullanıcının tanımlı izinlerine bakar)
  const canUserDelete = currentUser?.permissions?.canDelete === true;
  const canUserEdit = currentUser?.permissions?.canEdit !== false;

  // Keep currentUser in sync with latest users state (critical so edited permissions immediately reflect to the user)
  useEffect(() => {
    if (!currentUser) return;
    const latestUser = users.find((u) => u.id === currentUser.id);
    if (latestUser) {
      if (latestUser.durum === 'Pasif') {
        setCurrentUser(null);
        setCurrentUserSession(null);
        setToastMessage({ text: 'Hesabınız yönetici tarafından pasife alındı.', type: 'error' });
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const norm = normalizeUser(latestUser);
      if (JSON.stringify(norm) !== JSON.stringify(currentUser)) {
        setCurrentUser(norm);
        setCurrentUserSession(norm);
      }
    }
  }, [users, currentUser]);

  // Geçmiş personellerin mevcut şantiyelerine göre ödeme kayıtlarını dondurma / sabitleme
  // (Kullanıcı tercihi: "Personelin şu ana kadarki mevcut şantiyesinde dondurulsun")
  useEffect(() => {
    if (odemeList.length === 0 || personnelList.length === 0) return;
    let hasUnstamped = false;
    const frozenOdemeler = odemeList.map((o) => {
      if (!o.santiyeId) {
        const p = personnelList.find((item) => item.id === o.personelId);
        if (p?.santiyeId || p?.santiye) {
          hasUnstamped = true;
          return {
            ...o,
            santiyeId: p.santiyeId,
            santiyeAdi: p.santiye,
          };
        }
      }
      return o;
    });

    if (hasUnstamped) {
      setOdemeList(frozenOdemeler);
      saveModuleToFirestore('odemeler', frozenOdemeler, false, setSyncStatus);
    }
  }, [personnelList]);

  // Reset Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Backup & Restore Modal state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [backupModalTab, setBackupModalTab] = useState<'export' | 'import'>('export');

  const handleOpenBackupModal = (tab: 'export' | 'import' = 'export') => {
    setBackupModalTab(tab);
    setIsBackupModalOpen(true);
  };

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddKategori = (yeniKategori: string) => {
    const trimmed = yeniKategori.trim();
    if (!trimmed) return;
    if (giderKategorileri.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`"${trimmed}" kategorisi zaten mevcut!`, 'error');
      return;
    }
    const updated = [...giderKategorileri, trimmed];
    setGiderKategorileri(updated);
    saveModuleToFirestore('gider_kategorileri', updated, false, setSyncStatus);
    showToast(`"${trimmed}" kategorisi eklendi.`);
  };

  const handleDeleteKategori = (silinecek: string) => {
    if (!canUserDelete) {
      showToast('Kategori silme yetkiniz bulunmamaktadır.', 'error');
      return;
    }
    if (giderler.some((g) => g.kategori === silinecek)) {
      showToast(`"${silinecek}" kategorisinde kayıtlı gider fişleri bulunduğu için silinemez.`, 'error');
      return;
    }
    const updated = giderKategorileri.filter((k) => k !== silinecek);
    setGiderKategorileri(updated);
    saveModuleToFirestore('gider_kategorileri', updated, false, setSyncStatus);
    showToast(`"${silinecek}" kategorisi silindi.`, 'info');
  };

  // Cloud Firestore Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isCloudConnecting, setIsCloudConnecting] = useState<boolean>(true);

  // Ref cache to prevent echo/feedback loops between remote Firestore snapshots and local updates
  const remoteDataCache = useRef<Record<string, string>>({});
  const isInitialLoadDone = useRef<boolean>(false);
  const hasReconciledRef = useRef<boolean>(false);

  // Safety fallback timer so loading screen never blocks if offline or slow
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCloudConnecting(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to real-time updates from Firebase Firestore for all 12 modules
  useEffect(() => {
    const unsubscribe = subscribeToErpDatabase(
      {
        personnel: (data) => {
          remoteDataCache.current['personnel'] = JSON.stringify(data);
          if (Array.isArray(data)) {
            const seen = new Set<string>();
            let hadDuplicates = false;
            const deduped: Personnel[] = [];
            for (const p of data) {
              if (p && p.id) {
                if (seen.has(p.id)) {
                  hadDuplicates = true;
                } else {
                  seen.add(p.id);
                  deduped.push(p);
                }
              }
            }
            setPersonnelList(deduped);
          } else {
            setPersonnelList(data || []);
          }
        },
        puantaj: (data) => {
          remoteDataCache.current['puantaj'] = JSON.stringify(data);
          setPuantajList(data);
        },
        mesai: (data) => {
          remoteDataCache.current['mesai'] = JSON.stringify(data);
          setMesaiList(data);
        },
        odemeler: (data) => {
          remoteDataCache.current['odemeler'] = JSON.stringify(data);
          setOdemeList(data);
        },
        santiyeler: (data) => {
          remoteDataCache.current['santiyeler'] = JSON.stringify(data);
          setSantiyeler(data);
        },
        giderler: (data) => {
          // Otomatik oluşan fatura gider fişlerini filtrele (sadece fiili ödemeler kalsın)
          const cleaned = (data || []).filter((g: SantiyeGider) => {
            const isAutoInvoice =
              g.id.startsWith('sg-cari-') &&
              !g.id.startsWith('sg-cari-odeme-') &&
              (g.kategori === 'Alış Faturası / Malzeme Alımı' ||
                g.odemeYontemi === 'Alış Faturası / Cari' ||
                (g.aciklama && g.aciklama.includes('[Alış Faturası]')));
            return !isAutoInvoice;
          });
          remoteDataCache.current['giderler'] = JSON.stringify(cleaned);
          setGiderler(cleaned);
        },
        taseronlar: (data) => {
          remoteDataCache.current['taseronlar'] = JSON.stringify(data);
          setTaseronlar(data);
        },
        firmalar: (data) => {
          remoteDataCache.current['firmalar'] = JSON.stringify(data);
          setFirmalar(data);
        },
        cari: (data) => {
          remoteDataCache.current['cari'] = JSON.stringify(data);
          setCariList(data);
        },
        cekler: (data) => {
          remoteDataCache.current['cekler'] = JSON.stringify(data);
          setCekler(data);
        },
        odeme_yontemleri: (data) => {
          remoteDataCache.current['odeme_yontemleri'] = JSON.stringify(data);
          setOdemeYontemleri(data);
        },
        gider_kategorileri: (data) => {
          remoteDataCache.current['gider_kategorileri'] = JSON.stringify(data);
          setGiderKategorileri(data);
        },
        kredi_kartlari: (data) => {
          remoteDataCache.current['kredi_kartlari'] = JSON.stringify(data);
          setKrediKartlari(data);
        },
        kart_harcamalari: (data) => {
          remoteDataCache.current['kart_harcamalari'] = JSON.stringify(data);
          setKartHarcamalari(data);
        },
        users: (data) => {
          if (Array.isArray(data) && data.length > 0) {
            remoteDataCache.current['users'] = JSON.stringify(data);
            setUsers(data);
            setCurrentUser((prev) => {
              if (!prev) return null;
              const matched = data.find((u) => u.id === prev.id);
              if (matched) {
                setCurrentUserSession(matched);
                return matched;
              }
              return prev;
            });
          }
        },
      },
      (status, syncedTime) => {
        setSyncStatus(status);
        if (syncedTime) setLastSyncedAt(syncedTime);
        isInitialLoadDone.current = true;
        setIsCloudConnecting(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // One-time reconciliation between taseronlar and firmalar strictly once after initial load
  useEffect(() => {
    if (!isInitialLoadDone.current || hasReconciledRef.current) return;
    if (firmalar.length === 0 && taseronlar.length === 0) return;
    hasReconciledRef.current = true;

    let updatedFirmalar = [...firmalar];
    let firmalarChanged = false;
    let updatedTaseronlar = [...taseronlar];
    let taseronlarChanged = false;

    // 1. Check if all taseronlar exist in firmalar
    taseronlar.forEach((t) => {
      const existsInFirmalar = updatedFirmalar.some(
        (f) => f.id === t.id || f.isim.trim().toLowerCase() === t.isim.trim().toLowerCase()
      );
      if (!existsInFirmalar) {
        updatedFirmalar.push({
          id: t.id,
          isim: t.isim,
          tur: 'taseron',
          ilgili: t.yetkili || '',
          telefon: t.telefon || '',
          vergiNo: t.vergiNo || '',
          vergiDairesi: t.vergiDairesi || '',
          adres: t.adres || '',
          email: t.email || '',
          uzmanlik: t.uzmanlik || 'Genel Taşeron',
        });
        firmalarChanged = true;
      }
    });

    // 2. Check if all firmalar with tur === 'taseron' exist in taseronlar
    firmalar.forEach((f) => {
      if (f.tur === 'taseron') {
        const existsInTaseron = updatedTaseronlar.some(
          (t) => t.id === f.id || t.isim.trim().toLowerCase() === f.isim.trim().toLowerCase()
        );
        if (!existsInTaseron) {
          updatedTaseronlar.push({
            id: f.id,
            isim: f.isim,
            yetkili: f.ilgili || '',
            telefon: f.telefon || '',
            uzmanlik: f.uzmanlik || 'Genel Taşeron',
            durum: 'Aktif',
            bakiye: 0,
            vergiNo: f.vergiNo || '',
            vergiDairesi: f.vergiDairesi || '',
            adres: f.adres || '',
            email: f.email || '',
          });
          taseronlarChanged = true;
        }
      }
    });

    if (firmalarChanged) {
      setFirmalar(updatedFirmalar);
      saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
    }
    if (taseronlarChanged) {
      setTaseronlar(updatedTaseronlar);
      saveModuleToFirestore('taseronlar', updatedTaseronlar, false, setSyncStatus);
    }
  }, [firmalar, taseronlar]);

  // Note: All Firestore persistence is explicitly triggered inside user action handlers
  // (e.g. handleSavePersonnel, handleUpdatePuantaj, etc.). This ensures new visitors never
  // overwrite existing cloud documents with empty initial state.

  // Modal States
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [isCurrenciesModalOpen, setIsCurrenciesModalOpen] = useState(false);
  const [currencyVersion, setCurrencyVersion] = useState(0);

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    type: 'personnel' | 'santiye' | 'taseron' | 'firma';
  }>({
    isOpen: false,
    id: '',
    name: '',
    type: 'personnel',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Discover available months from all activity records
  const availableMonths = React.useMemo(() => {
    const set = new Set<string>();
    const today = new Date();
    const currentCalMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    set.add(currentCalMonth);

    puantajList.forEach(p => p.tarih && set.add(p.tarih.substring(0, 7)));
    mesaiList.forEach(m => m.tarih && set.add(m.tarih.substring(0, 7)));
    odemeList.forEach(o => {
      const d = o.bordroDonemi || (o.tarih ? o.tarih.substring(0, 7) : '');
      if (d) set.add(d);
    });
    giderler.forEach(g => g.tarih && set.add(g.tarih.substring(0, 7)));
    kartHarcamalari.forEach(k => k.tarih && set.add(k.tarih.substring(0, 7)));

    return Array.from(set).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  }, [puantajList, mesaiList, odemeList, giderler, kartHarcamalari]);

  // Preferred month: if current calendar month has entries, pick it; otherwise pick latest with data (e.g. 2025-02)
  const defaultPeriodStr = React.useMemo(() => {
    const today = new Date();
    const currentCalMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const hasCurrentCalData = 
      puantajList.some(p => p.tarih?.startsWith(currentCalMonth)) ||
      mesaiList.some(m => m.tarih?.startsWith(currentCalMonth)) ||
      odemeList.some(o => isOdemeInBordroDonemi(o, currentCalMonth)) ||
      giderler.some(g => g.tarih?.startsWith(currentCalMonth));
    if (hasCurrentCalData) return currentCalMonth;
    return availableMonths[0] || currentCalMonth;
  }, [availableMonths, puantajList, mesaiList, odemeList, giderler]);

  const [selectedDashboardMonth, setSelectedDashboardMonth] = useState<string>('');
  const activeDashboardMonth = selectedDashboardMonth || defaultPeriodStr;

  // Summary Panel Metrics (Aktif Şantiye, Toplam Personel, Dönemlik Mesai, Bekleyen Ödemeler)
  const summaryData = React.useMemo(() => {
    const exchangeRates = getSavedExchangeRates();
    const activeSites = santiyeler.filter(s => s.durum === 'Aktif' || !s.durum).length;
    const totalStaff = personnelList.length;
    const activeStaff = personnelList.filter(p => p.durum === 'Aktif').length;

    const isAll = activeDashboardMonth === 'all';

    // Bu ayki mesai saati
    const monthMesai = mesaiList
      .filter((m) => isAll || m.tarih.startsWith(activeDashboardMonth))
      .reduce((sum, m) => sum + m.saat, 0);

    // Bu ayki bekleyen ödemeler (Resmi + Elden) ve yapılan ödemeler
    let totalPendingPayment = 0;
    let totalResmiPending = 0;
    let totalEldenPending = 0;
    let totalResmiPaid = 0;
    let totalEldenPaid = 0;

    personnelList.forEach((p) => {
      const isPasif = p.durum === 'Pasif' || (p as any).durum?.toLowerCase() === 'pasif';
      const dailyHours = p.gunlukCalismaSaati || 8;
      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;

      // Hangi aylarda hesaplama yapılacak?
      const targetMonths =
        !isAll && activeDashboardMonth && activeDashboardMonth.includes('-')
          ? [activeDashboardMonth]
          : getActiveMonthsForPersonnelInPeriod(
              p,
              'all',
              new Date().getFullYear(),
              String(new Date().getMonth() + 1).padStart(2, '0'),
              puantajList,
              mesaiList,
              odemeList
            );

      let effectivePuantajGun = 0;
      let mesaiSaat = 0;
      let tabanHakedis = 0;
      let mesaiTutari = 0;
      let periodResmiAlacak = 0;
      let periodEldenHakedis = 0;

      targetMonths.forEach((mStr) => {
        const wageInfo = getEffectiveWageForPersonnel(p, mStr);
        let mDays = 0;
        const mPua = puantajList.filter((pu) => pu.personelId === p.id && pu.tarih.startsWith(mStr));

        if (wageInfo.isAylik) {
          if (isPasif) {
            mDays = mPua.reduce(
              (sum, pu) =>
                sum +
                (pu.calismaDurumu === 'Resmi Tatil'
                  ? 1
                  : CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0),
              0
            );
          } else {
            mDays = calculateEffectivePuantajGunForMonth(p, mStr, puantajList);
          }
        } else {
          mDays = mPua.reduce(
            (sum, pu) =>
              sum +
              (pu.calismaDurumu === 'Resmi Tatil'
                ? 1
                : CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0),
            0
          );
        }
        effectivePuantajGun += mDays;

        const mMesaiRecords = mesaiList.filter((m) => m.personelId === p.id && m.tarih.startsWith(mStr));
        const mMesai = mMesaiRecords.reduce((sum, m) => sum + m.saat, 0);
        mesaiSaat += mMesai;

        const mHourlyWage = wageInfo.effectiveYevmiye / dailyHours;
        const mMesaiAmount = mMesai * mHourlyWage * katsayi;
        mesaiTutari += mMesaiAmount;

        tabanHakedis += mDays * wageInfo.effectiveYevmiye;

        const { resmiGun: mResmiGun } = getEffectiveResmiGunForMonth(p, mStr, mDays);
        const mResmiKesinti = wageInfo.resmiMaas > 0 ? wageInfo.resmiMaas / 30 : 0;
        const mResmiAlacak = mResmiGun * mResmiKesinti;
        const mMonthTotalHakedis = mDays * wageInfo.effectiveYevmiye + mMesaiAmount;
        const mEldenHakedis = Math.max(0, mMonthTotalHakedis - mResmiAlacak);

        periodResmiAlacak += mResmiAlacak;
        periodEldenHakedis += mEldenHakedis;
      });

      const eskiBakiye = getEffectiveEskiBakiyeForMonth(
        p,
        isAll ? 'all' : activeDashboardMonth,
        puantajList,
        mesaiList,
        odemeList,
        exchangeRates.rates
      );

      let resmiAlacak = periodResmiAlacak;
      let eldenHakedis = periodEldenHakedis + eskiBakiye;

      if (p.paraBirimi && p.paraBirimi !== 'TRY') {
        resmiAlacak = convertCurrencyToTRY(resmiAlacak, p.paraBirimi, exchangeRates.rates);
        eldenHakedis = convertCurrencyToTRY(eldenHakedis, p.paraBirimi, exchangeRates.rates);
      }

      const pOdemeler = odemeList.filter(
        (o) => o.personelId === p.id && (isAll || isOdemeInBordroDonemi(o, activeDashboardMonth))
      );

      let toplamAvansTRY = 0;
      let toplamResmiTRY = 0;
      let toplamHarcamaTRY = 0;
      let toplamCezaTRY = 0;

      pOdemeler.forEach((o) => {
        const anyO = o as any;
        const cur = o.paraBirimi || 'TRY';

        const avansVal =
          typeof o.avansOdemesi === 'number' && o.avansOdemesi > 0
            ? o.avansOdemesi
            : anyO.tur === 'avans' && typeof anyO.miktar === 'number'
            ? anyO.miktar
            : (o.avansOdemesi || 0);
        toplamAvansTRY += convertCurrencyToTRY(avansVal, cur, exchangeRates.rates);

        const resmiVal =
          typeof o.resmiOdeme === 'number' && o.resmiOdeme > 0
            ? o.resmiOdeme
            : anyO.tur === 'resmi' && typeof anyO.miktar === 'number'
            ? anyO.miktar
            : (o.resmiOdeme || 0);
        toplamResmiTRY += convertCurrencyToTRY(resmiVal, cur, exchangeRates.rates);

        const harcamaVal = o.yaptigiHarcama || (anyO.tur === 'harcama' ? anyO.miktar : 0) || 0;
        toplamHarcamaTRY += convertCurrencyToTRY(harcamaVal, cur, exchangeRates.rates);

        const cezaVal = o.cezaMiktari || (anyO.tur === 'ceza' ? anyO.miktar : 0) || 0;
        toplamCezaTRY += convertCurrencyToTRY(cezaVal, cur, exchangeRates.rates);
      });

      const kalanResmi = Math.round(resmiAlacak - toplamResmiTRY);
      const kalanElden = Math.round((eldenHakedis + toplamHarcamaTRY) - toplamAvansTRY - toplamCezaTRY);
      const kalanBakiye = kalanResmi + kalanElden;

      totalResmiPending += kalanResmi;
      totalEldenPending += kalanElden;
      totalPendingPayment += kalanBakiye;
      totalResmiPaid += Math.round(toplamResmiTRY);
      totalEldenPaid += Math.round(toplamAvansTRY);
    });

    return {
      activeSites,
      totalSites: santiyeler.length,
      totalStaff,
      activeStaff,
      monthMesai,
      totalPendingPayment,
      totalResmiPending,
      totalEldenPending,
      totalResmiPaid,
      totalEldenPaid,
    };
  }, [santiyeler, personnelList, mesaiList, puantajList, odemeList, activeDashboardMonth, currencyVersion]);

  // Personnel Handlers
  const handleSavePersonnel = (personnel: Personnel) => {
    const targetId = String(personnel.id || '').trim();
    const targetTC = personnel.TCNO ? String(personnel.TCNO).trim() : '';

    // Unique T.C. Kimlik No Kontrolü
    if (targetTC) {
      const duplicatePerson = personnelList.find((p) => {
        const pTC = p.TCNO ? String(p.TCNO).trim() : '';
        const pId = String(p.id || '').trim();
        return pTC && pTC === targetTC && pId !== targetId;
      });
      if (duplicatePerson) {
        showToast(
          `HATA: "${targetTC}" T.C. Kimlik numarası zaten "${duplicatePerson.isim} ${duplicatePerson.soyisim}" adlı personele aittir. Mükerrer kayıt açılamaz!`,
          'error'
        );
        return;
      }
    }

    const isMatch = (p: Personnel) => {
      const pId = String(p.id || '').trim();
      if (targetId && pId && pId === targetId) return true;
      if (editingPersonnel && String(editingPersonnel.id || '').trim() === pId) return true;
      const pTC = p.TCNO ? String(p.TCNO).trim() : '';
      if (targetTC && pTC && pTC === targetTC) return true;
      return false;
    };

    const isExisting = Boolean(editingPersonnel || personnelList.some(isMatch));

    let updated: Personnel[];
    if (isExisting) {
      if (!canUserEdit) {
        showToast('Kayıt düzenleme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
        return;
      }
      const oldPerson = personnelList.find(isMatch);
      // Personel şantiye değiştirdiğinde önceki şantiyede yapılan geçmiş ödemeler eski şantiyede dondurulur/sabitlenir
      if (oldPerson && (oldPerson.santiyeId || oldPerson.santiye)) {
        const oldSiteId = oldPerson.santiyeId;
        const oldSiteName = oldPerson.santiye;
        const needsFreeze = odemeList.some((o) => o.personelId === oldPerson.id && !o.santiyeId);
        if (needsFreeze) {
          const frozenOdemeler = odemeList.map((o) => {
            if (o.personelId === oldPerson.id && !o.santiyeId) {
              return {
                ...o,
                santiyeId: oldSiteId,
                santiyeAdi: oldSiteName,
              };
            }
            return o;
          });
          setOdemeList(frozenOdemeler);
          saveModuleToFirestore('odemeler', frozenOdemeler, false, setSyncStatus);
        }
      }
      // Mevcut personeli güncelle ve olası mükerrer klonları temizle
      const seenIds = new Set<string>();
      updated = [];
      let replaced = false;

      for (const p of personnelList) {
        const pId = String(p.id || '').trim();
        if (isMatch(p)) {
          if (!replaced) {
            updated.push(personnel);
            replaced = true;
            if (pId) seenIds.add(pId);
            if (targetId) seenIds.add(targetId);
          }
        } else {
          if (!pId || !seenIds.has(pId)) {
            updated.push(p);
            if (pId) seenIds.add(pId);
          }
        }
      }

      if (!replaced) {
        updated.push(personnel);
      }
      showToast(`${personnel.isim} ${personnel.soyisim} güncellendi.`);
    } else {
      const seenIds = new Set<string>();
      if (targetId) seenIds.add(targetId);
      const filtered = personnelList.filter((p) => {
        if (isMatch(p)) return false;
        const pId = String(p.id || '').trim();
        if (pId && seenIds.has(pId)) return false;
        if (pId) seenIds.add(pId);
        return true;
      });
      updated = [personnel, ...filtered];
      showToast(`${personnel.isim} ${personnel.soyisim} sisteme kaydedildi.`);
    }
    setPersonnelList(updated);
    saveModuleToFirestore('personnel', updated, true, setSyncStatus);
  };

  const handleConfirmDelete = () => {
    if (!canUserDelete) {
      showToast('Kayıt silme yetkiniz bulunmamaktadır. Lütfen sistem yöneticiniz ile görüşünüz.', 'error');
      setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    if (deleteModalState.type === 'personnel') {
      markItemDeleted('personnel', deleteModalState.id);
      const updated = personnelList.filter((p) => p.id !== deleteModalState.id);
      setPersonnelList(updated);
      saveModuleToFirestore('personnel', updated, true, setSyncStatus);
      showToast('Personel kaydı silindi.', 'info');
    } else if (deleteModalState.type === 'santiye') {
      markItemDeleted('santiyeler', deleteModalState.id);
      const updated = santiyeler.filter((s) => s.id !== deleteModalState.id);
      setSantiyeler(updated);
      saveModuleToFirestore('santiyeler', updated, true, setSyncStatus);
      showToast('Şantiye kaydı silindi.', 'info');
    } else if (deleteModalState.type === 'taseron') {
      markItemDeleted('taseronlar', deleteModalState.id);
      const targetTaseron = taseronlar.find((t) => t.id === deleteModalState.id);
      const targetName = targetTaseron ? targetTaseron.isim : deleteModalState.name;

      const updated = taseronlar.filter((t) => t.id !== deleteModalState.id);
      setTaseronlar(updated);
      saveModuleToFirestore('taseronlar', updated, true, setSyncStatus);

      // Also remove matching taseron firma in firmalar
      const matchingFirma = firmalar.find(
        (f) => f.id === deleteModalState.id || (f.isim.trim().toLowerCase() === targetName.trim().toLowerCase() && f.tur === 'taseron')
      );
      if (matchingFirma) {
        markItemDeleted('firmalar', matchingFirma.id);
      }
      const updatedFirmalar = firmalar.filter(
        (f) => !(f.id === deleteModalState.id || (f.isim.trim().toLowerCase() === targetName.trim().toLowerCase() && f.tur === 'taseron'))
      );
      if (updatedFirmalar.length !== firmalar.length) {
        setFirmalar(updatedFirmalar);
        saveModuleToFirestore('firmalar', updatedFirmalar, true, setSyncStatus);
      }

      showToast('Taşeron ve ilgili Firma Cari kaydı silindi.', 'info');
    } else if (deleteModalState.type === 'firma') {
      markItemDeleted('firmalar', deleteModalState.id);
      const targetFirma = firmalar.find((f) => f.id === deleteModalState.id);
      const targetName = targetFirma ? targetFirma.isim : deleteModalState.name;
      const isTaseronFirma = targetFirma?.tur === 'taseron';

      const updated = firmalar.filter((f) => f.id !== deleteModalState.id);
      setFirmalar(updated);
      saveModuleToFirestore('firmalar', updated, true, setSyncStatus);

      // If this was a taseron firma, also remove from taseronlar
      if (isTaseronFirma) {
        const matchingTas = taseronlar.find(
          (t) => t.id === deleteModalState.id || t.isim.trim().toLowerCase() === targetName.trim().toLowerCase()
        );
        if (matchingTas) {
          markItemDeleted('taseronlar', matchingTas.id);
        }
        const updatedTaseronlar = taseronlar.filter(
          (t) => !(t.id === deleteModalState.id || t.isim.trim().toLowerCase() === targetName.trim().toLowerCase())
        );
        if (updatedTaseronlar.length !== taseronlar.length) {
          setTaseronlar(updatedTaseronlar);
          saveModuleToFirestore('taseronlar', updatedTaseronlar, true, setSyncStatus);
        }
      }

      showToast('Firma kaydı silindi.', 'info');
    }
  };

  // Attendance Handlers
  const handleUpdatePuantaj = (
    personelId: string,
    tarih: string,
    durum: CalismaDurumu | null,
    not?: string
  ) => {
    const existingIdx = puantajList.findIndex(
      (p) => p.personelId === personelId && p.tarih === tarih
    );
    let updated: Puantaj[];
    if (durum === null) {
      if (existingIdx >= 0) {
        const deletedId = puantajList[existingIdx].id || `pua-${personelId}-${tarih}`;
        markItemDeleted('puantaj', `${personelId}_${tarih}`);
        markItemDeleted('puantaj', deletedId);
        updated = puantajList.filter((_, idx) => idx !== existingIdx);
      } else {
        return;
      }
    } else if (existingIdx >= 0) {
      updated = [...puantajList];
      updated[existingIdx] = {
        ...updated[existingIdx],
        calismaDurumu: durum,
        not: not !== undefined ? not : updated[existingIdx].not,
      };
    } else {
      updated = [
        ...puantajList,
        {
          id: `pua-${personelId}-${tarih}`,
          personelId,
          tarih,
          calismaDurumu: durum,
          not,
        },
      ];
    }
    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, true, setSyncStatus);
  };

  const matchSantiyeFilter = (p: Personnel, santiyeFilter?: string) => {
    if (!santiyeFilter || santiyeFilter === 'all') return true;
    if (santiyeFilter === 'kendi_personelimiz') {
      return !p.taseron || p.taseron.trim() === '' || p.taseron.trim().toLowerCase() === 'kendi personelimiz' || p.santiye === 'Kendi Personelimiz' || p.santiyeId === 'kendi_personelimiz' || !p.santiyeId || !p.santiye;
    }
    return p.santiyeId === santiyeFilter || p.santiye === santiyeFilter;
  };

  const handleSetAllDaily = (
    tarih: string,
    durum: CalismaDurumu,
    santiyeFilter?: string
  ) => {
    const targets = personnelList.filter(
      (p) => p.durum === 'Aktif' && matchSantiyeFilter(p, santiyeFilter)
    );

    let updated = [...puantajList];
    targets.forEach((p) => {
      const existingIdx = updated.findIndex(
        (pu) => pu.personelId === p.id && pu.tarih === tarih
      );
      if (existingIdx >= 0) {
        updated[existingIdx] = { ...updated[existingIdx], calismaDurumu: durum };
      } else {
        updated.push({
          id: `pua-${p.id}-${tarih}`,
          personelId: p.id,
          tarih,
          calismaDurumu: durum,
        });
      }
    });

    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, true, setSyncStatus);
    showToast(`${targets.length} personel ${tarih} için "${durum}" olarak işaretlendi.`);
  };

  const isSalariedPerson = (p: Personnel): boolean => {
    return p.ucretTipi === 'aylik' || Boolean(!p.ucretTipi && p.maas && (!p.yevmiye || p.yevmiye === 0));
  };

  const handleClearDaily = (tarih: string, santiyeFilter?: string) => {
    const targetPersonnel = personnelList.filter(
      (p) => p.durum === 'Aktif' && matchSantiyeFilter(p, santiyeFilter)
    );
    const targetIds = new Set(targetPersonnel.map((p) => p.id));

    targetPersonnel.forEach((p) => {
      markItemDeleted('puantaj', `${p.id}_${tarih}`);
      markItemDeleted('puantaj', `pua-${p.id}-${tarih}`);
    });

    const updated = puantajList.filter((p) => !(p.tarih === tarih && targetIds.has(p.personelId)));

    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, true, setSyncStatus);
    showToast(`${tarih} günü puantajı temizlendi.`, 'info');
  };

  const handleClearMonthPuantaj = (monthStr: string, santiyeFilter?: string) => {
    const targetPersonnel = personnelList.filter(
      (p) => p.durum === 'Aktif' && matchSantiyeFilter(p, santiyeFilter)
    );
    const targetIds = new Set(targetPersonnel.map((p) => p.id));

    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    targetPersonnel.forEach((p) => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
        markItemDeleted('puantaj', `${p.id}_${dateStr}`);
        markItemDeleted('puantaj', `pua-${p.id}-${dateStr}`);
      }
    });

    const updated = puantajList.filter((p) => !(p.tarih.startsWith(monthStr) && targetIds.has(p.personelId)));

    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, true, setSyncStatus);
    showToast(`${monthStr} dönemi puantaj kayıtları boşaltıldı.`, 'info');
  };

  const handleFillSalariedMonth = (monthStr: string, santiyeFilter?: string) => {
    const salaried = personnelList.filter(
      (p) => p.durum === 'Aktif' && isSalariedPerson(p) && matchSantiyeFilter(p, santiyeFilter)
    );

    if (salaried.length === 0) {
      showToast('Kriterlere uyan aktif maaşlı personel bulunamadı.', 'info');
      return;
    }

    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let updated = [...puantajList];
    let addedCount = 0;

    salaried.forEach((p) => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
        const existingIdx = updated.findIndex((pu) => pu.personelId === p.id && pu.tarih === dateStr);
        if (existingIdx === -1) {
          updated.push({
            id: `pua-${p.id}-${dateStr}`,
            personelId: p.id,
            tarih: dateStr,
            calismaDurumu: 'Tam Gün',
          });
          addedCount++;
        } else if (updated[existingIdx].calismaDurumu === 'Boş') {
          updated[existingIdx] = {
            ...updated[existingIdx],
            calismaDurumu: 'Tam Gün',
          };
          addedCount++;
        }
      }
    });

    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, false, setSyncStatus);
    showToast(`${salaried.length} maaşlı personel için ${monthStr} dönemindeki boş günler (${addedCount} gün) "Tam Gün" olarak dolduruldu.`);
  };

  const handleFillSalariedDaily = (tarih: string, santiyeFilter?: string) => {
    const salaried = personnelList.filter(
      (p) => p.durum === 'Aktif' && isSalariedPerson(p) && matchSantiyeFilter(p, santiyeFilter)
    );

    if (salaried.length === 0) {
      showToast('Kriterlere uyan aktif maaşlı personel bulunamadı.', 'info');
      return;
    }

    let updated = [...puantajList];
    salaried.forEach((p) => {
      const existingIdx = updated.findIndex((pu) => pu.personelId === p.id && pu.tarih === tarih);
      if (existingIdx >= 0) {
        updated[existingIdx] = { ...updated[existingIdx], calismaDurumu: 'Tam Gün' };
      } else {
        updated.push({
          id: `pua-${p.id}-${tarih}`,
          personelId: p.id,
          tarih,
          calismaDurumu: 'Tam Gün',
        });
      }
    });

    setPuantajList(updated);
    saveModuleToFirestore('puantaj', updated, false, setSyncStatus);
    showToast(`${salaried.length} maaşlı personel ${tarih} günü için "Tam Gün" yapıldı.`);
  };

  // Mesai Handlers
  const handleAddMesai = (mesai: Mesai) => {
    const existing = mesaiList.find(
      (m) => m.personelId === mesai.personelId && m.tarih === mesai.tarih
    );
    if (existing) {
      const person = personnelList.find((p) => p.id === mesai.personelId);
      const name = person ? `${person.isim} ${person.soyisim}` : 'Personele';
      showToast(`${name} için ${mesai.tarih} tarihinde zaten mesai kaydı bulunmaktadır!`, 'error');
      return;
    }
    const updated = [mesai, ...mesaiList];
    setMesaiList(updated);
    saveModuleToFirestore('mesai', updated, true, setSyncStatus);
    showToast(`Mesai kaydı eklendi (+${mesai.saat} saat).`);
  };

  const handleUpdateMesai = (mesai: Mesai) => {
    const collision = mesaiList.find(
      (m) => m.id !== mesai.id && m.personelId === mesai.personelId && m.tarih === mesai.tarih
    );
    if (collision) {
      const person = personnelList.find((p) => p.id === mesai.personelId);
      const name = person ? `${person.isim} ${person.soyisim}` : 'Personele';
      showToast(`${name} için ${mesai.tarih} tarihinde zaten başka bir mesai kaydı var!`, 'error');
      return;
    }
    const updated = mesaiList.map((m) => (m.id === mesai.id ? mesai : m));
    setMesaiList(updated);
    saveModuleToFirestore('mesai', updated, true, setSyncStatus);
    showToast(`Mesai kaydı güncellendi (${mesai.saat} saat).`);
  };

  const handleAddBulkMesai = (newMesailer: Mesai[]) => {
    const allowed: Mesai[] = [];
    let skippedCount = 0;
    for (const item of newMesailer) {
      const alreadyHas = mesaiList.some(
        (m) => m.personelId === item.personelId && m.tarih === item.tarih
      );
      if (alreadyHas) {
        skippedCount++;
      } else {
        allowed.push(item);
      }
    }

    if (allowed.length === 0) {
      showToast('Seçilen personellerin bu tarihte zaten mesai kaydı bulunmaktadır!', 'error');
      return;
    }

    const updated = [...allowed, ...mesaiList];
    setMesaiList(updated);
    saveModuleToFirestore('mesai', updated, true, setSyncStatus);
    if (skippedCount > 0) {
      showToast(`${allowed.length} personele mesai işlendi (${skippedCount} personelin zaten mesaisi olduğu için mükerrer eklenmedi).`);
    } else {
      showToast(`${allowed.length} personele toplu mesai kaydı işlendi.`);
    }
  };

  const handleDeleteMesai = (id: string) => {
    if (!canUserDelete) {
      showToast('Mesai kaydı silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    const target = mesaiList.find((m) => m.id === id);
    markItemDeleted('mesai', id);
    if (target && target.personelId && target.tarih) {
      markItemDeleted('mesai', `${target.personelId}_${target.tarih}`);
    }
    const updated = mesaiList.filter((m) => m.id !== id);
    setMesaiList(updated);
    saveModuleToFirestore('mesai', updated, true, setSyncStatus);
    showToast('Mesai kaydı silindi.', 'info');
  };

  // Payment Handlers
  const handleAddOdeme = (odeme: PersonelOdeme, cariHareket?: FirmaCari) => {
    const person = personnelList.find((p) => p.id === odeme.personelId);
    const resolvedOdeme: PersonelOdeme = {
      ...odeme,
      santiyeId: odeme.santiyeId || person?.santiyeId,
      santiyeAdi: odeme.santiyeAdi || person?.santiye,
    };
    const updated = [resolvedOdeme, ...odemeList];
    setOdemeList(updated);
    saveModuleToFirestore('odemeler', updated, false, setSyncStatus);

    if (cariHareket) {
      // Ensure the subcontractor company exists in firmalar
      const firmaExists = firmalar.some((f) => f.id === cariHareket.firmaId);
      if (!firmaExists) {
        const matchingTas = taseronlar.find(
          (t) => t.id === cariHareket.firmaId || t.isim.trim().toLowerCase() === (odeme.taseronFirmaId || '').toLowerCase()
        );
        const newFirma: Firma = {
          id: cariHareket.firmaId,
          isim: matchingTas?.isim || 'Taşeron',
          tur: 'taseron',
          ilgili: matchingTas?.yetkili || '',
          telefon: matchingTas?.telefon || '',
          vergiNo: matchingTas?.vergiNo || '',
          adres: matchingTas?.adres || '',
          email: matchingTas?.email || '',
          uzmanlik: matchingTas?.uzmanlik || 'Genel Taşeron',
        };
        const updatedFirmalar = [newFirma, ...firmalar];
        setFirmalar(updatedFirmalar);
        saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
      }

      const updatedCari = [cariHareket, ...cariList];
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
      const firmaObj = firmalar.find((f) => f.id === cariHareket.firmaId);
      showToast(`Ödeme / Avans işlendi ve "${firmaObj?.isim || 'Taşeron'}" Firma Cari hesabına yansıtıldı.`);
    } else {
      showToast('Ödeme / Avans kaydı işlendi.');
    }
  };

  const handleAddBulkOdeme = (odemeler: PersonelOdeme[], cariHareket?: FirmaCari) => {
    const resolvedList = odemeler.map((o) => {
      if (!o.santiyeId) {
        const p = personnelList.find((item) => item.id === o.personelId);
        return {
          ...o,
          santiyeId: p?.santiyeId,
          santiyeAdi: p?.santiye,
        };
      }
      return o;
    });
    const updated = [...resolvedList, ...odemeList];
    setOdemeList(updated);
    saveModuleToFirestore('odemeler', updated, false, setSyncStatus);

    if (cariHareket) {
      // Ensure the subcontractor company exists in firmalar
      const firmaExists = firmalar.some((f) => f.id === cariHareket.firmaId);
      if (!firmaExists) {
        const matchingTas = taseronlar.find(
          (t) => t.id === cariHareket.firmaId || t.isim.trim().toLowerCase() === (odemeler[0]?.taseronFirmaId || '').toLowerCase()
        );
        const newFirma: Firma = {
          id: cariHareket.firmaId,
          isim: matchingTas?.isim || 'Taşeron',
          tur: 'taseron',
          ilgili: matchingTas?.yetkili || '',
          telefon: matchingTas?.telefon || '',
          vergiNo: matchingTas?.vergiNo || '',
          adres: matchingTas?.adres || '',
          email: matchingTas?.email || '',
          uzmanlik: matchingTas?.uzmanlik || 'Genel Taşeron',
        };
        const updatedFirmalar = [newFirma, ...firmalar];
        setFirmalar(updatedFirmalar);
        saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
      }

      const updatedCari = [cariHareket, ...cariList];
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
      const firmaObj = firmalar.find((f) => f.id === cariHareket.firmaId);
      showToast(`${odemeler.length} adet taşeron ekip ödemesi başarıyla işlendi ve "${firmaObj?.isim || 'Taşeron'}" Firma Carisine otomatik eklendi.`);
    } else {
      showToast(`${odemeler.length} adet taşeron ekip ödemesi başarıyla işlendi.`);
    }
  };

  const handleDeleteOdeme = (id: string) => {
    if (!canUserDelete) {
      showToast('Ödeme kaydı silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    markItemDeleted('odemeler', id);
    const target = odemeList.find((o) => o.id === id);
    const updated = odemeList.filter((o) => o.id !== id);
    setOdemeList(updated);
    saveModuleToFirestore('odemeler', updated, true, setSyncStatus);

    // 1. Çek Takibi Senkronizasyonu: Eğer bu ödeme bir çeke bağlıysa çeki Çek Takibinden de sil
    const matchingCek = cekler.find(
      (c) =>
        (target?.cekId && c.id === target.cekId) ||
        (target?.cariHareketId && ((c.cariHareketId && c.cariHareketId === target.cariHareketId) || (c.ciroCariHareketId && c.ciroCariHareketId === target.cariHareketId))) ||
        cariList.some((ch) => (ch.odemeId === id || (target?.cariHareketId && ch.id === target.cariHareketId)) && ch.cekId === c.id) ||
        (target?.cekNo && c.cekNo && c.cekNo === target.cekNo) ||
        (target?.aciklama && c.cekNo && c.cekNo.trim().length >= 4 && (target.aciklama.includes(c.cekNo) || target.odemeYontemi?.includes(c.cekNo)))
    );

    if (matchingCek) {
      markItemDeleted('cekler', matchingCek.id);
      const updatedCekler = cekler.filter((c) => c.id !== matchingCek.id);
      setCekler(updatedCekler);
      saveModuleToFirestore('cekler', updatedCekler, true, setSyncStatus);
    }

    // 2. Firma Cari Hesabı Senkronizasyonu
    const matchingCariIds = new Set<string>();
    if (target?.cariHareketId) matchingCariIds.add(target.cariHareketId);
    if (matchingCek?.cariHareketId) matchingCariIds.add(matchingCek.cariHareketId);
    if (matchingCek?.ciroCariHareketId) matchingCariIds.add(matchingCek.ciroCariHareketId);
    cariList.forEach((c) => {
      if (c.odemeId === id || (matchingCek && c.cekId === matchingCek.id)) {
        matchingCariIds.add(c.id);
      }
    });

    matchingCariIds.forEach((cId) => markItemDeleted('cari', cId));

    if (target?.cariHareketId) {
      const isOtherUsing = updated.some((o) => o.cariHareketId === target.cariHareketId);
      if (!isOtherUsing) {
        const updatedCari = cariList.filter((c) => !matchingCariIds.has(c.id) && c.odemeId !== target.id);
        if (updatedCari.length !== cariList.length) {
          setCariList(updatedCari);
          saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
        }
      } else {
        // Grup taşeron ödemesiyse, silinen personelin tutarını cari hareketin alacak tutarından düş
        const remainingTotal = updated
          .filter((o) => o.cariHareketId === target.cariHareketId)
          .reduce(
            (sum, o) =>
              sum +
              (o.avansOdemesi || 0) +
              (o.resmiOdeme || 0) +
              ((o as any).miktar && !o.avansOdemesi && !o.resmiOdeme ? (o as any).miktar : 0),
            0
          );
        const updatedCari = cariList
          .filter((c) => matchingCek ? c.cekId !== matchingCek.id : true)
          .map((c) => {
            if (c.id === target.cariHareketId) {
              return {
                ...c,
                alacak: remainingTotal,
                hedefDusulenTutar: remainingTotal,
              };
            }
            return c;
          });
        setCariList(updatedCari);
        saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
      }
    } else if (matchingCariIds.size > 0) {
      const updatedCari = cariList.filter((c) => !matchingCariIds.has(c.id));
      if (updatedCari.length !== cariList.length) {
        setCariList(updatedCari);
        saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
      }
    }

    // 3. Kredi Kartı Harcamaları Senkronizasyonu
    const matchingKartHarcamaIds = new Set<string>();
    if ((target as any).kartHarcamaId) matchingKartHarcamaIds.add((target as any).kartHarcamaId);
    kartHarcamalari.forEach((tx) => {
      if (
        (target?.cariHareketId && tx.cariHareketId && tx.cariHareketId === target.cariHareketId) ||
        ((target as any)?.giderId && tx.santiyeGiderId && tx.santiyeGiderId === (target as any).giderId) ||
        (tx.cariHareketId && matchingCariIds.has(tx.cariHareketId))
      ) {
        matchingKartHarcamaIds.add(tx.id);
      }
    });
    if (matchingKartHarcamaIds.size > 0) {
      matchingKartHarcamaIds.forEach((kId) => markItemDeleted('kart_harcamalari', kId));
      const updatedKartTxs = kartHarcamalari.filter((tx) => !matchingKartHarcamaIds.has(tx.id));
      if (updatedKartTxs.length !== kartHarcamalari.length) {
        setKartHarcamalari(updatedKartTxs);
        saveModuleToFirestore('kart_harcamalari', updatedKartTxs, true, setSyncStatus);
      }
    }

    if (matchingCek) {
      showToast(`Ödeme kaydı, Çek Takibindeki "${matchingCek.cekNo}" nolu çek ve cari hesap kaydı başarıyla silindi.`, 'info');
    } else {
      showToast('Ödeme kaydı silindi.', 'info');
    }
  };

  const handleUpdateOdeme = (odeme: PersonelOdeme) => {
    const updated = odemeList.map((o) => (o.id === odeme.id ? odeme : o));
    setOdemeList(updated);
    saveModuleToFirestore('odemeler', updated, true, setSyncStatus);
    showToast('Ödeme kaydı başarıyla güncellendi.');
  };

  // Site & Expense Handlers
  const handleAddSantiye = (site: Santiye) => {
    const updated = [site, ...santiyeler];
    setSantiyeler(updated);
    saveModuleToFirestore('santiyeler', updated, false, setSyncStatus);
    showToast(`"${site.isim}" şantiyesi oluşturuldu.`);
  };

  const handleUpdateSantiye = (site: Santiye) => {
    const updated = santiyeler.map((s) => (s.id === site.id ? site : s));
    setSantiyeler(updated);
    saveModuleToFirestore('santiyeler', updated, false, setSyncStatus);
    showToast(`"${site.isim}" güncellendi.`);
  };

  const handleAddGider = (gider: SantiyeGider, cariHareket?: FirmaCari) => {
    let harcamaId: string | undefined = gider.kartId ? (gider.kartHarcamaId || `kkh-${Date.now()}`) : undefined;
    const siteObj = santiyeler.find((s) => s.id === gider.santiyeId);

    const explicitFirmaName = gider.odemeYapilanFirma?.trim() || '';
    const tasName = gider.taseron?.trim() || '';
    const firmName = explicitFirmaName || tasName || '';
    const shouldAddManualFirmaToCari = Boolean((gider as any).cariyeEkle);

    const matchingTasForFirma = firmName
      ? taseronlar.find((t) => t.isim.trim().toLowerCase() === firmName.toLowerCase())
      : undefined;
    const isFirmaTaseron =
      Boolean(matchingTasForFirma) ||
      (!explicitFirmaName && (Boolean(tasName) || gider.kategori === 'Taşeron Hakediş'));

    let currentFirmalar = [...firmalar];
    let firmalarUpdated = false;

    let matchingFirma = currentFirmalar.find((f) => {
      if (firmName) {
        return f.isim.trim().toLowerCase() === firmName.toLowerCase();
      }
      return Boolean(gider.cariFirmaId && f.id === gider.cariFirmaId);
    });

    // Yalnızca kullanıcı "Cariye Tedarikçi Olarak Ekle" seçtiyse veya kayıtlı bir taşeron ise yeni firma oluştur
    if (!matchingFirma && firmName && (shouldAddManualFirmaToCari || isFirmaTaseron)) {
      matchingFirma = {
        id: matchingTasForFirma?.id || `f-${isFirmaTaseron ? 'tas' : 'ted'}-${Date.now()}`,
        isim: firmName,
        tur: isFirmaTaseron ? 'taseron' : 'tedarikci',
        ilgili: matchingTasForFirma?.yetkili || '',
        telefon: matchingTasForFirma?.telefon || '',
        vergiNo: matchingTasForFirma?.vergiNo || '',
        adres: matchingTasForFirma?.adres || '',
        email: matchingTasForFirma?.email || '',
        uzmanlik: matchingTasForFirma?.uzmanlik || (isFirmaTaseron ? 'Genel Taşeron' : undefined),
      };
      currentFirmalar = [matchingFirma, ...currentFirmalar];
      firmalarUpdated = true;
    }

    let effectiveCari = cariHareket;

    // Eğer cariHareket doğrudan verilmediyse ve firma Cari Kayıtlarında mevcutsa (veya kullanıcı cariye eklemeyi seçtiyse) otomatik oluştur
    if (!effectiveCari && matchingFirma && Number(gider.miktar) > 0) {
      const nowTs = Date.now();
      const cardObj = gider.kartId ? krediKartlari.find((c) => c.id === gider.kartId) : undefined;
      const cardInfo = cardObj ? ` (${cardObj.banka} ..${cardObj.kartNumarasiSon4})` : '';
      const autoCariId = `fc-${isFirmaTaseron ? 'tas-' : ''}gider-${nowTs}`;
      effectiveCari = {
        id: autoCariId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: Number(gider.miktar),
        paraBirimi: gider.paraBirimi || 'TRY',
        tarih: gider.tarih || getTodayDateString(),
        saat: '12:00',
        faturaNo: isFirmaTaseron ? `HAK-GIDER-${nowTs.toString().slice(-4)}` : `GID-${nowTs.toString().slice(-4)}`,
        aciklama: isFirmaTaseron
          ? `[Taşeron Hakediş Ödemesi] ${matchingFirma.isim}${cardInfo}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`
          : (gider.kartId
              ? `[Kredi Kartı Ödemesi] ${matchingFirma.isim}${cardInfo}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`
              : `[Firma Ödemesi] ${matchingFirma.isim}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`),
        islemTuru: 'odeme',
        hedefParaBirimi: gider.paraBirimi || 'TRY',
        hedefDusulenTutar: Number(gider.miktar),
        giderId: gider.id,
        kartId: gider.kartId,
        kartHarcamaId: harcamaId,
        santiyeId: siteObj?.id || gider.santiyeId,
        santiyeAdi: siteObj?.isim,
      };
      gider.cariHareketId = autoCariId;
      gider.cariFirmaId = matchingFirma.id;
    }

    // Kredi kartı ile ödeme yapıldıysa kart sistemine otomatik harcama olarak kaydet
    if (gider.kartId && harcamaId) {
      const newTx: KrediKartiHarcama = {
        id: harcamaId,
        kartId: gider.kartId,
        tarih: gider.tarih,
        islemTipi: 'Harcama',
        tutar: Number(gider.miktar),
        paraBirimi: gider.paraBirimi || 'TRY',
        kategori: gider.kategori || 'Şantiye Gideri',
        santiyeId: gider.santiyeId,
        santiyeAdi: siteObj ? siteObj.isim : undefined,
        firmaId: matchingFirma?.id || effectiveCari?.firmaId,
        firmaAdi: matchingFirma?.isim || gider.odemeYapilanFirma || undefined,
        taksitSayisi: Number(gider.taksitSayisi || 1),
        aciklama: gider.aciklama
          ? `${gider.aciklama} (${siteObj ? siteObj.isim + ' - ' : ''}Şantiye Gideri)`
          : `Şantiye Harcaması: ${siteObj ? siteObj.isim : 'Şantiye Gideri'}`,
        santiyeGiderId: gider.id,
        cariHareketId: effectiveCari?.id,
        cariHesabaIsle: Boolean(matchingFirma || effectiveCari),
      };

      const updatedKartHarcamalari = [newTx, ...kartHarcamalari];
      setKartHarcamalari(updatedKartHarcamalari);
      saveModuleToFirestore('kart_harcamalari', updatedKartHarcamalari, false, setSyncStatus);
    }

    // Taşeron / Firma ödemesi firma cari hesabına otomatik işlensin
    if (effectiveCari) {
      const firmaVarMi = currentFirmalar.some((f) => f.id === effectiveCari!.firmaId);
      if (!firmaVarMi) {
        const newFirma: Firma = {
          id: effectiveCari.firmaId,
          isim: firmName || matchingTasForFirma?.isim || 'Firma / Tedarikçi',
          tur: isFirmaTaseron ? 'taseron' : 'tedarikci',
          ilgili: matchingTasForFirma?.yetkili || '',
          telefon: matchingTasForFirma?.telefon || '',
          vergiNo: matchingTasForFirma?.vergiNo || '',
          adres: matchingTasForFirma?.adres || '',
          email: matchingTasForFirma?.email || '',
          uzmanlik: matchingTasForFirma?.uzmanlik || (isFirmaTaseron ? 'Genel Taşeron' : undefined),
        };
        currentFirmalar = [newFirma, ...currentFirmalar];
        firmalarUpdated = true;
      }

      const updatedCari = [effectiveCari, ...cariList];
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    }

    if (firmalarUpdated) {
      setFirmalar(currentFirmalar);
      saveModuleToFirestore('firmalar', currentFirmalar, false, setSyncStatus);
    }

    const cleanedGider = { ...gider };
    delete (cleanedGider as any).cariyeEkle;

    const giderToSave: SantiyeGider = {
      ...cleanedGider,
      kartHarcamaId: harcamaId,
      cariHareketId: effectiveCari?.id || gider.cariHareketId,
      cariFirmaId: effectiveCari?.firmaId || matchingFirma?.id || undefined,
    };

    const updated = [giderToSave, ...giderler];
    setGiderler(updated);
    saveModuleToFirestore('giderler', updated, false, setSyncStatus);

    if (effectiveCari) {
      const firmaObj = currentFirmalar.find((f) => f.id === effectiveCari!.firmaId);
      showToast(`Gider fişi kaydedildi ve "${firmaObj?.isim || firmName || 'Firma'}" Firma Cari hesabına otomatik işlendi.`);
    } else if (gider.kartId) {
      const cardObj = krediKartlari.find((c) => c.id === gider.kartId);
      showToast(`Şantiye gideri kaydedildi ve "${cardObj?.kartAdi || 'Kredi Kartı'}" ekstresine harcama olarak işlendi.`);
    } else {
      showToast('Şantiye gider fişi kaydedildi.');
    }
  };

  const handleUpdateGider = (gider: SantiyeGider, cariHareket?: FirmaCari) => {
    if (!canUserEdit) {
      showToast('Gider düzenleme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    const oldGider = giderler.find((g) => g.id === gider.id);
    let updatedKartHarcamalari = [...kartHarcamalari];
    let harcamaId = gider.kartHarcamaId || oldGider?.kartHarcamaId;

    const siteObj = santiyeler.find((s) => s.id === gider.santiyeId);

    if (gider.kartId) {
      // Kart ile ödeniyor
      const existingTxIndex = updatedKartHarcamalari.findIndex(
        (tx) => (harcamaId && tx.id === harcamaId) || tx.santiyeGiderId === gider.id
      );

      if (existingTxIndex >= 0) {
        // Mevcut kart hareketini güncelle
        const existingTx = updatedKartHarcamalari[existingTxIndex];
        harcamaId = existingTx.id;
        updatedKartHarcamalari[existingTxIndex] = {
          ...existingTx,
          kartId: gider.kartId,
          tarih: gider.tarih,
          tutar: Number(gider.miktar),
          kategori: gider.kategori || existingTx.kategori,
          santiyeId: gider.santiyeId,
          santiyeAdi: siteObj ? siteObj.isim : undefined,
          firmaAdi: gider.odemeYapilanFirma || undefined,
          taksitSayisi: Number(gider.taksitSayisi || existingTx.taksitSayisi || 1),
          aciklama: gider.aciklama
            ? `${gider.aciklama} (${siteObj ? siteObj.isim + ' - ' : ''}Şantiye Gideri)`
            : `Şantiye Harcaması: ${siteObj ? siteObj.isim : 'Şantiye Gideri'}`,
          santiyeGiderId: gider.id,
        };
      } else {
        // Önceden kartla ödenmemişti, şimdi karta bağlandı
        harcamaId = `kkh-${Date.now()}`;
        const newTx: KrediKartiHarcama = {
          id: harcamaId,
          kartId: gider.kartId,
          tarih: gider.tarih,
          islemTipi: 'Harcama',
          tutar: Number(gider.miktar),
          kategori: gider.kategori || 'Şantiye Gideri',
          santiyeId: gider.santiyeId,
          santiyeAdi: siteObj ? siteObj.isim : undefined,
          firmaAdi: gider.odemeYapilanFirma || undefined,
          taksitSayisi: Number(gider.taksitSayisi || 1),
          aciklama: gider.aciklama
            ? `${gider.aciklama} (${siteObj ? siteObj.isim + ' - ' : ''}Şantiye Gideri)`
            : `Şantiye Harcaması: ${siteObj ? siteObj.isim : 'Şantiye Gideri'}`,
          santiyeGiderId: gider.id,
        };
        updatedKartHarcamalari = [newTx, ...updatedKartHarcamalari];
      }

      setKartHarcamalari(updatedKartHarcamalari);
      saveModuleToFirestore('kart_harcamalari', updatedKartHarcamalari, false, setSyncStatus);
    } else {
      // Kartla ödenmiyor (Nakit, Havale vb. seçildi)
      // Eğer önceden bağlı bir kart harcaması varsa silinsin
      const hadCardTx = updatedKartHarcamalari.some(
        (tx) => (harcamaId && tx.id === harcamaId) || tx.santiyeGiderId === gider.id
      );
      if (hadCardTx) {
        updatedKartHarcamalari = updatedKartHarcamalari.filter(
          (tx) => (!harcamaId || tx.id !== harcamaId) && tx.santiyeGiderId !== gider.id
        );
        setKartHarcamalari(updatedKartHarcamalari);
        saveModuleToFirestore('kart_harcamalari', updatedKartHarcamalari, false, setSyncStatus);
      }
      harcamaId = undefined;
    }

    let effectiveCari = cariHareket;
    const explicitFirmaName = gider.odemeYapilanFirma?.trim() || '';
    const tasName = gider.taseron?.trim() || '';
    const firmName = explicitFirmaName || tasName || '';
    const shouldAddManualFirmaToCari = Boolean((gider as any).cariyeEkle);

    const matchingTasForFirma = firmName
      ? taseronlar.find((t) => t.isim.trim().toLowerCase() === firmName.toLowerCase())
      : undefined;
    const isFirmaTaseron =
      Boolean(matchingTasForFirma) ||
      (!explicitFirmaName && (Boolean(tasName) || gider.kategori === 'Taşeron Hakediş'));

    let currentFirmalar = [...firmalar];
    let firmalarUpdated = false;

    let matchingFirma = currentFirmalar.find((f) => {
      if (firmName) {
        return f.isim.trim().toLowerCase() === firmName.toLowerCase();
      }
      return Boolean(gider.cariFirmaId && f.id === gider.cariFirmaId);
    });

    // Yalnızca kullanıcı "Cariye Tedarikçi Olarak Ekle" seçtiyse veya kayıtlı bir taşeron ise yeni firma oluştur
    if (!matchingFirma && firmName && (shouldAddManualFirmaToCari || isFirmaTaseron)) {
      matchingFirma = {
        id: matchingTasForFirma?.id || `f-${isFirmaTaseron ? 'tas' : 'ted'}-${Date.now()}`,
        isim: firmName,
        tur: isFirmaTaseron ? 'taseron' : 'tedarikci',
        ilgili: matchingTasForFirma?.yetkili || '',
        telefon: matchingTasForFirma?.telefon || '',
        vergiNo: matchingTasForFirma?.vergiNo || '',
        adres: matchingTasForFirma?.adres || '',
        email: matchingTasForFirma?.email || '',
        uzmanlik: matchingTasForFirma?.uzmanlik || (isFirmaTaseron ? 'Genel Taşeron' : undefined),
      };
      currentFirmalar = [matchingFirma, ...currentFirmalar];
      firmalarUpdated = true;
    }

    // Eğer cariHareket yoksa ve eşleşen bir cari firma varsa güncelle/oluştur
    if (!effectiveCari && matchingFirma && Number(gider.miktar) > 0) {
      const existingCari = cariList.find(
        (c) => (gider.cariHareketId && c.id === gider.cariHareketId) || (gider.id && c.giderId === gider.id)
      );
      if (existingCari) {
        effectiveCari = {
          ...existingCari,
          firmaId: matchingFirma.id,
          alacak: Number(gider.miktar),
          paraBirimi: gider.paraBirimi || existingCari.paraBirimi || 'TRY',
          tarih: gider.tarih || existingCari.tarih,
          aciklama: isFirmaTaseron
            ? `[Taşeron Hakediş Ödemesi] ${matchingFirma.isim}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`
            : (gider.kartId ? `[Kredi Kartı Ödemesi] ${matchingFirma.isim}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}` : `[Firma Ödemesi] ${matchingFirma.isim}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`),
          hedefDusulenTutar: Number(gider.miktar),
          kartId: gider.kartId || existingCari.kartId,
          kartHarcamaId: harcamaId || existingCari.kartHarcamaId,
          santiyeId: siteObj?.id || gider.santiyeId || existingCari.santiyeId,
          santiyeAdi: siteObj?.isim || existingCari.santiyeAdi,
        };
      } else {
        const nowTs = Date.now();
        const cardObj = gider.kartId ? krediKartlari.find((c) => c.id === gider.kartId) : undefined;
        const cardInfo = cardObj ? ` (${cardObj.banka} ..${cardObj.kartNumarasiSon4})` : '';
        effectiveCari = {
          id: `fc-gider-${nowTs}`,
          firmaId: matchingFirma.id,
          borc: 0,
          alacak: Number(gider.miktar),
          paraBirimi: gider.paraBirimi || 'TRY',
          tarih: gider.tarih || getTodayDateString(),
          saat: '12:00',
          faturaNo: gider.faturaNo || (gider.kartId ? `KK-GID-${nowTs.toString().slice(-4)}` : (isFirmaTaseron ? `HAK-GID-${nowTs.toString().slice(-4)}` : `GID-${nowTs.toString().slice(-4)}`)),
          aciklama: isFirmaTaseron
            ? `[Taşeron Hakediş Ödemesi] ${matchingFirma.isim}${cardInfo}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`
            : (gider.kartId ? `[Kredi Kartı Ödemesi] ${matchingFirma.isim}${cardInfo}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}` : `[Firma Ödemesi] ${matchingFirma.isim}${siteObj ? ` [${siteObj.isim}]` : ''}${gider.aciklama ? ` - ${gider.aciklama}` : ''}`),
          islemTuru: 'odeme',
          hedefParaBirimi: gider.paraBirimi || 'TRY',
          hedefDusulenTutar: Number(gider.miktar),
          giderId: gider.id,
          kartId: gider.kartId,
          kartHarcamaId: harcamaId,
          santiyeId: siteObj?.id || gider.santiyeId,
          santiyeAdi: siteObj?.isim,
        };
      }
    }

    // Firma / Taşeron cari senkronizasyonu
    if (effectiveCari) {
      const firmaVarMi = currentFirmalar.some((f) => f.id === effectiveCari!.firmaId);
      if (!firmaVarMi) {
        const newFirma: Firma = {
          id: effectiveCari.firmaId,
          isim: firmName || matchingTasForFirma?.isim || 'Firma / Tedarikçi',
          tur: isFirmaTaseron ? 'taseron' : 'tedarikci',
          ilgili: matchingTasForFirma?.yetkili || '',
          telefon: matchingTasForFirma?.telefon || '',
          vergiNo: matchingTasForFirma?.vergiNo || '',
          adres: matchingTasForFirma?.adres || '',
          email: matchingTasForFirma?.email || '',
          uzmanlik: matchingTasForFirma?.uzmanlik || (isFirmaTaseron ? 'Genel Taşeron' : undefined),
        };
        currentFirmalar = [newFirma, ...currentFirmalar];
        firmalarUpdated = true;
      }

      const existsIndex = cariList.findIndex(
        (c) => c.id === effectiveCari!.id || (gider.id && c.giderId === gider.id)
      );
      let updatedCari: FirmaCari[];
      if (existsIndex >= 0) {
        updatedCari = cariList.map((c, idx) => (idx === existsIndex ? effectiveCari! : c));
      } else {
        updatedCari = [effectiveCari, ...cariList];
      }
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);

      // Kart harcamasındaki cari bilgilerini de senkronize et
      if (gider.kartId && harcamaId) {
        updatedKartHarcamalari = updatedKartHarcamalari.map((tx) =>
          tx.id === harcamaId
            ? {
                ...tx,
                firmaId: effectiveCari!.firmaId,
                firmaAdi: matchingFirma?.isim || firmName || tx.firmaAdi,
                cariHareketId: effectiveCari!.id,
                cariHesabaIsle: true,
              }
            : tx
        );
        setKartHarcamalari(updatedKartHarcamalari);
        saveModuleToFirestore('kart_harcamalari', updatedKartHarcamalari, false, setSyncStatus);
      }
    }

    if (firmalarUpdated) {
      setFirmalar(currentFirmalar);
      saveModuleToFirestore('firmalar', currentFirmalar, false, setSyncStatus);
    }

    const cleanedGider = { ...gider };
    delete (cleanedGider as any).cariyeEkle;

    const giderToSave: SantiyeGider = {
      ...cleanedGider,
      kartHarcamaId: harcamaId,
      cariHareketId: effectiveCari?.id || (matchingFirma ? gider.cariHareketId : undefined),
      cariFirmaId: effectiveCari?.firmaId || matchingFirma?.id || undefined,
    };

    // Eğer bu gider bir çek kaydıyla ilişkiliyse çekin şantiye bilgisini de senkronize et
    if (siteObj && (gider.cekId || effectiveCari?.cekId)) {
      const targetCekId = gider.cekId || effectiveCari?.cekId;
      const updatedCekler = cekler.map((ck) => {
        if (ck.id === targetCekId) {
          if (ck.durum === 'Ciro Edildi') {
            return {
              ...ck,
              ciroSantiyeId: siteObj.id,
              ciroSantiyeProje: siteObj.isim,
              santiyeId: siteObj.id,
              santiyeProje: siteObj.isim,
            };
          }
          return {
            ...ck,
            santiyeId: siteObj.id,
            santiyeProje: siteObj.isim,
          };
        }
        return ck;
      });
      setCekler(updatedCekler);
      saveModuleToFirestore('cekler', updatedCekler, false, setSyncStatus);
    }

    const existsInGiderler = giderler.some((g) => g.id === gider.id);
    const updated = existsInGiderler
      ? giderler.map((g) => (g.id === gider.id ? giderToSave : g))
      : [giderToSave, ...giderler];
    setGiderler(updated);
    saveModuleToFirestore('giderler', updated, false, setSyncStatus);

    if (gider.kartId) {
      const cardObj = krediKartlari.find((c) => c.id === gider.kartId);
      showToast(`Gider güncellendi; "${cardObj?.kartAdi || 'Kredi Kartı'}" ekstresi ve Firma Cari Hesabı senkronize edildi.`);
    } else {
      showToast('Şantiye gider kaydı ve Firma Cari hesabı başarıyla güncellendi.');
    }
  };

  const handleDeleteGider = (id: string) => {
    if (!canUserDelete) {
      showToast('Gider fişi silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    markItemDeleted('giderler', id);
    const giderToDelete = giderler.find((g) => g.id === id);
    const updated = giderler.filter((g) => g.id !== id);
    setGiderler(updated);
    saveModuleToFirestore('giderler', updated, true, setSyncStatus);

    // 1. Kredi kartı hareketlerinde ilişkili harcama varsa sil
    const hasCardTx = kartHarcamalari.some(
      (tx) =>
        tx.santiyeGiderId === id ||
        (giderToDelete?.kartHarcamaId && tx.id === giderToDelete.kartHarcamaId) ||
        (giderToDelete?.cariHareketId && tx.cariHareketId === giderToDelete.cariHareketId)
    );
    if (hasCardTx) {
      const removedCardTxs = kartHarcamalari.filter(
        (tx) =>
          tx.santiyeGiderId === id ||
          (giderToDelete?.kartHarcamaId && tx.id === giderToDelete.kartHarcamaId) ||
          (giderToDelete?.cariHareketId && tx.cariHareketId === giderToDelete.cariHareketId)
      );
      removedCardTxs.forEach((tx) => markItemDeleted('kart_harcamalari', tx.id));

      const updatedTxs = kartHarcamalari.filter(
        (tx) =>
          tx.santiyeGiderId !== id &&
          (!giderToDelete?.kartHarcamaId || tx.id !== giderToDelete.kartHarcamaId) &&
          (!giderToDelete?.cariHareketId || tx.cariHareketId !== giderToDelete.cariHareketId)
      );
      setKartHarcamalari(updatedTxs);
      saveModuleToFirestore('kart_harcamalari', updatedTxs, true, setSyncStatus);
    }

    // 2. Çek Takibi Senkronizasyonu: Gidere bağlı çek varsa Çek Takibinden de sil
    const matchingCek = cekler.find(
      (c) =>
        (giderToDelete?.cekId && c.id === giderToDelete.cekId) ||
        (giderToDelete?.cariHareketId && ((c.cariHareketId && c.cariHareketId === giderToDelete.cariHareketId) || (c.ciroCariHareketId && c.ciroCariHareketId === giderToDelete.cariHareketId))) ||
        cariList.some((ch) => (ch.giderId === id || (giderToDelete?.cariHareketId && ch.id === giderToDelete.cariHareketId)) && ch.cekId === c.id) ||
        (giderToDelete?.cekNo && giderToDelete.cekNo.trim().length >= 4 && c.cekNo === giderToDelete.cekNo.trim()) ||
        (giderToDelete?.aciklama && c.cekNo && c.cekNo.trim().length >= 4 && (giderToDelete.aciklama.includes(c.cekNo) || giderToDelete.odemeYontemi?.includes(c.cekNo)))
    );

    if (matchingCek) {
      markItemDeleted('cekler', matchingCek.id);
      const updatedCekler = cekler.filter((c) => c.id !== matchingCek.id);
      setCekler(updatedCekler);
      saveModuleToFirestore('cekler', updatedCekler, true, setSyncStatus);
    }

    // 3. Firma Cari hareketlerinde ilişkili hareket varsa sil
    const matchingCariIds = new Set<string>();
    if (giderToDelete?.cariHareketId) matchingCariIds.add(giderToDelete.cariHareketId);
    if (matchingCek?.cariHareketId) matchingCariIds.add(matchingCek.cariHareketId);
    if (matchingCek?.ciroCariHareketId) matchingCariIds.add(matchingCek.ciroCariHareketId);
    cariList.forEach((c) => {
      if (c.giderId === id || (matchingCek && c.cekId === matchingCek.id)) {
        matchingCariIds.add(c.id);
      }
    });

    if (matchingCariIds.size > 0) {
      matchingCariIds.forEach((cId) => markItemDeleted('cari', cId));
      const updatedCari = cariList.filter((c) => !matchingCariIds.has(c.id));
      if (updatedCari.length !== cariList.length) {
        setCariList(updatedCari);
        saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
      }
    }

    // 4. Eşleşen Personel Ödemeleri varsa sil
    const isMatchingOdeme = (o: PersonelOdeme) => {
      if (giderToDelete?.cariHareketId && o.cariHareketId && o.cariHareketId === giderToDelete.cariHareketId) return true;
      if (o.cariHareketId && o.cariHareketId === id) return true;
      if ((o as any).giderId && (o as any).giderId === id) return true;
      if (matchingCek) {
        if ((o as any).cekId && (o as any).cekId === matchingCek.id) return true;
        if (matchingCek.cariHareketId && o.cariHareketId && o.cariHareketId === matchingCek.cariHareketId) return true;
        if (matchingCek.ciroCariHareketId && o.cariHareketId && o.cariHareketId === matchingCek.ciroCariHareketId) return true;
      }
      return false;
    };

    const removedOdemeler = odemeList.filter(isMatchingOdeme);
    removedOdemeler.forEach((o) => markItemDeleted('odemeler', o.id));

    const updatedOdemeler = odemeList.filter((o) => !isMatchingOdeme(o));
    if (updatedOdemeler.length !== odemeList.length) {
      setOdemeList(updatedOdemeler);
      saveModuleToFirestore('odemeler', updatedOdemeler, true, setSyncStatus);
    }

    if (matchingCek) {
      showToast(`Hakediş/Gider kaydı, Çek Takibindeki "${matchingCek.cekNo}" nolu çek ve cari hesap kaydı başarıyla silindi.`, 'info');
    } else {
      showToast('Gider kaydı silindi.', 'info');
    }
  };

  // Subcontractor Handlers (1:1 Bidirectionally Synced with Firmalar)
  const handleAddTaseron = (taseron: Taseron) => {
    // 1. Add to taseronlar
    const updatedTaseronlar = [taseron, ...taseronlar];
    setTaseronlar(updatedTaseronlar);
    saveModuleToFirestore('taseronlar', updatedTaseronlar, false, setSyncStatus);

    // 2. Automatically sync to firmalar as tur: 'taseron'
    const existingFirmaIdx = firmalar.findIndex(
      (f) => f.id === taseron.id || f.isim.trim().toLowerCase() === taseron.isim.trim().toLowerCase()
    );

    let updatedFirmalar: Firma[];
    if (existingFirmaIdx >= 0) {
      updatedFirmalar = firmalar.map((f, idx) =>
        idx === existingFirmaIdx
          ? {
              ...f,
              tur: 'taseron',
              isim: taseron.isim,
              ilgili: taseron.yetkili || f.ilgili || '',
              telefon: taseron.telefon || f.telefon || '',
              adres: taseron.adres || f.adres || '',
              vergiNo: taseron.vergiNo || f.vergiNo || '',
              vergiDairesi: taseron.vergiDairesi || f.vergiDairesi || '',
              email: taseron.email || f.email || '',
              uzmanlik: taseron.uzmanlik || f.uzmanlik || '',
            }
          : f
      );
    } else {
      const newFirma: Firma = {
        id: taseron.id,
        isim: taseron.isim,
        tur: 'taseron',
        ilgili: taseron.yetkili || '',
        telefon: taseron.telefon || '',
        adres: taseron.adres || '',
        vergiNo: taseron.vergiNo || '',
        vergiDairesi: taseron.vergiDairesi || '',
        email: taseron.email || '',
        uzmanlik: taseron.uzmanlik || '',
      };
      updatedFirmalar = [newFirma, ...firmalar];
    }

    setFirmalar(updatedFirmalar);
    saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
    showToast(`"${taseron.isim}" taşeronu eklendi ve Firma Cari Rehberi ile senkronize edildi.`);
  };

  const handleUpdateTaseron = (taseron: Taseron) => {
    const oldTaseron = taseronlar.find((t) => t.id === taseron.id);
    const oldName = oldTaseron ? oldTaseron.isim : taseron.isim;

    // 1. Update taseronlar
    const updatedTaseronlar = taseronlar.map((t) => (t.id === taseron.id ? taseron : t));
    setTaseronlar(updatedTaseronlar);
    saveModuleToFirestore('taseronlar', updatedTaseronlar, false, setSyncStatus);

    // 2. Automatically sync updates to firmalar
    const existingFirmaIdx = firmalar.findIndex(
      (f) => f.id === taseron.id || f.isim.trim().toLowerCase() === oldName.trim().toLowerCase()
    );

    let updatedFirmalar: Firma[];
    if (existingFirmaIdx >= 0) {
      updatedFirmalar = firmalar.map((f, idx) =>
        idx === existingFirmaIdx
          ? {
              ...f,
              tur: 'taseron',
              isim: taseron.isim,
              ilgili: taseron.yetkili !== undefined ? taseron.yetkili : f.ilgili,
              telefon: taseron.telefon !== undefined ? taseron.telefon : f.telefon,
              adres: taseron.adres !== undefined ? taseron.adres : f.adres,
              vergiNo: taseron.vergiNo !== undefined ? taseron.vergiNo : f.vergiNo,
              vergiDairesi: taseron.vergiDairesi !== undefined ? taseron.vergiDairesi : f.vergiDairesi,
              email: taseron.email !== undefined ? taseron.email : f.email,
              uzmanlik: taseron.uzmanlik !== undefined ? taseron.uzmanlik : f.uzmanlik,
            }
          : f
      );
    } else {
      const newFirma: Firma = {
        id: taseron.id,
        isim: taseron.isim,
        tur: 'taseron',
        ilgili: taseron.yetkili || '',
        telefon: taseron.telefon || '',
        adres: taseron.adres || '',
        vergiNo: taseron.vergiNo || '',
        vergiDairesi: taseron.vergiDairesi || '',
        email: taseron.email || '',
        uzmanlik: taseron.uzmanlik || '',
      };
      updatedFirmalar = [newFirma, ...firmalar];
    }

    setFirmalar(updatedFirmalar);
    saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);

    // If subcontractor name changed, also update personnelList references
    if (oldName !== taseron.isim) {
      const updatedPersonnel = personnelList.map((p) =>
        p.taseronId === taseron.id || p.taseron === oldName
          ? { ...p, taseron: taseron.isim, taseronId: taseron.id }
          : p
      );
      setPersonnelList(updatedPersonnel);
      saveModuleToFirestore('personnel', updatedPersonnel, false, setSyncStatus);
    }

    showToast(`"${taseron.isim}" taşeronu ve Firma Cari kaydı güncellendi.`);
  };

  // Company & Ledger Handlers (1:1 Bidirectionally Synced with Taseronlar)
  const handleAddFirma = (firma: Firma) => {
    const updatedFirmalar = [firma, ...firmalar];
    setFirmalar(updatedFirmalar);
    saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);

    // If this firma has tur: 'taseron', automatically add to taseronlar!
    if (firma.tur === 'taseron') {
      const existingTasIdx = taseronlar.findIndex(
        (t) => t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()
      );

      let updatedTaseronlar: Taseron[];
      if (existingTasIdx >= 0) {
        updatedTaseronlar = taseronlar.map((t, idx) =>
          idx === existingTasIdx
            ? {
                ...t,
                isim: firma.isim,
                yetkili: firma.ilgili || t.yetkili || '',
                telefon: firma.telefon || t.telefon || '',
                vergiNo: firma.vergiNo || t.vergiNo || '',
                vergiDairesi: firma.vergiDairesi || t.vergiDairesi || '',
                adres: firma.adres || t.adres || '',
                email: firma.email || t.email || '',
                uzmanlik: firma.uzmanlik || t.uzmanlik || 'Genel Taşeron',
              }
            : t
        );
      } else {
        const newTaseron: Taseron = {
          id: firma.id,
          isim: firma.isim,
          yetkili: firma.ilgili || '',
          telefon: firma.telefon || '',
          uzmanlik: firma.uzmanlik || 'Genel Taşeron',
          durum: 'Aktif',
          bakiye: 0,
          vergiNo: firma.vergiNo || '',
          vergiDairesi: firma.vergiDairesi || '',
          adres: firma.adres || '',
          email: firma.email || '',
        };
        updatedTaseronlar = [newTaseron, ...taseronlar];
      }

      setTaseronlar(updatedTaseronlar);
      saveModuleToFirestore('taseronlar', updatedTaseronlar, false, setSyncStatus);
      showToast(`"${firma.isim}" taşeron firması kaydedildi ve Taşeronlar listesine eklendi.`);
    } else {
      showToast(`"${firma.isim}" firması kaydedildi.`);
    }
  };

  const handleUpdateFirma = (firma: Firma) => {
    const oldFirma = firmalar.find((f) => f.id === firma.id);
    const oldName = oldFirma ? oldFirma.isim : firma.isim;
    const wasTaseron = oldFirma?.tur === 'taseron';
    const isNowTaseron = firma.tur === 'taseron';

    const updatedFirmalar = firmalar.map((f) => (f.id === firma.id ? firma : f));
    setFirmalar(updatedFirmalar);
    saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);

    let updatedTaseronlar = [...taseronlar];
    let taseronChanged = false;

    if (isNowTaseron) {
      const existingTasIdx = updatedTaseronlar.findIndex(
        (t) => t.id === firma.id || t.isim.trim().toLowerCase() === oldName.trim().toLowerCase()
      );

      if (existingTasIdx >= 0) {
        updatedTaseronlar = updatedTaseronlar.map((t, idx) =>
          idx === existingTasIdx
            ? {
                ...t,
                isim: firma.isim,
                yetkili: firma.ilgili !== undefined ? firma.ilgili : t.yetkili,
                telefon: firma.telefon !== undefined ? firma.telefon : t.telefon,
                vergiNo: firma.vergiNo !== undefined ? firma.vergiNo : t.vergiNo,
                vergiDairesi: firma.vergiDairesi !== undefined ? firma.vergiDairesi : t.vergiDairesi,
                adres: firma.adres !== undefined ? firma.adres : t.adres,
                email: firma.email !== undefined ? firma.email : t.email,
                uzmanlik: firma.uzmanlik || t.uzmanlik || 'Genel Taşeron',
              }
            : t
        );
        taseronChanged = true;
      } else {
        const newTaseron: Taseron = {
          id: firma.id,
          isim: firma.isim,
          yetkili: firma.ilgili || '',
          telefon: firma.telefon || '',
          uzmanlik: firma.uzmanlik || 'Genel Taşeron',
          durum: 'Aktif',
          bakiye: 0,
          vergiNo: firma.vergiNo || '',
          vergiDairesi: firma.vergiDairesi || '',
          adres: firma.adres || '',
          email: firma.email || '',
        };
        updatedTaseronlar = [newTaseron, ...updatedTaseronlar];
        taseronChanged = true;
      }
    } else if (wasTaseron && !isNowTaseron) {
      // Changed role away from taseron -> remove from taseronlar
      updatedTaseronlar = updatedTaseronlar.filter(
        (t) => t.id !== firma.id && t.isim.trim().toLowerCase() !== oldName.trim().toLowerCase()
      );
      taseronChanged = true;
    }

    if (taseronChanged) {
      setTaseronlar(updatedTaseronlar);
      saveModuleToFirestore('taseronlar', updatedTaseronlar, false, setSyncStatus);
    }

    showToast(`"${firma.isim}" bilgileri güncellendi.`);
  };

  const handleBatchImportFirmaAndCari = (data: {
    firmsToUpsert: Partial<Firma>[];
    cariToInsert: Omit<FirmaCari, 'id'>[];
    summary: {
      newFirms: number;
      updatedFirms: number;
      newCari: number;
    };
  }) => {
    // 1. Process firms
    let currentFirmalar = [...firmalar];
    let firmalarChanged = false;
    let currentTaseronlar = [...taseronlar];
    let taseronChanged = false;
    const firmIdByName = new Map<string, string>();

    // Index existing firms
    currentFirmalar.forEach((f) => {
      firmIdByName.set(f.isim.trim().toLowerCase(), f.id);
      if (f.vergiNo) firmIdByName.set(f.vergiNo.trim().toLowerCase(), f.id);
    });

    data.firmsToUpsert.forEach((fData) => {
      if (!fData.isim) return;
      const normName = fData.isim.trim().toLowerCase();
      const normVkn = fData.vergiNo ? fData.vergiNo.trim().toLowerCase() : '';

      const existingId = (normVkn && firmIdByName.get(normVkn)) || firmIdByName.get(normName);

      if (existingId) {
        currentFirmalar = currentFirmalar.map((f) => {
          if (f.id === existingId) {
            return {
              ...f,
              vergiNo: fData.vergiNo || f.vergiNo,
              vergiDairesi: fData.vergiDairesi || f.vergiDairesi,
              telefon: fData.telefon || f.telefon,
              email: fData.email || f.email,
              adres: fData.adres || f.adres,
              ilgili: fData.ilgili || f.ilgili,
              uzmanlik: fData.uzmanlik || f.uzmanlik,
              tur: fData.tur || f.tur,
            };
          }
          return f;
        });
        firmalarChanged = true;
      } else {
        const newId = `firma-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newFirma: Firma = {
          id: newId,
          isim: fData.isim.trim(),
          tur: fData.tur || 'tedarikci',
          adres: fData.adres || '',
          vergiNo: fData.vergiNo || '',
          vergiDairesi: fData.vergiDairesi || '',
          ilgili: fData.ilgili || '',
          telefon: fData.telefon || '',
          email: fData.email || '',
          uzmanlik: fData.uzmanlik || '',
        };
        currentFirmalar.push(newFirma);
        firmIdByName.set(normName, newId);
        if (normVkn) firmIdByName.set(normVkn, newId);
        firmalarChanged = true;

        if (newFirma.tur === 'taseron') {
          const newTas: Taseron = {
            id: newId,
            isim: newFirma.isim,
            yetkili: newFirma.ilgili || '',
            telefon: newFirma.telefon || '',
            uzmanlik: newFirma.uzmanlik || 'Genel Taşeron',
            durum: 'Aktif',
            bakiye: 0,
            vergiNo: newFirma.vergiNo || '',
            vergiDairesi: newFirma.vergiDairesi || '',
            adres: newFirma.adres || '',
            email: newFirma.email || '',
          };
          currentTaseronlar.push(newTas);
          taseronChanged = true;
        }
      }
    });

    if (firmalarChanged) {
      setFirmalar(currentFirmalar);
      saveModuleToFirestore('firmalar', currentFirmalar, false, setSyncStatus);
    }
    if (taseronChanged) {
      setTaseronlar(currentTaseronlar);
      saveModuleToFirestore('taseronlar', currentTaseronlar, false, setSyncStatus);
    }

    // 2. Process Cari movements
    if (data.cariToInsert.length > 0) {
      let currentCari = [...cariList];
      const newGiderlerToSave: SantiyeGider[] = [];

      data.cariToInsert.forEach((cData, idx) => {
        let resolvedFirmId = cData.firmaId;
        if (resolvedFirmId.startsWith('temp-firm-')) {
          const searchKey = resolvedFirmId.replace('temp-firm-', '');
          resolvedFirmId = firmIdByName.get(searchKey) || resolvedFirmId;
        }

        const firmaObj = currentFirmalar.find((f) => f.id === resolvedFirmId);
        const uniqueId = `cari-imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

        const isOdeme = cData.islemTuru === 'odeme';
        const targetSite =
          (cData.santiyeId && santiyeler.find((s) => s.id === cData.santiyeId)) ||
          (cData.santiyeAdi &&
            santiyeler.find((s) => s.isim.trim().toLowerCase() === cData.santiyeAdi!.trim().toLowerCase()));

        const effectiveCari: FirmaCari = {
          ...cData,
          id: uniqueId,
          firmaId: resolvedFirmId,
          santiyeId: targetSite ? targetSite.id : cData.santiyeId,
          santiyeAdi: targetSite ? targetSite.isim : cData.santiyeAdi,
        };

        if (isOdeme && targetSite) {
          const giderId = `sg-cari-odeme-${Date.now()}-${idx}`;
          effectiveCari.giderId = giderId;
          const rawAmt = Math.max(Number(effectiveCari.alacak || 0), Number(effectiveCari.borc || 0));
          const firmName = firmaObj?.isim || 'Firma / Tedarikçi';

          const newGider: SantiyeGider = {
            id: giderId,
            santiyeId: targetSite.id,
            odeyen: 'Şirket Yönetimi (Firma / Tedarikçi Cari)',
            odemeYontemi: 'Firma Cari Hesabı',
            tarih: effectiveCari.tarih || getTodayDateString(),
            kategori: firmaObj?.tur === 'taseron' ? 'Taşeron Hakediş' : 'Tedarikçi / Cari Ödemesi',
            aciklama: effectiveCari.aciklama
              ? `[Fiili Cari Ödeme] ${effectiveCari.aciklama}`
              : `[Fiili Cari Ödeme] ${firmName}`,
            odemeYapilanFirma: firmName,
            durum: 'Ödendi',
            taseron: firmaObj?.tur === 'taseron' ? firmName : undefined,
            miktar: rawAmt,
            paraBirimi: effectiveCari.paraBirimi || 'TRY',
            cariHareketId: uniqueId,
            cariFirmaId: resolvedFirmId,
          };
          newGiderlerToSave.push(newGider);
        }

        currentCari.push(effectiveCari);
      });

      setCariList(currentCari);
      saveModuleToFirestore('cari', currentCari, false, setSyncStatus);

      if (newGiderlerToSave.length > 0) {
        const updatedGiderler = [...giderler, ...newGiderlerToSave];
        setGiderler(updatedGiderler);
        saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
      }
    }

    showToast(
      `Excel'den ${data.summary.newFirms} yeni firma eklendi, ${data.summary.updatedFirms} firma güncellendi, ${data.summary.newCari} cari hareket işlendi.`
    );
  };

  const handleAddCariHareket = (hareket: FirmaCari) => {
    const firma = firmalar.find((f) => f.id === hareket.firmaId);
    const matchingTas = taseronlar.find(
      (t) => t.id === hareket.firmaId || (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()))
    ) || (firma?.tur === 'taseron' ? { id: firma.id, isim: firma.isim } : null);

    const isAlisFaturasi = hareket.islemTuru === 'alis_faturasi';
    const isOdeme = hareket.islemTuru === 'odeme';
    const isSatisFaturasi = hareket.islemTuru === 'satis_faturasi';
    const isTahsilat = hareket.islemTuru === 'tahsilat';

    const targetSite =
      (hareket.santiyeId && santiyeler.find((s) => s.id === hareket.santiyeId)) ||
      (hareket.santiyeAdi &&
        santiyeler.find((s) => s.isim.trim().toLowerCase() === hareket.santiyeAdi!.trim().toLowerCase())) ||
      (isOdeme && matchingTas
        ? santiyeler.find((s) => hareket.aciklama && hareket.aciklama.toLowerCase().includes(s.isim.toLowerCase()))
        : undefined);

    let effectiveHareket: FirmaCari = {
      ...hareket,
      santiyeId: targetSite ? targetSite.id : (hareket.santiyeId || undefined),
      santiyeAdi: targetSite ? targetSite.isim : (hareket.santiyeAdi || undefined),
    };
    let newGiderToSave: SantiyeGider | null = null;

    // SADECE fiili ödemeler şantiye gideri olarak işlenir! Faturalar borç/alacak kaydı olarak caride tutulur.
    if (isOdeme && !effectiveHareket.giderId && targetSite) {
      const nowTs = Date.now();
      const giderId = `sg-cari-odeme-${nowTs}`;
      effectiveHareket.giderId = giderId;

      const firmName = firma?.isim || matchingTas?.isim || 'Firma / Tedarikçi';
      const rawAmt = Math.max(Number(effectiveHareket.alacak || 0), Number(effectiveHareket.borc || 0));

      const kategoriLabel = matchingTas ? 'Taşeron Hakediş' : 'Tedarikçi / Cari Ödemesi';
      const odeyenLabel = matchingTas ? 'Şirket Yönetimi (Taşeron Cari)' : 'Şirket Yönetimi (Firma / Tedarikçi Cari)';
      const odemeYontemiLabel = ((effectiveHareket as any).odemeYontemi || 'Firma Cari Hesabı');

      newGiderToSave = {
        id: giderId,
        santiyeId: targetSite.id,
        odeyen: odeyenLabel,
        odemeYontemi: odemeYontemiLabel,
        tarih: effectiveHareket.tarih || getTodayDateString(),
        kategori: kategoriLabel,
        aciklama: effectiveHareket.aciklama
          ? `[Fiili Cari Ödeme] ${effectiveHareket.aciklama}`
          : `[Fiili Cari Ödeme] ${firmName}`,
        odemeYapilanFirma: firmName,
        durum: 'Ödendi',
        taseron: matchingTas ? matchingTas.isim : undefined,
        miktar: rawAmt,
        paraBirimi: effectiveHareket.paraBirimi || 'TRY',
        cariHareketId: effectiveHareket.id,
        cariFirmaId: firma?.id || matchingTas?.id,
      };
    }

    const updated = [effectiveHareket, ...cariList];
    setCariList(updated);
    saveModuleToFirestore('cari', updated, false, setSyncStatus);

    if (newGiderToSave) {
      const updatedGiderler = [newGiderToSave, ...giderler];
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
      showToast(`Fiili cari ödeme kaydedildi ve "${targetSite?.isim}" şantiyesinin giderlerine eklendi.`);
    } else if (isAlisFaturasi) {
      showToast(targetSite
        ? `Alış faturası cari kayıtlara işlendi. Şantiye giderine fiili ödeme yapıldığında yansıtılacaktır.`
        : 'Alış faturası cari hesaba kaydedildi.');
    } else if (isTahsilat && targetSite) {
      showToast(`Fiili tahsilat kaydedildi ve "${targetSite.isim}" şantiyesinin gelirlerine eklendi.`);
    } else if (isSatisFaturasi) {
      showToast(targetSite
        ? `Satış faturası cari kayıtlara işlendi. Şantiye gelirine fiili tahsilat yapıldığında yansıtılacaktır.`
        : 'Satış faturası cari hesaba kaydedildi.');
    } else {
      showToast('Cari hareket kaydedildi.');
    }
  };

  const handleUpdateCariHareket = (hareket: FirmaCari) => {
    const firma = firmalar.find((f) => f.id === hareket.firmaId);
    const matchingTas = taseronlar.find(
      (t) => t.id === hareket.firmaId || (firma && (t.id === firma.id || t.isim.trim().toLowerCase() === firma.isim.trim().toLowerCase()))
    ) || (firma?.tur === 'taseron' ? { id: firma.id, isim: firma.isim } : null);

    const isAlisFaturasi = hareket.islemTuru === 'alis_faturasi';
    const isOdeme = hareket.islemTuru === 'odeme';
    const isSatisFaturasi = hareket.islemTuru === 'satis_faturasi';
    const isTahsilat = hareket.islemTuru === 'tahsilat';

    const targetSite =
      (hareket.santiyeId && santiyeler.find((s) => s.id === hareket.santiyeId)) ||
      (hareket.santiyeAdi &&
        santiyeler.find((s) => s.isim.trim().toLowerCase() === hareket.santiyeAdi!.trim().toLowerCase()));

    const normalizedHareket: FirmaCari = {
      ...hareket,
      santiyeId: targetSite ? targetSite.id : undefined,
      santiyeAdi: targetSite ? targetSite.isim : undefined,
    };

    const updated = cariList.map((c) => (c.id === normalizedHareket.id ? normalizedHareket : c));
    setCariList(updated);
    saveModuleToFirestore('cari', updated, false, setSyncStatus);

    const rawAmt = Math.max(Number(normalizedHareket.alacak || 0), Number(normalizedHareket.borc || 0));
    const firmName = firma?.isim || matchingTas?.isim || 'Firma / Tedarikçi';

    const kategoriLabel = matchingTas ? 'Taşeron Hakediş' : 'Tedarikçi / Cari Ödemesi';
    const odeyenLabel = matchingTas ? 'Şirket Yönetimi (Taşeron Cari)' : 'Şirket Yönetimi (Firma / Tedarikçi Cari)';

    // Eşleşen Şantiye Gideri varsa güncelle
    const linkedGider = giderler.find(
      (g) => (normalizedHareket.giderId && g.id === normalizedHareket.giderId) || g.cariHareketId === normalizedHareket.id
    );

    if (linkedGider) {
      if (targetSite && isOdeme) {
        const updatedGiderler = giderler.map((g) => {
          if (g.id === linkedGider.id) {
            return {
              ...g,
              santiyeId: targetSite.id,
              miktar: rawAmt > 0 ? rawAmt : Number(g.miktar),
              paraBirimi: normalizedHareket.paraBirimi || g.paraBirimi || 'TRY',
              tarih: normalizedHareket.tarih || g.tarih,
              aciklama: normalizedHareket.aciklama || g.aciklama,
              kategori: kategoriLabel,
              odeyen: odeyenLabel,
              odemeYapilanFirma: firmName,
              taseron: matchingTas ? matchingTas.isim : undefined,
            };
          }
          return g;
        });
        setGiderler(updatedGiderler);
        saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
      } else if (!targetSite || !isOdeme) {
        // İşlem ödeme değilse (fatura vs.) veya şantiye kaldırıldıysa otomatik gider fişini sil
        if (linkedGider.id.startsWith('sg-cari-') || linkedGider.id.startsWith('sg-tas-cari-') || linkedGider.cariHareketId === normalizedHareket.id) {
          const updatedGiderler = giderler.filter((g) => g.id !== linkedGider.id);
          setGiderler(updatedGiderler);
          saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
        }
      }
    } else if (targetSite && isOdeme) {
      // Düzenleme sırasında cari kayda yeni şantiye seçildiyse ve işlem ödeme ise giderlere ekle
      const nowTs = Date.now();
      const giderId = `sg-cari-odeme-${nowTs}`;
      const newGider: SantiyeGider = {
        id: giderId,
        santiyeId: targetSite.id,
        odeyen: odeyenLabel,
        odemeYontemi: ((normalizedHareket as any).odemeYontemi || 'Firma Cari Hesabı'),
        tarih: normalizedHareket.tarih || getTodayDateString(),
        kategori: kategoriLabel,
        aciklama: normalizedHareket.aciklama
          ? `[Fiili Cari Ödeme] ${normalizedHareket.aciklama}`
          : `[Fiili Cari Ödeme] ${firmName}`,
        odemeYapilanFirma: firmName,
        durum: 'Ödendi',
        taseron: matchingTas ? matchingTas.isim : undefined,
        miktar: rawAmt,
        paraBirimi: normalizedHareket.paraBirimi || 'TRY',
        cariHareketId: normalizedHareket.id,
        cariFirmaId: firma?.id || matchingTas?.id,
      };
      const updatedGiderler = [newGider, ...giderler];
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
    }

    if (targetSite && isOdeme) {
      showToast(`Fiili cari ödeme güncellendi ve "${targetSite.isim}" şantiyesinin giderlerine yansıtıldı.`);
    } else if (isAlisFaturasi) {
      showToast(targetSite
        ? `Alış faturası güncellendi. Şantiye giderine fiili ödeme yapıldığında yansıtılacaktır.`
        : 'Alış faturası güncellendi.');
    } else if (targetSite && isTahsilat) {
      showToast(`Fiili tahsilat güncellendi ve "${targetSite.isim}" şantiyesinin gelirlerine yansıtıldı.`);
    } else if (isSatisFaturasi) {
      showToast(targetSite
        ? `Satış faturası güncellendi. Şantiye gelirine fiili tahsilat yapıldığında yansıtılacaktır.`
        : 'Satış faturası güncellendi.');
    } else {
      showToast('Cari hareket / fatura kaydı güncellendi.');
    }
  };

  const handleDeleteCariHareket = (id: string) => {
    if (!canUserDelete) {
      showToast('Cari hareket silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    markItemDeleted('cari', id);
    const cariToDelete = cariList.find((c) => c.id === id);
    const updated = cariList.filter((c) => c.id !== id);
    setCariList(updated);
    saveModuleToFirestore('cari', updated, true, setSyncStatus);

    // 1. Çek Takibi Senkronizasyonu: Cari harekete bağlı çek varsa Çek Takibinden de sil veya ciro iptal et
    const matchingCek = cekler.find(
      (c) =>
        (cariToDelete?.cekId && c.id === cariToDelete.cekId) ||
        (c.cariHareketId && c.cariHareketId === id) ||
        (c.ciroCariHareketId && c.ciroCariHareketId === id)
    );

    if (matchingCek) {
      if (matchingCek.ciroCariHareketId && matchingCek.ciroCariHareketId === id && matchingCek.cekTuru === 'alinan_cek') {
        // Alınan çekin cirosu ise, ciroyu iptal et ve portföye al
        const revertedCek: Cek = {
          ...matchingCek,
          durum: 'Portföyde',
          ciroFirmaId: undefined,
          ciroEdilenFirma: undefined,
          ciroTarihi: undefined,
          ciroCariHesabaIsle: false,
          ciroCariHareketId: undefined,
          ciroAciklama: undefined,
          hamil: 'Şirket Portföyü',
        };
        const updatedCekler = cekler.map((c) => (c.id === matchingCek.id ? revertedCek : c));
        setCekler(updatedCekler);
        saveModuleToFirestore('cekler', updatedCekler, true, setSyncStatus);
      } else {
        // Çek Takibinden tamamen sil
        markItemDeleted('cekler', matchingCek.id);
        const updatedCekler = cekler.filter((c) => c.id !== matchingCek.id);
        setCekler(updatedCekler);
        saveModuleToFirestore('cekler', updatedCekler, true, setSyncStatus);
      }
    }

    // 2. Eşleşen Şantiye Gideri / Hakediş varsa sil (Taşeron hakediş / gider senkronizasyonu)
    const isMatchingGider = (g: SantiyeGider) => {
      if (cariToDelete?.giderId && g.id === cariToDelete.giderId) return true;
      if (g.cariHareketId && g.cariHareketId === id) return true;
      if (matchingCek) {
        if ((g as any).cekId && (g as any).cekId === matchingCek.id) return true;
        if (matchingCek.cariHareketId && g.cariHareketId && g.cariHareketId === matchingCek.cariHareketId) return true;
        if (matchingCek.ciroCariHareketId && g.cariHareketId && g.cariHareketId === matchingCek.ciroCariHareketId) return true;
      }
      return false;
    };

    const removedGiderler = giderler.filter(isMatchingGider);
    removedGiderler.forEach((g) => markItemDeleted('giderler', g.id));

    const updatedGiderler = giderler.filter((g) => !isMatchingGider(g));
    if (updatedGiderler.length !== giderler.length) {
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, true, setSyncStatus);
    }

    // 3. Eşleşen Personel Ödemeleri varsa sil (Taşeron cari hesabından silinen personelle alakalı doğrudan ödeme işlemleri)
    const isMatchingOdeme = (o: PersonelOdeme) => {
      // Kesinlikle ve sadece bu cari kaydıyla doğrudan ilişkili olan ödemeleri eşleştir:
      if (o.cariHareketId && o.cariHareketId === id) return true;
      if (cariToDelete?.id && o.cariHareketId && o.cariHareketId === cariToDelete.id) return true;
      if (cariToDelete?.odemeId && o.id === cariToDelete.odemeId) return true;
      if (cariToDelete?.giderId && (o as any).giderId && (o as any).giderId === cariToDelete.giderId) return true;
      if (matchingCek) {
        if ((o as any).cekId && (o as any).cekId === matchingCek.id) return true;
        if (matchingCek.cariHareketId && o.cariHareketId && o.cariHareketId === matchingCek.cariHareketId) return true;
        if (matchingCek.ciroCariHareketId && o.cariHareketId && o.cariHareketId === matchingCek.ciroCariHareketId) return true;
      }
      return false;
    };

    const matchingOdemeler = odemeList.filter(isMatchingOdeme);
    if (matchingOdemeler.length > 0) {
      matchingOdemeler.forEach((o) => markItemDeleted('odemeler', o.id));
      const matchingIds = new Set(matchingOdemeler.map((o) => o.id));
      const updatedOdemeler = odemeList.filter((o) => !matchingIds.has(o.id));
      setOdemeList(updatedOdemeler);
      saveModuleToFirestore('odemeler', updatedOdemeler, true, setSyncStatus);
    }

    // 4. Eşleşen Kredi Kartı Harcaması varsa sil
    const isMatchingKartTx = (tx: KrediKartiHarcama) => {
      if (cariToDelete?.kartHarcamaId && tx.id === cariToDelete.kartHarcamaId) return true;
      if (tx.cariHareketId && (tx.cariHareketId === id || (cariToDelete?.id && tx.cariHareketId === cariToDelete.id))) return true;
      if (cariToDelete?.giderId && tx.santiyeGiderId && tx.santiyeGiderId === cariToDelete.giderId) return true;
      return false;
    };

    const removedKartTxs = kartHarcamalari.filter(isMatchingKartTx);
    removedKartTxs.forEach((tx) => markItemDeleted('kart_harcamalari', tx.id));

    const updatedKartTxs = kartHarcamalari.filter((tx) => !isMatchingKartTx(tx));
    if (updatedKartTxs.length !== kartHarcamalari.length) {
      setKartHarcamalari(updatedKartTxs);
      saveModuleToFirestore('kart_harcamalari', updatedKartTxs, true, setSyncStatus);
    }
    if (updatedKartTxs.length !== kartHarcamalari.length) {
      setKartHarcamalari(updatedKartTxs);
      saveModuleToFirestore('kart_harcamalari', updatedKartTxs, true, setSyncStatus);
    }

    if (matchingCek) {
      showToast(`Cari hareket, Çek Takibindeki "${matchingCek.cekNo}" nolu çek ve Hakediş/Ödeme kayıtları başarıyla silindi.`, 'info');
    } else if (cariToDelete?.kartHarcamaId || updatedKartTxs.length !== kartHarcamalari.length) {
      showToast('Cari hareket ve ilişkili Kredi Kartı Harcaması ile Şantiye Giderleri başarıyla silindi.', 'info');
    } else {
      showToast('Cari hareket silindi.', 'info');
    }
  };

  // Checks Handlers
  const handleAddCek = (cek: Cek, cariHareket?: FirmaCari, ciroCariHareket?: FirmaCari) => {
    const updatedCekler = [cek, ...cekler];
    setCekler(updatedCekler);
    saveModuleToFirestore('cekler', updatedCekler, false, setSyncStatus);

    const newCaris: FirmaCari[] = [];
    if (cariHareket) newCaris.push(cariHareket);
    if (ciroCariHareket) newCaris.push(ciroCariHareket);

    if (newCaris.length > 0) {
      const updatedCari = [...newCaris, ...cariList];
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
      showToast(`"${cek.cekNo}" nolu çek kaydedildi ve ilgili firma cari hesaplarına işlendi.`);
    } else {
      showToast(`"${cek.cekNo}" seri nolu çek kaydedildi.`);
    }
  };

  const handleUpdateCek = (cek: Cek, cariHareket?: FirmaCari, ciroCariHareket?: FirmaCari) => {
    const updatedCekler = cekler.map((c) => (c.id === cek.id ? cek : c));
    setCekler(updatedCekler);
    saveModuleToFirestore('cekler', updatedCekler, false, setSyncStatus);

    let updatedCari = [...cariList];
    let cariChanged = false;

    // 1. Birincil cari hareket güncellemesi (Çekin ilk alındığı/verildiği firma)
    if (cariHareket) {
      const existingIdx = updatedCari.findIndex((ch) => ch.id === cariHareket.id || (ch.cekId === cek.id && ch.id !== cek.ciroCariHareketId));
      if (existingIdx >= 0) {
        updatedCari[existingIdx] = cariHareket;
      } else {
        updatedCari = [cariHareket, ...updatedCari];
      }
      cariChanged = true;
    } else if (cek.cariHareketId) {
      const beforeLen = updatedCari.length;
      updatedCari = updatedCari.filter((ch) => ch.id !== cek.cariHareketId);
      if (updatedCari.length !== beforeLen) cariChanged = true;
    }

    // 2. Ciro cari hareket güncellemesi (Çekin ciro edildiği firma)
    if (ciroCariHareket) {
      const existingCiroIdx = updatedCari.findIndex((ch) => ch.id === ciroCariHareket.id);
      if (existingCiroIdx >= 0) {
        updatedCari[existingCiroIdx] = ciroCariHareket;
      } else {
        updatedCari = [ciroCariHareket, ...updatedCari];
      }
      cariChanged = true;
    } else if (cek.ciroCariHareketId && !cek.ciroCariHesabaIsle) {
      const beforeLen = updatedCari.length;
      updatedCari = updatedCari.filter((ch) => ch.id !== cek.ciroCariHareketId);
      if (updatedCari.length !== beforeLen) cariChanged = true;
    }

    if (cariChanged) {
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    }

    showToast(`"${cek.cekNo}" nolu çek güncellendi.`);
  };

  const handleCiroCek = (
    cekId: string,
    ciroFirmaId: string,
    ciroTarihi: string,
    cariHesabaIsle: boolean,
    ciroAciklama?: string,
    santiyeId?: string,
    santiyeProje?: string
  ) => {
    const targetCek = cekler.find((c) => c.id === cekId);
    if (!targetCek) return;

    const targetFirma = firmalar.find((f) => f.id === ciroFirmaId);
    if (!targetFirma) {
      showToast('Lütfen ciro edilecek geçerli bir firma seçiniz.', 'error');
      return;
    }

    const matchedSite = santiyeler.find(
      (s) =>
        (santiyeId && s.id === santiyeId) ||
        (santiyeProje && s.isim.trim().toLowerCase() === santiyeProje.trim().toLowerCase()) ||
        (targetCek.santiyeId && s.id === targetCek.santiyeId) ||
        (targetCek.santiyeProje && s.isim.trim().toLowerCase() === targetCek.santiyeProje.trim().toLowerCase())
    );
    const effectiveSantiyeId = santiyeId !== undefined ? (matchedSite?.id || undefined) : (matchedSite?.id || targetCek.santiyeId);
    const effectiveSantiyeAdi = santiyeProje !== undefined ? (matchedSite?.isim || santiyeProje || undefined) : (matchedSite?.isim || targetCek.santiyeProje);

    const ciroCariId = targetCek.ciroCariHareketId || `fc-ciro-${Date.now()}`;
    let updatedCari = [...cariList];

    if (cariHesabaIsle) {
      const ciroCariHareket: FirmaCari = {
        id: ciroCariId,
        firmaId: targetFirma.id,
        borc: 0,
        alacak: targetCek.miktar,
        paraBirimi: targetCek.paraBirimi || 'TRY',
        islemTuru: 'odeme',
        tarih: ciroTarihi || getTodayDateString(),
        saat: '12:00',
        faturaNo: `CİRO-${targetCek.cekNo.trim()}`,
        aciklama: `Ciro Edilen Çek Ödemesi (${targetCek.bankaAdi} - Vade: ${targetCek.vadeTarihi || 'Belirtilmedi'})${effectiveSantiyeAdi ? ` [${effectiveSantiyeAdi}]` : ''}${ciroAciklama ? ' - ' + ciroAciklama.trim() : ''}`,
        cekId: targetCek.id,
        santiyeId: effectiveSantiyeId,
        santiyeAdi: effectiveSantiyeAdi,
      };

      const existingIdx = updatedCari.findIndex((ch) => ch.id === ciroCariId);
      if (existingIdx >= 0) {
        updatedCari[existingIdx] = ciroCariHareket;
      } else {
        updatedCari = [ciroCariHareket, ...updatedCari];
      }
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    } else if (targetCek.ciroCariHareketId) {
      updatedCari = updatedCari.filter((ch) => ch.id !== targetCek.ciroCariHareketId);
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    }

    const updatedCek: Cek = {
      ...targetCek,
      durum: 'Ciro Edildi',
      ciroFirmaId: targetFirma.id,
      ciroEdilenFirma: targetFirma.isim,
      ciroTarihi: ciroTarihi || getTodayDateString(),
      ciroCariHesabaIsle: cariHesabaIsle,
      ciroCariHareketId: cariHesabaIsle ? ciroCariId : undefined,
      ciroAciklama: ciroAciklama?.trim() || '',
      ciroSantiyeId: effectiveSantiyeId,
      ciroSantiyeProje: effectiveSantiyeAdi,
      santiyeId: effectiveSantiyeId || targetCek.santiyeId,
      santiyeProje: effectiveSantiyeAdi || targetCek.santiyeProje,
      hamil: targetFirma.isim,
    };

    const updatedCekler = cekler.map((c) => (c.id === cekId ? updatedCek : c));
    setCekler(updatedCekler);
    saveModuleToFirestore('cekler', updatedCekler, false, setSyncStatus);

    showToast(
      `"${targetCek.cekNo}" nolu çek "${targetFirma.isim}" firmasına ciro edildi${cariHesabaIsle ? ' ve cari hesabına ödeme olarak işlendi.' : '.'}`
    );
  };

  const handleCancelCiroCek = (cekId: string) => {
    const targetCek = cekler.find((c) => c.id === cekId);
    if (!targetCek) return;

    let updatedCari = [...cariList];
    if (targetCek.ciroCariHareketId) {
      updatedCari = updatedCari.filter((ch) => ch.id !== targetCek.ciroCariHareketId);
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    }

    const updatedCek: Cek = {
      ...targetCek,
      durum: 'Portföyde',
      ciroFirmaId: undefined,
      ciroEdilenFirma: undefined,
      ciroTarihi: undefined,
      ciroCariHesabaIsle: false,
      ciroCariHareketId: undefined,
      ciroAciklama: undefined,
      hamil: targetCek.cekTuru === 'alinan_cek' ? 'Şirket Portföyü' : targetCek.hamil,
    };

    const updatedCekler = cekler.map((c) => (c.id === cekId ? updatedCek : c));
    setCekler(updatedCekler);
    saveModuleToFirestore('cekler', updatedCekler, false, setSyncStatus);

    showToast(`"${targetCek.cekNo}" nolu çekin cirosu iptal edildi ve portföye geri alındı.`, 'info');
  };

  const handleUpdateCekStatus = (id: string, status: Cek['durum']) => {
    const updated = cekler.map((c) => (c.id === id ? { ...c, durum: status } : c));
    setCekler(updated);
    saveModuleToFirestore('cekler', updated, false, setSyncStatus);
    showToast(`Çek durumu "${status}" olarak güncellendi.`);
  };

  const handleDeleteCek = (id: string) => {
    if (!canUserDelete) {
      showToast('Çek silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    markItemDeleted('cekler', id);
    const cekToDelete = cekler.find((c) => c.id === id);
    const updatedCekler = cekler.filter((c) => c.id !== id);
    setCekler(updatedCekler);
    saveModuleToFirestore('cekler', updatedCekler, true, setSyncStatus);

    // 1. Cari Hareket Senkronizasyonu (Çeke bağlı birincil ve ciro cari kayıtları)
    const matchingCariIds = new Set<string>();
    if (cekToDelete?.cariHareketId) matchingCariIds.add(cekToDelete.cariHareketId);
    if (cekToDelete?.ciroCariHareketId) matchingCariIds.add(cekToDelete.ciroCariHareketId);
    cariList.forEach((c) => {
      if (
        c.cekId === id ||
        (cekToDelete?.cekNo && cekToDelete.cekNo.trim().length >= 4 && (c.faturaNo?.includes(cekToDelete.cekNo) || c.aciklama?.includes(cekToDelete.cekNo)))
      ) {
        matchingCariIds.add(c.id);
      }
    });

    if (matchingCariIds.size > 0) {
      matchingCariIds.forEach((cId) => markItemDeleted('cari', cId));
      const updatedCari = cariList.filter((c) => !matchingCariIds.has(c.id));
      if (updatedCari.length !== cariList.length) {
        setCariList(updatedCari);
        saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
      }
    }

    // 2. Şantiye Giderleri / Hakediş Senkronizasyonu
    const isMatchingGider = (g: SantiyeGider) => {
      if ((g as any).cekId && (g as any).cekId === id) return true;
      if (cekToDelete?.cariHareketId && g.cariHareketId && g.cariHareketId === cekToDelete.cariHareketId) return true;
      if (cekToDelete?.ciroCariHareketId && g.cariHareketId && g.cariHareketId === cekToDelete.ciroCariHareketId) return true;
      if (g.cariHareketId && matchingCariIds.has(g.cariHareketId)) return true;
      if (cekToDelete?.cekNo && cekToDelete.cekNo.trim().length >= 4 && (
        (g.aciklama && g.aciklama.includes(cekToDelete.cekNo)) || (g.odemeYontemi && g.odemeYontemi.includes(cekToDelete.cekNo))
      )) return true;
      return false;
    };

    const removedGiderler = giderler.filter(isMatchingGider);
    removedGiderler.forEach((g) => markItemDeleted('giderler', g.id));

    const updatedGiderler = giderler.filter((g) => !isMatchingGider(g));
    if (updatedGiderler.length !== giderler.length) {
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, true, setSyncStatus);
    }

    // 3. Personel & Taşeron Ödeme Listesi Senkronizasyonu
    const isMatchingOdeme = (o: PersonelOdeme) => {
      if ((o as any).cekId && (o as any).cekId === id) return true;
      if (cekToDelete?.cariHareketId && o.cariHareketId && o.cariHareketId === cekToDelete.cariHareketId) return true;
      if (cekToDelete?.ciroCariHareketId && o.cariHareketId && o.cariHareketId === cekToDelete.ciroCariHareketId) return true;
      if (o.cariHareketId && matchingCariIds.has(o.cariHareketId)) return true;
      if (cekToDelete?.cekNo && cekToDelete.cekNo.trim().length >= 4 && o.aciklama && o.aciklama.includes(cekToDelete.cekNo)) return true;
      return false;
    };

    const removedOdemeler = odemeList.filter(isMatchingOdeme);
    removedOdemeler.forEach((o) => markItemDeleted('odemeler', o.id));

    const updatedOdemeler = odemeList.filter((o) => !isMatchingOdeme(o));
    if (updatedOdemeler.length !== odemeList.length) {
      setOdemeList(updatedOdemeler);
      saveModuleToFirestore('odemeler', updatedOdemeler, true, setSyncStatus);
    }

    showToast(
      `"${cekToDelete?.cekNo || 'Çek'}" seri nolu çek; Çek Takibi, Cari Hesaplar ve Hakediş/Ödeme hareketlerinden başarıyla silindi.`,
      'info'
    );
  };

  // Credit Card Handlers
  const handleAddKrediKarti = (card: KrediKarti) => {
    const updated = [card, ...krediKartlari];
    setKrediKartlari(updated);
    saveModuleToFirestore('kredi_kartlari', updated, false, setSyncStatus);
    showToast(`"${card.kartAdi}" kredi kartı tanımlandı.`);
  };

  const handleUpdateKrediKarti = (card: KrediKarti) => {
    const updated = krediKartlari.map((c) => (c.id === card.id ? card : c));
    setKrediKartlari(updated);
    saveModuleToFirestore('kredi_kartlari', updated, false, setSyncStatus);
    showToast(`"${card.kartAdi}" bilgileri güncellendi.`);
  };

  const handleDeleteKrediKarti = (id: string) => {
    if (!canUserDelete) {
      showToast('Kredi kartı silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    const updatedCards = krediKartlari.filter((c) => c.id !== id);
    const txsToDelete = kartHarcamalari.filter((t) => t.kartId === id);
    const updatedTxs = kartHarcamalari.filter((t) => t.kartId !== id);
    setKrediKartlari(updatedCards);
    setKartHarcamalari(updatedTxs);
    saveModuleToFirestore('kredi_kartlari', updatedCards, false, setSyncStatus);
    saveModuleToFirestore('kart_harcamalari', updatedTxs, false, setSyncStatus);

    const txIds = new Set(txsToDelete.map((t) => t.id));
    const cariIds = new Set(txsToDelete.map((t) => t.cariHareketId).filter(Boolean) as string[]);
    const giderIds = new Set(txsToDelete.map((t) => t.santiyeGiderId).filter(Boolean) as string[]);

    const updatedCari = cariList.filter(
      (c) => !cariIds.has(c.id) && (!c.kartHarcamaId || !txIds.has(c.kartHarcamaId)) && (!c.kartId || c.kartId !== id)
    );
    if (updatedCari.length !== cariList.length) {
      setCariList(updatedCari);
      saveModuleToFirestore('cari', updatedCari, false, setSyncStatus);
    }

    const updatedGiderler = giderler.filter(
      (g) => !giderIds.has(g.id) && (!g.kartHarcamaId || !txIds.has(g.kartHarcamaId)) && (!g.kartId || g.kartId !== id)
    );
    if (updatedGiderler.length !== giderler.length) {
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
    }

    showToast('Kredi kartı ve ilişkili tüm cari ve gider hareketleri silindi.', 'info');
  };

  const handleAddKartHarcama = (tx: KrediKartiHarcama) => {
    let transactionToSave: KrediKartiHarcama = { ...tx };
    const isHarcama = tx.islemTipi === 'Harcama';

    // 1. Firma / Tedarikçi / Taşeron Tespiti
    const targetFirmaId = tx.firmaId;
    const targetFirmaName = tx.firmaAdi?.trim() || '';
    let matchingFirma = firmalar.find((f) => {
      if (targetFirmaName) {
        return f.isim.trim().toLowerCase() === targetFirmaName.toLowerCase();
      }
      return Boolean(targetFirmaId && f.id === targetFirmaId);
    });

    const matchingTas = taseronlar.find(
      (t) =>
        (matchingFirma && (t.id === matchingFirma.id || t.isim.trim().toLowerCase() === matchingFirma.isim.trim().toLowerCase())) ||
        (targetFirmaName && t.isim.trim().toLowerCase() === targetFirmaName.toLowerCase())
    );

    const isTaseron =
      Boolean(matchingTas) ||
      (matchingFirma && matchingFirma.tur === 'taseron') ||
      (!targetFirmaName && (tx.kategori?.toLowerCase().includes('taşeron') || tx.kategori?.toLowerCase().includes('taseron')));

    const cardObj = krediKartlari.find((c) => c.id === tx.kartId);
    const cardLabel = cardObj ? `${cardObj.banka} - ${cardObj.kartAdi} (..${cardObj.kartNumarasiSon4})` : 'Kredi Kartı';
    const nowTs = Date.now();

    let createdCariId: string | undefined = tx.cariHareketId;
    let createdGiderId: string | undefined = tx.santiyeGiderId;

    // Eğer harcama ise ve firma Cari Kayıtlarında mevcutsa (veya kullanıcı cariHesabaIsle seçtiyse) Cari Hesaba Ödeme olarak ekle
    const shouldSyncToCari = Boolean(matchingFirma || isTaseron || (targetFirmaName && tx.cariHesabaIsle));
    if (isHarcama && shouldSyncToCari && Number(tx.tutar) > 0) {
      if (!matchingFirma) {
        matchingFirma = {
          id: matchingTas?.id || `f-${isTaseron ? 'tas' : 'ted'}-${nowTs}`,
          isim: targetFirmaName || matchingTas?.isim || 'Firma / Tedarikçi',
          tur: isTaseron ? 'taseron' : 'tedarikci',
          ilgili: matchingTas?.yetkili || '',
          telefon: matchingTas?.telefon || '',
          vergiNo: matchingTas?.vergiNo || '',
          adres: matchingTas?.adres || '',
          email: matchingTas?.email || '',
          uzmanlik: matchingTas?.uzmanlik || (isTaseron ? 'Genel Taşeron' : undefined),
        };
        const updatedFirmalar = [matchingFirma, ...firmalar];
        setFirmalar(updatedFirmalar);
        saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
      }

      if (!createdCariId) {
        createdCariId = `fc-kk-${nowTs}`;
      }
      if (!createdGiderId && (tx.santiyeId || isTaseron)) {
        createdGiderId = `sg-kk-${nowTs}`;
      }

      const newCari: FirmaCari = {
        id: createdCariId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: Number(tx.tutar),
        paraBirimi: tx.paraBirimi || 'TRY',
        tarih: tx.tarih || getTodayDateString(),
        saat: '12:00',
        faturaNo: tx.faturaNo || `KK-${cardObj?.kartAdi.slice(0, 3).toUpperCase() || 'KART'}-${cardObj?.kartNumarasiSon4 || tx.id.slice(-4)}`,
        aciklama: isTaseron
          ? `[Kredi Kartı Taşeron Ödemesi] ${cardLabel} - ${tx.aciklama || 'Taşeron Hakediş Ödemesi'}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`
          : `[Kredi Kartı Ödemesi] ${cardLabel} - ${tx.aciklama || 'Malzeme/Hizmet Alımı'}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`,
        islemTuru: 'odeme',
        kartHarcamaId: tx.id,
        kartId: tx.kartId,
        giderId: createdGiderId,
        hedefParaBirimi: tx.paraBirimi || 'TRY',
        hedefDusulenTutar: Number(tx.tutar),
      };

      const existingCariIndex = cariList.findIndex(
        (c) => c.id === createdCariId || (c.kartHarcamaId && c.kartHarcamaId === tx.id)
      );
      let updatedCariList: FirmaCari[];
      if (existingCariIndex >= 0) {
        updatedCariList = cariList.map((c, idx) => (idx === existingCariIndex ? newCari : c));
      } else {
        updatedCariList = [newCari, ...cariList];
      }
      setCariList(updatedCariList);
      saveModuleToFirestore('cari', updatedCariList, false, setSyncStatus);

      // 2. Eğer Şantiye seçildiyse veya Taşeron ise Şantiye Giderlerine de ekle
      if (tx.santiyeId || isTaseron) {
        const targetSiteId = tx.santiyeId || santiyeler[0]?.id || '';
        const newGider: SantiyeGider = {
          id: createdGiderId!,
          santiyeId: targetSiteId,
          odeyen: `Şirket Yönetimi (${cardLabel})`,
          odemeYontemi: `Kredi Kartı (${cardObj?.kartAdi || 'Kredi Kartı'})`,
          tarih: tx.tarih || getTodayDateString(),
          kategori: isTaseron ? 'Taşeron Hakediş' : (tx.kategori || 'Şantiye Gideri'),
          aciklama: isTaseron
            ? `[Kredi Kartı ile Taşeron Ödemesi] ${matchingFirma.isim} - ${cardLabel} - ${tx.aciklama}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`
            : `[Kredi Kartı Harcaması] ${matchingFirma.isim} - ${cardLabel} - ${tx.aciklama}`,
          odemeYapilanFirma: matchingFirma.isim,
          durum: 'Ödendi',
          taseron: isTaseron ? (matchingTas?.isim || matchingFirma.isim) : undefined,
          miktar: Number(tx.tutar),
          paraBirimi: tx.paraBirimi || 'TRY',
          kartId: tx.kartId,
          kartHarcamaId: tx.id,
          taksitSayisi: Number(tx.taksitSayisi || 1),
          cariHareketId: createdCariId,
          cariFirmaId: matchingFirma.id,
        };

        const existingGiderIndex = giderler.findIndex(
          (g) => g.id === createdGiderId || (g.kartHarcamaId && g.kartHarcamaId === tx.id)
        );
        let updatedGiderler: SantiyeGider[];
        if (existingGiderIndex >= 0) {
          updatedGiderler = giderler.map((g, idx) => (idx === existingGiderIndex ? newGider : g));
        } else {
          updatedGiderler = [newGider, ...giderler];
        }
        setGiderler(updatedGiderler);
        saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
      }

      transactionToSave = {
        ...transactionToSave,
        firmaId: matchingFirma.id,
        firmaAdi: matchingFirma.isim,
        cariHareketId: createdCariId,
        santiyeGiderId: createdGiderId,
        cariHesabaIsle: true,
      };
    } else if (isHarcama && tx.santiyeId && Number(tx.tutar) > 0) {
      // Sadece şantiye seçilmişse genel şantiye gideri oluştur
      if (!createdGiderId) {
        createdGiderId = `sg-kk-${nowTs}`;
      }
      const newGider: SantiyeGider = {
        id: createdGiderId,
        santiyeId: tx.santiyeId,
        odeyen: `Şirket Yönetimi (${cardLabel})`,
        odemeYontemi: `Kredi Kartı (${cardObj?.kartAdi || 'Kredi Kartı'})`,
        tarih: tx.tarih || getTodayDateString(),
        kategori: tx.kategori || 'Şantiye Gideri',
        aciklama: `[Kredi Kartı Harcaması] ${cardLabel} - ${tx.aciklama}`,
        odemeYapilanFirma: tx.firmaAdi || undefined,
        durum: 'Ödendi',
        miktar: Number(tx.tutar),
        paraBirimi: tx.paraBirimi || 'TRY',
        kartId: tx.kartId,
        kartHarcamaId: tx.id,
        taksitSayisi: Number(tx.taksitSayisi || 1),
      };
      const updatedGiderler = [newGider, ...giderler];
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);

      transactionToSave = {
        ...transactionToSave,
        santiyeGiderId: createdGiderId,
      };
    }

    const updatedTxs = [transactionToSave, ...kartHarcamalari];
    setKartHarcamalari(updatedTxs);
    saveModuleToFirestore('kart_harcamalari', updatedTxs, false, setSyncStatus);

    if (isTaseron && matchingFirma) {
      showToast(`Kart harcaması kaydedildi. "${matchingFirma.isim}" Taşeron Cari Hesabı, Taşeron Hakediş/Ödeme ve Şantiye Giderleri ile tam senkronize edildi.`);
    } else if (matchingFirma) {
      showToast(`Kart harcaması kaydedildi ve "${matchingFirma.isim}" Firma Cari Hesabına "Ödeme Yapıldı" olarak işlendi.`);
    } else {
      showToast(tx.islemTipi === 'Harcama' ? 'Kart harcaması kaydedildi.' : 'Karta ödeme işlendi.');
    }
  };

  const handleUpdateKartHarcama = (tx: KrediKartiHarcama) => {
    if (!canUserEdit) {
      showToast('Kredi kartı hareketi düzenleme yetkiniz bulunmamaktadır.', 'error');
      return;
    }

    const oldTx = kartHarcamalari.find((t) => t.id === tx.id);
    let transactionToSave: KrediKartiHarcama = { ...tx };
    const isHarcama = tx.islemTipi === 'Harcama';

    // 1. Firma / Tedarikçi / Taşeron Tespiti
    const targetFirmaId = tx.firmaId;
    const targetFirmaName = tx.firmaAdi?.trim() || '';
    let matchingFirma = firmalar.find((f) => {
      if (targetFirmaName) {
        return f.isim.trim().toLowerCase() === targetFirmaName.toLowerCase();
      }
      return Boolean(targetFirmaId && f.id === targetFirmaId);
    });

    const matchingTas = taseronlar.find(
      (t) =>
        (matchingFirma && (t.id === matchingFirma.id || t.isim.trim().toLowerCase() === matchingFirma.isim.trim().toLowerCase())) ||
        (targetFirmaName && t.isim.trim().toLowerCase() === targetFirmaName.toLowerCase())
    );

    const isTaseron =
      Boolean(matchingTas) ||
      (matchingFirma && matchingFirma.tur === 'taseron') ||
      (!targetFirmaName && (tx.kategori?.toLowerCase().includes('taşeron') || tx.kategori?.toLowerCase().includes('taseron')));

    const cardObj = krediKartlari.find((c) => c.id === tx.kartId);
    const cardLabel = cardObj ? `${cardObj.banka} - ${cardObj.kartAdi} (..${cardObj.kartNumarasiSon4})` : 'Kredi Kartı';
    const nowTs = Date.now();

    let existingCariId = tx.cariHareketId || oldTx?.cariHareketId;
    let existingGiderId = tx.santiyeGiderId || oldTx?.santiyeGiderId;

    let updatedCariList = [...cariList];
    let updatedGiderler = [...giderler];
    let cariChanged = false;
    let giderChanged = false;

    const shouldSyncToCari = Boolean(matchingFirma || isTaseron || (targetFirmaName && tx.cariHesabaIsle));
    if (isHarcama && shouldSyncToCari && Number(tx.tutar) > 0) {
      if (!matchingFirma) {
        matchingFirma = {
          id: matchingTas?.id || `f-${isTaseron ? 'tas' : 'ted'}-${nowTs}`,
          isim: targetFirmaName || matchingTas?.isim || 'Firma / Tedarikçi',
          tur: isTaseron ? 'taseron' : 'tedarikci',
          ilgili: matchingTas?.yetkili || '',
          telefon: matchingTas?.telefon || '',
          vergiNo: matchingTas?.vergiNo || '',
          adres: matchingTas?.adres || '',
          email: matchingTas?.email || '',
          uzmanlik: matchingTas?.uzmanlik || (isTaseron ? 'Genel Taşeron' : undefined),
        };
        const updatedFirmalar = [matchingFirma, ...firmalar];
        setFirmalar(updatedFirmalar);
        saveModuleToFirestore('firmalar', updatedFirmalar, false, setSyncStatus);
      }

      if (!existingCariId) {
        existingCariId = `fc-kk-${nowTs}`;
      }
      if (!existingGiderId && (tx.santiyeId || isTaseron)) {
        existingGiderId = `sg-kk-${nowTs}`;
      }

      const syncCari: FirmaCari = {
        id: existingCariId,
        firmaId: matchingFirma.id,
        borc: 0,
        alacak: Number(tx.tutar),
        paraBirimi: tx.paraBirimi || 'TRY',
        tarih: tx.tarih || getTodayDateString(),
        saat: '12:00',
        faturaNo: tx.faturaNo || `KK-${cardObj?.kartAdi.slice(0, 3).toUpperCase() || 'KART'}-${cardObj?.kartNumarasiSon4 || tx.id.slice(-4)}`,
        aciklama: isTaseron
          ? `[Kredi Kartı Taşeron Ödemesi] ${cardLabel} - ${tx.aciklama || 'Taşeron Hakediş Ödemesi'}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`
          : `[Kredi Kartı Ödemesi] ${cardLabel} - ${tx.aciklama || 'Malzeme/Hizmet Alımı'}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`,
        islemTuru: 'odeme',
        kartHarcamaId: tx.id,
        kartId: tx.kartId,
        giderId: existingGiderId,
        hedefParaBirimi: tx.paraBirimi || 'TRY',
        hedefDusulenTutar: Number(tx.tutar),
      };

      const existingCariIndex = updatedCariList.findIndex(
        (c) => c.id === existingCariId || (c.kartHarcamaId && c.kartHarcamaId === tx.id)
      );
      if (existingCariIndex >= 0) {
        updatedCariList = updatedCariList.map((c, idx) => (idx === existingCariIndex ? syncCari : c));
      } else {
        updatedCariList = [syncCari, ...updatedCariList];
      }
      cariChanged = true;

      // Şantiye Gider Senkronizasyonu
      if (tx.santiyeId || isTaseron) {
        const targetSiteId = tx.santiyeId || santiyeler[0]?.id || '';
        const syncGider: SantiyeGider = {
          id: existingGiderId!,
          santiyeId: targetSiteId,
          odeyen: `Şirket Yönetimi (${cardLabel})`,
          odemeYontemi: `Kredi Kartı (${cardObj?.kartAdi || 'Kredi Kartı'})`,
          tarih: tx.tarih || getTodayDateString(),
          kategori: isTaseron ? 'Taşeron Hakediş' : (tx.kategori || 'Şantiye Gideri'),
          aciklama: isTaseron
            ? `[Kredi Kartı ile Taşeron Ödemesi] ${matchingFirma.isim} - ${cardLabel} - ${tx.aciklama}${Number(tx.taksitSayisi) > 1 ? ` (${tx.taksitSayisi} Taksit)` : ''}`
            : `[Kredi Kartı Harcaması] ${matchingFirma.isim} - ${cardLabel} - ${tx.aciklama}`,
          odemeYapilanFirma: matchingFirma.isim,
          durum: 'Ödendi',
          taseron: isTaseron ? (matchingTas?.isim || matchingFirma.isim) : undefined,
          miktar: Number(tx.tutar),
          paraBirimi: tx.paraBirimi || 'TRY',
          kartId: tx.kartId,
          kartHarcamaId: tx.id,
          taksitSayisi: Number(tx.taksitSayisi || 1),
          cariHareketId: existingCariId,
          cariFirmaId: matchingFirma.id,
        };

        const existingGiderIndex = updatedGiderler.findIndex(
          (g) => g.id === existingGiderId || (g.kartHarcamaId && g.kartHarcamaId === tx.id)
        );
        if (existingGiderIndex >= 0) {
          updatedGiderler = updatedGiderler.map((g, idx) => (idx === existingGiderIndex ? syncGider : g));
        } else {
          updatedGiderler = [syncGider, ...updatedGiderler];
        }
        giderChanged = true;
      } else if (existingGiderId) {
        // Önceden şantiye vardı ama şimdi kaldırıldı
        updatedGiderler = updatedGiderler.filter(
          (g) => g.id !== existingGiderId && g.kartHarcamaId !== tx.id
        );
        giderChanged = true;
        existingGiderId = undefined;
      }

      transactionToSave = {
        ...transactionToSave,
        firmaId: matchingFirma.id,
        firmaAdi: matchingFirma.isim,
        cariHareketId: existingCariId,
        santiyeGiderId: existingGiderId,
        cariHesabaIsle: true,
      };
    } else if (isHarcama && tx.santiyeId && Number(tx.tutar) > 0) {
      // Sadece şantiye seçilmişse
      if (existingCariId || oldTx?.cariHareketId) {
        updatedCariList = updatedCariList.filter(
          (c) => c.id !== existingCariId && c.kartHarcamaId !== tx.id && (!oldTx?.cariHareketId || c.id !== oldTx.cariHareketId)
        );
        cariChanged = true;
        existingCariId = undefined;
      }

      if (!existingGiderId) {
        existingGiderId = `sg-kk-${nowTs}`;
      }

      const syncGider: SantiyeGider = {
        id: existingGiderId,
        santiyeId: tx.santiyeId,
        odeyen: `Şirket Yönetimi (${cardLabel})`,
        odemeYontemi: `Kredi Kartı (${cardObj?.kartAdi || 'Kredi Kartı'})`,
        tarih: tx.tarih || getTodayDateString(),
        kategori: tx.kategori || 'Şantiye Gideri',
        aciklama: `[Kredi Kartı Harcaması] ${cardLabel} - ${tx.aciklama}`,
        odemeYapilanFirma: tx.firmaAdi || undefined,
        durum: 'Ödendi',
        miktar: Number(tx.tutar),
        paraBirimi: tx.paraBirimi || 'TRY',
        kartId: tx.kartId,
        kartHarcamaId: tx.id,
        taksitSayisi: Number(tx.taksitSayisi || 1),
      };

      const existingGiderIndex = updatedGiderler.findIndex(
        (g) => g.id === existingGiderId || (g.kartHarcamaId && g.kartHarcamaId === tx.id)
      );
      if (existingGiderIndex >= 0) {
        updatedGiderler = updatedGiderler.map((g, idx) => (idx === existingGiderIndex ? syncGider : g));
      } else {
        updatedGiderler = [syncGider, ...updatedGiderler];
      }
      giderChanged = true;

      transactionToSave = {
        ...transactionToSave,
        firmaId: undefined,
        cariHareketId: undefined,
        santiyeGiderId: existingGiderId,
        cariHesabaIsle: false,
      };
    } else {
      // Firma veya Şantiye yok ya da Kart Ödemesi / İade yapıldı
      if (existingCariId || oldTx?.cariHareketId) {
        updatedCariList = updatedCariList.filter(
          (c) => c.id !== existingCariId && c.kartHarcamaId !== tx.id && (!oldTx?.cariHareketId || c.id !== oldTx.cariHareketId)
        );
        cariChanged = true;
      }
      if (existingGiderId || oldTx?.santiyeGiderId) {
        updatedGiderler = updatedGiderler.filter(
          (g) => g.id !== existingGiderId && g.kartHarcamaId !== tx.id && (!oldTx?.santiyeGiderId || g.id !== oldTx.santiyeGiderId)
        );
        giderChanged = true;
      }

      transactionToSave = {
        ...transactionToSave,
        firmaId: undefined,
        firmaAdi: undefined,
        santiyeId: undefined,
        santiyeAdi: undefined,
        cariHareketId: undefined,
        santiyeGiderId: undefined,
        cariHesabaIsle: false,
      };
    }

    if (cariChanged) {
      setCariList(updatedCariList);
      saveModuleToFirestore('cari', updatedCariList, false, setSyncStatus);
    }
    if (giderChanged) {
      setGiderler(updatedGiderler);
      saveModuleToFirestore('giderler', updatedGiderler, false, setSyncStatus);
    }

    const updatedTxs = kartHarcamalari.map((t) => (t.id === tx.id ? transactionToSave : t));
    setKartHarcamalari(updatedTxs);
    saveModuleToFirestore('kart_harcamalari', updatedTxs, false, setSyncStatus);

    showToast('Kredi kartı hareketi başarıyla güncellendi ve ilişkili kayıtlar senkronize edildi.');
  };

  const handleDeleteKartHarcama = (id: string) => {
    if (!canUserDelete) {
      showToast('Kredi kartı harcaması silme yetkiniz bulunmamaktadır. Lütfen yöneticiniz ile iletişime geçiniz.', 'error');
      return;
    }
    markItemDeleted('kart_harcamalari', id);
    const txToDelete = kartHarcamalari.find((t) => t.id === id);
    const updated = kartHarcamalari.filter((t) => t.id !== id);
    setKartHarcamalari(updated);
    saveModuleToFirestore('kart_harcamalari', updated, true, setSyncStatus);

    // 1. İlişkili Firma Cari Hareketlerini Sil
    const matchingCariIds = new Set<string>();
    if (txToDelete?.cariHareketId) matchingCariIds.add(txToDelete.cariHareketId);
    cariList.forEach((c) => {
      if (
        c.kartHarcamaId === id ||
        (txToDelete?.id && c.kartHarcamaId === txToDelete.id) ||
        (txToDelete?.santiyeGiderId && c.giderId === txToDelete.santiyeGiderId) ||
        (txToDelete?.faturaNo && c.faturaNo && c.faturaNo === txToDelete.faturaNo)
      ) {
        matchingCariIds.add(c.id);
      }
    });

    if (matchingCariIds.size > 0) {
      matchingCariIds.forEach((cId) => markItemDeleted('cari', cId));
      const updatedCari = cariList.filter((c) => !matchingCariIds.has(c.id));
      if (updatedCari.length !== cariList.length) {
        setCariList(updatedCari);
        saveModuleToFirestore('cari', updatedCari, true, setSyncStatus);
      }
    }

    // 2. İlişkili Şantiye Giderlerini Sil
    const matchingGiderIds = new Set<string>();
    if (txToDelete?.santiyeGiderId) matchingGiderIds.add(txToDelete.santiyeGiderId);
    giderler.forEach((g) => {
      if (
        (g.kartHarcamaId && g.kartHarcamaId === id) ||
        (txToDelete?.id && g.kartHarcamaId && g.kartHarcamaId === txToDelete.id) ||
        (txToDelete?.cariHareketId && g.cariHareketId && g.cariHareketId === txToDelete.cariHareketId) ||
        (g.cariHareketId && matchingCariIds.has(g.cariHareketId))
      ) {
        matchingGiderIds.add(g.id);
      }
    });

    if (matchingGiderIds.size > 0) {
      matchingGiderIds.forEach((gId) => markItemDeleted('giderler', gId));
      const updatedGiderler = giderler.filter((g) => !matchingGiderIds.has(g.id));
      if (updatedGiderler.length !== giderler.length) {
        setGiderler(updatedGiderler);
        saveModuleToFirestore('giderler', updatedGiderler, true, setSyncStatus);
      }
    }

    // 3. İlişkili Personel/Hakediş Ödemelerini Sil
    const isMatchingOdeme = (o: PersonelOdeme) => {
      if (txToDelete?.cariHareketId && o.cariHareketId && o.cariHareketId === txToDelete.cariHareketId) return true;
      if (o.cariHareketId && matchingCariIds.has(o.cariHareketId)) return true;
      if (txToDelete?.santiyeGiderId && (o as any).giderId && (o as any).giderId === txToDelete.santiyeGiderId) return true;
      if ((o as any).giderId && matchingGiderIds.has((o as any).giderId)) return true;
      return false;
    };

    const removedOdemeler = odemeList.filter(isMatchingOdeme);
    removedOdemeler.forEach((o) => markItemDeleted('odemeler', o.id));

    const updatedOdemeler = odemeList.filter((o) => !isMatchingOdeme(o));
    if (updatedOdemeler.length !== odemeList.length) {
      setOdemeList(updatedOdemeler);
      saveModuleToFirestore('odemeler', updatedOdemeler, true, setSyncStatus);
    }

    if (matchingCariIds.size > 0 || matchingGiderIds.size > 0) {
      showToast('Kredi kartı hareketi; ilişkili Firma Cari Hesabı, Şantiye Giderleri ve Hakediş bölümlerinden çift yönlü tam senkronizasyonla silindi.', 'info');
    } else {
      showToast('Kart hareketi silindi.', 'info');
    }
  };

  // Full ERP Restore Logic (Used by both Modal and File Input)
  const handleRestoreBackup = async (data: any) => {
    // Support nested container formats ({ data: ... } or { erpData: ... })
    const actual =
      data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? data.data
        : data.erpData && typeof data.erpData === 'object' && !Array.isArray(data.erpData)
        ? data.erpData
        : data;

    if (Array.isArray(actual.personnel)) setPersonnelList(actual.personnel);
    if (Array.isArray(actual.puantaj)) setPuantajList(actual.puantaj);
    if (Array.isArray(actual.mesai)) setMesaiList(actual.mesai);
    if (Array.isArray(actual.odemeler)) setOdemeList(actual.odemeler);
    if (Array.isArray(actual.santiyeler)) setSantiyeler(actual.santiyeler);
    if (Array.isArray(actual.giderler)) setGiderler(actual.giderler);
    if (Array.isArray(actual.taseronlar)) setTaseronlar(actual.taseronlar);
    if (Array.isArray(actual.firmalar)) setFirmalar(actual.firmalar);
    if (Array.isArray(actual.cari)) setCariList(actual.cari);
    if (Array.isArray(actual.cekler)) setCekler(actual.cekler);
    if (Array.isArray(actual.odeme_yontemleri)) setOdemeYontemleri(actual.odeme_yontemleri);
    if (Array.isArray(actual.gider_kategorileri)) setGiderKategorileri(actual.gider_kategorileri);
    if (Array.isArray(actual.kredi_kartlari)) setKrediKartlari(actual.kredi_kartlari);
    if (Array.isArray(actual.kart_harcamalari)) setKartHarcamalari(actual.kart_harcamalari);
    if (Array.isArray(actual.users) && actual.users.length > 0) setUsers(actual.users);

    // Synchronize all restored tables directly to Firebase Firestore
    await saveAllModulesToFirestore(actual, setSyncStatus);
    setLastSyncedAt(new Date());
  };

  // Full ERP Export & Import (15 Tables Backup + Exchange Rates)
  const handleExportBackup = () => {
    try {
      const exchangeRates = getSavedExchangeRates();
      const backupData = {
        version: '3.0',
        exportDate: new Date().toISOString(),
        appName: 'Şantiye & Personel ERP',
        exchangeRates,
        personnel: personnelList,
        puantaj: puantajList,
        mesai: mesaiList,
        odemeler: odemeList,
        santiyeler,
        giderler,
        taseronlar,
        firmalar,
        cari: cariList,
        cekler,
        odeme_yontemleri: odemeYontemleri,
        gider_kategorileri: giderKategorileri,
        kredi_kartlari: krediKartlari,
        kart_harcamalari: kartHarcamalari,
        users: users,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Santiye_ERP_Tam_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
      showToast('Tüm 15 tablo veritabanı yedeği indirildi.');
    } catch (err) {
      console.error('Backup download error:', err);
      // Fallback: Open modal so user can copy JSON or re-attempt
      handleOpenBackupModal('export');
      showToast('Yedekleme penceresi açıldı.', 'info');
    }
  };

  const handleForceSync = async () => {
    try {
      showToast('Tüm ERP verileri Firestore bulutuna eşitleniyor...', 'info');
      await saveAllModulesToFirestore(
        {
          personnel: personnelList,
          puantaj: puantajList,
          mesai: mesaiList,
          odemeler: odemeList,
          santiyeler,
          giderler,
          taseronlar,
          firmalar,
          cari: cariList,
          cekler,
          odeme_yontemleri: odemeYontemleri,
          gider_kategorileri: giderKategorileri,
          kredi_kartlari: krediKartlari,
          kart_harcamalari: kartHarcamalari,
          users,
        },
        setSyncStatus
      );
      setLastSyncedAt(new Date());
      showToast('Tüm veriler bulut veritabanında başarıyla güncellendi (Canlı).');
    } catch (err) {
      showToast('Bulut eşitleme sırasında hata oluştu.', 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await handleRestoreBackup(data);
        showToast('Veritabanı yedeği yüklendi ve tüm cihazlar için buluta kaydedildi!');
      } catch (err: any) {
        console.error(err);
        showToast('Yedek dosyası okunamadı veya format geçersiz.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAllData = async (mode: 'empty' | 'demo') => {
    try {
      if (mode === 'empty') {
        setPersonnelList([]);
        setPuantajList([]);
        setMesaiList([]);
        setOdemeList([]);
        setSantiyeler([]);
        setGiderler([]);
        setTaseronlar([]);
        setFirmalar([]);
        setCariList([]);
        setCekler([]);
        setKrediKartlari([]);
        setKartHarcamalari([]);
        setOdemeYontemleri(INITIAL_ODEME_YONTEMLERI);
        setGiderKategorileri(DEFAULT_SANTIYE_GIDER_KATEGORILERI);
        setUsers(INITIAL_USERS);
        clearAllStoredData();
        await resetAllModules('empty', setSyncStatus);
        showToast('Tüm sistem verileri başarıyla sıfırlandı (0 kayıt).', 'success');
      } else {
        setPersonnelList(INITIAL_PERSONNEL);
        setPuantajList(INITIAL_PUANTAJ);
        setMesaiList(INITIAL_MESAI);
        setOdemeList(INITIAL_PERSONEL_ODEMELERI);
        setSantiyeler(INITIAL_SANTIYELER);
        setGiderler(INITIAL_SANTIYE_GIDERLERI);
        setTaseronlar(INITIAL_TASERONLAR);
        setFirmalar(INITIAL_FIRMALAR);
        setCariList(INITIAL_FIRMA_CARI);
        setCekler(INITIAL_CEKLER);
        setKrediKartlari(INITIAL_KREDI_KARTLARI);
        setKartHarcamalari(INITIAL_KART_HARCAMALARI);
        setOdemeYontemleri(INITIAL_ODEME_YONTEMLERI);
        setGiderKategorileri(DEFAULT_SANTIYE_GIDER_KATEGORILERI);
        setUsers(INITIAL_USERS);
        await resetAllModules('demo', setSyncStatus);
        showToast('Örnek (demo) veriler başarıyla yüklendi.', 'info');
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Reset error:', err);
      showToast('Sıfırlama işlemi sırasında hata oluştu.', 'error');
    }
  };

  // User Auth & Permission Handlers
  const handleLogin = (user: AppUser, rememberMe: boolean) => {
    const now = new Date();
    const normalized = normalizeUser(user);
    const updatedUser: AppUser = {
      ...normalized,
      sonGirisTarihi: `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
    };
    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);

    const updatedUsers = users.map((u) => (u.id === user.id ? updatedUser : u));
    setUsers(updatedUsers);
    saveModuleToFirestore('users', updatedUsers, true, setSyncStatus);

    // Navigate to user's first allowed view
    const perms = updatedUser.permissions;
    if (perms.canViewDashboard) setActiveTab('dashboard');
    else if (perms.canManageAttendance) setActiveTab('attendance');
    else if (perms.canManageSites) setActiveTab('sites');
    else if (perms.canManagePersonnel) setActiveTab('personnel');
    else if (perms.canManagePayroll) setActiveTab('payroll');
    else if (perms.canViewReports) setActiveTab('reports');
    else if (perms.canManageCompanies) setActiveTab('companies');
    else if (perms.canManageSubcontractors) setActiveTab('subcontractors');
    else if (perms.canManageChecks) setActiveTab('checks');
    else if (perms.canManageCreditCards) setActiveTab('credit_cards');

    const roleName =
      updatedUser.role === 'admin'
        ? 'Yönetici'
        : updatedUser.role === 'muhasebe'
        ? 'Ön Muhasebe / Finans'
        : updatedUser.role === 'puantor'
        ? 'Saha Puantörü'
        : updatedUser.role === 'taseron_yetkilisi'
        ? 'Taşeron Yetkilisi'
        : updatedUser.role === 'saha_sorumlusu'
        ? 'Saha Sorumlusu'
        : 'Özel Yetkili';

    showToast(`Hoş geldiniz, ${updatedUser.fullName}! (${roleName})`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserSession(null);
    showToast('Güvenli çıkış yapıldı.', 'info');
  };

  const handleAddUser = (newUser: AppUser) => {
    const normalized = normalizeUser(newUser);
    const updated = [...users, normalized];
    setUsers(updated);
    setStoredData('users', updated);
    saveModuleToFirestore('users', updated, true, setSyncStatus);
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    const normalized = normalizeUser(updatedUser);
    const updated = users.map((u) => (u.id === normalized.id ? normalized : u));
    setUsers(updated);
    setStoredData('users', updated);
    if (currentUser && currentUser.id === normalized.id) {
      setCurrentUser(normalized);
      setCurrentUserSession(normalized);
    }
    saveModuleToFirestore('users', updated, true, setSyncStatus);
  };

  const handleDeleteUser = (userId: string) => {
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    setStoredData('users', updated);
    saveModuleToFirestore('users', updated, true, setSyncStatus);
  };

  const handleSwitchUser = (targetUser: AppUser) => {
    if (targetUser.durum === 'Pasif') {
      showToast('Pasif kullanıcı hesabına geçiş yapılamaz!', 'error');
      return;
    }
    const freshUser = users.find((u) => u.id === targetUser.id) || targetUser;
    const normalized = normalizeUser(freshUser);
    setCurrentUser(normalized);
    setCurrentUserSession(normalized);

    const perms = normalized.permissions;
    const isCurrentTabAllowed =
      (activeTab === 'dashboard' && perms.canViewDashboard) ||
      (activeTab === 'personnel' && perms.canManagePersonnel) ||
      (activeTab === 'attendance' && perms.canManageAttendance) ||
      (activeTab === 'payroll' && perms.canManagePayroll) ||
      (activeTab === 'sites' && perms.canManageSites) ||
      (activeTab === 'credit_cards' && perms.canManageCreditCards) ||
      (activeTab === 'subcontractors' && perms.canManageSubcontractors) ||
      (activeTab === 'companies' && perms.canManageCompanies) ||
      (activeTab === 'checks' && perms.canManageChecks) ||
      (activeTab === 'reports' && perms.canViewReports) ||
      (activeTab === 'users' && perms.canManageUsers);

    if (!isCurrentTabAllowed) {
      if (perms.canViewDashboard) setActiveTab('dashboard');
      else if (perms.canManageAttendance) setActiveTab('attendance');
      else if (perms.canManageSites) setActiveTab('sites');
      else if (perms.canManagePersonnel) setActiveTab('personnel');
      else if (perms.canManagePayroll) setActiveTab('payroll');
      else if (perms.canViewReports) setActiveTab('reports');
      else if (perms.canManageCompanies) setActiveTab('companies');
      else if (perms.canManageSubcontractors) setActiveTab('subcontractors');
      else if (perms.canManageChecks) setActiveTab('checks');
      else if (perms.canManageCreditCards) setActiveTab('credit_cards');
    }

    const roleName =
      normalized.role === 'admin'
        ? 'Yönetici'
        : normalized.role === 'muhasebe'
        ? 'Ön Muhasebe / Finans'
        : normalized.role === 'puantor'
        ? 'Saha Puantörü'
        : normalized.role === 'taseron_yetkilisi'
        ? 'Taşeron Yetkilisi'
        : normalized.role === 'saha_sorumlusu'
        ? 'Saha Sorumlusu'
        : 'Özel Yetkili';

    showToast(`"${normalized.fullName}" (@${normalized.username} - ${roleName}) hesabına geçiş yapıldı. Tüm izinler ve kısıtlar uygulandı.`, 'info');
  };

  // Enforce tab access permissions for currentUser
  useEffect(() => {
    if (!currentUser) return;
    const perms = currentUser.permissions;
    const isAllowed =
      (activeTab === 'dashboard' && perms.canViewDashboard) ||
      (activeTab === 'personnel' && perms.canManagePersonnel) ||
      (activeTab === 'attendance' && perms.canManageAttendance) ||
      (activeTab === 'payroll' && perms.canManagePayroll) ||
      (activeTab === 'sites' && perms.canManageSites) ||
      (activeTab === 'credit_cards' && perms.canManageCreditCards) ||
      (activeTab === 'subcontractors' && perms.canManageSubcontractors) ||
      (activeTab === 'companies' && perms.canManageCompanies) ||
      (activeTab === 'checks' && perms.canManageChecks) ||
      (activeTab === 'reports' && perms.canViewReports) ||
      (activeTab === 'users' && perms.canManageUsers);

    if (!isAllowed) {
      if (perms.canViewDashboard) setActiveTab('dashboard');
      else if (perms.canManageAttendance) setActiveTab('attendance');
      else if (perms.canManageSites) setActiveTab('sites');
      else if (perms.canManagePersonnel) setActiveTab('personnel');
      else if (perms.canManagePayroll) setActiveTab('payroll');
      else if (perms.canViewReports) setActiveTab('reports');
      else if (perms.canManageCompanies) setActiveTab('companies');
      else if (perms.canManageSubcontractors) setActiveTab('subcontractors');
      else if (perms.canManageChecks) setActiveTab('checks');
      else if (perms.canManageCreditCards) setActiveTab('credit_cards');
    }
  }, [currentUser, activeTab]);

  // Loading screen on initial visit while fetching live Firestore data
  if (isCloudConnecting && !isInitialLoadDone.current) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/20 font-black text-xl">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Şantiye ve Personel ERP</h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Bulut veritabanına bağlanılıyor ve güncel veriler senkronize ediliyor...
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-800/90 border border-slate-700/90 text-xs font-medium text-amber-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Bulut Canlı Senkronizasyon (Firestore)</span>
          </div>
        </div>
      </div>
    );
  }

  // Authentication Guard: Render LoginScreen if not logged in
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col selection:bg-amber-200">
      {/* Hidden File Input for Backup Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportBackup}
        accept=".json"
        className="hidden"
      />

      {/* Main Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        payrollSubTab={payrollSubTab}
        onSelectPayrollSubTab={setPayrollSubTab}
        taseronCount={taseronlar.length}
        odemelerCount={odemeList.length}
        onOpenAddPersonnel={() => {
          setEditingPersonnel(null);
          setIsPersonnelModalOpen(true);
        }}
        personnelCount={personnelList.length}
        activeSitesCount={santiyeler.filter((s) => s.durum === 'Aktif').length}
        onExportBackup={() => handleOpenBackupModal('export')}
        onImportBackup={() => handleOpenBackupModal('import')}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onForceSync={handleForceSync}
        onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Info className="w-4 h-4 text-amber-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Content Area - Full Width for large tables */}
      <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
        {/* TAB 0: DASHBOARD / GENEL SİSTEM ÖZETİ */}
        {activeTab === 'dashboard' && (
          <DashboardView
            summaryData={summaryData}
            currentMonthStr={activeDashboardMonth}
            availableMonths={availableMonths}
            onChangeMonth={setSelectedDashboardMonth}
            setActiveTab={setActiveTab}
            onNavigateToPayrollSubTab={(subTab) => {
              setPayrollSubTab(subTab);
              setActiveTab('payroll');
            }}
            santiyeler={santiyeler}
            personnelList={personnelList}
            puantajList={puantajList}
            mesaiList={mesaiList}
            odemeList={odemeList}
            giderler={giderler}
            krediKartlari={krediKartlari}
            kartHarcamalari={kartHarcamalari}
            firmalar={firmalar}
            cariList={cariList}
            cekler={cekler}
            taseronlar={taseronlar}
            onOpenAddPersonnel={() => {
              setEditingPersonnel(null);
              setIsPersonnelModalOpen(true);
            }}
          />
        )}

        {/* TAB 1: PERSONEL YÖNETİMİ */}
        {activeTab === 'personnel' && (
          <PersonnelList
            personnelList={personnelList}
            santiyeler={santiyeler}
            taseronlar={taseronlar}
            allowedSantiyeIds={currentUser.assignedSantiyeIds}
            allowedTaseronIds={currentUser.assignedTaseronIds}
            canEdit={canUserEdit}
            canDelete={canUserDelete}
            onEdit={(p) => {
              if (!canUserEdit) {
                showToast('Personel kartlarını düzenleme yetkiniz bulunmamaktadır.', 'error');
                return;
              }
              setEditingPersonnel(p);
              setIsPersonnelModalOpen(true);
            }}
            onDelete={(id) => {
              if (!canUserDelete) {
                showToast('Personel silme yetkiniz bulunmamaktadır.', 'error');
                return;
              }
              const person = personnelList.find((p) => p.id === id);
              setDeleteModalState({
                isOpen: true,
                id,
                name: person ? `${person.isim} ${person.soyisim}` : 'Personel',
                type: 'personnel',
              });
            }}
            onAddNew={() => {
              setEditingPersonnel(null);
              setIsPersonnelModalOpen(true);
            }}
          />
        )}

        {/* TAB 2: PUANTAJ VE MESAİ YÖNETİMİ */}
        {activeTab === 'attendance' && (
          <AttendanceManager
            personnelList={personnelList}
            puantajList={puantajList}
            mesaiList={mesaiList}
            santiyeler={santiyeler}
            onUpdatePuantaj={handleUpdatePuantaj}
            onSetAllDaily={handleSetAllDaily}
            onClearDaily={handleClearDaily}
            onClearMonth={handleClearMonthPuantaj}
            onFillSalariedMonth={handleFillSalariedMonth}
            onFillSalariedDaily={handleFillSalariedDaily}
            onAddMesai={handleAddMesai}
            onUpdateMesai={handleUpdateMesai}
            onAddBulkMesai={handleAddBulkMesai}
            onDeleteMesai={handleDeleteMesai}
            canManagePayroll={currentUser.permissions.canManagePayroll}
            allowedSantiyeIds={currentUser.assignedSantiyeIds}
            allowedTaseronIds={currentUser.assignedTaseronIds}
          />
        )}

        {/* TAB 3: HAKEDİŞ VE ÖDEMELER */}
        {activeTab === 'payroll' && (
          <PersonnelPayroll
            personnelList={personnelList}
            puantajList={puantajList}
            mesaiList={mesaiList}
            odemeList={odemeList}
            odemeYontemleri={odemeYontemleri}
            taseronlar={taseronlar}
            firmalar={firmalar}
            cariList={cariList}
            santiyeler={santiyeler}
            giderler={giderler}
            activeSubTab={payrollSubTab}
            onChangeSubTab={setPayrollSubTab}
            onUpdatePersonnel={handleSavePersonnel}
            onAddOdeme={handleAddOdeme}
            onAddBulkOdeme={handleAddBulkOdeme}
            onUpdateOdeme={handleUpdateOdeme}
            onDeleteOdeme={handleDeleteOdeme}
            onAddGider={handleAddGider}
            onUpdateGider={handleUpdateGider}
            onDeleteGider={handleDeleteGider}
            onDeleteCariHareket={handleDeleteCariHareket}
            cekler={cekler}
            onAddCek={handleAddCek}
            onDeleteCek={handleDeleteCek}
            onNavigateToCompanies={(firmaId) => {
              setSelectedCompanyId(firmaId || null);
              setActiveTab('companies');
            }}
          />
        )}

        {/* TAB 4: ŞANTİYELER */}
        {activeTab === 'sites' && (
          <SitesManagement
            santiyeler={santiyeler}
            giderler={giderler}
            cariList={cariList}
            cekler={cekler}
            personnelList={personnelList}
            odemeList={odemeList}
            taseronlar={taseronlar}
            firmalar={firmalar}
            odemeYontemleri={odemeYontemleri}
            kategoriler={giderKategorileri}
            krediKartlari={krediKartlari}
            kartHarcamalari={kartHarcamalari}
            onAddKategori={handleAddKategori}
            onDeleteKategori={handleDeleteKategori}
            defaultSubTab="sites"
            onAddSantiye={handleAddSantiye}
            onUpdateSantiye={handleUpdateSantiye}
            onDeleteSantiye={(id) => {
              const s = santiyeler.find((site) => site.id === id);
              setDeleteModalState({
                isOpen: true,
                id,
                name: s ? s.isim : 'Şantiye',
                type: 'santiye',
              });
            }}
            onAddGider={handleAddGider}
            onUpdateGider={handleUpdateGider}
            onDeleteGider={handleDeleteGider}
            onAddFirma={handleAddFirma}
            onDeleteCariHareket={handleDeleteCariHareket}
            onDeleteOdeme={handleDeleteOdeme}
            onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
            allowedSantiyeIds={currentUser.assignedSantiyeIds}
            onlyExpenseMode={!currentUser.permissions.canManagePayroll && currentUser.permissions.canManageSites}
            canEdit={canUserEdit}
            canDelete={canUserDelete}
          />
        )}

        {/* TAB 5: KREDİ KARTLARI */}
        {activeTab === 'subcontractors' && (
          <SubcontractorsManagement
            taseronlar={taseronlar}
            personnelList={personnelList}
            firmalar={firmalar}
            cariList={cariList}
            onAddTaseron={handleAddTaseron}
            onUpdateTaseron={handleUpdateTaseron}
            onDeleteTaseron={(id) => {
              const t = taseronlar.find((tas) => tas.id === id);
              setDeleteModalState({
                isOpen: true,
                id,
                name: t ? t.isim : 'Taşeron',
                type: 'taseron',
              });
            }}
            onNavigateToCompanies={(firmaId) => {
              setSelectedCompanyId(firmaId || null);
              setActiveTab('companies');
            }}
          />
        )}

        {/* TAB 7: FİRMALAR VE CARİ HESAPLAR */}
        {activeTab === 'companies' && (
          <CompaniesAndLedger
            firmalar={firmalar}
            cariList={cariList}
            santiyeler={santiyeler}
            initialFirmaId={selectedCompanyId || undefined}
            onAddFirma={handleAddFirma}
            onUpdateFirma={handleUpdateFirma}
            onDeleteFirma={(id) => {
              const f = firmalar.find((firm) => firm.id === id);
              setDeleteModalState({
                isOpen: true,
                id,
                name: f ? f.isim : 'Firma',
                type: 'firma',
              });
            }}
            onAddCariHareket={handleAddCariHareket}
            onUpdateCariHareket={handleUpdateCariHareket}
            onDeleteCariHareket={handleDeleteCariHareket}
            onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
            onBatchImportFirmaAndCari={handleBatchImportFirmaAndCari}
          />
        )}

        {/* TAB 8: ÇEK TAKİBİ */}
        {activeTab === 'checks' && (
          <ChecksManagement
            cekler={cekler}
            santiyeler={santiyeler}
            firmalar={firmalar}
            cariList={cariList}
            onAddCek={handleAddCek}
            onUpdateCek={handleUpdateCek}
            onUpdateStatus={handleUpdateCekStatus}
            onCiroCek={handleCiroCek}
            onCancelCiroCek={handleCancelCiroCek}
            onDeleteCek={handleDeleteCek}
            onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
          />
        )}

        {/* TAB 9: KREDİ KARTLARI VE EKSTRE TAKİBİ */}
        {activeTab === 'credit_cards' && (
          <CreditCardsManagement
            cards={krediKartlari}
            transactions={kartHarcamalari}
            santiyeler={santiyeler}
            firmalar={firmalar}
            taseronlar={taseronlar}
            cariList={cariList}
            giderler={giderler}
            kategoriler={giderKategorileri}
            onAddKategori={handleAddKategori}
            onDeleteKategori={handleDeleteKategori}
            onAddFirma={handleAddFirma}
            onAddCard={handleAddKrediKarti}
            onUpdateCard={handleUpdateKrediKarti}
            onDeleteCard={handleDeleteKrediKarti}
            onAddTransaction={handleAddKartHarcama}
            onUpdateTransaction={handleUpdateKartHarcama}
            onDeleteTransaction={handleDeleteKartHarcama}
            showToast={showToast}
            onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
          />
        )}

        {/* TAB 10: FİNANSAL & OPERASYONEL RAPORLAR */}
        {activeTab === 'reports' && (
          <ReportsCenter
            personnelList={personnelList}
            puantajList={puantajList}
            mesaiList={mesaiList}
            odemeList={odemeList}
            santiyeler={santiyeler}
            giderler={giderler}
            taseronlar={taseronlar}
            firmalar={firmalar}
            cariList={cariList}
            cekler={cekler}
            kartHarcamalari={kartHarcamalari}
            defaultMonthStr={activeDashboardMonth}
            onOpenCurrencies={() => setIsCurrenciesModalOpen(true)}
          />
        )}

        {/* TAB 11: KULLANICI VE İZİN YÖNETİMİ (RBAC) */}
        {activeTab === 'users' && currentUser.permissions.canManageUsers && (
          <UserManagement
            users={users}
            santiyeler={santiyeler}
            taseronlar={taseronlar}
            currentUser={currentUser}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            showToast={showToast}
            onSwitchUser={handleSwitchUser}
          />
        )}
      </main>

      {/* Modals */}
      <PersonnelModal
        isOpen={isPersonnelModalOpen}
        onClose={() => {
          setIsPersonnelModalOpen(false);
          setEditingPersonnel(null);
        }}
        onSave={handleSavePersonnel}
        initialData={editingPersonnel}
        santiyeler={santiyeler}
        taseronlar={taseronlar}
        existingPersonnelList={personnelList}
      />

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        onConfirm={handleConfirmDelete}
        personName={deleteModalState.name}
      />

      <CurrenciesModal
        isOpen={isCurrenciesModalOpen}
        onClose={() => setIsCurrenciesModalOpen(false)}
        onRatesUpdated={() => setCurrencyVersion((v) => v + 1)}
      />

      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetAllData={handleResetAllData}
        onExportBackup={handleExportBackup}
        counts={{
          personnel: personnelList.length,
          santiyeler: santiyeler.length,
          giderler: giderler.length,
          cekler: cekler.length,
          firmalar: firmalar.length,
          cari: cariList.length,
          kartHarcamalari: kartHarcamalari.length,
        }}
      />

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        initialTab={backupModalTab}
        currentData={{
          personnel: personnelList,
          puantaj: puantajList,
          mesai: mesaiList,
          odemeler: odemeList,
          santiyeler,
          giderler,
          taseronlar,
          firmalar,
          cari: cariList,
          cekler,
          odeme_yontemleri: odemeYontemleri,
          gider_kategorileri: giderKategorileri,
          kredi_kartlari: krediKartlari,
          kart_harcamalari: kartHarcamalari,
          users,
        }}
        onRestore={handleRestoreBackup}
        showToast={showToast}
      />
    </div>
  );
}

export default App;
