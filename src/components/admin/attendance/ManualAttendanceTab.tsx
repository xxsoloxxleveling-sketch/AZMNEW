import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStudent, MockAttendance } from '../../../lib/mockApi';

export const ManualAttendanceTab: React.FC = () => {
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [todayData, setTodayData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [statusToMark, setStatusToMark] = useState<'PRESENT' | 'LATE' | 'ABSENT'>('PRESENT');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stList, attData] = await Promise.all([
        mockApi.getStudents(),
        mockApi.getTodayAttendance(),
      ]);
      setStudents(stList);
      setTodayData(attData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMarkManual = async (student: MockStudent, status: 'PRESENT' | 'LATE' | 'ABSENT') => {
    try {
      await mockApi.scanAttendance({
        studentId: student.id,
        status,
      });
      alert(`Attendance for ${student.fullName} recorded as ${status}.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to mark attendance');
    }
  };

  const columns: Column<MockAttendance>[] = [
    {
      header: 'Student Name',
      accessor: 'studentName',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.studentName}</span>
          <span className="text-xs text-slate-400">Roll No: {row.rollNumber}</span>
        </div>
      ),
    },
    {
      header: 'Class',
      accessor: 'currentClass',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-800">{row.currentClass}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Method',
      accessor: 'method',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600">
          {row.method}
        </span>
      ),
    },
    {
      header: 'Time Marked',
      accessor: 'createdAt',
      render: (row) => (
        <span className="text-xs text-slate-500 font-medium">
          {new Date(row.createdAt).toLocaleTimeString()}
        </span>
      ),
    },
    {
      header: 'Examiner / Officer',
      accessor: 'markedByName',
      render: (row) => <span className="text-xs text-slate-700 font-semibold">{row.markedByName}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Search & Manual Marker Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Manual Search & Attendance Entry</h3>
          <p className="text-xs text-slate-400">For students who misplaced their physical QR token slips</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <select
              value={selectedStudent?.id || ''}
              onChange={(e) => {
                const s = students.find((st) => st.id === e.target.value);
                setSelectedStudent(s || null);
              }}
              className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
            >
              <option value="">-- Select Active Student by Roll Number or Name --</option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.rollNumber} - {st.fullName} ({st.currentClass})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => selectedStudent && handleMarkManual(selectedStudent, 'PRESENT')}
              disabled={!selectedStudent}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-40"
            >
              Present
            </button>
            <button
              onClick={() => selectedStudent && handleMarkManual(selectedStudent, 'LATE')}
              disabled={!selectedStudent}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-40"
            >
              Late
            </button>
            <button
              onClick={() => selectedStudent && handleMarkManual(selectedStudent, 'ABSENT')}
              disabled={!selectedStudent}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-40"
            >
              Absent
            </button>
          </div>
        </div>
      </div>

      {/* Today's Log Table */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-slate-900">Today's Attendance Registry Log</h3>
          <span className="text-xs text-slate-500 font-semibold">
            Date: {todayData?.date || new Date().toISOString().split('T')[0]}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={todayData?.records || []}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          searchPlaceholder="Search today's marked attendance..."
          emptyTitle="No attendance marked today yet"
          emptyMessage="Use the QR Scanner or manual entry above to record morning attendance."
        />
      </div>
    </div>
  );
};
