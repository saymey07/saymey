import * as XLSX from 'xlsx';
import { Firma, FirmaCari, FirmaTuru, Santiye } from '../types';
import { getTodayDateString } from './storage';

export interface ColumnMappingState {
  // Firma alanları
  firmaAdiCol: string;
  firmaTuruCol: string;
  vergiNoCol: string;
  vergiDairesiCol: string;
  ilgiliCol: string;
  telefonCol: string;
  emailCol: string;
  adresCol: string;
  uzmanlikCol: string;

  // Cari hareket alanları
  tarihCol: string;
  islemTuruCol: string;
  faturaNoCol: string;
  aciklamaCol: string;
  borcCol: string;
  alacakCol: string;
  tutarCol: string;
  tutarYonuCol: string; // Borç mu Alacak mı?
  paraBirimiCol: string;
  santiyeCol: string;
}

export type ImportScope = 'combined' | 'firmalar_only' | 'cari_only';

export interface ParsedRowData {
  rowIndex: number;
  // Firma verisi
  firmaAdi: string;
  firmaTuru: FirmaTuru;
  vergiNo?: string;
  vergiDairesi?: string;
  ilgili?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  uzmanlik?: string;

  // Cari hareket verisi
  hasCariMovement: boolean;
  tarih?: string;
  islemTuru?: 'alis_faturasi' | 'satis_faturasi' | 'odeme' | 'tahsilat';
  faturaNo?: string;
  aciklama?: string;
  borc: number;
  alacak: number;
  paraBirimi: string;
  santiyeAdi?: string;
  santiyeId?: string;

  // Doğrulama durumları
  isValid: boolean;
  validationErrors: string[];
  isExistingFirma: boolean;
  matchedFirma?: Firma;
}

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newFirmsCount: number;
  existingFirmsCount: number;
  newCariMovementsCount: number;
  processedRows: ParsedRowData[];
}

/**
 * Türkçe karakter duyarsız metin normalizasyonu (Fuzzy matching için)
 */
export function normalizeText(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Excel tarih veya metin tarihlerini YYYY-MM-DD formatına çevirir
 */
export function parseExcelDate(raw: any): string {
  if (!raw) return getTodayDateString();

  // 1. Sayısal Excel Serial Number kontrolü (örn. 45290)
  if (typeof raw === 'number' && raw > 25000 && raw < 70000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(raw);
      if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
        const y = String(dateObj.y);
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback
    }
  }

  // 2. Date nesnesi ise
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();
  if (!str) return getTodayDateString();

  // 3. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 4. DD.MM.YYYY veya DD/MM/YYYY veya DD-MM-YYYY
  const trMatch = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
  if (trMatch) {
    const d = trMatch[1].padStart(2, '0');
    const m = trMatch[2].padStart(2, '0');
    const y = trMatch[3];
    return `${y}-${m}-${d}`;
  }

  return getTodayDateString();
}

/**
 * Excel sayılarını veya para birimi içeren metinleri temizleyip sayıya çevirir
 */
export function parseExcelNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let str = String(val).trim();
  if (!str) return 0;

  // Parantez içi negatif sayı kontrolü (örn: (1.250,00))
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1).trim();
  }

  // Para sembollerini temizle
  str = str.replace(/[₺$€£]/g, '').trim();

  // Türkçe format: 1.250,50 -> 1250.50
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.250,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Sadece virgül varsa: 1250,50
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

/**
 * Excel dosyasını SheetJS ile okur
 */
export async function readExcelFile(file: File): Promise<{
  sheetNames: string[];
  activeSheetName: string;
  headers: string[];
  rows: Record<string, any>[];
  rawMatrix: any[][];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          throw new Error('Dosya okunamadı.');
        }

        const workbook = XLSX.read(buffer, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Excel dosyasında geçerli bir çalışma sayfası bulunamadı.');
        }

        const sheetNames = workbook.SheetNames;
        const activeSheetName = sheetNames[0];
        const sheet = workbook.Sheets[activeSheetName];

        // 2B matris olarak oku
        const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        if (!rawMatrix || rawMatrix.length === 0) {
          return resolve({
            sheetNames,
            activeSheetName,
            headers: [],
            rows: [],
            rawMatrix: [],
          });
        }

        // Başlık satırını bul (boş olmayan ilk satır)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawMatrix.length, 5); i++) {
          const row = rawMatrix[i];
          const nonEmptyCols = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
          if (nonEmptyCols.length >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        const rawHeaders = rawMatrix[headerRowIndex].map((h: any, idx: number) => {
          const str = String(h || '').trim();
          return str || `Sütun_${idx + 1}`;
        });

        // Veri satırlarını objelere dönüştür
        const rows: Record<string, any>[] = [];
        for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
          const rowCells = rawMatrix[r];
          // Tamamen boş satırları atla
          const hasAnyData = rowCells.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
          if (!hasAnyData) continue;

          const rowObj: Record<string, any> = {};
          rawHeaders.forEach((header: string, cIdx: number) => {
            rowObj[header] = rowCells[cIdx] !== undefined ? rowCells[cIdx] : '';
          });
          rows.push(rowObj);
        }

        resolve({
          sheetNames,
          activeSheetName,
          headers: rawHeaders,
          rows,
          rawMatrix,
        });
      } catch (err: any) {
        reject(new Error(err?.message || 'Excel dosyası işlenirken hata oluştu.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Dosya yüklenemedi. Lütfen geçerli bir .xlsx veya .xls dosyası seçin.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Belirli bir sayfayı tekrar okur
 */
export async function readExcelSheet(file: File, sheetName: string): Promise<{
  headers: string[];
  rows: Record<string, any>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error(`"${sheetName}" sayfası bulunamadı.`);
        }

        const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        if (!rawMatrix || rawMatrix.length === 0) {
          return resolve({ headers: [], rows: [] });
        }

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawMatrix.length, 5); i++) {
          const row = rawMatrix[i];
          const nonEmptyCols = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
          if (nonEmptyCols.length >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = rawMatrix[headerRowIndex].map((h: any, idx: number) => {
          const str = String(h || '').trim();
          return str || `Sütun_${idx + 1}`;
        });

        const rows: Record<string, any>[] = [];
        for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
          const rowCells = rawMatrix[r];
          const hasAnyData = rowCells.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
          if (!hasAnyData) continue;

          const rowObj: Record<string, any> = {};
          headers.forEach((header: string, cIdx: number) => {
            rowObj[header] = rowCells[cIdx] !== undefined ? rowCells[cIdx] : '';
          });
          rows.push(rowObj);
        }

        resolve({ headers, rows });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Excel sütun başlıklarını akıllı eşleştirme (Fuzzy Match) ile otomatik tahmin eder
 */
export function autoDetectColumnMappings(headers: string[]): ColumnMappingState {
  const mapping: ColumnMappingState = {
    firmaAdiCol: '',
    firmaTuruCol: '',
    vergiNoCol: '',
    vergiDairesiCol: '',
    ilgiliCol: '',
    telefonCol: '',
    emailCol: '',
    adresCol: '',
    uzmanlikCol: '',
    tarihCol: '',
    islemTuruCol: '',
    faturaNoCol: '',
    aciklamaCol: '',
    borcCol: '',
    alacakCol: '',
    tutarCol: '',
    tutarYonuCol: '',
    paraBirimiCol: '',
    santiyeCol: '',
  };

  const findBestCol = (keywords: string[]): string => {
    for (const h of headers) {
      const normH = normalizeText(h);
      for (const kw of keywords) {
        const normKw = normalizeText(kw);
        if (normH === normKw || normH.includes(normKw)) {
          return h;
        }
      }
    }
    return '';
  };

  // Firma eşleştirmeleri
  mapping.firmaAdiCol = findBestCol([
    'firmaadi',
    'firmaunvani',
    'firmaunvan',
    'sirketadi',
    'cariadi',
    'musteriadi',
    'tedarikciadi',
    'unvan',
    'firma',
    'cari',
  ]);

  mapping.firmaTuruCol = findBestCol([
    'firmaturu',
    'firmatipi',
    'caritipi',
    'tur',
    'tip',
    'rol',
  ]);

  mapping.vergiNoCol = findBestCol([
    'vergino',
    'vergitckn',
    'vkn',
    'tckn',
    'vergikimlikno',
    'verginumarasi',
  ]);

  mapping.vergiDairesiCol = findBestCol([
    'vergidairesi',
    'vergidairesiadi',
    'vd',
    'vergi daire',
    'vergi dairesi',
  ]);

  mapping.ilgiliCol = findBestCol([
    'yetkili',
    'ilgili',
    'kontakkisi',
    'muhatap',
    'yetkiliadi',
  ]);

  mapping.telefonCol = findBestCol([
    'telefon',
    'tel',
    'gsm',
    'mobil',
    'cep',
    'iletisim',
  ]);

  mapping.emailCol = findBestCol([
    'email',
    'eposta',
    'mail',
    'e-posta',
  ]);

  mapping.adresCol = findBestCol([
    'adres',
    'lokasyon',
    'sehir',
    'ililce',
  ]);

  mapping.uzmanlikCol = findBestCol([
    'uzmanlik',
    'iskolu',
    'brans',
    'faaliyet',
  ]);

  // Cari hareket eşleştirmeleri
  mapping.tarihCol = findBestCol([
    'islemtarihi',
    'faturatarihi',
    'vadetarihi',
    'tarih',
    'date',
  ]);

  mapping.islemTuruCol = findBestCol([
    'islemturu',
    'hareketturu',
    'belgeturu',
    'tur',
    'islem',
  ]);

  mapping.faturaNoCol = findBestCol([
    'faturano',
    'belgeno',
    'evrakno',
    'fissno',
    'dekontno',
    'fisno',
    'referans',
  ]);

  mapping.aciklamaCol = findBestCol([
    'aciklama',
    'detay',
    'not',
    'konu',
    'bilgi',
  ]);

  mapping.borcCol = findBestCol([
    'borc',
    'borctutari',
    'borctl',
    'cikis',
    'gider',
  ]);

  mapping.alacakCol = findBestCol([
    'alacak',
    'alacaktutari',
    'alacaktl',
    'giris',
    'gelir',
  ]);

  mapping.tutarCol = findBestCol([
    'tutar',
    'miktar',
    'bedel',
    'meblag',
    'toplamtutar',
    'amount',
  ]);

  mapping.tutarYonuCol = findBestCol([
    'borcalacak',
    'yon',
    'b_a',
    'ba',
    'hareketyonu',
  ]);

  mapping.paraBirimiCol = findBestCol([
    'parabirimi',
    'doviz',
    'dovizcinsi',
    'birim',
    'currency',
  ]);

  mapping.santiyeCol = findBestCol([
    'santiyeadi',
    'santiye',
    'projeadi',
    'proje',
    'site',
  ]);

  return mapping;
}

/**
 * İşlem türünü metinden analiz eder
 */
export function inferIslemTuru(
  text: any,
  borc: number,
  alacak: number,
  firmaTuru: FirmaTuru
): 'alis_faturasi' | 'satis_faturasi' | 'odeme' | 'tahsilat' {
  const norm = normalizeText(text);

  if (norm.includes('alisfaturasi') || norm.includes('alis') || norm.includes('giderfaturasi')) {
    return 'alis_faturasi';
  }
  if (norm.includes('satisfaturasi') || norm.includes('satis') || norm.includes('gelirfaturasi')) {
    return 'satis_faturasi';
  }
  if (norm.includes('odeme') || norm.includes('havale') || norm.includes('eft') || norm.includes('tediye')) {
    return 'odeme';
  }
  if (norm.includes('tahsilat') || norm.includes('makbuz') || norm.includes('tahsil')) {
    return 'tahsilat';
  }

  // Tutar yönüne ve firma türüne göre akıllı çıkarım:
  if (borc > 0 && alacak === 0) {
    // Firmaya borçlandık -> Alış faturası (veya müşteriye borç)
    return firmaTuru === 'musteri' ? 'tahsilat' : 'alis_faturasi';
  }
  if (alacak > 0 && borc === 0) {
    // Alacaklandık / Ödedik -> Tedarikçiye yapılan ödeme veya müşteriye satış faturası
    return firmaTuru === 'musteri' ? 'satis_faturasi' : 'odeme';
  }

  return firmaTuru === 'musteri' ? 'satis_faturasi' : 'alis_faturasi';
}

/**
 * Firma türünü normalize eder
 */
export function inferFirmaTuru(raw: any, fallback: FirmaTuru = 'tedarikci'): FirmaTuru {
  const norm = normalizeText(raw);
  if (norm.includes('musteri') || norm.includes('alici') || norm.includes('client')) {
    return 'musteri';
  }
  if (norm.includes('taseron') || norm.includes('yuklenici') || norm.includes('subcontractor')) {
    return 'taseron';
  }
  if (norm.includes('tedarikci') || norm.includes('satici') || norm.includes('vendor') || norm.includes('supplier')) {
    return 'tedarikci';
  }
  if (norm.includes('diger')) {
    return 'diger';
  }
  return fallback;
}

/**
 * Ham satırları doğrular ve önizleme nesnelerini oluşturur
 */
export function processImportRows(
  rows: Record<string, any>[],
  mapping: ColumnMappingState,
  scope: ImportScope,
  existingFirms: Firma[],
  santiyeler: Santiye[],
  defaultFirmaTuru: FirmaTuru = 'tedarikci',
  defaultParaBirimi: string = 'TRY'
): ImportPreviewSummary {
  const processedRows: ParsedRowData[] = [];
  const existingFirmsMap = new Map<string, Firma>();
  const existingVknMap = new Map<string, Firma>();

  // Mevcut firmaları lookup map'lerine doldur
  existingFirms.forEach((f) => {
    const normName = normalizeText(f.isim);
    if (normName) existingFirmsMap.set(normName, f);
    if (f.vergiNo) {
      const normVkn = normalizeText(f.vergiNo);
      if (normVkn) existingVknMap.set(normVkn, f);
    }
  });

  const uniqueNewFirms = new Set<string>();
  const updatedExistingFirms = new Set<string>();
  let totalCariCount = 0;

  rows.forEach((row, idx) => {
    const errors: string[] = [];
    const rawFirmaName = mapping.firmaAdiCol ? String(row[mapping.firmaAdiCol] || '').trim() : '';

    if (!rawFirmaName) {
      errors.push('Firma / Cari adı boş bırakılamaz.');
    }

    const normFirmaName = normalizeText(rawFirmaName);
    const rawVkn = mapping.vergiNoCol ? String(row[mapping.vergiNoCol] || '').trim() : '';
    const normVkn = normalizeText(rawVkn);
    const rawVergiDairesi = mapping.vergiDairesiCol ? String(row[mapping.vergiDairesiCol] || '').trim() : '';

    // Mevcut firma eşleme kontrolü (önce VKN, sonra İsim)
    let matchedFirma: Firma | undefined = undefined;
    if (normVkn && existingVknMap.has(normVkn)) {
      matchedFirma = existingVknMap.get(normVkn);
    } else if (normFirmaName && existingFirmsMap.has(normFirmaName)) {
      matchedFirma = existingFirmsMap.get(normFirmaName);
    }

    const isExisting = !!matchedFirma;
    if (isExisting) {
      updatedExistingFirms.add(matchedFirma!.id);
    } else if (normFirmaName) {
      uniqueNewFirms.add(normFirmaName);
    }

    // Firma türü
    const rawTur = mapping.firmaTuruCol ? row[mapping.firmaTuruCol] : '';
    const firmaTuru = rawTur ? inferFirmaTuru(rawTur, matchedFirma?.tur || defaultFirmaTuru) : (matchedFirma?.tur || defaultFirmaTuru);

    // Cari hareket ayrıştırma
    let borc = 0;
    let alacak = 0;

    if (mapping.borcCol && row[mapping.borcCol] !== undefined) {
      borc = Math.max(0, parseExcelNumber(row[mapping.borcCol]));
    }
    if (mapping.alacakCol && row[mapping.alacakCol] !== undefined) {
      alacak = Math.max(0, parseExcelNumber(row[mapping.alacakCol]));
    }

    // Tek sütunda tutar varsa
    if (mapping.tutarCol && row[mapping.tutarCol] !== undefined && borc === 0 && alacak === 0) {
      const rawAmt = parseExcelNumber(row[mapping.tutarCol]);
      const rawYon = mapping.tutarYonuCol ? normalizeText(row[mapping.tutarYonuCol]) : '';

      if (rawYon.includes('borc') || rawYon.includes('cikis') || rawYon.includes('gider') || rawAmt < 0) {
        borc = Math.abs(rawAmt);
      } else {
        alacak = Math.abs(rawAmt);
      }
    }

    const hasCariMovement = scope !== 'firmalar_only' && (borc > 0 || alacak > 0 || Boolean(mapping.faturaNoCol && row[mapping.faturaNoCol]));
    if (hasCariMovement) {
      totalCariCount++;
    }

    // Tarih
    const rawDate = mapping.tarihCol ? row[mapping.tarihCol] : undefined;
    const parsedDate = parseExcelDate(rawDate);

    // Para Birimi
    let currency = defaultParaBirimi;
    if (mapping.paraBirimiCol && row[mapping.paraBirimiCol]) {
      const currStr = String(row[mapping.paraBirimiCol]).trim().toUpperCase();
      if (['TRY', 'USD', 'EUR', 'GBP', 'TL'].includes(currStr)) {
        currency = currStr === 'TL' ? 'TRY' : currStr;
      }
    }

    // Şantiye Eşleştirme
    let matchedSantiye: Santiye | undefined = undefined;
    const rawSantiye = mapping.santiyeCol ? String(row[mapping.santiyeCol] || '').trim() : '';
    if (rawSantiye) {
      const normSite = normalizeText(rawSantiye);
      matchedSantiye = santiyeler.find((s) => {
        return normalizeText(s.isim) === normSite || normalizeText(s.isim).includes(normSite);
      });
    }

    // İşlem Türü
    const rawIslemTuru = mapping.islemTuruCol ? row[mapping.islemTuruCol] : undefined;
    const islemTuru = inferIslemTuru(rawIslemTuru, borc, alacak, firmaTuru);

    const parsedRow: ParsedRowData = {
      rowIndex: idx + 1,
      firmaAdi: rawFirmaName,
      firmaTuru,
      vergiNo: rawVkn || matchedFirma?.vergiNo || '',
      vergiDairesi: rawVergiDairesi || matchedFirma?.vergiDairesi || '',
      ilgili: mapping.ilgiliCol ? String(row[mapping.ilgiliCol] || '').trim() : matchedFirma?.ilgili || '',
      telefon: mapping.telefonCol ? String(row[mapping.telefonCol] || '').trim() : matchedFirma?.telefon || '',
      email: mapping.emailCol ? String(row[mapping.emailCol] || '').trim() : matchedFirma?.email || '',
      adres: mapping.adresCol ? String(row[mapping.adresCol] || '').trim() : matchedFirma?.adres || '',
      uzmanlik: mapping.uzmanlikCol ? String(row[mapping.uzmanlikCol] || '').trim() : matchedFirma?.uzmanlik || '',
      hasCariMovement,
      tarih: parsedDate,
      islemTuru,
      faturaNo: mapping.faturaNoCol ? String(row[mapping.faturaNoCol] || '').trim() : undefined,
      aciklama: mapping.aciklamaCol ? String(row[mapping.aciklamaCol] || '').trim() : undefined,
      borc,
      alacak,
      paraBirimi: currency,
      santiyeAdi: matchedSantiye?.isim || (rawSantiye || undefined),
      santiyeId: matchedSantiye?.id,
      isValid: errors.length === 0,
      validationErrors: errors,
      isExistingFirma: isExisting,
      matchedFirma,
    };

    processedRows.push(parsedRow);
  });

  const validRows = processedRows.filter((r) => r.isValid).length;
  const invalidRows = processedRows.length - validRows;

  return {
    totalRows: processedRows.length,
    validRows,
    invalidRows,
    newFirmsCount: uniqueNewFirms.size,
    existingFirmsCount: updatedExistingFirms.size,
    newCariMovementsCount: totalCariCount,
    processedRows,
  };
}

/**
 * Kullanıcı için örnek Excel şablonu (.xlsx) üretir ve indirmeyi tetikler
 */
export function downloadSampleExcelTemplate(type: 'combined' | 'firmalar' | 'cari'): void {
  const wb = XLSX.utils.book_new();

  if (type === 'firmalar' || type === 'combined') {
    const firmaData = [
      {
        'Firma Adı': 'Örnek Yapı Malzemeleri Ltd. Şti.',
        'Firma Türü': 'Tedarikçi',
        'Vergi Dairesi': 'Kadıköy V.D.',
        'Vergi / TC No': '1234567890',
        'Yetkili Kişi': 'Ahmet Yılmaz',
        'Telefon': '0532 111 22 33',
        'E-Posta': 'ahmet@ornekyapi.com',
        'Adres': 'Kadıköy / İstanbul',
        'Uzmanlık / İş Kolu': 'Kaba İnşaat Malzemeleri',
      },
      {
        'Firma Adı': 'Zirve İnşaat & Taahhüt A.Ş.',
        'Firma Türü': 'Müşteri',
        'Vergi Dairesi': 'Çankaya V.D.',
        'Vergi / TC No': '9876543210',
        'Yetkili Kişi': 'Merve Kaya',
        'Telefon': '0544 555 66 77',
        'E-Posta': 'merve@zirveinsaat.com',
        'Adres': 'Çankaya / Ankara',
        'Uzmanlık / İş Kolu': 'Genel Müteahhitlik',
      },
      {
        'Firma Adı': 'Usta Ahşap & Kalıp Ekibi',
        'Firma Türü': 'Taşeron',
        'Vergi Dairesi': 'Bornova V.D.',
        'Vergi / TC No': '5556667778',
        'Yetkili Kişi': 'Mehmet Usta',
        'Telefon': '0505 888 99 00',
        'E-Posta': 'mehmet@ustaahsap.com',
        'Adres': 'Bornova / İzmir',
        'Uzmanlık / İş Kolu': 'Kalıp & Demir İşleri',
      },
    ];

    const wsFirma = XLSX.utils.json_to_sheet(firmaData);
    // Kolon genişlikleri
    wsFirma['!cols'] = [
      { wch: 32 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 22 },
      { wch: 25 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsFirma, 'Firmalar');
  }

  if (type === 'cari' || type === 'combined') {
    const cariData = [
      {
        'Firma Adı': 'Örnek Yapı Malzemeleri Ltd. Şti.',
        'Tarih': '2026-03-15',
        'İşlem Türü': 'Alış Faturası',
        'Fatura / Evrak No': 'FAT-2026-001',
        'Borç Tutarı': 45000,
        'Alacak Tutarı': 0,
        'Para Birimi': 'TRY',
        'Şantiye': 'Merkez Konut Projesi',
        'Açıklama': 'C25 Hazır Beton ve Çimento Alımı',
      },
      {
        'Firma Adı': 'Örnek Yapı Malzemeleri Ltd. Şti.',
        'Tarih': '2026-03-20',
        'İşlem Türü': 'Ödeme',
        'Fatura / Evrak No': 'BKN-8831',
        'Borç Tutarı': 0,
        'Alacak Tutarı': 25000,
        'Para Birimi': 'TRY',
        'Şantiye': 'Merkez Konut Projesi',
        'Açıklama': 'Banka Havalesi İle Tedarikçi Ödemesi',
      },
      {
        'Firma Adı': 'Zirve İnşaat & Taahhüt A.Ş.',
        'Tarih': '2026-03-25',
        'İşlem Türü': 'Satış Faturası',
        'Fatura / Evrak No': 'ST-2026-042',
        'Borç Tutarı': 0,
        'Alacak Tutarı': 150000,
        'Para Birimi': 'TRY',
        'Şantiye': 'Kuzey Rezidans Şantiyesi',
        'Açıklama': '1. Hakediş Satış Faturası',
      },
      {
        'Firma Adı': 'Zirve İnşaat & Taahhüt A.Ş.',
        'Tarih': '2026-03-28',
        'İşlem Türü': 'Tahsilat',
        'Fatura / Evrak No': 'THS-1092',
        'Borç Tutarı': 100000,
        'Alacak Tutarı': 0,
        'Para Birimi': 'TRY',
        'Şantiye': 'Kuzey Rezidans Şantiyesi',
        'Açıklama': 'Müşteri Avans Tahsilatı',
      },
    ];

    const wsCari = XLSX.utils.json_to_sheet(cariData);
    wsCari['!cols'] = [
      { wch: 32 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 25 },
      { wch: 35 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCari, 'Cari Hareketler');
  }

  const filename =
    type === 'firmalar'
      ? 'Ornek_Firma_Listesi_Sablonu.xlsx'
      : type === 'cari'
      ? 'Ornek_Cari_Hareketler_Sablonu.xlsx'
      : 'Ornek_Firma_ve_Cari_Sablonu.xlsx';

  XLSX.writeFile(wb, filename);
}
