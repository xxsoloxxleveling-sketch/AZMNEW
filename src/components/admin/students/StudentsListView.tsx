import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  QrCode,
  GraduationCap,
  Filter,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { AdminWalkInModal } from './AdminWalkInModal';
import { StudentDetailView } from './StudentDetailView';
import { useAuth } from '../../../lib/authContext';

export const StudentsListView: React.FC = () => {
  const { role } = useAuth();
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [studentToDelete, setStudentToDelete] = useState<MockStudent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await mockApi.deleteStudent(studentToDelete.id);
      setStudentToDelete(null);
      await fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (selectedStudent) {
    return (
      <StudentDetailView
        student={selectedStudent}
        onBack={() => {
          setSelectedStudent(null);
          fetchStudents();
        }}
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
          {row.rollNumber ? (
            <span className="font-bold text-[#185b9d] block">{row.rollNumber}</span>
          ) : row.feeStatus === 'PAID' ? (
            <span className="font-bold text-sky-700 text-xs block">Roll No. Scheduled</span>
          ) : (
            <span className="font-bold text-amber-600 text-xs block">Fee Pending</span>
          )}
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
          {row.feeStatus !== 'PAID' && (
            <button
              onClick={async () => {
                if (confirm(`Approve PKR 300 fee payment for ${row.fullName}?`)) {
                  try {
                    setStudents((prev) =>
                      prev.map((s) => (s.id === row.id ? { ...s, feeStatus: 'PAID' } : s))
                    );
                    await mockApi.approveStudentPayment(row.id, row);
                    alert(`Fee payment approved for ${row.fullName}. Status updated to PAID.`);
                    fetchStudents();
                  } catch (err: any) {
                    alert(err.message || 'Failed to approve payment');
                    fetchStudents();
                  }
                }
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              Approve Fee
            </button>
          )}

          <button
            onClick={() => setSelectedStudent(row)}
            title="View Full Profile"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#185b9d] transition cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => mockApi.downloadStudentPdf(row.id, row.rollNumber)}
            title="Download Registration PDF"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-[#185b9d] transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          {role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setStudentToDelete(row)}
              title="Delete Candidate (Super Admin Only)"
              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
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

      {/* Super Admin Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">
                Permanently Delete Candidate?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You are about to permanently delete <strong className="text-slate-800">{studentToDelete.fullName}</strong> (
                <span className="font-mono text-slate-700">{studentToDelete.applicationNo || studentToDelete.id}</span>). This will remove all registration records, fee receipts, and uploaded document attachments.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-[11px] text-rose-800 font-semibold text-center">
              ⚠️ This action is restricted to Super Admin and cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Candidate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

