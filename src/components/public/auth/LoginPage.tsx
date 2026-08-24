import React, { useState } from 'react';
import {
  Lock,
  Mail,
  School,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { Role } from '../../../lib/mockApi';

interface LoginPageProps {
  onLoginSuccess: (redirectTab: 'dashboard' | 'scan') => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const { login } = useAuth();

  // Form states
  const [email, setEmail] = useState('superadmin@jadoon.edu.pk');
  const [password, setPassword] = useState('AdminPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Validation & Error states
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);

  // Field validation rules
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const emailError = React.useMemo(() => {
    if (!touched.email && !email) return null;
    if (!email.trim()) return 'Email address is required.';
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address.';
    return null;
  }, [email, touched.email]);

  const passwordError = React.useMemo(() => {
    if (!touched.password && !password) return null;
    if (!password.trim()) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }, [password, touched.password]);

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError(null);

    // Validate before calling
    if (!email.trim()) {
      setServerError('Please provide your official email address.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setServerError('Please enter a valid email address (e.g. name@jadoon.edu.pk).');
      return;
    }
    if (!password.trim()) {
      setServerError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login(email, password);

      // Role-based routing:
      // TEACHER role goes directly to mobile scanner (/scan)
      // SUPER_ADMIN / ADMIN / ACCOUNTANT go to /dashboard
      if (response.role === 'TEACHER') {
        onLoginSuccess('scan');
      } else {
        onLoginSuccess('dashboard');
      }
    } catch (err: any) {
      setServerError(
        err.message || 'Invalid email or password. Please verify your credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setTouched({ email: true, password: true });
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Subtle Background Accent Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#185b9d_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-blue-100/30 to-transparent pointer-events-none" />

      {/* Top Header / Back link */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-2 pb-4">
        <button
          onClick={onNavigateHome}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-200/50"
        >
          <span>← Back to Portal Home</span>
        </button>

        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#185b9d] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/80">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Staff Access</span>
        </span>
      </div>

      {/* Main Centered Login Card */}
      <div className="w-full max-w-md my-auto z-10">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/60 overflow-hidden relative">
          {/* Top Brand Accent Gradient Bar */}
          <div className="h-2 bg-gradient-to-r from-[#0f3863] via-[#185b9d] to-[#2563eb]" />

          <div className="p-6 sm:p-8 space-y-6">
            {/* Logo & Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#185b9d] to-[#2563eb] text-white shadow-lg shadow-blue-500/20 mb-1">
                <School className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  AZMAIO Portal
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Management & Examination Portal
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => handleBlur('email')}
                    placeholder="name@jadoon.edu.pk"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/60 border rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none transition ${
                      emailError
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-[#185b9d] focus:ring-2 focus:ring-[#185b9d]/20'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] font-semibold text-rose-600 pl-1">{emailError}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordModal(true)}
                    className="text-xs font-semibold text-[#185b9d] hover:text-[#124578] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (serverError) setServerError(null);
                    }}
                    onBlur={() => handleBlur('password')}
                    placeholder="••••••••••••"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/60 border rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none transition ${
                      passwordError
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:border-[#185b9d] focus:ring-2 focus:ring-[#185b9d]/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] font-semibold text-rose-600 pl-1">{passwordError}</p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#185b9d] focus:ring-[#185b9d]"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#185b9d] hover:bg-[#13497d] active:bg-[#0f3b64] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Log In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Inline Error Banner */}
            {serverError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-bold text-rose-900">Authentication Failed</p>
                  <p className="text-rose-700 mt-0.5">{serverError}</p>
                </div>
              </div>
            )}

            {/* Quick Demo Role Fill Section */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Quick Demo Accounts
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Click to populate</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill('superadmin@jadoon.edu.pk', 'AdminPassword123!')
                  }
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 text-slate-700 font-semibold text-left transition flex items-center gap-1.5 truncate"
                >
                  <span>👑</span>
                  <div className="min-w-0">
                    <span className="block truncate text-slate-800 font-bold">Super Admin</span>
                    <span className="text-[10px] text-slate-400 block truncate">/dashboard</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill('teacher@jadoon.edu.pk', 'TeacherPassword123!')
                  }
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-200 text-slate-700 font-semibold text-left transition flex items-center gap-1.5 truncate"
                >
                  <span>📱</span>
                  <div className="min-w-0">
                    <span className="block truncate text-slate-800 font-bold">Teacher</span>
                    <span className="text-[10px] text-slate-400 block truncate">/scan</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill('accountant@jadoon.edu.pk', 'Accountant123!')
                  }
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-200 text-slate-700 font-semibold text-left transition flex items-center gap-1.5 truncate"
                >
                  <span>💳</span>
                  <div className="min-w-0">
                    <span className="block truncate text-slate-800 font-bold">Accountant</span>
                    <span className="text-[10px] text-slate-400 block truncate">/dashboard</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@jadoon.edu.pk', 'Admin123!')}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 text-slate-700 font-semibold text-left transition flex items-center gap-1.5 truncate"
                >
                  <span>🛡️</span>
                  <div className="min-w-0">
                    <span className="block truncate text-slate-800 font-bold">Admin</span>
                    <span className="text-[10px] text-slate-400 block truncate">/dashboard</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security / No Public Sign-up Notice */}
        <div className="mt-4 text-center space-y-1 text-slate-400 text-xs">
          <p className="flex items-center justify-center gap-1.5 text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Protected system for authorized faculty & staff.</span>
          </p>
          <p className="text-[11px]">
            New accounts are provisioned exclusively by Super Admin via Settings.
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="w-full max-w-md text-center py-2 text-[11px] text-slate-400">
        Jadoon Public School & College Management System • 2026
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#185b9d] border border-blue-100 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Password Reset Request</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                For security protocols, password resets must be authorized by the Super Administrator.
                Please contact the IT Desk or Registrar Office.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">
              IT Support Helpline: <strong className="text-slate-900">0305-1755551</strong>
            </div>
            <button
              onClick={() => setForgotPasswordModal(false)}
              className="w-full py-2.5 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
