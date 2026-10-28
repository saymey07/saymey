import React, { useState, useRef, useMemo } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  FileJson,
  X,
  RefreshCw,
  Users,
  HardHat,
  CalendarCheck,
  Receipt,
  Building2,
  CreditCard,
  BookOpenCheck,
  Layers,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { getSavedExchangeRates, saveExchangeRates } from '../utils/currencyStore';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import';
  currentData: {
    personnel: any[];
    puantaj: any[];
    mesai: any[];
    odemeler: any[];
    santiyeler: any[];
    giderler: any[];
    taseronlar: any[];
    firmalar: any[];
    cari: any[];
    cekler: any[];
    odeme_yontemleri: any[];
    gider_kategorileri: any[];
    kredi_kartlari: any[];
    kart_harcamalari: any[];
    users: any[];
  };
  onRestore: (data: any) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export',
  currentData,
  onRestore,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showJsonPreview, setShowJsonPreview] = useState<boolean>(false);

  // Import states
  const [pasteMode, setPasteMode] = useState<boolean>(false);
  const [pastedJson, setPastedJson] = useState<string>('');
  const [parsedImportData, setParsedImportData] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initialTab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setParsedImportData(null);
      setImportFileName('');
      setImportError(null);
      setPastedJson('');
      setIsCopied(false);
    }
  }, [isOpen, initialTab]);

  // Construct standardized full backup payload
  const backupPayload = useMemo(() => {
    const exchangeRates = getSavedExchangeRates();
    return {
      version: '3.0',
      exportDate: new Date().toISOString(),
      appName: 'Şantiye & Personel ERP',
      exchangeRates,
      ...currentData,
    };
  }, [currentData]);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(backupPayload, null, 2);
    } catch (e) {
      return '{}';
    }
  }, [backupPayload]);

  // Handle direct file download
  const handleDownloadFile = () => {
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const filename = `Santiye_ERP_Tam_Yedek_${new Date().toISOString().slice(0, 10)}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      showToast('Yedek dosyası başarıyla indirildi.', 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Tarayıcı indirmeyi engelledi, lütfen metni kopyalama seçeneğini kullanın.', 'error');
    }
  };

  // Handle copy JSON to clipboard
  const handleCopyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = jsonString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      showToast('Tüm veritabanı JSON yedeği panoya kopyalandı.', 'success');
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error('Clipboard copy error:', err);
      showToast('Panoya kopyalama başarısız oldu.', 'error');
    }
  };

  // Inspect and validate parsed backup data
  const inspectParsedData = (data: any, sourceName: string) => {
    setImportError(null);

    // Support nested container objects
    const actual =
      data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? data.data
        : data.erpData && typeof data.erpData === 'object' && !Array.isArray(data.erpData)
        ? data.erpData
        : data;

    if (!actual || typeof actual !== 'object') {
      setImportError('Geçersiz dosya formatı: Dosya bir JSON nesnesi içermelidir.');
      setParsedImportData(null);
      return;
    }

    // Check if at least one known module exists
    const knownKeys = [
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
      'odeme_yontemleri',
      'gider_kategorileri',
      'kredi_kartlari',
      'kart_harcamalari',
      'users',
    ];

    const foundKeys = knownKeys.filter((k) => actual[k] !== undefined);
    if (foundKeys.length === 0) {
      setImportError('Bu dosyada geçerli bir Şantiye ERP veritabanı tablosu bulunamadı.');
      setParsedImportData(null);
      return;
    }

    setParsedImportData(actual);
    setImportFileName(sourceName);
    showToast(`Yedek dosyası doğrulandı: ${foundKeys.length} veri tablosu tespit edildi.`, 'info');
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        inspectParsedData(parsed, file.name);
      } catch (err) {
        console.error(err);
        setImportError('JSON dosyası okunamadı veya sözdizimi bozuk. Lütfen geçerli bir .json dosyası seçin.');
        setParsedImportData(null);
      }
    };
    reader.onerror = () => {
      setImportError('Dosya okunurken bir hata meydana geldi.');
      setParsedImportData(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle manual JSON paste analysis
  const handleAnalyzePastedJson = () => {
    if (!pastedJson.trim()) {
      setImportError('Lütfen yapıştırılmış JSON metni girin.');
      return;
    }
    try {
      const parsed = JSON.parse(pastedJson.trim());
      inspectParsedData(parsed, 'Yapıştırılan Metin');
    } catch (err: any) {
      setImportError(`JSON ayrıştırma hatası: ${err?.message || 'Geçersiz sözdizimi'}`);
      setParsedImportData(null);
    }
  };

  // Execute restore action
  const handleConfirmRestore = async () => {
    if (!parsedImportData) return;
    setIsRestoring(true);

    try {
      // If exchange rates are present in backup, restore them too
      if (parsedImportData.exchangeRates) {
        try {
          const ratesObj = parsedImportData.exchangeRates.rates || parsedImportData.exchangeRates;
          if (typeof ratesObj === 'object') {
            saveExchangeRates(ratesObj, 'manual');
          }
        } catch (e) {
          console.warn('Could not restore exchange rates from backup:', e);
        }
      }

      await onRestore(parsedImportData);
      showToast('Yedek başarıyla geri yüklendi ve tüm sistem eşitlendi!', 'success');
      onClose();
    } catch (err: any) {
      console.error('Restore error:', err);
      setImportError(`Geri yükleme sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
      showToast('Yedek geri yüklenirken hata oluştu.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Veritabanı Yedekleme & Geri Yükleme</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Canlı Bulut & JSON
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tüm ERP modüllerini (15 tablo) tek tıkla yedekleyin veya geri yükleyin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            id="tab-btn-export"
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-slate-900 border-amber-500 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 border-transparent'
            }`}
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>Yedekle (Dışa Aktar)</span>
          </button>

          <button
            id="tab-btn-import"
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-slate-900 border-blue-500 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 border-transparent'
            }`}
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Geri Yükle (İçe Aktar)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: EXPORT / YEDEKLE */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              {/* Current Database Statistics Grid */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Yedeklenecek Mevcut Veriler (15 Modül)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Personel</div>
                      <div className="font-bold text-slate-900">{currentData.personnel.length} Kayıt</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Şantiyeler</div>
                      <div className="font-bold text-slate-900">{currentData.santiyeler.length} Şantiye</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Puantaj & Mesai</div>
                      <div className="font-bold text-slate-900">
                        {currentData.puantaj.length + currentData.mesai.length} Kayıt
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Ödeme & Avanslar</div>
                      <div className="font-bold text-slate-900">{currentData.odemeler.length} Hareket</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Firma & Cari</div>
                      <div className="font-bold text-slate-900">
                        {currentData.firmalar.length} Firma / {currentData.cari.length} Hareket
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Kart & Masraflar</div>
                      <div className="font-bold text-slate-900">
                        {currentData.kredi_kartlari.length} Kart / {currentData.giderler.length} Gider
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <BookOpenCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Çekler</div>
                      <div className="font-bold text-slate-900">{currentData.cekler.length} Çek</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Taşeronlar</div>
                      <div className="font-bold text-slate-900">{currentData.taseronlar.length} Firma</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Kullanıcılar</div>
                      <div className="font-bold text-slate-900">{currentData.users.length} Hesap</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 space-y-3">
                <div className="text-xs text-amber-900 font-medium leading-relaxed">
                  Yedek dosyasını bilgisayarınıza <b>.json</b> uzantılı olarak indirebilir veya kopyalayıp güvenli bir yerde saklayabilirsiniz.
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    id="btn-modal-download-backup"
                    type="button"
                    onClick={handleDownloadFile}
                    className="flex-1 min-w-[200px] px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Yedek Dosyasını İndir (.json)</span>
                  </button>

                  <button
                    id="btn-modal-copy-backup"
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Panoya Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>JSON Metnini Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* JSON preview toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>{showJsonPreview ? 'JSON Önizlemesini Gizle' : 'JSON Metin Önizlemesini Göster'}</span>
                </button>

                {showJsonPreview && (
                  <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto border border-slate-700">
                    <pre>{jsonString}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT / GERİ YÜKLE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Method Switcher */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPasteMode(false);
                    setImportError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    !pasteMode
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Dosya Yükle (.json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasteMode(true);
                    setImportError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    pasteMode
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  JSON Metni Yapıştır
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
              />

              {/* Method 1: File selection zone */}
              {!pasteMode && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {importFileName ? importFileName : 'Yedek Dosyasını Seçin (.json)'}
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Önceden indirilmiş olan <b>Santiye_ERP_Tam_Yedek_*.json</b> dosyanızı seçmek için tıklayın
                  </p>
                </div>
              )}

              {/* Method 2: Paste JSON */}
              {pasteMode && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Yedek JSON Metnini Aşağıya Yapıştırın:
                  </label>
                  <textarea
                    rows={6}
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder='{"version": "3.0", "personnel": [...], ...}'
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-mono text-xs outline-none bg-slate-50"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAnalyzePastedJson}
                      disabled={!pastedJson.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Metni Doğrula ve Çözümle</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Verified Backup Preview */}
              {parsedImportData && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Yedek Dosyası Başarıyla Doğrulandı: {importFileName || 'Geçerli Yedek'}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {parsedImportData.personnel && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        👥 {parsedImportData.personnel.length} Personel
                      </div>
                    )}
                    {parsedImportData.santiyeler && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        🏗️ {parsedImportData.santiyeler.length} Şantiye
                      </div>
                    )}
                    {parsedImportData.puantaj && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        📅 {parsedImportData.puantaj.length} Puantaj
                      </div>
                    )}
                    {parsedImportData.odemeler && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        💰 {parsedImportData.odemeler.length} Ödeme
                      </div>
                    )}
                    {parsedImportData.firmalar && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        🏢 {parsedImportData.firmalar.length} Firma
                      </div>
                    )}
                    {parsedImportData.cari && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        📑 {parsedImportData.cari.length} Cari İşlem
                      </div>
                    )}
                    {parsedImportData.giderler && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        🧾 {parsedImportData.giderler.length} Gider
                      </div>
                    )}
                    {parsedImportData.cekler && (
                      <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-emerald-950 font-semibold">
                        💳 {parsedImportData.cekler.length} Çek
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-emerald-800 leading-relaxed">
                    ⚠️ <b>Dikkat:</b> Bu yedeği geri yüklediğinizde, veriler anında mevcut ekranlara yüklenecek ve Firestore bulut veritabanına otomatik olarak eşitlenecektir.
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      id="btn-confirm-restore"
                      type="button"
                      onClick={handleConfirmRestore}
                      disabled={isRestoring}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Veritabanı Geri Yükleniyor...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Yedeği Geri Yükle ve Buluta Kaydet</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Firestore Bulut Eşitlemesi Aktif</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
