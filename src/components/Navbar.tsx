import React from 'react';
import { 
  Users, 
  CalendarCheck, 
  Receipt, 
  HardHat, 
  Building2, 
  Coins, 
  Layers, 
  Download, 
  Upload, 
  Plus,
  BookOpenCheck,
  CreditCard,
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  LayoutDashboard,
  RotateCcw,
  BarChart3,
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { SyncStatus } from '../services/firestoreSync';
import { AppUser, UserRole } from '../types';

export type ActiveTabType = 
  | 'dashboard'
  | 'personnel' 
  | 'attendance' 
  | 'payroll' 
  | 'sites' 
  | 'credit_cards' 
  | 'subcontractors' 
  | 'companies' 
  | 'checks'
  | 'reports'
  | 'users';

export type PayrollSubTabType = 'hakedis' | 'taseron' | 'odemeler' | 'analiz';

interface NavbarProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  payrollSubTab?: PayrollSubTabType;
  onSelectPayrollSubTab?: (subTab: PayrollSubTabType) => void;
  taseronCount?: number;
  odemelerCount?: number;
  onOpenAddPersonnel: () => void;
  personnelCount: number;
  activeSitesCount: number;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onOpenResetModal?: () => void;
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date | null;
  onForceSync?: () => void;
  onOpenCurrencies?: () => void;
  currentUser?: AppUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  payrollSubTab = 'hakedis',
  onSelectPayrollSubTab,
  taseronCount = 0,
  odemelerCount = 0,
  onOpenAddPersonnel,
  personnelCount,
  activeSitesCount,
  onExportBackup,
  onImportBackup,
  onOpenResetModal,
  syncStatus = 'connected',
  lastSyncedAt,
  onForceSync,
  onOpenCurrencies,
  currentUser,
  onLogout,
}) => {
  // All possible navigation items with permission checks
  const allNavItems: {
    id: ActiveTabType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    requiredPermission?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canViewDashboard : true,
    },
    {
      id: 'personnel',
      label: 'Personel',
      icon: <Users className="w-4 h-4" />,
      badge: personnelCount,
      requiredPermission: currentUser ? currentUser.permissions.canManagePersonnel : true,
    },
    {
      id: 'attendance',
      label: 'Puantaj & Mesai',
      icon: <CalendarCheck className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageAttendance : true,
    },
    {
      id: 'payroll',
      label: 'Hakediş & Ödeme',
      icon: <Receipt className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManagePayroll : true,
    },
    {
      id: 'sites',
      label: currentUser && !currentUser.permissions.canManagePayroll && currentUser.permissions.canManageSites
        ? 'Şantiye Masrafları'
        : 'Şantiyeler',
      icon: <HardHat className="w-4 h-4" />,
      badge: activeSitesCount,
      requiredPermission: currentUser ? currentUser.permissions.canManageSites : true,
    },
    {
      id: 'credit_cards',
      label: 'Kredi Kartları',
      icon: <CreditCard className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageCreditCards : true,
    },
    {
      id: 'subcontractors',
      label: 'Taşeronlar',
      icon: <Layers className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageSubcontractors : true,
    },
    {
      id: 'companies',
      label: 'Firmalar & Cari',
      icon: <Building2 className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageCompanies : true,
    },
    {
      id: 'checks',
      label: 'Çek Takibi',
      icon: <BookOpenCheck className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageChecks : true,
    },
    {
      id: 'reports',
      label: 'Raporlar',
      icon: <BarChart3 className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canViewReports : true,
    },
    {
      id: 'users',
      label: 'Kullanıcılar & İzinler',
      icon: <ShieldCheck className="w-4 h-4" />,
      requiredPermission: currentUser ? currentUser.permissions.canManageUsers : false,
    },
  ];

  // Filter only permitted tabs for this authenticated user
  const navItems = allNavItems.filter((item) => item.requiredPermission);

  const canManageSettings = currentUser ? currentUser.permissions.canManageSettings : true;
  const canManagePersonnel = currentUser ? currentUser.permissions.canManagePersonnel : true;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between h-16 border-b border-slate-100 lg:border-none">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
              <HardHat className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Şantiye & Personel ERP
                </h1>
                {currentUser && (() => {
                  const badgeMap: Record<UserRole, { label: string; cls: string }> = {
                    admin: { label: '👑 Yönetici', cls: 'bg-purple-50 text-purple-800 border-purple-200' },
                    muhasebe: { label: '💼 Ön Muhasebe', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                    puantor: { label: '📋 Saha Puantörü', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                    taseron_yetkilisi: { label: '🤝 Taşeron Yetkilisi', cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                    saha_sorumlusu: { label: '👷 Saha Sorumlusu', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                    custom: { label: '⚙️ Özel Yetkili', cls: 'bg-slate-100 text-slate-800 border-slate-300' },
                  };
                  const badge = badgeMap[currentUser.role] || badgeMap.custom;
                  return (
                    <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {currentUser?.role === 'admin'
                  ? 'Şirket & Sistem Yönetimi • Tüm Modüllere Tam Yetkili Erişim'
                  : currentUser?.role === 'muhasebe'
                  ? 'Ön Muhasebe & Finans Paneli • Maaş, Cari, Çek ve Raporlama'
                  : currentUser?.permissions.canManagePayroll
                  ? 'Personel, Puantaj, Hakediş, Şantiye, Giderler, Kredi Kartları, Cari & Çek Yönetimi'
                  : 'Saha Personel Puantajı ve Şantiye Masraf Girişi Yönetim Paneli'}
              </p>
            </div>
          </div>

          {/* Top Actions & User Badge */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Cloud Sync Status Indicator */}
            <div 
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                syncStatus === 'connected' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                  : syncStatus === 'syncing'
                  ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title={
                syncStatus === 'connected'
                  ? `Firebase Bulut Veritabanı Canlı Bağlı ${lastSyncedAt ? `(Son Senkronizasyon: ${lastSyncedAt.toLocaleTimeString('tr-TR')})` : ''} - Yenilemek için tıklayın`
                  : syncStatus === 'syncing'
                  ? 'Veriler Firebase ile senkronize ediliyor...'
                  : 'Çevrimdışı Mod - Veriler yerel hafızaya kaydediliyor'
              }
              onClick={onForceSync}
            >
              {syncStatus === 'connected' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Bulut Senkron</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping hidden lg:inline-block" />
                </>
              )}
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                  <span className="hidden sm:inline">Kaydediliyor...</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 hidden sm:inline">Çevrimdışı</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600 hidden sm:inline">Bulut Hatası</span>
                </>
              )}
            </div>

            {/* Admin Settings & Backup Tools (Guarded by canManageSettings) */}
            {canManageSettings && (
              <div className="flex items-center gap-1 border-r border-slate-200 pr-1 sm:pr-2">
                {onOpenCurrencies && (
                  <button
                    id="btn-navbar-currencies"
                    type="button"
                    onClick={onOpenCurrencies}
                    title="Günlük Döviz Kurları ve Para Birimleri Tanımlama Sistemi"
                    className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="hidden md:inline">Döviz Kurları</span>
                  </button>
                )}
                <button
                  id="btn-export-backup"
                  type="button"
                  onClick={onExportBackup}
                  title="Tüm ERP Verilerini İndir veya Kopyala (JSON)"
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">Yedekle</span>
                </button>
                <button
                  id="btn-import-backup"
                  type="button"
                  onClick={onImportBackup}
                  title="Yedek Dosyasından Geri Yükle (JSON)"
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">İçe Aktar</span>
                </button>
                {onOpenResetModal && (
                  <button
                    id="btn-reset-data-navbar"
                    type="button"
                    onClick={onOpenResetModal}
                    title="Verileri Sıfırla veya Demo Yükle"
                    className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden md:inline">Sıfırla</span>
                  </button>
                )}
              </div>
            )}

            {/* Add Personnel Button (Guarded by canManagePersonnel) */}
            {canManagePersonnel && (
              <button
                id="btn-add-personnel-navbar"
                onClick={onOpenAddPersonnel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Personel Ekle</span>
              </button>
            )}

            {/* Authenticated User Profile & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div 
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 transition-colors"
                  title={`${currentUser.fullName} (@${currentUser.username}) - ${currentUser.unvan || ''}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    currentUser.role === 'admin'
                      ? 'bg-purple-600 text-white'
                      : currentUser.role === 'muhasebe'
                      ? 'bg-emerald-600 text-white'
                      : currentUser.role === 'puantor'
                      ? 'bg-amber-600 text-white'
                      : currentUser.role === 'taseron_yetkilisi'
                      ? 'bg-indigo-600 text-white'
                      : currentUser.role === 'saha_sorumlusu'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-white'
                  }`}>
                    {currentUser.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left leading-tight">
                    <div className="text-xs font-bold text-slate-800 truncate max-w-[110px]">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      @{currentUser.username} {currentUser.unvan ? `• ${currentUser.unvan}` : ''}
                    </div>
                  </div>
                </div>

                {onLogout && (
                  <button
                    id="btn-navbar-logout"
                    type="button"
                    onClick={onLogout}
                    title="Güvenli Çıkış Yap"
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Tabs */}
        <div className="overflow-x-auto py-2 scrollbar-none flex items-center gap-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
