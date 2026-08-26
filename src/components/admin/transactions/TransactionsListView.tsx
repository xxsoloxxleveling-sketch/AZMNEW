import React, { useState, useEffect } from 'react';
import {
  History,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Filter,
  Receipt,
  Banknote,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatCard } from '../shared/StatCard';
import { mockApi, MockTransaction } from '../../../lib/mockApi';
import { useAuth } from '../../../lib/authContext';

export const TransactionsListView: React.FC = () => {
  const { isLoading: authLoading, role } = useAuth();
  const [transactions, setTransactions] = useState<MockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [transactionToDelete, setTransactionToDelete] = useState<MockTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTransactions = async (isManual = false) => {
    if (authLoading) return;
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await mockApi.getTransactions(typeFilter);
      setTransactions(data);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchTransactions();
    }
  }, [authLoading, typeFilter]);

  const handleConfirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      await mockApi.deleteTransaction(transactionToDelete.id);
      setTransactions((prev) => prev.filter((t) => t.id !== transactionToDelete.id));
      setTransactionToDelete(null);
      await fetchTransactions(true);
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalFeeIncome = transactions
    .filter((t) => t.type === 'FEE_INCOME')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSalaryExpenses = transactions
    .filter((t) => t.type === 'SALARY_EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalFeeIncome - totalSalaryExpenses;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FEE_INCOME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowDownRight className="w-3 h-3 text-emerald-500" />
            Fee Income
          </span>
        );
      case 'SALARY_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ArrowUpRight className="w-3 h-3 text-rose-500" />
            Salary Expense
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {type}
          </span>
        );
    }
  };

  const columns: Column<MockTransaction>[] = [
    {
      header: 'Transaction ID / Date',
      accessor: 'createdAt',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-800 block text-xs">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{row.id}</span>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => getTypeBadge(row.type),
    },
    {
      header: 'Description & Audit Reference',
      accessor: 'description',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium leading-relaxed block max-w-lg">
          {row.description}
        </span>
      ),
    },
    {
      header: 'Amount (PKR)',
      accessor: 'amount',
      sortable: true,
      render: (row) => (
        <span
          className={`font-bold text-sm ${
            row.type === 'FEE_INCOME' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {row.type === 'FEE_INCOME' ? '+' : '-'} PKR {row.amount.toLocaleString()}
        </span>
      ),
    },
    ...(role === 'SUPER_ADMIN'
      ? [
          {
            header: 'Actions',
            className: 'text-right',
            render: (row: MockTransaction) => (
              <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setTransactionToDelete(row)}
                  title="Delete Transaction (Super Admin Only)"
                  className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Fee Collections"
          value={`+ PKR ${totalFeeIncome.toLocaleString()}`}
          icon={Receipt}
          color="emerald"
          subtitle="Direct Student Receipts"
        />
        <StatCard
          title="Total Salary Disbursements"
          value={`- PKR ${totalSalaryExpenses.toLocaleString()}`}
          icon={Banknote}
          color="rose"
          subtitle="Staff Payroll Outflows"
        />
        <StatCard
          title="Net Cash Position"
          value={`PKR ${netCashFlow.toLocaleString()}`}
          icon={History}
          color={netCashFlow >= 0 ? 'blue' : 'rose'}
          subtitle="Current Term Balance"
        />
      </div>

      {/* Main Ledger Table */}
      <DataTable
        columns={columns}
        data={transactions}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search description or transaction ID..."
        emptyTitle="No General Ledger Transactions Found"
        emptyMessage="Income and expense transactions will appear here when fees and payroll are settled."
        actions={
          <button
            type="button"
            onClick={() => fetchTransactions(true)}
            disabled={isRefreshing}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#185b9d] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        }
        filters={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="FEE_INCOME">Fee Income Only (+)</option>
              <option value="SALARY_EXPENSE">Salary Expenses (-)</option>
            </select>
          </div>
        }
      />

      {/* Super Admin Delete Transaction Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Permanently Delete Transaction?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You are about to delete this ledger transaction. This will recalculate all fee totals, net cash flow, and financial overview metrics.
              </p>
            </div>

            {/* Transaction snapshot details */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Transaction ID:</span>
                <span className="font-mono font-bold text-slate-700">{transactionToDelete.id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Date:</span>
                <span className="font-semibold text-slate-700">{new Date(transactionToDelete.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Type:</span>
                <div>{getTypeBadge(transactionToDelete.type)}</div>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Amount:</span>
                <span className={`font-bold ${transactionToDelete.type === 'FEE_INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  PKR {transactionToDelete.amount.toLocaleString()}
                </span>
              </div>
              <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Description: </span>
                <span>{transactionToDelete.description}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-[11px] text-rose-800 font-semibold text-center">
              ⚠️ This action is restricted to Super Admin and cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTransactionToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTransaction}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Transaction</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
