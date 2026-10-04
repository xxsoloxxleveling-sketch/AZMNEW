import React, { useState, useEffect, useCallback } from 'react';
import {
  IconRefresh,
  IconAlertTriangle,
  IconChevronRight,
  IconFileText,
  IconLedger,
  IconLoader,
} from '../../common/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi } from '../../../lib/mockApi';
import { AdminTab } from '../layout/AdminSidebar';
import { useAuth } from '../../../lib/authContext';

interface DashboardViewProps {
  onNavigate: (tab: AdminTab) => void;
  onOpenAddStudent: () => void;
  onOpenMarkAttendance: () => void;
  onOpenGenerateFee: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAddStudent,
  onOpenMarkAttendance,
  onOpenGenerateFee,
}) => {
  const { isLoading: authLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (showLoading = true) => {
      if (authLoading) return;
      if (showLoading) setIsLoading(true);
      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const res = await mockApi.getDashboardOverview();
        if (res) {
          setData(res);
          setErrorMessage(null);
        }
      } catch (err: any) {
        console.warn('Dashboard fetch warning:', err);
        setErrorMessage(err?.message || 'Unable to connect to live database services.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [authLoading]
  );

  useEffect(() => {
    if (!authLoading) {
      loadDashboard(true);
    }

    const handleFocus = () => {
      if (!authLoading) loadDashboard(false);
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      if (!authLoading) loadDashboard(false);
    }, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [authLoading, loadDashboard]);

  // 1. Initial Data Loading State
  if (authLoading || (isLoading && !data && !errorMessage)) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <IconLoader size={28} className="text-[#185b9d]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Loading Executive Overview...
        </span>
      </div>
    );
  }

  // 2. Error State with Retry
  if (errorMessage && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <IconAlertTriangle size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">Unable to Load Dashboard Data</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {errorMessage}. Central database connection could not be established.
          </p>
        </div>
        <button
          onClick={() => loadDashboard(true)}
          className="px-4 py-2 rounded-lg bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-2xs"
        >
          <IconRefresh size={14} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats || {
    totalStudents: 0,
    totalPartners: 0,
    pendingPartners: 0,
    totalExpectedApplicants: 0,
    attendancePercentage: 0,
    feeCollectionPercentage: 0,
    activeStaffCount: 0,
    totalBilled: 0,
    totalCollected: 0,
    feeIncome: 0,
    salaryExpenses: 0,
    netCashFlow: 0,
  };

  const attendanceTrends = data.attendanceTrends || [];
  const feeDefaulters = data.feeDefaulters || [];
  const recentActivity = data.recentActivity || [];
  const demographics = data.demographics || {
    byGender: { MALE: 0, FEMALE: 0 },
    byClassLevel: {},
  };

  const totalGender =
    (demographics?.byGender?.MALE || 0) + (demographics?.byGender?.FEMALE || 0);
  const malePct = totalGender > 0 ? Math.round(((demographics?.byGender?.MALE || 0) / totalGender) * 100) : 0;
  const femalePct = totalGender > 0 ? 100 - malePct : 0;

  // Determine attendance session status honestly (Decision #2)
  const todayMarkedCount = data.attendanceToday?.markedCount || 0;
  const totalActiveStudents = data.attendanceToday?.totalActiveStudents || stats.totalStudents || 0;
  const hasTodaySession = todayMarkedCount > 0 || (stats.totalStudents > 0 && stats.attendancePercentage > 0);

  // Truthful Zero-State Semantics (Step 7.6)
  const hasBilledFees = (stats.totalBilled ?? 0) > 0;
  const hasPartnerInstitutions = (stats.totalPartners ?? 0) > 0;
  const hasActiveStaff = (stats.activeStaffCount ?? 0) > 0;
  const hasRegisteredStudents = (stats.totalStudents ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* 1. Core Administrative KPI Summary Surface (Unified Restrained Container) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        {/* Subtle Operational Header Bar */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Administrative Overview</span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-medium text-slate-500">Key Performance Indicators</span>
          </div>
          <button
            type="button"
            onClick={() => loadDashboard(false)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh metrics from central database"
          >
            <IconRefresh size={13} className={`text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>

        {/* Metric Cells with Restrained Dividers (Option A: 2-col on mobile with 5th spanning) */}
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {/* Cell 1: Registered Students */}
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="text-left p-3.5 sm:p-4 flex flex-col justify-between border-b lg:border-b-0 border-r border-slate-100 hover:bg-slate-50/60 focus-visible:bg-slate-50/80 transition cursor-pointer group"
            aria-label={`Navigate to Student Management. Total students: ${stats.totalStudents}`}
          >
            <div>
              <span className="text-xs font-medium text-slate-500 block">Registered Students</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1">
                {stats.totalStudents.toLocaleString()}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {hasRegisteredStudents ? 'Active Candidates' : 'No active candidates'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#185b9d] transition-colors">
                View →
              </span>
            </div>
          </button>

          {/* Cell 2: Partner Institutions */}
          <button
            type="button"
            onClick={() => onNavigate('partners')}
            className="text-left p-3.5 sm:p-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 hover:bg-slate-50/60 focus-visible:bg-slate-50/80 transition cursor-pointer group"
            aria-label={`Navigate to Partner Institutions. Total: ${stats.totalPartners ?? 0}`}
          >
            <div>
              <span className="text-xs font-medium text-slate-500 block">Partner Institutions</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1">
                {(stats.totalPartners ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {!hasPartnerInstitutions
                  ? 'No partner institutions'
                  : stats.pendingPartners > 0
                  ? `${stats.pendingPartners} Pending Review`
                  : 'Active Accredited'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#185b9d] transition-colors">
                View →
              </span>
            </div>
          </button>

          {/* Cell 3: Today's Attendance */}
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="text-left p-3.5 sm:p-4 flex flex-col justify-between border-b lg:border-b-0 border-r border-slate-100 hover:bg-slate-50/60 focus-visible:bg-slate-50/80 transition cursor-pointer group"
            aria-label="Navigate to Attendance Hub"
          >
            <div>
              <span className="text-xs font-medium text-slate-500 block">Today's Attendance</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1">
                {hasTodaySession ? `${stats.attendancePercentage}%` : '—'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {hasTodaySession ? `${todayMarkedCount} Marked Present` : 'No Session Conducted'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#185b9d] transition-colors">
                View →
              </span>
            </div>
          </button>

          {/* Cell 4: Fee Collection Rate */}
          <button
            type="button"
            onClick={() => onNavigate('fees')}
            className="text-left p-3.5 sm:p-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 hover:bg-slate-50/60 focus-visible:bg-slate-50/80 transition cursor-pointer group"
            aria-label="Navigate to Fee Management"
          >
            <div>
              <span className="text-xs font-medium text-slate-500 block">Fee Collection Rate</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1">
                {hasBilledFees ? `${stats.feeCollectionPercentage ?? 0}%` : '—'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {hasBilledFees
                  ? `PKR ${(stats.totalCollected ?? 0).toLocaleString()} Collected`
                  : 'No fees billed this cycle'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#185b9d] transition-colors">
                View →
              </span>
            </div>
          </button>

          {/* Cell 5: Active Faculty & Staff (Spans 2 cols on mobile) */}
          <button
            type="button"
            onClick={() => onNavigate('staff')}
            className="col-span-2 lg:col-span-1 text-left p-3.5 sm:p-4 flex flex-col justify-between hover:bg-slate-50/60 focus-visible:bg-slate-50/80 transition cursor-pointer group"
            aria-label={`Navigate to Staff Directory. Total: ${stats.activeStaffCount ?? 0}`}
          >
            <div>
              <span className="text-xs font-medium text-slate-500 block">Active Faculty & Staff</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums block mt-1">
                {(stats.activeStaffCount ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {hasActiveStaff ? 'Invigilators & Officers' : 'No active staff recorded'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-[#185b9d] transition-colors">
                View →
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Middle Operational Tier: Attendance Matrix + Financial Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Matrix (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Weekly Attendance Matrix</h3>
              <p className="text-xs text-slate-500">Daily verification status across all examination classes</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-[#185b9d] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Attendance Hub</span>
              <IconChevronRight size={14} />
            </button>
          </div>

          {/* Differentiated Weekly Visualization (Decision #2) */}
          <div className="py-2">
            <div className="h-28 flex items-end justify-between gap-3 pt-2">
              {attendanceTrends.map((bar: any, idx: number) => {
                const isToday = Boolean(bar.isToday);
                const hasSession = Boolean(bar.hasSession);
                const rate = bar.rate;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                      {hasSession && rate !== null ? `${rate}%` : ''}
                    </span>
                    <div className="w-full max-w-[42px] h-20 rounded-md overflow-hidden flex items-end justify-center">
                      {hasSession && rate !== null ? (
                        <div
                          style={{ height: `${Math.max(rate, 6)}%` }}
                          className={`w-full rounded-t-md transition-all duration-150 ${
                            isToday
                              ? 'bg-[#185b9d]'
                              : 'bg-slate-300 hover:bg-slate-400'
                          }`}
                        />
                      ) : (
                        <div className="w-full h-full rounded-md border border-dashed border-slate-200 bg-slate-50/70 flex items-center justify-center p-0.5">
                          <span className="text-[9px] text-slate-400 font-medium text-center leading-tight">
                            No Session
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? 'text-[#185b9d]' : 'text-slate-600'
                        }`}
                      >
                        {bar.day}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-bold text-[#185b9d] uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real Operational Attendance Summary (No Fake Metrics) */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <span>
              Today's Marked Check-ins:{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                {todayMarkedCount} students
              </strong>
            </span>
            <span>
              Total Candidate Roll:{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                {totalActiveStudents} students
              </strong>
            </span>
          </div>
        </div>

        {/* Monthly Financial Ledger Summary (1 Col - No Nested Cards) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Financial Ledger Summary</h3>
              <p className="text-xs text-slate-500">Current month collections & payroll</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 flex items-center justify-center">
              <IconLedger size={16} className="text-[#185b9d]" />
            </div>
          </div>

          {/* Clean Ledger Rows (No Card-in-Card Nesting) */}
          <div className="space-y-2.5 py-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Fee Income Collected</span>
              </div>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                PKR {(stats.feeIncome ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">Salary Disbursements</span>
              </div>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                PKR {(stats.salaryExpenses ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100/80 border border-slate-200">
              <span className="text-xs font-semibold text-slate-800">Net Operating Balance</span>
              <span
                className={`text-sm font-extrabold tabular-nums ${
                  (stats.netCashFlow ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                PKR {(stats.netCashFlow ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <button
              onClick={onOpenGenerateFee}
              className="w-full py-2 text-xs font-semibold text-center bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg shadow-2xs transition cursor-pointer"
            >
              Issue Monthly Fee Challans
            </button>
            <button
              onClick={() => onNavigate('transactions')}
              className="w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline block cursor-pointer"
            >
              View General Ledger →
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Operational Tier: Defaulters Table, Demographics, Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending Fee Defaulters Queue (Compact Table - Decision #3) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <IconAlertTriangle size={16} className="text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Pending Fee Defaulters</h3>
            </div>
            <button
              onClick={() => onNavigate('fees')}
              className="text-xs font-semibold text-[#185b9d] hover:underline cursor-pointer"
            >
              All Fees
            </button>
          </div>

          <div className="overflow-x-auto min-h-[160px]">
            {feeDefaulters.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-1.5 px-2">Student</th>
                    <th className="py-1.5 px-2">Class</th>
                    <th className="py-1.5 px-2 text-right">Due</th>
                    <th className="py-1.5 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeDefaulters.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-2">
                        <span className="font-semibold text-slate-900 block truncate max-w-[110px]">
                          {item.studentName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {item.rollNumber}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                        {item.currentClass}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-rose-700 tabular-nums whitespace-nowrap">
                        PKR {(item.amountDue ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => onNavigate('fees')}
                          className="text-[11px] font-semibold text-[#185b9d] hover:text-[#13497d] hover:bg-blue-50 px-2 py-0.5 rounded transition cursor-pointer"
                        >
                          Review Fees
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <IconFileText size={20} className="text-slate-300 mx-auto" />
                <p className="font-medium text-slate-600">No overdue fee accounts</p>
              </div>
            )}
          </div>
        </div>

        {/* Student Demographics Breakdown */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Student Demographics</h3>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs font-semibold text-[#185b9d] hover:underline cursor-pointer"
            >
              All Students
            </button>
          </div>

          {/* Gender Split */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Gender Split</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                M: {demographics?.byGender?.MALE || 0} ({malePct}%) | F:{' '}
                {demographics?.byGender?.FEMALE || 0} ({femalePct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 flex overflow-hidden">
              <div style={{ width: `${malePct}%` }} className="bg-[#185b9d]" />
              <div style={{ width: `${femalePct}%` }} className="bg-purple-500" />
            </div>
          </div>

          {/* Enrollment by Class Level */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Enrollment by Class
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {Object.keys(demographics?.byClassLevel || {}).length > 0 ? (
                Object.entries(demographics.byClassLevel).map(([className, count]: any, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-2 rounded-md bg-slate-50 text-xs"
                  >
                    <span className="font-medium text-slate-700">{className}</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {count} {count === 1 ? 'student' : 'students'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No class enrollment records yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* System Activity & Audit Trail */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recent Activity Log</h3>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-semibold text-[#185b9d] hover:underline cursor-pointer"
            >
              View Audit Log
            </button>
          </div>

          <div className="min-h-[140px]">
            {recentActivity.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-slate-100">
                {recentActivity.map((act: any) => (
                  <div key={act.id} className="pt-2 first:pt-0 flex items-start gap-2 text-xs">
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 w-10 mt-0.5">
                      {act.time}
                    </span>
                    <p className="text-slate-700 font-normal leading-snug flex-1">
                      {act.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <IconFileText size={20} className="text-slate-300 mx-auto" />
                <p className="font-medium text-slate-600">No recent audit events</p>
                <p className="text-[11px] text-slate-400">Administrative activity will appear here as operations occur.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
