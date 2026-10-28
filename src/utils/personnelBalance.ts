import { Personnel, Puantaj, Mesai, PersonelOdeme, PersonelUcretGecmisi, CALISMA_DURUMU_CONFIG } from '../types';
import { convertCurrencyToTRY, getSavedExchangeRates } from './currencyStore';

export interface EffectiveWageInfo {
  effectiveYevmiye: number;
  effectiveMaas: number;
  isAylik: boolean;
  resmiMaas: number;
  dailyHours: number;
  mesaiKatsayisi: number;
  ucretTipi: 'yevmiye' | 'aylik';
}

/**
 * Belirli bir dönem (YYYY-MM) veya tarih (YYYY-MM-DD) için personelin geçerli ücretini döndürür.
 * 
 * Mantık:
 * - Personelin `p.ucretGecmisi` kademe kayıtları varsa:
 *   Hedef ay (`targetMonthOrDate.slice(0, 7)`) ile karşılaştırılır.
 *   `gecerlilikBaslangic <= targetMonth` koşulunu sağlayan en güncel ücret kademesi seçilir.
 *   Eğer hedef ay tüm kademelerden eskiyse, en eski tanımlı kademe kullanılır.
 * - `ucretGecmisi` yoksa personelin mevcut `p.yevmiye`, `p.maas` ve `p.resmiMaas` değerleri kullanılır.
 * 
 * Böylece:
 * Eylül ayında 3.000 ₺ alan bir personelin hesabı sıfırlandıktan sonra Ekim ayında 3.500 ₺'ye çıkarıldığında:
 * - Eylül ayı hesaplamaları için 3.000 ₺ geçerli olur ve Eylül alacağı sıfır kalır, bozulmaz.
 * - Ekim ve sonraki aylar için 3.500 ₺ geçerli olur!
 */
export const getEffectiveWageForPersonnel = (
  p: Personnel,
  targetMonthOrDate?: string
): EffectiveWageInfo => {
  const dailyHours = p.gunlukCalismaSaati || 8;
  const mesaiKatsayisi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;

  // Temel varsayılan değerler
  let ucretTipi: 'yevmiye' | 'aylik' =
    p.ucretTipi || (p.maas && (!p.yevmiye || p.yevmiye === 0) ? 'aylik' : 'yevmiye');
  let yevmiye = Number(p.yevmiye) || 0;
  let maas = Number(p.maas) || (yevmiye > 0 ? yevmiye * 30 : 0);
  let resmiMaas = p.resmiMaas !== undefined ? Number(p.resmiMaas) : 28075.5;

  if (targetMonthOrDate && targetMonthOrDate !== 'all' && Array.isArray(p.ucretGecmisi) && p.ucretGecmisi.length > 0) {
    const targetMonth = targetMonthOrDate.slice(0, 7); // YYYY-MM
    // Tarihçeyi başlangıç ayına göre artan sırala
    const sortedHistory = [...p.ucretGecmisi].sort((a, b) =>
      (a.gecerlilikBaslangic || '').localeCompare(b.gecerlilikBaslangic || '')
    );

    // targetMonth'a eşit veya targetMonth'tan önceki en son kaydı bul
    const applicableEntries = sortedHistory.filter(
      (entry) => (entry.gecerlilikBaslangic || '').slice(0, 7) <= targetMonth
    );

    if (applicableEntries.length > 0) {
      const activeEntry = applicableEntries[applicableEntries.length - 1];
      if (activeEntry.ucretTipi) ucretTipi = activeEntry.ucretTipi;
      yevmiye = Number(activeEntry.yevmiye) || 0;
      maas = Number(activeEntry.maas) || (yevmiye > 0 ? yevmiye * 30 : 0);
      if (activeEntry.resmiMaas !== undefined) {
        resmiMaas = Number(activeEntry.resmiMaas);
      }
    } else {
      // Hedef ay tüm geçmiş kayıtlarından da eskiyse, en eski kademeyi uygula
      const oldestEntry = sortedHistory[0];
      if (oldestEntry) {
        if (oldestEntry.ucretTipi) ucretTipi = oldestEntry.ucretTipi;
        yevmiye = Number(oldestEntry.yevmiye) || 0;
        maas = Number(oldestEntry.maas) || (yevmiye > 0 ? yevmiye * 30 : 0);
        if (oldestEntry.resmiMaas !== undefined) {
          resmiMaas = Number(oldestEntry.resmiMaas);
        }
      }
    }
  }

  const isAylik = ucretTipi === 'aylik' || Boolean(!p.ucretTipi && maas > 0 && (!yevmiye || yevmiye === 0));
  const effectiveMaas = isAylik ? (maas || yevmiye * 30) : (maas || yevmiye * 30);
  const effectiveYevmiye = isAylik
    ? (effectiveMaas > 0 ? effectiveMaas / 30 : yevmiye)
    : yevmiye;

  return {
    effectiveYevmiye,
    effectiveMaas,
    isAylik,
    resmiMaas,
    dailyHours,
    mesaiKatsayisi,
    ucretTipi,
  };
};

/**
 * Belirli bir ay için personelin resmi çalışma gün sayısını döndürür.
 * Eğer o ay için manuel bir resmi gün girilmişse (`p.aylikResmiGunler[month]`), o değer kullanılır.
 * Girilmemişse varsayılan olarak efektif puantaj gün sayısı döner.
 */
export const getEffectiveResmiGunForMonth = (
  p: Personnel,
  month: string,
  defaultPuantajGun: number
): { resmiGun: number; isManual: boolean } => {
  if (
    p.aylikResmiGunler &&
    typeof p.aylikResmiGunler[month] === 'number' &&
    !isNaN(p.aylikResmiGunler[month])
  ) {
    return {
      resmiGun: Math.max(0, p.aylikResmiGunler[month]),
      isManual: true,
    };
  }
  return {
    resmiGun: defaultPuantajGun,
    isManual: false,
  };
};

/**
 * Bir ayın (YYYY-MM) içinde bulunduğumuz cari aydan ileri bir tarih olup olmadığını döndürür.
 * Örn: Bugün 2026-10 ise 2026-11, 2026-12, 2027-01 ileri tarihli aylardır.
 */
export const isFutureMonth = (monthStr: string): boolean => {
  if (!monthStr || monthStr.length < 7) return false;
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthStr.slice(0, 7) > currentMonthStr;
};

/**
 * Belirli bir personelin belirli bir aydaki (YYYY-MM) efektif puantaj gün sayısını hesaplar.
 * Aylık sabit çalışanlarda:
 * - İçinde bulunulan ve geçmiş aylarda (Pasif değilse) girilmeyen günler tam gün (30 gün bazında) kabul edilir.
 * - İleri tarihli aylarda (Kasım, Aralık, 2027 Ocak vb.) puantaj otomatik doldurulmaz (boş gelir);
 *   ancak "Maaşlıları Doldur" butonuna basıldığında (veya günler Tam Gün işaretlendiğinde) 30 gün bazında tahakkuk eder.
 */
export const calculateEffectivePuantajGunForMonth = (
  p: Personnel,
  month: string,
  puantajList: Puantaj[]
): number => {
  const wageInfo = getEffectiveWageForPersonnel(p, month);
  const isAylik = wageInfo.isAylik;

  const puaRecords = puantajList.filter(
    (pu) => pu.personelId === p.id && pu.tarih.startsWith(month)
  );

  let puantajGun = 0;
  puaRecords.forEach((pu) => {
    if (pu.calismaDurumu === 'Resmi Tatil') {
      puantajGun += 1;
    } else {
      puantajGun += CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0;
    }
  });

  const isPasif = p.durum === 'Pasif' || (p as any).durum?.toLowerCase() === 'pasif';

  if (isAylik && !isPasif) {
    const [pYear, pMonth] = month.split('-').map(Number);
    if (!pYear || !pMonth) return puantajGun;
    const daysInSelectedMonth = new Date(pYear, pMonth, 0).getDate();

    // Kullanıcı kararı: "Puantaj kaydı olmayan aylarda hakediş 0 TL olsun. Yalnızca puantaj matrisinde işaretleme yapılmışsa hakediş oluşsun."
    // İlgili ayda personelin hiçbir puantaj kaydı yoksa (veya tüm kayıtlar Boş ise), hakediş 0 gün döner.
    const nonBlankRecords = puaRecords.filter((pu) => pu && pu.calismaDurumu && pu.calismaDurumu !== 'Boş');
    if (nonBlankRecords.length === 0) {
      return 0;
    }

    let recordedDays = 0;
    let explicitlyFilledCount = 0;
    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const dStr = `${month}-${String(day).padStart(2, '0')}`;
      const record = puaRecords.find((pu) => pu.tarih === dStr);
      if (record && record.calismaDurumu !== 'Boş') {
        explicitlyFilledCount++;
        if (record.calismaDurumu === 'Resmi Tatil') {
          recordedDays += 1;
        } else {
          recordedDays += CALISMA_DURUMU_CONFIG[record.calismaDurumu]?.katsayi || 0;
        }
      }
    }

    if (explicitlyFilledCount === 0) return 0;

    // Eğer ayın tamamı doldurulmuşsa (örn. "Maaşlıları Doldur" butonu ile ya da tüm günler tek tek girilmişse)
    // standart 30 gün maaş hakedişi ve eksik gün hesabı uygulanır (31 çeken aylarda 31 yerine 30, 28 çeken aylarda 28 yerine 30 gün tam maaş)
    if (explicitlyFilledCount === daysInSelectedMonth) {
      const missedDays = daysInSelectedMonth - recordedDays;
      return Math.max(0, 30 - missedDays);
    }

    // Kısmi puantaj işaretlenmişse yalnızca fiili girilen ve katsayısı olan günler toplamı döner
    return recordedDays;
  }

  return puantajGun;
};

/**
 * Bir personelin "Eski Kalan Bakiye Tutarı"nın (p.eskiBakiye) seçilen dönemdeki (selectedMonth)
 * kalan / devreden tutarını hesaplar.
 *
 * Kural:
 * - Personelin `p.eskiBakiye` tutarı başlangıç / önceki dönemlerden devreden açılış bakiyesidir.
 * - Önceki aylarda (selectedMonth öncesi dönemlerde) yapılan ödemeler veya kesintiler ile bu eski bakiye
 *   sıfırlanmış (veya kısmen kapatılmış) ise, bir sonraki dönem (örn. Eylül'de sıfırlanan eski bakiye Ekim ayında)
 *   tekrar alacak veya elden ödeme olarak çıkmaz.
 * - Seçilen aydan önceki her ay kronolojik olarak değerlendirilir:
 *   1) Eğer eskiBakiye > 0 (Personel alacaklı) ise:
 *      Önceki ayda yapılan elden avans ödemeleri (veya toplam ödemelerin o ayki çalışmayı aşan kısmı / doğrudan eski bakiye kapaması)
 *      bu eski bakiyeyi eritir. Özellikle o ay içinde yapılan elden ödemeler (toplamAvans + toplamCeza - toplamHarcama)
 *      önce devreden eski bakiyeden (FIFO mantığıyla) veya o ayki elden hakediş mahsubundan düşülerek kalan eski bakiye bulunur.
 *      Ayrıca o ayda personelin toplam kalan elden bakiyesi 0 veya altına inmişse eski bakiye tamamen sıfırlanmış olur.
 *   2) Eğer eskiBakiye < 0 (Personel avans borçlu) ise:
 *      Önceki ayda personelin kazandığı elden hakediş (ve harcama iadesi - çekilen yeni avanslar) bu borcu kapatır;
 *      borç sıfırlandığında sonraki aylara negatif bakiye olarak taşınmaz.
 */
/**
 * Bir ödeme kaydının ait olduğu Bordro Dönemini (YYYY-MM) döndürür.
 * Kural:
 * - Eğer ödemede açıkça `bordroDonemi` belirtilmişse (örn: "2026-09"), doğrudan o dönem kullanılır.
 * - Eğer `bordroDonemi` belirtilmemişse (eski kayıtlar için), ödemenin yapıldığı tarihten türetilir (`odeme.tarih.slice(0, 7)`).
 */
export const getOdemeBordroDonemi = (odeme: { bordroDonemi?: string; tarih?: string }): string => {
  if (odeme.bordroDonemi && odeme.bordroDonemi.trim().length >= 7) {
    return odeme.bordroDonemi.trim().slice(0, 7);
  }
  if (odeme.tarih && odeme.tarih.length >= 7) {
    return odeme.tarih.slice(0, 7);
  }
  return '';
};

/**
 * Bir ödeme kaydının belirtilen bordro dönemine (veya dönem önekine, örn: "2026") ait olup olmadığını kontrol eder.
 */
export const isOdemeInBordroDonemi = (
  odeme: { bordroDonemi?: string; tarih?: string },
  targetDonem: string
): boolean => {
  if (!targetDonem || targetDonem === 'all') return true;
  const donem = getOdemeBordroDonemi(odeme);
  return donem.startsWith(targetDonem);
};

/**
 * Bir personelin "Eski Kalan Bakiye Tutarı"nı (`p.eskiBakiye`) ait olduğu dönemi (`YYYY-MM`) çözer.
 * Öncelik sırası:
 * 1) Personel kartında açıkça seçilen `p.eskiBakiyeDonemi` (örn: "2026-09")
 * 2) Seçilmemişse personelin işe giriş tarihinin ayı (`p.girisTarihi.slice(0, 7)`)
 * 3) O da yoksa personelin ilk puantaj/mesai/ödeme kaydının olduğu ay
 */
export const resolveEskiBakiyeOriginMonth = (
  p: Personnel,
  puantajList: Puantaj[],
  mesaiList: Mesai[],
  odemeList: PersonelOdeme[]
): string => {
  if (p.eskiBakiyeDonemi && p.eskiBakiyeDonemi.length >= 7) {
    return p.eskiBakiyeDonemi.slice(0, 7);
  }

  // Personelin en erken çalışma veya ödeme kaydı ayı
  const activityMonths: string[] = [];
  puantajList.forEach((pu) => {
    if (
      pu.personelId === p.id &&
      pu.tarih &&
      pu.tarih.length >= 7 &&
      (CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0) > 0
    ) {
      activityMonths.push(pu.tarih.slice(0, 7));
    }
  });
  mesaiList.forEach((ms) => {
    if (ms.personelId === p.id && ms.tarih && ms.tarih.length >= 7 && ms.saat > 0) {
      activityMonths.push(ms.tarih.slice(0, 7));
    }
  });
  odemeList.forEach((od) => {
    if (od.personelId === p.id) {
      const donem = getOdemeBordroDonemi(od);
      if (donem && donem.length >= 7) {
        activityMonths.push(donem);
      }
    }
  });

  if (activityMonths.length > 0) {
    activityMonths.sort();
    return activityMonths[0];
  }

  if (p.girisTarihi && p.girisTarihi.length >= 7) {
    return p.girisTarihi.slice(0, 7);
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Bir personelin dönem bazlı eski kalan bakiye / harcama listesini (`PersonelDonemBakiye[]`) normalize ederek döndürür.
 * Eğer `p.donemBakiyeleri` dizisi tanımlı ve doluysa onu kullanır;
 * aksi halde geriye dönük uyumluluk için tekil `p.eskiBakiye` ve `p.eskiBakiyeDonemi` alanlarını tek elemanlı diziye çevirir.
 */
export const getNormalizedDonemBakiyeleri = (
  p: Personnel,
  puantajList: Puantaj[],
  mesaiList: Mesai[],
  odemeList: PersonelOdeme[]
): { id: string; donem: string; tutar: number; aciklama?: string }[] => {
  if (Array.isArray(p.donemBakiyeleri) && p.donemBakiyeleri.length > 0) {
    return p.donemBakiyeleri
      .filter((item) => item && item.donem && Number(item.tutar) !== 0)
      .map((item) => ({
        id: item.id || `db-${item.donem}`,
        donem: item.donem.slice(0, 7),
        tutar: Number(item.tutar) || 0,
        aciklama: item.aciklama || '',
      }));
  }

  const legacyAmount = Number(p.eskiBakiye) || 0;
  if (legacyAmount !== 0) {
    const originMonth = resolveEskiBakiyeOriginMonth(p, puantajList, mesaiList, odemeList);
    return [
      {
        id: `legacy-${originMonth}`,
        donem: originMonth,
        tutar: legacyAmount,
        aciklama: 'Devreden Eski Bakiye',
      },
    ];
  }

  return [];
};

export const getEffectiveEskiBakiyeForMonth = (
  p: Personnel,
  selectedMonth: string,
  puantajList: Puantaj[],
  mesaiList: Mesai[],
  odemeList: PersonelOdeme[],
  customRates?: Record<string, number>,
  periodPrefix?: string
): number => {
  const entries = getNormalizedDonemBakiyeleri(p, puantajList, mesaiList, odemeList);
  if (entries.length === 0) return 0;

  // 1) Yıllık ('yearly') görünümde (periodPrefix örn: "2026"):
  //    O yıla ait olan tüm dönem bakiyelerinin toplamı alınır.
  if (periodPrefix) {
    return entries
      .filter((e) => e.donem.startsWith(periodPrefix))
      .reduce((sum, e) => sum + e.tutar, 0);
  }

  // 2) Tüm dönemler ('all') görünümünde:
  //    Tüm dönem bakiyelerinin genel toplamı alınır.
  if (!selectedMonth || selectedMonth === 'all') {
    return entries.reduce((sum, e) => sum + e.tutar, 0);
  }

  // 3) Aylık ('monthly') görünümde:
  //    Yalnızca seçilen aya (selectedMonth, örn: "2026-09" veya "2026-10") ait girilen bakiye(ler) toplanır.
  //    Böylece Eylül ayı için girilen bakiye Eylül'de, Ekim ayı için girilen bakiye Ekim'de ayrı ayrı tahakkuk eder.
  return entries
    .filter((e) => e.donem === selectedMonth)
    .reduce((sum, e) => sum + e.tutar, 0);
};

/**
 * Bir personelin yıllık ('yearly') veya tüm zamanlar ('all') raporlamasında
 * hakediş ve puantaj hesabı yapılacak aktif ayların (YYYY-MM) listesini döndürür.
 *
 * Kural:
 * - Yıllık veya Tüm dönemler seçildiğinde, yalnızca gerçekten çalışma (puantaj veya mesai)
 *   ya da ödeme kaydı bulunan aylar hesaba katılır.
 * - Hiçbir personel çalışma kaydı olmayan aylarda veya yıllarda aylık sabit personeller için
 *   otomatik 30 gün maaş tahakkuk ettirilmez (aksi halde hiç çalışma kaydı yokken personel kalan alacağı çıkar).
 */
export const getActiveMonthsForPersonnelInPeriod = (
  p: Personnel,
  periodMode: 'monthly' | 'yearly' | 'all',
  selectedYear: number,
  selectedMonth: string,
  puantajList: Puantaj[],
  mesaiList: Mesai[],
  odemeList: PersonelOdeme[]
): string[] => {
  if (periodMode === 'monthly') {
    return [`${selectedYear}-${selectedMonth}`];
  }

  const monthsSet = new Set<string>();
  const yearPrefix = periodMode === 'yearly' ? `${selectedYear}-` : '';

  // Sistemde genel olarak (herhangi bir personele ait) hangi aylarda çalışma/puantaj veya mesai kaydı var?
  const globalActiveMonthsWithWork = new Set<string>();
  puantajList.forEach((pu) => {
    if (
      pu.tarih &&
      pu.tarih.length >= 7 &&
      (CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0) > 0
    ) {
      const m = pu.tarih.slice(0, 7);
      if (!yearPrefix || m.startsWith(yearPrefix)) {
        globalActiveMonthsWithWork.add(m);
      }
    }
  });
  mesaiList.forEach((ms) => {
    if (ms.tarih && ms.tarih.length >= 7 && ms.saat > 0) {
      const m = ms.tarih.slice(0, 7);
      if (!yearPrefix || m.startsWith(yearPrefix)) {
        globalActiveMonthsWithWork.add(m);
      }
    }
  });

  // 1) Bu personelin fiili çalışma (katsayı > 0 olan puantaj) veya mesai kaydı olan ayları ekle
  puantajList.forEach((pu) => {
    if (
      pu.personelId === p.id &&
      pu.tarih &&
      pu.tarih.length >= 7 &&
      (CALISMA_DURUMU_CONFIG[pu.calismaDurumu]?.katsayi || 0) > 0
    ) {
      if (!yearPrefix || pu.tarih.startsWith(yearPrefix)) {
        monthsSet.add(pu.tarih.slice(0, 7));
      }
    }
  });

  mesaiList.forEach((ms) => {
    if (ms.personelId === p.id && ms.tarih && ms.tarih.length >= 7 && ms.saat > 0) {
      if (!yearPrefix || ms.tarih.startsWith(yearPrefix)) {
        monthsSet.add(ms.tarih.slice(0, 7));
      }
    }
  });

  // 2) Aylık sabit ücretli ve Aktif personeller için:
  // Yalnızca sistemde fiilen puantaj/çalışma yürütülen aylarda (globalActiveMonthsWithWork)
  // ve personelin işe giriş-çıkış aralığında olan ayları kontrol et (ve o ay tamamen 'Boş'/'Gelmedi' olarak boşaltılmamışsa ekle).
  const isPasif = p.durum === 'Pasif' || (p as any).durum?.toLowerCase() === 'pasif';

  if (!isPasif && globalActiveMonthsWithWork.size > 0) {
    const startMonth =
      p.girisTarihi && p.girisTarihi.length >= 7 ? p.girisTarihi.slice(0, 7) : '0000-01';
    const endMonth =
      p.cikisTarihi && p.cikisTarihi.length >= 7 ? p.cikisTarihi.slice(0, 7) : '9999-12';

    globalActiveMonthsWithWork.forEach((mStr) => {
      if (mStr >= startMonth && mStr <= endMonth) {
        const wageInfo = getEffectiveWageForPersonnel(p, mStr);
        if (wageInfo.isAylik) {
          const effDays = calculateEffectivePuantajGunForMonth(p, mStr, puantajList);
          if (effDays > 0) {
            monthsSet.add(mStr);
          }
        }
      }
    });
  }

  return Array.from(monthsSet).sort();
};

