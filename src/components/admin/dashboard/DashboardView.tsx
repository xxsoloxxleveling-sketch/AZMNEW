import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CalendarCheck,
  Receipt,
  Users,
  QrCode,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
  ChevronRight,
  UserPlus,
  Loader2,
  Sparkles,
  Banknote,
} from 'lucide-react';
import { StatCard } from '../shared/StatCard';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi } from '../../../lib/mockApi';
import { AdminTab } from '../layout/AdminSidebar';

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
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    mockApi.getDashboardOverview()
      .then((res) => {
        if (isMounted && res) {
          setData(res);
        }
      })
      .catch((err) => {
        console.warn('Dashboard fetch warning:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading || !data) {
    return (
      <div className="py-32 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#185b9d] animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Loading Overview Dashboard...
        </span>
      </div>
    );
  }

  const { stats, attendanceTrends, feeDefaulters, recentActivity, demographics } = data;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action Launchpad */}
      <div className="bg-gradient-to-r from-[#0f3863] via-[#185b9d] to-[#2563eb] rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-semibold text-blue-100 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Academic Session 2026-2027</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome to Jadoon PS Administration Desk
          </h2>
          <p className="text-xs text-blue-100/90 max-w-xl leading-relaxed">
            Real-time biometric attendance, automated fee collections, student scholarship registry, and institutional payroll ledger.
          </p>
        </div>

        {/* Action Buttons in Hero */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            onClick={onOpenMarkAttendance}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>
          <button
            onClick={onOpenAddStudent}
            className="px-4 py-2.5 bg-white text-[#185b9d] hover:bg-blue-50 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* 1. Four Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Total Registered Students"
          value={stats.totalStudents}
          icon={GraduationCap}
          color="blue"
          subtitle="Active Candidates"
          trend="+12% this month"
          trendType="up"
          onClick={() => onNavigate('students')}
        />
        <StatCard
          title="Today's Attendance Rate"
          value={`${stats.attendancePercentage}%`}
          icon={CalendarCheck}
          color="emerald"
          subtitle="Morning Scan Session"
          trend="Live Marked"
          trendType="neutral"
          onClick={() => onNavigate('attendance')}
        />
        <StatCard
          title="Fee Collection Rate"
          value={`${stats.feeCollectionPercentage}%`}
          icon={Receipt}
          color="indigo"
          subtitle={`PKR ${stats.totalCollected.toLocaleString()} Collected`}
          trend={`${stats.totalBilled ? 'PKR ' + stats.totalBilled.toLocaleString() : 'Total Due'}`}
          trendType="neutral"
          onClick={() => onNavigate('fees')}
        />
        <StatCard
          title="Active Staff & Faculty"
          value={stats.activeStaffCount}
          icon={Users}
          color="amber"
          subtitle="Teachers & Officers"
          trend="100% Active"
          trendType="up"
          onClick={() => onNavigate('staff')}
        />
      </div>

      {/* 2. Middle Row: Attendance Trend + Financial Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Trends (Weekly)</h3>
              <p className="text-xs text-slate-400">Daily presence percentage across all active classes</p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-semibold text-[#185b9d] hover:underline flex items-center gap-1"
            >
              <span>View Attendance Hub</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-6">
            <div className="h-44 flex items-end justify-between gap-3 pt-6">
              {attendanceTrends.map((bar: any, idx: number) => {
                const isToday = bar.day === 'Today';
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.rate}%
                    </span>
                    <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden h-36 flex items-end">
                      <div
                        style={{ height: `${bar.rate}%` }}
                        className={`w-full rounded-t-xl transition-all duration-500 ${
                          isToday
                            ? 'bg-gradient-to-t from-[#185b9d] to-[#2563eb] shadow-md shadow-blue-500/20'
                            : 'bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${isToday ? 'text-[#185b9d]' : 'text-slate-500'}`}>
                      {bar.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Average Attendance: <strong className="text-slate-800 font-bold">93.8%</strong></span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Above Target (+3.2%)</span>
            </span>
          </div>
        </div>

        {/* Financial Flow Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
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
                <span className="text-lg font-bold text-emerald-950">PKR {stats.feeIncome.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500 text-white">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-rose-700 block">Salary Disbursements</span>
                <span className="text-lg font-bold text-rose-950">PKR {stats.salaryExpenses.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500 text-white">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">Net Monthly Balance</span>
                <span className={`text-base font-extrabold ${stats.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  PKR {stats.netCashFlow.toLocaleString()}
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

          <button
            onClick={onOpenGenerateFee}
            className="w-full py-2.5 text-xs font-bold text-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition"
          >
            Generate Next Month Challans
          </button>
        </div>
      </div>

      {/* 3. Bottom Row: Demographics + Fee Defaulters + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Demographics Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Student Demographics</h3>
            <button onClick={() => onNavigate('students')} className="text-xs font-semibold text-[#185b9d] hover:underline">
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Pending Fee Defaulters</h3>
            </div>
            <button onClick={() => onNavigate('fees')} className="text-xs font-semibold text-[#185b9d] hover:underline">
              View All Fees
            </button>
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
                    <p className="font-bold text-rose-600">PKR {item.amountDue.toLocaleString()}</p>
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900">Recent Activity Feed</h3>
            </div>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {recentActivity.map((act: any) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#185b9d] flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                  <Sparkles className="w-3.5 h-3.5" />
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
