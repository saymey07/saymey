import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Search,
  Filter,
  KeyRound,
  Edit2,
  Edit3,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  CalendarCheck,
  Receipt,
  HardHat,
  Users,
  Briefcase,
  Layers,
  BarChart3,
  CreditCard,
  BookOpenCheck,
  Settings,
  HelpCircle,
  Check,
  X,
  UserCheck,
  Sparkles
} from 'lucide-react';
import { AppUser, UserRole, UserPermissions, Santiye, Taseron } from '../types';
import { ROLE_PRESET_PERMISSIONS } from '../utils/storage';

interface UserManagementProps {
  users: AppUser[];
  santiyeler: Santiye[];
  taseronlar?: Taseron[];
  currentUser: AppUser;
  onAddUser: (user: AppUser) => void;
  onUpdateUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSwitchUser?: (user: AppUser) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  santiyeler,
  taseronlar = [],
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  showToast,
  onSwitchUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [santiyeFilter, setSantiyeFilter] = useState<string>('all');
  const [taseronFilter, setTaseronFilter] = useState<string>('all');
  const [actionPermissionFilter, setActionPermissionFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form State
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formUnvan, setFormUnvan] = useState('');
  const [formTelefon, setFormTelefon] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('saha_sorumlusu');
  const [formDurum, setFormDurum] = useState<'Aktif' | 'Pasif'>('Aktif');
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(ROLE_PRESET_PERMISSIONS.saha_sorumlusu);
  const [formSiteRestrictionMode, setFormSiteRestrictionMode] = useState<'all' | 'custom'>('all');
  const [formAssignedSites, setFormAssignedSites] = useState<string[]>([]);
  const [formTaseronRestrictionMode, setFormTaseronRestrictionMode] = useState<'all' | 'custom'>('all');
  const [formAssignedTaserons, setFormAssignedTaserons] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Password Reset Modal
  const [passwordResetUser, setPasswordResetUser] = useState<AppUser | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Delete Confirm Modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AppUser | null>(null);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        searchTerm === '' ||
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.unvan && u.unvan.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.telefon && u.telefon.includes(searchTerm));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.durum === statusFilter;

      const matchSantiye =
        santiyeFilter === 'all' ||
        (santiyeFilter === 'unrestricted' && (!u.assignedSantiyeIds || u.assignedSantiyeIds.length === 0)) ||
        (santiyeFilter === 'restricted' && Array.isArray(u.assignedSantiyeIds) && u.assignedSantiyeIds.length > 0) ||
        (u.assignedSantiyeIds && u.assignedSantiyeIds.includes(santiyeFilter));

      const matchTaseron =
        taseronFilter === 'all' ||
        (taseronFilter === 'unrestricted' && (!u.assignedTaseronIds || u.assignedTaseronIds.length === 0)) ||
        (taseronFilter === 'restricted' && Array.isArray(u.assignedTaseronIds) && u.assignedTaseronIds.length > 0) ||
        (u.assignedTaseronIds && u.assignedTaseronIds.includes(taseronFilter));

      const matchActionPermission =
        actionPermissionFilter === 'all' ||
        (actionPermissionFilter === 'canDelete_true' && u.permissions?.canDelete === true) ||
        (actionPermissionFilter === 'canDelete_false' && !u.permissions?.canDelete) ||
        (actionPermissionFilter === 'canEdit_true' && u.permissions?.canEdit !== false) ||
        (actionPermissionFilter === 'canEdit_false' && u.permissions?.canEdit === false);

      return matchSearch && matchRole && matchStatus && matchSantiye && matchTaseron && matchActionPermission;
    });
  }, [users, searchTerm, roleFilter, statusFilter, santiyeFilter, taseronFilter, actionPermissionFilter]);

  // KPIs
  const totalUsersCount = users.length;
  const activeUsersCount = users.filter((u) => u.durum === 'Aktif').length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.durum === 'Aktif').length;
  const fieldStaffCount = users.filter((u) => (u.role === 'saha_sorumlusu' || u.role === 'puantor' || u.role === 'taseron_yetkilisi') && u.durum === 'Aktif').length;
  const canDeleteCount = users.filter((u) => u.permissions?.canDelete && u.durum === 'Aktif').length;
  const canEditCount = users.filter((u) => u.permissions?.canEdit !== false && u.durum === 'Aktif').length;

  const handleToggleUserActionPermission = (user: AppUser, permissionType: 'canEdit' | 'canDelete') => {
    // If user is admin and we are trying to revoke delete permission, check if other active admins exist
    if (user.role === 'admin' && user.permissions?.canDelete && permissionType === 'canDelete') {
      const otherAdminsWithDelete = users.filter(
        (u) => u.role === 'admin' && u.durum === 'Aktif' && u.permissions?.canDelete && u.id !== user.id
      );
      if (otherAdminsWithDelete.length === 0) {
        showToast('Sistemdeki son silme yetkisine sahip yöneticinin silme yetkisi kaldırılamaz!', 'error');
        return;
      }
    }

    const currentVal = permissionType === 'canEdit' ? user.permissions?.canEdit !== false : !!user.permissions?.canDelete;
    const newVal = !currentVal;

    const updatedPermissions: UserPermissions = {
      ...user.permissions,
      [permissionType]: newVal,
    };

    const updatedUser: AppUser = {
      ...user,
      permissions: updatedPermissions,
    };

    onUpdateUser(updatedUser);
    const actionLabel = permissionType === 'canDelete' ? 'Silme Yetkisi' : 'Düzenleme Yetkisi';
    showToast(
      `"${user.fullName}" kullanıcısının ${actionLabel} ${newVal ? 'AÇILDI (Yetki Verildi)' : 'KAPATILDI (Yetki Alındı)'}.`,
      newVal ? 'success' : 'info'
    );
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('123456');
    setFormFullName('');
    setFormUnvan('Saha Sorumlusu');
    setFormTelefon('');
    setFormRole('saha_sorumlusu');
    setFormDurum('Aktif');
    setFormPermissions({ ...ROLE_PRESET_PERMISSIONS.saha_sorumlusu });
    setFormSiteRestrictionMode('all');
    setFormAssignedSites([]);
    setFormTaseronRestrictionMode('all');
    setFormAssignedTaserons([]);
    setShowPassword(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(user.password);
    setFormFullName(user.fullName);
    setFormUnvan(user.unvan || '');
    setFormTelefon(user.telefon || '');
    setFormRole(user.role);
    setFormDurum(user.durum || 'Aktif');
    const defaults = ROLE_PRESET_PERMISSIONS[user.role] || ROLE_PRESET_PERMISSIONS.custom;
    setFormPermissions({
      ...defaults,
      ...(user.permissions || {}),
      canEdit: user.permissions?.canEdit !== false,
      canDelete: !!user.permissions?.canDelete,
    });
    const hasCustomSites = Array.isArray(user.assignedSantiyeIds) && user.assignedSantiyeIds.length > 0;
    setFormSiteRestrictionMode(hasCustomSites ? 'custom' : 'all');
    setFormAssignedSites(user.assignedSantiyeIds ? [...user.assignedSantiyeIds] : []);

    const hasCustomTaserons = Array.isArray(user.assignedTaseronIds) && user.assignedTaseronIds.length > 0;
    setFormTaseronRestrictionMode(hasCustomTaserons ? 'custom' : 'all');
    setFormAssignedTaserons(user.assignedTaseronIds ? [...user.assignedTaseronIds] : []);

    setShowPassword(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleRolePresetSelect = (presetRole: UserRole) => {
    setFormRole(presetRole);
    if (presetRole !== 'custom') {
      setFormPermissions({ ...ROLE_PRESET_PERMISSIONS[presetRole] });
      if (presetRole === 'taseron_yetkilisi') {
        setFormTaseronRestrictionMode('custom');
      }
      const defaultTitles: Record<UserRole, string> = {
        admin: 'Genel Yönetici / Müdür',
        saha_sorumlusu: 'Saha Sorumlusu',
        puantor: 'Saha Puantörü',
        taseron_yetkilisi: 'Taşeron Yetkilisi',
        muhasebe: 'Ön Muhasebe / Finans',
        custom: 'Özel Yetkili Kullanıcı',
      };
      if (
        !formUnvan.trim() ||
        ['Saha Sorumlusu', 'Genel Yönetici / Müdür', 'Saha Puantörü', 'Taşeron Yetkilisi', 'Ön Muhasebe / Finans', 'Özel Yetkili Kullanıcı'].includes(
          formUnvan.trim()
        )
      ) {
        setFormUnvan(defaultTitles[presetRole]);
      }
    }
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setFormPermissions((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      // Switch to custom role when granular permissions are toggled
      setFormRole('custom');
      return updated;
    });
  };

  const handleToggleSite = (santiyeId: string) => {
    setFormAssignedSites((prev) => {
      if (prev.includes(santiyeId)) {
        return prev.filter((id) => id !== santiyeId);
      } else {
        return [...prev, santiyeId];
      }
    });
  };

  const handleSelectAllSites = () => {
    setFormAssignedSites(santiyeler.map((s) => s.id));
  };

  const handleClearAllSites = () => {
    setFormAssignedSites([]);
  };

  const handleToggleTaseron = (taseronId: string) => {
    setFormAssignedTaserons((prev) => {
      if (prev.includes(taseronId)) {
        return prev.filter((id) => id !== taseronId);
      } else {
        return [...prev, taseronId];
      }
    });
  };

  const handleSelectAllTaserons = () => {
    setFormAssignedTaserons(taseronlar.map((t) => t.id));
  };

  const handleClearAllTaserons = () => {
    setFormAssignedTaserons([]);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanPassword = formPassword.trim();
    const cleanFullName = formFullName.trim();

    if (!cleanUsername) {
      setFormError('Lütfen geçerli bir kullanıcı adı belirleyiniz.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 3) {
      setFormError('Şifre en az 3 karakterden oluşmalıdır.');
      return;
    }

    if (!cleanFullName) {
      setFormError('Lütfen kullanıcının Ad ve Soyadını giriniz.');
      return;
    }

    // Check duplicate username
    const duplicate = users.find(
      (u) => u.username.trim().toLowerCase() === cleanUsername && (!editingUser || u.id !== editingUser.id)
    );
    if (duplicate) {
      setFormError(`"${cleanUsername}" kullanıcı adı zaten kullanımda. Lütfen farklı bir kullanıcı adı seçiniz.`);
      return;
    }

    // Prevent deactivating the last admin
    if (editingUser && editingUser.role === 'admin' && formDurum === 'Pasif') {
      const otherActiveAdmins = users.filter((u) => u.role === 'admin' && u.durum === 'Aktif' && u.id !== editingUser.id);
      if (otherActiveAdmins.length === 0) {
        setFormError('Sistemdeki son aktif yöneticiyi pasife alamazsınız.');
        return;
      }
    }

    // Validate custom site restriction selection
    if (formSiteRestrictionMode === 'custom' && formAssignedSites.length === 0) {
      setFormError('Lütfen kullanıcının yetkili olacağı en az bir şantiye seçiniz veya "Tüm Şantiyeler (Kısıtlama Yok)" seçeneğini işaretleyiniz.');
      return;
    }

    // Validate custom taseron restriction selection
    if (formTaseronRestrictionMode === 'custom' && formAssignedTaserons.length === 0) {
      setFormError('Lütfen kullanıcının yetkili olacağı en az bir taşeron seçiniz veya "Tüm Taşeronlar (Kısıtlama Yok)" seçeneğini işaretleyiniz.');
      return;
    }

    const assignedIds = formSiteRestrictionMode === 'custom' ? [...formAssignedSites] : [];
    const assignedTaserons = formTaseronRestrictionMode === 'custom' ? [...formAssignedTaserons] : [];

    if (editingUser) {
      const updated: AppUser = {
        ...editingUser,
        username: cleanUsername,
        password: cleanPassword,
        fullName: cleanFullName,
        unvan: formUnvan.trim() || undefined,
        telefon: formTelefon.trim() || undefined,
        role: formRole,
        durum: formDurum,
        permissions: {
          ...formPermissions,
          canEdit: formPermissions.canEdit !== false,
          canDelete: !!formPermissions.canDelete,
        },
        assignedSantiyeIds: [...assignedIds],
        assignedTaseronIds: [...assignedTaserons],
      };
      onUpdateUser(updated);
      showToast(`"${updated.fullName}" (@${updated.username}) kullanıcısının bilgileri ve yetkileri başarıyla güncellendi.`);
    } else {
      const newUser: AppUser = {
        id: `user-${Date.now()}`,
        username: cleanUsername,
        password: cleanPassword,
        fullName: cleanFullName,
        unvan: formUnvan.trim() || undefined,
        telefon: formTelefon.trim() || undefined,
        role: formRole,
        durum: formDurum,
        permissions: {
          ...formPermissions,
          canEdit: formPermissions.canEdit !== false,
          canDelete: !!formPermissions.canDelete,
        },
        assignedSantiyeIds: [...assignedIds],
        assignedTaseronIds: [...assignedTaserons],
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onAddUser(newUser);
      showToast(`Yeni kullanıcı "${newUser.fullName}" (@${newUser.username}) başarıyla oluşturuldu.`);
    }

    setIsModalOpen(false);
  };

  const handleToggleUserStatus = (user: AppUser) => {
    if (user.role === 'admin' && user.durum === 'Aktif') {
      const activeAdmins = users.filter((u) => u.role === 'admin' && u.durum === 'Aktif');
      if (activeAdmins.length <= 1) {
        showToast('Sistemdeki son aktif yöneticiyi pasife alamazsınız!', 'error');
        return;
      }
    }

    const newStatus = user.durum === 'Aktif' ? 'Pasif' : 'Aktif';
    const updated: AppUser = { ...user, durum: newStatus };
    onUpdateUser(updated);
    showToast(`"${user.fullName}" kullanıcısı ${newStatus === 'Aktif' ? 'Aktifleştirildi' : 'Pasife Alındı'}.`);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmUser) return;

    if (deleteConfirmUser.role === 'admin') {
      const otherActiveAdmins = users.filter((u) => u.role === 'admin' && u.durum === 'Aktif' && u.id !== deleteConfirmUser.id);
      if (otherActiveAdmins.length === 0) {
        showToast('Sistemdeki son yönetici silinemez!', 'error');
        setDeleteConfirmUser(null);
        return;
      }
    }

    if (deleteConfirmUser.id === currentUser.id) {
      showToast('Şu an oturum açmış olduğunuz kendi hesabınızı silemezsiniz!', 'error');
      setDeleteConfirmUser(null);
      return;
    }

    onDeleteUser(deleteConfirmUser.id);
    showToast(`"${deleteConfirmUser.fullName}" kullanıcısı sistemden silindi.`);
    setDeleteConfirmUser(null);
  };

  const handleSavePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser) return;
    if (!newPasswordVal.trim() || newPasswordVal.trim().length < 3) {
      showToast('Yeni şifre en az 3 karakter olmalıdır.', 'error');
      return;
    }

    const updated: AppUser = { ...passwordResetUser, password: newPasswordVal.trim() };
    onUpdateUser(updated);
    showToast(`"${passwordResetUser.fullName}" kullanıcısının şifresi başarıyla değiştirildi.`);
    setPasswordResetUser(null);
    setNewPasswordVal('');
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            👑 Yönetici (Tam Yetkili)
          </span>
        );
      case 'saha_sorumlusu':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            👷 Saha Sorumlusu (Puantaj & Masraf)
          </span>
        );
      case 'puantor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            📋 Puantör (Sadece Puantaj)
          </span>
        );
      case 'taseron_yetkilisi':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            🤝 Taşeron Yetkilisi (Taşeron Puantajı)
          </span>
        );
      case 'muhasebe':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            💼 Ön Muhasebe / Finans
          </span>
        );
      case 'custom':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            ⚙️ Özel Yetkilendirilmiş
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <ShieldCheck className="w-64 h-64 text-amber-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Güvenlik & Rol Tabanlı Yetkilendirme</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Kullanıcı ve İzin Yönetim Sistemi
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Saha sorumluları, şantiye şefleri ve muhasebe personelleri için kullanıcı adı ve şifre tanımlayın.
              Kullanıcılara <strong>yalnızca Personel Puantajı</strong> ve <strong>Şantiye Masraf Girişi</strong> izni vererek,
              hassas finansal ve hakediş tablolarını gizleyebilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              <span>Yeni Kullanıcı Ekle</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Toplam Kullanıcı</div>
            <div className="text-lg font-black text-slate-900 mt-0.5">{totalUsersCount} Kişi <span className="text-[10px] text-emerald-600 font-bold">({activeUsersCount} Aktif)</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Yönetici (Admin)</div>
            <div className="text-lg font-black text-purple-700 mt-0.5">{adminCount} Yönetici</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-blue-100 bg-blue-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-blue-800 font-semibold">Düzenleme Yetkisi</div>
            <div className="text-lg font-black text-blue-900 mt-0.5">{canEditCount} Kullanıcı</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-rose-100 bg-rose-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-rose-800 font-semibold">Silme Yetkisi</div>
            <div className="text-lg font-black text-rose-900 mt-0.5">{canDeleteCount} Kullanıcı</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Saha & Diğer Roller</div>
            <div className="text-lg font-black text-amber-800 mt-0.5">{fieldStaffCount} Kişi</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ad soyad, kullanıcı adı (@username) veya unvana göre ara..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrele:</span>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">Tüm Roller</option>
            <option value="admin">Yönetici (Admin)</option>
            <option value="saha_sorumlusu">Saha Sorumlusu</option>
            <option value="puantor">Puantör</option>
            <option value="taseron_yetkilisi">Taşeron Yetkilisi</option>
            <option value="muhasebe">Ön Muhasebe</option>
            <option value="custom">Özel</option>
          </select>

          <select
            value={santiyeFilter}
            onChange={(e) => setSantiyeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-[150px] truncate"
            title="Şantiye İznine Göre Filtrele"
          >
            <option value="all">Şantiyeler: Tümü</option>
            <option value="unrestricted">Tüm Şantiyelere Açık</option>
            <option value="restricted">Şantiye Kısıtlamalı Olanlar</option>
            {santiyeler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.isim}
              </option>
            ))}
          </select>

          <select
            value={taseronFilter}
            onChange={(e) => setTaseronFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-[150px] truncate"
            title="Taşeron İznine Göre Filtrele"
          >
            <option value="all">Taşeronlar: Tümü</option>
            <option value="unrestricted">Tüm Taşeronlara Açık</option>
            <option value="restricted">Taşeron Kısıtlamalı Olanlar</option>
            {taseronlar.map((t) => (
              <option key={t.id} value={t.id}>
                {t.isim || (t as any).unvan || 'İsimsiz Taşeron'}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="Aktif">Yalnızca Aktifler</option>
            <option value="Pasif">Yalnızca Pasifler</option>
          </select>

          <select
            value={actionPermissionFilter}
            onChange={(e) => setActionPermissionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Silme ve Düzenleme İznine Göre Filtrele"
          >
            <option value="all">Silme/Düzenleme: Tümü</option>
            <option value="canDelete_true">🗑️ Silme İzni Açık</option>
            <option value="canDelete_false">🛡️ Silme İzni Kapalı</option>
            <option value="canEdit_true">✏️ Düzenleme İzni Açık</option>
            <option value="canEdit_false">🔒 Düzenleme Kapalı (Salt Okunur)</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>Sistem Kullanıcıları Listesi</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
              {filteredUsers.length} Kayıt
            </span>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Yetkileri düzenlemek veya şifre sıfırlamak için işlem butonlarını kullanabilirsiniz.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Kullanıcı Bilgileri</th>
                <th className="py-3 px-3">Giriş Adı</th>
                <th className="py-3 px-3">Rol & Yetki Şablonu</th>
                <th className="py-3 px-3">İşlem Yetkileri (Hızlı Değiştir)</th>
                <th className="py-3 px-3">İzinli Şantiyeler</th>
                <th className="py-3 px-3">İzinli Taşeronlar</th>
                <th className="py-3 px-3">Erişebildiği Modüller</th>
                <th className="py-3 px-3 text-center">Durum</th>
                <th className="py-3 px-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>Arama kriterlerine uygun kullanıcı bulunamadı.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const hasRestrictedSites = Array.isArray(u.assignedSantiyeIds) && u.assignedSantiyeIds.length > 0;
                  const assignedSiteNames = hasRestrictedSites
                    ? santiyeler
                        .filter((s) => u.assignedSantiyeIds?.includes(s.id))
                        .map((s) => s.isim)
                    : [];

                  const hasRestrictedTaserons = Array.isArray(u.assignedTaseronIds) && u.assignedTaseronIds.length > 0;
                  const assignedTaseronNames = hasRestrictedTaserons
                    ? taseronlar
                        .filter((t) => u.assignedTaseronIds?.includes(t.id))
                        .map((t) => t.isim || (t as any).unvan || 'İsimsiz Taşeron')
                    : [];

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${!u.durum || u.durum === 'Pasif' ? 'opacity-60 bg-slate-50/40' : ''}`}>
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : u.role === 'saha_sorumlusu'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  Siz
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {u.unvan || 'Kullanıcı'}
                              {u.telefon ? ` • ${u.telefon}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block text-xs border border-slate-200">
                          @{u.username}
                        </div>
                        {u.sonGirisTarihi && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Son giriş: {u.sonGirisTarihi}
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Action Permissions: Düzenleme & Silme */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1.5 min-w-[135px]">
                          {/* Düzenleme İzni */}
                          <button
                            type="button"
                            onClick={() => handleToggleUserActionPermission(u, 'canEdit')}
                            title="Düzenleme İznini Aç/Kapat (Tıklayarak değiştirebilirsiniz)"
                            className={`inline-flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                              u.permissions?.canEdit !== false
                                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              <Edit3 className="w-3 h-3 text-blue-600" />
                              <span>Düzenleme</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              u.permissions?.canEdit !== false ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {u.permissions?.canEdit !== false ? 'Açık' : 'Kapalı'}
                            </span>
                          </button>

                          {/* Silme İzni */}
                          <button
                            type="button"
                            onClick={() => handleToggleUserActionPermission(u, 'canDelete')}
                            title="Silme İznini Aç/Kapat (Tıklayarak değiştirebilirsiniz)"
                            className={`inline-flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                              u.permissions?.canDelete
                                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 hover:border-rose-400'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              <Trash2 className={`w-3 h-3 ${u.permissions?.canDelete ? 'text-rose-600' : 'text-emerald-600'}`} />
                              <span>Silme</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              u.permissions?.canDelete ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200/80 text-emerald-900'
                            }`}>
                              {u.permissions?.canDelete ? 'Açık' : 'Kapalı'}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Site restriction */}
                      <td className="py-3.5 px-3">
                        {!hasRestrictedSites ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Tüm Şantiyeler
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              {assignedSiteNames.length} Şantiye ile Sınırlı
                            </span>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={assignedSiteNames.join(', ')}>
                              {assignedSiteNames.join(', ')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Subcontractor restriction */}
                      <td className="py-3.5 px-3">
                        {!hasRestrictedTaserons ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            <Check className="w-3 h-3 text-slate-500" />
                            Tüm Taşeronlar
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              <Layers className="w-3 h-3 text-indigo-600" />
                              {assignedTaseronNames.length} Taşeron ile Sınırlı
                            </span>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={assignedTaseronNames.join(', ')}>
                              {assignedTaseronNames.join(', ')}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Modules Allowed Pills */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.permissions.canManageAttendance && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5">
                              <CalendarCheck className="w-3 h-3 text-blue-600" />
                              Puantaj & Mesai
                            </span>
                          )}
                          {u.permissions.canManageSites && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-0.5">
                              <HardHat className="w-3 h-3 text-amber-600" />
                              Şantiye Masrafı
                            </span>
                          )}
                          {u.permissions.canManagePayroll && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                              <Receipt className="w-3 h-3 text-emerald-600" />
                              Hakediş / Maaş
                            </span>
                          )}
                          {u.permissions.canManagePersonnel && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Personel Kartları
                            </span>
                          )}
                          {u.permissions.canViewReports && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Raporlar
                            </span>
                          )}
                          {u.permissions.canManageUsers && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Yetki Yönetimi
                            </span>
                          )}
                          {/* If only attendance & sites: explicitly highlight that user prompt */}
                          {u.permissions.canManageAttendance &&
                            u.permissions.canManageSites &&
                            !u.permissions.canManagePayroll &&
                            !u.permissions.canViewReports && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-900 border border-amber-400">
                                ⭐ Özel Saha Yetkisi
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          title="Durumu değiştirmek için tıklayınız"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            u.durum === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.durum === 'Aktif' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          <span>{u.durum}</span>
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {onSwitchUser && !isCurrent && u.durum === 'Aktif' && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(u)}
                              title={`"${u.fullName}" kullanıcısı olarak oturum aç ve yetkilerini hemen test et`}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-emerald-200"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordResetUser(u);
                              setNewPasswordVal('');
                            }}
                            title="Şifreyi Değiştir"
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-amber-200"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            title="Yetki ve Bilgileri Düzenle"
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmUser(u)}
                              title="Kullanıcıyı Sil"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingUser ? 'Kullanıcı ve İzinleri Düzenle' : 'Yeni Kullanıcı ve İzin Tanımla'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kullanıcı giriş bilgilerini ve erişebileceği modülleri seçiniz.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              {/* 1. Basic User Info */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>1. Temel Hesap Bilgileri</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="örn: Ayhan Demir"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Kullanıcı Adı (Giriş için) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono text-xs">
                        @
                      </span>
                      <input
                        type="text"
                        required
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="ayhan.demir"
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Giriş Şifresi *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="En az 3 karakter"
                        className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Unvan / Görev
                    </label>
                    <input
                      type="text"
                      value={formUnvan}
                      onChange={(e) => setFormUnvan(e.target.value)}
                      placeholder="örn: Saha Şefi, Puantör, Mühendis"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Telefon Numarası
                    </label>
                    <input
                      type="text"
                      value={formTelefon}
                      onChange={(e) => setFormTelefon(e.target.value)}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Hesap Durumu
                    </label>
                    <select
                      value={formDurum}
                      onChange={(e) => setFormDurum(e.target.value as 'Aktif' | 'Pasif')}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="Aktif">🟢 Aktif (Sisteme Giriş Yapabilir)</option>
                      <option value="Pasif">🔴 Pasif (Girişi Engellendi)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Role Templates / Hazır Şablonlar */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>2. Hızlı Rol & İzin Şablonu</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Aşağıdaki hazır rollerden birini seçerek izinleri tek tıkla yapılandırabilirsiniz.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* Option A: Admin */}
                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('admin')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'admin'
                        ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-purple-900 flex items-center justify-between">
                      <span>👑 Tam Yetkili Yönetici</span>
                      {formRole === 'admin' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Tüm modüllere, bordrolara ve ayarlara sınırsız erişim.
                    </p>
                  </button>

                  {/* Option B: Saha Sorumlusu */}
                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('saha_sorumlusu')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'saha_sorumlusu'
                        ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-blue-900 flex items-center justify-between">
                      <span>👷 Saha Sorumlusu</span>
                      {formRole === 'saha_sorumlusu' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="text-[10px] text-blue-800 font-semibold mt-1">
                      ⭐ Sadece Puantaj & Şantiye Masrafı! Diğerleri kapalı.
                    </p>
                  </button>

                  {/* Option C: Puantör */}
                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('puantor')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'puantor'
                        ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-900 flex items-center justify-between">
                      <span>📋 Saha Puantörü</span>
                      {formRole === 'puantor' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Yalnızca personel günlük puantaj ve mesai girişi.
                    </p>
                  </button>

                  {/* Option D: Taşeron Yetkilisi */}
                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('taseron_yetkilisi')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'taseron_yetkilisi'
                        ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-indigo-900 flex items-center justify-between">
                      <span>🤝 Taşeron Yetkilisi</span>
                      {formRole === 'taseron_yetkilisi' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-[10px] text-indigo-800 font-semibold mt-1">
                      ⭐ Sadece yetkili olduğu taşeronun personelleri ve puantajı.
                    </p>
                  </button>

                  {/* Option E: Muhasebe / Finans */}
                  <button
                    type="button"
                    onClick={() => handleRolePresetSelect('muhasebe')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'muhasebe'
                        ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-emerald-900 flex items-center justify-between">
                      <span>💼 Ön Muhasebe & Finans</span>
                      {formRole === 'muhasebe' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[10px] text-emerald-800 font-semibold mt-1">
                      Maaş, cari, çek, kasa ve finansal raporlar açık.
                    </p>
                  </button>

                  {/* Option F: Özel / Kişiselleştirilmiş */}
                  <button
                    type="button"
                    onClick={() => setFormRole('custom')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formRole === 'custom'
                        ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>⚙️ Özel Yetki (Modüler)</span>
                      {formRole === 'custom' && <Check className="w-3.5 h-3.5 text-slate-700" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      İzinleri aşağıdaki tablodan tek tek belirleyin.
                    </p>
                  </button>
                </div>
              </div>

              {/* 3. Critical Action Permissions: Silme & Düzenleme İzni */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>3. Kritik Eylem İzinleri (Silme & Düzenleme)</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Kullanıcının kayıtları değiştirme ve silme haklarını buradan belirleyebilirsiniz.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Düzenleme İzni Kartı */}
                  <div
                    onClick={() => handleTogglePermission('canEdit')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      formPermissions.canEdit !== false
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-400/20'
                        : 'bg-slate-50 border-slate-200 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            formPermissions.canEdit !== false ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            <Edit3 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-slate-900 font-bold">Veri Düzenleme İzni</span>
                            <span className="text-[10px] text-slate-500 font-normal">Kayıt güncelleme & değiştirme</span>
                          </div>
                        </div>

                        {/* Switch UI */}
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          formPermissions.canEdit !== false ? 'bg-blue-600' : 'bg-slate-300'
                        }`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            formPermissions.canEdit !== false ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                        Kullanıcının yetkili olduğu modüllerdeki personelleri, puantajları, şantiye masraflarını, firmaları ve kayıtları düzenlemesine/güncellemesine izin verir.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Yetki Durumu:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        formPermissions.canEdit !== false
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {formPermissions.canEdit !== false ? '✓ Düzenleme Yetkisi Açık' : '✕ Düzenleme Kapalı (Salt Okunur)'}
                      </span>
                    </div>
                  </div>

                  {/* Silme İzni Kartı */}
                  <div
                    onClick={() => handleTogglePermission('canDelete')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      formPermissions.canDelete
                        ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20'
                        : 'bg-emerald-50/40 border-emerald-200/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            formPermissions.canDelete ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            <Trash2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-slate-900 font-bold">Veri / Kayıt Silme İzni</span>
                            <span className="text-[10px] text-rose-700 font-semibold">⚠️ Kritik Yetki</span>
                          </div>
                        </div>

                        {/* Switch UI */}
                        <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          formPermissions.canDelete ? 'bg-rose-600' : 'bg-slate-300'
                        }`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            formPermissions.canDelete ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                        Kullanıcının sistemdeki personelleri, gider fişlerini, ödemeleri, mesaileri veya carileri kalıcı olarak silmesine olanak tanır.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Yetki Durumu:</span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        formPermissions.canDelete
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {formPermissions.canDelete ? '⚠️ Silme Yetkisi Açık (Silebilir)' : '🛡️ Silme Kapalı (Korumalı - Silemez)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets for Action Permissions */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="text-slate-500 font-medium">Hızlı Eylem Ayarı:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormPermissions((prev) => ({ ...prev, canEdit: true, canDelete: true }));
                      setFormRole('custom');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                  >
                    Tümünü Aç (Düzenleme + Silme)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormPermissions((prev) => ({ ...prev, canEdit: true, canDelete: false }));
                      setFormRole('custom');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold transition-colors cursor-pointer"
                  >
                    Sadece Düzenleme Aç (Silme Kapalı - Önerilen Saha Ayarı)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormPermissions((prev) => ({ ...prev, canEdit: false, canDelete: false }));
                      setFormRole('custom');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold transition-colors cursor-pointer"
                  >
                    Salt Okunur (Düzenleme & Silme Kapalı)
                  </button>
                </div>
              </div>

              {/* 4. Granular Module Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>4. Ayrıntılı Modül Erişim İzinleri</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Kullanıcının görmesini istemediğiniz bölümlerin işaretini kaldırınız.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Puantaj & Mesai (User requested permission) */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageAttendance ? 'bg-blue-50/60 border-blue-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageAttendance}
                      onChange={() => handleTogglePermission('canManageAttendance')}
                      className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Personel Puantaj & Mesai Girişi</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Saha personelinin günlük puantajını (tam gün, yarım gün, izin) ve mesai saatlerini girer.
                      </p>
                    </div>
                  </label>

                  {/* Şantiye Masraf Girişi (User requested permission) */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageSites ? 'bg-amber-50/60 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageSites}
                      onChange={() => handleTogglePermission('canManageSites')}
                      className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <HardHat className="w-3.5 h-3.5 text-amber-600" />
                        <span>Şantiye Masraf & Gider Girişi</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Şantiyeye ait harcamaları, fiş/fatura giderlerini ve saha masraflarını sisteme kaydeder.
                      </p>
                    </div>
                  </label>

                  {/* Personel Listesi */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManagePersonnel ? 'bg-purple-50/60 border-purple-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManagePersonnel}
                      onChange={() => handleTogglePermission('canManagePersonnel')}
                      className="w-4 h-4 mt-0.5 text-purple-600 rounded border-slate-300 focus:ring-purple-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>Personel Kartları & Listesi</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Personel listesini görüntüleme, yeni işçi ekleme ve TC/IBAN düzenleme yetkisi.
                      </p>
                    </div>
                  </label>

                  {/* Personel Maaş / Hakediş (Sensible Financial) */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManagePayroll ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManagePayroll}
                      onChange={() => handleTogglePermission('canManagePayroll')}
                      className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hakediş, Maaş & Ödeme Yetkisi</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Maaş bordrolarını, avansları ve banka ödemelerini görme/düzenleme (Hassas Finans).
                      </p>
                    </div>
                  </label>

                  {/* Dashboard & Finansal Özet */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canViewDashboard ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canViewDashboard}
                      onChange={() => handleTogglePermission('canViewDashboard')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Dashboard & Genel Şirket Özeti
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Şirketin genel mali durumunu, toplam gider ve kasa özetini ana ekranda görür.
                      </p>
                    </div>
                  </label>

                  {/* Kredi Kartları */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageCreditCards ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageCreditCards}
                      onChange={() => handleTogglePermission('canManageCreditCards')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-700" />
                        <span>Şirket Kredi Kartları & Ekstreler</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Banka kart limitleri ve harcama ekstrelerine erişim izni.
                      </p>
                    </div>
                  </label>

                  {/* Taşeronlar */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageSubcontractors ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageSubcontractors}
                      onChange={() => handleTogglePermission('canManageSubcontractors')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-700" />
                        <span>Taşeron Yönetimi & Hakedişleri</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Taşeron sözleşmeleri, metraj hakedişleri ve taşeron bakiye dengesi.
                      </p>
                    </div>
                  </label>

                  {/* Firmalar & Cari */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageCompanies ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageCompanies}
                      onChange={() => handleTogglePermission('canManageCompanies')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-700" />
                        <span>Firmalar, Tedarikçiler & Cari Hesaplar</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Firma borç/alacak takibi, faturalar ve cari hareketler.
                      </p>
                    </div>
                  </label>

                  {/* Çek Takibi */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageChecks ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageChecks}
                      onChange={() => handleTogglePermission('canManageChecks')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <BookOpenCheck className="w-3.5 h-3.5 text-slate-700" />
                        <span>Çek / Senet Takibi & Cirolama</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Portföydeki alınan ve verilen çeklerin vade ve durum yönetimi.
                      </p>
                    </div>
                  </label>

                  {/* Raporlar Merkezi */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canViewReports ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canViewReports}
                      onChange={() => handleTogglePermission('canViewReports')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-slate-700" />
                        <span>Raporlar Merkezi & Kârlılık</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Şantiye kârlılık, nakit akışı ve yönetici finansal analizleri.
                      </p>
                    </div>
                  </label>

                  {/* Kullanıcı Yönetimi */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageUsers ? 'bg-rose-50/60 border-rose-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageUsers}
                      onChange={() => handleTogglePermission('canManageUsers')}
                      className="w-4 h-4 mt-0.5 text-rose-600 rounded border-slate-300 focus:ring-rose-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                        <span>Kullanıcı & İzin Yönetimi</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Yeni kullanıcı açma, yetki verme ve şifre değiştirme (Yalnızca Yöneticilere açılmalı).
                      </p>
                    </div>
                  </label>

                  {/* Ayarlar & Yedekleme */}
                  <label className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    formPermissions.canManageSettings ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageSettings}
                      onChange={() => handleTogglePermission('canManageSettings')}
                      className="w-4 h-4 mt-0.5 text-slate-800 rounded border-slate-300 focus:ring-slate-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-slate-700" />
                        <span>Sistem Yedekleme & Sıfırlama</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        Veritabanı JSON yedeği alma, içe aktarma ve döviz kurları ayarları.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 5. Construction Site Restriction / Şantiye Kısıtı */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>5. Şantiye Yetkilendirme Kapsamı</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Kullanıcının yalnızca kendi şantiyelerini görmesini sağlar.
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="siteRestriction"
                        checked={formSiteRestrictionMode === 'all'}
                        onChange={() => setFormSiteRestrictionMode('all')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span>Tüm Şantiyeler (Kısıtlama Yok)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="siteRestriction"
                        checked={formSiteRestrictionMode === 'custom'}
                        onChange={() => setFormSiteRestrictionMode('custom')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span>Yalnızca Seçilen Şantiyeler</span>
                    </label>
                  </div>

                  {formSiteRestrictionMode === 'custom' && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">
                          Bu kullanıcının erişebileceği şantiyeler ({formAssignedSites.length} seçildi):
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllSites}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                          >
                            Tümünü Seç
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleClearAllSites}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>

                      {santiyeler.length === 0 ? (
                        <div className="text-xs text-slate-400 py-2 text-center">
                          Sistemde kayıtlı şantiye bulunmamaktadır.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {santiyeler.map((s) => {
                            const isChecked = formAssignedSites.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                                  isChecked ? 'bg-amber-50 border-amber-300 font-bold text-amber-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSite(s.id)}
                                  className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300"
                                />
                                <span className="truncate">{s.isim}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Subcontractor Restriction / Taşeron Kısıtı */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>6. Taşeron Yetkilendirme Kapsamı</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Taşeron yetkilisi veya kullanıcının sadece kendi taşeronlarına erişmesini sağlar.
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="taseronRestriction"
                        checked={formTaseronRestrictionMode === 'all'}
                        onChange={() => setFormTaseronRestrictionMode('all')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span>Tüm Taşeronlar (Kısıtlama Yok)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="taseronRestriction"
                        checked={formTaseronRestrictionMode === 'custom'}
                        onChange={() => setFormTaseronRestrictionMode('custom')}
                        className="text-amber-500 focus:ring-amber-400"
                      />
                      <span>Yalnızca Seçilen Taşeronlar</span>
                    </label>
                  </div>

                  {formTaseronRestrictionMode === 'custom' && (
                    <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-950">
                          Bu kullanıcının işlem yapabileceği taşeronlar ({formAssignedTaserons.length} seçildi):
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllTaserons}
                            className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer"
                          >
                            Tümünü Seç
                          </button>
                          <span className="text-indigo-200">|</span>
                          <button
                            type="button"
                            onClick={handleClearAllTaserons}
                            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                          >
                            Temizle
                          </button>
                        </div>
                      </div>

                      {taseronlar.length === 0 ? (
                        <div className="text-xs text-slate-400 py-2 text-center">
                          Sistemde kayıtlı taşeron bulunmamaktadır.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {taseronlar.map((t) => {
                            const isChecked = formAssignedTaserons.includes(t.id);
                            const taseronName = t.isim || (t as any).unvan || (t as any).firmaAdi || 'İsimsiz Taşeron';
                            return (
                              <label
                                key={t.id}
                                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-indigo-100/80 border-indigo-400 font-bold text-indigo-950'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleTaseron(t.id)}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-400 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold text-slate-900 text-xs">
                                    {taseronName}
                                  </div>
                                  {(t.uzmanlik || t.yetkili) && (
                                    <div className="text-[10px] text-slate-500 font-normal truncate flex items-center gap-1.5 mt-0.5">
                                      {t.uzmanlik && <span className="text-indigo-700 font-medium">{t.uzmanlik}</span>}
                                      {t.uzmanlik && t.yetkili && <span>•</span>}
                                      {t.yetkili && <span>Yetkili: {t.yetkili}</span>}
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all shadow-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{editingUser ? 'Değişiklikleri Kaydet' : 'Kullanıcıyı Oluştur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Password Reset Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Şifre Değiştir</h4>
                  <p className="text-[11px] text-slate-500">@{passwordResetUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetUser(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePasswordReset} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Yeni Şifre
                </label>
                <input
                  type="text"
                  required
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="En az 3 karakter giriniz"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                >
                  Şifreyi Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Kullanıcıyı Sil</h4>
                <p className="text-xs text-slate-500">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>"{deleteConfirmUser.fullName}" (@{deleteConfirmUser.username})</strong> kullanıcısını sistemden silmek istediğinize emin misiniz?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
              >
                Evet, Kullanıcıyı Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
