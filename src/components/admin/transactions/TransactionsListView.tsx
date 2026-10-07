import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search as IconSearch,
  X as IconClose,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  ChevronsUpDown as IconChevronsUpDown,
  RefreshCw as IconRefresh,
  AlertTriangle as IconAlertTriangle,
  Check as IconCheck,
  History as IconLedger,
  Loader2 as IconLoader,
  Plus as IconPlus,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { api } from '../../../services/api';
import type {
  TransactionRecord,
  TransactionType,
  TransactionStatus,
  TransactionSource,
  PaymentMethod,
  TransactionPagination,
  TransactionSummaryResponse,
} from '../../../lib/mockApi';
import { TransactionFormModal } from './TransactionFormModal';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';

/**
 * Format string-based Decimal amount for high-readability display.
 * Does not mutate or round the underlying authoritative string data.
 */
function formatCurrency(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
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

function formatSource(source: TransactionSource): string {
  switch (source) {
    case 'FEE':
      return 'Fee';
    case 'PAYROLL':
      return 'Payroll';
    case 'MANUAL':
      return 'Manual';
    default:
      return source;
  }
}

function getTypeMeta(type: TransactionType) {
  switch (type) {
    case 'FEE_INCOME':
      return {
        label: 'Fee Income',
        isIncome: true,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      };
    case 'OTHER_INCOME':
      return {
        label: 'Other Income',
        isIncome: true,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      };
    case 'SALARY_EXPENSE':
      return {
        label: 'Salary Expense',
        isIncome: false,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      };
    case 'OTHER_EXPENSE':
      return {
        label: 'Other Expense',
        isIncome: false,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      };
    default:
      return {
        label: String(type).replace(/_/g, ' '),
        isIncome: true,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

export const TransactionsListView: React.FC = () => {
  const { role } = useAuth();

  // RBAC checks matching authoritative backend routes
  const canRecord = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const canVoid = role === 'SUPER_ADMIN' || role === 'ADMIN';

  // Authoritative Summary State
  const [summary, setSummary] = useState<TransactionSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Transaction List & Pagination State
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [pagination, setPagination] = useState<TransactionPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | TransactionSource>('ALL');

  // Server Sorting State (Only supported backend columns)
  const [sortBy, setSortBy] = useState<'transactionDate' | 'createdAt' | 'amount'>('transactionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal, Drawer & Feedback State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);

  // Clipboard copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Validate date range
  const isDateRangeValid = useMemo(() => {
    if (!startDateInput || !endDateInput) return true;
    return new Date(startDateInput) <= new Date(endDateInput);
  }, [startDateInput, endDateInput]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      debouncedSearch ||
      startDateInput ||
      endDateInput ||
      typeFilter !== 'ALL' ||
      statusFilter !== 'ALL' ||
      sourceFilter !== 'ALL'
    );
  }, [debouncedSearch, startDateInput, endDateInput, typeFilter, statusFilter, sourceFilter]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStartDateInput('');
    setEndDateInput('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Fetch Authoritative Summary strictly from GET /api/transactions/summary
  const fetchSummary = useCallback(async () => {
    if (!isDateRangeValid) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await api.transactions.getSummary({
        startDate: startDateInput || undefined,
        endDate: endDateInput || undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
      });
      setSummary(res);
    } catch (err: any) {
      console.error('Error fetching authoritative transaction summary:', err);
      setSummaryError(err?.message || 'Authoritative summary could not be loaded.');
    } finally {
      setSummaryLoading(false);
    }
  }, [isDateRangeValid, startDateInput, endDateInput, typeFilter, sourceFilter]);

  // Fetch Transaction Directory strictly from GET /api/transactions
  const fetchTransactions = useCallback(
    async (showFullLoading = true) => {
      if (!isDateRangeValid) return;
      if (showFullLoading && transactions.length === 0) setListLoading(true);
      setListError(null);

      try {
        const res = await api.transactions.getAll({
          page: pagination.page,
          limit: pagination.limit,
          search: debouncedSearch || undefined,
          startDate: startDateInput || undefined,
          endDate: endDateInput || undefined,
          type: typeFilter !== 'ALL' ? typeFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          source: sourceFilter !== 'ALL' ? sourceFilter : undefined,
          sortBy,
          sortOrder,
        });

        if (res && res.transactions) {
          setTransactions(res.transactions);
          if (res.pagination) {
            setPagination({
              page: res.pagination.page,
              limit: res.pagination.limit,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
            });
          }
        }
      } catch (err: any) {
        console.error('Error fetching transaction directory:', err);
        setListError(err?.message || 'Financial records could not be loaded from server.');
      } finally {
        setListLoading(false);
      }
    },
    [
      isDateRangeValid,
      pagination.page,
      pagination.limit,
      debouncedSearch,
      startDateInput,
      endDateInput,
      typeFilter,
      statusFilter,
      sourceFilter,
      sortBy,
      sortOrder,
      transactions.length,
    ]
  );

  // Initial and reactive fetch
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions(transactions.length === 0);
  }, [fetchTransactions]);

  // Manual combined refresh preserving filters and pagination
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([fetchSummary(), fetchTransactions(false)]);
    setIsRefreshing(false);
  };

  // Column sort toggle for genuinely supported backend columns
  const handleSort = (field: 'transactionDate' | 'createdAt' | 'amount') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleOpenDetail = (tx: TransactionRecord) => {
    setSelectedTransaction(tx);
    setSelectedTransactionId(tx.id);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Financial Ledger</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              Single-Entry Audit Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Authoritative financial records, fee collections, and operational disbursements.
          </p>
        </div>

        {/* Global Controls & Primary Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Primary Action: Record Transaction (RBAC Controlled) */}
          {canRecord && (
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#185b9d] hover:bg-[#144a80] rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              title="Record non-automated income or operational expense"
            >
              <IconPlus size={14} />
              <span>Record Transaction</span>
            </button>
          )}

          {/* Refresh Control */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh summary and ledger directory"
          >
            <IconRefresh
              size={13}
              className={`text-[#185b9d] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Operational Feedback Banner (Success / Conflict) */}
      {feedbackNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 ${
            feedbackNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : feedbackNotice.type === 'conflict'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
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

      {/* Date Validation Warning Notice */}
      {!isDateRangeValid && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-2 text-xs"
        >
          <IconAlertTriangle size={15} className="text-amber-700 shrink-0" />
          <span>Invalid date range: Start date cannot be after end date. Adjust the dates to view records.</span>
        </div>
      )}

      {/* Authoritative Financial Summary Surface */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-3.5 space-y-3">
        {/* Summary Surface Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <IconLedger size={15} className="text-[#185b9d]" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Authoritative Summary
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {startDateInput || endDateInput
                ? `Period: ${startDateInput || 'Earliest'} to ${endDateInput || 'Latest'}`
                : 'All-time Cumulative'}
            </span>
          </div>

          {summary && !summaryLoading && (
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>
                <strong className="font-semibold text-slate-800">{summary.postedCount}</strong> Posted
              </span>
              <span>•</span>
              <span>
                <strong className="font-semibold text-slate-800">{summary.voidedCount}</strong> Voided
              </span>
              <span>•</span>
              <span className="font-mono text-[11px] text-slate-400">{summary.currency}</span>
            </div>
          )}
        </div>

        {/* Summary Error Independent State */}
        {summaryError && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <IconAlertTriangle size={14} className="text-amber-600 shrink-0" />
              <span>{summaryError}</span>
            </div>
            <button
              type="button"
              onClick={fetchSummary}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <IconRefresh size={11} />
              <span>Retry Summary</span>
            </button>
          </div>
        )}

        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Income Metric */}
          <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Income
            </span>
            <div className="mt-1">
              {summaryLoading ? (
                <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
              ) : (
                <span className="text-base sm:text-lg font-bold text-emerald-700 font-mono tracking-tight block">
                  PKR {formatCurrency(summary?.totalIncome)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Posted fee collections &amp; other incoming receipts
            </span>
          </div>

          {/* Total Expense Metric */}
          <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Expenses
            </span>
            <div className="mt-1">
              {summaryLoading ? (
                <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
              ) : (
                <span className="text-base sm:text-lg font-bold text-rose-700 font-mono tracking-tight block">
                  PKR {formatCurrency(summary?.totalExpense)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Posted payroll disbursements &amp; operational expenses
            </span>
          </div>

          {/* Net Movement Metric (Terminology Fixed in 2D) */}
          <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Net Movement
            </span>
            <div className="mt-1">
              {summaryLoading ? (
                <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
              ) : (
                <span
                  className={`text-base sm:text-lg font-bold font-mono tracking-tight block ${
                    summary && parseFloat(summary.netMovement) >= 0 ? 'text-slate-900' : 'text-rose-700'
                  }`}
                >
                  {summary && parseFloat(summary.netMovement) > 0 ? '+' : ''}
                  PKR {formatCurrency(summary?.netMovement)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Posted financial activity across selected period
            </span>
          </div>
        </div>
      </div>

      {/* Main Roster Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Operational Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-0 w-full sm:min-w-[200px] flex-1 max-w-sm">
              <IconSearch size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search description, reference..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 h-9">
                <span className="text-[11px] font-semibold text-slate-400">From</span>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => {
                    setStartDateInput(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 h-9">
                <span className="text-[11px] font-semibold text-slate-400">To</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => {
                    setEndDateInput(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              {(startDateInput || endDateInput) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateInput('');
                    setEndDateInput('');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition h-9 cursor-pointer"
                  title="Clear date range"
                >
                  Clear Dates
                </button>
              )}
            </div>

            {/* Transaction Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Types</option>
              <option value="FEE_INCOME">Fee Income Only (+)</option>
              <option value="SALARY_EXPENSE">Salary Expense Only (-)</option>
              <option value="OTHER_INCOME">Other Income Only (+)</option>
              <option value="OTHER_EXPENSE">Other Expense Only (-)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">Posted Only</option>
              <option value="VOIDED">Voided Only</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as any);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Sources</option>
              <option value="FEE">Fee Collections</option>
              <option value="PAYROLL">Payroll Disbursements</option>
              <option value="MANUAL">Manual Entries</option>
            </select>

            {/* Reset All Filters Affordance */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer h-9 shadow-2xs"
                title="Reset all active filters"
              >
                <IconClose size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Directory Error State */}
        {listError && (
          <div className="p-3.5 m-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <IconAlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span className="text-xs font-semibold">{listError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTransactions(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <IconRefresh size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold select-none">
                {/* Date Header (Sortable) */}
                <th
                  onClick={() => handleSort('transactionDate')}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition min-w-[130px]"
                  aria-sort={sortBy === 'transactionDate' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <IconChevronsUpDown size={12} className={sortBy === 'transactionDate' ? 'text-[#185b9d]' : 'text-slate-400'} />
                  </div>
                </th>

                {/* Reference & Description */}
                <th className="py-3.5 px-4 min-w-[260px]">Description &amp; Reference</th>

                {/* Type */}
                <th className="py-3.5 px-4 min-w-[120px]">Type</th>

                {/* Source */}
                <th className="py-3.5 px-4 min-w-[90px]">Source</th>

                {/* Payment Method */}
                <th className="py-3.5 px-4 min-w-[110px]">Method</th>

                {/* Amount (Sortable, Numeric) */}
                <th
                  onClick={() => handleSort('amount')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 transition min-w-[130px]"
                  aria-sort={sortBy === 'amount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount (PKR)</span>
                    <IconChevronsUpDown size={12} className={sortBy === 'amount' ? 'text-[#185b9d]' : 'text-slate-400'} />
                  </div>
                </th>

                {/* Status */}
                <th className="py-3.5 px-4 min-w-[100px]">Status</th>

                {/* Operator */}
                <th className="py-3.5 px-4 min-w-[130px]">Operator</th>

                {/* Actions */}
                <th className="py-3.5 px-4 text-right min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listLoading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <IconLoader size={16} className="animate-spin text-[#185b9d]" />
                      <span>Loading financial transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => {
                  const typeMeta = getTypeMeta(tx.type);
                  const isPosted = tx.status === 'POSTED';
                  const operatorName = tx.createdByName || tx.createdByEmail || '—';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => handleOpenDetail(tx)}
                      className="hover:bg-slate-50/70 transition-colors h-[48px] cursor-pointer"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="leading-tight">
                          <span className="font-semibold text-slate-800 text-xs block">
                            {formatDate(tx.transactionDate)}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {formatTime(tx.transactionDate) || formatDate(tx.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Description & Reference */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0 max-w-md">
                          <span
                            className="font-medium text-slate-900 text-xs block leading-snug truncate"
                            title={tx.description}
                          >
                            {tx.description}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {tx.referenceNumber && (
                              <span className="font-mono text-[10px] font-semibold text-[#185b9d] bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                                Ref: {tx.referenceNumber}
                              </span>
                            )}
                            {tx.feeRecord?.challanNumber && (
                              <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                Challan: {tx.feeRecord.challanNumber}
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-slate-400 leading-none">
                              {tx.id.slice(0, 10)}...
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(tx.id, e)}
                              className="text-[10px] text-slate-400 hover:text-[#185b9d] cursor-pointer"
                              title="Copy full transaction ID"
                            >
                              {copiedId === tx.id ? (
                                <span className="text-emerald-600 flex items-center gap-0.5 font-sans">
                                  <IconCheck size={10} /> Copied
                                </span>
                              ) : (
                                <span className="hover:underline font-sans">Copy</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-medium text-slate-700">
                          {formatSource(tx.source)}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-slate-700">
                          {formatPaymentMethod(tx.paymentMethod)}
                        </span>
                      </td>

                      {/* Amount (Directional & Numeric) */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-bold font-mono text-xs block ${
                            typeMeta.isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {typeMeta.isIncome ? '+' : '-'} PKR {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPosted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Posted
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                            title={tx.voidReason ? `Void Reason: ${tx.voidReason}` : 'Voided record'}
                          >
                            Voided
                          </span>
                        )}
                      </td>

                      {/* Operator Attribution */}
                      <td className="py-3.5 px-4">
                        <span
                          className="text-xs text-slate-700 block truncate max-w-[120px]"
                          title={operatorName}
                        >
                          {operatorName}
                        </span>
                      </td>

                      {/* Actions: View Details */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(tx);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer"
                          title="View authoritative transaction dossier"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : !listLoading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                        <IconLedger size={20} className="text-slate-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 text-xs">
                          {hasActiveFilters
                            ? 'No financial transactions match the current filters.'
                            : 'No financial transactions have been recorded yet.'}
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          {hasActiveFilters
                            ? 'Try adjusting your search query, date boundaries, or transaction type.'
                            : 'Income and expense entries will appear here once fee challans, payroll, or manual entries are processed.'}
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          <IconClose size={11} />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile Flat Divided List View (< 768px) */}
        <div className="block md:hidden divide-y divide-slate-100 bg-white">
          {listLoading && transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <IconLoader size={16} className="animate-spin text-[#185b9d]" />
              <span>Loading transactions...</span>
            </div>
          ) : transactions.length > 0 ? (
            transactions.map((tx) => {
              const typeMeta = getTypeMeta(tx.type);
              const isPosted = tx.status === 'POSTED';
              const operatorName = tx.createdByName || tx.createdByEmail || '—';

              return (
                <div
                  key={tx.id}
                  onClick={() => handleOpenDetail(tx)}
                  className="p-3.5 space-y-2 hover:bg-slate-50/70 transition cursor-pointer"
                >
                  {/* Top Row: Date & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 text-xs">
                      {formatDate(tx.transactionDate)}
                    </span>
                    {isPosted ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Posted
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Voided
                      </span>
                    )}
                  </div>

                  {/* Middle: Description & Reference */}
                  <div>
                    <p className="font-medium text-slate-900 text-xs leading-snug">
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                      {tx.referenceNumber && (
                        <span className="font-mono text-[10px] font-semibold text-[#185b9d] bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                          Ref: {tx.referenceNumber}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-slate-400">
                        {tx.id.slice(0, 10)}...
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row: Type • Source */}
                  <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeMeta.badgeClass}`}
                    >
                      {typeMeta.label}
                    </span>
                    <span>•</span>
                    <span className="text-[11px] font-medium text-slate-700">
                      Source: {formatSource(tx.source)}
                    </span>
                  </div>

                  {/* Secondary Metadata: Method • Operator */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                    <span>Method: {formatPaymentMethod(tx.paymentMethod)}</span>
                    <span>•</span>
                    <span>Operator: {operatorName}</span>
                  </div>

                  {/* Bottom: Directional Amount & View Action */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span
                      className={`font-bold font-mono text-sm ${
                        typeMeta.isIncome ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {typeMeta.isIncome ? '+' : '-'} PKR {formatCurrency(tx.amount)}
                    </span>
                    <span className="text-xs font-semibold text-[#185b9d] hover:underline">
                      View Details &rarr;
                    </span>
                  </div>
                </div>
              );
            })
          ) : !listLoading ? (
            <div className="p-6 text-center text-slate-500 space-y-2">
              <p className="font-semibold text-xs text-slate-800">
                {hasActiveFilters
                  ? 'No financial transactions match the current filters.'
                  : 'No financial transactions have been recorded yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Server Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-slate-900">{pagination.total}</strong> records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || listLoading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
                aria-label="Previous page"
              >
                <IconChevronLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || listLoading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
                aria-label="Next page"
              >
                <IconChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Manual Transaction Modal */}
      {isRecordModalOpen && (
        <TransactionFormModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onSuccess={(newTx) => {
            setFeedbackNotice({
              type: 'success',
              message: `Transaction recorded successfully (${newTx.type === 'OTHER_INCOME' ? '+' : '-'} PKR ${formatCurrency(newTx.amount)}).`,
            });
            fetchSummary();
            setPagination((prev) => ({ ...prev, page: 1 }));
            fetchTransactions(true);
          }}
        />
      )}

      {/* Transaction Detail Drawer */}
      {selectedTransactionId && (
        <TransactionDetailDrawer
          transactionId={selectedTransactionId}
          initialTransaction={selectedTransaction}
          canVoid={canVoid}
          onClose={() => {
            setSelectedTransactionId(null);
            setSelectedTransaction(null);
          }}
          onTransactionUpdated={(updatedTx) => {
            setTransactions((prev) =>
              prev.map((t) => (t.id === updatedTx.id ? updatedTx : t))
            );
            if (selectedTransaction?.id === updatedTx.id) {
              setSelectedTransaction(updatedTx);
            }
            fetchSummary();
          }}
        />
      )}
    </div>
  );
};
