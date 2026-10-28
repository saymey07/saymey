import React, { useState, useMemo } from 'react';
import {
  CreditCard as CreditCardIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Calendar,
  Building2,
  HardHat,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  ChevronRight,
  Sparkles,
  Info,
  RefreshCw,
  Tag
} from 'lucide-react';
import { KrediKarti, KrediKartiHarcama, Santiye, Firma, Taseron, FirmaCari, SantiyeGider } from '../types';
import { formatCurrency, getCurrencySymbol, getTodayDateString, DEFAULT_SANTIYE_GIDER_KATEGORILERI } from '../utils/storage';
import { convertCurrencyToTRY, getSavedExchangeRates } from '../utils/currencyStore';
import { CurrencySelector } from './CurrencySelector';
import { ExportButton } from './ExportButton';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ExportOptions } from '../utils/exportUtils';

interface CreditCardsManagementProps {
  cards: KrediKarti[];
  transactions: KrediKartiHarcama[];
  santiyeler: Santiye[];
  firmalar: Firma[];
  taseronlar?: Taseron[];
  cariList?: FirmaCari[];
  giderler?: SantiyeGider[];
  kategoriler?: string[];
  onAddKategori?: (kategori: string) => void;
  onDeleteKategori?: (kategori: string) => void;
  onAddFirma?: (firma: Firma) => void;
  onAddCard: (card: KrediKarti) => void;
  onUpdateCard: (card: KrediKarti) => void;
  onDeleteCard: (id: string) => void;
  onAddTransaction: (transaction: KrediKartiHarcama) => void;
  onUpdateTransaction: (transaction: KrediKartiHarcama) => void;
  onDeleteTransaction: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenCurrencies?: () => void;
}

const BANKA_LISTESI = [
  'Garanti BBVA',
  'Türkiye İş Bankası',
  'Yapı Kredi Bankası',
  'Akbank',
  'Ziraat Bankası',
  'Vakıfbank',
  'Halkbank',
  'QNB Finansbank',
  'Denizbank',
  'Kuveyt Türk',
  'TEB',
  'Enpara',
  'Diğer Banka'
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; accent: string }> = {
  slate: { bg: 'from-slate-900 to-slate-800 text-white', border: 'border-slate-700', accent: 'text-slate-300' },
  blue: { bg: 'from-blue-900 to-blue-800 text-white', border: 'border-blue-700', accent: 'text-blue-200' },
  emerald: { bg: 'from-emerald-950 to-emerald-800 text-white', border: 'border-emerald-700', accent: 'text-emerald-200' },
  purple: { bg: 'from-purple-950 to-purple-800 text-white', border: 'border-purple-700', accent: 'text-purple-200' },
  amber: { bg: 'from-amber-950 to-amber-800 text-white', border: 'border-amber-700', accent: 'text-amber-200' },
  rose: { bg: 'from-rose-950 to-rose-800 text-white', border: 'border-rose-700', accent: 'text-rose-200' },
  indigo: { bg: 'from-indigo-950 to-indigo-850 text-white', border: 'border-indigo-700', accent: 'text-indigo-200' },
};

export const CreditCardsManagement: React.FC<CreditCardsManagementProps> = ({
  cards,
  transactions,
  santiyeler,
  firmalar,
  taseronlar = [],
  cariList = [],
  giderler = [],
  kategoriler,
  onAddKategori,
  onDeleteKategori,
  onAddFirma,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  showToast,
  onOpenCurrencies,
}) => {
  // Navigation views
  const [activeSubTab, setActiveSubTab] = useState<'cards' | 'transactions' | 'summary'>('cards');

  // Şantiye gider fişi ile ortak kategoriler
  const activeCategories = kategoriler && kategoriler.length > 0 ? kategoriler : DEFAULT_SANTIYE_GIDER_KATEGORILERI;
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Combined firmalar & taseronlar for comprehensive selection
  const combinedFirmalar = useMemo(() => {
    const map = new Map<string, { id: string; isim: string; tur: 'taseron' | 'tedarikci' | 'musteri'; isTaseron: boolean }>();
    firmalar.forEach((f) => {
      const isTas = f.tur === 'taseron' || taseronlar.some((t) => t.id === f.id || t.isim.trim().toLowerCase() === f.isim.trim().toLowerCase());
      map.set(f.id, {
        id: f.id,
        isim: f.isim,
        tur: isTas ? 'taseron' : f.tur,
        isTaseron: isTas,
      });
    });
    taseronlar.forEach((t) => {
      const existing = Array.from(map.values()).find((item) => item.isim.trim().toLowerCase() === t.isim.trim().toLowerCase());
      if (!existing) {
        map.set(t.id, {
          id: t.id,
          isim: t.isim,
          tur: 'taseron',
          isTaseron: true,
        });
      } else {
        existing.isTaseron = true;
        existing.tur = 'taseron';
      }
    });
    return Array.from(map.values()).sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
  }, [firmalar, taseronlar]);

  // Filter States
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSantiye, setSelectedSantiye] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KrediKarti | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<KrediKartiHarcama | null>(null);
  const [presetTxType, setPresetTxType] = useState<'Harcama' | 'Kart Ödemesi' | 'İade'>('Harcama');
  const [presetCardId, setPresetCardId] = useState<string>('');

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

  const exchangeRates = getSavedExchangeRates();

  // Card Form State
  const [cardForm, setCardForm] = useState({
    kartAdi: '',
    banka: 'Garanti BBVA',
    kartSahibi: '',
    kartNumarasiSon4: '',
    kartTuru: 'Şirket / Kurumsal' as 'Şirket / Kurumsal' | 'Şahsi',
    kartLimiti: 100000,
    kesimGunu: 15,
    sonOdemeGunu: 25,
    renk: 'slate' as 'slate' | 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo',
    durum: 'Aktif' as 'Aktif' | 'Pasif',
    aciklama: '',
  });

  const [isCustomTxFirma, setIsCustomTxFirma] = useState(false);
  const [addManualTxFirmaToCari, setAddManualTxFirmaToCari] = useState(false);

  // Transaction Form State
  const [txForm, setTxForm] = useState({
    kartId: '',
    tarih: getTodayDateString(),
    islemTipi: 'Harcama' as 'Harcama' | 'Kart Ödemesi' | 'İade',
    tutar: 0,
    paraBirimi: 'TRY',
    kategori: activeCategories[0] || 'Malzeme',
    santiyeId: '',
    firmaId: '',
    firmaAdi: '',
    taksitSayisi: 1,
    faturaNo: '',
    aciklama: '',
  });

  // Calculate per-card balances
  const cardBalances = useMemo(() => {
    const map: Record<string, { totalHarcama: number; totalOdeme: number; currentDebt: number; availableLimit: number }> = {};
    
    cards.forEach((c) => {
      map[c.id] = { totalHarcama: 0, totalOdeme: 0, currentDebt: 0, availableLimit: c.kartLimiti };
    });

    transactions.forEach((tx) => {
      if (!map[tx.kartId]) return;
      const tutarInTL = convertCurrencyToTRY(Number(tx.tutar || 0), tx.paraBirimi, exchangeRates.rates);
      if (tx.islemTipi === 'Harcama') {
        map[tx.kartId].totalHarcama += tutarInTL;
      } else if (tx.islemTipi === 'Kart Ödemesi' || tx.islemTipi === 'İade') {
        map[tx.kartId].totalOdeme += tutarInTL;
      }
    });

    cards.forEach((c) => {
      const entry = map[c.id];
      const debt = Math.max(0, entry.totalHarcama - entry.totalOdeme);
      entry.currentDebt = debt;
      entry.availableLimit = Math.max(0, c.kartLimiti - debt);
    });

    return map;
  }, [cards, transactions, exchangeRates]);

  // Overall Totals
  const totals = useMemo(() => {
    let totalLimit = 0;
    let totalDebt = 0;
    let totalAvailable = 0;

    cards.forEach((c) => {
      if (c.durum === 'Aktif') {
        totalLimit += Number(c.kartLimiti || 0);
        const b = cardBalances[c.id];
        if (b) {
          totalDebt += b.currentDebt;
          totalAvailable += b.availableLimit;
        }
      }
    });

    // This month spending
    const currentMonthPrefix = getTodayDateString().slice(0, 7);
    let thisMonthSpend = 0;
    let thisMonthPayments = 0;

    transactions.forEach((tx) => {
      if (tx.tarih.startsWith(currentMonthPrefix)) {
        const tutarInTL = convertCurrencyToTRY(Number(tx.tutar || 0), tx.paraBirimi, exchangeRates.rates);
        if (tx.islemTipi === 'Harcama') {
          thisMonthSpend += tutarInTL;
        } else if (tx.islemTipi === 'Kart Ödemesi') {
          thisMonthPayments += tutarInTL;
        }
      }
    });

    return { totalLimit, totalDebt, totalAvailable, thisMonthSpend, thisMonthPayments };
  }, [cards, cardBalances, transactions, exchangeRates]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedCardId !== 'all' && tx.kartId !== selectedCardId) return false;
      if (selectedType !== 'all' && tx.islemTipi !== selectedType) return false;
      if (selectedSantiye !== 'all' && tx.santiyeId !== selectedSantiye) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchAciklama = tx.aciklama?.toLowerCase().includes(q);
        const matchKategori = tx.kategori?.toLowerCase().includes(q);
        const matchFatura = tx.faturaNo?.toLowerCase().includes(q);
        const matchFirma = tx.firmaAdi?.toLowerCase().includes(q);
        const matchSantiye = tx.santiyeAdi?.toLowerCase().includes(q);
        if (!matchAciklama && !matchKategori && !matchFatura && !matchFirma && !matchSantiye) return false;
      }
      return true;
    }).sort((a, b) => b.tarih.localeCompare(a.tarih));
  }, [transactions, selectedCardId, selectedType, selectedSantiye, searchTerm]);

  // Handlers for Card Modal
  const openNewCardModal = () => {
    setEditingCard(null);
    setCardForm({
      kartAdi: '',
      banka: 'Garanti BBVA',
      kartSahibi: '',
      kartNumarasiSon4: '',
      kartTuru: 'Şirket / Kurumsal',
      kartLimiti: 100000,
      kesimGunu: 15,
      sonOdemeGunu: 25,
      renk: 'slate',
      durum: 'Aktif',
      aciklama: '',
    });
    setIsCardModalOpen(true);
  };

  const openEditCardModal = (card: KrediKarti) => {
    setEditingCard(card);
    setCardForm({
      kartAdi: card.kartAdi,
      banka: card.banka,
      kartSahibi: card.kartSahibi,
      kartNumarasiSon4: card.kartNumarasiSon4,
      kartTuru: card.kartTuru,
      kartLimiti: card.kartLimiti,
      kesimGunu: card.kesimGunu,
      sonOdemeGunu: card.sonOdemeGunu,
      renk: card.renk || 'slate',
      durum: card.durum,
      aciklama: card.aciklama || '',
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.kartAdi.trim()) {
      showToast('Lütfen kart adını belirtin.', 'error');
      return;
    }
    if (!cardForm.kartNumarasiSon4.trim() || cardForm.kartNumarasiSon4.length !== 4) {
      showToast('Lütfen kartın son 4 hanesini doğru girin (örn: 4589).', 'error');
      return;
    }

    if (editingCard) {
      const updated: KrediKarti = {
        ...editingCard,
        ...cardForm,
      };
      onUpdateCard(updated);
    } else {
      const newCard: KrediKarti = {
        id: `kk-${Date.now()}`,
        ...cardForm,
      };
      onAddCard(newCard);
    }
    setIsCardModalOpen(false);
  };

  // Handlers for Transaction Modal
  const openNewTransactionModal = (type: 'Harcama' | 'Kart Ödemesi' | 'İade', cardId?: string) => {
    const targetCardId = cardId || (cards.length > 0 ? cards[0].id : '');
    const currentDebt = targetCardId && cardBalances[targetCardId] ? cardBalances[targetCardId].currentDebt : 0;

    setEditingTx(null);
    setPresetTxType(type);
    setPresetCardId(targetCardId);
    setIsCustomTxFirma(combinedFirmalar.length === 0);
    setAddManualTxFirmaToCari(false);
    setTxForm({
      kartId: targetCardId,
      tarih: getTodayDateString(),
      islemTipi: type,
      tutar: type === 'Kart Ödemesi' && currentDebt > 0 ? currentDebt : 0,
      paraBirimi: 'TRY',
      kategori: type === 'Kart Ödemesi' ? 'Ekstre / Kart Borcu Ödemesi' : (activeCategories[0] || 'Malzeme'),
      santiyeId: '',
      firmaId: '',
      firmaAdi: '',
      taksitSayisi: 1,
      faturaNo: '',
      aciklama: type === 'Kart Ödemesi' ? 'Kredi kartı ekstre borcu kapatma' : '',
    });
    setIsTxModalOpen(true);
  };

  const openEditTransactionModal = (tx: KrediKartiHarcama) => {
    setEditingTx(tx);
    setPresetTxType(tx.islemTipi);
    setPresetCardId(tx.kartId);

    // Find matching firmaId if not already directly set
    const rawFirmaName = (tx.firmaAdi || '').trim();
    const match = combinedFirmalar.find((f) => {
      if (rawFirmaName) {
        return f.isim.trim().toLowerCase() === rawFirmaName.toLowerCase();
      }
      return Boolean(tx.firmaId && f.id === tx.firmaId);
    });

    setIsCustomTxFirma(Boolean(rawFirmaName && !match));
    setAddManualTxFirmaToCari(false);
    setTxForm({
      kartId: tx.kartId,
      tarih: tx.tarih,
      islemTipi: tx.islemTipi,
      tutar: tx.tutar,
      paraBirimi: tx.paraBirimi || 'TRY',
      kategori: tx.kategori || (tx.islemTipi === 'Kart Ödemesi' ? 'Ekstre / Kart Borcu Ödemesi' : (activeCategories[0] || 'Malzeme')),
      santiyeId: tx.santiyeId || '',
      firmaId: match ? match.id : '',
      firmaAdi: match ? match.isim : rawFirmaName,
      taksitSayisi: tx.taksitSayisi || 1,
      faturaNo: tx.faturaNo || '',
      aciklama: tx.aciklama || '',
    });
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.kartId) {
      showToast('Lütfen bir kredi kartı seçin.', 'error');
      return;
    }
    if (!txForm.tutar || txForm.tutar <= 0) {
      showToast('Lütfen geçerli bir tutar girin.', 'error');
      return;
    }

    const santiyeObj = santiyeler.find((s) => s.id === txForm.santiyeId);
    const rawFirmaName = (txForm.firmaAdi || '').trim();
    const selectedFirma = combinedFirmalar.find((f) => {
      if (txForm.firmaId && f.id === txForm.firmaId) return true;
      if (rawFirmaName && f.isim.trim().toLowerCase() === rawFirmaName.toLowerCase()) return true;
      return false;
    });
    const isTaseron = Boolean(selectedFirma?.isTaseron) || (!rawFirmaName && txForm.kategori?.toLowerCase().includes('taşeron'));

    const txToSave: KrediKartiHarcama = {
      id: editingTx ? editingTx.id : `kkh-${Date.now()}`,
      kartId: txForm.kartId,
      tarih: txForm.tarih,
      islemTipi: txForm.islemTipi,
      tutar: Number(txForm.tutar),
      paraBirimi: txForm.paraBirimi || 'TRY',
      kategori: isTaseron && txForm.kategori === 'Malzeme / Hizmet Alımı' ? 'Taşeron Hakediş' : txForm.kategori,
      santiyeId: txForm.santiyeId || undefined,
      santiyeAdi: santiyeObj ? santiyeObj.isim : undefined,
      firmaId: selectedFirma ? selectedFirma.id : undefined,
      firmaAdi: selectedFirma ? selectedFirma.isim : (rawFirmaName || undefined),
      taksitSayisi: Number(txForm.taksitSayisi || 1),
      faturaNo: txForm.faturaNo ? txForm.faturaNo.trim() : undefined,
      aciklama:
        txForm.aciklama.trim() ||
        (txForm.islemTipi === 'Kart Ödemesi'
          ? 'Kart Borcu Ödemesi'
          : isTaseron
          ? `Taşeron Hakediş Ödemesi (${selectedFirma?.isim || rawFirmaName || 'Taşeron'})`
          : 'Kart Harcaması'),
      cariHesabaIsle: Boolean(selectedFirma || (rawFirmaName && addManualTxFirmaToCari)),
      santiyeGiderId: editingTx?.santiyeGiderId,
      cariHareketId: editingTx?.cariHareketId,
    };

    if (editingTx) {
      onUpdateTransaction(txToSave);
    } else {
      onAddTransaction(txToSave);
    }
    setIsTxModalOpen(false);
    setEditingTx(null);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      showToast('Dışa aktarılacak işlem hareketi bulunamadı.', 'info');
      return;
    }

    const headers = ['Tarih', 'Banka / Kart', 'İşlem Tipi', 'Kategori', 'Tutar (TL)', 'Taksit', 'Şantiye', 'Firma', 'Fatura/Fiş No', 'Açıklama'];
    const rows = filteredTransactions.map((tx) => {
      const card = cards.find((c) => c.id === tx.kartId);
      const cardLabel = card ? `${card.banka} (..${card.kartNumarasiSon4})` : 'Bilinmeyen Kart';
      return [
        tx.tarih,
        `"${cardLabel}"`,
        `"${tx.islemTipi}"`,
        `"${tx.kategori}"`,
        tx.tutar,
        tx.taksitSayisi > 1 ? `${tx.taksitSayisi} Taksit` : 'Tek Çekim',
        `"${tx.santiyeAdi || '-'}"`,
        `"${tx.firmaAdi || '-'}"`,
        `"${tx.faturaNo || '-'}"`,
        `"${tx.aciklama.replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kredi_Karti_Harcamalari_${getTodayDateString()}.csv`;
    link.click();
    showToast('Kredi kartı hareketleri CSV formatında indirildi.');
  };

  const getCardTransactionsExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Tarih', dataKey: 'tarih', width: 20 },
      { header: 'Banka / Kart', dataKey: 'kart', width: 28 },
      { header: 'İşlem Tipi', dataKey: 'islemTipi', width: 20 },
      { header: 'Kategori', dataKey: 'kategori', width: 22 },
      { header: 'Şantiye', dataKey: 'santiye', width: 22 },
      { header: 'Firma', dataKey: 'firma', width: 25 },
      { header: 'Açıklama', dataKey: 'aciklama', width: 32 },
      { header: 'Taksit', dataKey: 'taksit', width: 15, align: 'center' as const },
      { header: 'Tutar (TRY)', dataKey: 'tutarTRY', width: 22, align: 'right' as const },
    ];

    let totalHarcama = 0;
    let totalOdeme = 0;

    const data = filteredTransactions.map((tx) => {
      const card = cards.find((c) => c.id === tx.kartId);
      const cardLabel = card ? `${card.kartAdi || card.banka} (..${card.kartNumarasiSon4})` : 'Kart';
      const tryVal = convertCurrencyToTRY(tx.tutar, tx.paraBirimi || 'TRY', exchangeRates.rates);

      if (tx.islemTipi === 'Harcama') {
        totalHarcama += tryVal;
      } else {
        totalOdeme += tryVal;
      }

      return {
        tarih: tx.tarih,
        kart: cardLabel,
        islemTipi: tx.islemTipi,
        kategori: tx.kategori || '-',
        santiye: tx.santiyeAdi || '-',
        firma: tx.firmaAdi || '-',
        aciklama: tx.aciklama || '-',
        taksit: tx.taksitSayisi > 1 ? `${tx.taksitSayisi} Taksit` : 'Tek Çekim',
        tutarTRY: formatCurrency(tryVal),
      };
    });

    return {
      title: 'Kredi Kartı Harcama ve Ödeme Hareketleri',
      subtitle: `Toplam ${filteredTransactions.length} işlem kaydı`,
      filename: `Kredi_Karti_Hareketleri_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Harcama', value: formatCurrency(totalHarcama) },
        { label: 'Toplam Borç Ödemesi', value: formatCurrency(totalOdeme) },
        { label: 'Net Kart Farkı', value: formatCurrency(totalHarcama - totalOdeme) },
      ],
      orientation: 'landscape',
    };
  };

  const getCardsExportOptions = (): ExportOptions => {
    const columns = [
      { header: '#', dataKey: '__index', width: 10, align: 'center' as const },
      { header: 'Kart Adı', dataKey: 'kartAdi', width: 25 },
      { header: 'Banka', dataKey: 'banka', width: 25 },
      { header: 'Son 4 Hane', dataKey: 'son4', width: 15, align: 'center' as const },
      { header: 'Kart Sahibi', dataKey: 'kartSahibi', width: 25 },
      { header: 'Kart Türü', dataKey: 'tur', width: 18 },
      { header: 'Hesap Kesim', dataKey: 'hesapKesim', width: 18, align: 'center' as const },
      { header: 'Son Ödeme', dataKey: 'sonOdeme', width: 18, align: 'center' as const },
      { header: 'Limit (TRY)', dataKey: 'limit', width: 22, align: 'right' as const },
      { header: 'Güncel Borç (TRY)', dataKey: 'borc', width: 22, align: 'right' as const },
      { header: 'Kalan Limit (TRY)', dataKey: 'kalanLimit', width: 22, align: 'right' as const },
    ];

    let totalLimit = 0;
    let totalBorc = 0;

    const data = cards.map((c) => {
      const b = cardBalances[c.id] || { totalHarcama: 0, totalOdeme: 0, currentDebt: 0, availableLimit: c.kartLimiti };
      const limit = Number(c.kartLimiti || 0);
      totalLimit += limit;
      totalBorc += b.currentDebt;

      return {
        kartAdi: c.kartAdi,
        banka: c.banka,
        son4: `**** ${c.kartNumarasiSon4}`,
        kartSahibi: c.kartSahibi,
        tur: c.kartTuru,
        hesapKesim: `Her ayın ${c.kesimGunu}. günü`,
        sonOdeme: `Her ayın ${c.sonOdemeGunu}. günü`,
        limit: formatCurrency(limit),
        borc: formatCurrency(b.currentDebt),
        kalanLimit: formatCurrency(b.availableLimit),
      };
    });

    return {
      title: 'Kayıtlı Kredi Kartları Portföyü',
      subtitle: `Toplam ${cards.length} kredi kartı`,
      filename: `Kredi_Kartlari_Listesi_${getTodayDateString()}`,
      columns,
      data,
      summaryRows: [
        { label: 'Toplam Kart Limiti', value: formatCurrency(totalLimit) },
        { label: 'Toplam Güncel Borç', value: formatCurrency(totalBorc) },
        { label: 'Toplam Kullanılabilir Limit', value: formatCurrency(totalLimit - totalBorc) },
      ],
      orientation: 'landscape',
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Summary Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <CreditCardIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Kredi Kartları & Ekstre Takibi
                </h2>
                <p className="text-xs text-slate-500">
                  Şirket ve şahsi kredi kartlarının limitleri, şantiye harcamaları ve ekstre borç yönetimi
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-add-credit-card"
              onClick={openNewCardModal}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Kart Tanımla</span>
            </button>
            <button
              id="btn-add-card-expense"
              onClick={() => openNewTransactionModal('Harcama')}
              disabled={cards.length === 0}
              className="px-3.5 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Harcama Ekle</span>
            </button>
            <button
              id="btn-pay-card-debt"
              onClick={() => openNewTransactionModal('Kart Ödemesi')}
              disabled={cards.length === 0}
              className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Karta Ödeme Yap</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Toplam Kart Limiti</span>
              <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                <CreditCardIcon className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
              {formatCurrency(totals.totalLimit)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {cards.filter((c) => c.durum === 'Aktif').length} adet aktif kart tanımlı
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-700">Güncel Toplam Borç</span>
              <span className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600">
                <TrendingDown className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-rose-900">
              {formatCurrency(totals.totalDebt)}
            </div>
            <div className="mt-1 text-[11px] text-rose-700">
              {totals.totalLimit > 0
                ? `%${Math.round((totals.totalDebt / totals.totalLimit) * 100)} limit doluluğu`
                : 'Borç bulunmuyor'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">Kullanılabilir Limit</span>
              <span className="p-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-emerald-900">
              {formatCurrency(totals.totalAvailable)}
            </div>
            <div className="mt-1 text-[11px] text-emerald-700">
              Harcamaya hazır bakiye
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">Bu Ayki Kart Harcaması</span>
              <span className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-600">
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-blue-900">
              {formatCurrency(totals.thisMonthSpend)}
            </div>
            <div className="mt-1 text-[11px] text-blue-700">
              {formatCurrency(totals.thisMonthPayments)} ödendi
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('cards')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'cards'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCardIcon className="w-4 h-4" />
            <span>Kredi Kartlarım ({cards.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('transactions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'transactions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Harcama ve Ödeme Hareketleri ({transactions.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-1">
          {onOpenCurrencies && (
            <button
              type="button"
              onClick={onOpenCurrencies}
              title="Günlük Döviz Kurları ve Para Birimleri Tanımlama Sistemi"
              className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Döviz Kurları</span>
            </button>
          )}
          {activeSubTab === 'transactions' && (
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">CSV İndir</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: CARDS VISUAL LIST */}
      {activeSubTab === 'cards' && (
        <div className="space-y-6">
          {cards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <CreditCardIcon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Henüz Kayıtlı Kredi Kartı Yok</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Şantiye malzeme alımlarında, akaryakıt ve firma ödemelerinde kullandığınız şirket ve şahsi kredi kartlarınızı ekleyin.
              </p>
              <button
                onClick={openNewCardModal}
                className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>İlk Kartı Tanımla</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cards.map((card) => {
                const b = cardBalances[card.id] || { totalHarcama: 0, totalOdeme: 0, currentDebt: 0, availableLimit: card.kartLimiti };
                const usedPct = card.kartLimiti > 0 ? Math.min(100, Math.round((b.currentDebt / card.kartLimiti) * 100)) : 0;
                const colorConfig = COLOR_CLASSES[card.renk || 'slate'] || COLOR_CLASSES.slate;

                // Due date calculation
                const today = new Date();
                const currentDay = today.getDate();
                const isNearDue = Math.abs(card.sonOdemeGunu - currentDay) <= 4;

                return (
                  <div
                    key={card.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    {/* Visual Card Plastic Face */}
                    <div className={`p-5 bg-gradient-to-br ${colorConfig.bg} relative overflow-hidden`}>
                      {/* Decorative Background Circles */}
                      <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                      <div className="absolute right-12 -top-12 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

                      {/* Card Top Row: Bank & Type */}
                      <div className="flex items-center justify-between relative z-10">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider font-semibold opacity-75">
                            {card.kartTuru}
                          </span>
                          <h4 className="text-base font-bold tracking-tight text-white">
                            {card.banka}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${card.durum === 'Aktif' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-500/30 text-slate-300'}`}>
                            {card.durum}
                          </span>
                        </div>
                      </div>

                      {/* Chip & Contactless */}
                      <div className="mt-4 flex items-center gap-3 relative z-10">
                        <div className="w-8 h-6 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                          <div className="w-4 h-3 border border-amber-600/50 rounded-xs" />
                        </div>
                        <span className="text-white/40 text-xs font-mono">))))</span>
                      </div>

                      {/* Card Number Masked */}
                      <div className="mt-4 font-mono text-sm tracking-widest text-white/90 relative z-10 flex items-center gap-2">
                        <span>••••</span>
                        <span>••••</span>
                        <span>••••</span>
                        <span className="font-bold text-white">{card.kartNumarasiSon4}</span>
                      </div>

                      {/* Card Bottom Row: Holder & Due */}
                      <div className="mt-4 flex items-end justify-between relative z-10 text-xs">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider opacity-60 block">Kart Adı & Sahibi</span>
                          <span className="font-semibold text-white truncate max-w-[170px] block">
                            {card.kartAdi} {card.kartSahibi ? `• ${card.kartSahibi}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase tracking-wider opacity-60 block">Son Ödeme</span>
                          <span className="font-bold text-white">
                            Ayın {card.sonOdemeGunu}'i
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body: Financial Breakdown & Utilization */}
                    <div className="p-4 space-y-3.5 bg-white flex-1">
                      {/* Limit utilization bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Limit Kullanımı</span>
                          <span className={`font-bold ${usedPct > 80 ? 'text-rose-600' : usedPct > 50 ? 'text-amber-600' : 'text-slate-700'}`}>
                            %{usedPct} Dolu
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usedPct > 85 ? 'bg-rose-500' : usedPct > 50 ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Key Amounts Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="text-[11px] text-slate-500 block">Güncel Borç</span>
                          <span className={`font-bold text-sm ${b.currentDebt > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                            {formatCurrency(b.currentDebt)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/70">
                          <span className="text-[11px] text-emerald-700 block">Kullanılabilir Limit</span>
                          <span className="font-bold text-sm text-emerald-800">
                            {formatCurrency(b.availableLimit)}
                          </span>
                        </div>
                      </div>

                      {/* Statement Details */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>Hesap Kesim: Ayın {card.kesimGunu}'i</span>
                        <span className={`font-medium ${isNearDue ? 'text-amber-600 font-bold' : ''}`}>
                          Son Ödeme: Ayın {card.sonOdemeGunu}'i
                        </span>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openNewTransactionModal('Harcama', card.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Harcama</span>
                        </button>
                        <button
                          onClick={() => openNewTransactionModal('Kart Ödemesi', card.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Ödeme Yap</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditCardModal(card)}
                          title="Kartı Düzenle"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirm({
                              isOpen: true,
                              title: 'Kredi Kartını Sil',
                              description: `"${card.kartAdi}" (${card.banka}) kredi kartını ve bu karta bağlı tüm harcama ve ödeme kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                              onConfirm: () => onDeleteCard(card.id),
                            });
                          }}
                          title="Kartı Sil"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TRANSACTIONS TABLE */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Açıklama, fatura, firma, kategori..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Card Filter */}
              <div>
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tüm Kredi Kartları ({cards.length})</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.banka} - {c.kartAdi} (..{c.kartNumarasiSon4})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tüm İşlem Tipleri</option>
                  <option value="Harcama">Yalnızca Harcamalar</option>
                  <option value="Kart Ödemesi">Yalnızca Kart Ödemeleri</option>
                  <option value="İade">Yalnızca İadeler</option>
                </select>
              </div>

              {/* Site Filter */}
              <div>
                <select
                  value={selectedSantiye}
                  onChange={(e) => setSelectedSantiye(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Tüm Şantiyeler</option>
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.isim}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Tarih</th>
                    <th className="py-3 px-4">Kredi Kartı</th>
                    <th className="py-3 px-4">İşlem Tipi</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Şantiye / Firma</th>
                    <th className="py-3 px-4">Açıklama / Fatura</th>
                    <th className="py-3 px-4 text-center">Taksit</th>
                    <th className="py-3 px-4 text-right">Tutar</th>
                    <th className="py-3 px-3 text-center w-20">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {transactions.length === 0
                          ? 'Henüz bir kredi kartı harcaması veya ödemesi kaydedilmemiş.'
                          : 'Seçili filtrelere uygun hareket kaydı bulunamadı.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const card = cards.find((c) => c.id === tx.kartId);
                      const isExpense = tx.islemTipi === 'Harcama';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {tx.tarih}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {card ? card.banka : 'Bilinmeyen Kart'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {card ? `${card.kartAdi} (..${card.kartNumarasiSon4})` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isExpense
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : tx.islemTipi === 'Kart Ödemesi'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {isExpense ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              <span>{tx.islemTipi}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {tx.kategori}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {tx.santiyeAdi && (
                              <div className="flex items-center gap-1 font-medium text-slate-800">
                                <HardHat className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="truncate max-w-[140px]">{tx.santiyeAdi}</span>
                              </div>
                            )}
                            {tx.firmaAdi && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[140px]">{tx.firmaAdi}</span>
                                </div>
                                {(() => {
                                  const isTas =
                                    taseronlar.some((t) => t.id === tx.firmaId || t.isim.trim().toLowerCase() === tx.firmaAdi?.trim().toLowerCase()) ||
                                    tx.kategori?.toLowerCase().includes('taşeron');
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        isTas
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                                      }`}
                                      title={isTas ? 'Taşeron Cari Hesabına ve Hakediş/Ödeme tablosuna senkronize edildi' : 'Firma Cari Hesabına ödeme olarak senkronize edildi'}
                                    >
                                      <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                                      {isTas ? 'Taşeron Cari & Hakediş' : 'Firma Cari'}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                            {!tx.santiyeAdi && !tx.firmaAdi && (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800 font-medium max-w-[220px] truncate" title={tx.aciklama}>
                              {tx.aciklama}
                            </div>
                            {tx.faturaNo && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                Fiş/Fat: {tx.faturaNo}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {tx.taksitSayisi > 1 ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold border border-purple-200 text-[11px]">
                                {tx.taksitSayisi} Taksit
                              </span>
                            ) : (
                              <span className="text-slate-400">Tek Çekim</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 font-mono">
                              <span className={isExpense ? 'text-rose-600' : 'text-emerald-600'}>
                                {isExpense ? '-' : '+'} {formatCurrency(tx.tutar, tx.paraBirimi)}
                              </span>
                              {tx.paraBirimi && tx.paraBirimi !== 'TRY' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  {tx.paraBirimi}
                                </span>
                              )}
                            </div>
                            {tx.paraBirimi && tx.paraBirimi !== 'TRY' && (
                              <div className="text-[10px] text-slate-400 font-mono font-normal">
                                ≈ {formatCurrency(convertCurrencyToTRY(tx.tutar, tx.paraBirimi, exchangeRates.rates))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditTransactionModal(tx)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Hareketi Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const card = cards.find((c) => c.id === tx.kartId);
                                  const cardName = card ? ` (${card.banka} - ${card.kartAdi})` : '';
                                  const isTas =
                                    taseronlar.some((t) => t.id === tx.firmaId || (tx.firmaAdi && t.isim.trim().toLowerCase() === tx.firmaAdi.trim().toLowerCase())) ||
                                    tx.kategori?.toLowerCase().includes('taşeron');
                                  const syncNotice = tx.firmaAdi
                                    ? `\n\n⚠️ ÇİFT YÖNLÜ TAM SENKRONİZASYON: Bu harcama silindiğinde;\n- "${tx.firmaAdi}" ${isTas ? 'Taşeron Cari Hesabı' : 'Firma Cari Hesabı'}ndaki ödeme kaydı,\n- İlgili Şantiye Giderleri kaydı,\n${isTas ? '- Taşeron Hakediş/Ödeme hareketleri,\n' : ''}otomatik olarak ve aynı anda silinecektir.`
                                    : '';
                                  setDeleteConfirm({
                                    isOpen: true,
                                    title: 'Kart Hareketini Sil (Çift Yönlü Senkronizasyon)',
                                    description: `${tx.tarih} tarihli, ${formatCurrency(tx.tutar, tx.paraBirimi || 'TRY')} tutarındaki "${tx.aciklama || tx.kategori}" hareketini${cardName} silmek istediğinize emin misiniz?${syncNotice}`,
                                    onConfirm: () => onDeleteTransaction(tx.id),
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Kaydı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT CREDIT CARD */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <CreditCardIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCard ? 'Kredi Kartını Düzenle' : 'Yeni Kredi Kartı Tanımla'}
                  </h3>
                  <p className="text-xs text-slate-500">Banka, limit ve hesap kesim günü bilgileri</p>
                </div>
              </div>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Banka *
                  </label>
                  <select
                    value={cardForm.banka}
                    onChange={(e) => setCardForm({ ...cardForm, banka: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {BANKA_LISTESI.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Adı / Takma İsim *
                  </label>
                  <input
                    type="text"
                    required
                    value={cardForm.kartAdi}
                    onChange={(e) => setCardForm({ ...cardForm, kartAdi: e.target.value })}
                    placeholder="Örn: Garanti Bonus Şirket"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Sahibi (Kişi / Firma Unvanı)
                  </label>
                  <input
                    type="text"
                    value={cardForm.kartSahibi}
                    onChange={(e) => setCardForm({ ...cardForm, kartSahibi: e.target.value })}
                    placeholder="Örn: Zirve Yapı İnşaat A.Ş."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Son 4 Hane *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={cardForm.kartNumarasiSon4}
                    onChange={(e) => setCardForm({ ...cardForm, kartNumarasiSon4: e.target.value.replace(/\D/g, '') })}
                    placeholder="4589"
                    className="w-full px-3 py-2 text-xs font-mono font-bold tracking-widest text-center rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Limiti (TL) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={cardForm.kartLimiti || ''}
                    onChange={(e) => setCardForm({ ...cardForm, kartLimiti: Number(e.target.value) })}
                    placeholder="150000"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hesap Kesim Günü
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={cardForm.kesimGunu}
                    onChange={(e) => setCardForm({ ...cardForm, kesimGunu: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Son Ödeme Günü
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={cardForm.sonOdemeGunu}
                    onChange={(e) => setCardForm({ ...cardForm, sonOdemeGunu: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Türü
                  </label>
                  <select
                    value={cardForm.kartTuru}
                    onChange={(e) => setCardForm({ ...cardForm, kartTuru: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Şirket / Kurumsal">Şirket / Kurumsal</option>
                    <option value="Şahsi">Şahsi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kart Görsel Rengi
                  </label>
                  <select
                    value={cardForm.renk}
                    onChange={(e) => setCardForm({ ...cardForm, renk: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="slate">Asil Siyah / Grafit</option>
                    <option value="blue">İş Mavisi</option>
                    <option value="emerald">Zümrüt Yeşili</option>
                    <option value="purple">Mor / Platin</option>
                    <option value="amber">Altın / Gold</option>
                    <option value="rose">Bordo / Kırmızı</option>
                    <option value="indigo">Lacivert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durum
                  </label>
                  <select
                    value={cardForm.durum}
                    onChange={(e) => setCardForm({ ...cardForm, durum: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Pasif">Pasif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama / Not
                </label>
                <input
                  type="text"
                  value={cardForm.aciklama}
                  onChange={(e) => setCardForm({ ...cardForm, aciklama: e.target.value })}
                  placeholder="Opsiyonel kart notu..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  {editingCard ? 'Değişiklikleri Kaydet' : 'Kartı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD TRANSACTION (HARCAMA VEYA KART ÖDEMESİ) */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                    txForm.islemTipi === 'Harcama'
                      ? 'bg-rose-50 border-rose-100 text-rose-600'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  }`}
                >
                  {txForm.islemTipi === 'Harcama' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTx
                      ? (txForm.islemTipi === 'Harcama' ? 'Kredi Kartı Harcamasını Düzenle' : 'Kredi Kartı Ödemesini Düzenle')
                      : (txForm.islemTipi === 'Harcama' ? 'Kredi Kartı ile Harcama Gir' : 'Kredi Kartına Ödeme Yap (Borç Kapat)')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingTx
                      ? 'İşlem detaylarını düzenleyin. İlgili cari ve şantiye gider kayıtları otomatik güncellenecektir.'
                      : (txForm.islemTipi === 'Harcama'
                        ? 'Karttan çekilen şantiye harcaması veya malzeme alımı'
                        : 'Bankaya ödenen ekstre veya ara ödeme tutarı')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsTxModalOpen(false);
                  setEditingTx(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setTxForm({ ...txForm, islemTipi: 'Harcama', kategori: activeCategories[0] || 'Malzeme' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    txForm.islemTipi === 'Harcama' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Kredi Kartı Harcaması
                </button>
                <button
                  type="button"
                  onClick={() => setTxForm({ ...txForm, islemTipi: 'Kart Ödemesi', kategori: 'Ekstre / Kart Borcu Ödemesi' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    txForm.islemTipi === 'Kart Ödemesi' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Karta Ödeme Yap (Ekstre)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kredi Kartı *
                  </label>
                  <select
                    required
                    value={txForm.kartId}
                    onChange={(e) => setTxForm({ ...txForm, kartId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {cards.map((c) => {
                      const debt = cardBalances[c.id]?.currentDebt || 0;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.banka} - {c.kartAdi} (..{c.kartNumarasiSon4}) [Borç: {formatCurrency(debt)}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    İşlem Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={txForm.tarih}
                    onChange={(e) => setTxForm({ ...txForm, tarih: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tutar <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Para Birimi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                        {getCurrencySymbol(txForm.paraBirimi || 'TRY')}
                      </span>
                      <input
                        type="number"
                        required
                        min={0.01}
                        step="any"
                        value={txForm.tutar || ''}
                        onChange={(e) => setTxForm({ ...txForm, tutar: Number(e.target.value) })}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <CurrencySelector
                        value={txForm.paraBirimi || 'TRY'}
                        onChange={(curr) => setTxForm({ ...txForm, paraBirimi: curr })}
                      />
                    </div>
                  </div>
                  {txForm.paraBirimi && txForm.paraBirimi !== 'TRY' && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-1.5 mt-1 border border-amber-200/80 font-mono flex items-center justify-between">
                      <span>≈ {formatCurrency(convertCurrencyToTRY(Number(txForm.tutar) || 0, txForm.paraBirimi, exchangeRates.rates))}</span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        1 {txForm.paraBirimi} = {exchangeRates.rates[txForm.paraBirimi] || '-'} ₺
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Taksit Sayısı
                  </label>
                  <select
                    value={txForm.taksitSayisi}
                    onChange={(e) => setTxForm({ ...txForm, taksitSayisi: Number(e.target.value) })}
                    disabled={txForm.islemTipi === 'Kart Ödemesi'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 disabled:opacity-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={1}>1 (Tek Çekim)</option>
                    <option value={2}>2 Taksit</option>
                    <option value={3}>3 Taksit</option>
                    <option value={4}>4 Taksit</option>
                    <option value={5}>5 Taksit</option>
                    <option value={6}>6 Taksit</option>
                    <option value={9}>9 Taksit</option>
                    <option value={12}>12 Taksit</option>
                  </select>
                </div>
              </div>

              {txForm.islemTipi === 'Harcama' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Harcama Kategorisi *
                        </label>
                        {onAddKategori && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewCategoryInput('');
                              setCategoryError('');
                              setIsCategoryModalOpen(true);
                            }}
                            className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Kategori Ekle</span>
                          </button>
                        )}
                      </div>
                      <select
                        value={txForm.kategori}
                        onChange={(e) => setTxForm({ ...txForm, kategori: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        {txForm.kategori &&
                          !activeCategories.some(
                            (c) => c.toLowerCase() === txForm.kategori.toLowerCase()
                          ) && (
                            <option value={txForm.kategori}>
                              {txForm.kategori}
                            </option>
                          )}
                        {activeCategories.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        İlgili Şantiye
                      </label>
                      <select
                        value={txForm.santiyeId}
                        onChange={(e) => setTxForm({ ...txForm, santiyeId: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Seçilmedi (Genel Harcama)</option>
                        {santiyeler.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.isim}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          İlgili Firma / Tedarikçi / Taşeron
                        </label>
                        {combinedFirmalar.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextMode = !isCustomTxFirma;
                              setIsCustomTxFirma(nextMode);
                              if (nextMode) {
                                setTxForm({ ...txForm, firmaId: '', firmaAdi: '' });
                              }
                            }}
                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                          >
                            {isCustomTxFirma ? '← Cari Listeden Seç' : '✍️ Manuel'}
                          </button>
                        )}
                      </div>

                      {!isCustomTxFirma && combinedFirmalar.length > 0 ? (
                        <select
                          value={txForm.firmaId}
                          onChange={(e) => {
                            const fId = e.target.value;
                            if (fId === '__custom__') {
                              setIsCustomTxFirma(true);
                              setTxForm({ ...txForm, firmaId: '', firmaAdi: '' });
                              return;
                            }
                            const found = combinedFirmalar.find((f) => f.id === fId);
                            setTxForm({
                              ...txForm,
                              firmaId: fId,
                              firmaAdi: found ? found.isim : '',
                              kategori: found?.isTaseron ? 'Taşeron Hakediş' : txForm.kategori,
                            });
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Firma Cari Kayıtlarından Seçiniz --</option>
                          {combinedFirmalar.filter((f) => !f.isTaseron).length > 0 && (
                            <optgroup label="Tedarikçiler ve Diğer Firmalar">
                              {combinedFirmalar
                                .filter((f) => !f.isTaseron)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    🏢 {f.isim} {f.tur === 'tedarikci' ? '(Tedarikçi)' : ''}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          {combinedFirmalar.filter((f) => f.isTaseron).length > 0 && (
                            <optgroup label="Taşeronlar">
                              {combinedFirmalar
                                .filter((f) => f.isTaseron)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    🏗️ {f.isim} (Taşeron)
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          <option value="__custom__">✍️ + Listede Yok (Manuel Firma Adı Yaz)...</option>
                        </select>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={txForm.firmaAdi || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = combinedFirmalar.find(
                                  (f) => f.isim.trim().toLowerCase() === val.trim().toLowerCase()
                                );
                                setTxForm({
                                  ...txForm,
                                  firmaAdi: val,
                                  firmaId: matched ? matched.id : '',
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const trimmed = (txForm.firmaAdi || '').trim();
                                  if (!trimmed) return;
                                  e.preventDefault();
                                  const matched = combinedFirmalar.find(
                                    (f) => f.isim.trim().toLowerCase() === trimmed.toLowerCase()
                                  );
                                  if (matched) {
                                    setTxForm({ ...txForm, firmaId: matched.id, firmaAdi: matched.isim });
                                    setIsCustomTxFirma(false);
                                  } else if (onAddFirma) {
                                    const newId = `f-ted-${Date.now()}`;
                                    onAddFirma({
                                      id: newId,
                                      isim: trimmed,
                                      tur: 'tedarikci',
                                      ilgili: '',
                                      telefon: '',
                                      vergiNo: '',
                                      adres: '',
                                      email: '',
                                    });
                                    setTxForm({ ...txForm, firmaId: newId, firmaAdi: trimmed });
                                    setIsCustomTxFirma(false);
                                  }
                                }
                              }}
                              placeholder="Örn: Opet Petrol (Yeni tedarikçi adı yazın)"
                              autoFocus
                              className="flex-1 px-3 py-2 text-xs rounded-xl border border-indigo-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                            />
                            {onAddFirma &&
                              (txForm.firmaAdi || '').trim() &&
                              !combinedFirmalar.some(
                                (f) => f.isim.trim().toLowerCase() === (txForm.firmaAdi || '').trim().toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const trimmed = (txForm.firmaAdi || '').trim();
                                    if (!trimmed) return;
                                    const newId = `f-ted-${Date.now()}`;
                                    onAddFirma({
                                      id: newId,
                                      isim: trimmed,
                                      tur: 'tedarikci',
                                      ilgili: '',
                                      telefon: '',
                                      vergiNo: '',
                                      adres: '',
                                      email: '',
                                    });
                                    setTxForm({ ...txForm, firmaId: newId, firmaAdi: trimmed });
                                    setIsCustomTxFirma(false);
                                  }}
                                  className="px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0 flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Ekle</span>
                                </button>
                              )}
                          </div>
                          {(txForm.firmaAdi || '').trim() && !txForm.firmaId && (
                            <label className="flex items-start gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={addManualTxFirmaToCari}
                                onChange={(e) => setAddManualTxFirmaToCari(e.target.checked)}
                                className="w-3.5 h-3.5 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="text-[10px] leading-snug">
                                <span className="font-bold text-slate-800 block">
                                  "{(txForm.firmaAdi || '').trim()}" firmasını Firma Cari Kayıtlarına "Tedarikçi" olarak ekle
                                </span>
                                <span className="text-slate-500">
                                  {addManualTxFirmaToCari
                                    ? 'İşaretli: Cari kayıtlara tedarikçi olarak eklenecek ve ödeme işlenecektir.'
                                    : 'İşaretsiz: Cari kayıtlara eklenmez, sadece bu harcamada firma adı olarak görünür.'}
                                </span>
                              </div>
                            </label>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Fatura / Fiş No
                      </label>
                      <input
                        type="text"
                        value={txForm.faturaNo}
                        onChange={(e) => setTxForm({ ...txForm, faturaNo: e.target.value })}
                        placeholder="Örn: FAT-2025-0891"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Real-time sync feedback banner */}
                  {txForm.firmaId && (() => {
                    const sel = combinedFirmalar.find((f) => f.id === txForm.firmaId);
                    if (!sel) return null;
                    return sel.isTaseron ? (
                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                        <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Taşeron & Cari Senkronizasyonu Aktif:</span> Bu kart harcaması kaydedildiğinde;{' '}
                          <strong>"{sel.isim}"</strong> taşeronunun Cari Hesabına "Ödeme Yapıldı" (Alacak) olarak eklenecek, Şantiye Giderleri tablosuna ve Taşeron Hakediş/Ödeme bölümüne çift yönlü senkronize edilecektir.
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                        <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Firma Cari Senkronizasyonu Aktif:</span> Bu kart harcaması kaydedildiğinde;{' '}
                          <strong>"{sel.isim}"</strong> firmasının Cari Hesabına "Ödeme Yapıldı" (Alacak) olarak otomatik işlenecektir.
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Açıklama *
                </label>
                <input
                  type="text"
                  required
                  value={txForm.aciklama}
                  onChange={(e) => setTxForm({ ...txForm, aciklama: e.target.value })}
                  placeholder={
                    txForm.islemTipi === 'Harcama'
                      ? 'Örn: Şantiye jeneratörü için motorin alımı'
                      : 'Örn: Garanti Bankası vadesiz hesaptan ekstre kapatıldı'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsTxModalOpen(false);
                    setEditingTx(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-xs cursor-pointer ${
                    txForm.islemTipi === 'Harcama'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {editingTx
                    ? 'Değişiklikleri Kaydet'
                    : (txForm.islemTipi === 'Harcama' ? 'Harcamayı Kaydet' : 'Ödemeyi Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* KATEGORİ YÖNETİMİ & YENİ KATEGORİ EKLE MODALI (Şantiye Gider Fişi ile Ortak) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Şantiye & Kart Harcama Kategorileri
                  </h3>
                  <p className="text-xs text-slate-500">
                    Şantiye gider fişleri ve kredi kartı harcamalarında kullanılan ortak kategoriler
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200">
              <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide mb-1.5">
                + Yeni Kategori Ekle
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Örn: İskele & Kalıp Kirası, Ruhsat & Harçlar..."
                  value={newCategoryInput}
                  onChange={(e) => {
                    setNewCategoryInput(e.target.value);
                    if (categoryError) setCategoryError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = newCategoryInput.trim();
                      if (!trimmed) {
                        setCategoryError('Kategori adı boş olamaz.');
                        return;
                      }
                      if (activeCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
                        setCategoryError('Bu isimde bir kategori zaten mevcut.');
                        return;
                      }
                      onAddKategori?.(trimmed);
                      setTxForm((prev) => ({ ...prev, kategori: trimmed }));
                      setNewCategoryInput('');
                      setCategoryError('');
                    }
                  }}
                  className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newCategoryInput.trim();
                    if (!trimmed) {
                      setCategoryError('Kategori adı boş olamaz.');
                      return;
                    }
                    if (activeCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
                      setCategoryError('Bu isimde bir kategori zaten mevcut.');
                      return;
                    }
                    onAddKategori?.(trimmed);
                    setTxForm((prev) => ({ ...prev, kategori: trimmed }));
                    setNewCategoryInput('');
                    setCategoryError('');
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ekle</span>
                </button>
              </div>
              {categoryError && (
                <p className="text-xs text-rose-600 font-semibold mt-1.5">
                  {categoryError}
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Mevcut Ortak Kategoriler ({activeCategories.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {activeCategories.map((cat) => {
                  const usedCount =
                    giderler.filter((g) => g.kategori === cat).length +
                    transactions.filter((t) => t.kategori === cat).length;
                  const isDeletable = usedCount === 0;

                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {cat}
                        </span>
                        {cat === txForm.kategori && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                            Seçili
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDeletable && onDeleteKategori && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirm({
                                isOpen: true,
                                title: 'Kategoriyi Sil',
                                description: `"${cat}" kategorisini silmek istediğinize emin misiniz?`,
                                onConfirm: () => onDeleteKategori(cat),
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Kategoriyi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Kapat
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
