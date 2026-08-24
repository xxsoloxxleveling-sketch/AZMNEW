import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  QrCode,
  GraduationCap,
  Filter,
  Eye,
  Download,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { AdminWalkInModal } from './AdminWalkInModal';
import { StudentDetailView } from './StudentDetailView';

export const StudentsListView: React.FC = () => {
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getStudents({
        classLevel: classFilter,
        status: statusFilter,
      });
      setStudents(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classFilter, statusFilter]);

  const handleStudentCreated = (newStudent: MockStudent) => {
    setStudents((prev) => [newStudent, ...prev]);
  };

  if (selectedStudent) {
    return (
      <StudentDetailView
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  const columns: Column<MockStudent>[] = [
    {
      header: 'Roll / App No',
      accessor: 'rollNumber',
      sortable: true,
      render: (row) => (
        <div>
          <span className={`font-bold block ${row.rollNumber ? 'text-[#185b9d]' : 'text-amber-600 text-xs'}`}>
            {row.rollNumber || 'Pending Fee Approval'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{row.applicationNo}</span>
        </div>
      ),
    },
    {
      header: 'Student Name',
      accessor: 'fullName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <img
            src={
              row.photoUrl ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
            }
            alt={row.fullName}
            className="w-9 h-9 rounded-xl object-cover border border-slate-200"
          />
          <div>
            <span className="font-bold text-slate-900 block">{row.fullName}</span>
            <span className="text-xs text-slate-400">S/D/O {row.fatherName}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Class & Level',
      accessor: 'currentClass',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block">{row.currentClass}</span>
          <span className="text-[11px] text-slate-400">{row.scholarshipCategory.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Fee Status',
      accessor: 'feeStatus',
      render: (row) => <StatusBadge status={row.feeStatus || 'UNPAID'} size="sm" />,
    },
    {
      header: 'Attendance %',
      accessor: 'attendancePercentage',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              style={{ width: `${row.attendancePercentage || 0}%` }}
              className={`h-full rounded-full ${
                (row.attendancePercentage || 0) >= 90
                  ? 'bg-emerald-500'
                  : (row.attendancePercentage || 0) >= 75
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
          </div>
          <span className="font-bold text-xs text-slate-700">
            {row.attendancePercentage || 0}%
          </span>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!row.rollNumber && (
            <button
              onClick={async () => {
                if (confirm(`Approve PKR 300 fee payment and issue Roll Number for ${row.fullName}?`)) {
                  try {
                    await mockApi.approveStudentPayment(row.id);
                    alert(`Payment approved for ${row.fullName}. Roll Number and Biometric QR Code assigned!`);
                    fetchStudents();
                  } catch (err: any) {
                    alert(err.message || 'Failed to approve payment');
                  }
                }
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              Approve Fee
            </button>
          )}
          <button
            onClick={() => setSelectedStudent(row)}
            title="View Full Profile"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#185b9d] transition"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => mockApi.downloadStudentPdf(row.id, row.rollNumber)}
            title="Download Registration PDF"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-[#185b9d] transition"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Table Component */}
      <DataTable
        columns={columns}
        data={students}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search by student name, roll number, or CNIC..."
        onRowClick={(row) => setSelectedStudent(row)}
        emptyTitle="No Students Enrolled"
        emptyMessage="Start by adding your first student walk-in registration or sync from online applications."
        actions={
          <button
            onClick={() => setIsWalkInOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        }
        filters={
          <div className="flex items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="ALL">All Classes</option>
              <option value="Class 8th">Class 8th</option>
              <option value="SSC-I">SSC-I (9th)</option>
              <option value="SSC-II">SSC-II (10th)</option>
              <option value="HSSC">HSSC (College)</option>
              <option value="BS">BS Degree</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d]"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        }
      />

      {/* Admin Walk-In Registration Modal */}
      <AdminWalkInModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        onSuccess={handleStudentCreated}
      />
    </div>
  );
};
