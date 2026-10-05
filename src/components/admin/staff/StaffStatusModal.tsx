import React, { useState, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
} from '../../common/icons';
import { api } from '../../../services/api';
import type { StaffDetailRecord } from '../../../lib/mockApi';
import { useStaffFocusTrap } from './useStaffFocusTrap';

export interface StaffStatusModalProps {
  isOpen: boolean;
  staff: StaffDetailRecord | null;
  targetStatus: 'ACTIVE' | 'INACTIVE';
  onClose: () => void;
  onSuccess: (updated: StaffDetailRecord) => void;
}

export const StaffStatusModal: React.FC<StaffStatusModalProps> = ({
  isOpen,
  staff,
  targetStatus,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Safe initial focus on Cancel button
  useStaffFocusTrap({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: cancelButtonRef,
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen || !staff) return null;

  const isDeactivating = targetStatus === 'INACTIVE';
  const modalTitle = isDeactivating ? 'Deactivate Staff' : 'Reactivate Staff';

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await api.staff.update(staff.id, {
        status: targetStatus,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Staff status update error:', err);
      let msg = 'Failed to update personnel status. Please try again.';
      if (err?.status === 403) {
        msg = 'You do not have permission to modify staff status.';
      } else if (err?.status === 404) {
        msg = 'Staff member record was not found.';
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-150"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-status-modal-title"
        aria-describedby="staff-status-modal-description"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200/80 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isDeactivating
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <IconAlertTriangle size={16} />
            </div>
            <div>
              <h2
                id="staff-status-modal-title"
                className="text-sm font-bold text-slate-900 tracking-tight"
              >
                {modalTitle}
              </h2>
              <p className="text-[11px] text-slate-500">Personnel Lifecycle Management</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close dialog"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Error Message */}
          {error && (
            <div
              className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2"
              role="alert"
            >
              <IconAlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Personnel Identity Overview */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Personnel Name</span>
              <span className="font-semibold text-slate-800">{staff.fullName}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
              <span className="text-slate-500">Designation</span>
              <span className="font-medium text-slate-700">{staff.role || 'Unspecified'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
              <span className="text-slate-500">Current Status</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  staff.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {staff.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Lifecycle Explanation */}
          <div id="staff-status-modal-description" className="text-xs text-slate-600 leading-relaxed">
            {isDeactivating ? (
              <p>
                This keeps the staff record and payroll history intact. The staff member will be
                excluded from future payroll runs.
              </p>
            ) : (
              <p>
                This restores the staff member to Active status and makes them eligible for future
                payroll runs.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/30">
          <button
            ref={cancelButtonRef}
            id="staff-status-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="staff-status-confirm-btn"
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              isDeactivating
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <IconLoader size={13} className="animate-spin" />
                <span>{isDeactivating ? 'Deactivating...' : 'Reactivating...'}</span>
              </>
            ) : (
              <span>{modalTitle}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
