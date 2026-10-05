import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { MockPartner } from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { usePartnerFocusTrap } from './usePartnerFocusTrap';

export interface PartnerStatusModalProps {
  open: boolean;
  partner: MockPartner;
  onClose: () => void;
  onSuccess: (updatedPartner: MockPartner) => void;
  onConflict?: (latestPartner: MockPartner) => void;
}

export const PartnerStatusModal: React.FC<PartnerStatusModalProps> = ({
  open,
  partner,
  onClose,
  onSuccess,
  onConflict,
}) => {
  const getInitialTarget = (currentStatus: string): 'APPROVED' | 'REJECTED' => {
    if (currentStatus === 'APPROVED') return 'REJECTED';
    if (currentStatus === 'REJECTED') return 'APPROVED';
    return 'APPROVED'; // For PENDING, default to APPROVED
  };

  const [targetStatus, setTargetStatus] = useState<'APPROVED' | 'REJECTED'>(() =>
    getInitialTarget(partner.status)
  );
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Accessible focus trap and focus return
  usePartnerFocusTrap({
    isOpen: open,
    containerRef: modalRef,
    initialFocusRef: textareaRef,
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  // Reset state on open or partner change
  useEffect(() => {
    if (open) {
      setTargetStatus(getInitialTarget(partner.status));
      setReason('');
      setValidationError(null);
      setGeneralError(null);
      setIsSubmitting(false);
    }
  }, [open, partner.id, partner.status]);

  if (!open) return null;

  // Validation requirements matching backend schema
  const isReasonMandatory =
    targetStatus === 'REJECTED' ||
    (partner.status === 'REJECTED' && targetStatus === 'APPROVED');

  const reasonLabel =
    targetStatus === 'REJECTED'
      ? partner.status === 'APPROVED'
        ? 'Revocation Reason'
        : 'Rejection Reason'
      : partner.status === 'REJECTED'
      ? 'Reinstatement Justification'
      : 'Review / Approval Note';

  const reasonPlaceholder =
    targetStatus === 'REJECTED'
      ? partner.status === 'APPROVED'
        ? 'Explain the operational or compliance rationale for revoking this approved partner status...'
        : 'Specify why this affiliation request is being rejected (sent to applicant and logged in audit ledger)...'
      : partner.status === 'REJECTED'
      ? 'Explain the justification for reversing the previous rejection and reinstating this partner...'
      : 'Optional administrative notes or inspection remarks for the audit trail...';

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 500) {
      setReason(val);
      if (validationError) {
        setValidationError(null);
      }
    }
  };

  const handleRadioKeyDown = (e: React.KeyboardEvent, status: 'APPROVED' | 'REJECTED') => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = status === 'APPROVED' ? 'REJECTED' : 'APPROVED';
      setTargetStatus(next);
      if (validationError) setValidationError(null);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setTargetStatus(status);
      if (validationError) setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. No-op protection
    if (targetStatus === partner.status) {
      setGeneralError(`Institution is already in '${targetStatus}' status.`);
      return;
    }

    // 2. Mandatory reason validation
    const trimmedReason = reason.trim();
    if (isReasonMandatory && !trimmedReason) {
      setValidationError(
        targetStatus === 'REJECTED'
          ? 'A valid rejection reason is required.'
          : 'A justification reason is required when reinstating a rejected institution.'
      );
      textareaRef.current?.focus();
      return;
    }

    if (trimmedReason.length > 500) {
      setValidationError('Reason cannot exceed 500 characters.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);
    setValidationError(null);

    try {
      const updated = await api.partners.updateStatus(partner.id, {
        status: targetStatus,
        reason: trimmedReason || undefined,
        expectedStatus: partner.status,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Status update failed:', err);

      // HTTP 409 Conflict: Immediate authoritative reload without requiring button click
      if (err.status === 409 || err.message?.toLowerCase().includes('conflict')) {
        try {
          const authoritative = await api.partners.getById(partner.id);
          onConflict?.(authoritative);
          onClose();
          return;
        } catch (fetchErr) {
          console.error('Failed to refetch authoritative partner on conflict:', fetchErr);
        }
      }

      setGeneralError(err.message || 'Failed to update partner institution status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-status-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h2 id="partner-status-modal-title" className="text-sm font-bold text-slate-900">
                {partner.status === 'PENDING'
                  ? 'Review Partner Application'
                  : partner.status === 'APPROVED'
                  ? 'Revoke / Change Affiliation Status'
                  : 'Reinstate / Approve Institution'}
              </h2>
              <span className="font-mono text-[11px] font-bold text-[#185b9d] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {partner.partnerCode}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate" title={partner.institutionName}>
              {partner.institutionName} • {partner.district}, {partner.province}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer shrink-0 disabled:opacity-50"
            title="Close modal"
            aria-label="Close modal"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col text-xs flex-1 overflow-y-auto" noValidate>
          <div className="p-4 sm:p-5 space-y-4 flex-1">
            {/* General Error Banner */}
            {generalError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2"
              >
                <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">{generalError}</p>
              </div>
            )}

            {/* Current Institution State Summary */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Current Status
                </span>
                <StatusBadge status={partner.status} size="sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/70">
                <div>
                  <span className="text-slate-400 block text-[10px]">Focal Person</span>
                  <span className="font-medium text-slate-800">
                    {partner.contactName} ({partner.contactDesignation || 'Head'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Contact Mobile</span>
                  <span className="font-mono text-slate-800">{partner.contactMobile}</span>
                </div>
              </div>
            </div>

            {/* Target Status Selection */}
            <div className="space-y-2">
              <label id="target-status-label" className="text-[11px] font-semibold text-slate-700 block">
                Action / Target Status <span className="text-rose-500">*</span>
              </label>

              {partner.status === 'PENDING' ? (
                /* Semantic Segmented Radio Group for Pending */
                <div
                  role="radiogroup"
                  aria-labelledby="target-status-label"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  <div
                    role="radio"
                    aria-checked={targetStatus === 'APPROVED'}
                    tabIndex={targetStatus === 'APPROVED' ? 0 : -1}
                    onClick={() => {
                      setTargetStatus('APPROVED');
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => handleRadioKeyDown(e, 'APPROVED')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex items-start gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#185b9d] ${
                      targetStatus === 'APPROVED'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        targetStatus === 'APPROVED'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {targetStatus === 'APPROVED' && <IconCheck size={10} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                        <span>Approve Affiliation</span>
                        {targetStatus === 'APPROVED' && (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1 py-0.2 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Grant official partner status and permit candidate registrations.
                      </div>
                    </div>
                  </div>

                  <div
                    role="radio"
                    aria-checked={targetStatus === 'REJECTED'}
                    tabIndex={targetStatus === 'REJECTED' ? 0 : -1}
                    onClick={() => {
                      setTargetStatus('REJECTED');
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => handleRadioKeyDown(e, 'REJECTED')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer flex items-start gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      targetStatus === 'REJECTED'
                        ? 'border-rose-500 bg-rose-50/50 text-rose-950 ring-1 ring-rose-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        targetStatus === 'REJECTED'
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {targetStatus === 'REJECTED' && <IconCheck size={10} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                        <span>Reject Application</span>
                        {targetStatus === 'REJECTED' && (
                          <span className="text-[10px] text-rose-700 font-semibold bg-rose-100 px-1 py-0.2 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Decline affiliation request with recorded justification.
                      </div>
                    </div>
                  </div>
                </div>
              ) : partner.status === 'APPROVED' ? (
                /* Single Transition for Approved -> Rejected */
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/40 flex items-start gap-2.5">
                  <IconAlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs text-rose-950">
                      Revoke Affiliation (Transition to REJECTED)
                    </div>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      This action revokes active partner status. The institution will no longer appear
                      as an active affiliated venue for candidates.
                    </p>
                  </div>
                </div>
              ) : (
                /* Single Transition for Rejected -> Approved */
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 flex items-start gap-2.5">
                  <IconCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs text-emerald-950">
                      Reinstate Institution (Transition to APPROVED)
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      This action reverses the previous rejection and restores approved partner
                      affiliation. The prior rejection reason will be archived into the audit ledger.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Reason / Justification Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="partner-status-reason" className="text-[11px] font-semibold text-slate-700">
                  {reasonLabel} {isReasonMandatory && <span className="text-rose-500">*</span>}
                </label>
                <span
                  id="partner-status-reason-counter"
                  className={`text-[10px] font-mono ${
                    reason.length > 480 ? 'text-amber-600 font-bold' : 'text-slate-400'
                  }`}
                  aria-live="polite"
                >
                  {reason.length} / 500
                </span>
              </div>

              <textarea
                ref={textareaRef}
                id="partner-status-reason"
                rows={3}
                value={reason}
                maxLength={500}
                onChange={handleReasonChange}
                placeholder={reasonPlaceholder}
                aria-required={isReasonMandatory}
                aria-invalid={!!validationError}
                aria-describedby={
                  validationError ? 'partner-status-reason-err' : 'partner-status-reason-hint'
                }
                className={`w-full rounded-lg border ${
                  validationError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300 bg-white'
                } p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                  targetStatus === 'REJECTED'
                    ? 'focus:ring-rose-500'
                    : 'focus:ring-[#185b9d]'
                } transition`}
              />

              {validationError ? (
                <p id="partner-status-reason-err" role="alert" className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                  <IconAlertTriangle size={12} className="shrink-0" />
                  <span>{validationError}</span>
                </p>
              ) : (
                <p id="partner-status-reason-hint" className="text-[10px] text-slate-400">
                  {isReasonMandatory
                    ? 'Mandatory: Stored immutably in the AZM partner status audit ledger.'
                    : 'Optional: Useful for internal institutional review tracking.'}
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || targetStatus === partner.status}
              className={`px-4 py-1.5 rounded-lg font-semibold text-xs text-white shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                targetStatus === 'REJECTED'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin text-white" />
                  <span>Updating Status...</span>
                </>
              ) : (
                <>
                  <IconCheck size={13} />
                  <span>
                    {targetStatus === 'REJECTED'
                      ? partner.status === 'APPROVED'
                        ? 'Confirm Revocation'
                        : 'Reject Application'
                      : partner.status === 'REJECTED'
                      ? 'Confirm Reinstatement'
                      : 'Approve Application'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
