import React, { useState, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { ShieldAlert, UserPlus, Eye, EyeOff } from 'lucide-react';
import { api } from '../../../services/api';
import type { Role } from '../../../lib/mockApi';
import type { UserAccountRecord } from '../../../lib/mockApi';
import { useFocusTrap } from './useFocusTrap';

export interface UserProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAccountRecord) => void;
}

export const UserProvisionModal: React.FC<UserProvisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TEACHER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusTrap({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: nameInputRef,
    onEscape: () => {
      if (!isSubmitting) {
        handleClose();
      }
    },
  });

  if (!isOpen) return null;

  const handleClose = () => {
    // Clear password immediately on close
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMessage('Full Name is required.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid official email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Initial password is required.');
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
      const created = await api.users.create({
        name: trimmedName,
        email: trimmedEmail,
        role,
        password,
        status: 'ACTIVE',
      });

      // Erase plain-text password from component memory immediately
      setPassword('');
      setConfirmPassword('');

      onSuccess(created);
      handleClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to provision user account.';
      if (
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate') ||
        err?.status === 409
      ) {
        setErrorMessage('A user with this email already exists.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="provision-user-title"
        aria-describedby="provision-user-description"
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#185b9d]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="provision-user-title" className="text-sm font-bold text-slate-900">
                Provision User Account
              </h2>
              <p id="provision-user-description" className="text-xs text-slate-500">
                Grant authenticated system access with an assigned role and credentials.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
          >
            <IconAlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          {/* Full Name */}
          <div>
            <label htmlFor="user-provision-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="user-provision-name"
              ref={nameInputRef}
              type="text"
              required
              disabled={isSubmitting}
              placeholder="e.g. Tariq Mehmood"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d] transition disabled:opacity-50"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="user-provision-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Official Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              id="user-provision-email"
              type="email"
              required
              disabled={isSubmitting}
              placeholder="e.g. t.mehmood@azmaio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d] transition disabled:opacity-50"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="user-provision-role" className="block text-xs font-semibold text-slate-700 mb-1">
              System Role & Access Level <span className="text-rose-500">*</span>
            </label>
            <select
              id="user-provision-role"
              value={role}
              disabled={isSubmitting}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d] transition cursor-pointer disabled:opacity-50"
            >
              <option value="TEACHER">TEACHER — Verification & Test Operations</option>
              <option value="ACCOUNTANT">ACCOUNTANT — Financial Ledgers & Payroll</option>
              <option value="ADMIN">ADMIN — Management & Operational Directory</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN — Full System Root Authority</option>
            </select>
          </div>

          {/* Super Admin Caution Notice */}
          {role === 'SUPER_ADMIN' && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 leading-relaxed">
                <span className="font-bold">Caution:</span> Super Administrator accounts hold full system authority,
                including database management, staff records, financial ledgers, and user provisioning.
              </div>
            </div>
          )}

          {/* Initial Password */}
          <div>
            <label htmlFor="user-provision-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Password <span className="text-rose-500">*</span>
              <span className="font-normal text-slate-500 ml-1">(min 12 characters, max 72 bytes)</span>
            </label>
            <div className="relative">
              <input
                id="user-provision-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={12}
                disabled={isSubmitting}
                autoComplete="new-password"
                placeholder="Minimum 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d] transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="user-provision-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="user-provision-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={12}
                disabled={isSubmitting}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d] transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={14} className="animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <IconCheck size={14} />
                  <span>Provision User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
