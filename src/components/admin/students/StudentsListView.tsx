import {
  UserPlus,
  QrCode,
  GraduationCap,
  Filter,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Zap,
  CheckCircle2,
  Clock,
  Loader2,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [studentToDelete, setStudentToDelete] = useState<MockStudent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rollStatus, setRollStatus] = useState<{ readyCount: number; issuedCount: number; totalPaidCount: number; scheduledDate?: string } | null>(null);
  const [showBatchRollModal, setShowBatchRollModal] = useState(false);
  const [isIssuingBatch, setIsIssuingBatch] = useState(false);

  const fetchStudents = async (showFullLoading = true) => {
    if (showFullLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const [data, statusData] = await Promise.all([
        mockApi.getStudents({
          classLevel: classFilter,
          status: statusFilter,
        }),
        mockApi.getRollNumberStatus().catch(() => null),
      ]);
      setStudents(data);
      if (statusData) setRollStatus(statusData);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    // Auto-refresh when tab gains focus or every 10 seconds for real-time registration sync
    const handleFocus = () => fetchStudents(false);
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => fetchStudents(false), 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStudents(true)}
              disabled={isRefreshing}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Fetch latest student registrations from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#185b9d] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
              <button
                onClick={() => setShowBatchRollModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                title="Batch assign roll numbers and QR codes to paid candidates"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Issue Roll Numbers</span>
                {rollStatus && rollStatus.readyCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white text-emerald-800 ml-0.5">
                    {rollStatus.readyCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setIsWalkInOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          </div>
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
      {/* Super Admin / Admin Batch Roll Number Issuance Modal */}
      {showBatchRollModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Batch Roll Number Issuance
                </h3>
                <p className="text-xs text-slate-500">
                  Automated sequential roll number and biometric QR code generation.
                </p>
              </div>
            </div>

            {/* Issuance Statistics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Ready to Roll</span>
                <span className="text-2xl font-black text-emerald-900 block mt-0.5">
                  {rollStatus?.readyCount || 0}
                </span>
                <span className="text-[10px] text-emerald-700 block">Fee Paid, No Roll No</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-[#185b9d] uppercase tracking-wider block">Already Issued</span>
                <span className="text-2xl font-black text-blue-900 block mt-0.5">
                  {rollStatus?.issuedCount || 0}
                </span>
                <span className="text-[10px] text-blue-700 block">Roll Number Active</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Total Verified</span>
                <span className="text-2xl font-black text-slate-900 block mt-0.5">
                  {rollStatus?.totalPaidCount || 0}
                </span>
                <span className="text-[10px] text-slate-500 block">Fee Status PAID</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Clock className="w-4 h-4 text-[#185b9d]" />
                <span>Scheduled Release Schedule:</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Official slips are published on <strong>{rollStatus?.scheduledDate || 'Sunday, 25 October 2026'}</strong>. Issuing roll numbers now will assign AZMVS-2026-XXXX sequence numbers and create biometric QR matrices in Supabase Storage.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchRollModal(false)}
                disabled={isIssuingBatch}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isIssuingBatch || (rollStatus?.readyCount === 0)}
                onClick={async () => {
                  setIsIssuingBatch(true);
                  try {
                    const res = await mockApi.issueRollNumbers();
                    alert(res.message || `Successfully issued roll numbers to ${res.count} candidate(s)!`);
                    setShowBatchRollModal(false);
                    await fetchStudents();
                  } catch (err: any) {
                    alert(err.message || 'Failed to issue roll numbers.');
                  } finally {
                    setIsIssuingBatch(false);
                  }
                }}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isIssuingBatch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Batch Issuance...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>
                      {rollStatus && rollStatus.readyCount > 0
                        ? `Issue Roll Numbers to ${rollStatus.readyCount} Candidate(s)`
                        : 'No Pending Candidates'}
                    </span>
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

