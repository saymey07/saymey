import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Receipt,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
  Eye,
  Check,
  AlertCircle
} from 'lucide-react';
import { Firma, FirmaCari, FirmaTuru, Santiye } from '../types';
import {
  ColumnMappingState,
  ImportScope,
  ParsedRowData,
  ImportPreviewSummary,
  readExcelFile,
  readExcelSheet,
  autoDetectColumnMappings,
  processImportRows,
  downloadSampleExcelTemplate
} from '../utils/excelImportUtils';
import { formatCurrency, getTodayDateString } from '../utils/storage';

interface CariExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  firmalar: Firma[];
  santiyeler: Santiye[];
  initialScope?: ImportScope;
  onImportSuccess: (result: {
    firmsToUpsert: Partial<Firma>[];
    cariToInsert: Omit<FirmaCari, 'id'>[];
    summary: {
      newFirms: number;
      updatedFirms: number;
      newCari: number;
    };
  }) => void;
}

export const CariExcelImportModal: React.FC<CariExcelImportModalProps> = ({
  isOpen,
  onClose,
  firmalar,
  santiyeler,
  initialScope = 'combined',
  onImportSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [scope, setScope] = useState<ImportScope>(initialScope);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Excel Dosya Verileri
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Sütun Eşleştirme
  const [mapping, setMapping] = useState<ColumnMappingState>({
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
  });

  // Varsayılan Tercihler
  const [defaultFirmaTuru, setDefaultFirmaTuru] = useState<FirmaTuru>('tedarikci');
  const [defaultCurrency, setDefaultCurrency] = useState<string>('TRY');

  // Önizleme Filtresi
  const [previewFilter, setPreviewFilter] = useState<'all' | 'errors' | 'new_firms' | 'cari_only'>('all');

  // Başarı İstatistiği (Adım 4 için)
  const [importResults, setImportResults] = useState<{
    newFirms: number;
    updatedFirms: number;
    newCari: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adım 3 Önizleme Hesabı
  const previewSummary: ImportPreviewSummary = useMemo(() => {
    if (rawRows.length === 0 || !mapping.firmaAdiCol) {
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        newFirmsCount: 0,
        existingFirmsCount: 0,
        newCariMovementsCount: 0,
        processedRows: [],
      };
    }

    return processImportRows(
      rawRows,
      mapping,
      scope,
      firmalar,
      santiyeler,
      defaultFirmaTuru,
      defaultCurrency
    );
  }, [rawRows, mapping, scope, firmalar, santiyeler, defaultFirmaTuru, defaultCurrency]);

  if (!isOpen) return null;

  // Dosya Yükleme ve Okuma
  const handleFileProcess = async (selectedFile: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await readExcelFile(selectedFile);
      if (res.headers.length === 0 || res.rows.length === 0) {
        throw new Error('Excel dosyasında okunabilecek başlık veya veri satırı bulunamadı.');
      }

      setFile(selectedFile);
      setSheetNames(res.sheetNames);
      setActiveSheet(res.activeSheetName);
      setHeaders(res.headers);
      setRawRows(res.rows);

      // Otomatik eşleştirme yap
      const detected = autoDetectColumnMappings(res.headers);
      setMapping(detected);

      // Otomatik olarak 2. adıma geç
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Dosya okunurken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sayfa Değişimi
  const handleSheetChange = async (sheetName: string) => {
    if (!file || sheetName === activeSheet) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await readExcelSheet(file, sheetName);
      setActiveSheet(sheetName);
      setHeaders(res.headers);
      setRawRows(res.rows);
      const detected = autoDetectColumnMappings(res.headers);
      setMapping(detected);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sayfa okunurken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileProcess(droppedFile);
    }
  };

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // İçe Aktarmayı Tamamlama
  const handleExecuteImport = () => {
    if (previewSummary.validRows === 0) {
      setErrorMessage('İçe aktarılacak geçerli satır bulunmuyor.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Firmaları grupla ve hazırla
      const firmMapByName = new Map<string, Partial<Firma>>();
      const cariListToInsert: Omit<FirmaCari, 'id'>[] = [];

      previewSummary.processedRows.forEach((row) => {
        if (!row.isValid) return;

        // Firma kaydı / güncelleme
        const normName = row.firmaAdi.trim().toLowerCase();
        if (!firmMapByName.has(normName)) {
          const baseFirma: Partial<Firma> = row.matchedFirma
            ? { ...row.matchedFirma }
            : {
                isim: row.firmaAdi.trim(),
                tur: row.firmaTuru,
                adres: row.adres || '',
                vergiNo: row.vergiNo || '',
                vergiDairesi: row.vergiDairesi || '',
                ilgili: row.ilgili || '',
                telefon: row.telefon || '',
                email: row.email || '',
                uzmanlik: row.uzmanlik || '',
              };

          // Mevcut firma ise ve excelde yeni bilgi varsa güncelle
          if (row.matchedFirma) {
            if (row.vergiNo && !baseFirma.vergiNo) baseFirma.vergiNo = row.vergiNo;
            if (row.vergiDairesi && !baseFirma.vergiDairesi) baseFirma.vergiDairesi = row.vergiDairesi;
            if (row.telefon && !baseFirma.telefon) baseFirma.telefon = row.telefon;
            if (row.email && !baseFirma.email) baseFirma.email = row.email;
            if (row.adres && !baseFirma.adres) baseFirma.adres = row.adres;
            if (row.ilgili && !baseFirma.ilgili) baseFirma.ilgili = row.ilgili;
            if (row.uzmanlik && !baseFirma.uzmanlik) baseFirma.uzmanlik = row.uzmanlik;
          }

          firmMapByName.set(normName, baseFirma);
        }

        // Cari Hareket kaydı
        if (row.hasCariMovement && (row.borc > 0 || row.alacak > 0 || row.faturaNo)) {
          const cariItem: Omit<FirmaCari, 'id'> = {
            firmaId: row.matchedFirma ? row.matchedFirma.id : `temp-firm-${normName}`,
            borc: row.borc,
            alacak: row.alacak,
            paraBirimi: row.paraBirimi || defaultCurrency,
            tarih: row.tarih || getTodayDateString(),
            saat: '12:00',
            faturaNo: row.faturaNo || undefined,
            aciklama: row.aciklama || `${row.firmaAdi} - Excel Aktarımı`,
            islemTuru: row.islemTuru || 'alis_faturasi',
            santiyeId: row.santiyeId || undefined,
            santiyeAdi: row.santiyeAdi || undefined,
          };
          cariListToInsert.push(cariItem);
        }
      });

      const firmsToUpsert = Array.from(firmMapByName.values());

      const summary = {
        newFirms: previewSummary.newFirmsCount,
        updatedFirms: previewSummary.existingFirmsCount,
        newCari: cariListToInsert.length,
      };

      setImportResults(summary);

      // Ana uygulamaya aktarımı ilet
      onImportSuccess({
        firmsToUpsert,
        cariToInsert: cariListToInsert,
        summary,
      });

      setStep(4);
    } catch (err: any) {
      setErrorMessage(err?.message || 'İçe aktarma sırasında bir hata meydana geldi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Sıfırla ve yeniden başla
  const handleReset = () => {
    setFile(null);
    setSheetNames([]);
    setActiveSheet('');
    setHeaders([]);
    setRawRows([]);
    setStep(1);
    setErrorMessage(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Excel'den Firma & Cari Verisi Aktarma Sihirbazı</span>
              </h2>
              <p className="text-xs text-slate-500">
                Excel (.xlsx, .xls) veya CSV dosyanızdaki firma kartlarını ve cari hareketleri içeri aktarın.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === 1
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                    : step > 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-xs font-semibold ${step === 1 ? 'text-slate-900' : 'text-slate-500'}`}>
                Dosya & Kapsam
              </span>
            </div>

            <div className={`h-0.5 w-12 sm:w-20 ${step > 1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === 2
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                    : step > 2
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-xs font-semibold ${step === 2 ? 'text-slate-900' : 'text-slate-500'}`}>
                Sütun Eşleştirme
              </span>
            </div>

            <div className={`h-0.5 w-12 sm:w-20 ${step > 2 ? 'bg-emerald-400' : 'bg-slate-200'}`} />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === 3
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                    : step > 3
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > 3 ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <span className={`text-xs font-semibold ${step === 3 ? 'text-slate-900' : 'text-slate-500'}`}>
                Önizleme & Doğrulama
              </span>
            </div>

            <div className={`h-0.5 w-12 sm:w-20 ${step > 3 ? 'bg-emerald-400' : 'bg-slate-200'}`} />

            {/* Step 4 */}
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === 4
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                4
              </div>
              <span className={`text-xs font-semibold ${step === 4 ? 'text-slate-900' : 'text-slate-500'}`}>
                Sonuç
              </span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer font-bold"
            >
              Kapat
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ========================================================================= */}
          {/* STEP 1: DOSYA VE KAPSAM SEÇİMİ                                             */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Kapsam Seçimi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  İçe Aktarım Kapsamı
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('combined')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'combined'
                        ? 'border-emerald-600 bg-emerald-50/40 text-slate-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        Birleşik Aktarım
                      </span>
                      {scope === 'combined' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-slate-500">
                      Hem firma kartları hem de firmalara ait cari hareketler / faturalar tek işlemde aktarılır.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('firmalar_only')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'firmalar_only'
                        ? 'border-emerald-600 bg-emerald-50/40 text-slate-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-600" />
                        Sadece Firmalar
                      </span>
                      {scope === 'firmalar_only' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-slate-500">
                      Tedarikçi, Müşteri ve Taşeron kartları (telefon, adres, vergi no vb.) içe aktarılır.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('cari_only')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      scope === 'cari_only'
                        ? 'border-emerald-600 bg-emerald-50/40 text-slate-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        Sadece Cari Hareketler
                      </span>
                      {scope === 'cari_only' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-slate-500">
                      Faturalar, ödemeler ve tahsilat kayıtları sisteme eklenir; eksik firmalar otomatik açılır.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sürükle Bırak Dosya Yükleme Alanı */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Excel veya CSV Dosyası Yükleyin
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
                      : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/10'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleManualFileSelect}
                  />

                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                    <Upload className="w-7 h-7" />
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-1">
                    Excel dosyanızı buraya sürükleyin veya göz atmak için tıklayın
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Desteklenen formatlar: <strong className="text-slate-700">.xlsx, .xls, .csv</strong>. Dosya başlık satırını ve sütunları otomatik tanıyacağız.
                  </p>

                  {isLoading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dosya taranıyor ve satırlar ayrıştırılıyor...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hazır Örnek Şablon İndirme Alanı */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Hazır Örnek Excel Şablonu İndirin
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Verilerinizi kolayca düzenlemek için önceden hazırlanmış sütun şablonunu kullanabilirsiniz.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => downloadSampleExcelTemplate('combined')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Birleşik Şablon (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcelTemplate('firmalar')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-600" />
                    <span>Firma Şablonu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcelTemplate('cari')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cari Şablonu</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SÜTUN EŞLEŞTİRME SİHİRBAZI                                        */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Dosya ve Çalışma Sayfası Seçim Özeti */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">{file?.name}</span>
                    <span className="text-xs text-slate-400 ml-2">({rawRows.length} satır tespit edildi)</span>
                  </div>
                </div>

                {sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Çalışma Sayfası:</label>
                    <select
                      value={activeSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800"
                    >
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Akıllı Eşleştirme Bilgi Notu */}
              <div className="flex items-start gap-2.5 p-3 bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-xl text-xs">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Akıllı Sütun Tanıma:</strong> Dosyanızdaki sütun başlıkları otomatik olarak eşleştirildi. İhtiyaç duyarsanız aşağıdaki açılır menülerden eşleştirmeleri değiştirebilirsiniz.
                </div>
              </div>

              {/* Sütun Eşleştirme Formu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sol Kolon: Firma Bilgileri */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    <span>Firma / Cari Kartı Sütunları</span>
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Firma / Cari Adı <span className="text-rose-500">* (Zorunlu)</span>
                    </label>
                    <select
                      value={mapping.firmaAdiCol}
                      onChange={(e) => setMapping({ ...mapping, firmaAdiCol: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- Sütun Seçiniz --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Firma Türü Sütunu</label>
                      <select
                        value={mapping.firmaTuruCol}
                        onChange={(e) => setMapping({ ...mapping, firmaTuruCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- (Yoksa Varsayılan) --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Varsayılan Tür</label>
                      <select
                        value={defaultFirmaTuru}
                        onChange={(e) => setDefaultFirmaTuru(e.target.value as FirmaTuru)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="tedarikci">Tedarikçi</option>
                        <option value="musteri">Müşteri</option>
                        <option value="taseron">Taşeron</option>
                        <option value="diger">Diğer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vergi Dairesi</label>
                      <select
                        value={mapping.vergiDairesiCol}
                        onChange={(e) => setMapping({ ...mapping, vergiDairesiCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vergi No / TCKN</label>
                      <select
                        value={mapping.vergiNoCol}
                        onChange={(e) => setMapping({ ...mapping, vergiNoCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Yetkili / İlgili Kişi</label>
                      <select
                        value={mapping.ilgiliCol}
                        onChange={(e) => setMapping({ ...mapping, ilgiliCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Telefon / GSM</label>
                      <select
                        value={mapping.telefonCol}
                        onChange={(e) => setMapping({ ...mapping, telefonCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">E-Posta</label>
                      <select
                        value={mapping.emailCol}
                        onChange={(e) => setMapping({ ...mapping, emailCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Adres</label>
                      <select
                        value={mapping.adresCol}
                        onChange={(e) => setMapping({ ...mapping, adresCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Uzmanlık / İş Kolu</label>
                      <select
                        value={mapping.uzmanlikCol}
                        onChange={(e) => setMapping({ ...mapping, uzmanlikCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sağ Kolon: Cari Hareket & Tutar Sütunları */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>Cari Hareket & Fatura Sütunları</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">İşlem Tarihi</label>
                      <select
                        value={mapping.tarihCol}
                        onChange={(e) => setMapping({ ...mapping, tarihCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- (Yoksa Bugün) --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">İşlem / Belge Türü</label>
                      <select
                        value={mapping.islemTuruCol}
                        onChange={(e) => setMapping({ ...mapping, islemTuruCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- (Otomatik Çıkarım) --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Fatura / Evrak No</label>
                      <select
                        value={mapping.faturaNoCol}
                        onChange={(e) => setMapping({ ...mapping, faturaNoCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">İlgili Şantiye / Proje</label>
                      <select
                        value={mapping.santiyeCol}
                        onChange={(e) => setMapping({ ...mapping, santiyeCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- Seçilmedi --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tutar Eşleme Seçenekleri (Ayrı Borç-Alacak veya Tek Tutar) */}
                  <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 space-y-2.5">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      Tutar Seçenekleri (Borç / Alacak veya Tek Tutar)
                    </span>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-rose-700 mb-0.5">Borç Sütunu</label>
                        <select
                          value={mapping.borcCol}
                          onChange={(e) => setMapping({ ...mapping, borcCol: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Seçilmedi --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-700 mb-0.5">Alacak Sütunu</label>
                        <select
                          value={mapping.alacakCol}
                          onChange={(e) => setMapping({ ...mapping, alacakCol: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Seçilmedi --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center font-bold">-- VEYA --</div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Tek Tutar Sütunu</label>
                        <select
                          value={mapping.tutarCol}
                          onChange={(e) => setMapping({ ...mapping, tutarCol: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Seçilmedi --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Yön (Borç/Alacak)</label>
                        <select
                          value={mapping.tutarYonuCol}
                          onChange={(e) => setMapping({ ...mapping, tutarYonuCol: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Seçilmedi --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Para Birimi Sütunu</label>
                      <select
                        value={mapping.paraBirimiCol}
                        onChange={(e) => setMapping({ ...mapping, paraBirimiCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="">-- (Varsayılan {defaultCurrency}) --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Varsayılan Para Birimi</label>
                      <select
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                      >
                        <option value="TRY">TRY (₺)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Açıklama / Detay Sütunu</label>
                    <select
                      value={mapping.aciklamaCol}
                      onChange={(e) => setMapping({ ...mapping, aciklamaCol: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                    >
                      <option value="">-- Seçilmedi --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Canlı 3 Satırlık Önizleme Tablosu */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>İlk 3 Satır Eşleme Canlı Önizlemesi</span>
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Firma Adı</th>
                        <th className="px-3 py-2">Tür</th>
                        <th className="px-3 py-2">Tarih</th>
                        <th className="px-3 py-2">İşlem Türü</th>
                        <th className="px-3 py-2 text-right">Borç</th>
                        <th className="px-3 py-2 text-right">Alacak</th>
                        <th className="px-3 py-2">Birim</th>
                        <th className="px-3 py-2">Şantiye</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-medium">
                      {rawRows.slice(0, 3).map((r, i) => {
                        const firmaName = mapping.firmaAdiCol ? r[mapping.firmaAdiCol] : '-';
                        const borcVal = mapping.borcCol ? r[mapping.borcCol] : 0;
                        const alacakVal = mapping.alacakCol ? r[mapping.alacakCol] : 0;
                        const dateVal = mapping.tarihCol ? r[mapping.tarihCol] : 'Bugün';
                        const siteVal = mapping.santiyeCol ? r[mapping.santiyeCol] : '-';

                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-900">{firmaName || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{defaultFirmaTuru}</td>
                            <td className="px-3 py-2 text-slate-600">{String(dateVal)}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {mapping.islemTuruCol ? r[mapping.islemTuruCol] || 'Otomatik' : 'Otomatik'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-rose-600">{String(borcVal || 0)}</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-600">{String(alacakVal || 0)}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{defaultCurrency}</td>
                            <td className="px-3 py-2 text-slate-600">{String(siteVal || '-')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DOĞRULAMA VE ÇAKIŞMA ÖNİZLEMESİ                                   */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-5">
              {/* İstatistik Özet Kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-500 block">Toplam Satır</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {previewSummary.totalRows}
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-700 block">Yeni Firma Eklenecek</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-emerald-800">
                    {previewSummary.newFirmsCount}
                  </span>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-blue-700 block">Mevcut Firma Güncellenecek</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-blue-800">
                    {previewSummary.existingFirmsCount}
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-indigo-700 block">Cari Hareket Eklenecek</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-indigo-800">
                    {previewSummary.newCariMovementsCount}
                  </span>
                </div>
              </div>

              {/* Çakışma Yönetimi Kural Bildirimi */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Akıllı Çakışma Yönetimi Devrede:</strong> Sistemde zaten var olan firmalar (isim veya vergi numarası ile) tespit edilerek güncellenecek, mükerrer firma kartı açılmayacak ve bu satırlara ait cari hareketler doğrudan mevcut firmaya işlenecektir.
                </div>
              </div>

              {/* Filtreleme ve Tablo Başlığı */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tümü ({previewSummary.processedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('new_firms')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewFilter === 'new_firms' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sadece Yeni Firmalar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('errors')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      previewFilter === 'errors' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hatalı Satırlar ({previewSummary.invalidRows})
                  </button>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  {previewSummary.validRows} satır aktarıma hazır
                </span>
              </div>

              {/* Satır Döküm Tablosu */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-12 text-center">#</th>
                      <th className="px-3 py-2.5">Durum & Eşleşme</th>
                      <th className="px-3 py-2.5">Firma Adı</th>
                      <th className="px-3 py-2.5">Vergi Dairesi / No</th>
                      <th className="px-3 py-2.5">Tarih</th>
                      <th className="px-3 py-2.5">İşlem Türü</th>
                      <th className="px-3 py-2.5 text-right">Borç</th>
                      <th className="px-3 py-2.5 text-right">Alacak</th>
                      <th className="px-3 py-2.5">Şantiye</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewSummary.processedRows
                      .filter((r) => {
                        if (previewFilter === 'errors') return !r.isValid;
                        if (previewFilter === 'new_firms') return !r.isExistingFirma;
                        return true;
                      })
                      .map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-slate-50/80 ${!row.isValid ? 'bg-rose-50/40' : ''}`}
                        >
                          <td className="px-3 py-2 text-center font-mono text-slate-400">
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2">
                            {!row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {row.validationErrors[0]}
                              </span>
                            ) : row.isExistingFirma ? (
                              <span className="text-blue-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                Mevcut Firma Güncellenecek
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                Yeni Firma Eklenecek
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">{row.firmaAdi}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.vergiDairesi && (
                              <span className="block text-[11px] font-semibold text-slate-700">{row.vergiDairesi}</span>
                            )}
                            {row.vergiNo ? (
                              <span className="font-mono text-[11px] text-slate-600">VN: {row.vergiNo}</span>
                            ) : (
                              !row.vergiDairesi && <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.tarih || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.hasCariMovement ? (
                              <span className="capitalize">{row.islemTuru?.replace('_', ' ')}</span>
                            ) : (
                              <span className="text-slate-400">Sadece Kart</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600">
                            {row.borc > 0 ? formatCurrency(row.borc, row.paraBirimi) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600">
                            {row.alacak > 0 ? formatCurrency(row.alacak, row.paraBirimi) : '-'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.santiyeAdi || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SONUÇ VE BAŞARI ÖZETİ                                             */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="py-8 text-center space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  Excel Verileri Başarıyla İçe Aktarıldı!
                </h3>
                <p className="text-xs text-slate-500">
                  Dosyanızdaki veriler çözümlendi, mevcut firmalar güncellendi ve cari hesap kayıtları senkronize edildi.
                </p>
              </div>

              {importResults && (
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                  <div className="p-2">
                    <span className="text-[11px] font-semibold text-slate-500 block">Yeni Firma</span>
                    <span className="text-lg font-bold font-mono text-emerald-700">
                      +{importResults.newFirms}
                    </span>
                  </div>

                  <div className="p-2">
                    <span className="text-[11px] font-semibold text-slate-500 block">Güncellenen Firma</span>
                    <span className="text-lg font-bold font-mono text-blue-700">
                      {importResults.updatedFirms}
                    </span>
                  </div>

                  <div className="p-2">
                    <span className="text-[11px] font-semibold text-slate-500 block">Cari Hareket</span>
                    <span className="text-lg font-bold font-mono text-indigo-700">
                      +{importResults.newCari}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Yeni Dosya Aktar
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Kapat ve Listede Gör
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Navigasyon Butonları) */}
        {step < 4 && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as any)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Geri</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                İptal
              </button>

              {step === 1 && (
                <button
                  type="button"
                  disabled={!file}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Sütun Eşleştirmeye Geç</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  disabled={!mapping.firmaAdiCol}
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Önizleme & Doğrula</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={isLoading || previewSummary.validRows === 0}
                  onClick={handleExecuteImport}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Aktarılıyor...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{previewSummary.validRows} Satırı İçe Aktar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
