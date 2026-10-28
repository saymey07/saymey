// ==========================================
// PARA BİRİMİ TANIMLARI
// ==========================================
export type ParaBirimi = 'TRY' | 'USD' | 'EUR' | 'GBP' | string;

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const DEFAULT_CURRENCIES: CurrencyOption[] = [
  { code: 'TRY', symbol: '₺', name: 'Türk Lirası (₺)' },
  { code: 'USD', symbol: '$', name: 'Amerikan Doları ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'İngiliz Sterlini (£)' },
];

// ==========================================
// KULLANICI & İZİN YÖNETİMİ MODEL TANIMLARI
// ==========================================
export type UserRole = 'admin' | 'saha_sorumlusu' | 'puantor' | 'taseron_yetkilisi' | 'muhasebe' | 'custom';

export interface UserPermissions {
  canViewDashboard: boolean;          // Dashboard / Genel Finans ve Şirket Özeti
  canManagePersonnel: boolean;        // Personel Listesi, Yeni Ekleme, Düzenleme
  canManageAttendance: boolean;       // Personel Puantaj ve Mesai Girişi (Saha kullanıcısının yetkisi)
  canManagePayroll: boolean;          // Personel Hakediş, Maaş & Ödeme Girişi (Hassas bordro/ücret bilgileri)
  canManageSites: boolean;            // Şantiye Bilgileri & Şantiye Masraf/Gider Girişi (Saha kullanıcısının yetkisi)
  canManageCreditCards: boolean;      // Kredi Kartları ve Ekstreleri
  canManageSubcontractors: boolean;   // Taşeronlar ve Hakediş Sözleşmeleri
  canManageCompanies: boolean;        // Firmalar ve Cari Hesaplar
  canManageChecks: boolean;           // Çek/Senet Takibi ve Cirolama
  canViewReports: boolean;            // Raporlar Merkezi (Finansal & Kârlılık Raporları)
  canManageUsers: boolean;            // Kullanıcı ve İzin Yönetimi (Yönetici)
  canManageSettings: boolean;         // Yedekleme, İçe/Dışa Aktarma, Sıfırlama ve Döviz Kurları
  canEdit: boolean;                   // Veri ve Kayıt Düzenleme İzni (Personel, Puantaj, Gider, Ödeme vb. güncelleme)
  canDelete: boolean;                 // Veri ve Kayıt Silme İzni (Personel, Gider, Ödeme, Çek vb. silme)
}

export interface AppUser {
  id: string;
  username: string;                 // Kullanıcı adı (örn: admin, ahmet.saha, vs.)
  password: string;                 // Şifre
  fullName: string;                 // Ad Soyad (örn: Ahmet Yılmaz)
  role: UserRole;                   // Rol tanımı
  unvan?: string;                   // Unvan / Görev (örn: Şantiye Şefi, Saha Sorumlusu, Taşeron Yetkilisi)
  telefon?: string;                 // Telefon numarası
  durum: 'Aktif' | 'Pasif';         // Aktif mi?
  permissions: UserPermissions;     // Ayrıntılı modül izinleri
  assignedSantiyeIds?: string[];    // İzinli olduğu şantiyeler (boş ise tüm şantiyeler, aksi takdirde sadece belirtilenler)
  assignedTaseronIds?: string[];    // İzinli olduğu taşeronlar (boş ise tüm taşeronlar, aksi takdirde sadece belirtilenler)
  sonGirisTarihi?: string;          // Son giriş zamanı
  createdAt: string;                // Oluşturulma tarihi
}

// ==========================================
// 12 VERİ TABANI TABLOSU MODEL TANIMLAMALARI
// ==========================================

export interface PersonelDonemBakiye {
  id: string;
  donem: string;            // Dönem (YYYY-MM, örn: 2026-09, 2026-10)
  tutar: number;            // Tutar (+: Alacak / Harcama İadesi, -: Avans Borcu)
  aciklama?: string;        // Opsiyonel açıklama (örn: Eylül cebinden yaptığı harcamalar, devreden bakiye vb.)
}

// Ücret & Maaş Değişiklik Geçmişi (Dönem Kademesi)
export interface PersonelUcretGecmisi {
  id: string;
  gecerlilikBaslangic: string; // Geçerli olduğu başlangıç dönemi (YYYY-MM, örn: "2026-10")
  ucretTipi?: 'yevmiye' | 'aylik'; // O dönemdeki ücret tipi
  yevmiye: number;          // O dönem için geçerli günlük yevmiye
  maas?: number;            // O dönem için geçerli aylık maaş
  resmiMaas?: number;       // O dönem için geçerli resmi maaş
  aciklama?: string;        // Zam / değişiklik açıklaması (örn: "Ekim 2026 Zam / Ücret Artışı")
  degisiklikTarihi?: string;// Değişikliğin yapıldığı işlem tarihi (YYYY-MM-DD)
}

// 1. Personel Tablosu
export interface Personnel {
  id: string;
  isim: string;
  soyisim: string;
  TCNO: string;
  Iban1: string;
  Iban2?: string;
  telefon: string;
  santiyeId?: string;       // Şantiye ID
  santiye?: string;         // Şantiye adı
  ucretTipi?: 'yevmiye' | 'aylik'; // Ücret tipi: 'yevmiye' (Günlük Yevmiyeli) | 'aylik' (Aylık Sabit Ücretli)
  yevmiye: number;          // Günlük yevmiye (En güncel)
  gunlukCalismaSaati?: number; // Günlük çalışma saati (Varsayılan: 8)
  mesaiKatsayisi?: number;  // Mesai katsayısı çarpanı (Örn: 1.0 = 1 saate 1 saat, 1.5 = 1 saate 1.5 saat. Varsayılan: 1.0)
  resmiMaas?: number;       // Aylık resmi maaş (Asgari ücret matrahı / bankadan yatacak tutar, örn: 28.000 TL)
  emekli: boolean;          // Emekli mi?
  sigorta: boolean | string;// Sigorta durumu
  maas?: number;            // Aylık sabit maaş (varsa, En güncel)
  girisTarihi: string;      // Giriş tarihi YYYY-MM-DD
  cikisTarihi?: string;     // Çıkış tarihi YYYY-MM-DD
  taseronId?: string;       // Taşeron ID
  taseron?: string;         // Taşeron Adı
  durum: 'Aktif' | 'Pasif';  // Durum
  kategori: string;         // Meslek / Pozisyon (Kalıpçı, Demirci, Elektrikçi vb.)
  link?: string;            // Evrak / Doküman linki
  resim?: string;           // Fotoğraf / Avatar URL
  eskiBakiye?: number;      // Eski Kalan Bakiye / Devreden Bakiye (+: Personel Alacaklısı, -: Avans Borçlusu)
  eskiBakiyeDonemi?: string; // Eski Kalan Bakiyenin ait olduğu dönem (YYYY-MM, örn: 2026-09)
  donemBakiyeleri?: PersonelDonemBakiye[]; // Her ay/dönem için ayrı ayrı girilebilen eski bakiye & cebinden harcama kayıtları
  ucretGecmisi?: PersonelUcretGecmisi[]; // Personel maaşı / yevmiyesi değiştiğinde geçmiş ve gelecek dönem ücretlerini ayrı ayrı tutan kademe listesi
  aylikResmiGunler?: Record<string, number>; // Ay bazında (YYYY-MM) manuel belirlenen resmi çalışma günleri (Örn: { "2026-09": 30, "2026-10": 20 })
  paraBirimi?: ParaBirimi;  // Ücret para birimi (varsayılan TRY)
}

// 2. Puantaj Tablosu
export type CalismaDurumu = 
  | 'Tam Gün' 
  | 'Yarım Gün' 
  | 'Fazla Mesaili'
  | 'Ücretli İzin' 
  | 'Ücretsiz İzin' 
  | 'Gelmedi' 
  | 'Resmi Tatil'
  | 'Boş';

export interface Puantaj {
  id: string;
  personelId: string;
  tarih: string; // YYYY-MM-DD
  calismaDurumu: CalismaDurumu;
  not?: string;
}

// 3. Mesai Tablosu
export interface Mesai {
  id: string;
  personelId: string;
  tarih: string;            // YYYY-MM-DD
  mesaiSaatAraligi: string; // Örn: 18:00 - 21:00
  saat: number;             // Örn: 3
  aciklama?: string;
}

// 4. Personel Hakediş Tablosu (Dönem bazlı hesap cetveli)
export interface PersonelHakedis {
  id: string;
  personelId: string;
  donem: string;        // Örn: 2025-02 (YYYY-MM)
  puantajGun: number;   // Toplam fiili çalışılan gün sayısı
  mesaiSaat: number;    // Toplam mesai saati
  resmiGun: number;     // Resmi tatil çalışma gün sayısı
  yevmiyeTutar: number; // Günlük yevmiyesi
  resmiMaas?: number;   // Tanımlı resmi maaş (Asgari ücret matrahı)
  gunlukResmiKesinti?: number; // Günlük resmi kesinti = resmiMaas / 30
  gunlukEldenTutar?: number;   // Günlük elden kalan = yevmiye - (resmiMaas / 30)
  saatlikMesaiUcreti?: number;
  toplamHakedis: number;// Hesaplanmış toplam hakediş (taban + mesai + eskiBakiye)
  resmiAlacak: number;  // Puantaj gün * (resmiMaas / 30) -> Ay sonu bankadan ödenecek resmi tutar
  eldenHakedis: number; // Puantaj gün * (yevmiye - resmiMaas/30) + mesai tutarı + devreden eski bakiye
  toplamAvans: number;  // Elden yapılan avans ödemeleri
  toplamResmiOdeme: number; // Yapılan banka/resmi ödemeler
  kalanResmiOdeme: number;  // Kalan resmi alacak (resmiAlacak - toplamResmiOdeme)
  kalanEldenOdeme: number;  // Kalan elden/avans alacağı (eldenHakedis + harcama - avans - ceza)
  toplamHarcama: number;// Personelin yaptığı harcama
  toplamCeza: number;   // Ceza / kesinti
  eskiBakiye: number;   // Önceki dönemden devreden bakiye
  kalanBakiye: number;  // Personele ödenecek genel net kalan
}

// 5. Personel Ödeme Tablosu
export interface PersonelOdeme {
  id: string;
  personelId: string;
  tarih: string;        // YYYY-MM-DD (İşlem/Ödeme Tarihi)
  saat: string;         // HH:mm
  bordroDonemi?: string;// YYYY-MM (Örn: "2026-09") - Ödemenin/avansın mahsup edileceği Bordro Dönemi
  avansOdemesi: number; // Avans
  resmiOdeme: number;   // Resmi Ödeme
  yaptigiHarcama: number;// Harcama iadesi
  cezaMiktari: number;  // Ceza / Kesinti
  eskiBakiyesi: number; // İşlem anındaki bakiye
  aciklama?: string;
  odemeYontemi?: string;
  paraBirimi?: string;  // Para Birimi (Varsayılan: 'TRY' - 'USD', 'EUR', vs.)
  santiyeId?: string;   // Ödemenin ait olduğu / masraf yazıldığı şantiye ID'si
  santiyeAdi?: string;  // Şantiye adı snapshot'ı
  // Taşeron Cari Entegrasyonu:
  cariHareketId?: string; // Taşeron firma cari hareket ID'si
  taseronFirmaId?: string; // Taşeron firma ID'si
  // Çek Entegrasyonu:
  cekId?: string;         // İlişkili çek ID'si
  cekNo?: string;         // İlişkili çek seri numarası
}

// 6. Taşeron Tablosu
export interface Taseron {
  id: string;
  isim: string;
  telefon?: string;
  yetkili?: string;
  uzmanlik?: string;    // Kaba yapı, İnce işler, Elektrik, Tesisat vb.
  durum: 'Aktif' | 'Pasif';
  bakiye?: number;
  vergiNo?: string;     // Vergi / TC No (Firma Cari ile 1:1 senkronize)
  vergiDairesi?: string; // Vergi Dairesi
  adres?: string;       // Firma / Şantiye Adresi
  email?: string;
}

// 7. Şantiye Tablosu
export interface Santiye {
  id: string;
  isim: string;
  yetkiliFirma: string;
  taseron?: string;        // Ana taşeron veya virgülle ayrılmış liste (uyumluluk için)
  taseronlar?: string[];   // Şantiyeye bağlı birden fazla taşeron listesi
  baslangicTarihi: string;
  bitisTarihi?: string;
  durum: 'Aktif' | 'Tamamlandı' | 'Askıda';
  ulke: string;
  il: string;
  ilce: string;
  adres: string;
  aciklama?: string;
}

// 8. Şantiye Gider Tablosu
export interface SantiyeGider {
  id: string;
  santiyeId: string;
  odeyen: string;             // Harcamayı yapan kişi / kurum
  odemeYontemi: string;       // Nakit, Kredi Kartı, Havale vb.
  tarih: string;              // YYYY-MM-DD
  kategori: string;           // Malzeme, Nakliye, Yemek, Akaryakıt, İşçilik, Taşeron Hakediş, Diğer
  aciklama: string;
  odemeYapilanFirma?: string; // Fatura kesilen / ödenen firma
  durum: 'Ödendi' | 'Beklemede' | 'İptal';
  taseron?: string;
  miktar: number;
  paraBirimi?: string;        // Para Birimi (Varsayılan: 'TRY' - 'USD', 'EUR', vs.)
  faturaNo?: string;          // Fatura / Fiş No
  // Kredi Kartı Entegrasyonu:
  kartId?: string;            // Harcamanın çekildiği Kredi Kartı ID'si
  kartHarcamaId?: string;     // Kredi kartı hareketlerinde oluşturulan harcama kaydının ID'si
  taksitSayisi?: number;      // Kart harcaması taksit sayısı (varsayılan 1)
  // Taşeron Cari Entegrasyonu:
  cariHareketId?: string;     // Firma Cari tablosuna otomatik oluşturulan hareketin ID'si
  cariFirmaId?: string;       // Hangi firma/taşeron cari hesabına işlendiği
  // Çek Entegrasyonu:
  cekId?: string;             // İlişkili çek ID'si
  cekNo?: string;             // İlişkili çek seri numarası
}

// 9. Ödeme Yöntemi Tablosu
export interface OdemeYontemi {
  id: string;
  isim: string;
}

// 10. Firma Tablosu
export type FirmaTuru = 'tedarikci' | 'musteri' | 'taseron' | 'diger';

export interface Firma {
  id: string;
  isim: string;
  adres: string;
  vergiNo: string;
  vergiDairesi?: string; // Vergi Dairesi
  ilgili: string;  // Yetkili kişi
  telefon?: string;
  email?: string;
  tur?: FirmaTuru; // 'tedarikci' (Tedarikçi Firma) | 'musteri' (Müşteri Firma) | 'taseron' (Taşeron) | 'diger' (Diğer)
  uzmanlik?: string; // Taşeron uzmanlık iş kolu (Taşeronlar tablosu ile 1:1 senkronize)
}

// 11. Firma Cari Tablosu
export interface FirmaCari {
  id: string;
  firmaId: string;
  borc: number;     // Firmaya olan borcumuz (Alış Faturası vb.)
  alacak: number;   // Firmadan olan alacağımız (Satış Faturası veya yapılan ödeme)
  paraBirimi?: string; // Para Birimi (Varsayılan: 'TRY' - 'USD', 'EUR', vs.)
  tarih: string;
  saat: string;
  faturaNo?: string;
  aciklama?: string;
  islemTuru?: 'alis_faturasi' | 'satis_faturasi' | 'odeme' | 'tahsilat';
  cekId?: string;   // İlişkili çek ID'si
  dovizKuru?: number;         // İşlem tarihindeki TRY kuru (örneğin 1 EUR = 39.50 ₺)
  tlKarsiligi?: number;       // Otomatik hesaplanan TL eşdeğeri
  hedefParaBirimi?: string;   // Ödeme/Tahsilatta: Hangi borç/alacak sepetinden düşülecek? (Örn: 'EUR' veya 'TRY')
  hedefKur?: number;          // Uygulanan çevrim kuru (Örn: 40.00 ₺/€)
  hedefDusulenTutar?: number; // Hedef sepetten düşülen net tutar (Örn: 75 €)
  giderId?: string;           // İlişkili şantiye gideri / taşeron hakediş ID'si
  odemeId?: string;           // İlişkili personel / ekip ödeme ID'si
  kartHarcamaId?: string;     // İlişkili kredi kartı harcama ID'si
  kartId?: string;            // İlişkili kredi kartı ID'si
  santiyeId?: string;         // İlgili Şantiye ID (Ödemenin veya faturanın ait olduğu şantiye)
  santiyeAdi?: string;        // İlgili Şantiye Adı
}

// 12. Çek Tablosu
export interface Cek {
  id: string;
  cekNo: string;
  miktar: number;
  paraBirimi?: string;  // Para Birimi (Varsayılan: 'TRY' - 'USD', 'EUR', vs.)
  alinanTarih: string;  // YYYY-MM-DD
  vadeTarihi: string;   // YYYY-MM-DD
  bankaAdi: string;
  hamil: string;        // Hamiline / Ciro edilen / Kime verildi
  hesapSahibi: string;  // Keşideci
  santiyeId?: string;   // İlişkili şantiye ID
  santiyeProje?: string;// İlişkili şantiye adı
  durum: 'Portföyde' | 'Tahsilde' | 'Tahsil Edildi' | 'Ciro Edildi' | 'Karşılıksız' | 'Ödendi';
  aciklama?: string;
  cekTuru?: 'alinan_cek' | 'verilen_cek'; // Müşteriden Alınan Çek vs Firmaya Kesilen / Verilen Çek
  firmaId?: string;         // İlişkili Firma / Cari Hesap (Çekin ilk ait olduğu firma)
  cariHesabaIsle?: boolean; // Seçilen firmanın cari hesabına işlendi mi?
  cariHareketId?: string;   // Oluşturulan cari hareketin referans ID'si
  // Ciro Bilgileri ve Ciro Edilen Firma Cari Entegrasyonu:
  ciroFirmaId?: string;         // Ciro edilen kayıtlı firmanın ID'si
  ciroEdilenFirma?: string;     // Ciro edilen firma unvanı
  ciroTarihi?: string;          // Çekin ciro edildiği tarih (YYYY-MM-DD)
  ciroCariHesabaIsle?: boolean; // Ciro edilen firmanın cari hesabına işlendi mi? (Borçtan düşülmesi için)
  ciroCariHareketId?: string;   // Ciro sonucu oluşturulan cari hareketin referans ID'si
  ciroAciklama?: string;        // Ciro açıklaması / notu
  ciroSantiyeId?: string;       // Ciro işleminin ait olduğu şantiye ID
  ciroSantiyeProje?: string;    // Ciro işleminin ait olduğu şantiye adı
}

// 13. Kredi Kartı Tablosu
export interface KrediKarti {
  id: string;
  kartAdi: string;            // Örn: Şirket Garanti Bonus, Şantiye Harcama Kartı
  banka: string;              // Garanti BBVA, İş Bankası, Yapı Kredi, Ziraat, Akbank, vs.
  kartSahibi: string;         // Kart üzerindeki isim veya şirket unvanı
  kartNumarasiSon4: string;   // Kartın son 4 hanesi (örn: 4589)
  kartTuru: 'Şirket / Kurumsal' | 'Şahsi';
  kartLimiti: number;         // Toplam tanımlı limit (TL)
  kesimGunu: number;          // Hesap kesim günü (1 - 31)
  sonOdemeGunu: number;       // Son ödeme günü (1 - 31)
  renk?: 'slate' | 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo';
  durum: 'Aktif' | 'Pasif';
  aciklama?: string;
}

// 14. Kredi Kartı Harcama & Hareket Tablosu
export interface KrediKartiHarcama {
  id: string;
  kartId: string;             // İlişkili Kredi Kartı ID
  tarih: string;              // YYYY-MM-DD
  islemTipi: 'Harcama' | 'Kart Ödemesi' | 'İade'; // Harcama = Borç artar, Kart Ödemesi / İade = Borç azalır
  tutar: number;              // Tutar (TL)
  paraBirimi?: string;        // Para Birimi (Varsayılan: 'TRY' - 'USD', 'EUR', vs.)
  kategori: string;           // Akaryakıt, Malzeme & Hırdavat, Yemek & Temsil, Nakliye, Konaklama, vs.
  santiyeId?: string;         // İlgili Şantiye ID (varsa)
  santiyeAdi?: string;        // Şantiye adı
  firmaId?: string;           // İlgili Firma ID (varsa)
  firmaAdi?: string;          // Firma adı
  taksitSayisi: number;       // 1 (Tek Çekim), 2, 3, 6, 9, 12...
  faturaNo?: string;          // Fiş / Fatura No
  aciklama: string;           // Harcama detayı
  santiyeGiderId?: string;    // İlişkili Şantiye Gideri ID'si (varsa)
  cariHareketId?: string;     // İlişkili Firma Cari Hareket ID'si (varsa)
  cariHesabaIsle?: boolean;   // Firma cari hesabına işlendi mi?
}

// Puantaj Durum Renk ve Katsayı Ayarları
export interface CalismaDurumConfig {
  katsayi: number;
  badge: string;
  short: string;
}

export const CALISMA_DURUMU_CONFIG: Record<CalismaDurumu, CalismaDurumConfig> = {
  'Tam Gün': {
    katsayi: 1.0,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    short: 'T',
  },
  'Yarım Gün': {
    katsayi: 0.5,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    short: 'Y',
  },
  'Fazla Mesaili': {
    katsayi: 1.5,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    short: 'M',
  },
  'Ücretli İzin': {
    katsayi: 1.0,
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    short: 'Üİ',
  },
  'Ücretsiz İzin': {
    katsayi: 0.0,
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    short: 'İ',
  },
  'Gelmedi': {
    katsayi: 0.0,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    short: 'G',
  },
  'Resmi Tatil': {
    katsayi: 1.0,
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    short: 'R',
  },
  'Boş': {
    katsayi: 0.0,
    badge: 'bg-slate-100 text-slate-400 border-slate-200',
    short: '-',
  },
};
