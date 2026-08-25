import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Play,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  CreditCard,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { StatCard } from '../shared/StatCard';
import { mockApi, MockPayrollRecord } from '../../../lib/mockApi';
import { RunPayrollModal } from './RunPayrollModal';
import { useAuth } from '../../../lib/authContext';

export const PayrollListView: React.FC = () => {
  const { isLoading: authLoading } = useAuth();
  const [payrollList, setPayrollList] = useState<MockPayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState('2026-08');

  const fetchPayroll = async () => {
    if (authLoading) return;
    setIsLoading(true);
    try {
      const data = await mockApi.getPayroll(monthFilter !== 'ALL' ? monthFilter : undefined);
      setPayrollList(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchPayroll();
    }
  }, [authLoading, monthFilter]);

  const handleMarkPaid = async (record: MockPayrollRecord) => {
    try {
      await mockApi.markPayrollPaid(record.id);
      alert(`Salary for ${record.staffName} marked as PAID. Posted to General Ledger as SALARY_EXPENSE.`);
      fetchPayroll();
    } catch (err: any) {
      alert(err.message || 'Failed to mark payroll paid');
    }
  };

  const totalLiability = payrollList.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payrollList.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = totalLiability - totalPaid;
  const disbursementRate = totalLiability > 0 ? parseFloat(((totalPaid / totalLiability) * 100).toFixed(1)) : 0;

  const columns: Column<MockPayrollRecord>[] = [
    {
      header: 'Staff Member',
      accessor: 'staffName',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.staffName}</span>
          <span className="text-xs text-[#185b9d] font-semibold">{row.role}</span>
        </div>
      ),
    },
    {
      header: 'Month',
      accessor: 'month',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-700">{row.month}</span>,
    },
    {
      header: 'Salary Amount',
      accessor: 'amount',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-900">PKR {row.amount.toLocaleString()}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Disbursement Date',
      accessor: 'paidAt',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          {row.status === 'PENDING' ? (
            <button
              onClick={() => handleMarkPaid(row)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            >
              Disburse Salary
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Disbursed
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Payroll Liability"
          value={`PKR ${totalLiability.toLocaleString()}`}
          icon={Banknote}
          color="blue"
          subtitle={`${payrollList.length} Staff Records`}
        />
        <StatCard
          title="Total Disbursed"
          value={`PKR ${totalPaid.toLocaleString()}`}
          icon={CreditCard}
          color="emerald"
          subtitle="Cleared from Bank"
          trend={`${disbursementRate}% Disbursed`}
          trendType="up"
        />
        <StatCard
          title="Pending Liabilities"
          value={`PKR ${totalPending.toLocaleString()}`}
          icon={Clock}
          color="amber"
          subtitle="Awaiting Clearance"
        />
        <StatCard
          title="Disbursement Rate"
          value={`${disbursementRate}%`}
          icon={TrendingUp}
          color="indigo"
          subtitle="Monthly Progress"
          trend="Live Rate"
          trendType="neutral"
        />
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={payrollList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search staff member by name or role..."
        emptyTitle="No Payroll Records Generated"
        emptyMessage="Run monthly payroll to generate salary vouchers for all active staff."
        actions={
          <button
            onClick={() => setIsRunModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Run Monthly Payroll</span>
          </button>
        }
        filters={
          <div className="flex items-center gap-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="2026-08">August 2026</option>
              <option value="2026-09">September 2026</option>
              <option value="ALL">All Months</option>
            </select>
          </div>
        }
      />

      {/* Run Payroll Modal */}
      <RunPayrollModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onSuccess={fetchPayroll}
      />
    </div>
  );
};
