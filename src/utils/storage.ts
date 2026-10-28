import {
  Personnel,
  Puantaj,
  Mesai,
  PersonelHakedis,
  PersonelOdeme,
  Taseron,
  Santiye,
  SantiyeGider,
  OdemeYontemi,
  Firma,
  FirmaCari,
  Cek,
  KrediKarti,
  KrediKartiHarcama,
  AppUser,
  UserRole,
  UserPermissions,
} from '../types';

// Storage Keys
const STORAGE_PREFIX = 'santiye_erp_v3_';
export const CURRENT_USER_STORAGE_KEY = 'santiye_erp_current_user_v3';

// ==========================================
// ROL VE İZİN ŞABLONLARI
// ==========================================
export const ROLE_PRESET_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canViewDashboard: true,
    canManagePersonnel: true,
    canManageAttendance: true,
    canManagePayroll: true,
    canManageSites: true,
    canManageCreditCards: true,
    canManageSubcontractors: true,
    canManageCompanies: true,
    canManageChecks: true,
    canViewReports: true,
    canManageUsers: true,
    canManageSettings: true,
    canEdit: true,
    canDelete: true,
  },
  saha_sorumlusu: {
    canViewDashboard: false,
    canManagePersonnel: false,
    canManageAttendance: true, // Sadece personel puantaj ve mesai girişi
    canManagePayroll: false,    // Maaş, hakediş ve bordro gizli
    canManageSites: true,      // Şantiye masraf girişi serbest
    canManageCreditCards: false,
    canManageSubcontractors: false,
    canManageCompanies: false,
    canManageChecks: false,
    canViewReports: false,
    canManageUsers: false,
    canManageSettings: false,
    canEdit: true,             // Veri düzenleme serbest
    canDelete: false,          // Silme varsayılan olarak kapalı (yönetici izin verirse açılır)
  },
  puantor: {
    canViewDashboard: false,
    canManagePersonnel: false,
    canManageAttendance: true, // Sadece puantaj girişi
    canManagePayroll: false,
    canManageSites: false,
    canManageCreditCards: false,
    canManageSubcontractors: false,
    canManageCompanies: false,
    canManageChecks: false,
    canViewReports: false,
    canManageUsers: false,
    canManageSettings: false,
    canEdit: true,
    canDelete: false,
  },
  taseron_yetkilisi: {
    canViewDashboard: false,
    canManagePersonnel: true, // Kendi taşeronunun personellerini görüntüleyebilir / ekleyebilir
    canManageAttendance: true, // Kendi taşeronunun puantajını girebilir
    canManagePayroll: false, // Hassas şirket bordroları kapalı
    canManageSites: false,
    canManageCreditCards: false,
    canManageSubcontractors: false,
    canManageCompanies: false,
    canManageChecks: false,
    canViewReports: false,
    canManageUsers: false,
    canManageSettings: false,
    canEdit: true,
    canDelete: false,
  },
  muhasebe: {
    canViewDashboard: true,
    canManagePersonnel: true,
    canManageAttendance: true,
    canManagePayroll: true,
    canManageSites: true,
    canManageCreditCards: true,
    canManageSubcontractors: true,
    canManageCompanies: true,
    canManageChecks: true,
    canViewReports: true,
    canManageUsers: false,
    canManageSettings: false,
    canEdit: true,
    canDelete: false, // Muhasebe personeli için silme yetkisi varsayılan kapalı, yönetici açabilir
  },
  custom: {
    canViewDashboard: false,
    canManagePersonnel: false,
    canManageAttendance: true,
    canManagePayroll: false,
    canManageSites: true,
    canManageCreditCards: false,
    canManageSubcontractors: false,
    canManageCompanies: false,
    canManageChecks: false,
    canViewReports: false,
    canManageUsers: false,
    canManageSettings: false,
    canEdit: true,
    canDelete: false,
  },
};

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-admin',
    username: 'admin',
    password: '123',
    fullName: 'Sistem Yöneticisi',
    role: 'admin',
    unvan: 'Genel Yönetici / Şirket Müdürü',
    telefon: '0532 100 20 30',
    durum: 'Aktif',
    permissions: ROLE_PRESET_PERMISSIONS.admin,
    assignedSantiyeIds: [],
    assignedTaseronIds: [],
    sonGirisTarihi: '2025-02-15 09:30',
    createdAt: '2025-01-01',
  },
  {
    id: 'user-saha',
    username: 'saha',
    password: '123',
    fullName: 'Saha Şefi',
    role: 'saha_sorumlusu',
    unvan: 'Saha Sorumlusu / Şantiye Şefi',
    telefon: '0544 555 66 77',
    durum: 'Aktif',
    permissions: ROLE_PRESET_PERMISSIONS.saha_sorumlusu,
    assignedSantiyeIds: [],
    assignedTaseronIds: [],
    sonGirisTarihi: '2025-02-14 17:45',
    createdAt: '2025-01-10',
  },
  {
    id: 'user-puantor',
    username: 'puantor',
    password: '123',
    fullName: 'Puantör',
    role: 'puantor',
    unvan: 'Saha Puantörü',
    telefon: '0555 123 45 67',
    durum: 'Aktif',
    permissions: ROLE_PRESET_PERMISSIONS.puantor,
    assignedSantiyeIds: [],
    assignedTaseronIds: [],
    sonGirisTarihi: '2025-02-13 18:20',
    createdAt: '2025-01-15',
  },
  {
    id: 'user-taseron',
    username: 'taseron',
    password: '123',
    fullName: 'Taşeron Yetkilisi',
    role: 'taseron_yetkilisi',
    unvan: 'Ahşap İşleri',
    telefon: '0533 777 88 99',
    durum: 'Aktif',
    permissions: ROLE_PRESET_PERMISSIONS.taseron_yetkilisi,
    assignedSantiyeIds: [],
    assignedTaseronIds: [],
    sonGirisTarihi: '2025-02-14 10:15',
    createdAt: '2025-02-01',
  },
];

export const normalizeUser = (user: AppUser): AppUser => {
  if (!user) return user;
  const role = user.role || 'custom';
  const defaults = ROLE_PRESET_PERMISSIONS[role] || ROLE_PRESET_PERMISSIONS.custom;
  return {
    ...user,
    role,
    durum: user.durum || 'Aktif',
    permissions: {
      ...defaults,
      ...(user.permissions || {}),
      canEdit: user.permissions?.canEdit !== undefined ? user.permissions.canEdit : defaults.canEdit,
      canDelete: user.permissions?.canDelete !== undefined ? user.permissions.canDelete : defaults.canDelete,
    },
    assignedSantiyeIds: Array.isArray(user.assignedSantiyeIds) ? [...user.assignedSantiyeIds] : [],
    assignedTaseronIds: Array.isArray(user.assignedTaseronIds) ? [...user.assignedTaseronIds] : [],
  };
};

export const getCurrentUserSession = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id) {
        // Fetch up-to-date users list from application storage
        const usersList = getStoredData<AppUser[] | null>('users', null);
        if (Array.isArray(usersList) && usersList.length > 0) {
          const matched = usersList.find(
            (u: AppUser) => u.id === parsed.id || u.username.toLowerCase() === parsed.username?.toLowerCase()
          );
          if (matched) {
            // If user was deactivated, invalidate session
            if (matched.durum === 'Pasif') {
              localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
              return null;
            }
            const normalized = normalizeUser(matched);
            localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(normalized));
            return normalized;
          }
        }
        return normalizeUser(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to get current user session:', e);
  }
  return null;
};

export const setCurrentUserSession = (user: AppUser | null): void => {
  try {
    if (user) {
      const normalized = normalizeUser(user);
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(normalized));
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save current user session:', e);
  }
};

export const DEFAULT_SANTIYE_GIDER_KATEGORILERI: string[] = [
  'Malzeme',
  'Yemek & Mutfak',
  'Akaryakıt & Jeneratör',
  'İş Güvenliği & Hırdavat',
  'Taşeron Hakediş',
  'Nakliye & Vinç',
  'Konaklama & Barınma',
  'Elektrik, Su & Abonelik',
  'Hafriyat & Dolgu',
  'Diğer',
];

export const DEFAULT_HAKEDIS_TURLERI: string[] = [
  'Metraj Hakedişi (Ahşap işleri)',
  'Sözleşme Ara Hakedişi',
  'Ekstra İmalat / İşçilik Bedeli',
  'Taşeron Prim & İkramiye',
  'Sıva, Boya & İnce İşçilik Hakedişi',
  'Tesisat, Mekanik & Elektrik Hakedişi',
  'Hafriyat, Kazı & Dolgu Hakedişi',
  'Çelik Konstrüksiyon Hakedişi',
  'Diğer Taşeron Hakedişi',
];

export const getSavedHakedisTurleri = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'hakedis_turleri');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load hakedis_turleri:', e);
  }
  return DEFAULT_HAKEDIS_TURLERI;
};

export const saveHakedisTurleri = (list: string[]): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + 'hakedis_turleri', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save hakedis_turleri:', e);
  }
};

export const INITIAL_SANTIYELER: Santiye[] = [
  {
    id: 's-1',
    isim: 'Merkez Plaza Kule Projesi',
    yetkiliFirma: 'Zirve Yapı İnşaat A.Ş.',
    taseron: 'Öz Kalıp İnşaat',
    baslangicTarihi: '2025-01-15',
    bitisTarihi: '2025-12-30',
    durum: 'Aktif',
    ulke: 'Türkiye',
    il: 'İstanbul',
    ilce: 'Ataşehir',
    adres: 'Barbaros Mah. Dereboyu Cad. No:14',
    aciklama: '32 Katlı konut ve ticari ofis kulesi inşaatı',
  },
  {
    id: 's-2',
    isim: 'Vadi Panorama Konutları',
    yetkiliFirma: 'Anadolu Mimarlık San. Tic.',
    taseron: 'Kaya Demir Ltd. Şti.',
    baslangicTarihi: '2025-02-01',
    bitisTarihi: '2026-06-15',
    durum: 'Aktif',
    ulke: 'Türkiye',
    il: 'Ankara',
    ilce: 'Çankaya',
    adres: 'Beytepe Mah. İncek Yolu 4. Km',
    aciklama: '120 Dairelik lüks konut etabı',
  },
  {
    id: 's-3',
    isim: 'Ege Marina Butik Villaları',
    yetkiliFirma: 'Ege Yapı Yatırım Ltd.',
    taseron: 'Yıldız Elektrik & Tesisat',
    baslangicTarihi: '2024-10-10',
    bitisTarihi: '2025-09-20',
    durum: 'Aktif',
    ulke: 'Türkiye',
    il: 'Muğla',
    ilce: 'Bodrum',
    adres: 'Yalıkavak Mah. Marina Mevkii No:8',
    aciklama: '18 Adet müstakil taş villa inşaatı',
  },
];

export const INITIAL_TASERONLAR: Taseron[] = [
  {
    id: 'tas-1',
    isim: 'Öz Kalıp & Beton İşleri',
    yetkili: 'Hüseyin Öz',
    telefon: '0533 111 22 33',
    uzmanlik: 'Kalıp, İskele ve Betonarme',
    durum: 'Aktif',
    bakiye: 185000,
  },
  {
    id: 'tas-2',
    isim: 'Kaya Demir Ltd. Şti.',
    yetkili: 'Kemal Kaya',
    telefon: '0542 444 55 66',
    uzmanlik: 'Demir Bağlama ve Kaynak İşleri',
    durum: 'Aktif',
    bakiye: 92000,
  },
  {
    id: 'tas-3',
    isim: 'Yıldız Elektrik & Otomasyon',
    yetkili: 'Murat Yıldız',
    telefon: '0555 777 88 99',
    uzmanlik: 'Kuvvetli/Zayıf Akım ve Pano Montajı',
    durum: 'Aktif',
    bakiye: 45000,
  },
];

export const INITIAL_ODEME_YONTEMLERI: OdemeYontemi[] = [
  { id: 'oy-1', isim: 'Nakit Şantiye Kasası' },
  { id: 'oy-2', isim: 'Banka Transferi (Havale / EFT)' },
  { id: 'oy-3', isim: 'Firma Kredi Kartı' },
  { id: 'oy-4', isim: 'Müşteri Çeki' },
  { id: 'oy-5', isim: 'Kendi Çekimiz' },
];

export const INITIAL_FIRMALAR: Firma[] = [
  {
    id: 'f-1',
    isim: 'Çimsa Hazır Beton San. Tic. A.Ş.',
    tur: 'tedarikci',
    vergiNo: '2600192837',
    adres: 'Kartal Sanayi Bölgesi No:42 İstanbul',
    ilgili: 'Mehmet Bey (Satış Müdürü)',
    telefon: '0216 455 10 20',
    email: 'siparis@cimsa.com.tr',
  },
  {
    id: 'f-2',
    isim: 'Kroman Çelik Sanayi A.Ş.',
    tur: 'tedarikci',
    vergiNo: '5810293847',
    adres: 'Dilovası Organize Sanayi Bölgesi Kocaeli',
    ilgili: 'Serdar Kaya',
    telefon: '0262 670 12 00',
    email: 'muhasebe@kromancelik.com',
  },
  {
    id: 'f-3',
    isim: 'Tekzen Şantiye ve Yapı Market Ltd.',
    tur: 'tedarikci',
    vergiNo: '8401928374',
    adres: 'Ataşehir Ticaret Merkezi No:108 İstanbul',
    ilgili: 'Ayşe Hanım',
    telefon: '0216 380 90 00',
    email: 'kurumsal@tekzen.com.tr',
  },
  {
    id: 'f-4',
    isim: 'YILDIRIMLAR BİLGİSAYAR',
    tur: 'tedarikci',
    vergiNo: '9920194821',
    adres: 'Kadıköy Bilişim Merkezi No:14 İstanbul',
    ilgili: 'Ahmet Yıldırım',
    telefon: '0216 418 20 30',
    email: 'bilgi@yildirimbilgisayar.com',
  },
  {
    id: 'f-5',
    isim: 'Gülmete Turizm İnş.',
    tur: 'musteri',
    vergiNo: '4120938491',
    adres: 'Alsancak Bulvarı No:45 İzmir',
    ilgili: 'Murat Gülmete',
    telefon: '0232 464 10 20',
    email: 'muhasebe@gulmeteturizm.com',
  },
];

export const INITIAL_FIRMA_CARI: FirmaCari[] = [
  {
    id: 'fc-1',
    firmaId: 'f-1',
    borc: 145000,
    alacak: 0,
    tarih: '2025-02-04',
    saat: '11:30',
    faturaNo: 'CIM2025000184',
    aciklama: 'C35 Hazır Beton 120 m3 Dökümü - Merkez Plaza',
  },
  {
    id: 'fc-2',
    firmaId: 'f-1',
    borc: 0,
    alacak: 100000,
    tarih: '2025-02-06',
    saat: '16:00',
    faturaNo: 'DEKONT-8849',
    aciklama: 'Hazır beton avans havalesi',
  },
  {
    id: 'fc-3',
    firmaId: 'f-2',
    borc: 210000,
    alacak: 0,
    tarih: '2025-01-28',
    saat: '09:45',
    faturaNo: 'KRM202500092',
    aciklama: '14mm ve 18mm Nervürlü İnşaat Demiri 15 Ton',
  },
  {
    id: 'fc-4',
    firmaId: 'f-2',
    borc: 0,
    alacak: 210000,
    tarih: '2025-02-02',
    saat: '14:20',
    faturaNo: 'ÇEK-928194',
    aciklama: 'Vade 25.03.2025 tarihli Garanti BBVA çeki ile fatura kapama',
    islemTuru: 'odeme',
    cekId: 'cek-1',
  },
  {
    id: 'fc-5',
    firmaId: 'f-3',
    borc: 18500,
    alacak: 0,
    tarih: '2025-02-05',
    saat: '15:10',
    faturaNo: 'TKZ202500129',
    aciklama: 'İş güvenliği baret, yelek, çivi ve bağlantı elemanları',
  },
];

export const INITIAL_CEKLER: Cek[] = [
  {
    id: 'cek-1',
    cekNo: 'CK-928194',
    miktar: 210000,
    alinanTarih: '2025-01-25',
    vadeTarihi: '2025-03-25',
    bankaAdi: 'Garanti BBVA',
    hamil: 'Kroman Çelik Sanayi A.Ş.',
    hesapSahibi: 'Delta Proje İnşaat A.Ş.',
    santiyeProje: 'Merkez Plaza Kule Projesi',
    durum: 'Ciro Edildi',
    aciklama: 'Demir faturası karşılığı firmaya verildi',
    cekTuru: 'verilen_cek',
    firmaId: 'f-2',
    cariHesabaIsle: true,
    cariHareketId: 'fc-4',
  },
  {
    id: 'cek-2',
    cekNo: 'CK-104928',
    miktar: 150000,
    alinanTarih: '2025-02-01',
    vadeTarihi: '2025-04-15',
    bankaAdi: 'Türkiye İş Bankası',
    hamil: 'Şirket Kasasında (Portföy)',
    hesapSahibi: 'Akasya Gayrimenkul Yatırım',
    santiyeProje: 'Vadi Panorama Konutları',
    durum: 'Portföyde',
    aciklama: 'Hakediş 1. kısım tahsilat çeki',
    cekTuru: 'alinan_cek',
    cariHesabaIsle: false,
  },
  {
    id: 'cek-3',
    cekNo: 'CK-551029',
    miktar: 85000,
    alinanTarih: '2025-01-10',
    vadeTarihi: '2025-02-10',
    bankaAdi: 'Yapı Kredi Bankası',
    hamil: 'Şirket Portföyü',
    hesapSahibi: 'Bodrum Marin Yapı',
    santiyeProje: 'Ege Marina Butik Villaları',
    durum: 'Tahsil Edildi',
    aciklama: 'Vadesinde banka hesabımıza tahsil edildi',
    cekTuru: 'alinan_cek',
    cariHesabaIsle: false,
  },
];

export const INITIAL_SANTIYE_GIDERLERI: SantiyeGider[] = [
  {
    id: 'sg-1',
    santiyeId: 's-1',
    odeyen: 'Ali Şantiye Şefi',
    odemeYontemi: 'Nakit Şantiye Kasası',
    tarih: '2025-02-03',
    kategori: 'Yemek & Mutfak',
    aciklama: 'Saha personeli 40 kişilik tabildot öğle yemeği ve su',
    odemeYapilanFirma: 'Lezzet Tabildot Catering',
    durum: 'Ödendi',
    taseron: 'Öz Kalıp İnşaat',
    miktar: 6800,
  },
  {
    id: 'sg-2',
    santiyeId: 's-1',
    odeyen: 'Şirket Muhasebe',
    odemeYontemi: 'Banka Transferi (Havale / EFT)',
    tarih: '2025-02-04',
    kategori: 'Akaryakıt & Jeneratör',
    aciklama: 'Kule vinç ve jeneratör için 1.200 Litre motorin alımı',
    odemeYapilanFirma: 'Opet Petrol İstasyonu',
    durum: 'Ödendi',
    miktar: 52000,
  },
  {
    id: 'sg-3',
    santiyeId: 's-2',
    odeyen: 'Ahmet Saha Mimarı',
    odemeYontemi: 'Firma Kredi Kartı',
    tarih: '2025-02-05',
    kategori: 'İş Güvenliği & Hırdavat',
    aciklama: 'Emniyet kemerleri, reflektörlü yelekler ve uyarı levhaları',
    odemeYapilanFirma: 'Tekzen Şantiye ve Yapı Market Ltd.',
    durum: 'Ödendi',
    miktar: 14200,
  },
  {
    id: 'sg-4',
    santiyeId: 's-1',
    odeyen: 'Merkez Yönetim',
    odemeYontemi: 'Banka Transferi (Havale / EFT)',
    tarih: '2025-02-06',
    kategori: 'Taşeron Hakediş',
    aciklama: '3. Kat kalıp söküm ve beton döküm ara hakediş ödemesi',
    odemeYapilanFirma: 'Öz Kalıp & Beton İşleri',
    durum: 'Ödendi',
    taseron: 'Öz Kalıp İnşaat',
    miktar: 95000,
  },
];

export const INITIAL_PERSONNEL: Personnel[] = [
  {
    id: 'p-1',
    isim: 'Ahmet',
    soyisim: 'Yılmaz',
    TCNO: '12345678901',
    Iban1: 'TR330006100511123456789001',
    Iban2: 'TR440006200119987654321002',
    telefon: '0532 123 45 67',
    santiyeId: 's-1',
    santiye: 'Merkez Plaza Kule Projesi',
    yevmiye: 1600,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    resmiMaas: 28075.5,
    emekli: false,
    sigorta: true,
    maas: 48000,
    girisTarihi: '2025-01-15',
    taseronId: 'tas-1',
    taseron: 'Öz Kalıp & Beton İşleri',
    durum: 'Aktif',
    kategori: 'Kalıp Ustası',
    link: 'https://ornek-arsiv.com/evrak/p1_is_guvenligi.pdf',
    resim: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
  },
  {
    id: 'p-2',
    isim: 'Mehmet',
    soyisim: 'Demir',
    TCNO: '23456789012',
    Iban1: 'TR550001500158047392019482',
    Iban2: '',
    telefon: '0544 987 65 43',
    santiyeId: 's-1',
    santiye: 'Merkez Plaza Kule Projesi',
    yevmiye: 1450,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    resmiMaas: 28075.5,
    emekli: false,
    sigorta: true,
    maas: 43500,
    girisTarihi: '2025-01-16',
    taseronId: 'tas-2',
    taseron: 'Kaya Demir Ltd. Şti.',
    durum: 'Aktif',
    kategori: 'Demirci',
    link: '',
    resim: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
  },
  {
    id: 'p-3',
    isim: 'Mustafa',
    soyisim: 'Kaya',
    TCNO: '34567890123',
    Iban1: 'TR660001000847291048291038',
    Iban2: 'TR770006400000112233445566',
    telefon: '0555 333 22 11',
    santiyeId: 's-2',
    santiye: 'Vadi Panorama Konutları',
    yevmiye: 1300,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    resmiMaas: 28075.5,
    emekli: false,
    sigorta: true,
    maas: 39000,
    girisTarihi: '2025-02-01',
    taseronId: 'tas-2',
    taseron: 'Kaya Demir Ltd. Şti.',
    durum: 'Aktif',
    kategori: 'Genel İşçi',
    link: '',
    resim: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&h=120&fit=crop&crop=face',
  },
  {
    id: 'p-4',
    isim: 'Ali',
    soyisim: 'Öztürk',
    TCNO: '45678901234',
    Iban1: 'TR880003200001928374650192',
    Iban2: '',
    telefon: '0505 444 55 66',
    santiyeId: 's-3',
    santiye: 'Ege Marina Butik Villaları',
    yevmiye: 1750,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    resmiMaas: 28075.5,
    emekli: true,
    sigorta: true,
    maas: 52500,
    girisTarihi: '2024-11-01',
    taseronId: 'tas-3',
    taseron: 'Yıldız Elektrik & Otomasyon',
    durum: 'Aktif',
    kategori: 'Elektrik & Tesisat Ustası',
    link: 'https://ornek-arsiv.com/evrak/ali_elektrikci_ustalik.pdf',
    resim: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
  },
  {
    id: 'p-5',
    isim: 'Salih',
    soyisim: 'Aydın',
    TCNO: '56789012345',
    Iban1: 'TR110006200000000011223344',
    Iban2: '',
    telefon: '0530 654 32 10',
    santiyeId: 's-1',
    santiye: 'Merkez Plaza Kule Projesi',
    yevmiye: 2200,
    gunlukCalismaSaati: 8,
    mesaiKatsayisi: 1.0,
    emekli: false,
    sigorta: true,
    maas: 66000,
    girisTarihi: '2025-01-10',
    durum: 'Aktif',
    kategori: 'Saha Formeni',
    link: '',
    resim: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=face',
  },
];

export const INITIAL_MESAI: Mesai[] = [
  {
    id: 'm-1',
    personelId: 'p-1',
    tarih: '2025-02-03',
    mesaiSaatAraligi: '18:00 - 21:00',
    saat: 3,
    aciklama: '3. Kat tabliye betonu dökümü uzadı',
  },
  {
    id: 'm-2',
    personelId: 'p-2',
    tarih: '2025-02-04',
    mesaiSaatAraligi: '18:00 - 20:00',
    saat: 2,
    aciklama: 'Kolon demirleri acil teslimatı',
  },
  {
    id: 'm-3',
    personelId: 'p-4',
    tarih: '2025-02-02',
    mesaiSaatAraligi: '18:30 - 22:30',
    saat: 4,
    aciklama: 'Ana pano trafo kablo çekimi',
  },
];

export const INITIAL_PERSONEL_ODEMELERI: PersonelOdeme[] = [
  {
    id: 'po-1',
    personelId: 'p-1',
    tarih: '2025-02-01',
    saat: '10:15',
    avansOdemesi: 5000,
    resmiOdeme: 0,
    yaptigiHarcama: 0,
    cezaMiktari: 0,
    eskiBakiyesi: 0,
    aciklama: 'Şubat ayı ilk hafta elden avans ödemesi',
    odemeYontemi: 'Nakit Şantiye Kasası',
  },
  {
    id: 'po-2',
    personelId: 'p-2',
    tarih: '2025-02-02',
    saat: '14:30',
    avansOdemesi: 3500,
    resmiOdeme: 0,
    yaptigiHarcama: 0,
    cezaMiktari: 0,
    eskiBakiyesi: 0,
    aciklama: 'Kira avansı talebi',
    odemeYontemi: 'Banka Transferi (Havale / EFT)',
  },
  {
    id: 'po-3',
    personelId: 'p-1',
    tarih: '2025-02-04',
    saat: '17:00',
    avansOdemesi: 0,
    resmiOdeme: 0,
    yaptigiHarcama: 850,
    cezaMiktari: 0,
    eskiBakiyesi: 0,
    aciklama: 'Hırdavatçıdan alınan acil disk ve eldiven fişi iadesi',
    odemeYontemi: 'Nakit Şantiye Kasası',
  },
  {
    id: 'po-4',
    personelId: 'p-3',
    tarih: '2025-02-03',
    saat: '11:00',
    avansOdemesi: 2000,
    resmiOdeme: 0,
    yaptigiHarcama: 0,
    cezaMiktari: 500,
    eskiBakiyesi: 0,
    aciklama: 'İş güvenliği baret takmama uyarısı ve avans kesintisi',
    odemeYontemi: 'Nakit Şantiye Kasası',
  },
];

// Initial Puantaj records for demo/fallback
export const INITIAL_PUANTAJ: Puantaj[] = [
  { id: 'pua-1', personelId: 'p-1', tarih: '2025-02-01', calismaDurumu: 'Tam Gün' },
  { id: 'pua-2', personelId: 'p-1', tarih: '2025-02-02', calismaDurumu: 'Tam Gün' },
  { id: 'pua-3', personelId: 'p-1', tarih: '2025-02-03', calismaDurumu: 'Tam Gün' },
  { id: 'pua-4', personelId: 'p-1', tarih: '2025-02-04', calismaDurumu: 'Tam Gün' },
  { id: 'pua-5', personelId: 'p-1', tarih: '2025-02-05', calismaDurumu: 'Tam Gün' },
  { id: 'pua-6', personelId: 'p-2', tarih: '2025-02-01', calismaDurumu: 'Tam Gün' },
  { id: 'pua-7', personelId: 'p-2', tarih: '2025-02-02', calismaDurumu: 'Tam Gün' },
  { id: 'pua-8', personelId: 'p-2', tarih: '2025-02-03', calismaDurumu: 'Tam Gün' },
  { id: 'pua-9', personelId: 'p-2', tarih: '2025-02-04', calismaDurumu: 'Tam Gün' },
  { id: 'pua-10', personelId: 'p-3', tarih: '2025-02-01', calismaDurumu: 'Tam Gün' },
  { id: 'pua-11', personelId: 'p-3', tarih: '2025-02-02', calismaDurumu: 'Tam Gün' },
  { id: 'pua-12', personelId: 'p-3', tarih: '2025-02-03', calismaDurumu: 'Tam Gün' },
  { id: 'pua-13', personelId: 'p-4', tarih: '2025-02-01', calismaDurumu: 'Tam Gün' },
  { id: 'pua-14', personelId: 'p-4', tarih: '2025-02-02', calismaDurumu: 'Tam Gün' },
  { id: 'pua-15', personelId: 'p-5', tarih: '2025-02-01', calismaDurumu: 'Tam Gün' },
  { id: 'pua-16', personelId: 'p-5', tarih: '2025-02-02', calismaDurumu: 'Tam Gün' },
];

export const getInitialPuantaj = (): Puantaj[] => {
  return INITIAL_PUANTAJ;
};

// Initial Corporate Credit Cards
export const INITIAL_KREDI_KARTLARI: KrediKarti[] = [
  {
    id: 'kk-1',
    kartAdi: 'Garanti BBVA Şirket Ticari',
    banka: 'Garanti BBVA',
    kartSahibi: 'Zirve Yapı İnşaat A.Ş.',
    kartNumarasiSon4: '4589',
    kartTuru: 'Şirket / Kurumsal',
    kartLimiti: 250000,
    kesimGunu: 15,
    sonOdemeGunu: 25,
    renk: 'emerald',
    durum: 'Aktif',
    aciklama: 'Ana merkez ve şantiye satınalma kartı',
  },
  {
    id: 'kk-2',
    kartAdi: 'Yapı Kredi Platinum Business',
    banka: 'Yapı Kredi',
    kartSahibi: 'Zirve Yapı İnşaat A.Ş.',
    kartNumarasiSon4: '7124',
    kartTuru: 'Şirket / Kurumsal',
    kartLimiti: 180000,
    kesimGunu: 5,
    sonOdemeGunu: 15,
    renk: 'blue',
    durum: 'Aktif',
    aciklama: 'Akaryakıt ve lojistik harcama kartı',
  },
  {
    id: 'kk-3',
    kartAdi: 'İş Bankası Şantiye Satınalma',
    banka: 'Türkiye İş Bankası',
    kartSahibi: 'Ali Şantiye Şefi',
    kartNumarasiSon4: '9931',
    kartTuru: 'Şirket / Kurumsal',
    kartLimiti: 100000,
    kesimGunu: 20,
    sonOdemeGunu: 30,
    renk: 'indigo',
    durum: 'Aktif',
    aciklama: 'Merkez Plaza acil alımlar için formen kartı',
  },
];

// Initial Credit Card Transactions
export const INITIAL_KART_HARCAMALARI: KrediKartiHarcama[] = [
  {
    id: 'kkh-1',
    kartId: 'kk-1',
    tarih: '2025-02-05',
    islemTipi: 'Harcama',
    tutar: 14200,
    paraBirimi: 'TRY',
    kategori: 'İş Güvenliği & Hırdavat',
    santiyeId: 's-2',
    santiyeAdi: 'Vadi Panorama Konutları',
    firmaId: 'f-3',
    firmaAdi: 'Tekzen Şantiye ve Yapı Market Ltd.',
    aciklama: 'Emniyet kemerleri ve baret alımı',
    taksitSayisi: 3,
  },
  {
    id: 'kkh-2',
    kartId: 'kk-1',
    tarih: '2025-02-08',
    islemTipi: 'Harcama',
    tutar: 28500,
    paraBirimi: 'TRY',
    kategori: 'Malzeme',
    santiyeId: 's-1',
    santiyeAdi: 'Merkez Plaza Kule Projesi',
    aciklama: 'Şantiye elektrik panosu kabloları',
    taksitSayisi: 1,
  },
  {
    id: 'kkh-3',
    kartId: 'kk-2',
    tarih: '2025-02-03',
    islemTipi: 'Harcama',
    tutar: 8750,
    paraBirimi: 'TRY',
    kategori: 'Yemek & Mutfak',
    santiyeId: 's-1',
    santiyeAdi: 'Merkez Plaza Kule Projesi',
    aciklama: 'Aylık personel mutfak erzak alımı',
    taksitSayisi: 1,
  },
  {
    id: 'kkh-4',
    kartId: 'kk-1',
    tarih: '2025-02-14',
    islemTipi: 'Kart Ödemesi',
    tutar: 20000,
    paraBirimi: 'TRY',
    kategori: 'Ekstre / Kart Borcu Ödemesi',
    aciklama: 'Banka cari hesabından ara kart borcu ödemesi',
    taksitSayisi: 1,
  },
];

// Generic LocalStorage helper with fallback
export function getStoredData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(`Storage error for ${key}:`, e);
  }
  return defaultValue;
}

export function setStoredData<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error(`Storage save error for ${key}:`, e);
  }
}

export function clearAllStoredData(): void {
  try {
    const keysToReset = [
      'personnel',
      'puantaj',
      'mesai',
      'odemeler',
      'santiyeler',
      'giderler',
      'taseronlar',
      'firmalar',
      'cari',
      'cekler',
      'kredi_kartlari',
      'kart_harcamalari',
    ];
    keysToReset.forEach((k) => {
      localStorage.setItem(STORAGE_PREFIX + k, JSON.stringify([]));
    });
    localStorage.setItem(STORAGE_PREFIX + 'odeme_yontemleri', JSON.stringify(INITIAL_ODEME_YONTEMLERI));
    localStorage.setItem(STORAGE_PREFIX + 'gider_kategorileri', JSON.stringify(DEFAULT_SANTIYE_GIDER_KATEGORILERI));
    localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(INITIAL_USERS));
  } catch (e) {
    console.error('Storage clear error:', e);
  }
}

// Formatters
export const getCurrencySymbol = (currency: string = 'TRY'): string => {
  const c = (currency || 'TRY').toUpperCase();
  switch (c) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'TRY':
    case 'TL':
      return '₺';
    default:
      return currency || '₺';
  }
};

export const formatCurrency = (amount: number = 0, currency: string = 'TRY'): string => {
  const curr = (currency || 'TRY').toUpperCase();
  const validIso = ['TRY', 'USD', 'EUR', 'GBP'].includes(curr) ? curr : 'TRY';

  if (['TRY', 'USD', 'EUR', 'GBP'].includes(curr)) {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: validIso,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  const formattedNum = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formattedNum} ${currency}`;
};

export const formatIBAN = (iban?: string): string => {
  if (!iban) return '';
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
};

export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
