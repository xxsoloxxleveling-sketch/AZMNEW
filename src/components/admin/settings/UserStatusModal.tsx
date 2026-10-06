import React, { useState, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { UserX, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../lib/authContext';
import type { UserAccountRecord } from '../../../lib/mockApi';
import { useFocusTrap } from './useFocusTrap';

export interface UserStatusModalProps {
  user: UserAccountRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: UserAccountRecord) => void;
}

export const UserStatusModal: React.FC<UserStatusModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user: currentAuthUser } = useAuth();
  const isSelf = Boolean(user && currentAuthUser && user.id === currentAuthUser.id);

  const modalRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusTrap({
    isOpen: isOpen && Boolean(user),
    containerRef: modalRef,
    initialFocusRef: cancelBtnRef,
    onEscape: () => {
      if (!isSubmitting) {
        onClose();
      }
    },
  });

  if (!isOpen || !user) return null;

  const isDeactivating = user.status === 'ACTIVE';
  const targetStatus = isDeactivating ? 'INACTIVE' : 'ACTIVE';

  const handleConfirm = async () => {
    if (isSelf && isDeactivating) {
      setErrorMessage('You cannot deactivate your own account.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await api.users.update(user.id, {
        status: targetStatus,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update account lifecycle status.');
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
        aria-labelledby="status-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                isDeactivating
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              {isDeactivating ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h2 id="status-modal-title" className="text-sm font-bold text-slate-900">
                {isDeactivating ? 'Deactivate User Account' : 'Reactivate User Account'}
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
            aria-label="Close lifecycle modal"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5"
            >
              <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {isSelf && isDeactivating ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold">Self-Deactivation Prohibited:</span> You cannot deactivate your own active Super Administrator session.
              </div>
            </div>
          ) : isDeactivating ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to deactivate <span className="font-semibold text-slate-900">{user.name}</span>?
              </p>
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60 text-xs text-rose-900 leading-relaxed space-y-1.5">
                <p className="font-semibold">Security & Session Impact:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                  <li>Immediately revokes all active access and refresh sessions.</li>
                  <li>Prevents this user from signing in to AZM.AIO.</li>
                  <li>Historical audit trails and records remain preserved.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to reactivate <span className="font-semibold text-slate-900">{user.name}</span>?
              </p>
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-900 leading-relaxed space-y-1.5">
                <p className="font-semibold">Access Restoration:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-emerald-800">
                  <li>Permits the user to sign in using their existing credentials.</li>
                  <li>Previous session tokens remain invalidated.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || (isSelf && isDeactivating)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50 ${
                isDeactivating
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isDeactivating ? (
                <span>Deactivate Account</span>
              ) : (
                <span>Reactivate Account</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
