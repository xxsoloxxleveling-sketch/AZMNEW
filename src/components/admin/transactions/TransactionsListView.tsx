import React, { useState, useEffect } from 'react';
import {
  History,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Filter,
  Receipt,
  Banknote,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatCard } from '../shared/StatCard';
import { mockApi, MockTransaction } from '../../../lib/mockApi';

export const TransactionsListView: React.FC = () => {
  const [transactions, setTransactions] = useState<MockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getTransactions(typeFilter);
      setTransactions(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter]);

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
    </div>
  );
};
