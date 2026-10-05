import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
} from '../../common/icons';
import { api } from '../../../services/api';
import type {
  TransactionRecord,
  PaymentMethod,
  CreateManualTransactionPayload,
} from '../../../lib/mockApi';
import { useLedgerFocusTrap } from './useLedgerFocusTrap';

export interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: TransactionRecord) => void;
}

interface FormState {
  type: 'OTHER_INCOME' | 'OTHER_EXPENSE';
  amount: string;
  description: string;
  transactionDate: string;
  category: string;
  paymentMethod: PaymentMethod | '';
  referenceNumber: string;
}

const INITIAL_FORM_STATE: FormState = {
  type: 'OTHER_INCOME',
  amount: '',
  description: '',
  transactionDate: '',
  category: '',
  paymentMethod: '',
  referenceNumber: '',
};

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [submissionIntentKey, setSubmissionIntentKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const modalRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Accessible focus trap and keyboard management
  useLedgerFocusTrap({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: amountInputRef,
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  // Reset form and submission intent key when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM_STATE);
      setErrorBanner(null);
      setFieldErrors({});
      setIsSubmitting(false);
      setSubmissionIntentKey(null);
    }
  }, [isOpen]);

  const updateFormField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
    // Any change to form fields invalidates current submission intent key
    setSubmissionIntentKey(null);
  };

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const numAmount = parseFloat(form.amount.trim());
    if (!form.amount.trim() || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = 'Amount must be a positive number greater than 0.';
    }

    const cleanDesc = form.description.trim();
    if (!cleanDesc) {
      errors.description = 'Description is required.';
    } else if (cleanDesc.length < 3) {
      errors.description = 'Description must be at least 3 characters.';
    } else if (cleanDesc.length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    }

    if (form.category.trim().length > 100) {
      errors.category = 'Category cannot exceed 100 characters.';
    }

    if (form.referenceNumber.trim().length > 100) {
      errors.referenceNumber = 'Reference number cannot exceed 100 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submission

    setErrorBanner(null);
    if (!validate()) return;

    // Reuse submission intent key if retrying the same payload, or generate a fresh key
    let intentKey = submissionIntentKey;
    if (!intentKey) {
      intentKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
      setSubmissionIntentKey(intentKey);
    }

    setIsSubmitting(true);
    try {
      const payload: CreateManualTransactionPayload = {
        type: form.type,
        amount: parseFloat(form.amount.trim()),
        description: form.description.trim(),
        transactionDate: form.transactionDate ? new Date(form.transactionDate).toISOString() : undefined,
        category: form.category.trim() || null,
        paymentMethod: (form.paymentMethod as PaymentMethod) || null,
        referenceNumber: form.referenceNumber.trim() || null,
      };

      const created = await api.transactions.create(payload, intentKey);
      setSubmissionIntentKey(null);
      setForm(INITIAL_FORM_STATE);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Failed to create manual transaction:', err);
      setErrorBanner(
        err?.message || 'Unable to record transaction. Please verify the input values and retry.'
      );
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
      aria-labelledby="record-transaction-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2
              id="record-transaction-title"
              className="text-base font-bold text-slate-900 leading-snug"
            >
              Record Manual Transaction
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record non-automated income or operational expense into the financial ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Error Banner */}
          {errorBanner && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs"
            >
              <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorBanner}</div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                title="Dismiss error"
              >
                <IconClose size={12} />
              </button>
            </div>
          )}

          {/* Transaction Type Segmented Toggle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Transaction Direction / Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateFormField('type', 'OTHER_INCOME')}
                disabled={isSubmitting}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  form.type === 'OTHER_INCOME'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {form.type === 'OTHER_INCOME' && <IconCheck size={12} className="text-emerald-600" />}
                <span>Other Income (+)</span>
              </button>
              <button
                type="button"
                onClick={() => updateFormField('type', 'OTHER_EXPENSE')}
                disabled={isSubmitting}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  form.type === 'OTHER_EXPENSE'
                    ? 'bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {form.type === 'OTHER_EXPENSE' && <IconCheck size={12} className="text-rose-600" />}
                <span>Other Expense (-)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Fee collections and payroll disbursements are recorded from their respective source workflows.
            </p>
          </div>

          {/* Amount Field */}
          <div className="space-y-1">
            <label htmlFor="tx-amount" className="block text-xs font-semibold text-slate-700">
              Amount (PKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                PKR
              </span>
              <input
                id="tx-amount"
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => updateFormField('amount', e.target.value)}
                disabled={isSubmitting}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.amount)}
                aria-describedby={fieldErrors.amount ? 'tx-amount-error' : undefined}
                className={`w-full pl-12 pr-3 py-1.5 text-xs font-mono font-bold bg-white border rounded-lg placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9 ${
                  fieldErrors.amount ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200'
                }`}
              />
            </div>
            {fieldErrors.amount && (
              <p id="tx-amount-error" className="text-[11px] text-rose-600 font-medium">
                {fieldErrors.amount}
              </p>
            )}
          </div>

          {/* Transaction Date (Optional) */}
          <div className="space-y-1">
            <label htmlFor="tx-date" className="block text-xs font-semibold text-slate-700">
              Transaction Date <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="tx-date"
              type="date"
              value={form.transactionDate}
              onChange={(e) => updateFormField('transactionDate', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Leave blank to automatically post with the current date and time.
            </p>
          </div>

          {/* Description (Required) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="tx-description" className="block text-xs font-semibold text-slate-700">
                Description & Audit Notes <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {form.description.length} / 500
              </span>
            </div>
            <textarea
              id="tx-description"
              rows={3}
              maxLength={500}
              placeholder="State the financial purpose, vendor, or invoice reference..."
              value={form.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              disabled={isSubmitting}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'tx-desc-error' : undefined}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition resize-none ${
                fieldErrors.description ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200'
              }`}
            />
            {fieldErrors.description && (
              <p id="tx-desc-error" className="text-[11px] text-rose-600 font-medium">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Category & Payment Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Field */}
            <div className="space-y-1">
              <label htmlFor="tx-category" className="block text-xs font-semibold text-slate-700">
                Category <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                id="tx-category"
                type="text"
                maxLength={100}
                placeholder="e.g. Utilities, Repair, Supplies"
                value={form.category}
                onChange={(e) => updateFormField('category', e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
              />
            </div>

            {/* Payment Method Field */}
            <div className="space-y-1">
              <label htmlFor="tx-payment-method" className="block text-xs font-semibold text-slate-700">
                Payment Method <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
              </label>
              <select
                id="tx-payment-method"
                value={form.paymentMethod}
                onChange={(e) => updateFormField('paymentMethod', e.target.value as any)}
                disabled={isSubmitting}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9 cursor-pointer"
              >
                <option value="">Select Method (Optional)</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online Payment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Reference Number Field */}
          <div className="space-y-1">
            <label htmlFor="tx-reference" className="block text-xs font-semibold text-slate-700">
              Reference / Voucher Number <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="tx-reference"
              type="text"
              maxLength={100}
              placeholder="e.g. Bank Receipt #, Bill #, External Reference"
              value={form.referenceNumber}
              onChange={(e) => updateFormField('referenceNumber', e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
            />
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-[#185b9d] hover:bg-[#144a80] rounded-lg shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting && <IconLoader size={13} className="animate-spin" />}
              <span>{isSubmitting ? 'Recording...' : 'Record Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
