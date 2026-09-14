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
  RefreshCw,
  Zap,
  CheckCircle2,
  Clock,
  Loader2,
  Ticket,
  MessageSquare,
  FileDown,
  FileText,
} from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { AdminWalkInModal } from './AdminWalkInModal';
import { StudentDetailView } from './StudentDetailView';
import { RollSlipPreviewModal } from './RollSlipPreviewModal';
import { StudentOmrModal } from './StudentOmrModal';
import { BulkPrintModal } from './BulkPrintModal';
import { useAuth } from '../../../lib/authContext';
import { apiFetchProtectedObjectUrl } from '../../../lib/apiClient';
import { getStudentWhatsAppContact, openWhatsAppInNewTab } from '../../../utils/whatsapp';

const STUDENTS_PER_PAGE = 10;

export const StudentsListView: React.FC = () => {
  const { role, isLoading: authLoading } = useAuth();
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<MockStudent | null>(null);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: STUDENTS_PER_PAGE, total: 0, totalPages: 1 });
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<MockStudent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rollStatus, setRollStatus] = useState<{ readyCount: number; issuedCount: number; totalPaidCount: number; scheduledDate?: string } | null>(null);
  const [showBatchRollModal, setShowBatchRollModal] = useState(false);
  const [isIssuingBatch, setIsIssuingBatch] = useState(false);

  // Pre-issue roll slips, OMR sheets, and batch printing state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [slipStudent, setSlipStudent] = useState<MockStudent | null>(null);
  const [omrStudent, setOmrStudent] = useState<MockStudent | null>(null);
  const [bulkPrintType, setBulkPrintType] = useState<'OMR' | 'ROLL_SLIP' | null>(null);

  const fetchStudents = async (showFullLoading = true) => {
    if (authLoading) return;
    if (showFullLoading && students.length === 0) setIsLoading(true);
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const [data, statusData] = await Promise.all([
        mockApi.getStudentsPage({
          classLevel: classFilter,
          gender: genderFilter,
          status: statusFilter,
          search: searchQuery,
          page: currentPage,
          limit: STUDENTS_PER_PAGE,
        }),
        mockApi.getRollNumberStatus().catch(() => null),
      ]);
      setStudents(Array.isArray(data.students) ? data.students : []);
      setPagination(data.pagination);
      if (statusData) setRollStatus(statusData);
    } catch (err: any) {
      console.warn('Students fetch error:', err);
      setErrorMessage(err?.message || 'Failed to retrieve students from live database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await mockApi.downloadStudentsListPdf(
        {
          classLevel: classFilter,
          gender: genderFilter,
          status: statusFilter,
          search: searchQuery,
        },
        students
      );
    } catch (err: any) {
      alert(err.message || 'Failed to generate and download filtered candidate roster PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchStudents(students.length === 0);
    }
  }, [authLoading, classFilter, genderFilter, statusFilter, searchQuery, currentPage]);

  useEffect(() => {
    const refresh = () => { void fetchStudents(); };
    window.addEventListener('students-updated', refresh);
    return () => window.removeEventListener('students-updated', refresh);
  }, [authLoading, classFilter, genderFilter, statusFilter, searchQuery, currentPage]);

  // Fetch private thumbnail files only for the ten rows currently displayed.
  // Probe visible rows even when legacy records have no document metadata.
  // Fallback gracefully from photoThumbnail to photo document if pending.
  useEffect(() => {
    let cancelled = false;
    const loadedUrls: string[] = [];

    const loadThumbnails = async () => {
      const results = await Promise.all(
        students
          .map(async (student) => {
            try {
              let url: string;
              try {
                url = await apiFetchProtectedObjectUrl(
                  `/api/students/${student.id}/document/photoThumbnail`
                );
              } catch {
                // Fallback to photo document if photoThumbnail is missing or pending generation
                url = await apiFetchProtectedObjectUrl(
                  `/api/students/${student.id}/document/photo`
                );
              }
              loadedUrls.push(url);
              return [student.id, url] as const;
            } catch {
              // Older records without any photo keep their initials.
              return null;
            }
          })
      );

      if (cancelled) {
        loadedUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setThumbnailUrls(Object.fromEntries(results.filter(Boolean) as [string, string][]));
    };

    void loadThumbnails();

    return () => {
      cancelled = true;
      loadedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [students]);

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
      header: '',
      className: 'w-10 text-center',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedStudentIds.includes(row.id)}
            onChange={() => {
              setSelectedStudentIds((prev) =>
                prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
              );
            }}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      ),
    },
    {
      header: 'Roll / App No',
      accessor: 'rollNumber',
      sortable: true,
      render: (row) => {
        const isOfficial = !!row.rollNumber && row.rollNumberStatus !== 'PROVISIONAL';
        const displayRoll = row.displayRollNumber || (row.rollNumber ? row.rollNumber : `PROV-${row.applicationNo}`);
        return (
          <div>
            {isOfficial ? (
              <span className="font-bold text-[#185b9d] block">{row.rollNumber}</span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-amber-700 text-xs font-mono">
                  {displayRoll}
                </span>
                <span className="px-1.5 py-0.2 rounded-sm text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300 tracking-wide uppercase">
                  Pre-Issue
                </span>
              </div>
            )}
            <span className="text-[11px] text-slate-400 font-mono">App #{row.applicationNo}</span>
          </div>
        );
      },
    },
    {
      header: 'Student Name',
      accessor: 'fullName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-black text-slate-500" aria-label={`${row.fullName} avatar`}>
            {thumbnailUrls[row.id] ? (
              <img
                src={thumbnailUrls[row.id]}
                alt={`${row.fullName} profile thumbnail`}
                className="h-full w-full object-cover"
              />
            ) : (
              row.fullName?.trim()?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
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
          <span className="text-[11px] text-slate-400">
            {(row.scholarshipCategory || 'GENERAL_MERIT').replace(/_/g, ' ')}
          </span>
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
      render: (row) => {
        const isPaid = row.feeStatus === 'PAID';
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isPaid
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-600' : 'bg-amber-600'}`} />
            {isPaid ? 'PKR 300 Paid' : 'Pending Fee'}
          </span>
        );
      },
    },
    {
      header: 'Attendance',
      accessor: 'attendancePercentage',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
                    await mockApi.approveStudentPayment(row.id);
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

          {/* WhatsApp Quick-Contact Button */}
          {(() => {
            const wa = getStudentWhatsAppContact(row);
            return (
              <button
                type="button"
                onClick={(e) => {
                  if (!wa.isDisabled && wa.url) {
                    openWhatsAppInNewTab(wa.url, e);
                  }
                }}
                disabled={wa.isDisabled}
                title={
                  wa.isDisabled
                    ? wa.disabledReason || 'No contact number on file'
                    : `Contact ${row.fullName} on WhatsApp (${wa.formattedPhone})`
                }
                className={`p-1.5 rounded-lg border transition ${
                  !wa.isDisabled
                    ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300 cursor-pointer shadow-2xs'
                    : 'border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            );
          })()}

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

          {/* Roll Slip Overview & Print Button - ALWAYS ENABLED */}
          <button
            onClick={() => setSlipStudent(row)}
            title={
              row.rollNumber
                ? 'Overview & Print Official Roll Slip'
                : 'Overview & Print Pre-Issue Roll Slip'
            }
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              row.rollNumber
                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Ticket className="w-4 h-4" />
          </button>

          {/* OMR Sheet Overview & Print Button */}
          <button
            onClick={() => setOmrStudent(row)}
            title="Overview & Print MCQs OMR Bubble Sheet (100 Questions)"
            className="p-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition cursor-pointer"
          >
            <FileText className="w-4 h-4" />
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
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchStudents(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Batch Printing Actions Bar (When multiple students are selected) */}
      {selectedStudentIds.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white text-xs font-black px-2.5 py-1 rounded-lg">
              {selectedStudentIds.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Candidates selected for batch printing
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkPrintType('OMR')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print OMR Sheets ({selectedStudentIds.length})</span>
            </button>

            <button
              onClick={() => setBulkPrintType('ROLL_SLIP')}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Print Roll Slips ({selectedStudentIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table Component */}
      <DataTable
        columns={columns}
        data={students}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search by student name, roll number, or CNIC..."
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
        onRowClick={(row) => setSelectedStudent(row)}
        emptyTitle="No Students Enrolled"
        emptyMessage="Start by adding your first student walk-in registration or sync from online applications."
        pageSize={STUDENTS_PER_PAGE}
        pagination={{
          page: pagination.page,
          total: pagination.total,
          totalPages: pagination.totalPages,
          onPageChange: setCurrentPage,
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const allCurrentIds = students.map((s) => s.id);
                const allSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedStudentIds.includes(id));
                if (allSelected) {
                  setSelectedStudentIds((prev) => prev.filter((id) => !allCurrentIds.includes(id)));
                } else {
                  setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...allCurrentIds])));
                }
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Select or deselect all candidates on the current page"
            >
              <span>
                {students.length > 0 && students.every((s) => selectedStudentIds.includes(s.id))
                  ? 'Deselect Page'
                  : 'Select Page'}
              </span>
            </button>

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
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer"
            >
              <option value="ALL">All Classes</option>
              <option value="6th">Class 6th</option>
              <option value="7th">Class 7th</option>
              <option value="8th">Class 8th</option>
              <option value="9th">Class 9th (SSC-I)</option>
              <option value="10th">Class 10th (SSC-II)</option>
              <option value="1st Year">1st Year (HSSC-I)</option>
              <option value="2nd Year">2nd Year (HSSC-II)</option>
              <option value="BS">BS / Undergraduate</option>
            </select>

            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer"
            >
              <option value="ALL">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download clean printable candidate roster PDF matching your current search and filters"
            >
              <FileDown className="w-3.5 h-3.5 text-[#185b9d]" />
              <span>{isExportingPdf ? 'Exporting PDF...' : 'Export List PDF'}</span>
            </button>
          </div>
        }
      />

      {/* Admin Walk-In Registration Modal */}
      {isWalkInOpen && (
        <AdminWalkInModal
          isOpen={isWalkInOpen}
          onClose={() => setIsWalkInOpen(false)}
          onSuccess={(newStudent) => {
            setIsWalkInOpen(false);
            fetchStudents();
            setSelectedStudent(newStudent);
          }}
        />
      )}

      {/* Roll Slip Overview & Print Modal (Candidate Single Pass) */}
      <RollSlipPreviewModal
        student={slipStudent}
        isOpen={!!slipStudent}
        onClose={() => setSlipStudent(null)}
      />

      {/* MCQs OMR Bubble Sheet Modal (100 Questions) */}
      <StudentOmrModal
        student={omrStudent}
        isOpen={!!omrStudent}
        onClose={() => setOmrStudent(null)}
      />

      {/* Bulk Print Modal (Selected Candidates) */}
      <BulkPrintModal
        students={students.filter((s) => selectedStudentIds.includes(s.id))}
        type={bulkPrintType || 'OMR'}
        isOpen={!!bulkPrintType}
        onClose={() => setBulkPrintType(null)}
      />

      {/* Confirm Student Delete Modal (Super Admin Only) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Delete Candidate Record?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-800">{studentToDelete.fullName}</strong> (
                {studentToDelete.rollNumber || studentToDelete.applicationNo}) from the database? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Issue Roll Numbers Modal */}
      {showBatchRollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Batch Issue Roll Numbers</h3>
                <p className="text-xs text-slate-500">Official sequential roll number assignment</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl space-y-1.5">
                <div className="flex justify-between font-bold text-emerald-900">
                  <span>Candidates with Paid Verification:</span>
                  <span>{rollStatus?.totalPaidCount ?? 0}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Already Issued Roll Numbers:</span>
                  <span>{rollStatus?.issuedCount ?? 0}</span>
                </div>
                <div className="flex justify-between font-black text-emerald-950 text-sm pt-1 border-t border-emerald-200">
                  <span>Ready for Batch Issuance Now:</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md font-mono">
                    {rollStatus?.readyCount ?? 0}
                  </span>
                </div>
              </div>

              {rollStatus && rollStatus.scheduledDate && (
                <div className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-blue-800">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Scheduled Batch Issuance Date: <strong>{new Date(rollStatus.scheduledDate).toLocaleDateString()}</strong></span>
                </div>
              )}

              <p className="text-slate-500 leading-relaxed">
                Issuing will assign permanent canonical roll numbers in the sequence <code>AZMVS-2026-XXXX</code>, generate secure QR codes, and lock official examination admittance.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchRollModal(false)}
                disabled={isIssuingBatch}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isIssuingBatch || !rollStatus || rollStatus.readyCount === 0}
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
