import React, { useState, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { KeyRound, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../lib/authContext';
import type { UserAccountRecord } from '../../../lib/mockApi';
import { useFocusTrap } from './useFocusTrap';

export interface UserPasswordResetModalProps {
  user: UserAccountRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: UserAccountRecord) => void;
}

export const UserPasswordResetModal: React.FC<UserPasswordResetModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user: currentAuthUser } = useAuth();
  const isSelf = Boolean(user && currentAuthUser && user.id === currentAuthUser.id);

  const modalRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusTrap({
    isOpen: isOpen && Boolean(user),
    containerRef: modalRef,
    initialFocusRef: passwordInputRef,
    onEscape: () => {
      if (!isSubmitting) {
        handleClose();
      }
    },
  });

  if (!isOpen || !user) return null;

  const handleClose = () => {
    // Clear sensitive password values from memory immediately
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSelf) {
      setErrorMessage('Use My Account to change your own password.');
      return;
    }

    if (!password) {
      setErrorMessage('New password is required.');
      return;
    }

    if (password.length < 12) {
      setErrorMessage('Password must be at least 12 characters long.');
      return;
    }

    const utf8Bytes = new TextEncoder().encode(password).length;
    if (utf8Bytes > 72) {
      setErrorMessage('Password must not exceed 72 bytes.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await api.users.update(user.id, {
        password,
      });

      // Clear sensitive memory immediately upon success
      setPassword('');
      setConfirmPassword('');

      onSuccess(updated);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reset account password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onClick={() => {
        if (!isSubmitting) handleClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#185b9d]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 id="reset-password-modal-title" className="text-sm font-bold text-slate-900">
                Reset Account Password
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close password reset modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5"
            >
              <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {isSelf ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold">Self-Reset Advisory:</span> You cannot use administrative password reset on your own account. Use <span className="font-semibold">My Account</span> to change your password.
              </div>
            </div>
          ) : (
            <>
              {/* Account Summary Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="text-slate-500">Target User Account:</div>
                <div className="font-bold text-slate-900">{user.name}</div>
                <div className="font-mono text-[11px] text-slate-600">{user.email}</div>
              </div>

              {/* Security Invariant Notice */}
              <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/60 text-[11px] text-blue-900 leading-relaxed">
                <span className="font-semibold">Session Security:</span> Resetting the password immediately invalidates this account's existing sessions. The user must sign in with the new password.
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label
                  htmlFor="reset-password-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reset-password-input"
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 12 characters"
                    className="w-full pl-8 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Must be between 12 and 72 bytes.
                </p>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1">
                <label
                  htmlFor="reset-confirm-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    disabled={isSubmitting}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-8 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isSelf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <IconCheck size={13} />
                  <span>Reset Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
