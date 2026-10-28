import React, { useState } from 'react';
import { 
  HardHat, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Building2, 
  CalendarCheck, 
  Receipt, 
  AlertCircle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { AppUser } from '../types';

interface LoginScreenProps {
  users: AppUser[];
  onLogin: (user: AppUser, rememberMe: boolean) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMessage('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Find matching user (case-insensitive username)
      const foundUser = users.find(
        (u) => u.username.trim().toLowerCase() === cleanUsername && u.password === cleanPassword
      );

      if (!foundUser) {
        setErrorMessage('Kullanıcı adı veya şifre hatalı! Lütfen bilgilerinizi kontrol ediniz.');
        setLoading(false);
        return;
      }

      if (foundUser.durum === 'Pasif') {
        setErrorMessage('Bu kullanıcı hesabı pasife alınmıştır. Lütfen sistem yöneticisi ile irtibata geçiniz.');
        setLoading(false);
        return;
      }

      // Success
      setLoading(false);
      onLogin(foundUser, rememberMe);
    }, 250);
  };

  const handleQuickLogin = (demoUsername: string, _demoPass?: string) => {
    setErrorMessage(null);
    const foundUser = users.find(
      (u) => u.username.trim().toLowerCase() === demoUsername.toLowerCase()
    );
    if (foundUser) {
      if (foundUser.durum === 'Pasif') {
        setErrorMessage('Bu kullanıcı hesabı pasife alınmıştır.');
        return;
      }
      setUsername(foundUser.username);
      setPassword(foundUser.password);
      onLogin(foundUser, rememberMe);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 shadow-xl shadow-amber-500/20 font-black">
            <HardHat className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Şantiye & Personel ERP
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
              Gelişmiş İzin ve Rol Tabanlı Güvenli Giriş Sistemi
            </p>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Kullanıcı Girişi</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tanımlı kullanıcı adı ve şifreniz ile sisteme erişim sağlayınız.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="örn: admin veya saha"
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Şifre
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi giriniz"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-400/30"
                />
                <span>Oturumumu hatırla</span>
              </label>
              <span className="text-[11px] text-amber-400/80 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Yetkili Erişim
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Kontrol ediliyor...</span>
                </div>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Fast Testing */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>Hızlı Test Hesapları</span>
              <span className="text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Tek Tıkla Giriş
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-0.5">
              {users.filter((u) => u.durum === 'Aktif').map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickLogin(u.username)}
                    className={`p-2.5 rounded-xl border text-left transition-all group cursor-pointer ${
                      isAdmin
                        ? 'bg-purple-950/20 hover:bg-purple-900/30 border-purple-800/40 hover:border-purple-400/60'
                        : 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1 truncate max-w-[170px]">
                        {isAdmin ? '👑' : '👤'} {u.fullName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-amber-300 font-mono shrink-0">
                        @{u.username}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {u.unvan ||
                        (u.role === 'admin'
                          ? 'Tam Yetkili Yönetici'
                          : u.role === 'muhasebe'
                          ? 'Ön Muhasebe / Finans'
                          : u.role === 'puantor'
                          ? 'Saha Puantörü'
                          : u.role === 'taseron_yetkilisi'
                          ? 'Taşeron Yetkilisi'
                          : u.role === 'saha_sorumlusu'
                          ? 'Saha Sorumlusu'
                          : 'Özel Yetkili')}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security Info Card */}
        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>İzin yönetimi ve rol bazlı erişim denetimi aktif</span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">v3.5 ERP</span>
        </div>
      </div>
    </div>
  );
};
