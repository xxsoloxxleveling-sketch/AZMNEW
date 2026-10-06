import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { UserCheck, Shield, Mail, Lock } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../lib/authContext';
import type { Role, UserAccountRecord } from '../../../lib/mockApi';
import { useFocusTrap } from './useFocusTrap';

export interface UserEditModalProps {
  user: UserAccountRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: UserAccountRecord) => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user: currentAuthUser, logout, refreshCurrentUser } = useAuth();
  const isSelf = Boolean(user && currentAuthUser && user.id === currentAuthUser.id);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('TEACHER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name);
      setRole(user.role);
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  useFocusTrap({
    isOpen: isOpen && Boolean(user),
    containerRef: modalRef,
    initialFocusRef: nameInputRef,
    onEscape: () => {
      if (!isSubmitting) {
        onClose();
      }
    },
  });

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Full Name is required.');
      return;
    }

    const hasChanges = trimmedName !== user.name || role !== user.role;
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await api.users.update(user.id, {
        name: trimmedName,
        role,
      });

      if (isSelf) {
        if (role !== user.role) {
          // Self role change invalidates active session
          logout();
          try {
            sessionStorage.setItem(
              'auth_redirect_notice',
              'Your system role changed. Please sign in again.'
            );
          } catch {}
          window.location.hash = '#login';
          return;
        } else {
          // Name-only self edit updates current user in context without logout
          await refreshCurrentUser();
        }
      }

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update user account.';
      if (
        msg.toLowerCase().includes('last active super admin') ||
        msg.toLowerCase().includes('cannot change the role')
      ) {
        setErrorMessage(msg);
      } else if (
        msg === '409' ||
        msg.toLowerCase().includes('concurrency') ||
        (msg.toLowerCase().includes('conflict') && !msg.toLowerCase().includes('admin'))
      ) {
        setErrorMessage('Another transaction modified this account. Please refresh and try again.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#185b9d]">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="edit-user-modal-title" className="text-sm font-bold text-slate-900">
                Edit User Account
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close edit modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Form Body */}
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

          {/* Full Name */}
          <div className="space-y-1">
            <label htmlFor="edit-name" className="block text-xs font-semibold text-slate-700">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="edit-name"
              ref={nameInputRef}
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Ayesha Khan"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition"
            />
          </div>

          {/* Email Address (Immutable) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-email" className="block text-xs font-semibold text-slate-700">
                Official Email Address
              </label>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                Immutable
              </span>
            </div>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="edit-email"
                type="email"
                readOnly
                disabled
                value={user.email}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono cursor-not-allowed select-all"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Official email addresses cannot be altered once provisioned.
            </p>
          </div>

          {/* System Role */}
          <div className="space-y-1">
            <label htmlFor="edit-role" className="block text-xs font-semibold text-slate-700">
              System Role <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="edit-role"
                disabled={isSubmitting}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition cursor-pointer"
              >
                <option value="TEACHER">Teacher</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {/* Helper: Session invalidation notice */}
            <p className="text-[11px] text-slate-500">
              Changing the system role signs this account out of existing sessions.
            </p>

            {/* Advisory: Super Admin full access */}
            {role === 'SUPER_ADMIN' && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-100 border border-slate-300 text-[11px] text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">Super Admin Notice:</span> Super Admin accounts have full administrative access across all system modules.
              </div>
            )}

            {/* Advisory: Self edit notice */}
            {isSelf && role !== user.role && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed font-medium">
                Changing your own role will immediately sign you out. You will need to sign back in with your updated permissions.
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <IconCheck size={13} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
