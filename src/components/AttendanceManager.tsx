import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Download, 
  Filter, 
  Plus, 
  Trash2, 
  AlertCircle,
  Pencil,
  Zap,
  Building,
  CheckSquare,
  Square,
  Users,
  X,
  TrendingUp,
  Search,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { 
  Personnel, 
  Puantaj, 
  Mesai, 
  CalismaDurumu, 
  CALISMA_DURUMU_CONFIG, 
  Santiye 
} from '../types';
import { formatCurrency, getTodayDateString } from '../utils/storage';
import { getEffectiveWageForPersonnel } from '../utils/personnelBalance';
import { ExportButton } from './ExportButton';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ExportOptions } from '../utils/exportUtils';

const OVERTIME_HOURS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

interface AttendanceManagerProps {
  personnelList: Personnel[];
  puantajList: Puantaj[];
  mesaiList: Mesai[];
  santiyeler: Santiye[];
  onUpdatePuantaj: (personelId: string, tarih: string, durum: CalismaDurumu | null, not?: string) => void;
  onSetAllDaily: (tarih: string, durum: CalismaDurumu, santiyeFilter?: string) => void;
  onClearDaily?: (tarih: string, santiyeFilter?: string) => void;
  onClearMonth?: (month: string, santiyeFilter?: string) => void;
  onFillSalariedMonth?: (month: string, santiyeFilter?: string) => void;
  onFillSalariedDaily?: (tarih: string, santiyeFilter?: string) => void;
  onAddMesai: (mesai: Mesai) => void;
  onUpdateMesai: (mesai: Mesai) => void;
  onAddBulkMesai: (mesailer: Mesai[]) => void;
  onDeleteMesai: (id: string) => void;
  canManagePayroll?: boolean;
  allowedSantiyeIds?: string[];
  allowedTaseronIds?: string[];
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  personnelList: rawPersonnelList,
  puantajList,
  mesaiList,
  santiyeler: rawSantiyeler,
  onUpdatePuantaj,
  onSetAllDaily,
  onClearDaily,
  onClearMonth,
  onFillSalariedMonth,
  onFillSalariedDaily,
  onAddMesai,
  onUpdateMesai,
  onAddBulkMesai,
  onDeleteMesai,
  canManagePayroll = true,
  allowedSantiyeIds = [],
  allowedTaseronIds = [],
}) => {
  // Filter sites and personnel based on user's site and subcontractor assignment
  const santiyeler = useMemo(() => {
    if (!allowedSantiyeIds || allowedSantiyeIds.length === 0) return rawSantiyeler;
    return rawSantiyeler.filter((s) => allowedSantiyeIds.includes(s.id));
  }, [rawSantiyeler, allowedSantiyeIds]);

  const personnelList = useMemo(() => {
    return rawPersonnelList.filter((p) => {
      const siteMatch =
        !allowedSantiyeIds ||
        allowedSantiyeIds.length === 0 ||
        (p.santiyeId ? allowedSantiyeIds.includes(p.santiyeId) : true);
      const taseronMatch =
        !allowedTaseronIds ||
        allowedTaseronIds.length === 0 ||
        (p.taseronId ? allowedTaseronIds.includes(p.taseronId) : false);
      return siteMatch && taseronMatch;
    });
  }, [rawPersonnelList, allowedSantiyeIds, allowedTaseronIds]);

  const [subView, setSubView] = useState<'daily' | 'monthly' | 'monthly_mesai' | 'overtime'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [mesaiSiteFilter, setMesaiSiteFilter] = useState<string>('all');

  // Silme Onay Modalı Durumu
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: 'Kaydı Sil',
    description: '',
    onConfirm: () => {},
  });

  // Month navigation for monthly view
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal state for quick cell edit in monthly overtime matrix
  const [cellMesaiModal, setCellMesaiModal] = useState<{
    person: Personnel;
    dateStr: string;
    existingMesai?: Mesai;
    saat: number;
    mesaiSaatAraligi: string;
    aciklama: string;
  } | null>(null);

  // Modal state for adding single overtime
  const [isMesaiModalOpen, setIsMesaiModalOpen] = useState(false);
  const [modalSantiyeId, setModalSantiyeId] = useState<string>('all');
  const [newMesai, setNewMesai] = useState<{
    personelId: string;
    tarih: string;
    mesaiSaatAraligi: string;
    saat: number;
    aciklama: string;
  }>({
    personelId: personnelList[0]?.id || '',
    tarih: getTodayDateString(),
    mesaiSaatAraligi: '18:00 - 21:00',
    saat: 3,
    aciklama: '',
  });

  // Modal state for bulk overtime (Şantiye Toplu Mesai)
  const [isBulkMesaiModalOpen, setIsBulkMesaiModalOpen] = useState(false);
  const [bulkSantiyeId, setBulkSantiyeId] = useState<string>(santiyeler[0]?.id || '');
  const [bulkTarih, setBulkTarih] = useState<string>(getTodayDateString());
  const [bulkHours, setBulkHours] = useState<number>(4);
  const [bulkSaatAraligi, setBulkSaatAraligi] = useState<string>('18:00 - 22:00');
  const [bulkAciklama, setBulkAciklama] = useState<string>('');
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  // Modal state for editing existing overtime record
  const [editingMesai, setEditingMesai] = useState<Mesai | null>(null);

  // Kendi Personelimiz kontrolü (Taşeronu olmayan veya doğrudan şirket bünyesi personelleri)
  const isKendiPersonelimiz = useCallback((p: Personnel): boolean => {
    const noTaseron = !p.taseron || p.taseron.trim() === '' || p.taseron.trim().toLowerCase() === 'kendi personelimiz';
    const santiyeKendi = p.santiye === 'Kendi Personelimiz' ||
                         p.santiyeId === 'kendi_personelimiz' ||
                         p.santiye === 'Merkez' ||
                         !p.santiye ||
                         p.santiye.trim() === '' ||
                         !p.santiyeId;
    return noTaseron || santiyeKendi;
  }, []);

  const getPersonnelForSite = useCallback((siteId: string): Personnel[] => {
    if (siteId === 'all') {
      return personnelList.filter((p) => p.durum === 'Aktif');
    }
    if (siteId === 'kendi_personelimiz') {
      return personnelList.filter((p) => p.durum === 'Aktif' && isKendiPersonelimiz(p));
    }
    const siteObj = santiyeler.find((s) => s.id === siteId);
    return personnelList.filter(
      (p) => p.durum === 'Aktif' && (p.santiyeId === siteId || p.santiye === siteObj?.isim)
    );
  }, [personnelList, santiyeler, isKendiPersonelimiz]);

  // Filtered personnel
  const activePersonnel = useMemo(() => {
    return getPersonnelForSite(selectedSiteFilter);
  }, [getPersonnelForSite, selectedSiteFilter]);

  // Personnel search query for monthly matrices (Aylık Puantaj Matrisi & Aylık Mesai Matrisi)
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');

  // Personnel filtered by search query in monthly matrix views
  const filteredMatrixPersonnel = useMemo(() => {
    const query = matrixSearchQuery.trim().toLowerCase();
    if (!query) return activePersonnel;
    return activePersonnel.filter((p) => {
      const fullName = `${p.isim} ${p.soyisim}`.toLowerCase();
      const tc = (p.TCNO || '').toLowerCase();
      const santiye = (p.santiye || '').toLowerCase();
      const kategori = (p.kategori || '').toLowerCase();
      return (
        fullName.includes(query) ||
        tc.includes(query) ||
        santiye.includes(query) ||
        kategori.includes(query)
      );
    });
  }, [activePersonnel, matrixSearchQuery]);

  // Helper to check if a personnel is salaried (aylık sabit ücretli)
  const isSalariedPersonnel = useCallback((p?: Personnel, dateOrMonth?: string): boolean => {
    if (!p) return false;
    return getEffectiveWageForPersonnel(p, dateOrMonth || selectedMonth).isAylik;
  }, [selectedMonth]);

  // Helper to check if a date/month is in a future month relative to today's month
  const currentMonthStr = useMemo(() => getTodayDateString().slice(0, 7), []);
  const isDateInFutureMonth = useCallback((dateOrMonth: string): boolean => {
    return dateOrMonth.slice(0, 7) > currentMonthStr;
  }, [currentMonthStr]);

  // Helper to get puantaj record (yalnızca puantaj matrisinde işaretlenmiş veya 'Maaşlıları Doldur' ile eklenmiş kayıtları döner)
  const getRecord = useCallback((personelId: string, date: string): CalismaDurumu | null => {
    const match = puantajList.find((p) => p.personelId === personelId && p.tarih === date);
    if (match) {
      if (match.calismaDurumu === 'Boş') return null;
      return match.calismaDurumu;
    }
    return null;
  }, [puantajList]);

  // Helper to check whether a puantaj state is auto-filled for a salaried personnel
  const isAutoFilledForSalaried = useCallback((_personelId: string, _date: string): boolean => {
    return false;
  }, []);

  // Count of active salaried personnel in current active list
  const salariedPersonnelCount = useMemo(() => {
    return activePersonnel.filter((p) => isSalariedPersonnel(p)).length;
  }, [activePersonnel, isSalariedPersonnel]);

  // Quick Status Picker state for contextMenu or fast modal
  const [quickPicker, setQuickPicker] = useState<{
    isOpen: boolean;
    personelId: string;
    personelName: string;
    isSalaried: boolean;
    dateStr: string;
    currentStatus: CalismaDurumu | null;
    x: number;
    y: number;
  } | null>(null);

  // Helper to get overtime hours for personnel on date
  const getMesaiHours = (personelId: string, date: string): number => {
    return mesaiList
      .filter((m) => m.personelId === personelId && m.tarih === date)
      .reduce((sum, m) => sum + m.saat, 0);
  };

  // Days in selected month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Month shift
  const handlePrevMonth = () => {
    const current = new Date(year, month - 2, 1);
    setSelectedMonth(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextMonth = () => {
    const current = new Date(year, month, 1);
    setSelectedMonth(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    );
  };

  // Export Monthly Timesheet to CSV
  const handleExportCSV = () => {
    const headers = [
      'Personel Adı',
      'TC Kimlik',
      'Şantiye',
      'Günlük Yevmiye',
      ...dayNumbers.map(d => {
        const dayDate = new Date(year, month - 1, d);
        const dayName = dayDate.toLocaleDateString('tr-TR', { weekday: 'short' });
        return `${d} (${dayName})`;
      }),
      'Toplam Gün',
      'Toplam Mesai (Saat)',
      'Tahmini Hakediş'
    ];
    
    const rows = filteredMatrixPersonnel.map((p) => {
      let totalDays = 0;
      let totalMesai = 0;

      const dayCells = dayNumbers.map((d) => {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const status = getRecord(p.id, dateStr);
        if (status) {
          const config = CALISMA_DURUMU_CONFIG[status];
          totalDays += config.katsayi;
          totalMesai += getMesaiHours(p.id, dateStr);
          return config.short;
        }
        totalMesai += getMesaiHours(p.id, dateStr);
        return '-';
      });

      const wageInfo = getEffectiveWageForPersonnel(p, selectedMonth);
      const isAylik = wageInfo.isAylik;
      const aylikMaas = wageInfo.effectiveMaas;
      const effectiveYevmiye = wageInfo.effectiveYevmiye;

      const dailyHours = wageInfo.dailyHours;
      const hourlyWage = effectiveYevmiye / dailyHours;
      const katsayi = wageInfo.mesaiKatsayisi;
      const totalEarned = (totalDays * effectiveYevmiye) + (totalMesai * hourlyWage * katsayi);

      return [
        `"${p.isim} ${p.soyisim}"`,
        `"${p.TCNO}"`,
        `"${p.santiye || ''}"`,
        isAylik ? `${formatCurrency(effectiveYevmiye)} (Maaşlı)` : p.yevmiye,
        ...dayCells,
        totalDays.toFixed(1),
        totalMesai,
        totalEarned.toFixed(0),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Puantaj_Mesai_Cetveli_${selectedMonth}.csv`;
    link.click();
  };

  // Export Monthly Overtime Matrix to CSV
  const handleExportMesaiCSV = () => {
    const headers = [
      'Personel Adı',
      'TC Kimlik',
      'Şantiye',
      'Kategori',
      'Günlük Yevmiye',
      'Mesai Katsayısı',
      'Saatlik Mesai Birim Ücreti',
      ...dayNumbers.map((d) => `${d} ${selectedMonth}`),
      'Mesai Günü Sayısı',
      'Toplam Mesai (Saat)',
      'Toplam Mesai Hakedişi (TL)',
    ];

    const rows = filteredMatrixPersonnel.map((p) => {
      let totalDaysWithMesai = 0;
      let totalMesaiHours = 0;

      const dayCells = dayNumbers.map((d) => {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const mesaiRec = mesaiList.find((m) => m.personelId === p.id && m.tarih === dateStr);
        if (mesaiRec && mesaiRec.saat > 0) {
          totalDaysWithMesai += 1;
          totalMesaiHours += mesaiRec.saat;
          return `${mesaiRec.saat}s`;
        }
        return '-';
      });

      const dailyHours = p.gunlukCalismaSaati || 8;
      const hourlyWage = p.yevmiye / dailyHours;
      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
      const hourlyOvertimeRate = hourlyWage * katsayi;
      const totalOvertimeFee = totalMesaiHours * hourlyOvertimeRate;

      return [
        `"${p.isim} ${p.soyisim}"`,
        `"${p.TCNO}"`,
        `"${p.santiye || ''}"`,
        `"${p.kategori || ''}"`,
        p.yevmiye,
        katsayi,
        hourlyOvertimeRate.toFixed(2),
        ...dayCells,
        totalDaysWithMesai,
        totalMesaiHours,
        totalOvertimeFee.toFixed(2),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Aylik_Mesai_Matrisi_${selectedMonth}.csv`;
    link.click();
  };

  // Export options for Monthly Puantaj Sheet
  const getMonthlyPuantajExportOptions = (): ExportOptions => {
    const columns: ExportOptions['columns'] = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' },
      { header: 'Personel', dataKey: 'adSoyad', width: 28 },
      { header: 'Şantiye', dataKey: 'santiye', width: 22 },
      { header: 'Yevmiye', dataKey: 'yevmiye', width: 18, align: 'right' },
      ...dayNumbers.map(d => {
        const dayDate = new Date(year, month - 1, d);
        const dayName = dayDate.toLocaleDateString('tr-TR', { weekday: 'short' });
        return {
          header: `${d}\n${dayName}`,
          dataKey: `day_${d}`,
          width: 8,
          align: 'center' as const
        };
      }),
      { header: 'Top. Gün', dataKey: 'totalDays', width: 15, align: 'center' },
      { header: 'Mesai (Sa)', dataKey: 'totalMesai', width: 15, align: 'center' },
      { header: 'Hakediş', dataKey: 'totalEarned', width: 20, align: 'right' },
    ];

    let grandDays = 0;
    let grandMesai = 0;
    let grandEarned = 0;

    const data = filteredMatrixPersonnel.map((p) => {
      let totalDays = 0;
      let totalMesai = 0;
      const dayValues: Record<string, string> = {};

      dayNumbers.forEach((d) => {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const status = getRecord(p.id, dateStr);
        if (status) {
          const config = CALISMA_DURUMU_CONFIG[status];
          totalDays += config.katsayi;
          totalMesai += getMesaiHours(p.id, dateStr);
          dayValues[`day_${d}`] = config.short;
        } else {
          const m = getMesaiHours(p.id, dateStr);
          totalMesai += m;
          dayValues[`day_${d}`] = m > 0 ? `+${m}s` : '-';
        }
      });

      const wageInfo = getEffectiveWageForPersonnel(p, selectedMonth);
      const isAylik = wageInfo.isAylik;
      const aylikMaas = wageInfo.effectiveMaas;
      const effectiveYevmiye = wageInfo.effectiveYevmiye;

      const dailyHours = wageInfo.dailyHours;
      const hourlyWage = effectiveYevmiye / dailyHours;
      const katsayi = wageInfo.mesaiKatsayisi;
      const earned = (totalDays * effectiveYevmiye) + (totalMesai * hourlyWage * katsayi);

      grandDays += totalDays;
      grandMesai += totalMesai;
      grandEarned += earned;

      return {
        adSoyad: `${p.isim} ${p.soyisim}${isAylik ? ' (Maaşlı)' : ''}`,
        santiye: p.santiye || '-',
        yevmiye: isAylik ? `${formatCurrency(effectiveYevmiye)} (${formatCurrency(aylikMaas)}/ay)` : formatCurrency(p.yevmiye),
        ...dayValues,
        totalDays: `${totalDays.toFixed(1)} gün`,
        totalMesai: `${totalMesai} sa`,
        totalEarned: formatCurrency(earned),
      };
    });

    return {
      title: `Aylık Puantaj Çizelgesi (${selectedMonth})`,
      subtitle: `Dönem: ${selectedMonth} | Personel: ${filteredMatrixPersonnel.length} kişi`,
      filename: `Aylik_Puantaj_${selectedMonth}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Çalışılan Gün', value: `${grandDays.toFixed(1)} gün` },
        { label: 'Toplam Mesai Saati', value: `${grandMesai} saat` },
        { label: 'Genel Tahmini Hakediş', value: formatCurrency(grandEarned) },
      ],
      orientation: 'landscape',
    };
  };

  // Export options for Monthly Mesai Matrix
  const getMonthlyMesaiExportOptions = (): ExportOptions => {
    const columns: ExportOptions['columns'] = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' },
      { header: 'Personel', dataKey: 'adSoyad', width: 28 },
      { header: 'Şantiye', dataKey: 'santiye', width: 22 },
      { header: 'Saatlik Ücret', dataKey: 'hourlyRate', width: 18, align: 'right' },
      ...dayNumbers.map(d => ({
        header: String(d),
        dataKey: `day_${d}`,
        width: 8,
        align: 'center' as const
      })),
      { header: 'Mesai Günü', dataKey: 'mesaiDays', width: 15, align: 'center' },
      { header: 'Top. Saat', dataKey: 'totalHours', width: 15, align: 'center' },
      { header: 'Mesai Ücreti', dataKey: 'totalFee', width: 20, align: 'right' },
    ];

    let grandHours = 0;
    let grandFee = 0;

    const data = filteredMatrixPersonnel.map((p) => {
      const dailyHours = p.gunlukCalismaSaati || 8;
      const hourlyWage = p.yevmiye / dailyHours;
      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
      const hourlyRate = hourlyWage * katsayi;

      let totalHours = 0;
      let mesaiDays = 0;
      const dayValues: Record<string, string> = {};

      dayNumbers.forEach((d) => {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const m = getMesaiHours(p.id, dateStr);
        if (m > 0) {
          totalHours += m;
          mesaiDays += 1;
          dayValues[`day_${d}`] = `${m}s`;
        } else {
          dayValues[`day_${d}`] = '-';
        }
      });

      const totalFee = totalHours * hourlyRate;
      grandHours += totalHours;
      grandFee += totalFee;

      return {
        adSoyad: `${p.isim} ${p.soyisim}`,
        santiye: p.santiye || '-',
        hourlyRate: formatCurrency(hourlyRate),
        ...dayValues,
        mesaiDays: `${mesaiDays} gün`,
        totalHours: `${totalHours} sa`,
        totalFee: formatCurrency(totalFee),
      };
    });

    return {
      title: `Aylık Fazla Mesai Matrisi (${selectedMonth})`,
      subtitle: `Dönem: ${selectedMonth} | Toplam Personel: ${filteredMatrixPersonnel.length} kişi`,
      filename: `Aylik_Mesai_${selectedMonth}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Mesai Saati', value: `${grandHours} saat` },
        { label: 'Toplam Mesai Ücreti', value: formatCurrency(grandFee) },
      ],
      orientation: 'landscape',
    };
  };

  // Monthly overtime statistics for filteredMatrixPersonnel in selectedMonth
  const monthlyMesaiStats = useMemo(() => {
    let totalHours = 0;
    let totalCost = 0;
    const personWithMesaiSet = new Set<string>();

    filteredMatrixPersonnel.forEach((p) => {
      const dailyHours = p.gunlukCalismaSaati || 8;
      const hourlyWage = p.yevmiye / dailyHours;
      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
      const hourlyRate = hourlyWage * katsayi;

      dayNumbers.forEach((d) => {
        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const rec = mesaiList.find((m) => m.personelId === p.id && m.tarih === dateStr);
        if (rec && rec.saat > 0) {
          totalHours += rec.saat;
          totalCost += rec.saat * hourlyRate;
          personWithMesaiSet.add(p.id);
        }
      });
    });

    return {
      totalHours,
      totalCost,
      personnelCount: personWithMesaiSet.size,
    };
  }, [filteredMatrixPersonnel, dayNumbers, selectedMonth, mesaiList]);

  return (
    <div className="space-y-4">
      {/* Active Restriction Notification */}
      {((allowedSantiyeIds && allowedSantiyeIds.length > 0) || (allowedTaseronIds && allowedTaseronIds.length > 0)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>Yetkilendirilmiş Puantaj Görünümü Aktif</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/80 text-[10px] font-bold text-amber-900">
                  Kısıtlı Yetki
                </span>
              </div>
              <div className="text-amber-800 text-[11px] mt-0.5">
                Yalnızca izinli olduğunuz
                {allowedSantiyeIds && allowedSantiyeIds.length > 0 && ` ${santiyeler.length} şantiye`}
                {allowedSantiyeIds && allowedSantiyeIds.length > 0 && allowedTaseronIds && allowedTaseronIds.length > 0 && ' ve'}
                {allowedTaseronIds && allowedTaseronIds.length > 0 && ` ${allowedTaseronIds.length} taşerona ait`} personeller listelenmektedir ({personnelList.length} personel).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub navigation bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          <button
            id="subnav-daily"
            onClick={() => setSubView('daily')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              subView === 'daily'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Günlük Puantaj Girişi
          </button>
          <button
            id="subnav-monthly"
            onClick={() => setSubView('monthly')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              subView === 'monthly'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aylık Puantaj Matrisi
          </button>
          <button
            id="subnav-monthly-mesai"
            onClick={() => setSubView('monthly_mesai')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              subView === 'monthly_mesai'
                ? 'bg-white text-blue-700 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Aylık Mesai Matrisi</span>
          </button>
          <button
            id="subnav-overtime"
            onClick={() => setSubView('overtime')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              subView === 'overtime'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mesai Tablosu
          </button>
        </div>

        {/* Site selector & action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-full sm:w-52">
            <select
              value={selectedSiteFilter}
              onChange={(e) => setSelectedSiteFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-medium"
            >
              <option value="all">Tüm Şantiyeler</option>
              <option value="kendi_personelimiz">
                🏢 Kendi Personelimiz ({getPersonnelForSite('kendi_personelimiz').length} Kişi)
              </option>
              {santiyeler.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.isim}
                </option>
              ))}
            </select>
          </div>

          {subView === 'monthly_mesai' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const initialSiteId = selectedSiteFilter !== 'all' ? selectedSiteFilter : (santiyeler[0]?.id || 'kendi_personelimiz');
                  setBulkSantiyeId(initialSiteId);
                  const todayStr = getTodayDateString();
                  const targetDate = todayStr.startsWith(selectedMonth) ? todayStr : `${selectedMonth}-01`;
                  setBulkTarih(targetDate);
                  const pList = getPersonnelForSite(initialSiteId);
                  const eligibleIds = pList
                    .filter((p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === targetDate))
                    .map((p) => p.id);
                  setSelectedPersonnelIds(eligibleIds);
                  setBulkHours(4);
                  setBulkSaatAraligi('18:00 - 22:00');
                  setBulkAciklama('');
                  setIsBulkMesaiModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
                title="Şantiyedeki veya kendi personelimize seçilen günde toplu mesai uygula"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Şantiye Toplu Mesai</span>
              </button>
              <button
                onClick={() => {
                  const siteId = selectedSiteFilter;
                  setModalSantiyeId(siteId);
                  const filteredP = getPersonnelForSite(siteId);
                  const todayStr = getTodayDateString();
                  const targetDate = todayStr.startsWith(selectedMonth) ? todayStr : `${selectedMonth}-01`;
                  const firstEligible = filteredP.find((p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === targetDate));
                  setNewMesai({
                    personelId: firstEligible?.id || filteredP[0]?.id || personnelList[0]?.id || '',
                    tarih: targetDate,
                    mesaiSaatAraligi: '18:00 - 21:00',
                    saat: 3,
                    aciklama: '',
                  });
                  setIsMesaiModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Yeni Mesai Yaz</span>
              </button>
              <ExportButton
                options={getMonthlyMesaiExportOptions}
                buttonText="Mesai Çizelgesini Dışa Aktar"
                variant="secondary"
              />
            </div>
          )}

          {subView === 'overtime' && (
            <button
              onClick={() => setIsMesaiModalOpen(true)}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Yeni Mesai Yaz</span>
            </button>
          )}

          {subView === 'monthly' && (
            <div className="flex items-center gap-2 flex-wrap">
              {onFillSalariedMonth && salariedPersonnelCount > 0 && (
                <button
                  onClick={() => onFillSalariedMonth(selectedMonth, selectedSiteFilter)}
                  className="px-2.5 py-1.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  title="Maaşlı personellerin bu aydaki boş günlerini 'Tam Gün' olarak doldur"
                >
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Maaşlıları Doldur ({salariedPersonnelCount})</span>
                </button>
              )}
              {onClearMonth && (
                <button
                  onClick={() => {
                    setDeleteConfirm({
                      isOpen: true,
                      title: 'Aylık Puantajı Boşalt',
                      description: `${selectedMonth} dönemi için maaşlı personeller dahil tüm personellerin puantaj günleri boş olarak işaretlenecektir. Bu işlemi yapmak istediğinize emin misiniz?`,
                      onConfirm: () => onClearMonth(selectedMonth, selectedSiteFilter),
                    });
                  }}
                  className="px-2.5 py-1.5 border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                  title="Seçili aydaki maaşlı personeller dahil tüm puantaj günlerini boşalt"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Ayı Boşalt</span>
                </button>
              )}
              <ExportButton
                options={getMonthlyPuantajExportOptions}
                buttonText="Puantajı Dışa Aktar"
                variant="secondary"
              />
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: DAILY ATTENDANCE */}
      {subView === 'daily' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Daily Controls */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <CalendarIcon className="w-5 h-5 text-slate-500" />
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase">İşlem Tarihi</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 text-sm font-semibold rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Quick bulk action */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-medium">Hızlı Doldur:</span>
              <button
                onClick={() => onSetAllDaily(selectedDate, 'Tam Gün', selectedSiteFilter)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                Tümüne Tam Gün (1.0)
              </button>
              {onFillSalariedDaily && salariedPersonnelCount > 0 && (
                <button
                  onClick={() => onFillSalariedDaily(selectedDate, selectedSiteFilter)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1"
                  title="Maaşlı personellerin bugünkü puantajını Tam Gün olarak kaydet"
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  Maaşlıları Tam Gün Yap ({salariedPersonnelCount})
                </button>
              )}
              <button
                onClick={() => onSetAllDaily(selectedDate, 'Resmi Tatil', selectedSiteFilter)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                Resmi Tatil Yap
              </button>
              {onClearDaily && (
                <button
                  onClick={() => onClearDaily(selectedDate, selectedSiteFilter)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Seçili tarihteki tüm puantajları temizle"
                >
                  Günü Boşalt
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3">Personel</th>
                  <th className="px-4 py-3">Şantiye / Kategori</th>
                  <th className="px-4 py-3">Ücret Bilgisi</th>
                  <th className="px-4 py-3">Çalışma Durumu</th>
                  <th className="px-4 py-3">Günlük Ek Mesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePersonnel.map((p) => {
                  const currentStatus = getRecord(p.id, selectedDate);
                  const mesaiHours = getMesaiHours(p.id, selectedDate);
                  const isSalaried = isSalariedPersonnel(p);
                  const isAuto = isAutoFilledForSalaried(p.id, selectedDate);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                            {p.isim[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{p.isim} {p.soyisim}</span>
                              {isSalaried && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  💼 Maaşlı
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">TC: {p.TCNO}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{p.santiye || 'Belirtilmedi'}</div>
                        <div className="text-[11px] text-slate-400">{p.kategori}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {isSalaried ? (
                          <div>
                            <span className="text-indigo-900 font-bold">{p.maas ? formatCurrency(p.maas) : formatCurrency(p.yevmiye * 30)}</span>
                            <span className="text-[11px] text-slate-500 font-normal"> /ay</span>
                            <div className="text-[10px] text-slate-400 font-normal">
                              (~{formatCurrency(p.maas ? p.maas / 30 : p.yevmiye)}/gün)
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span>{formatCurrency(p.yevmiye)}</span>
                            <span className="text-[11px] text-slate-500 font-normal"> /yevmiye</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(
                            [
                              'Tam Gün',
                              'Yarım Gün',
                              'Fazla Mesaili',
                              'Ücretli İzin',
                              'Ücretsiz İzin',
                              'Gelmedi',
                              'Resmi Tatil',
                            ] as CalismaDurumu[]
                          ).map((status) => {
                            const isSelected = currentStatus === status;
                            return (
                              <button
                                key={status}
                                onClick={() => onUpdatePuantaj(p.id, selectedDate, isSelected ? (isSalaried ? 'Boş' : null) : status)}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? CALISMA_DURUMU_CONFIG[status].badge + ' ring-2 ring-slate-900 ring-offset-1 font-bold shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {status}
                              </button>
                            );
                          })}
                          {isSalaried && isAuto && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200" title="Maaşlı personel için otomatik dolu (Tam Gün) geldi.">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Otomatik Dolu
                            </span>
                          )}
                          {currentStatus && (
                            <button
                              onClick={() => onUpdatePuantaj(p.id, selectedDate, isSalaried ? 'Boş' : null)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                              title="Puantaj kaydını boş bırak"
                            >
                              Boş Bırak
                            </button>
                          )}
                          {!currentStatus && (
                            <span className="text-[11px] text-slate-400 italic ml-1">
                              (Boş)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {mesaiHours > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            +{mesaiHours} Saat Mesai
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Mesai Yok</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: MONTHLY MATRIX */}
      {subView === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Month Navigator & Search Header */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-slate-900">
                {selectedMonth} Dönemi Puantaj Matrisi
              </h3>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-medium">
                {filteredMatrixPersonnel.length} / {activePersonnel.length} Personel
              </span>
            </div>

            {/* Search and Legend */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
              {/* Personnel Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Personel ara (İsim, TC, Şantiye)..."
                  value={matrixSearchQuery}
                  onChange={(e) => setMatrixSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400 font-normal"
                />
                {matrixSearchQuery && (
                  <button
                    onClick={() => setMatrixSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Aramayı Temizle"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Legend */}
              <div className="hidden xl:flex items-center gap-1.5 text-xs flex-wrap">
                <span className="text-slate-500 font-medium mr-0.5">İşaretler:</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-300 ring-1 ring-emerald-200">
                  T: Maaşlı / Tam (1.0)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                  G: Gelmedi (0)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  R: Tatil (1.0)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                  Y: Yarım (0.5)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  M: Fazla Mesai
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                  -: Boş
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10 w-44 shadow-[1px_0_0_0_#e2e8f0]">Personel</th>
                  {dayNumbers.map((d) => {
                    const dayDate = new Date(year, month - 1, d);
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                    const dayName = dayDate.toLocaleDateString('tr-TR', { weekday: 'short' });
                    return (
                      <th
                        key={d}
                        className={`px-1 py-1.5 min-w-[32px] border-r border-slate-100 ${
                          isWeekend ? 'bg-amber-50/70 text-amber-900 font-bold' : 'text-slate-700'
                        }`}
                        title={`${d} ${selectedMonth} ${dayDate.toLocaleDateString('tr-TR', { weekday: 'long' })}`}
                      >
                        <div className="font-bold text-xs">{d}</div>
                        <div
                          className={`text-[9px] font-medium leading-tight ${
                            isWeekend ? 'text-amber-700 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {dayName}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 bg-slate-100/80 font-bold text-slate-800">Çalışılan Gün</th>
                  <th className="px-2 py-2 bg-blue-50/80 font-bold text-blue-800">Mesai (Saat)</th>
                  <th className="px-3 py-2 bg-emerald-50/80 font-bold text-emerald-800 text-right">Tahmini Hakediş</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrixPersonnel.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dayNumbers.length + 4}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="font-medium text-slate-700">
                          {matrixSearchQuery
                            ? `"${matrixSearchQuery}" ile eşleşen personel bulunamadı.`
                            : 'Seçilen kriterlere uygun personel bulunamadı.'}
                        </p>
                        {matrixSearchQuery && (
                          <button
                            onClick={() => setMatrixSearchQuery('')}
                            className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer mt-1"
                          >
                            Arama Filtresini Temizle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMatrixPersonnel.map((p) => {
                  let totalDays = 0;
                  let totalMesai = 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-left sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-100 whitespace-nowrap z-10">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{p.isim} {p.soyisim}</span>
                          {isSalariedPersonnel(p) && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title="Maaşlı Personel: Puantajı otomatik dolu gelir">
                              Maaşlı
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{p.kategori || 'Genel'}</span>
                          {isSalariedPersonnel(p) && (
                            <span className="text-indigo-600 font-medium">
                              • {p.maas ? formatCurrency(p.maas) : formatCurrency(p.yevmiye * 30)}/ay
                            </span>
                          )}
                        </div>
                      </td>

                      {dayNumbers.map((d) => {
                        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                        const dayDate = new Date(year, month - 1, d);
                        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                        const dayName = dayDate.toLocaleDateString('tr-TR', { weekday: 'long' });
                        const status = getRecord(p.id, dateStr);
                        const isSalaried = isSalariedPersonnel(p);
                        const isAuto = isAutoFilledForSalaried(p.id, dateStr);

                        if (status) {
                          const config = CALISMA_DURUMU_CONFIG[status];
                          totalDays += config.katsayi;
                        }
                        totalMesai += getMesaiHours(p.id, dateStr);

                        const cycleList: (CalismaDurumu | null)[] = isSalaried
                          ? [
                              'Tam Gün',
                              'Gelmedi',
                              'Resmi Tatil',
                              'Yarım Gün',
                              'Ücretsiz İzin',
                              'Ücretli İzin',
                              'Boş',
                            ]
                          : [
                              'Tam Gün',
                              'Yarım Gün',
                              'Fazla Mesaili',
                              'Gelmedi',
                              'Resmi Tatil',
                              null,
                            ];

                        const handleCellClick = () => {
                          let nextIdx = 0;
                          if (status !== null) {
                            const curIdx = cycleList.indexOf(status);
                            nextIdx = (curIdx + 1) % cycleList.length;
                          }
                          onUpdatePuantaj(p.id, dateStr, cycleList[nextIdx]);
                        };

                        const handleCellContextMenu = (e: React.MouseEvent) => {
                          e.preventDefault();
                          setQuickPicker({
                            isOpen: true,
                            personelId: p.id,
                            personelName: `${p.isim} ${p.soyisim}`,
                            isSalaried,
                            dateStr,
                            currentStatus: status,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        };

                        return (
                          <td
                            key={d}
                            className={`p-1 border-r border-slate-100/50 ${
                              isWeekend ? 'bg-amber-50/25' : ''
                            }`}
                            title={
                              isAuto
                                ? `${p.isim} - ${d} ${selectedMonth} ${dayName}: Maaşlı Otomatik (Tam Gün / Geldi)\n(Durumu değiştirmek için tıklayın veya sağ tıklayın)`
                                : status
                                ? `${p.isim} - ${d} ${selectedMonth} ${dayName}: ${status}\n(Durumu değiştirmek için tıklayın veya sağ tıklayın)`
                                : `${p.isim} - ${d} ${selectedMonth} ${dayName}: Boş (Tam Gün yapmak için tıklayın)`
                            }
                          >
                            <button
                              onClick={handleCellClick}
                              onContextMenu={handleCellContextMenu}
                              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] cursor-pointer transition-all ${
                                isAuto
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200/80 shadow-2xs hover:bg-emerald-100'
                                  : status
                                  ? CALISMA_DURUMU_CONFIG[status].badge + ' shadow-2xs'
                                  : 'text-slate-300 hover:text-slate-700 bg-white hover:bg-slate-100 border border-dashed border-slate-200 hover:border-slate-400'
                              }`}
                            >
                              {status ? CALISMA_DURUMU_CONFIG[status].short : '-'}
                            </button>
                          </td>
                        );
                      })}

                      {/* Summary Columns */}
                      <td className="px-2 py-2 bg-slate-50 font-bold text-slate-900">
                        {totalDays.toFixed(1)} Gün
                      </td>
                      <td className="px-2 py-2 bg-blue-50/50 font-bold text-blue-700">
                        {totalMesai} Saat
                      </td>
                      {(() => {
                        const isAylik = isSalariedPersonnel(p);
                        const aylikMaas = p.maas || (p.yevmiye > 0 ? p.yevmiye * 30 : 0);
                        const effectiveYevmiye = isAylik ? (aylikMaas > 0 ? aylikMaas / 30 : p.yevmiye) : p.yevmiye;

                        const dailyHours = p.gunlukCalismaSaati || 8;
                        const hourlyWage = effectiveYevmiye / dailyHours;
                        const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                        const mesaiTutari = totalMesai * hourlyWage * katsayi;
                        const toplamKazanc = totalDays * effectiveYevmiye + mesaiTutari;
                        return (
                          <td
                            className="px-3 py-2 bg-emerald-50/50 font-bold text-emerald-700 text-right whitespace-nowrap"
                            title={`${totalDays.toFixed(1)} gün (${formatCurrency(totalDays * effectiveYevmiye)}) + ${totalMesai}s mesai [${katsayi}x] (${formatCurrency(mesaiTutari)})`}
                          >
                            {formatCurrency(toplamKazanc)}
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2.5: MONTHLY OVERTIME MATRIX (Aylık Mesai Matrisi) */}
      {subView === 'monthly_mesai' && (
        <div className="space-y-4">
          {/* Top Month & Statistics Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                  title="Önceki Ay"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedMonth} Dönemi Aylık Mesai Matrisi
                  </h3>
                </div>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                  title="Sonraki Ay"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                  {filteredMatrixPersonnel.length} / {activePersonnel.length} Personel
                </span>
              </div>

              {/* Search and Legend */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                {/* Personnel Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Personel ara (İsim, TC, Şantiye)..."
                    value={matrixSearchQuery}
                    onChange={(e) => setMatrixSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400 font-normal"
                  />
                  {matrixSearchQuery && (
                    <button
                      onClick={() => setMatrixSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Aramayı Temizle"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-slate-500 font-medium">Göstergeler:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                    -: Mesai Yok
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                    1 - 3s: Normal
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                    4 - 7s: Yoğun
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-300">
                    8s+: Uzun / Vardiya
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Summary Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100">
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3">
                <div className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Toplam Mesai Saati</span>
                </div>
                <div className="text-xl font-bold text-blue-900 font-mono mt-1">
                  {monthlyMesaiStats.totalHours} <span className="text-sm font-normal">Saat</span>
                </div>
                <div className="text-[11px] text-blue-600 mt-0.5 font-medium">
                  {matrixSearchQuery ? 'Arama sonucundaki personeller' : `${selectedMonth} dönemi geneli`}
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Toplam Mesai Hakedişi</span>
                </div>
                <div className="text-xl font-bold text-emerald-900 font-mono mt-1">
                  {formatCurrency(monthlyMesaiStats.totalCost)}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                  Tahmini ödenecek mesai tutarı
                </div>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
                <div className="text-xs text-indigo-700 font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Mesai Yapan Personel</span>
                </div>
                <div className="text-xl font-bold text-indigo-900 font-mono mt-1">
                  {monthlyMesaiStats.personnelCount} <span className="text-sm font-normal text-indigo-700">/ {filteredMatrixPersonnel.length} Kişi</span>
                </div>
                <div className="text-[11px] text-indigo-600 mt-0.5 font-medium">
                  {filteredMatrixPersonnel.length > 0 ? `%${Math.round((monthlyMesaiStats.personnelCount / filteredMatrixPersonnel.length) * 100)} katılım` : 'Personel yok'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  <span>Ortalama / Personel</span>
                </div>
                <div className="text-xl font-bold text-slate-800 font-mono mt-1">
                  {monthlyMesaiStats.personnelCount > 0 ? (monthlyMesaiStats.totalHours / monthlyMesaiStats.personnelCount).toFixed(1) : '0'}{' '}
                  <span className="text-sm font-normal text-slate-500">Saat / Kişi</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  Mesai yapan personel ortalaması
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">
                      Personel & Şantiye
                    </th>
                    {dayNumbers.map((d) => {
                      const dayDate = new Date(year, month - 1, d);
                      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                      const dayName = dayDate.toLocaleDateString('tr-TR', { weekday: 'short' });
                      return (
                        <th
                          key={d}
                          className={`px-1 py-1.5 min-w-[32px] border-r border-slate-100 ${
                            isWeekend ? 'bg-amber-50/70 text-amber-900 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="font-bold">{d}</div>
                          <div className={`text-[9px] font-medium ${isWeekend ? 'text-amber-700' : 'text-slate-400'}`}>
                            {dayName}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 bg-slate-100/80 font-bold text-slate-800 min-w-[70px]">
                      Mesai Günü
                    </th>
                    <th className="px-2 py-2 bg-blue-50/80 font-bold text-blue-800 min-w-[80px]">
                      Toplam Mesai
                    </th>
                    <th className="px-2 py-2 bg-slate-100/80 font-bold text-slate-700 min-w-[80px]">
                      Saat Ücreti
                    </th>
                    <th className="px-3 py-2 bg-emerald-50/80 font-bold text-emerald-800 text-right min-w-[100px]">
                      Mesai Hakedişi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMatrixPersonnel.length === 0 ? (
                    <tr>
                      <td
                        colSpan={dayNumbers.length + 5}
                        className="py-12 text-center text-slate-400 text-sm"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Users className="w-8 h-8 text-slate-300" />
                          <p className="font-medium text-slate-700">
                            {matrixSearchQuery
                              ? `"${matrixSearchQuery}" ile eşleşen personel bulunamadı.`
                              : 'Seçilen kriterlere uygun aktif personel bulunamadı.'}
                          </p>
                          {matrixSearchQuery && (
                            <button
                              onClick={() => setMatrixSearchQuery('')}
                              className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer mt-1"
                            >
                              Arama Filtresini Temizle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMatrixPersonnel.map((p) => {
                      let totalDaysWithMesai = 0;
                      let totalMesaiHours = 0;

                      const dailyHours = p.gunlukCalismaSaati || 8;
                      const hourlyWage = p.yevmiye / dailyHours;
                      const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                      const hourlyOvertimeRate = hourlyWage * katsayi;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-3 py-2 text-left sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-100 whitespace-nowrap z-10 shadow-[1px_0_0_0_#f1f5f9]">
                            <div className="text-slate-900 font-bold text-xs sm:text-sm">
                              {p.isim} {p.soyisim}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 font-medium text-slate-700">
                                {p.santiye || 'Şantiye Yok'}
                              </span>
                              <span>•</span>
                              <span>{p.kategori}</span>
                            </div>
                          </td>

                          {dayNumbers.map((d) => {
                            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                            const dayDate = new Date(year, month - 1, d);
                            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                            const mesaiRec = mesaiList.find(
                              (m) => m.personelId === p.id && m.tarih === dateStr
                            );
                            const hasMesai = !!mesaiRec && mesaiRec.saat > 0;

                            if (hasMesai) {
                              totalDaysWithMesai += 1;
                              totalMesaiHours += mesaiRec.saat;
                            }

                            const cellCost = hasMesai ? mesaiRec.saat * hourlyOvertimeRate : 0;

                            return (
                              <td
                                key={d}
                                className={`p-1 border-r border-slate-100/70 text-center ${
                                  isWeekend ? 'bg-amber-50/30' : ''
                                }`}
                                title={
                                  hasMesai
                                    ? `${p.isim} ${p.soyisim} • ${d} ${selectedMonth}\nMesai: ${mesaiRec.saat} Saat (${mesaiRec.mesaiSaatAraligi})\nHakediş: ${formatCurrency(cellCost)} (${mesaiRec.saat}s × ${formatCurrency(hourlyOvertimeRate)})\n${mesaiRec.aciklama ? 'Not: ' + mesaiRec.aciklama + '\n' : ''}(Düzenlemek veya silmek için tıklayın)`
                                    : `${p.isim} ${p.soyisim} • ${d} ${selectedMonth}\nMesai Yok\n(Mesai eklemek için tıklayın)`
                                }
                              >
                                <button
                                  onClick={() => {
                                    setCellMesaiModal({
                                      person: p,
                                      dateStr,
                                      existingMesai: mesaiRec,
                                      saat: mesaiRec ? mesaiRec.saat : 3,
                                      mesaiSaatAraligi: mesaiRec ? mesaiRec.mesaiSaatAraligi : '18:00 - 21:00',
                                      aciklama: mesaiRec ? mesaiRec.aciklama || '' : '',
                                    });
                                  }}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] cursor-pointer transition-all mx-auto ${
                                    hasMesai
                                      ? mesaiRec.saat >= 8
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 shadow-2xs'
                                        : mesaiRec.saat >= 4
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200 shadow-2xs'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 shadow-2xs'
                                      : 'text-slate-300 hover:text-blue-700 bg-white hover:bg-blue-50/60 border border-dashed border-slate-200 hover:border-blue-300'
                                  }`}
                                >
                                  {hasMesai ? `${mesaiRec.saat}s` : '-'}
                                </button>
                              </td>
                            );
                          })}

                          {/* Person Summary Columns */}
                          <td className="px-2 py-2 bg-slate-50/60 font-semibold text-slate-800 font-mono">
                            {totalDaysWithMesai > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                                {totalDaysWithMesai} Gün
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2 bg-blue-50/50 font-bold text-blue-700 font-mono">
                            {totalMesaiHours > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                                {totalMesaiHours} Saat
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2 bg-slate-50/60 text-slate-600 font-mono text-[11px]">
                            {formatCurrency(hourlyOvertimeRate)}/s
                          </td>
                          <td className="px-3 py-2 bg-emerald-50/50 font-bold text-emerald-700 text-right whitespace-nowrap font-mono">
                            {totalMesaiHours > 0 ? (
                              <span title={`${totalMesaiHours} saat × ${formatCurrency(hourlyOvertimeRate)} (${katsayi}x katsayı)`}>
                                {formatCurrency(totalMesaiHours * hourlyOvertimeRate)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Table Footer: Daily Totals Across All Filtered Personnel */}
                {filteredMatrixPersonnel.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                    <tr>
                      <td className="px-3 py-2.5 text-left sticky left-0 bg-slate-100 z-10 whitespace-nowrap shadow-[1px_0_0_0_#cbd5e1]">
                        <div className="flex items-center gap-1.5 text-slate-900">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>GÜNLÜK TOPLAM MESAİ</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {matrixSearchQuery ? 'Aramadaki personellerin günlük mesaisi' : 'Seçili personellerin günlük mesai saati'}
                        </div>
                      </td>
                      {dayNumbers.map((d) => {
                        const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                        const dayDate = new Date(year, month - 1, d);
                        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

                        const dayTotalHours = filteredMatrixPersonnel.reduce((sum, p) => {
                          const m = mesaiList.find(
                            (item) => item.personelId === p.id && item.tarih === dateStr
                          );
                          return sum + (m ? m.saat : 0);
                        }, 0);

                        return (
                          <td
                            key={d}
                            className={`p-1 border-r border-slate-200 text-center font-mono ${
                              isWeekend ? 'bg-amber-100/60 text-amber-900' : ''
                            }`}
                            title={`${d} ${selectedMonth}: Toplam ${dayTotalHours} saat mesai yapıldı`}
                          >
                            {dayTotalHours > 0 ? (
                              <span className="inline-block px-1 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">
                                {dayTotalHours}s
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal text-[11px]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2.5 bg-slate-200/80 text-center font-mono">
                        {/* Person-Days with Overtime */}
                        {filteredMatrixPersonnel.reduce((totalDays, p) => {
                          return (
                            totalDays +
                            dayNumbers.filter((d) => {
                              const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                              return mesaiList.some(
                                (m) => m.personelId === p.id && m.tarih === dateStr && m.saat > 0
                              );
                            }).length
                          );
                        }, 0)}{' '}
                        Gün
                      </td>
                      <td className="px-2 py-2.5 bg-blue-100 text-blue-900 text-center font-mono font-black">
                        {monthlyMesaiStats.totalHours} Saat
                      </td>
                      <td className="px-2 py-2.5 bg-slate-200/60 text-center text-[10px] text-slate-500 font-normal">
                        Toplam
                      </td>
                      <td className="px-3 py-2.5 bg-emerald-100 text-emerald-900 text-right whitespace-nowrap font-mono font-black">
                        {formatCurrency(monthlyMesaiStats.totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: OVERTIME LEDGER (Mesai Tablosu) */}
      {subView === 'overtime' && (
        <div className="space-y-4">
          {/* Top Bar / Actions & Statistics */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Veritabanı Tablosu 4: Mesai Kayıtları
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  Formül: (Yevmiye / Günlük Saat) × Mesai × Katsayı
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Şantiyelere göre personeli ayırarak mesai girişi yapın, süreleri doğrudan değiştirin veya şantiye personeline toplu mesai uygulayın.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Şantiye Filtresi */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-medium">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-500 font-normal">Şantiye:</span>
                <select
                  value={mesaiSiteFilter}
                  onChange={(e) => setMesaiSiteFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">Tüm Şantiyeler ({mesaiList.length} Kayıt)</option>
                  <option value="kendi_personelimiz">
                    🏢 Kendi Personelimiz ({mesaiList.filter(m => {
                      const p = personnelList.find(person => person.id === m.personelId);
                      return p && isKendiPersonelimiz(p);
                    }).length} Kayıt)
                  </option>
                  {santiyeler.map((s) => {
                    const count = mesaiList.filter((m) => {
                      const p = personnelList.find((person) => person.id === m.personelId);
                      return p && (p.santiyeId === s.id || p.santiye === s.isim);
                    }).length;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.isim} ({count} Kayıt)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Şantiyeye Özel Toplu Mesai Butonu */}
              <button
                type="button"
                onClick={() => {
                  const initialSiteId = mesaiSiteFilter !== 'all' ? mesaiSiteFilter : (santiyeler[0]?.id || 'kendi_personelimiz');
                  setBulkSantiyeId(initialSiteId);
                  const todayStr = getTodayDateString();
                  setBulkTarih(todayStr);
                  const pList = getPersonnelForSite(initialSiteId);
                  // Önceden mesaisi olmayan personelleri otomatik seç (aynı gün mükerrer kayıt engeli)
                  const eligibleIds = pList
                    .filter((p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === todayStr))
                    .map((p) => p.id);
                  setSelectedPersonnelIds(eligibleIds);
                  setBulkHours(4);
                  setBulkSaatAraligi('18:00 - 22:00');
                  setBulkAciklama('');
                  setIsBulkMesaiModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Şantiyedeki personellere veya kendi personelimize toplu 1-16 saat mesai uygula"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>⚡ Şantiye Toplu Mesai</span>
              </button>

              {/* Yeni Tekil Mesai Kaydı Butonu */}
              <button
                type="button"
                onClick={() => {
                  const siteId = mesaiSiteFilter !== 'all' ? mesaiSiteFilter : 'all';
                  setModalSantiyeId(siteId);
                  const filteredP = getPersonnelForSite(siteId);
                  const todayStr = getTodayDateString();
                  // Mümkünse bugün mesaisi henüz girilmemiş ilk personeli seç
                  const firstEligible = filteredP.find((p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === todayStr));
                  setNewMesai({
                    personelId: firstEligible?.id || filteredP[0]?.id || personnelList[0]?.id || '',
                    tarih: todayStr,
                    mesaiSaatAraligi: '18:00 - 21:00',
                    saat: 3,
                    aciklama: '',
                  });
                  setIsMesaiModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>+ Tekil Mesai Kaydı</span>
              </button>
            </div>
          </div>

          {/* Quick Summary Badges */}
          {(() => {
            const filtered = mesaiList.filter((m) => {
              if (mesaiSiteFilter === 'all') return true;
              const person = personnelList.find((p) => p.id === m.personelId);
              if (!person) return false;
              if (mesaiSiteFilter === 'kendi_personelimiz') return isKendiPersonelimiz(person);
              return person.santiyeId === mesaiSiteFilter || person.santiye === santiyeler.find(s => s.id === mesaiSiteFilter)?.isim;
            });
            const totalHours = filtered.reduce((sum, m) => sum + m.saat, 0);
            const totalFee = filtered.reduce((sum, m) => {
              const person = personnelList.find((p) => p.id === m.personelId);
              if (!person) return sum;
              const dailyHours = person.gunlukCalismaSaati || 8;
              const hourlyWage = person.yevmiye / dailyHours;
              const katsayi = person.mesaiKatsayisi !== undefined ? person.mesaiKatsayisi : 1.0;
              return sum + (m.saat * hourlyWage * katsayi);
            }, 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Kayıt Sayısı:</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{filtered.length} Kayıt</span>
                </div>
                <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/30 p-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">Toplam Mesai Süresi:</span>
                  <span className="text-sm font-bold text-blue-800 font-mono">{totalHours} Saat</span>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">Hesaplanan Mesai Maliyeti:</span>
                  <span className="text-sm font-bold text-emerald-800 font-mono">{formatCurrency(totalFee)}</span>
                </div>
              </div>
            );
          })()}

          {/* Mesai Kayıtları Tablosu */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Personel</th>
                    <th className="px-3 py-3">Şantiye</th>
                    <th className="px-3 py-3">Tarih</th>
                    <th className="px-3 py-3">Mesai Saat Aralığı</th>
                    <th className="px-4 py-3 text-center min-w-[150px]">
                      Süre (Saat)
                      <span className="block text-[10px] font-normal text-slate-400">Rakamı tıkla ve değiştir</span>
                    </th>
                    <th className="px-3 py-3">Saatlik & Katsayı</th>
                    <th className="px-4 py-3 text-right">Hesaplanan Ücret</th>
                    <th className="px-3 py-3">Açıklama / İş Detayı</th>
                    <th className="px-3 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filtered = mesaiList.filter((m) => {
                      if (mesaiSiteFilter === 'all') return true;
                      const person = personnelList.find((p) => p.id === m.personelId);
                      if (!person) return false;
                      if (mesaiSiteFilter === 'kendi_personelimiz') return isKendiPersonelimiz(person);
                      return person.santiyeId === mesaiSiteFilter || person.santiye === santiyeler.find(s => s.id === mesaiSiteFilter)?.isim;
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                            {mesaiSiteFilter === 'kendi_personelimiz'
                              ? 'Kendi personelimiz için henüz mesai kaydı bulunmuyor.'
                              : mesaiSiteFilter !== 'all' 
                              ? 'Bu şantiye için henüz mesai kaydı bulunmuyor.' 
                              : 'Henüz mesai kaydı girilmedi.'}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((m) => {
                      const person = personnelList.find((p) => p.id === m.personelId);
                      const dailyHours = person?.gunlukCalismaSaati || 8;
                      const hourlyWage = person ? person.yevmiye / dailyHours : 0;
                      const katsayi = person?.mesaiKatsayisi !== undefined ? person.mesaiKatsayisi : 1.0;
                      const mesaiUcreti = m.saat * hourlyWage * katsayi;
                      const siteObj = santiyeler.find((s) => s.id === person?.santiyeId || s.isim === person?.santiye);
                      const siteName = siteObj ? siteObj.isim : (person?.santiye || 'Belirtilmemiş');

                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {person ? `${person.isim} ${person.soyisim}` : 'Bilinmeyen'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {person?.kategori || 'Personel'}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              <Building className="w-3 h-3 text-slate-400" />
                              {siteName}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600 font-medium font-mono text-xs">
                            {m.tarih}
                          </td>
                          <td className="px-3 py-3 font-mono font-semibold text-blue-700 text-xs">
                            {m.mesaiSaatAraligi}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {/* Doğrudan Değiştirilebilir Süre (Saat) Alanı */}
                            <div className="inline-flex items-center justify-center gap-1 bg-blue-50/90 px-2 py-1 rounded-xl border border-blue-200 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => {
                                  const newHours = Math.max(0.5, Number((m.saat - 1).toFixed(1)));
                                  onUpdateMesai({ ...m, saat: newHours });
                                }}
                                className="w-6 h-6 flex items-center justify-center text-xs font-bold text-blue-700 hover:bg-blue-200/70 rounded-md cursor-pointer transition-colors"
                                title="1 saat azalt"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={24}
                                step="any"
                                value={m.saat}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    onUpdateMesai({ ...m, saat: val });
                                  }
                                }}
                                className="w-14 px-1 py-0.5 text-center font-mono font-bold text-sm bg-white border border-blue-300 rounded-md text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                                title="Rakamı yazarak doğrudan değiştirebilirsiniz"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newHours = Number((m.saat + 1).toFixed(1));
                                  onUpdateMesai({ ...m, saat: newHours });
                                }}
                                className="w-6 h-6 flex items-center justify-center text-xs font-bold text-blue-700 hover:bg-blue-200/70 rounded-md cursor-pointer transition-colors"
                                title="1 saat artır"
                              >
                                +
                              </button>
                              <span className="text-xs font-semibold text-blue-800 pr-0.5">Saat</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600 font-mono text-xs">
                            <div>{formatCurrency(hourlyWage)}/saat</div>
                            <div className="text-[11px] text-blue-600 font-semibold">
                              {katsayi}x ({katsayi === 1.0 ? '1s=1s' : `1s=${katsayi}s`})
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                            +{formatCurrency(mesaiUcreti)}
                          </td>
                          <td className="px-3 py-3 text-slate-600 text-xs max-w-xs truncate">
                            {m.aciklama || '-'}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Düzenle Butonu */}
                              <button
                                type="button"
                                onClick={() => setEditingMesai(m)}
                                className="px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                                title="Mesai Kaydını Düzenle"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Düzenle</span>
                              </button>

                              {/* Sil Butonu */}
                              <button
                                type="button"
                                onClick={() => {
                                  const personName = person ? `${person.isim} ${person.soyisim}` : 'Personel';
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: 'Mesai Kaydını Sil',
                                    description: `${personName} için kaydedilen ${m.tarih} tarihli ${m.saat} saatlik mesai kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                    onConfirm: () => onDeleteMesai(m.id),
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Mesaiyi Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ŞANTİYEYE ÖZEL TOPLU MESAİ GİRİŞİ (1-16 Saat Butonları & Checkbox'lı Seçim) */}
      {isBulkMesaiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Başlık */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Şantiyeye Özel Toplu Mesai Girişi
                  </h3>
                  <p className="text-xs text-blue-200">
                    {bulkSantiyeId === 'kendi_personelimiz'
                      ? 'Kendi personellerinize tek seferde 1-16 saat mesai uygulayın'
                      : 'Seçilen şantiyedeki personellere tek seferde 1-16 saat mesai uygulayın'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkMesaiModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Aynı tarihte mesaisi olmayan geçerli personelleri filtrele
                const validIds = selectedPersonnelIds.filter(
                  (pId) => !mesaiList.some((m) => m.personelId === pId && m.tarih === bulkTarih)
                );

                if (validIds.length === 0) {
                  alert(`Seçilen personellerin ${bulkTarih} tarihinde zaten mesai kaydı bulunmaktadır! Aynı tarihe mükerrer mesai eklenemez.`);
                  return;
                }

                const isKendi = bulkSantiyeId === 'kendi_personelimiz';
                const siteObj = santiyeler.find((s) => s.id === bulkSantiyeId);
                const siteName = isKendi ? 'Kendi Personelimiz' : (siteObj ? siteObj.isim : 'Şantiye');
                const newRecords: Mesai[] = validIds.map((pId, idx) => ({
                  id: `m-bulk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
                  personelId: pId,
                  tarih: bulkTarih,
                  mesaiSaatAraligi: bulkSaatAraligi || `${18}:00 - ${18 + bulkHours}:00`,
                  saat: bulkHours,
                  aciklama: bulkAciklama || `${siteName} ${bulkHours} saat toplu mesai`,
                }));

                onAddBulkMesai(newRecords);
                setIsBulkMesaiModalOpen(false);
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm"
            >
              {/* 1. Şantiye & Tarih Seçimi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    Şantiye Seçiniz
                  </label>
                  <select
                    value={bulkSantiyeId}
                    onChange={(e) => {
                      const newSiteId = e.target.value;
                      setBulkSantiyeId(newSiteId);
                      const pList = getPersonnelForSite(newSiteId);
                      // Seçilen tarihte zaten mesaisi olanları otomatik olarak seçimden çıkar
                      const eligibleIds = pList
                        .filter((p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === bulkTarih))
                        .map((p) => p.id);
                      setSelectedPersonnelIds(eligibleIds);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                    required
                  >
                    <option value="kendi_personelimiz">
                      🏢 Kendi Personelimiz ({getPersonnelForSite('kendi_personelimiz').length} Aktif Personel)
                    </option>
                    {santiyeler.map((s) => {
                      const count = getPersonnelForSite(s.id).length;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.isim} ({count} Aktif Personel)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                    Mesai Tarihi
                  </label>
                  <input
                    type="date"
                    value={bulkTarih}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setBulkTarih(newDate);
                      // Yeni tarihte zaten mesaisi olanları seçiliden ayıkla
                      setSelectedPersonnelIds((prev) =>
                        prev.filter((id) => !mesaiList.some((m) => m.personelId === id && m.tarih === newDate))
                      );
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                    required
                  />
                </div>
              </div>

              {/* 2. Süre (Saat) Seçimi: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 Saat */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Mesai Süresi Seçiniz (1 - 16 Saat):
                  </label>
                  <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                    {bulkHours} Saat Uygulanacak
                  </span>
                </div>

                {/* 1'den 16'ya kadar hızlı seçim butonları */}
                <div className="grid grid-cols-8 gap-1.5">
                  {OVERTIME_HOURS_OPTIONS.map((h) => {
                    const isSelected = bulkHours === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setBulkHours(h);
                          const startHour = 18;
                          const endHour = startHour + h;
                          const endStr = endHour >= 24 ? `0${endHour - 24}:00 (+1)` : `${endHour}:00`;
                          setBulkSaatAraligi(`${startHour}:00 - ${endStr}`);
                        }}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {h}s
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mesai Saat Aralığı
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: 18:00 - 22:00"
                      value={bulkSaatAraligi}
                      onChange={(e) => setBulkSaatAraligi(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Özel Saat (Gerekirse Küsüratlı)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      step="any"
                      value={bulkHours}
                      onChange={(e) => setBulkHours(Math.max(0.5, Number(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Açıklama */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Yapılan İş
                </label>
                <input
                  type="text"
                  placeholder="Örn: 3. Kat tavan betonu dökümü fazla mesaisi"
                  value={bulkAciklama}
                  onChange={(e) => setBulkAciklama(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* 4. Şantiyedeki Personel Listesi ve Checkbox Seçimi */}
              {(() => {
                const santiyePersonnel = getPersonnelForSite(bulkSantiyeId);

                // Bu tarihte henüz mesai kaydı OLMAYAN (eklenebilir) personeller
                const eligiblePersonnel = santiyePersonnel.filter(
                  (p) => !mesaiList.some((m) => m.personelId === p.id && m.tarih === bulkTarih)
                );
                // Bu tarihte ZATEN mesai kaydı OLAN (mükerrer kayıt engeli aktif) personeller
                const ineligiblePersonnel = santiyePersonnel.filter(
                  (p) => mesaiList.some((m) => m.personelId === p.id && m.tarih === bulkTarih)
                );

                const isAllEligibleSelected =
                  eligiblePersonnel.length > 0 &&
                  eligiblePersonnel.every((p) => selectedPersonnelIds.includes(p.id));

                const validSelectedCount = selectedPersonnelIds.filter((id) =>
                  eligiblePersonnel.some((ep) => ep.id === id)
                ).length;

                const totalEstimatedCost = santiyePersonnel
                  .filter((p) => selectedPersonnelIds.includes(p.id) && !ineligiblePersonnel.some(ip => ip.id === p.id))
                  .reduce((sum, p) => {
                    const dailyHours = p.gunlukCalismaSaati || 8;
                    const hourlyWage = p.yevmiye / dailyHours;
                    const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                    return sum + (bulkHours * hourlyWage * katsayi);
                  }, 0);

                return (
                  <div className="space-y-2 border border-slate-200 rounded-2xl p-3.5 bg-white">
                    {/* Mükerrer Mesai Koruma Bilgisi */}
                    {ineligiblePersonnel.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-amber-900 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>{ineligiblePersonnel.length} personelin</strong> {bulkTarih} tarihinde zaten mesai kaydı bulunmaktadır (aynı güne mükerrer kayıt engellenmiştir).
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md shrink-0">
                          Mükerrer Koruma
                        </span>
                      </div>
                    )}

                    {/* Checkbox Header */}
                    <div className="flex flex-wrap items-center justify-between pb-2 border-b border-slate-200 gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={eligiblePersonnel.length === 0}
                          onClick={() => {
                            if (isAllEligibleSelected) {
                              setSelectedPersonnelIds([]);
                            } else {
                              setSelectedPersonnelIds(eligiblePersonnel.map((p) => p.id));
                            }
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none"
                        >
                          {isAllEligibleSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                          <span>
                            {eligiblePersonnel.length === 0
                              ? 'Uygun Personel Yok'
                              : `Uygun Personelleri Seç (${eligiblePersonnel.length})`}
                          </span>
                        </button>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold font-mono">
                          {validSelectedCount} / {eligiblePersonnel.length} Personel Seçili
                        </span>
                      </div>

                      <div className="text-xs font-bold text-emerald-700 font-mono">
                        Toplam Mesai Tutarı: {formatCurrency(totalEstimatedCost)}
                      </div>
                    </div>

                    {/* Personel Checkbox Listesi */}
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
                      {santiyePersonnel.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          {bulkSantiyeId === 'kendi_personelimiz'
                            ? 'Kendi personelimiz kapsamında kayıtlı aktif personel bulunamadı.'
                            : 'Bu şantiyede kayıtlı aktif personel bulunamadı.'}
                        </div>
                      ) : (
                        santiyePersonnel.map((p) => {
                          const existingForPerson = mesaiList.find(
                            (m) => m.personelId === p.id && m.tarih === bulkTarih
                          );
                          const hasExisting = !!existingForPerson;
                          const isChecked = !hasExisting && selectedPersonnelIds.includes(p.id);
                          const dailyHours = p.gunlukCalismaSaati || 8;
                          const hourlyWage = p.yevmiye / dailyHours;
                          const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                          const personFee = bulkHours * hourlyWage * katsayi;

                          return (
                            <label
                              key={p.id}
                              className={`flex items-center justify-between py-2 px-2.5 rounded-xl transition-colors ${
                                hasExisting
                                  ? 'bg-slate-50 border border-slate-200/50 opacity-60 cursor-not-allowed'
                                  : isChecked
                                  ? 'bg-blue-50/50 hover:bg-blue-50 border border-blue-200/60 cursor-pointer'
                                  : 'hover:bg-slate-50 border border-transparent cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  disabled={hasExisting}
                                  checked={isChecked}
                                  onChange={() => {
                                    if (hasExisting) return;
                                    setSelectedPersonnelIds((prev) =>
                                      prev.includes(p.id)
                                        ? prev.filter((id) => id !== p.id)
                                        : [...prev, p.id]
                                    );
                                  }}
                                  className={`w-4 h-4 rounded border-slate-300 ${
                                    hasExisting
                                      ? 'text-slate-300 cursor-not-allowed opacity-50'
                                      : 'text-blue-600 focus:ring-blue-500 cursor-pointer'
                                  }`}
                                />
                                <div>
                                  <div className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                    <span>{p.isim} {p.soyisim}</span>
                                    {bulkSantiyeId === 'kendi_personelimiz' && (
                                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                        {p.santiye || 'Merkez Kadro'}
                                      </span>
                                    )}
                                    {hasExisting && (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                        Kayıt Var
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {p.kategori} • Yevmiye: {formatCurrency(p.yevmiye)} • Katsayı: {katsayi}x
                                  </div>
                                </div>
                              </div>

                              {hasExisting ? (
                                <div className="text-right">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                    <AlertCircle className="w-3 h-3 text-amber-600" />
                                    {existingForPerson.saat}s Kayıtlı
                                  </span>
                                  <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                                    Aynı güne mükerrer eklenemez
                                  </div>
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="font-bold text-emerald-700 font-mono text-xs sm:text-sm">
                                    +{formatCurrency(personFee)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {bulkHours}s × {formatCurrency(hourlyWage)}
                                  </div>
                                </div>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Modal Alt Butonlar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkMesaiModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={selectedPersonnelIds.length === 0}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>
                    Seçili {selectedPersonnelIds.length} Personele {bulkHours} Saat Mesaiyi Uygula
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TEKİL MESAİ EKLEME (Şantiye Ayrımı ve Hızlı 1-16 Saat Butonları ile) */}
      {isMesaiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Tekil Mesai Kaydı Ekle</h3>
              </div>
              <button
                onClick={() => setIsMesaiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMesai.personelId) return;

                const hasDuplicate = mesaiList.some(
                  (m) => m.personelId === newMesai.personelId && m.tarih === newMesai.tarih
                );
                if (hasDuplicate) {
                  alert(`Bu personelin ${newMesai.tarih} tarihinde zaten mesai kaydı bulunmaktadır! Aynı tarihe mükerrer mesai eklenemez.`);
                  return;
                }

                onAddMesai({
                  id: `m-${Date.now()}`,
                  personelId: newMesai.personelId,
                  tarih: newMesai.tarih,
                  mesaiSaatAraligi: newMesai.mesaiSaatAraligi,
                  saat: Number(newMesai.saat) || 1,
                  aciklama: newMesai.aciklama,
                });
                setIsMesaiModalOpen(false);
              }}
              className="p-6 space-y-4 text-xs sm:text-sm"
            >
              {/* Şantiye Seçimi / Filtresi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  Şantiye Seçiniz (Personeli Filtreler)
                </label>
                <select
                  value={modalSantiyeId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setModalSantiyeId(sId);
                    const filtered = getPersonnelForSite(sId);
                    if (filtered.length > 0) {
                      setNewMesai((prev) => ({ ...prev, personelId: filtered[0].id }));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="all">Tüm Şantiyeler ({personnelList.length} Personel)</option>
                  <option value="kendi_personelimiz">
                    🏢 Kendi Personelimiz ({getPersonnelForSite('kendi_personelimiz').length} Personel)
                  </option>
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isim}
                    </option>
                  ))}
                </select>
              </div>

              {/* Personel Seçimi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Personel Seçiniz
                </label>
                <select
                  value={newMesai.personelId}
                  onChange={(e) => setNewMesai({ ...newMesai, personelId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {getPersonnelForSite(modalSantiyeId).map((p) => {
                    const siteObj = santiyeler.find((s) => s.id === p.santiyeId || s.isim === p.santiye);
                    const hasOvertimeOnDate = mesaiList.find(
                      (m) => m.personelId === p.id && m.tarih === newMesai.tarih
                    );
                    return (
                      <option key={p.id} value={p.id}>
                        {p.isim} {p.soyisim} [{siteObj ? siteObj.isim : (p.santiye || (isKendiPersonelimiz(p) ? 'Kendi Personelimiz' : 'Şantiye'))}] - {p.kategori} {hasOvertimeOnDate ? `(⚠️ ${newMesai.tarih}'de ${hasOvertimeOnDate.saat}s mesaisi var)` : `(Katsayı: ${p.mesaiKatsayisi ?? 1.0}x)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  Mesai Tarihi
                </label>
                <input
                  type="date"
                  value={newMesai.tarih}
                  onChange={(e) => setNewMesai({ ...newMesai, tarih: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                  required
                />
              </div>

              {/* Mükerrer Mesai Uyarısı */}
              {(() => {
                const existingRec = mesaiList.find(
                  (m) => m.personelId === newMesai.personelId && m.tarih === newMesai.tarih
                );
                if (!existingRec) return null;

                const person = personnelList.find((p) => p.id === newMesai.personelId);

                return (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>Mükerrer Mesai Uyarısı!</span>
                        <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-mono">Kayıt Mevcut</span>
                      </div>
                      <p className="text-amber-800">
                        <strong>{person ? `${person.isim} ${person.soyisim}` : 'Bu personel'}</strong> için <strong>{newMesai.tarih}</strong> tarihinde zaten <strong>{existingRec.saat} saat</strong> ({existingRec.mesaiSaatAraligi}) mesai kaydı bulunmaktadır.
                      </p>
                      <p className="text-[11px] text-amber-700 font-medium">
                        Aynı tarihe ikinci bir mesai eklenemez. Mevcut kaydı düzenlemek için aşağıdaki mesai tablosundaki "Düzenle" butonunu kullanabilirsiniz.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Hızlı Saat Butonları (1-16 Saat) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hızlı Saat Seçimi:
                </label>
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {OVERTIME_HOURS_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setNewMesai((prev) => ({
                          ...prev,
                          saat: h,
                          mesaiSaatAraligi: `18:00 - ${18 + h >= 24 ? `0${18 + h - 24}:00` : `${18 + h}:00`}`,
                        }));
                      }}
                      className={`py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        newMesai.saat === h
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      {h}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mesai Saat Aralığı
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 18:00 - 22:00"
                    value={newMesai.mesaiSaatAraligi}
                    onChange={(e) => setNewMesai({ ...newMesai, mesaiSaatAraligi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Toplam Saat
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={newMesai.saat}
                    onChange={(e) => setNewMesai({ ...newMesai, saat: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Canlı Hesaplama Önizlemesi */}
              {(() => {
                const p = personnelList.find((item) => item.id === newMesai.personelId) || personnelList[0];
                if (!p) return null;
                const dailyHours = p.gunlukCalismaSaati || 8;
                const hourlyWage = p.yevmiye / dailyHours;
                const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                const hours = Number(newMesai.saat) || 0;
                const calculatedFee = hours * hourlyWage * katsayi;

                return (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-blue-900">
                      <span>Hesaplanan Mesai Ücreti:</span>
                      <span className="font-bold text-sm text-blue-700">{formatCurrency(calculatedFee)}</span>
                    </div>
                    <div className="text-blue-800 text-[11px] font-mono">
                      {hours} saat × {formatCurrency(hourlyWage)}/saat × {katsayi}x = {formatCurrency(calculatedFee)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      * 1 Gün = {dailyHours} saat | {p.isim} {p.soyisim} için katsayı: {katsayi}x
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Görev
                </label>
                <input
                  type="text"
                  placeholder="Örn: Beton dökümü nöbeti"
                  value={newMesai.aciklama}
                  onChange={(e) => setNewMesai({ ...newMesai, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMesaiModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                {(() => {
                  const isDuplicate = mesaiList.some(
                    (m) => m.personelId === newMesai.personelId && m.tarih === newMesai.tarih
                  );
                  return (
                    <button
                      type="submit"
                      disabled={isDuplicate}
                      className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      {isDuplicate && <AlertCircle className="w-4 h-4 text-amber-300" />}
                      <span>{isDuplicate ? 'Mükerrer Kayıt (Engellendi)' : 'Kaydet'}</span>
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MESAİ KAYDI DÜZENLEME MODALI */}
      {editingMesai && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Mesai Kaydını Düzenle</h3>
              </div>
              <button
                onClick={() => setEditingMesai(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingMesai) return;

                const collision = mesaiList.find(
                  (m) =>
                    m.id !== editingMesai.id &&
                    m.personelId === editingMesai.personelId &&
                    m.tarih === editingMesai.tarih
                );
                if (collision) {
                  alert(`Bu personelin ${editingMesai.tarih} tarihinde zaten başka bir mesai kaydı bulunmaktadır! Aynı tarihe mükerrer kayıt oluşturulamaz.`);
                  return;
                }

                onUpdateMesai(editingMesai);
                setEditingMesai(null);
              }}
              className="p-6 space-y-4 text-xs sm:text-sm"
            >
              {/* Personel Bilgisi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Personel
                </label>
                <select
                  value={editingMesai.personelId}
                  onChange={(e) => setEditingMesai({ ...editingMesai, personelId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium"
                  required
                >
                  {personnelList.map((p) => {
                    const siteObj = santiyeler.find((s) => s.id === p.santiyeId || s.isim === p.santiye);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.isim} {p.soyisim} [{siteObj ? siteObj.isim : (p.santiye || 'Şantiye')}]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                  Mesai Tarihi
                </label>
                <input
                  type="date"
                  value={editingMesai.tarih}
                  onChange={(e) => setEditingMesai({ ...editingMesai, tarih: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                  required
                />
              </div>

              {/* Düzenleme Mükerrer Kontrol Uyarısı */}
              {(() => {
                const collision = mesaiList.find(
                  (m) =>
                    m.id !== editingMesai.id &&
                    m.personelId === editingMesai.personelId &&
                    m.tarih === editingMesai.tarih
                );
                if (!collision) return null;

                const person = personnelList.find((p) => p.id === editingMesai.personelId);

                return (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-bold">Mükerrer Tarih Çakışması!</div>
                      <p className="text-amber-800">
                        <strong>{person ? `${person.isim} ${person.soyisim}` : 'Bu personelin'}</strong> <strong>{editingMesai.tarih}</strong> tarihinde zaten başka bir mesai kaydı ({collision.saat} saat) mevcuttur.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Kayıt tarihini değiştirebilir veya diğer kaydı tablodan silebilirsiniz.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Hızlı Saat Butonları (1-16 Saat) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hızlı Saat Seçimi:
                </label>
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {OVERTIME_HOURS_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setEditingMesai({
                          ...editingMesai,
                          saat: h,
                          mesaiSaatAraligi: `18:00 - ${18 + h >= 24 ? `0${18 + h - 24}:00` : `${18 + h}:00`}`,
                        });
                      }}
                      className={`py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        editingMesai.saat === h
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      {h}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mesai Saat Aralığı
                  </label>
                  <input
                    type="text"
                    value={editingMesai.mesaiSaatAraligi}
                    onChange={(e) => setEditingMesai({ ...editingMesai, mesaiSaatAraligi: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Süre (Saat)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step="any"
                    value={editingMesai.saat}
                    onChange={(e) => setEditingMesai({ ...editingMesai, saat: Math.max(0.5, Number(e.target.value) || 0) })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
              </div>

              {/* Canlı Hesaplama Önizlemesi */}
              {(() => {
                const p = personnelList.find((item) => item.id === editingMesai.personelId);
                if (!p) return null;
                const dailyHours = p.gunlukCalismaSaati || 8;
                const hourlyWage = p.yevmiye / dailyHours;
                const katsayi = p.mesaiKatsayisi !== undefined ? p.mesaiKatsayisi : 1.0;
                const fee = editingMesai.saat * hourlyWage * katsayi;

                return (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-blue-900">
                      <span>Güncellenen Mesai Ücreti:</span>
                      <span className="font-bold text-sm text-blue-700">{formatCurrency(fee)}</span>
                    </div>
                    <div className="text-blue-800 text-[11px] font-mono">
                      {editingMesai.saat} saat × {formatCurrency(hourlyWage)}/saat × {katsayi}x = {formatCurrency(fee)}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Görev
                </label>
                <input
                  type="text"
                  placeholder="Örn: Beton dökümü nöbeti"
                  value={editingMesai.aciklama || ''}
                  onChange={(e) => setEditingMesai({ ...editingMesai, aciklama: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMesai(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Vazgeç
                </button>
                {(() => {
                  const collision = mesaiList.find(
                    (m) =>
                      m.id !== editingMesai.id &&
                      m.personelId === editingMesai.personelId &&
                      m.tarih === editingMesai.tarih
                  );
                  return (
                    <button
                      type="submit"
                      disabled={!!collision}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      {collision && <AlertCircle className="w-4 h-4 text-amber-300" />}
                      <span>{collision ? 'Çakışma Var (Kaydedilemez)' : 'Değişiklikleri Kaydet'}</span>
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CELL OVERTIME MODAL (Aylık Mesai Matrisinden Hızlı Düzenleme/Ekleme/Silme) */}
      {cellMesaiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>{cellMesaiModal.existingMesai ? 'Mesai Kaydını Düzenle' : 'Hızlı Mesai Ekle'}</span>
                    {cellMesaiModal.existingMesai && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold font-mono">
                        Mevcut: {cellMesaiModal.existingMesai.saat}s
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-slate-800">
                      {cellMesaiModal.person.isim} {cellMesaiModal.person.soyisim}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-blue-700 font-bold">{cellMesaiModal.dateStr}</span>
                    <span>•</span>
                    <span>{cellMesaiModal.person.santiye || 'Şantiye Yok'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCellMesaiModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cellMesaiModal.saat <= 0) {
                  alert('Lütfen geçerli bir mesai saati giriniz.');
                  return;
                }

                if (cellMesaiModal.existingMesai) {
                  onUpdateMesai({
                    ...cellMesaiModal.existingMesai,
                    saat: cellMesaiModal.saat,
                    mesaiSaatAraligi: cellMesaiModal.mesaiSaatAraligi,
                    aciklama: cellMesaiModal.aciklama,
                  });
                } else {
                  // Aynı personel ve aynı tarih kontrolü
                  const collision = mesaiList.find(
                    (m) =>
                      m.personelId === cellMesaiModal.person.id &&
                      m.tarih === cellMesaiModal.dateStr
                  );
                  if (collision) {
                    onUpdateMesai({
                      ...collision,
                      saat: cellMesaiModal.saat,
                      mesaiSaatAraligi: cellMesaiModal.mesaiSaatAraligi,
                      aciklama: cellMesaiModal.aciklama,
                    });
                  } else {
                    onAddMesai({
                      id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      personelId: cellMesaiModal.person.id,
                      tarih: cellMesaiModal.dateStr,
                      saat: cellMesaiModal.saat,
                      mesaiSaatAraligi: cellMesaiModal.mesaiSaatAraligi,
                      aciklama: cellMesaiModal.aciklama,
                    });
                  }
                }
                setCellMesaiModal(null);
              }}
              className="space-y-4"
            >
              {/* Quick Hours Buttons (1-16) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Mesai Süresi (Hızlı Seçim)
                  </label>
                  <span className="text-xs font-bold text-blue-700 font-mono">
                    {cellMesaiModal.saat} Saat Seçildi
                  </span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                  {OVERTIME_HOURS_OPTIONS.map((h) => {
                    const isSelected = cellMesaiModal.saat === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          const endH = 18 + h;
                          const aralik = `18:00 - ${endH >= 24 ? String(endH % 24).padStart(2, '0') + ':00 (+1 Gün)' : endH + ':00'}`;
                          setCellMesaiModal({
                            ...cellMesaiModal,
                            saat: h,
                            mesaiSaatAraligi: aralik,
                          });
                        }}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {h}s
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Saat & Saat Aralığı Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Süre (Saat)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="any"
                    value={cellMesaiModal.saat}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setCellMesaiModal({ ...cellMesaiModal, saat: val });
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mesai Saat Aralığı
                  </label>
                  <input
                    type="text"
                    value={cellMesaiModal.mesaiSaatAraligi}
                    onChange={(e) =>
                      setCellMesaiModal({
                        ...cellMesaiModal,
                        mesaiSaatAraligi: e.target.value,
                      })
                    }
                    placeholder="Örn: 18:00 - 22:00"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Açıklama */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Görev (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Kalıp sökümü, acil beton nöbeti"
                  value={cellMesaiModal.aciklama}
                  onChange={(e) =>
                    setCellMesaiModal({
                      ...cellMesaiModal,
                      aciklama: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300"
                />
              </div>

              {/* Live Cost Calculation Banner */}
              {(() => {
                const dailyHours = cellMesaiModal.person.gunlukCalismaSaati || 8;
                const hourlyWage = cellMesaiModal.person.yevmiye / dailyHours;
                const katsayi =
                  cellMesaiModal.person.mesaiKatsayisi !== undefined
                    ? cellMesaiModal.person.mesaiKatsayisi
                    : 1.0;
                const hourlyRate = hourlyWage * katsayi;
                const totalEstimatedFee = cellMesaiModal.saat * hourlyRate;

                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        Hesaplanan Mesai Hakedişi
                      </div>
                      <div className="text-xs text-emerald-800 font-mono mt-0.5">
                        {cellMesaiModal.saat}s × {formatCurrency(hourlyWage)} × {katsayi}x
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-700 font-mono">
                        +{formatCurrency(totalEstimatedFee)}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium">
                        Birim: {formatCurrency(hourlyRate)}/saat
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <div>
                  {cellMesaiModal.existingMesai && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = cellMesaiModal.existingMesai!.id;
                        const personName = `${cellMesaiModal.person.isim} ${cellMesaiModal.person.soyisim}`;
                        const dateStr = cellMesaiModal.dateStr;
                        setDeleteConfirm({
                          isOpen: true,
                          title: 'Mesai Kaydını Sil',
                          description: `${personName} için ${dateStr} tarihindeki mesai kaydını silmek istediğinize emin misiniz?`,
                          onConfirm: () => {
                            onDeleteMesai(targetId);
                            setCellMesaiModal(null);
                          },
                        });
                      }}
                      className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                      title="Bu tarihteki mesai kaydını sil"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Mesaiyi Sil</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCellMesaiModal(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer font-medium"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{cellMesaiModal.existingMesai ? 'Değişiklikleri Kaydet' : 'Mesaiyi Kaydet'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Quick Status Picker Modal (Right Click / Context Menu or Fast Picker) */}
      {quickPicker && quickPicker.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs"
          onClick={() => setQuickPicker(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                  <span>{quickPicker.personelName}</span>
                  {quickPicker.isSalaried && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Maaşlı
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {quickPicker.dateStr} Tarihli Puantaj Durumu Seçin
                </p>
              </div>
              <button
                onClick={() => setQuickPicker(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-1.5">
              {(
                [
                  { status: 'Tam Gün', label: 'Tam Gün / Geldi', sub: 'Katsayı: 1.0 (Normal Çalışma)', icon: '🟢' },
                  { status: 'Gelmedi', label: 'Gelmedi (Devamsız)', sub: 'Katsayı: 0.0 (Maaştan kesinti)', icon: '🔴' },
                  { status: 'Resmi Tatil', label: 'Resmi Tatil', sub: 'Katsayı: 1.0 (Ücret ödenir)', icon: '🟣' },
                  { status: 'Yarım Gün', label: 'Yarım Gün', sub: 'Katsayı: 0.5 (Yarım hakediş)', icon: '🟡' },
                  { status: 'Ücretli İzin', label: 'Ücretli İzin (Yıllık İzin vb.)', sub: 'Katsayı: 1.0', icon: '🔵' },
                  { status: 'Ücretsiz İzin', label: 'Ücretsiz İzin', sub: 'Katsayı: 0.0', icon: '⚪' },
                  { status: 'Fazla Mesaili', label: 'Fazla Mesaili', sub: 'Katsayı: 1.0 + Mesai', icon: '⚡' },
                ] as const
              ).map((opt) => {
                const isSelected = quickPicker.currentStatus === opt.status;
                return (
                  <button
                    key={opt.status}
                    onClick={() => {
                      onUpdatePuantaj(quickPicker.personelId, quickPicker.dateStr, opt.status as CalismaDurumu);
                      setQuickPicker(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50/70 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{opt.icon}</span>
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {opt.sub}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  onUpdatePuantaj(quickPicker.personelId, quickPicker.dateStr, quickPicker.isSalaried ? 'Boş' : null);
                  setQuickPicker(null);
                }}
                className="w-full text-center px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-dashed border-rose-200 transition-colors cursor-pointer mt-2"
              >
                Kaydı Sil / Boş Bırak (-)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Deletion Confirmation Modal */}
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
