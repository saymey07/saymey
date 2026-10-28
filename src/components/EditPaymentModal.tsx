import React, { useState, useEffect } from 'react';
import { 
  X, 
  Receipt, 
  Calendar, 
  Clock, 
  DollarSign, 
  CreditCard, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Layers,
  Sparkles,
  Plus,
  Pencil,
  Tag,
  Check
} from 'lucide-react';
import { 
  Personnel, 
  PersonelOdeme, 
  SantiyeGider, 
  Taseron, 
  Santiye, 
  OdemeYontemi,
  Firma,
  FirmaCari
} from '../types';
import { 
  formatCurrency, 
  getCurrencySymbol, 
  DEFAULT_HAKEDIS_TURLERI, 
  getSavedHakedisTurleri, 
  saveHakedisTurleri 
} from '../utils/storage';
import { CurrencySelector } from './CurrencySelector';
import { PersonelHakedisCalculated } from './PersonnelPayroll';

// ==========================================
// 1. PERSONEL ÖDEME DÜZENLEME MODALI
// ==========================================
interface EditPersonelOdemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  odeme: PersonelOdeme | null;
  personnelList: Personnel[];
  santiyeler?: Santiye[];
  odemeYontemleri: OdemeYontemi[];
  payrollSummary?: PersonelHakedisCalculated[];
  onSave: (updated: PersonelOdeme) => void;
}

export const EditPersonelOdemeModal: React.FC<EditPersonelOdemeModalProps> = ({
  isOpen,
  onClose,
  odeme,
  personnelList,
  santiyeler = [],
  odemeYontemleri,
  payrollSummary = [],
  onSave,
}) => {
  const [personelId, setPersonelId] = useState('');
  const [santiyeId, setSantiyeId] = useState('');
  const [tarih, setTarih] = useState('');
  const [saat, setSaat] = useState('14:00');
  const [bordroDonemi, setBordroDonemi] = useState('');
  const [tur, setTur] = useState<'avans' | 'resmi' | 'harcama' | 'ceza'>('avans');
  const [miktar, setMiktar] = useState<number | ''>('');
  const [paraBirimi, setParaBirimi] = useState('TRY');
  const [odemeYontemi, setOdemeYontemi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (odeme) {
      setPersonelId(odeme.personelId);
      const person = personnelList.find((p) => p.id === odeme.personelId);
      setSantiyeId(odeme.santiyeId || person?.santiyeId || (santiyeler[0]?.id || ''));
      setTarih(odeme.tarih);
      setSaat(odeme.saat || '14:00');
      setBordroDonemi(odeme.bordroDonemi || (odeme.tarih ? odeme.tarih.slice(0, 7) : ''));
      setParaBirimi(odeme.paraBirimi || 'TRY');
      setOdemeYontemi(odeme.odemeYontemi || odemeYontemleri[0]?.isim || 'Nakit');
      setAciklama(odeme.aciklama || '');
      setError(null);

      const anyO = odeme as any;
      if (odeme.resmiOdeme > 0 || anyO.tur === 'resmi') {
        setTur('resmi');
        setMiktar(odeme.resmiOdeme || anyO.miktar || 0);
      } else if (odeme.yaptigiHarcama > 0 || anyO.tur === 'harcama') {
        setTur('harcama');
        setMiktar(odeme.yaptigiHarcama || anyO.miktar || 0);
      } else if (odeme.cezaMiktari > 0 || anyO.tur === 'ceza') {
        setTur('ceza');
        setMiktar(odeme.cezaMiktari || anyO.miktar || 0);
      } else {
        setTur('avans');
        setMiktar(odeme.avansOdemesi || anyO.miktar || 0);
      }
    }
  }, [odeme, odemeYontemleri, personnelList, santiyeler]);

  if (!isOpen || !odeme) return null;

  const currentPerson = personnelList.find((p) => p.id === personelId);
  const personHakedis = payrollSummary.find((item) => item.personnel.id === personelId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personelId) {
      setError('Lütfen bir personel seçiniz.');
      return;
    }
    const numMiktar = Number(miktar);
    if (!numMiktar || numMiktar <= 0) {
      setError('Lütfen geçerli ve 0 dan büyük bir ödeme tutarı giriniz.');
      return;
    }

    const chosenSite = santiyeler.find((s) => s.id === santiyeId);

    const updated: PersonelOdeme = {
      ...odeme,
      personelId,
      santiyeId: santiyeId || currentPerson?.santiyeId,
      santiyeAdi: chosenSite?.isim || currentPerson?.santiye,
      tarih,
      saat,
      bordroDonemi: bordroDonemi || (tarih ? tarih.slice(0, 7) : ''),
      avansOdemesi: tur === 'avans' ? numMiktar : 0,
      resmiOdeme: tur === 'resmi' ? numMiktar : 0,
      yaptigiHarcama: tur === 'harcama' ? numMiktar : 0,
      cezaMiktari: tur === 'ceza' ? numMiktar : 0,
      odemeYontemi: odemeYontemi || 'Nakit',
      paraBirimi: paraBirimi || 'TRY',
      aciklama: aciklama.trim(),
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Personel Ödemesini Düzenle</h3>
              <p className="text-xs text-slate-500">Mevcut ödeme kaydı ve hakediş tutarlarını güncelleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Personel Seçimi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Personel Seçimi</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={personelId}
              onChange={(e) => {
                const newPId = e.target.value;
                setPersonelId(newPId);
                const p = personnelList.find((item) => item.id === newPId);
                if (p?.santiyeId) {
                  setSantiyeId(p.santiyeId);
                }
              }}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
              required
            >
              {personnelList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.isim} {p.soyisim} ({p.kategori || 'Personel'} {p.santiye ? `• ${p.santiye}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* İlgili Şantiye Seçimi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>İlgili Şantiye (Gider Yazılan Şantiye)</span>
              <span className="text-rose-500">*</span>
            </label>
            <select
              value={santiyeId}
              onChange={(e) => setSantiyeId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
            >
              {santiyeler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isim}
                </option>
              ))}
              {!santiyeler.some((s) => s.id === santiyeId) && santiyeId && (
                <option value={santiyeId}>
                  {odeme.santiyeAdi || santiyeId} (Kayıtlı Şantiye)
                </option>
              )}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Bu ödeme seçilen şantiyenin giderlerine işlenir. Personel ileride başka bir şantiyeye geçse dahi bu gider burada sabit kalır.
            </p>
          </div>

          {/* Seçilen Personelin Hakediş Durum Kartı */}
          {personHakedis && (
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <span>{personHakedis.personnel.isim} {personHakedis.personnel.soyisim} — Güncel Durum</span>
                <span className="font-mono text-slate-700">{personHakedis.puantajGun.toFixed(1)} Gün Puantaj</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-200/70">
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block">Kalan Resmi (Banka)</span>
                  <span className="text-sm font-black text-indigo-950 font-mono block mt-0.5">
                    {formatCurrency(personHakedis.kalanResmiOdeme)}
                  </span>
                  <span className="text-[10px] text-indigo-600 block mt-0.5">
                    Ödenen: {formatCurrency(personHakedis.toplamResmiOdeme)}
                  </span>
                </div>
                <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/70">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block">Kalan Elden / Avans</span>
                  <span className="text-sm font-black text-amber-950 font-mono block mt-0.5">
                    {formatCurrency(personHakedis.kalanEldenOdeme)}
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5">
                    Alınan Avans: {formatCurrency(personHakedis.toplamAvans)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Bordro Dönemi & Tarih & Saat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bordro Dönemi</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={bordroDonemi}
                onChange={(e) => setBordroDonemi(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-indigo-200 bg-indigo-50/40 text-indigo-950 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              />
              <p className="text-[10px] text-indigo-700/80 mt-0.5">
                Mahsup edileceği bordro ayı
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>İşlem Tarihi</span>
              </label>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
                required
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Fiili ödeme günü
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Saat</span>
              </label>
              <input
                type="time"
                value={saat}
                onChange={(e) => setSaat(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Ödeme Türü Seçimi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ödeme Türü <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                  tur === 'avans'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="editTur"
                  checked={tur === 'avans'}
                  onChange={() => setTur('avans')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="font-semibold">Elden Avans</div>
                  <div className="text-[10px] text-slate-500 font-normal">Hakedişten düşer</div>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                  tur === 'resmi'
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="editTur"
                  checked={tur === 'resmi'}
                  onChange={() => setTur('resmi')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold">Resmi Banka Maaşı</div>
                  <div className="text-[10px] text-slate-500 font-normal">Banka hesabına havale</div>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                  tur === 'harcama'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="editTur"
                  checked={tur === 'harcama'}
                  onChange={() => setTur('harcama')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold">Harcama İadesi</div>
                  <div className="text-[10px] text-slate-500 font-normal">Personele eklenir</div>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-all ${
                  tur === 'ceza'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="editTur"
                  checked={tur === 'ceza'}
                  onChange={() => setTur('ceza')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <div className="font-semibold">Ceza / Kesinti</div>
                  <div className="text-[10px] text-slate-500 font-normal">Hakedişten kesilir</div>
                </div>
              </label>
            </div>
          </div>

          {/* Tutar & Para Birimi & Ödeme Yöntemi */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Ödeme Tutarı ({getCurrencySymbol(paraBirimi)})</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={miktar}
                onChange={(e) => setMiktar(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Örn: 5000"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Para Birimi
              </label>
              <CurrencySelector
                value={paraBirimi}
                onChange={setParaBirimi}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Ödeme Yöntemi</span>
              </label>
              <select
                value={odemeYontemi}
                onChange={(e) => setOdemeYontemi(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
              >
                {odemeYontemleri.map((y) => (
                  <option key={y.id} value={y.isim}>
                    {y.isim}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Açıklama / Not</span>
            </label>
            <input
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Örn: 1. Hafta avansı, şantiye elden teslim edildi"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-hidden transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Değişiklikleri Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. TAŞERON HAKEDİŞ ÖDEMESİ DÜZENLEME MODALI
// ==========================================
interface EditTaseronOdemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  gider: SantiyeGider | null;
  taseronlar: Taseron[];
  santiyeler: Santiye[];
  odemeYontemleri: OdemeYontemi[];
  firmalar?: Firma[];
  onSave: (updated: SantiyeGider, cariHareket?: FirmaCari) => void;
}

export const EditTaseronOdemeModal: React.FC<EditTaseronOdemeModalProps> = ({
  isOpen,
  onClose,
  gider,
  taseronlar,
  santiyeler,
  odemeYontemleri,
  firmalar = [],
  onSave,
}) => {
  const [taseronIsmi, setTaseronIsmi] = useState('');
  const [santiyeId, setSantiyeId] = useState('');
  const [tarih, setTarih] = useState('');
  const [miktar, setMiktar] = useState<number | ''>('');
  const [paraBirimi, setParaBirimi] = useState('TRY');
  const [odemeYontemi, setOdemeYontemi] = useState('');
  const [durum, setDurum] = useState<'Ödendi' | 'Beklemede' | 'İptal'>('Ödendi');
  const [hakedisTuru, setHakedisTuru] = useState('Metraj Hakedişi (Ahşap işleri)');
  const [hakedisTurleriList, setHakedisTurleriList] = useState<string[]>(() => getSavedHakedisTurleri());
  const [isNewTypeMode, setIsNewTypeMode] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [syncToCari, setSyncToCari] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAddNewType = () => {
    const val = newTypeName.trim();
    if (!val) return;
    const updated = Array.from(new Set([...hakedisTurleriList, val]));
    setHakedisTurleriList(updated);
    saveHakedisTurleri(updated);
    setHakedisTuru(val);
    setNewTypeName('');
    setIsNewTypeMode(false);
  };

  useEffect(() => {
    if (gider) {
      setTaseronIsmi(gider.taseron || gider.odemeYapilanFirma || taseronlar[0]?.isim || '');
      setSantiyeId(gider.santiyeId || santiyeler[0]?.id || '');
      setTarih(gider.tarih);
      setMiktar(gider.miktar);
      setParaBirimi(gider.paraBirimi || 'TRY');
      setOdemeYontemi(gider.odemeYontemi || odemeYontemleri[0]?.isim || 'Banka Transferi');
      setDurum(gider.durum || 'Ödendi');
      setSyncToCari(true);
      
      // Parse description if it has [Type] prefix
      const desc = gider.aciklama || '';
      const match = desc.match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        setHakedisTuru(match[1]);
        setAciklama(match[2]);
      } else {
        setAciklama(desc);
      }
      setError(null);
    }
  }, [gider, taseronlar, santiyeler, odemeYontemleri]);

  if (!isOpen || !gider) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taseronIsmi) {
      setError('Lütfen bir taşeron seçiniz.');
      return;
    }
    const numMiktar = Number(miktar);
    if (!numMiktar || numMiktar <= 0) {
      setError('Lütfen geçerli ve 0 dan büyük bir tutar giriniz.');
      return;
    }

    const cleanAciklama = aciklama.trim();
    const finalAciklama = `[${hakedisTuru}] ${cleanAciklama}`.trim();

    let cariHareket: FirmaCari | undefined = undefined;
    let finalCariHareketId = gider.cariHareketId;
    let finalCariFirmaId = gider.cariFirmaId;

    if (syncToCari) {
      const matchingFirma = firmalar.find(
        (f) =>
          f.isim.trim().toLowerCase() === taseronIsmi.trim().toLowerCase() ||
          (gider.cariFirmaId && f.id === gider.cariFirmaId)
      );
      finalCariFirmaId = matchingFirma?.id || gider.cariFirmaId || `f-${Date.now()}`;
      finalCariHareketId = gider.cariHareketId || `fc-tas-gider-${Date.now()}`;

      const chosenSite = santiyeler.find((s) => s.id === (santiyeId || santiyeler[0]?.id));

      cariHareket = {
        id: finalCariHareketId,
        firmaId: finalCariFirmaId,
        borc: 0,
        alacak: numMiktar,
        paraBirimi: paraBirimi || 'TRY',
        tarih,
        saat: '12:00',
        faturaNo: `HAK-${Date.now().toString().slice(-4)}`,
        aciklama: `[Taşeron Hakediş Ödemesi] ${taseronIsmi}${chosenSite ? ` [${chosenSite.isim}]` : ''} - ${finalAciklama}`,
        islemTuru: 'odeme',
        hedefParaBirimi: paraBirimi || 'TRY',
        hedefDusulenTutar: numMiktar,
        giderId: gider.id,
        santiyeId: chosenSite?.id,
        santiyeAdi: chosenSite?.isim,
      };
    }

    const updated: SantiyeGider = {
      ...gider,
      santiyeId: santiyeId || santiyeler[0]?.id || '',
      taseron: taseronIsmi,
      odemeYapilanFirma: taseronIsmi,
      tarih,
      miktar: numMiktar,
      paraBirimi: paraBirimi || 'TRY',
      odemeYontemi,
      durum,
      aciklama: finalAciklama,
      kategori: 'Taşeron Hakediş',
      cariHareketId: finalCariHareketId,
      cariFirmaId: finalCariFirmaId,
    };

    onSave(updated, cariHareket);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Taşeron Hakediş Ödemesini Düzenle</h3>
              <p className="text-xs text-slate-500">Doğrudan taşerona yapılan hakediş veya sözleşme ödemesini güncelleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Taşeron ve Şantiye Seçimi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Taşeron Firma / Ekip</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={taseronIsmi}
                onChange={(e) => setTaseronIsmi(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              >
                {taseronlar.map((t) => (
                  <option key={t.id} value={t.isim}>
                    {t.isim} {t.uzmanlik ? `(${t.uzmanlik})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>İlgili Şantiye</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={santiyeId}
                onChange={(e) => setSantiyeId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              >
                {santiyeler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.isim}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hakediş Türü / Başlığı */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Hakediş / Ödeme Türü</span>
              </label>
              <button
                type="button"
                onClick={() => setIsNewTypeMode(!isNewTypeMode)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {isNewTypeMode ? (
                  <>
                    <X className="w-3 h-3" />
                    <span>Listeden Seç</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>Yeni Tür Ekle</span>
                  </>
                )}
              </button>
            </div>

            {isNewTypeMode ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Yeni hakediş / ödeme türü adı giriniz..."
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewType();
                    }
                  }}
                  autoFocus
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-indigo-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddNewType}
                  disabled={!newTypeName.trim()}
                  className={`px-3 py-2 text-xs font-bold text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1 ${
                    newTypeName.trim()
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Ekle</span>
                </button>
              </div>
            ) : (
              <select
                value={hakedisTuru}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsNewTypeMode(true);
                  } else {
                    setHakedisTuru(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              >
                {Array.from(new Set([...hakedisTurleriList, ...(hakedisTuru ? [hakedisTuru] : [])])).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__NEW__">+ Yeni Hakediş / Ödeme Türü Tanımla...</option>
              </select>
            )}
          </div>

          {/* Tutar, Para Birimi & Tarih */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Ödenen Tutar ({getCurrencySymbol(paraBirimi)})</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={miktar}
                onChange={(e) => setMiktar(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Örn: 75000"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Para Birimi
              </label>
              <CurrencySelector
                value={paraBirimi}
                onChange={setParaBirimi}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Ödeme Tarihi</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              />
            </div>
          </div>

          {/* Ödeme Yöntemi & Durum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Ödeme Yöntemi</span>
              </label>
              <select
                value={odemeYontemi}
                onChange={(e) => setOdemeYontemi(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              >
                {odemeYontemleri.map((y) => (
                  <option key={y.id} value={y.isim}>
                    {y.isim}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ödeme Durumu
              </label>
              <select
                value={durum}
                onChange={(e) => setDurum(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              >
                <option value="Ödendi">Ödendi (İşlem Tamamlandı)</option>
                <option value="Beklemede">Beklemede (Onay Bekliyor)</option>
                <option value="İptal">İptal Edildi</option>
              </select>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Açıklama / Metraj & Hakediş Detayı</span>
            </label>
            <textarea
              rows={2}
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Örn: Blok A 3. Kat tabliye betonu ve kalıp işçiliği 2. hakedişi"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all resize-none"
            />
          </div>

          {/* Taşeron Firma Cari Entegrasyonu Bilgi & Onay Kutusu */}
          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-indigo-700 shrink-0" />
              <div>
                <span className="font-bold text-indigo-950 block">
                  Taşeron Firma Cari Hesabını Otomatik Güncelle
                </span>
                <span className="text-[11px] text-indigo-700">
                  Bu ödeme tutarı taşeronun Firma Cari hesabındaki "Ödeme (Alacak)" kaydıyla senkronize tutulur.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
              <input
                type="checkbox"
                checked={syncToCari}
                onChange={(e) => setSyncToCari(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Değişiklikleri Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
