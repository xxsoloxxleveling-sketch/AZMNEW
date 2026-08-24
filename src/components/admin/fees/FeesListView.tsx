import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Banknote,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { StatCard } from '../shared/StatCard';
import { mockApi, MockFeeChallan, MockStudent } from '../../../lib/mockApi';
import { GenerateChallanModal } from './GenerateChallanModal';
import { MarkFeePaidModal } from './MarkFeePaidModal';

export const FeesListView: React.FC = () => {
  const [fees, setFees] = useState<MockFeeChallan[]>([]);
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedChallanToPay, setSelectedChallanToPay] = useState<MockFeeChallan | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [feeList, stList] = await Promise.all([
        mockApi.getFees({ month: monthFilter !== 'ALL' ? monthFilter : undefined, status: statusFilter }),
        mockApi.getStudents(),
      ]);
      setFees(feeList);
      setStudents(stList);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, monthFilter]);

  const totalBilled = fees.reduce((sum, f) => sum + (Number(f.amountDue) || 0), 0);
  const totalCollected = fees.reduce((sum, f) => sum + (Number(f.amountPaid) || 0), 0);
  const totalPending = totalBilled - totalCollected;
  const collectionRate = totalBilled > 0 ? parseFloat(((totalCollected / totalBilled) * 100).toFixed(1)) : 0;

  const columns: Column<MockFeeChallan>[] = [
    {
      header: 'Challan #',
      accessor: 'challanNumber',
      sortable: true,
      render: (row) => <span className="font-bold text-[#185b9d]">{row.challanNumber}</span>,
    },
    {
      header: 'Student Name',
      accessor: 'studentName',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.studentName}</span>
          <span className="text-xs text-slate-400">
            {row.rollNumber} • {row.currentClass}
          </span>
        </div>
      ),
    },
    {
      header: 'Fee Type / Month',
      accessor: 'month',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-700">{row.month}</span>,
    },
    {
      header: 'Amount Due',
      accessor: 'amountDue',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-900">PKR {(Number(row.amountDue) || 0).toLocaleString()}</span>,
    },
    {
      header: 'Amount Paid',
      accessor: 'amountPaid',
      sortable: true,
      render: (row) => (
        <span className={`font-bold ${row.amountPaid > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
          PKR {(Number(row.amountPaid) || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      sortable: true,
      render: (row) => <span className="text-xs text-slate-500 font-medium">{row.dueDate}</span>,
    },
    {
      header: 'Action',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {row.status !== 'PAID' ? (
            <button
              onClick={() => setSelectedChallanToPay(row)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            >
              Approve Payment
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Approved
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards at top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Billed"
          value={`PKR ${totalBilled.toLocaleString()}`}
          icon={Receipt}
          color="blue"
          subtitle={`${fees.length} Total Challans`}
        />
        <StatCard
          title="Total Collected"
          value={`PKR ${totalCollected.toLocaleString()}`}
          icon={Banknote}
          color="emerald"
          subtitle="Received in Accounts"
          trend={`${collectionRate}% Collected`}
          trendType="up"
        />
        <StatCard
          title="Pending / Overdue"
          value={`PKR ${totalPending.toLocaleString()}`}
          icon={AlertTriangle}
          color="rose"
          subtitle="Unsettled Balance"
        />
        <StatCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          icon={TrendingUp}
          color="indigo"
          subtitle="Current Term"
          trend="Live Rate"
          trendType="neutral"
        />
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={fees}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search challan number, student name, or roll number..."
        emptyTitle="No Fee Challans Found"
        emptyMessage="Generate your first fee challans using the button on the top right."
        actions={
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Challan</span>
          </button>
        }
        filters={
          <div className="flex items-center gap-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="ALL">All Fee Cycles</option>
              <option value="Session V (2026) Registration">Session V Registration (PKR 300)</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-09">September 2026</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="ALL">All Status</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
        }
      />

      {/* Modals */}
      <GenerateChallanModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onSuccess={fetchData}
        students={students}
      />

      <MarkFeePaidModal
        isOpen={!!selectedChallanToPay}
        onClose={() => setSelectedChallanToPay(null)}
        challan={selectedChallanToPay}
        onSuccess={fetchData}
      />
    </div>
  );
};
