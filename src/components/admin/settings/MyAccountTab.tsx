import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  Mail,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { apiFetch } from '../../../lib/apiClient';

export const MyAccountTab: React.FC = () => {
  const { user, isLoading, logout } = useAuth();

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Submission & message states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute UTF-8 byte length of new password
  const newPasswordBytes = new TextEncoder().encode(newPassword).length;
  const isByteLimitExceeded = newPasswordBytes > 72;
  const isLengthCompliant = newPassword.length >= 12;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Format system role display
  const formatRole = (role?: string | null) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'ADMIN':
        return { label: 'Admin', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'ACCOUNTANT':
        return { label: 'Accountant', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'TEACHER':
        return { label: 'Teacher', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      default:
        return { label: role || 'Unknown', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const roleMeta = formatRole(user?.role);

  const handleSubmitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side validations
    if (!currentPassword) {
      setErrorMessage('Current password is required.');
      return;
    }

    if (!isLengthCompliant) {
      setErrorMessage('New password must be at least 12 characters long.');
      return;
    }

    if (isByteLimitExceeded) {
      setErrorMessage('New password exceeds the 72 UTF-8 byte limit.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from the current password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch<{ message?: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const msg = response?.message || 'Password changed successfully. Please sign in again with your new password.';
      setSuccessMessage(msg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Security invariant: immediately terminate local tokens and redirect to login
      setTimeout(() => {
        logout();
        window.location.hash = 'login';
      }, 1800);
    } catch (err: any) {
      const status = err.status;
      if (status === 401) {
        setErrorMessage(err.message || 'Current password is incorrect.');
      } else if (status === 400) {
        setErrorMessage(err.message || 'Password validation failed. Please check the requirements.');
      } else if (status === 403) {
        setErrorMessage('This account is inactive. Contact the system administrator.');
      } else if (status === 429) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(err.message || 'Unable to change password. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 flex items-center justify-center space-x-3 text-slate-500">
        <Loader2 className="w-5 h-5 text-[#185b9d] animate-spin" />
        <span className="text-xs font-semibold">Loading authoritative account credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Account Identity Section */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#185b9d]" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Account Identity</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative authenticated software identity and operational access level for this session.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Full Name */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Full Name
            </span>
            <div className="text-xs font-bold text-slate-800 truncate" title={user?.name || '—'}>
              {user?.name || '—'}
            </div>
          </div>

          {/* Official Email */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Official Email
            </span>
            <div className="text-xs font-semibold text-slate-800 truncate" title={user?.email || '—'}>
              {user?.email || '—'}
            </div>
          </div>

          {/* System Role */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              System Role
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${roleMeta.badgeClass}`}
              >
                <Shield className="w-3 h-3 mr-1 inline-block" />
                {roleMeta.label}
              </span>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Account Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
          <BadgeCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Identity records and system roles are managed authoritatively by system administration and are read-only.</span>
        </div>
      </section>

      {/* 2. Password & Security Section */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#185b9d]" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Password & Security</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Update your account password. Changing your password invalidates active sessions across all devices.
          </p>
        </div>

        {/* Guidance notice */}
        <div className="bg-blue-50/60 border border-blue-200/70 rounded-lg p-3.5 mb-5 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-[#185b9d] mt-0.5 shrink-0" />
          <div className="text-xs text-slate-700 space-y-0.5">
            <div className="font-semibold text-slate-900">Password Policy</div>
            <div className="text-slate-600">
              Use at least 12 characters. Passwords are limited to 72 UTF-8 bytes. Passphrases are fully supported.
            </div>
          </div>
        </div>

        {/* Success Feedback */}
        {successMessage && (
          <div
            role="status"
            className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmitPasswordChange} className="space-y-4 max-w-xl">
          {/* Current Password */}
          <div>
            <label
              htmlFor="current-password"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current account password"
                className="w-full px-3 py-2 pr-10 text-xs bg-slate-50/50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="new-password"
                className="block text-xs font-bold text-slate-700"
              >
                New Password <span className="text-red-500">*</span>
              </label>
              {newPassword.length > 0 && (
                <span
                  className={`text-[11px] font-mono font-medium ${
                    isByteLimitExceeded
                      ? 'text-red-600'
                      : !isLengthCompliant
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {newPassword.length} chars ({newPasswordBytes} bytes)
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 12 characters (max 72 UTF-8 bytes)"
                aria-invalid={newPassword.length > 0 && (!isLengthCompliant || isByteLimitExceeded)}
                aria-describedby="new-password-helper"
                className={`w-full px-3 py-2 pr-10 text-xs bg-slate-50/50 border rounded-lg text-slate-800 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:cursor-not-allowed ${
                  newPassword.length > 0 && (!isLengthCompliant || isByteLimitExceeded)
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-slate-300 focus:ring-[#185b9d] focus:border-[#185b9d]'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div id="new-password-helper" className="mt-1 text-[11px] text-slate-500">
              {newPassword.length > 0 && !isLengthCompliant && (
                <span className="text-amber-600 font-medium">Password must be at least 12 characters long.</span>
              )}
              {isByteLimitExceeded && (
                <span className="text-red-600 font-medium">Password exceeds the 72 UTF-8 byte boundary.</span>
              )}
              {newPassword.length === 0 && (
                <span>Minimum 12 characters. Passphrases without symbols or numbers are permitted.</span>
              )}
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                aria-invalid={confirmPassword.length > 0 && !isMatch}
                className={`w-full px-3 py-2 pr-10 text-xs bg-slate-50/50 border rounded-lg text-slate-800 focus:outline-none focus:ring-1 disabled:bg-slate-100 disabled:cursor-not-allowed ${
                  confirmPassword.length > 0 && !isMatch
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-slate-300 focus:ring-[#185b9d] focus:border-[#185b9d]'
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !isMatch && (
              <div className="mt-1 text-[11px] text-red-600 font-medium">Passwords do not match.</div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !currentPassword ||
                !isLengthCompliant ||
                isByteLimitExceeded ||
                !isMatch
              }
              className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497e] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Changing Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
