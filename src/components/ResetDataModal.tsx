import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  RefreshCcw, 
  Download, 
  X, 
  CheckCircle2, 
  Building2, 
  Users, 
  Receipt, 
  CreditCard, 
  BookOpenCheck 
} from 'lucide-react';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetAllData: (mode: 'empty' | 'demo') => Promise<void>;
  onExportBackup: () => void;
  counts: {
    personnel: number;
    santiyeler: number;
    giderler: number;
    cekler: number;
    firmalar: number;
    cari: number;
    kartHarcamalari: number;
  };
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onResetAllData,
  onExportBackup,
  counts,
}) => {
  const [selectedAction, setSelectedAction] = useState<'empty' | 'demo'>('empty');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const totalRecords =
    counts.personnel +
    counts.santiyeler +
    counts.giderler +
    counts.cekler +
    counts.firmalar +
    counts.cari +
    counts.kartHarcamalari;

  const handleExecute = async () => {
    if (selectedAction === 'empty' && !confirmChecked && totalRecords > 0) {
      return;
    }
    setIsProcessing(true);
    try {
      await onResetAllData(selectedAction);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div 
        id="modal-reset-data" 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Veritabanını Sıfırla</h2>
              <p className="text-xs text-slate-500">Tüm sistem verilerini temizleme veya fabrika ayarlarına döndürme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Current stats */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Mevcut Sistem Verisi Dökümü</span>
              <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-full font-mono text-[11px]">
                Toplam {totalRecords} Kayıt
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Şantiyeler: <strong>{counts.santiyeler}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Personel: <strong>{counts.personnel}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Receipt className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">Gider Fişleri: <strong>{counts.giderler}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <BookOpenCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Çek/Senet: <strong>{counts.cekler}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Firmalar & Cari: <strong>{counts.cari}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200/60">
                <CreditCard className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">Kart Giderleri: <strong>{counts.kartHarcamalari}</strong></span>
              </div>
            </div>
          </div>

          {/* Backup recommendation banner */}
          <div className="flex items-start justify-between gap-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold flex items-center gap-1">
                <span>Öneri: Sıfırlamadan önce yedek alın</span>
              </p>
              <p className="text-amber-700 text-[11px] leading-relaxed">
                İleride bu verilere tekrar ihtiyaç duyarsanız yedek dosyasından (JSON) tek tıkla geri yükleyebilirsiniz.
              </p>
            </div>
            <button
              id="btn-modal-quick-backup"
              type="button"
              onClick={onExportBackup}
              className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Yedek İndir</span>
            </button>
          </div>

          {/* Action selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Sıfırlama Yöntemini Seçin
            </label>

            {/* Option 1: Clean slate */}
            <div
              onClick={() => setSelectedAction('empty')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                selectedAction === 'empty'
                  ? 'border-rose-500 bg-rose-50/50 text-slate-900 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className={`mt-0.5 p-1.5 rounded-lg ${selectedAction === 'empty' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Tüm Verileri Sıfırla (0 Kayıt - Temiz Başlangıç)</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Önerilen</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Şantiyeler, personeller, puantajlar, giderler, cari hareketler, taşeronlar ve çekler dahil olmak üzere tüm operasyonel kayıtlar silinir. Kendi gerçek verilerinizi girmek için boş bir sistem oluşturulur.
                </p>
              </div>
            </div>

            {/* Option 2: Demo data */}
            <div
              onClick={() => setSelectedAction('demo')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                selectedAction === 'demo'
                  ? 'border-blue-500 bg-blue-50/50 text-slate-900 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <div className={`mt-0.5 p-1.5 rounded-lg ${selectedAction === 'demo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <RefreshCcw className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs">
                  Örnek (Demo) Verileri Tekrar Yükle
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Sistemi örnek şantiyeler, personel kadroları, şantiye giderleri ve örnek çeklerle doldurarak test moduna geri alır.
                </p>
              </div>
            </div>
          </div>

          {/* Confirm checkbox */}
          {selectedAction === 'empty' && totalRecords > 0 && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer select-none">
              <input
                id="checkbox-confirm-reset"
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-rose-950 font-medium leading-relaxed">
                Tüm veritabanı kayıtlarının kalıcı olarak silineceğini anladım ve onaylıyorum.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            id="btn-confirm-execute-reset"
            type="button"
            onClick={handleExecute}
            disabled={isProcessing || (selectedAction === 'empty' && !confirmChecked && totalRecords > 0)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
              selectedAction === 'empty'
                ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:bg-rose-300 disabled:cursor-not-allowed shadow-rose-600/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300 disabled:cursor-not-allowed shadow-blue-600/20'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Sıfırlanıyor...</span>
              </>
            ) : selectedAction === 'empty' ? (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tüm Verileri Sıfırla</span>
              </>
            ) : (
              <>
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Demo Verileri Yükle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
