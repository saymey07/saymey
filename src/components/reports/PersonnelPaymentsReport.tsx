import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Building, 
  Layers, 
  DollarSign, 
  CreditCard, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle,
  Building2,
  HardHat,
  Briefcase,
  Filter,
  Coins,
  CheckCircle2,
  Clock,
  Landmark,
  Banknote,
  Wallet,
  UserX,
  UserCheck
} from 'lucide-react';
import { 
  Personnel, 
  Puantaj, 
  Mesai, 
  PersonelOdeme, 
  Santiye, 
  Taseron, 
  CALISMA_DURUMU_CONFIG 
} from '../../types';
import { formatCurrency, getTodayDateString } from '../../utils/storage';
import {
  calculateEffectivePuantajGunForMonth,
  getActiveMonthsForPersonnelInPeriod,
  getEffectiveEskiBakiyeForMonth,
  getEffectiveWageForPersonnel,
  getEffectiveResmiGunForMonth,
  isOdemeInBordroDonemi,
} from '../../utils/personnelBalance';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../../utils/currencyStore';
import { ExportButton } from '../ExportButton';
import { ExportOptions } from '../../utils/exportUtils';

interface PersonnelPaymentsReportProps {
  personnelList: Personnel[];
  puantajList: Puantaj[];
  mesaiList: Mesai[];
  odemeList: PersonelOdeme[];
  santiyeler: Santiye[];
  taseronlar: Taseron[];
  giderler?: any[];
  defaultMonthStr?: string;
}

export const PersonnelPaymentsReport: React.FC<PersonnelPaymentsReportProps> = ({
  personnelList,
  puantajList,
  mesaiList,
  odemeList,
  santiyeler,
  taseronlar,
  defaultMonthStr,
}) => {
  const exchangeRates = getSavedExchangeRates();
  const currentYear = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');

  const initialYear =
    defaultMonthStr && /^\d{4}-\d{2}$/.test(defaultMonthStr)
      ? parseInt(defaultMonthStr.slice(0, 4), 10)
      : currentYear;
  const initialMonth =
    defaultMonthStr && /^\d{4}-\d{2}$/.test(defaultMonthStr)
      ? defaultMonthStr.slice(5, 7)
      : currentMonthNum;

  // Filter States
  const [periodMode, setPeriodMode] = useState<'monthly' | 'yearly' | 'all'>(() =>
    defaultMonthStr === 'all' ? 'all' : 'monthly'
  );
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);
  
  // Location Filter: 'all' | 'center' (Merkez Ofis - Şantiye Harici) | santiye.id
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  
  // Staff/Subcontractor Filter: 'all' | 'company' (Şirket Kadrosu) | 'subcontractor' (Tüm Taşeronlar) | specific taseron.id
  const [selectedStaffType, setSelectedStaffType] = useState<string>('all');
  
  // Wage Type Filter: 'all' | 'aylik' (Aylık Sabit Ücretli) | 'yevmiye' (Günlük Yevmiyeli)
  const [selectedWageType, setSelectedWageType] = useState<'all' | 'aylik' | 'yevmiye'>('all');

  // Personnel Status Filter:
  // 'active_and_balance_passive' (Varsayılan: Aktif personeller + bakiyesi olan pasif personeller. Sıfır bakiyeli pasifler gizlenir)
  // 'active_only' (Yalnızca aktif personeller)
  // 'passive_only' (Yalnızca bakiyesi olan pasif personeller)
  // 'all_with_zero' (Tüm personeller, sıfır bakiyeli pasifler dahil)
  const [selectedPersonnelStatus, setSelectedPersonnelStatus] = useState<
    'active_and_balance_passive' | 'active_only' | 'passive_only' | 'all_with_zero'
  >('active_and_balance_passive');

  // Sıfır bakiyeli pasif personelleri raporda gizleme anahtarı (Kullanıcı kuralı gereği varsayılan: true)
  const [hideZeroBalancePassive, setHideZeroBalancePassive] = useState<boolean>(true);
  
  // Payment Method/Type Filter
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>('all');
  
  // Search Text
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Row Expand state
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  // Month names for Turkish UI
  const monthNames = [
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

  // Selected date prefix for filtering
  const targetPrefix = useMemo(() => {
    if (periodMode === 'all') return '';
    if (periodMode === 'yearly') return `${selectedYear}`;
    return `${selectedYear}-${selectedMonth}`;
  }, [periodMode, selectedYear, selectedMonth]);

  // Filter personnel according to location and staff type
  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((p) => {
      // Location check
      if (selectedLocation === 'center') {
        // Merkez / Ofis Personeli (Şantiye Harici)
        const isNotAssignedToSite = !p.santiyeId || p.santiyeId.trim() === '';
        const isCenterName = p.santiye?.toLowerCase().includes('merkez') || p.santiye?.toLowerCase().includes('ofis') || !p.santiye;
        if (!isNotAssignedToSite && !isCenterName) return false;
      } else if (selectedLocation !== 'all') {
        // Belirli bir şantiye seçilmişse
        if (p.santiyeId !== selectedLocation && p.santiye !== selectedLocation) return false;
      }

      // Staff type check
      if (selectedStaffType === 'company') {
        // Şirket Öz Kadro Personeli (Taşeron Harici)
        if (p.taseronId || (p.taseron && p.taseron.trim() !== '')) return false;
      } else if (selectedStaffType === 'subcontractor') {
        // Herhangi bir taşerona bağlı personel
        if (!p.taseronId && (!p.taseron || p.taseron.trim() === '')) return false;
      } else if (selectedStaffType !== 'all') {
        // Belirli bir taşeron seçilmişse
        if (p.taseronId !== selectedStaffType && p.taseron !== selectedStaffType) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${p.isim} ${p.soyisim}`.toLowerCase();
        const tc = (p.TCNO || '').toLowerCase();
        const cat = (p.kategori || '').toLowerCase();
        if (!fullName.includes(q) && !tc.includes(q) && !cat.includes(q)) return false;
      }

      return true;
    });
  }, [personnelList, selectedLocation, selectedStaffType, searchQuery]);

  // Compute calculated metrics for each personnel for the target period
  const allPersonnelRawData = useMemo(() => {
    return filteredPersonnel.map((p) => {
      const isPasif = p.durum === 'Pasif' || (p as any).durum?.toLowerCase() === 'pasif';
      const dailyHours = p.gunlukCalismaSaati || 8;
      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;

      // Hangi aylarda hesaplama yapılacak?
      // Aylık görünümde seçilen tek ay; Yıllık ve Tüm Dönemler görünümünde personelin fiilen çalıştığı her aktif ay
      const targetMonths =
        periodMode === 'monthly'
          ? (targetPrefix && targetPrefix.includes('-') ? [targetPrefix] : [])
          : getActiveMonthsForPersonnelInPeriod(
              p,
              periodMode,
              selectedYear,
              selectedMonth,
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
        // Her ay için o ay geçerli olan maaş/yevmiyeyi al (p.ucretGecmisi kademeleri dikkate alınır)
        // Böylece Eylül ayında 3000 alan personelin hesabı sıfırlandıktan sonra Ekim'de 3500'e çıktığında
        // Eylül ayı 3000 olarak sabit kalır, yıllık raporda da geriye dönük sahte borç oluşmaz!
        const mWage = getEffectiveWageForPersonnel(p, mStr);
        let mDays = 0;
        const mPua = puantajList.filter((pu) => pu.personelId === p.id && pu.tarih.startsWith(mStr));

        if (mWage.isAylik) {
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

        const mHourlyWage = mWage.effectiveYevmiye / dailyHours;
        const mMesaiAmount = mMesai * mHourlyWage * katsayi;
        mesaiTutari += mMesaiAmount;

        tabanHakedis += mDays * mWage.effectiveYevmiye;

        const { resmiGun: mResmiGun } = getEffectiveResmiGunForMonth(p, mStr, mDays);
        const mResmiKesinti = mWage.resmiMaas > 0 ? mWage.resmiMaas / 30 : 0;
        const mResmiAlacak = mResmiGun * mResmiKesinti;
        const mMonthTotalHakedis = mDays * mWage.effectiveYevmiye + mMesaiAmount;
        const mEldenHakedis = Math.max(0, mMonthTotalHakedis - mResmiAlacak);

        periodResmiAlacak += mResmiAlacak;
        periodEldenHakedis += mEldenHakedis;
      });

      // Dönem başındaki devreden eski bakiye:
      // - Aylık görünümde: Seçilen ayın başındaki (`YYYY-MM`) devreden eski bakiye
      // - Yıllık görünümde: Seçilen yılın başındaki (`YYYY-01`) devreden eski bakiye
      // - Tüm dönemlerde: Başlangıç eski bakiyesi (`all`)
      const periodOpeningMonth =
        periodMode === 'monthly'
          ? targetPrefix
          : periodMode === 'yearly'
          ? `${selectedYear}-01`
          : 'all';

      const eskiBakiye = getEffectiveEskiBakiyeForMonth(
        p,
        periodOpeningMonth,
        puantajList,
        mesaiList,
        odemeList,
        exchangeRates.rates,
        periodMode === 'yearly' ? `${selectedYear}` : undefined
      );

      let resmiAlacak = periodResmiAlacak;
      let eldenHakedis = periodEldenHakedis + eskiBakiye;
      let toplamHakedis = tabanHakedis + mesaiTutari + eskiBakiye;

      // Son/Geçerli ücret bilgisi (Kart / Tablo satırı başlık gösterimi için)
      const currentWageInfo = getEffectiveWageForPersonnel(
        p,
        periodMode === 'monthly' ? targetPrefix : undefined
      );
      const isAylik = currentWageInfo.isAylik;
      const aylikMaas = currentWageInfo.effectiveMaas;
      const effectiveYevmiye = currentWageInfo.effectiveYevmiye;
      const resmiMaas = currentWageInfo.resmiMaas;
      const gunlukResmiKesinti = resmiMaas > 0 ? resmiMaas / 30 : 0;
      const gunlukEldenTutar = Math.max(0, effectiveYevmiye - gunlukResmiKesinti);

      if (p.paraBirimi && p.paraBirimi !== 'TRY') {
        resmiAlacak = convertCurrencyToTRY(resmiAlacak, p.paraBirimi, exchangeRates.rates);
        eldenHakedis = convertCurrencyToTRY(eldenHakedis, p.paraBirimi, exchangeRates.rates);
        toplamHakedis = convertCurrencyToTRY(toplamHakedis, p.paraBirimi, exchangeRates.rates);
      }

      // 2. Ödemeler
      const pOdemeler = odemeList.filter((o) => {
        if (o.personelId !== p.id) return false;
        return targetPrefix ? isOdemeInBordroDonemi(o, targetPrefix) : true;
      });

      let toplamAvansTRY = 0;
      let toplamResmiTRY = 0;
      let toplamHarcamaTRY = 0;
      let toplamCezaTRY = 0;

      pOdemeler.forEach((o) => {
        const anyO = o as any;
        const cur = o.paraBirimi || 'TRY';

        // Avans (Elden)
        const avansVal =
          typeof o.avansOdemesi === 'number' && o.avansOdemesi > 0
            ? o.avansOdemesi
            : anyO.tur === 'avans' && typeof anyO.miktar === 'number'
            ? anyO.miktar
            : (o.avansOdemesi || 0);
        toplamAvansTRY += convertCurrencyToTRY(avansVal, cur, exchangeRates.rates);

        // Banka (Resmi)
        const resmiVal =
          typeof o.resmiOdeme === 'number' && o.resmiOdeme > 0
            ? o.resmiOdeme
            : anyO.tur === 'resmi' && typeof anyO.miktar === 'number'
            ? anyO.miktar
            : (o.resmiOdeme || 0);
        toplamResmiTRY += convertCurrencyToTRY(resmiVal, cur, exchangeRates.rates);

        // Harcama iadesi
        const harcamaVal = o.yaptigiHarcama || (anyO.tur === 'harcama' ? anyO.miktar : 0) || 0;
        toplamHarcamaTRY += convertCurrencyToTRY(harcamaVal, cur, exchangeRates.rates);

        // Ceza / kesinti
        const cezaVal = o.cezaMiktari || (anyO.tur === 'ceza' ? anyO.miktar : 0) || 0;
        toplamCezaTRY += convertCurrencyToTRY(cezaVal, cur, exchangeRates.rates);
      });

      const toplamOdenen = Math.round(toplamAvansTRY + toplamResmiTRY);
      const kalanResmi = Math.round(resmiAlacak - toplamResmiTRY);
      const kalanElden = Math.round((eldenHakedis + toplamHarcamaTRY) - toplamAvansTRY - toplamCezaTRY);
      const kalanBakiye = kalanResmi + kalanElden;

      // Location Label
      const isCenter = !p.santiyeId || p.santiyeId.trim() === '' || p.santiye?.toLowerCase().includes('merkez');
      const locationName = isCenter ? 'Merkez / Ofis' : p.santiye || santiyeler.find((s) => s.id === p.santiyeId)?.isim || 'Şantiye';
      const isCompanyStaff = !p.taseronId && (!p.taseron || p.taseron.trim() === '');
      const taseronName = isCompanyStaff ? 'Şirket Öz Kadrosu' : p.taseron || taseronlar.find((t) => t.id === p.taseronId)?.isim || 'Taşeron';

      return {
        personnel: p,
        isAylik,
        wageType: isAylik ? ('aylik' as const) : ('yevmiye' as const),
        aylikMaas,
        effectiveYevmiye,
        puantajGun: effectivePuantajGun,
        mesaiSaat,
        resmiMaas,
        gunlukResmiKesinti,
        gunlukEldenTutar,
        resmiAlacak: Math.round(resmiAlacak),
        eldenHakedis: Math.round(eldenHakedis),
        toplamHakedis: Math.round(toplamHakedis),
        toplamAvans: Math.round(toplamAvansTRY),
        toplamResmi: Math.round(toplamResmiTRY),
        toplamHarcama: Math.round(toplamHarcamaTRY),
        toplamCeza: Math.round(toplamCezaTRY),
        toplamOdenen,
        kalanResmi,
        kalanElden,
        kalanBakiye,
        locationName,
        isCenter,
        isCompanyStaff,
        taseronName,
        odemeler: pOdemeler,
      };
    });
  }, [filteredPersonnel, puantajList, mesaiList, odemeList, targetPrefix, periodMode, selectedYear, selectedMonth, exchangeRates.rates, santiyeler, taseronlar]);

  // Sıfır bakiyeli pasif personellerin sayısı (Kullanıcı kuralı: "pasif durumdaki personelin hesabı sıfırsa raporlar bölümde listeleme")
  const hiddenZeroPassiveCount = useMemo(() => {
    return allPersonnelRawData.filter((r) => {
      const isPasif = r.personnel.durum === 'Pasif' || (r.personnel as any).durum?.toLowerCase() === 'pasif';
      return isPasif && r.kalanBakiye === 0;
    }).length;
  }, [allPersonnelRawData]);

  // Nihai Raporlanan Personeller: Hesabı sıfır olan pasif çalışanlar filtrelenir
  const allPersonnelReportData = useMemo(() => {
    return allPersonnelRawData.filter((row) => {
      const isPasif = row.personnel.durum === 'Pasif' || (row.personnel as any).durum?.toLowerCase() === 'pasif';
      const isZeroAccount = row.kalanBakiye === 0;

      // Durum Filtresi Seçimi
      if (selectedPersonnelStatus === 'active_only') {
        return !isPasif;
      }
      if (selectedPersonnelStatus === 'passive_only') {
        return isPasif && (!hideZeroBalancePassive || !isZeroAccount);
      }
      if (selectedPersonnelStatus === 'all_with_zero') {
        return true;
      }

      // Varsayılan ('active_and_balance_passive'):
      // Pasif durumdaki personelin hesabı sıfırsa raporda listeleme!
      if (hideZeroBalancePassive && isPasif && isZeroAccount) {
        return false;
      }

      return true;
    });
  }, [allPersonnelRawData, selectedPersonnelStatus, hideZeroBalancePassive]);

  // Aylık Sabit ve Günlük Yevmiyeli Verileri
  const aylikPersonnelData = useMemo(() => allPersonnelReportData.filter((r) => r.isAylik), [allPersonnelReportData]);
  const yevmiyePersonnelData = useMemo(() => allPersonnelReportData.filter((r) => !r.isAylik), [allPersonnelReportData]);

  // Tabloda gösterilecek veri (Aktif filtreye göre)
  const personnelReportData = useMemo(() => {
    if (selectedWageType === 'aylik') return aylikPersonnelData;
    if (selectedWageType === 'yevmiye') return yevmiyePersonnelData;
    return allPersonnelReportData;
  }, [selectedWageType, aylikPersonnelData, yevmiyePersonnelData, allPersonnelReportData]);

  // Grup KPI Hesaplama Fonksiyonu
  const computeGroupKPIs = (rows: typeof allPersonnelReportData) => {
    let grandHakedis = 0;
    let grandResmiAlacak = 0;
    let grandEldenHakedis = 0;
    let grandOdenen = 0;
    let grandResmi = 0;
    let grandAvans = 0;
    let grandHarcama = 0;
    let grandCeza = 0;
    let grandKalanResmi = 0;
    let grandKalanElden = 0;
    let grandKalan = 0;
    let grandPuantajGun = 0;
    let grandMesaiSaat = 0;
    let totalBaseRate = 0;

    rows.forEach((row) => {
      grandHakedis += row.toplamHakedis;
      grandResmiAlacak += row.resmiAlacak;
      grandEldenHakedis += row.eldenHakedis;
      grandOdenen += row.toplamOdenen;
      grandResmi += row.toplamResmi;
      grandAvans += row.toplamAvans;
      grandHarcama += row.toplamHarcama;
      grandCeza += row.toplamCeza;
      grandKalanResmi += row.kalanResmi;
      grandKalanElden += row.kalanElden;
      grandKalan += row.kalanBakiye;
      grandPuantajGun += row.puantajGun;
      grandMesaiSaat += row.mesaiSaat;
      totalBaseRate += row.isAylik ? row.aylikMaas : (row.personnel.yevmiye || 0);
    });

    return {
      personCount: rows.length,
      grandHakedis,
      grandResmiAlacak,
      grandEldenHakedis,
      grandOdenen,
      grandResmi,
      grandAvans,
      grandHarcama,
      grandCeza,
      grandKalanResmi,
      grandKalanElden,
      grandKalan,
      grandPuantajGun,
      grandMesaiSaat,
      avgBaseRate: rows.length > 0 ? Math.round(totalBaseRate / rows.length) : 0,
    };
  };

  // Aktif filtrelenmiş KPI'lar
  const kpis = useMemo(() => computeGroupKPIs(personnelReportData), [personnelReportData]);

  // Aylık Sabit Personel İstatistikleri (Karşılaştırmalı panel için)
  const aylikStats = useMemo(() => computeGroupKPIs(aylikPersonnelData), [aylikPersonnelData]);

  // Günlük Yevmiyeli Personel İstatistikleri (Karşılaştırmalı panel için)
  const yevmiyeStats = useMemo(() => computeGroupKPIs(yevmiyePersonnelData), [yevmiyePersonnelData]);

  // Grouping by location (Merkez vs Sites)
  const locationBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; hakedis: number; odenen: number; kalan: number }>();
    
    personnelReportData.forEach((row) => {
      const loc = row.locationName;
      const current = map.get(loc) || { name: loc, count: 0, hakedis: 0, odenen: 0, kalan: 0 };
      current.count += 1;
      current.hakedis += row.toplamHakedis;
      current.odenen += row.toplamOdenen;
      current.kalan += row.kalanBakiye;
      map.set(loc, current);
    });

    return Array.from(map.values()).sort((a, b) => b.odenen - a.odenen);
  }, [personnelReportData]);

  // Export options
  const exportOptions: ExportOptions = useMemo(() => {
    const periodLabel =
      periodMode === 'all'
        ? 'Tüm Dönemler'
        : periodMode === 'yearly'
        ? `${selectedYear} Yılı Genel`
        : `${monthNames.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`;

    const wageTypeLabel =
      selectedWageType === 'all'
        ? 'Tüm Çalışanlar (Aylık Sabit + Günlük Yevmiyeli)'
        : selectedWageType === 'aylik'
        ? 'Yalnızca Aylık Sabit Ücretliler'
        : 'Yalnızca Günlük Yevmiyeliler';

    return {
      title: 'Personel Ödemeleri ve Hakediş Analiz Raporu',
      subtitle: `Dönem: ${periodLabel} | Ücret Modeli: ${wageTypeLabel} | Lokasyon: ${
        selectedLocation === 'all' ? 'Tümü' : selectedLocation === 'center' ? 'Merkez Ofis (Şantiye Harici)' : 'Seçili Şantiye'
      } | Kadro: ${selectedStaffType === 'all' ? 'Tümü' : selectedStaffType === 'company' ? 'Şirket Kadrosu' : 'Taşeron'}`,
      filename: `Personel_Odemeleri_${selectedWageType}_${periodLabel.replace(/\s+/g, '_')}`,
      columns: [
        { header: '#', dataKey: '__index', width: 25 },
        { header: 'Personel Adı Soyadı', dataKey: 'fullName' },
        { header: 'Ücret Modeli', dataKey: 'wageType' },
        { header: 'Birim Ücret / Maaş', dataKey: 'baseRate', align: 'right' },
        { header: 'Meslek / Görev', dataKey: 'kategori' },
        { header: 'Çalışma Yeri', dataKey: 'location' },
        { header: 'Kadro / Taşeron', dataKey: 'staffType' },
        { header: 'Puantaj Gün', dataKey: 'puantajGun', align: 'center' },
        { header: 'Mesai (Saat)', dataKey: 'mesaiSaat', align: 'center' },
        { header: 'Toplam Hakediş (TL)', dataKey: 'hakedis', align: 'right' },
        { header: 'Banka (Resmi) Ödeme', dataKey: 'resmiOdeme', align: 'right' },
        { header: 'Kalan Resmi Alacak', dataKey: 'kalanResmi', align: 'right' },
        { header: 'Elden (Avans) Ödeme', dataKey: 'avansOdeme', align: 'right' },
        { header: 'Kalan Elden Alacak', dataKey: 'kalanElden', align: 'right' },
        { header: 'Toplam Ödenen', dataKey: 'toplamOdenen', align: 'right' },
        { header: 'Net Kalan Alacak', dataKey: 'kalanBakiye', align: 'right' },
      ],
      data: personnelReportData.map((row) => ({
        fullName: `${row.personnel.isim} ${row.personnel.soyisim}`,
        wageType: row.isAylik ? 'Aylık Sabit Maaşlı' : 'Günlük Yevmiyeli',
        baseRate: row.isAylik ? `${formatCurrency(row.aylikMaas, 'TRY')}/ay` : `${formatCurrency(row.personnel.yevmiye, 'TRY')}/gün`,
        kategori: row.personnel.kategori || 'Genel Personel',
        location: row.locationName,
        staffType: row.taseronName,
        puantajGun: row.puantajGun.toFixed(1),
        mesaiSaat: row.mesaiSaat.toFixed(1),
        hakedis: formatCurrency(row.toplamHakedis, 'TRY'),
        resmiOdeme: formatCurrency(row.toplamResmi, 'TRY'),
        kalanResmi: formatCurrency(row.kalanResmi, 'TRY'),
        avansOdeme: formatCurrency(row.toplamAvans, 'TRY'),
        kalanElden: formatCurrency(row.kalanElden, 'TRY'),
        toplamOdenen: formatCurrency(row.toplamOdenen, 'TRY'),
        kalanBakiye: formatCurrency(row.kalanBakiye, 'TRY'),
      })),
      summaryRows: [
        { label: 'Raporlanan Personel Sayısı', value: `${kpis.personCount} Kişi` },
        { label: 'Aylık Sabit Personel Sayısı', value: `${aylikStats.personCount} Kişi` },
        { label: 'Aylık Sabit Toplam Hakediş', value: formatCurrency(aylikStats.grandHakedis, 'TRY') },
        { label: 'Aylık Sabit Kalan Alacak', value: formatCurrency(aylikStats.grandKalan, 'TRY') },
        { label: 'Günlük Yevmiyeli Personel Sayısı', value: `${yevmiyeStats.personCount} Kişi` },
        { label: 'Günlük Yevmiyeli Toplam Hakediş', value: formatCurrency(yevmiyeStats.grandHakedis, 'TRY') },
        { label: 'Günlük Yevmiyeli Kalan Alacak', value: formatCurrency(yevmiyeStats.grandKalan, 'TRY') },
        { label: 'Toplam Puantaj Günü', value: `${kpis.grandPuantajGun.toFixed(1)} Gün` },
        { label: 'Toplam Fazla Mesai', value: `${kpis.grandMesaiSaat.toFixed(1)} Saat` },
        { label: 'Toplam Tahakkuk Eden Hakediş', value: formatCurrency(kpis.grandHakedis, 'TRY') },
        { label: 'Toplam Banka (Resmi) Ödemeleri', value: formatCurrency(kpis.grandResmi, 'TRY') },
        { label: 'Toplam Elden (Avans) Ödemeleri', value: formatCurrency(kpis.grandAvans, 'TRY') },
        { label: 'Toplam Yapılan Personel Ödemesi', value: formatCurrency(kpis.grandOdenen, 'TRY') },
        { label: 'Kalan Banka (Resmi) Alacağı', value: formatCurrency(kpis.grandKalanResmi, 'TRY') },
        { label: 'Kalan Elden Alacağı', value: formatCurrency(kpis.grandKalanElden, 'TRY') },
        { label: 'Toplam Kalan Personel Alacağı', value: formatCurrency(kpis.grandKalan, 'TRY') },
      ],
      orientation: 'landscape',
    };
  }, [personnelReportData, kpis, aylikStats, yevmiyeStats, periodMode, selectedYear, selectedMonth, selectedWageType, selectedLocation, selectedStaffType, monthNames]);

  return (
    <div className="space-y-6">
      {/* FILTER CONTROLS BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Personel Ödemeleri ve Hakediş Analizi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aylık veya yıllık bazda; Merkez Ofis, Şantiyeler ve Taşeron personellerinin ödeme ve hakediş dökümü
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton options={exportOptions} buttonText="Raporu Dışa Aktar" variant="primary" />
          </div>
        </div>

        {/* Quick Wage Type Segment Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Ücret Modeli:
            </span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedWageType('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedWageType === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tüm Personeller ({allPersonnelReportData.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedWageType('aylik')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedWageType === 'aylik'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Aylık Sabit Ücretliler ({aylikStats.personCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedWageType('yevmiye')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedWageType === 'yevmiye'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <HardHat className="w-3.5 h-3.5" />
                Günlük Yevmiyeliler ({yevmiyeStats.personCount})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {selectedWageType === 'all' ? (
              <span className="text-slate-600">
                Hem <strong className="text-blue-700 font-semibold">Aylık Sabit ({aylikStats.personCount})</strong> hem <strong className="text-emerald-700 font-semibold">Günlük Yevmiyeli ({yevmiyeStats.personCount})</strong> personel listeleniyor
              </span>
            ) : selectedWageType === 'aylik' ? (
              <span className="text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                ✓ Yalnızca Aylık Sabit Ücretli Kadro ({aylikStats.personCount} Kişi) İnceleniyor
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                ✓ Yalnızca Günlük Yevmiyeli Saha Personeli ({yevmiyeStats.personCount} Kişi) İnceleniyor
              </span>
            )}

            {/* Quick Toggle: Sıfır Bakiyeli Pasifleri Gizle */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer select-none text-xs font-semibold text-slate-700 shadow-2xs transition-colors">
              <input
                type="checkbox"
                checked={hideZeroBalancePassive}
                onChange={(e) => setHideZeroBalancePassive(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Sıfır Bakiyeli Pasifleri Gizle</span>
              {hiddenZeroPassiveCount > 0 && hideZeroBalancePassive && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {hiddenZeroPassiveCount} gizlendi
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* 1. Period Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Dönem Türü
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriodMode('monthly')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodMode === 'monthly'
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aylık
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('yearly')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodMode === 'yearly'
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yıllık
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('all')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodMode === 'all'
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tümü
              </button>
            </div>
          </div>

          {/* 2. Month & Year Selectors */}
          <div className="flex items-end gap-2">
            {periodMode === 'monthly' && (
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Ay
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {monthNames.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {periodMode !== 'all' && (
              <div className={periodMode === 'monthly' ? 'w-24' : 'w-full'}>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Yıl
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Personnel Status Filter (Kullanıcı Kuralı: Pasif & Sıfır bakiye) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Personel Durumu
            </label>
            <select
              value={selectedPersonnelStatus}
              onChange={(e) => setSelectedPersonnelStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active_and_balance_passive">
                👥 Aktifler + Bakiyeli Pasifler
              </option>
              <option value="active_only">
                🟢 Yalnızca Aktif Personeller
              </option>
              <option value="passive_only">
                🟡 Yalnızca Bakiyesi Olan Pasifler
              </option>
              <option value="all_with_zero">
                📋 Tüm Personeller (Sıfır Bakiyeli Pasifler Dahil)
              </option>
            </select>
          </div>

          {/* 4. Wage Type Dropdown Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Ücret Modeli Filtresi
            </label>
            <select
              value={selectedWageType}
              onChange={(e) => setSelectedWageType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">👥 Tüm Çalışanlar ({allPersonnelReportData.length})</option>
              <option value="aylik" className="font-bold text-blue-700 bg-blue-50/50">
                💼 Aylık Sabit Ücretli ({aylikStats.personCount})
              </option>
              <option value="yevmiye" className="font-bold text-emerald-700 bg-emerald-50/50">
                👷 Günlük Yevmiyeli ({yevmiyeStats.personCount})
              </option>
            </select>
          </div>

          {/* 4. Location / Şantiye Filter (With Dedicated Center option!) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Çalışma Yeri / Şantiye
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">📍 Tüm Lokasyonlar</option>
              <option value="center" className="font-bold text-indigo-700 bg-indigo-50/50">
                🏢 Merkez / Ofis Personeli (Şantiye Harici)
              </option>
              <optgroup label="Şantiyeler">
                {santiyeler.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏗️ {s.isim}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 5. Staff / Subcontractor Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Kadro / Taşeron Durumu
            </label>
            <select
              value={selectedStaffType}
              onChange={(e) => setSelectedStaffType(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">👥 Tüm Çalışanlar</option>
              <option value="company" className="font-bold text-emerald-700 bg-emerald-50/50">
                👷‍♂️ Şirket Öz Kadrosu (Taşeron Harici)
              </option>
              <option value="subcontractor" className="font-bold text-amber-700 bg-amber-50/50">
                🏗️ Tüm Taşeron Personelleri
              </option>
              {taseronlar.length > 0 && (
                <optgroup label="Belirli Taşeron">
                  {taseronlar.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.isim} Ekibi
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 6. Search Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Personel Ara
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="İsim, TC No, meslek..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Applied Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">Aktif Filtreler:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Calendar className="w-3 h-3" />
            {periodMode === 'all'
              ? 'Tüm Dönemler'
              : periodMode === 'yearly'
              ? `${selectedYear} Yılı`
              : `${monthNames.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`}
          </span>
          {selectedWageType === 'aylik' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
              <Briefcase className="w-3 h-3 text-blue-600" />
              Aylık Sabit Kadro ({aylikStats.personCount} Kişi)
            </span>
          ) : selectedWageType === 'yevmiye' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <HardHat className="w-3 h-3 text-emerald-600" />
              Günlük Yevmiyeli Saha ({yevmiyeStats.personCount} Kişi)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Tüm Ücret Türleri ({allPersonnelReportData.length} Kişi)
            </span>
          )}
          {selectedLocation === 'center' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <Building2 className="w-3 h-3" />
              Merkez Ofis (Şantiye Harici)
            </span>
          ) : selectedLocation !== 'all' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
              <HardHat className="w-3 h-3" />
              {santiyeler.find((s) => s.id === selectedLocation)?.isim || 'Seçili Şantiye'}
            </span>
          ) : null}

          {selectedStaffType === 'company' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Şirket Öz Kadrosu
            </span>
          ) : selectedStaffType === 'subcontractor' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Taşeron Personelleri
            </span>
          ) : selectedStaffType !== 'all' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
              {taseronlar.find((t) => t.id === selectedStaffType)?.isim || 'Seçili Taşeron'}
            </span>
          ) : null}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Hakediş */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Hakediş</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatCurrency(kpis.grandHakedis, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{kpis.personCount} Personel</span>
            <span className="text-indigo-600 font-semibold">{kpis.grandPuantajGun.toFixed(0)} Gün Puantaj</span>
          </div>
        </div>

        {/* Toplam Ödenen */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Toplam Yapılan Ödeme</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatCurrency(kpis.grandOdenen, 'TRY')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Banka: {formatCurrency(kpis.grandResmi, 'TRY')}</span>
            <span>Elden: {formatCurrency(kpis.grandAvans, 'TRY')}</span>
          </div>
        </div>

        {/* Kalan Net Bakiye & Kırılımı */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kalan Personel Alacağı
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${kpis.grandKalan > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatCurrency(kpis.grandKalan, 'TRY')}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {kpis.grandKalan > 0 ? 'Ödenmesi gereken net toplam bakiye' : 'Tüm hakedişler ödendi'}
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between bg-indigo-50/60 px-2 py-1 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-indigo-950 text-[11px]">Resmi (Banka):</span>
              </div>
              <div className="text-right">
                <span className="font-bold font-mono text-indigo-700 text-xs">
                  {formatCurrency(kpis.grandKalanResmi, 'TRY')}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  (Öd: {formatCurrency(kpis.grandResmi, 'TRY')})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-amber-50/60 px-2 py-1 rounded-lg border border-amber-100">
              <div className="flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-amber-700" />
                <span className="font-semibold text-amber-950 text-[11px]">Elden (Avans):</span>
              </div>
              <div className="text-right">
                <span className="font-bold font-mono text-amber-800 text-xs">
                  {formatCurrency(kpis.grandKalanElden, 'TRY')}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">
                  (Öd: {formatCurrency(kpis.grandAvans, 'TRY')})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fazla Mesai & Kesintiler */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Fazla Mesai & Kesintiler</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {kpis.grandMesaiSaat.toFixed(1)} <span className="text-xs font-normal text-slate-500">Saat Mesai</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Harcama: {formatCurrency(kpis.grandHarcama, 'TRY')}</span>
            <span>Ceza/Kesinti: {formatCurrency(kpis.grandCeza, 'TRY')}</span>
          </div>
        </div>
      </div>

      {/* AYLIK SABİT VS GÜNLÜK YEVMİYELİ AYRI ANALİZ VE KARŞILAŞTIRMA PANOLARI */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Aylık Sabit Ücretli ve Günlük Yevmiyeli Personel Ayrı Analizi</span>
            </h4>
            <p className="text-xs text-slate-500">
              Maaşlı ofis/sabit kadro ile yevmiyeli saha çalışanlarının hakediş, yapılan ödeme ve kalan borç/alacak karşılaştırması
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              {aylikStats.personCount} Aylık Sabit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              {yevmiyeStats.personCount} Günlük Yevmiyeli
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. AYLIK SABİT ÜCRETLİLER KARTI */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              selectedWageType === 'aylik'
                ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:border-blue-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Aylık Sabit Ücretliler</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                      {aylikStats.personCount} Kişi
                    </span>
                  </h5>
                  <p className="text-[11px] text-slate-500">Mühendis, şef, mimar, muhasebe & idari sabit maaşlı kadro</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWageType(selectedWageType === 'aylik' ? 'all' : 'aylik')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  selectedWageType === 'aylik'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                }`}
              >
                {selectedWageType === 'aylik' ? '✓ Listeleniyor' : 'Yalnızca Bunu Listele →'}
              </button>
            </div>

            {/* Rakamlar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ortalama Maaş</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {formatCurrency(aylikStats.avgBaseRate, 'TRY')}/ay
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam Hakediş</span>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatCurrency(aylikStats.grandHakedis, 'TRY')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Yapılan Ödeme</span>
                <span className="text-xs font-bold text-emerald-600 font-mono">
                  {formatCurrency(aylikStats.grandOdenen, 'TRY')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Kalan Alacak</span>
                <span className={`text-xs font-black font-mono ${aylikStats.grandKalan > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {formatCurrency(aylikStats.grandKalan, 'TRY')}
                </span>
              </div>
            </div>

            {/* Banka ve Elden Kırılımı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-semibold text-indigo-950">Resmi Banka:</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-indigo-700 text-xs">
                    Kalan: {formatCurrency(aylikStats.grandKalanResmi, 'TRY')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hak: {formatCurrency(aylikStats.grandResmiAlacak, 'TRY')} | Öd: {formatCurrency(aylikStats.grandResmi, 'TRY')}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[11px] font-semibold text-amber-950">Elden (Avans):</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-amber-800 text-xs">
                    Kalan: {formatCurrency(aylikStats.grandKalanElden, 'TRY')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hak: {formatCurrency(aylikStats.grandEldenHakedis, 'TRY')} | Öd: {formatCurrency(aylikStats.grandAvans, 'TRY')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. GÜNLÜK YEVMİYELİLER KARTI */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              selectedWageType === 'yevmiye'
                ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Günlük Yevmiyeliler</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {yevmiyeStats.personCount} Kişi
                    </span>
                  </h5>
                  <p className="text-[11px] text-slate-500">Puantaj günü ve mesai saatine göre saha çalışanları & ustalar</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWageType(selectedWageType === 'yevmiye' ? 'all' : 'yevmiye')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  selectedWageType === 'yevmiye'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                {selectedWageType === 'yevmiye' ? '✓ Listeleniyor' : 'Yalnızca Bunu Listele →'}
              </button>
            </div>

            {/* Rakamlar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ortalama Yevmiye</span>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {formatCurrency(yevmiyeStats.avgBaseRate, 'TRY')}/gün
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Toplam Hakediş</span>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatCurrency(yevmiyeStats.grandHakedis, 'TRY')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Yapılan Ödeme</span>
                <span className="text-xs font-bold text-emerald-600 font-mono">
                  {formatCurrency(yevmiyeStats.grandOdenen, 'TRY')}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Kalan Alacak</span>
                <span className={`text-xs font-black font-mono ${yevmiyeStats.grandKalan > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {formatCurrency(yevmiyeStats.grandKalan, 'TRY')}
                </span>
              </div>
            </div>

            {/* Banka ve Elden Kırılımı */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-semibold text-indigo-950">Resmi Banka:</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-indigo-700 text-xs">
                    Kalan: {formatCurrency(yevmiyeStats.grandKalanResmi, 'TRY')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hak: {formatCurrency(yevmiyeStats.grandResmiAlacak, 'TRY')} | Öd: {formatCurrency(yevmiyeStats.grandResmi, 'TRY')}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-[11px] font-semibold text-amber-950">Elden (Avans):</span>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-amber-800 text-xs">
                    Kalan: {formatCurrency(yevmiyeStats.grandKalanElden, 'TRY')}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hak: {formatCurrency(yevmiyeStats.grandEldenHakedis, 'TRY')} | Öd: {formatCurrency(yevmiyeStats.grandAvans, 'TRY')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LOCATION SUMMARY PILLS */}
      {locationBreakdown.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <span>Lokasyon Bazında Ödeme Dağılımı (Merkez vs Şantiyeler)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {locationBreakdown.map((loc) => {
              const odenenRate = loc.hakedis > 0 ? Math.min(100, Math.round((loc.odenen / loc.hakedis) * 100)) : 0;
              const isCenter = loc.name.includes('Merkez') || loc.name.includes('Ofis');
              return (
                <div
                  key={loc.name}
                  className={`p-3 rounded-xl border ${
                    isCenter ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                    <span className="truncate" title={loc.name}>
                      {loc.name}
                    </span>
                    <span className="text-[11px] text-slate-500">{loc.count} Kişi</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(loc.odenen, 'TRY')}</span>
                    <span className="text-[10px] text-slate-400">Hak: {formatCurrency(loc.hakedis, 'TRY')}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isCenter ? 'bg-indigo-600' : 'bg-emerald-500'}`}
                      style={{ width: `${odenenRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAILED PERSON REPORT TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Personel Hakediş & Ödeme Listesi</h4>
            <p className="text-xs text-slate-500">
              Toplam {personnelReportData.length} personel listeleniyor.
              {hiddenZeroPassiveCount > 0 && hideZeroBalancePassive && selectedPersonnelStatus !== 'all_with_zero' && (
                <span className="text-amber-700 font-semibold ml-1">
                  (Hesabı sıfır olan {hiddenZeroPassiveCount} pasif personel rapordan gizlendi)
                </span>
              )}
              {' '}Satıra tıklayarak dönem ödeme makbuzlarını inceleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 w-8 text-center">#</th>
                <th className="py-3 px-3">Personel</th>
                <th className="py-3 px-3">Çalışma Yeri</th>
                <th className="py-3 px-3">Kadro / Taşeron</th>
                <th className="py-3 px-3">Ücret Modeli</th>
                <th className="py-3 px-2 text-center">Puantaj</th>
                <th className="py-3 px-2 text-center">Mesai</th>
                <th className="py-3 px-3 text-right">Toplam Hakediş</th>
                <th className="py-3 px-3 text-right">
                  <span className="block text-indigo-950 font-bold">Banka (Resmi)</span>
                  <span className="text-[10px] font-normal text-indigo-600 block">Ödenen (Hak)</span>
                </th>
                <th className="py-3 px-3 text-right">
                  <span className="block text-amber-950 font-bold">Elden (Avans)</span>
                  <span className="text-[10px] font-normal text-amber-700 block">Ödenen (Hak)</span>
                </th>
                <th className="py-3 px-3 text-right">Toplam Ödenen</th>
                <th className="py-3 px-3 text-right">
                  <span className="block text-amber-950 font-bold">Kalan Personel Alacağı</span>
                  <span className="text-[10px] font-normal text-slate-500 block">Banka & Elden Kırılımı</span>
                </th>
                <th className="py-3 px-2 text-center w-10">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {personnelReportData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400 text-xs">
                    Filtrelere uygun personel kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                personnelReportData.map((row, idx) => {
                  const isExpanded = expandedPersonId === row.personnel.id;
                  const isPassiveStaff = row.personnel.durum === 'Pasif' || (row.personnel as any).durum?.toLowerCase() === 'pasif';
                  return (
                    <React.Fragment key={row.personnel.id}>
                      <tr
                        onClick={() => setExpandedPersonId(isExpanded ? null : row.personnel.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{row.personnel.isim} {row.personnel.soyisim}</span>
                            {isPassiveStaff && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Pasif (Bakiyeli)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{row.personnel.kategori || 'Genel Personel'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              row.isCenter
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {row.isCenter ? <Building2 className="w-3 h-3" /> : <HardHat className="w-3 h-3" />}
                            {row.locationName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              row.isCompanyStaff
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {row.taseronName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {row.isAylik ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Briefcase className="w-3 h-3" />
                                Aylık Sabit
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 font-medium">
                                {formatCurrency(row.aylikMaas, 'TRY')}/ay
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <HardHat className="w-3 h-3" />
                                Günlük Yevmiye
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 font-medium">
                                {formatCurrency(row.personnel.yevmiye || 0, 'TRY')}/gün
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-700">
                          {row.puantajGun.toFixed(1)} Gün
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-700">
                          {row.mesaiSaat > 0 ? `${row.mesaiSaat.toFixed(1)} Sa` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatCurrency(row.toplamHakedis, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-semibold text-indigo-700 font-mono">
                            {row.toplamResmi > 0 ? formatCurrency(row.toplamResmi, 'TRY') : '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Hak: {formatCurrency(row.resmiAlacak, 'TRY')}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-semibold text-amber-800 font-mono">
                            {row.toplamAvans > 0 ? formatCurrency(row.toplamAvans, 'TRY') : '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Hak: {formatCurrency(row.eldenHakedis, 'TRY')}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 font-mono">
                          {formatCurrency(row.toplamOdenen, 'TRY')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className={`font-black font-mono text-xs sm:text-sm ${row.kalanBakiye > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {formatCurrency(row.kalanBakiye, 'TRY')}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px]">
                            <span className={`px-1 py-0.5 rounded font-mono ${row.kalanResmi > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-400'}`}>
                              Banka: {formatCurrency(row.kalanResmi, 'TRY')}
                            </span>
                            <span className={`px-1 py-0.5 rounded font-mono ${row.kalanElden > 0 ? 'bg-amber-50 text-amber-800 font-bold' : 'text-slate-400'}`}>
                              Elden: {formatCurrency(row.kalanElden, 'TRY')}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expandable row: Single payment receipts & Official/Hand breakdown */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/20 border-b border-slate-200">
                          <td colSpan={13} className="p-4">
                            <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                                <span className="text-sm">
                                  {row.personnel.isim} {row.personnel.soyisim} - Hesap & Bakiye Detay Analizi
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {row.odemeler.length} Dönem İçi Hareket
                                </span>
                              </div>

                              {/* Banka & Elden Hesap Kartları */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Resmi Banka Hesabı Kartı */}
                                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                      <Landmark className="w-4 h-4 text-indigo-600" />
                                      Resmi (Banka) Hesabı
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold font-mono">
                                      Resmi Maaş: {formatCurrency(row.resmiMaas, 'TRY')}
                                    </span>
                                  </div>
                                  <div className="text-xs space-y-1 text-slate-600">
                                    <div className="flex justify-between">
                                      <span>Hak Edilen Resmi Tutar:</span>
                                      <span className="font-semibold font-mono text-slate-900">
                                        {formatCurrency(row.resmiAlacak, 'TRY')}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Bankadan Ödenen:</span>
                                      <span className="font-semibold font-mono text-emerald-600">
                                        -{formatCurrency(row.toplamResmi, 'TRY')}
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1.5 border-t border-indigo-200 font-bold text-indigo-950">
                                      <span>Kalan Banka (Resmi) Alacağı:</span>
                                      <span className="font-mono text-indigo-700 text-sm">
                                        {formatCurrency(row.kalanResmi, 'TRY')}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Elden Avans Hesabı Kartı */}
                                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                      <Banknote className="w-4 h-4 text-amber-700" />
                                      Elden (Nakit/Avans) Hesabı
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold font-mono">
                                      Günlük Elden: {formatCurrency(row.gunlukEldenTutar, 'TRY')}
                                    </span>
                                  </div>
                                  <div className="text-xs space-y-1 text-slate-600">
                                    <div className="flex justify-between">
                                      <span>Hak Edilen Elden Hakediş:</span>
                                      <span className="font-semibold font-mono text-slate-900">
                                        {formatCurrency(row.eldenHakedis, 'TRY')}
                                      </span>
                                    </div>
                                    {row.toplamHarcama > 0 && (
                                      <div className="flex justify-between text-emerald-600 font-medium">
                                        <span>Personel Harcama İadesi (+):</span>
                                        <span className="font-semibold font-mono">
                                          +{formatCurrency(row.toplamHarcama, 'TRY')}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span>Elden Çekilen Avanslar:</span>
                                      <span className="font-semibold font-mono text-amber-800">
                                        -{formatCurrency(row.toplamAvans, 'TRY')}
                                      </span>
                                    </div>
                                    {row.toplamCeza > 0 && (
                                      <div className="flex justify-between text-rose-600 font-medium">
                                        <span>Ceza & Kesintiler (-):</span>
                                        <span className="font-semibold font-mono">
                                          -{formatCurrency(row.toplamCeza, 'TRY')}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between pt-1.5 border-t border-amber-200 font-bold text-amber-950">
                                      <span>Kalan Elden Alacak:</span>
                                      <span className="font-mono text-amber-800 text-sm">
                                        {formatCurrency(row.kalanElden, 'TRY')}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Net Genel Alacak Kartı */}
                                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between space-y-2">
                                  <div>
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                      Net Toplam Kalan Alacak
                                    </span>
                                    <div className={`text-2xl font-black font-mono mt-1 ${row.kalanBakiye > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                                      {formatCurrency(row.kalanBakiye, 'TRY')}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      Banka: <strong className="text-indigo-700">{formatCurrency(row.kalanResmi, 'TRY')}</strong> + Elden: <strong className="text-amber-800">{formatCurrency(row.kalanElden, 'TRY')}</strong>
                                    </p>
                                  </div>
                                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Puantaj: {row.puantajGun.toFixed(1)} Gün</span>
                                    <span>Mesai: {row.mesaiSaat.toFixed(1)} Saat</span>
                                  </div>
                                </div>
                              </div>

                              {/* Dönem İçi Ödeme Makbuzları / Fişleri */}
                              <div className="pt-2">
                                <h5 className="text-xs font-bold text-slate-700 mb-2">Dönem İçi Ödeme Fişleri & Makbuzlar</h5>
                                {row.odemeler.length === 0 ? (
                                  <div className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                                    Bu dönemde personele ait kayıtlı nakit veya banka ödemesi bulunmuyor.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {row.odemeler.map((odm) => {
                                      const anyO = odm as any;
                                      const amount = odm.avansOdemesi || odm.resmiOdeme || anyO.miktar || 0;
                                      const isBanka = Boolean(odm.resmiOdeme || anyO.tur === 'resmi');
                                      return (
                                        <div
                                          key={odm.id}
                                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-1"
                                        >
                                          <div className="flex items-center justify-between font-semibold">
                                            <span className="text-slate-600">{odm.tarih}</span>
                                            <span className={isBanka ? 'text-indigo-600 font-bold font-mono' : 'text-emerald-600 font-bold font-mono'}>
                                              {formatCurrency(amount, odm.paraBirimi || 'TRY')}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>{odm.odemeYontemi || (isBanka ? 'Banka Transferi' : 'Elden Avans')}</span>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${isBanka ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'}`}>
                                              {isBanka ? 'Resmi' : 'Avans'}
                                            </span>
                                          </div>
                                          {odm.aciklama && (
                                            <div className="text-[10px] text-slate-600 italic truncate">
                                              {odm.aciklama}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {personnelReportData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3 px-3 text-right font-bold">
                    {selectedWageType === 'aylik'
                      ? `AYLIK SABİT KADRO TOPLAMI (${kpis.personCount} Kişi):`
                      : selectedWageType === 'yevmiye'
                      ? `GÜNLÜK YEVMİYELİ SAHA TOPLAMI (${kpis.personCount} Kişi):`
                      : `GENEL TOPLAM (${kpis.personCount} Kişi):`}
                  </td>
                  <td className="py-3 px-2 text-center">{kpis.grandPuantajGun.toFixed(1)} Gün</td>
                  <td className="py-3 px-2 text-center">{kpis.grandMesaiSaat.toFixed(1)} Sa</td>
                  <td className="py-3 px-3 text-right font-mono">{formatCurrency(kpis.grandHakedis, 'TRY')}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="text-indigo-700 font-mono">{formatCurrency(kpis.grandResmi, 'TRY')}</div>
                    <div className="text-[10px] font-normal text-slate-500 font-mono">Hak: {formatCurrency(kpis.grandResmiAlacak, 'TRY')}</div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="text-amber-800 font-mono">{formatCurrency(kpis.grandAvans, 'TRY')}</div>
                    <div className="text-[10px] font-normal text-slate-500 font-mono">Hak: {formatCurrency(kpis.grandEldenHakedis, 'TRY')}</div>
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-mono">{formatCurrency(kpis.grandOdenen, 'TRY')}</td>
                  <td className="py-3 px-3 text-right">
                    <div className="text-amber-700 font-black text-sm font-mono">{formatCurrency(kpis.grandKalan, 'TRY')}</div>
                    <div className="text-[10px] font-semibold text-slate-600 space-x-1 font-mono">
                      <span className="text-indigo-700">Banka: {formatCurrency(kpis.grandKalanResmi, 'TRY')}</span>
                      <span>|</span>
                      <span className="text-amber-800">Elden: {formatCurrency(kpis.grandKalanElden, 'TRY')}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
