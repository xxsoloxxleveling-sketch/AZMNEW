import React, { useState, useEffect, useCallback } from 'react';
import {
  IconRefresh,
  IconAlertTriangle,
  IconChevronRight,
  IconFileText,
  IconLedger,
  IconLoader,
} from '../../common/icons';
import { GraduationCap, CalendarCheck, Receipt, Users, QrCode, UserPlus, RefreshCw, School, Banknote, ArrowDownRight, ArrowUpRight, AlertTriangle, Clock } from 'lucide-react';
import { StatCard } from '../shared/StatCard';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi } from '../../../lib/mockApi';
import { AdminTab } from '../layout/AdminSidebar';
import { useAuth } from '../../../lib/authContext';

interface DashboardViewProps {
  onNavigate: (tab: AdminTab) => void;
  onOpenAddStudent: () => void;
  onOpenMarkAttendance?: () => void;
  onOpenGenerateFee?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAddStudent,
  onOpenMarkAttendance,
  onOpenGenerateFee,
}) => {
  const { isLoading: authLoading, role } = useAuth();
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

  const attendanceToday = data.attendanceToday;
  const hasTodaySession = (attendanceToday?.sessionCount || 0) > 0;
  const attendanceSubtitle = !hasTodaySession
    ? 'No Session'
    : attendanceToday.expectedCount === 0
      ? 'No Candidates Assigned'
      : `${attendanceToday.markedCount} Marked · ${attendanceToday.presentCount} Present`;

  // Truthful Zero-State Semantics (Step 7.6)
  const hasBilledFees = (stats.totalBilled ?? 0) > 0;
  const hasPartnerInstitutions = (stats.totalPartners ?? 0) > 0;
  const hasActiveStaff = (stats.activeStaffCount ?? 0) > 0;
  const hasRegisteredStudents = (stats.totalStudents ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action Launchpad */}
      <div className="bg-[#185b9d] rounded-xl p-6 sm:p-8 text-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome to AZMAIO Administration Desk
          </h2>
          <p className="text-xs text-blue-100/90 max-w-xl leading-relaxed">
            Student scholarship registry, partner institutions, staff records, and financial ledger.
          </p>
        </div>

        {/* Action Buttons in Hero */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            onClick={() => loadDashboard(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold backdrop-blur-xs border border-white/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh metrics from central database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
          </button>
          {onOpenMarkAttendance && (<button
            onClick={onOpenMarkAttendance}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>)}
          {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (<button
            onClick={onOpenAddStudent}
            className="px-4 py-2.5 bg-white text-[#185b9d] hover:bg-blue-50 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>)}
        </div>
      </div>

      {/* Core KPI cards, using current production data only. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 [&>div]:rounded-xl [&>button>div]:rounded-xl [&>div]:duration-150 [&>button>div]:duration-150">
        <button type="button" disabled={role === 'ACCOUNTANT'} onClick={() => onNavigate('students')} className="text-left min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-[#185b9d]">
          <StatCard title="Registered Students" value={stats.totalStudents ?? 0} icon={GraduationCap} subtitle={hasRegisteredStudents ? 'Active Candidates' : 'No active candidates'} />
        </button>
        <button type="button" disabled={role === 'ACCOUNTANT'} onClick={() => onNavigate('partners')} className="text-left min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-[#185b9d]">
          <StatCard title="Partner Institutions" value={stats.totalPartners ?? 0} icon={School} subtitle={`${stats.pendingPartners ?? 0} Pending Verification`} />
        </button>
        <StatCard title="Today's Attendance" value={hasTodaySession && attendanceToday.attendancePercentage !== null ? `${attendanceToday.attendancePercentage}%` : '—'} icon={CalendarCheck} color="emerald" subtitle={attendanceSubtitle} />
        <StatCard title="Fee Collection Rate" value={hasBilledFees ? `${stats.feeCollectionPercentage ?? 0}%` : '—'} icon={Receipt} subtitle={hasBilledFees ? `PKR ${(stats.totalCollected ?? 0).toLocaleString()} Collected` : 'No fees billed this cycle'} />
        <button type="button" onClick={() => onNavigate('staff')} className="text-left min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-[#185b9d]">
          <StatCard title="Active Staff & Faculty" value={stats.activeStaffCount ?? 0} icon={Users} subtitle={hasActiveStaff ? 'Teachers & Officers' : 'No active staff recorded'} />
        </button>
      </div>

      {/* 2. Middle Row: Attendance Trend + Financial Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Trends (Weekly)</h3>
              <p className="text-xs text-slate-400">Daily presence percentage across all active classes</p>
            </div>

          </div>

          {/* Differentiated Weekly Visualization (Decision #2) */}
          <div className="py-2">
            <div className="h-44 flex items-end justify-between gap-3 pt-2">
              {attendanceTrends.map((bar: any, idx: number) => {
                const isToday = Boolean(bar.isToday);
                const hasSession = Boolean(bar.hasSession);
                const rate = bar.rate;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                      {hasSession && rate !== null ? `${rate}%` : ''}
                    </span>
                    <div className="w-full max-w-[42px] h-36 rounded-md overflow-hidden flex items-end justify-center">
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
              Candidates Expected:{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                {attendanceToday?.expectedCount ?? '—'}
              </strong>
            </span>
            <span>
              Marked / Present / Late / Absent / Unmarked:{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                {attendanceToday?.markedCount ?? '—'} / {attendanceToday?.presentCount ?? '—'} / {attendanceToday?.lateCount ?? '—'} / {attendanceToday?.absentCount ?? '—'} / {attendanceToday?.unmarkedCount ?? '—'}
              </strong>
            </span>
          </div>
        </div>

        {/* Financial Flow Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Financial Cash Flow</h3>
              <p className="text-xs text-slate-400">Current Month Ledger Summary</p>
            </div>
            <span className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
              <Banknote className="w-4 h-4 text-[#185b9d]" />
            </span>
          </div>

          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-700 block">Fee Income Collected</span>
                <span className="text-lg font-bold text-emerald-950">PKR {(stats.feeIncome ?? 0).toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500 text-white">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-rose-700 block">Salary Disbursements</span>
                <span className="text-lg font-bold text-rose-950">PKR {(stats.salaryExpenses ?? 0).toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500 text-white">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Net Monthly Balance</span>
                <span className={`text-base font-extrabold ${(stats.netCashFlow ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  PKR {(stats.netCashFlow ?? 0).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => onNavigate('transactions')}
                className="text-xs font-bold text-[#185b9d] hover:underline"
              >
                Ledger →
              </button>
            </div>
          </div>

          {onOpenGenerateFee && (<button
            onClick={onOpenGenerateFee}
            className="w-full py-2.5 text-xs font-bold text-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition"
          >
            Generate Next Month Challans
          </button>)}
        </div>
      </div>

      {/* 3. Bottom Row: Demographics + Fee Defaulters + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Demographics Breakdown */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Student Demographics</h3>
            <button disabled={role === 'ACCOUNTANT'} onClick={() => onNavigate('students')} className="text-xs font-semibold text-[#185b9d] hover:underline">
              All Students
            </button>
          </div>

          {/* Gender Split */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Gender Distribution</span>
              <span className="font-bold text-slate-800">
                Male: {demographics?.byGender?.MALE || 0} | Female: {demographics?.byGender?.FEMALE || 0}
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 flex overflow-hidden">
              <div
                style={{
                  width: `${
                    ((demographics?.byGender?.MALE || 0) /
                      Math.max((demographics?.byGender?.MALE || 0) + (demographics?.byGender?.FEMALE || 0), 1)) *
                    100
                  }%`,
                }}
                className="bg-[#185b9d]"
              />
              <div
                style={{
                  width: `${
                    ((demographics?.byGender?.FEMALE || 0) /
                      Math.max((demographics?.byGender?.MALE || 0) + (demographics?.byGender?.FEMALE || 0), 1)) *
                    100
                  }%`,
                }}
                className="bg-purple-500"
              />
            </div>
          </div>

          {/* Class Breakdown List */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-slate-500 block">Enrollment by Class Level</span>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {Object.keys(demographics?.byClassLevel || {}).length === 0 && <p className="text-xs text-slate-500 py-3">No class enrollment records yet.</p>}
              {Object.entries(demographics?.byClassLevel || {}).map(([className, count]: any, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <span className="font-medium text-slate-700">{className}</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {count} {count === 1 ? 'student' : 'students'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fee Defaulters Alert Widget */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Pending Fee Defaulters</h3>
            </div>

          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {feeDefaulters.length > 0 ? (
              feeDefaulters.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.studentName}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.rollNumber} • {item.currentClass}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-rose-600">PKR {(item.amountDue ?? 0).toLocaleString()}</p>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No overdue fee challans.</p>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900">Recent Activity Feed</h3>
            </div>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {recentActivity.length === 0 && <p className="text-xs text-slate-500 py-8 text-center">No recent audit events.</p>}
            {recentActivity.map((act: any) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#185b9d] flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 font-medium leading-relaxed">{act.text}</p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
