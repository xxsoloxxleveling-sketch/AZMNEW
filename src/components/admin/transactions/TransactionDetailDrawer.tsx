import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
} from '../../common/icons';
import { api } from '../../../services/api';
import type {
  TransactionRecord,
  PaymentMethod,
} from '../../../lib/mockApi';
import { useLedgerFocusTrap } from './useLedgerFocusTrap';
import { TransactionVoidModal } from './TransactionVoidModal';

export interface TransactionDetailDrawerProps {
  transactionId: string | null;
  initialTransaction?: TransactionRecord | null;
  canVoid?: boolean;
  onClose: () => void;
  onTransactionUpdated?: (updated: TransactionRecord) => void;
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

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatPaymentMethod(method?: PaymentMethod | null): string {
  if (!method) return '—';
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Bank Transfer';
    case 'CASH':
      return 'Cash';
    case 'CHEQUE':
      return 'Cheque';
    case 'ONLINE':
      return 'Online';
    case 'OTHER':
      return 'Other';
    default:
      return String(method).replace(/_/g, ' ');
  }
}

function formatSource(source: string): string {
  switch (source) {
    case 'FEE':
      return 'Fee Collection';
    case 'PAYROLL':
      return 'Payroll Disbursement';
    case 'MANUAL':
      return 'Manual Entry';
    default:
      return source;
  }
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transactionId,
  initialTransaction,
  canVoid = false,
  onClose,
  onTransactionUpdated,
}) => {
  const [transaction, setTransaction] = useState<TransactionRecord | null>(() => {
    if (initialTransaction && initialTransaction.id === transactionId) return initialTransaction;
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!initialTransaction || initialTransaction.id !== transactionId);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Accessible focus trap and focus return
  useLedgerFocusTrap({
    isOpen: Boolean(transactionId),
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  // Authoritative detail fetch
  const fetchAuthoritativeDetail = useCallback(async () => {
    if (!transactionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.transactions.getById(transactionId);
      setTransaction(res);
      if (onTransactionUpdated) {
        onTransactionUpdated(res);
      }
    } catch (err: any) {
      console.error('Failed to load transaction detail:', err);
      setError(err?.message || 'Unable to load authoritative transaction record.');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, onTransactionUpdated]);

  useEffect(() => {
    if (transactionId) {
      setFeedbackNotice(null);
      if (initialTransaction && initialTransaction.id === transactionId) {
        setTransaction(initialTransaction);
      }
      fetchAuthoritativeDetail();
    } else {
      setTransaction(null);
      setError(null);
    }
  }, [transactionId, initialTransaction, fetchAuthoritativeDetail]);

  if (!transactionId) return null;

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleVoidSuccess = (voidedRecord: TransactionRecord) => {
    setTransaction(voidedRecord);
    setIsVoidModalOpen(false);
    setFeedbackNotice({
      type: 'success',
      message: `Transaction ${voidedRecord.id.slice(0, 10)}... has been marked as VOIDED.`,
    });
    if (onTransactionUpdated) {
      onTransactionUpdated(voidedRecord);
    }
  };

  const isIncome = transaction?.type === 'OTHER_INCOME' || transaction?.type === 'FEE_INCOME';
  const isPosted = transaction?.status === 'POSTED';
  const isEligibleForVoid = isPosted && transaction?.source === 'MANUAL' && canVoid;

  return (
    <>
      <div
        id="transaction-detail-drawer"
        className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-dossier-title"
      >
        <div
          ref={drawerRef}
          className="w-full max-w-[560px] md:w-[70vw] lg:max-w-[580px] bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
        >
          {/* Loading State without existing record */}
          {isLoading && !transaction && (
            <div className="p-8 flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
              <IconLoader size={22} className="animate-spin text-[#185b9d]" />
              <p className="text-xs font-medium">Loading authoritative transaction record...</p>
            </div>
          )}

          {/* Error State without record */}
          {!isLoading && !transaction && error && (
            <div className="p-8 flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600">
                <IconAlertTriangle size={22} />
              </div>
              <p className="text-xs font-semibold text-slate-800">{error}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={fetchAuthoritativeDetail}
                  className="px-3 py-1.5 bg-[#185b9d] text-white rounded-md text-xs font-semibold hover:bg-[#144a80] transition cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Main Record Content */}
          {transaction && (
            <>
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Directional Type Tag */}
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        isIncome
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {transaction.type.replace(/_/g, ' ')}
                    </span>

                    {/* Status Badge */}
                    {isPosted ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Posted
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Voided
                      </span>
                    )}

                    {/* Source Pill */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {formatSource(transaction.source)}
                    </span>
                  </div>

                  <h2
                    id="transaction-dossier-title"
                    className="text-base font-bold text-slate-900 leading-snug break-words pt-0.5"
                  >
                    Transaction Dossier
                  </h2>

                  {/* ID & Copy */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {transaction.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(transaction.id)}
                      className="text-slate-400 hover:text-[#185b9d] transition cursor-pointer p-0.5"
                      title="Copy full transaction ID"
                      aria-label="Copy full transaction ID"
                    >
                      {copiedId ? (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 font-sans">
                          <IconCheck size={11} /> Copied
                        </span>
                      ) : (
                        <span className="text-[10px] font-sans hover:underline">Copy</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                    title="Close dossier"
                    aria-label="Close dossier"
                  >
                    <IconClose size={16} />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="p-4 sm:p-5 space-y-4 flex-1 text-xs overflow-y-auto">
                {/* Feedback Banner */}
                {feedbackNotice && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`p-3 rounded-lg border flex items-start justify-between gap-2.5 ${
                      feedbackNotice.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <IconCheck size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed font-medium">{feedbackNotice.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFeedbackNotice(null)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer shrink-0"
                      title="Dismiss notification"
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                )}

                {/* Amount Hero Card */}
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Transaction Amount
                    </span>
                    <span
                      className={`text-xl font-bold font-mono tracking-tight block mt-0.5 ${
                        isIncome ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIncome ? '+' : '-'} PKR {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Effective Date
                    </span>
                    <span className="font-semibold text-slate-800 text-xs block mt-0.5">
                      {formatDate(transaction.transactionDate)}
                    </span>
                  </div>
                </div>

                {/* Section 1: Financial & Reference Details */}
                <div className="space-y-2.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Financial Details
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-lg border border-slate-200/80 bg-white">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reference Number</span>
                      <span className="font-semibold font-mono text-slate-800">
                        {transaction.referenceNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Payment Method</span>
                      <span className="font-semibold text-slate-800">
                        {formatPaymentMethod(transaction.paymentMethod)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Category</span>
                      <span className="font-semibold text-slate-800">
                        {transaction.category || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Ledger Status</span>
                      <span className="font-semibold text-slate-800">
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Full Description */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Description & Narrative
                  </h3>
                  <div className="p-3.5 rounded-lg border border-slate-200/80 bg-white">
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {transaction.description}
                    </p>
                  </div>
                </div>

                {/* Section 3: Relational Source Context (if present) */}
                {transaction.source === 'FEE' && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Source Context — Student Fee Challan
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-lg border border-slate-200/80 bg-white">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Challan Number</span>
                        <span className="font-semibold font-mono text-slate-800">
                          {transaction.feeRecord?.challanNumber || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Billing Month</span>
                        <span className="font-semibold text-slate-800">
                          {transaction.feeRecord?.month || '—'}
                        </span>
                      </div>
                      {transaction.feeRecord?.student && (
                        <div className="col-span-2 pt-1 border-t border-slate-100">
                          <span className="text-slate-400 block text-[10px]">Student / Candidate</span>
                          <span className="font-semibold text-slate-800">
                            {transaction.feeRecord.student.fullName} ({transaction.feeRecord.student.applicationNo})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {transaction.source === 'PAYROLL' && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Source Context — Staff Payroll Voucher
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-lg border border-slate-200/80 bg-white">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Staff Member</span>
                        <span className="font-semibold text-slate-800">
                          {transaction.payrollRecord?.staff?.fullName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Designation / Role</span>
                        <span className="font-semibold text-slate-800">
                          {transaction.payrollRecord?.staff?.role || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Disbursement Month</span>
                        <span className="font-semibold text-slate-800">
                          {transaction.payrollRecord?.month || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Audit & Operator Attribution */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Audit & Attribution
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-lg border border-slate-200/80 bg-white">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recorded By</span>
                      <span className="font-semibold text-slate-800">
                        {transaction.createdByName || transaction.createdByEmail || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Creation Timestamp</span>
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(transaction.createdAt)}
                      </span>
                    </div>

                    {/* Void Audit Information if VOIDED */}
                    {!isPosted && (
                      <>
                        <div className="col-span-2 pt-2 border-t border-rose-100">
                          <span className="text-rose-600 block text-[10px] font-bold uppercase tracking-wider">
                            Void Audit Record
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Voided By</span>
                          <span className="font-semibold text-rose-800">
                            {transaction.voidedByName || transaction.voidedByEmail || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Voided Timestamp</span>
                          <span className="font-semibold text-slate-800">
                            {formatDateTime(transaction.voidedAt)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[10px]">Void Reason</span>
                          <p className="font-medium text-rose-900 bg-rose-50/80 p-2 rounded border border-rose-200 leading-relaxed text-xs">
                            {transaction.voidReason || '—'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 5: Controlled Void Action / Helper Guidance */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {isEligibleForVoid && (
                    <div className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-lg flex items-center justify-between gap-3">
                      <div>
                        <span className="font-bold text-rose-900 text-xs block">
                          Void Manual Transaction
                        </span>
                        <span className="text-[11px] text-rose-700 block">
                          Permanently cancels this entry while retaining full audit records.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsVoidModalOpen(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
                      >
                        Void Transaction
                      </button>
                    </div>
                  )}

                  {!isPosted && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                      <p className="font-semibold text-slate-800">Immutable Financial Audit</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        This transaction has been voided. Financial audit records cannot be unvoided or deleted.
                      </p>
                    </div>
                  )}

                  {transaction.source !== 'MANUAL' && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-xs">
                      <p className="font-semibold text-slate-800">Source Workflow Managed</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Automated fee collections and payroll disbursements cannot be voided directly from the ledger.
                        Please manage the source record in the respective module.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={fetchAuthoritativeDetail}
                  disabled={isLoading}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Reload latest authoritative data"
                >
                  <IconRefresh size={12} className={isLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer shadow-2xs"
                >
                  Close Dossier
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controlled Void Confirmation Modal */}
      {transaction && isVoidModalOpen && (
        <TransactionVoidModal
          isOpen={isVoidModalOpen}
          transaction={transaction}
          onClose={() => setIsVoidModalOpen(false)}
          onSuccess={handleVoidSuccess}
          onConflict={(latest) => {
            setTransaction(latest);
            setIsVoidModalOpen(false);
            setFeedbackNotice({
              type: 'conflict',
              message: 'Transaction status was updated by another session. Latest record reloaded.',
            });
            if (onTransactionUpdated) {
              onTransactionUpdated(latest);
            }
          }}
        />
      )}
    </>
  );
};
