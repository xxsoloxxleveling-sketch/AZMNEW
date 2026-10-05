import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
} from '../../common/icons';
import { api } from '../../../services/api';
import type { TransactionRecord } from '../../../lib/mockApi';
import { useLedgerFocusTrap } from './useLedgerFocusTrap';

export interface TransactionVoidModalProps {
  isOpen: boolean;
  transaction: TransactionRecord;
  onClose: () => void;
  onSuccess: (voidedTransaction: TransactionRecord) => void;
  onConflict?: (latestTransaction: TransactionRecord) => void;
}

function formatCurrency(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const TransactionVoidModal: React.FC<TransactionVoidModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSuccess,
  onConflict,
}) => {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Accessible focus trap and focus return
  useLedgerFocusTrap({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: reasonTextareaRef,
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setValidationError(null);
      setApiError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, transaction.id]);

  if (!isOpen) return null;

  const isIncome = transaction.type === 'OTHER_INCOME' || transaction.type === 'FEE_INCOME';

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setApiError(null);
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setValidationError('A non-empty reason for voiding this transaction is required.');
      return;
    }
    if (cleanReason.length > 500) {
      setValidationError('Void reason cannot exceed 500 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const voided = await api.transactions.void(transaction.id, cleanReason);
      onSuccess(voided);
      onClose();
    } catch (err: any) {
      console.error('Failed to void transaction:', err);
      const msg = err?.message || 'Failed to void transaction.';

      // Check for stale state or conflict (e.g. already voided)
      if (err?.status === 400 || err?.status === 409 || msg.toLowerCase().includes('already voided')) {
        try {
          const latest = await api.transactions.getById(transaction.id);
          if (onConflict) {
            onConflict(latest);
          }
        } catch {
          // ignore
        }
      }
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (!isSubmitting && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-transaction-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-rose-50/70 border-b border-rose-100 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
              <IconAlertTriangle size={18} />
            </div>
            <div>
              <h2
                id="void-transaction-title"
                className="text-base font-bold text-slate-900 leading-snug"
              >
                Void Financial Transaction
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit cancellation of a manual financial entry.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-rose-100/50 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleVoid} className="p-4 sm:p-5 space-y-4">
          {/* Target Transaction Summary Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-600">
                {transaction.type === 'OTHER_INCOME' ? 'Other Income' : 'Other Expense'}
              </span>
              <span
                className={`font-mono font-bold text-sm ${
                  isIncome ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isIncome ? '+' : '-'} PKR {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Date: {formatDate(transaction.transactionDate)}</span>
              {transaction.referenceNumber && (
                <span className="font-mono">Ref: {transaction.referenceNumber}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-700 line-clamp-2 pt-0.5">
              {transaction.description}
            </p>
          </div>

          {/* Operational Consequence Note */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-amber-900 text-xs leading-relaxed space-y-1">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <span>Operational Consequence:</span>
            </p>
            <p className="text-[11px]">
              This action keeps the original transaction in the financial ledger and marks it as voided.
              Financial audit records remain permanent and immutable.
            </p>
          </div>

          {/* Error Banner */}
          {apiError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
            >
              {apiError}
            </div>
          )}

          {/* Reason Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="void-reason" className="block text-xs font-semibold text-slate-700">
                Reason for Voiding <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {reason.length} / 500
              </span>
            </div>
            <textarea
              id="void-reason"
              ref={reasonTextareaRef}
              rows={3}
              maxLength={500}
              placeholder="State the justification or error reason for this audit cancellation..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isSubmitting}
              aria-required="true"
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'void-reason-error' : undefined}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 transition resize-none ${
                validationError ? 'border-rose-400' : 'border-slate-200'
              }`}
            />
            {validationError && (
              <p id="void-reason-error" className="text-[11px] text-rose-600 font-medium">
                {validationError}
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && <IconLoader size={13} className="animate-spin" />}
              <span>{isSubmitting ? 'Voiding...' : 'Void Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
