import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Shield, 
  Building, 
  Phone, 
  CreditCard, 
  HardHat, 
  Filter, 
  Briefcase,
  Layers,
  ShieldCheck,
  Wallet,
  History
} from 'lucide-react';
import { Personnel, Santiye, Taseron } from '../types';
import { formatCurrency, formatIBAN } from '../utils/storage';
import { ExportButton } from './ExportButton';
import { ExportOptions } from '../utils/exportUtils';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface PersonnelListProps {
  personnelList: Personnel[];
  santiyeler: Santiye[];
  taseronlar: Taseron[];
  onEdit: (personnel: Personnel) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  allowedSantiyeIds?: string[];
  allowedTaseronIds?: string[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export const PersonnelList: React.FC<PersonnelListProps> = ({
  personnelList,
  santiyeler,
  taseronlar,
  onEdit,
  onDelete,
  onAddNew,
  allowedSantiyeIds = [],
  allowedTaseronIds = [],
  canEdit = true,
  canDelete = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedTaseron, setSelectedTaseron] = useState<string>('all');
  const [selectedDurum, setSelectedDurum] = useState<string>('Aktif');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Restrict sites and subcontractors according to user permissions
  const availableSantiyeler = useMemo(() => {
    if (!allowedSantiyeIds || allowedSantiyeIds.length === 0) return santiyeler;
    return santiyeler.filter((s) => allowedSantiyeIds.includes(s.id));
  }, [santiyeler, allowedSantiyeIds]);

  const availableTaseronlar = useMemo(() => {
    if (!allowedTaseronIds || allowedTaseronIds.length === 0) return taseronlar;
    return taseronlar.filter((t) => allowedTaseronIds.includes(t.id));
  }, [taseronlar, allowedTaseronIds]);

  const isRestricted = (allowedSantiyeIds && allowedSantiyeIds.length > 0) || (allowedTaseronIds && allowedTaseronIds.length > 0);

  const filteredList = useMemo(() => {
    return personnelList.filter((p) => {
      // Permission restrictions
      if (allowedSantiyeIds && allowedSantiyeIds.length > 0) {
        if (p.santiyeId && !allowedSantiyeIds.includes(p.santiyeId)) return false;
      }
      if (allowedTaseronIds && allowedTaseronIds.length > 0) {
        if (!p.taseronId || !allowedTaseronIds.includes(p.taseronId)) return false;
      }

      const matchesSearch =
        p.isim.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.soyisim.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.TCNO.includes(searchTerm) ||
        p.telefon.includes(searchTerm) ||
        p.Iban1.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.Iban2 && p.Iban2.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.kategori && p.kategori.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesSite = selectedSite === 'all' || p.santiyeId === selectedSite || p.santiye === selectedSite;
      const matchesTaseron = selectedTaseron === 'all' || p.taseronId === selectedTaseron || p.taseron === selectedTaseron;
      const matchesDurum = selectedDurum === 'all' || p.durum === selectedDurum;

      return matchesSearch && matchesSite && matchesTaseron && matchesDurum;
    });
  }, [personnelList, allowedSantiyeIds, allowedTaseronIds, searchTerm, selectedSite, selectedTaseron, selectedDurum]);

  const getPersonnelExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Adı Soyadı', dataKey: 'adSoyad', width: 30 },
      { header: 'TC Kimlik No', dataKey: 'tcNo', width: 25 },
      { header: 'Telefon', dataKey: 'telefon', width: 20 },
      { header: 'Kategori / Görev', dataKey: 'kategori', width: 25 },
      { header: 'Şantiye', dataKey: 'santiyeAdi', width: 25 },
      { header: 'Taşeron', dataKey: 'taseronAdi', width: 25 },
      { header: 'Net Maaş', dataKey: 'netMaas', width: 20, align: 'right' as const },
      { header: 'Resmi Maaş', dataKey: 'resmiMaas', width: 20, align: 'right' as const },
      { header: 'Elden Maaş', dataKey: 'eldenMaas', width: 20, align: 'right' as const },
      { header: 'Eski Bakiye', dataKey: 'eskiBakiye', width: 22, align: 'right' as const },
      { header: 'Durum', dataKey: 'durum', width: 15, align: 'center' as const },
      { header: 'Banka / IBAN', dataKey: 'iban', width: 40 },
    ];

    let totalNet = 0;
    let totalResmi = 0;
    let totalElden = 0;
    let totalEskiBakiye = 0;

    const data = filteredList.map((p) => {
      const site = santiyeler.find((s) => s.id === p.santiyeId || s.isim === p.santiye);
      const tas = taseronlar.find((t) => t.id === p.taseronId || t.isim === p.taseron);
      totalNet += p.netMaas || 0;
      totalResmi += p.resmiMaas || 0;
      totalElden += p.eldenMaas || 0;
      totalEskiBakiye += p.eskiBakiye || 0;

      return {
        adSoyad: `${p.isim} ${p.soyisim}`,
        tcNo: p.TCNO || '-',
        telefon: p.telefon || '-',
        kategori: p.kategori || '-',
        santiyeAdi: site?.isim || p.santiye || '-',
        taseronAdi: tas?.isim || p.taseron || '-',
        netMaas: formatCurrency(p.netMaas || 0),
        resmiMaas: formatCurrency(p.resmiMaas || 0),
        eldenMaas: formatCurrency(p.eldenMaas || 0),
        eskiBakiye: p.eskiBakiye !== undefined && p.eskiBakiye !== 0 ? formatCurrency(p.eskiBakiye) : '0,00 ₺',
        durum: p.durum || 'Aktif',
        iban: p.Iban1 ? formatIBAN(p.Iban1) : '-',
      };
    });

    return {
      title: 'Personel Listesi',
      subtitle: `Toplam Personel: ${filteredList.length} kişi | Filtre: ${selectedDurum}`,
      filename: `Personel_Listesi_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Personel Sayısı', value: `${filteredList.length} kişi` },
        { label: 'Toplam Net Maaş Tutarı', value: formatCurrency(totalNet) },
        { label: 'Toplam Resmi Maaş', value: formatCurrency(totalResmi) },
        { label: 'Toplam Elden Maaş', value: formatCurrency(totalElden) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-4">
      {/* Active Restriction Notification */}
      {isRestricted && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>Yetkilendirilmiş Personel Listesi Aktif</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-[10px] font-bold text-amber-900">
                  Kısıtlı Yetki
                </span>
              </div>
              <div className="text-amber-800 text-[11px] mt-0.5">
                Yalnızca izinli olduğunuz
                {allowedSantiyeIds && allowedSantiyeIds.length > 0 && ` ${availableSantiyeler.length} şantiye`}
                {allowedSantiyeIds && allowedSantiyeIds.length > 0 && allowedTaseronIds && allowedTaseronIds.length > 0 && ' ve'}
                {allowedTaseronIds && allowedTaseronIds.length > 0 && ` ${availableTaseronlar.length} taşerona ait`} personeller listelenmektedir ({filteredList.length} personel).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ad, Soyad, TC, Tel, IBAN ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
            />
          </div>

          {/* Şantiye Filtresi */}
          <div className="w-full sm:w-48">
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">Tüm Şantiyeler ({availableSantiyeler.length})</option>
              {availableSantiyeler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isim}
                </option>
              ))}
            </select>
          </div>

          {/* Taşeron Filtresi */}
          <div className="w-full sm:w-48">
            <select
              value={selectedTaseron}
              onChange={(e) => setSelectedTaseron(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">Tüm Taşeronlar ({availableTaseronlar.length})</option>
              {availableTaseronlar.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.isim || t.unvan}
                </option>
              ))}
            </select>
          </div>

          {/* Durum Filtresi */}
          <div className="w-full sm:w-32">
            <select
              value={selectedDurum}
              onChange={(e) => setSelectedDurum(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="Aktif">Aktif</option>
              <option value="Pasif">Pasif</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 font-medium">
          <span>Toplam <b>{filteredList.length}</b> personel listeleniyor</span>
          <ExportButton
            options={getPersonnelExportOptions}
            buttonText="Personelleri Dışa Aktar"
            variant="secondary"
          />
        </div>
      </div>

      {/* Personnel Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Personel Bulunamadı</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Arama kriterlerinize uygun kayıt bulunamadı. Filtreleri temizleyebilir veya yeni personel kartı oluşturabilirsiniz.
          </p>
          <button
            onClick={onAddNew}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            Yeni Personel Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredList.map((p) => {
            return (
              <div
                key={p.id}
                id={`personnel-card-${p.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Header with Avatar & Basic info */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {p.resim ? (
                        <img
                          src={p.resim}
                          alt={`${p.isim} ${p.soyisim}`}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                          {p.isim[0]}
                          {p.soyisim[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                            {p.isim} {p.soyisim}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.durum === 'Aktif'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {p.durum}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                          <span>{p.kategori || 'Genel Personel'}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600">TC: {p.TCNO}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (!canEdit) return;
                          onEdit(p);
                        }}
                        disabled={!canEdit}
                        title={!canEdit ? "Düzenleme yetkiniz bulunmamaktadır" : "Düzenle"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          !canEdit
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (!canDelete) return;
                          setDeleteConfirm({
                            isOpen: true,
                            title: 'Personeli Sil',
                            description: `"${p.isim} ${p.soyisim}" isimli personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                            onConfirm: () => onDelete(p.id),
                          });
                        }}
                        disabled={!canDelete}
                        title={!canDelete ? "Silme yetkiniz bulunmamaktadır" : "Sil"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          !canDelete
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Site & Subcontractor Badges */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
                    {/* Ücret Tipi Rozeti */}
                    {p.ucretTipi === 'aylik' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold text-xs">
                        <Briefcase className="w-3 h-3 text-blue-600" />
                        Aylık Sabit Maaşlı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-xs">
                        <HardHat className="w-3 h-3 text-emerald-600" />
                        Günlük Yevmiyeli
                      </span>
                    )}

                    {p.santiye && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        <Building className="w-3 h-3 text-amber-600" />
                        {p.santiye}
                      </span>
                    )}
                    {p.taseron ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium">
                        <Layers className="w-3 h-3 text-indigo-600" />
                        {p.taseron}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        Kendi Personelimiz
                      </span>
                    )}
                    {p.sigorta && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                        <Shield className="w-3 h-3 text-emerald-600" />
                        SGK
                      </span>
                    )}
                    {p.emekli && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-semibold border border-purple-200">
                        Emekli
                      </span>
                    )}
                  </div>

                  {/* Wage & Details Box */}
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5">
                    {p.ucretTipi === 'aylik' ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-900 font-bold flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                            Aylık Sabit Maaş:
                          </span>
                          <span className="text-sm font-black text-blue-900 bg-blue-100/60 px-2 py-0.5 rounded-lg border border-blue-200">
                            {formatCurrency(p.maas || p.yevmiye * 30)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span title="Aylık maaşın 30 güne bölümü">Günlük Karşılığı:</span>
                          <span className="font-semibold text-slate-700 font-mono">
                            {formatCurrency(p.yevmiye)} / gün
                            <span className="text-[10px] text-emerald-600 font-normal ml-1">(Otomatik)</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-bold flex items-center gap-1">
                            <HardHat className="w-3.5 h-3.5 text-emerald-600" />
                            Günlük Yevmiye:
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(p.yevmiye)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Aylık Karşılığı (30g):</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(p.maas || p.yevmiye * 30)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Saatlik Ücret:</span>
                      <span className="font-semibold text-slate-700 font-mono">
                        {formatCurrency(p.yevmiye / (p.gunlukCalismaSaati || 8))}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">({p.gunlukCalismaSaati || 8}s/gün)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Mesai Katsayısı:</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        {p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0}x
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({p.mesaiKatsayisi === 1.0 || !p.mesaiKatsayisi ? '1s = 1s' : `1s = ${p.mesaiKatsayisi}s`})
                        </span>
                      </span>
                    </div>
                    {/* Ücret Kademe Geçmişi Bilgisi */}
                    {Array.isArray(p.ucretGecmisi) && p.ucretGecmisi.length > 1 && (
                      <div className="flex items-center justify-between text-[11px] bg-blue-50/80 text-blue-900 px-2 py-1 rounded-lg border border-blue-200">
                        <span className="flex items-center gap-1 font-semibold">
                          <History className="w-3 h-3 text-blue-600" />
                          <span>Ücret Kademesi:</span>
                        </span>
                        <span className="font-bold font-mono">
                          {p.ucretGecmisi[p.ucretGecmisi.length - 1].gecerlilikBaslangic}'den beri ({p.ucretGecmisi.length} kademe)
                        </span>
                      </div>
                    )}
                    {/* Resmi Maaş & Günlük Kesinti Dağılımı */}
                    <div className="pt-1.5 mt-1 border-t border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-700 font-medium flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-indigo-500" />
                          Resmi Maaş:
                        </span>
                        <span className="font-bold text-indigo-900 font-mono">
                          {formatCurrency(p.resmiMaas !== undefined ? p.resmiMaas : 28075.5)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Günlük Resmi Kesinti:</span>
                        <span className="font-semibold text-emerald-700 font-mono">
                          {formatCurrency((p.resmiMaas !== undefined ? p.resmiMaas : 28075.5) / 30)}/gün
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Günlük Elden Payı:</span>
                        <span className="font-semibold text-amber-700 font-mono">
                          {formatCurrency(Math.max(0, p.yevmiye - ((p.resmiMaas !== undefined ? p.resmiMaas : 28075.5) / 30)))}/gün
                        </span>
                      </div>
                    </div>

                    {/* Eski Kalan Bakiye / Dönem Bazlı Harcama & Devir Bakiyeleri */}
                    {Array.isArray(p.donemBakiyeleri) && p.donemBakiyeleri.length > 0 ? (
                      <div className="pt-1.5 mt-1 border-t border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-800 font-semibold flex items-center gap-1 text-[11px]">
                            <Wallet className="w-3 h-3 text-amber-600" />
                            Dönem Bakiyeleri ({p.donemBakiyeleri.length} Ay):
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.donemBakiyeleri.map((db) => (
                            <span
                              key={db.id || db.donem}
                              title={db.aciklama || 'Dönem Bakiyesi'}
                              className={`font-bold font-mono text-[11px] px-1.5 py-0.5 rounded border ${
                                db.tutar >= 0
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {db.donem}: {db.tutar > 0 ? '+' : ''}
                              {formatCurrency(db.tutar)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      p.eskiBakiye !== undefined &&
                      p.eskiBakiye !== 0 && (
                        <div className="pt-1.5 mt-1 border-t border-slate-200/80 flex items-center justify-between">
                          <span className="text-amber-800 font-semibold flex items-center gap-1 text-[11px]">
                            <Wallet className="w-3 h-3 text-amber-600" />
                            Eski Kalan Bakiye{p.eskiBakiyeDonemi ? ` (${p.eskiBakiyeDonemi})` : ''}:
                          </span>
                          <span
                            className={`font-bold font-mono text-xs px-1.5 py-0.5 rounded ${
                              p.eskiBakiye > 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {p.eskiBakiye > 0 ? '+' : ''}
                            {formatCurrency(p.eskiBakiye)}
                            <span className="text-[10px] ml-1 font-normal font-sans">
                              ({p.eskiBakiye > 0 ? 'Alacaklı' : 'Avans Borçlu'})
                            </span>
                          </span>
                        </div>
                      )
                    )}

                    <div className="flex items-center justify-between text-slate-500">
                      <span>İşe Giriş:</span>
                      <span className="font-medium text-slate-700">
                        {p.girisTarihi || 'Belirtilmedi'}
                      </span>
                    </div>
                  </div>

                  {/* Contact & IBANs */}
                  <div className="mt-3 space-y-2 text-xs">
                    {/* Phone */}
                    <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.telefon || 'Telefon girilmemiş'}</span>
                      </div>
                      {p.telefon && (
                        <button
                          onClick={() => copyToClipboard(p.telefon, `tel-${p.id}`)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Telefonu Kopyala"
                        >
                          {copiedField === `tel-${p.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* IBAN 1 */}
                    <div className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                      <div className="overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">
                          1. IBAN (Ana Hesap)
                        </span>
                        <span className="font-mono text-xs text-slate-800 font-medium truncate block">
                          {formatIBAN(p.Iban1)}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(p.Iban1, `iban1-${p.id}`)}
                        className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                        title="IBAN 1 Kopyala"
                      >
                        {copiedField === `iban1-${p.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* IBAN 2 (if present) */}
                    {p.Iban2 && (
                      <div className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">
                            2. IBAN (Yedek Hesap)
                          </span>
                          <span className="font-mono text-xs text-slate-800 font-medium truncate block">
                            {formatIBAN(p.Iban2)}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(p.Iban2!, `iban2-${p.id}`)}
                          className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
                          title="IBAN 2 Kopyala"
                        >
                          {copiedField === `iban2-${p.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer link if available */}
                {p.link && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sözleşme & Özlük Dosyası</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Silme Onay Modalı */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
      />
    </div>
  );
};
