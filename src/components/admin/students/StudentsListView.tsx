import React, { useState, useEffect, useMemo } from 'react';
import {
  Search as IconSearch,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  ChevronsUpDown as IconChevronsUpDown,
  AlertTriangle as IconAlertTriangle,
  RefreshCw as IconRefresh,
  Zap as IconZap,
  Clock as IconClock,
  Loader2 as IconLoader,
  MessageSquare as IconMessageSquare,
  FileText as IconFileText,
  MoreHorizontal as IconMoreHorizontal,
  Printer as IconPrintSlip,
  Download as IconDownloadSlip,
  Pencil as IconEditStudent,
  Trash2 as IconDeleteCandidate,
  CheckCircle2 as IconApproveFee,
} from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStudent, StudentDeletionProtection } from '../../../lib/mockApi';
import { AttendanceDialog, attendanceSecondary } from '../attendance/AttendanceDialog';
import { AdminWalkInModal } from './AdminWalkInModal';
import { StudentDetailView } from './StudentDetailView';
import { RollSlipPreviewModal } from './RollSlipPreviewModal';
import { StudentOmrModal } from './StudentOmrModal';
import { BulkPrintModal } from './BulkPrintModal';
import { useAuth } from '../../../lib/authContext';
import { apiFetchProtectedObjectUrl } from '../../../lib/apiClient';
import { getStudentWhatsAppContact, openWhatsAppInNewTab } from '../../../utils/whatsapp';

const DEFAULT_STUDENTS_PER_PAGE = 10;
const STUDENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 250] as const;

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
  const [pageSize, setPageSize] = useState(DEFAULT_STUDENTS_PER_PAGE);
  const compactListMode = pageSize > 20;
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_STUDENTS_PER_PAGE, total: 0, totalPages: 1 });
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingSelectedPdf, setIsExportingSelectedPdf] = useState(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState(false);
  const [pdfExportElapsedSeconds, setPdfExportElapsedSeconds] = useState(0);
  const anyPdfExporting = isExportingPdf || isExportingSelectedPdf || isExportingAllPdf;
  const elapsedPdfLabel = `${String(Math.floor(pdfExportElapsedSeconds / 60)).padStart(2, '0')}:${String(pdfExportElapsedSeconds % 60).padStart(2, '0')}`;
  const [studentToDelete, setStudentToDelete] = useState<MockStudent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionProtection, setDeletionProtection] = useState<StudentDeletionProtection | null>(null);
  const [deletionError, setDeletionError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setDeletionProtection(null); setDeletionError('');
    if (studentToDelete) mockApi.getStudentDeletionProtection(studentToDelete.id)
      .then(result => { if (!cancelled) setDeletionProtection(result); })
      .catch(error => { if (!cancelled) setDeletionError(error.message || 'Could not check protected records.'); });
    return () => { cancelled = true; };
  }, [studentToDelete]);
  const [rollStatus, setRollStatus] = useState<{ readyCount: number; issuedCount: number; totalPaidCount: number; scheduledDate?: string } | null>(null);
  const [showBatchRollModal, setShowBatchRollModal] = useState(false);
  const [isIssuingBatch, setIsIssuingBatch] = useState(false);
  const [isApprovingSelectedFees, setIsApprovingSelectedFees] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<'rollNumber' | 'fullName' | 'currentClass' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Pre-issue roll slips, OMR sheets, and batch printing state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [slipStudent, setSlipStudent] = useState<MockStudent | null>(null);
  const [omrStudent, setOmrStudent] = useState<MockStudent | null>(null);
  const [bulkPrintType, setBulkPrintType] = useState<'OMR' | 'ROLL_SLIP' | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<MockStudent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Row action menu dropdown tracking
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Close active action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeActionMenuId && !(e.target as Element).closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionMenuId]);

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
          limit: pageSize,
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
    if (anyPdfExporting) return;
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

  const handleExportAllPdf = async () => {
    if (anyPdfExporting) return;
    setIsExportingAllPdf(true);
    try {
      await mockApi.downloadAllStudentsListPdf();
    } catch (err: any) {
      alert(err.message || 'Failed to generate the complete student directory PDF.');
    } finally {
      setIsExportingAllPdf(false);
    }
  };

  // A selected export is different from the filtered roster export: only IDs
  // belonging to currently visible, checked rows are sent to the server.
  const handleExportSelectedPdf = async () => {
    if (anyPdfExporting) return;
    const selectedIds = students
      .filter((student) => selectedStudentIds.includes(student.id))
      .map((student) => student.id);
    if (selectedIds.length === 0) {
      alert('Select at least one student on this page to export.');
      return;
    }
    setIsExportingSelectedPdf(true);
    try {
      await mockApi.downloadSelectedStudentsListPdf(selectedIds);
    } catch (err: any) {
      alert(err.message || 'Failed to generate the PDF for selected students.');
    } finally {
      setIsExportingSelectedPdf(false);
    }
  };

  // Show truthful elapsed time while exporting, not an ungrounded completion ETA.
  useEffect(() => {
    if (!anyPdfExporting) {
      setPdfExportElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    setPdfExportElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setPdfExportElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [anyPdfExporting]);

  useEffect(() => {
    if (!authLoading) {
      fetchStudents(students.length === 0);
    }
  }, [authLoading, classFilter, genderFilter, statusFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    const refresh = () => { void fetchStudents(); };
    window.addEventListener('students-updated', refresh);
    return () => window.removeEventListener('students-updated', refresh);
  }, [authLoading, classFilter, genderFilter, statusFilter, searchQuery, currentPage, pageSize]);

  // Batch actions intentionally apply only to the visible result set.
  // Reset selection whenever paging or filters change so hidden candidates are never approved accidentally.
  useEffect(() => {
    setSelectedStudentIds([]);
  }, [classFilter, genderFilter, statusFilter, searchQuery, currentPage, pageSize]);

  // Fetch thumbnails only for smaller pages. Large page sizes use compact list mode
  // to avoid dozens/hundreds of protected image requests and object URLs.
  useEffect(() => {
    let cancelled = false;
    const loadedUrls: string[] = [];

    if (compactListMode) {
      setThumbnailUrls({});
      return () => {
        cancelled = true;
      };
    }

    const loadThumbnails = async () => {
      const results = await Promise.all(
        students.map(async (student) => {
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
  }, [students, compactListMode]);

  const handleConfirmDelete = async () => {
    if (!studentToDelete || !deletionProtection?.canPermanentlyDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await mockApi.deleteStudent(studentToDelete.id);
      setStudentToDelete(null);
      await fetchStudents();
    } catch (err: any) {
      setDeletionError(err.message || 'Failed to delete student.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivateCandidate = async () => {
    if (!studentToDelete || !deletionProtection?.canDeactivate || isDeleting) return;
    setIsDeleting(true); setDeletionError('');
    try {
      await mockApi.updateStudent(studentToDelete.id, { status: 'INACTIVE' });
      setStudentToDelete(null);
      await fetchStudents();
    } catch (error: any) {
      setDeletionError(error.message || 'Could not deactivate candidate.');
    } finally { setIsDeleting(false); }
  };

  const handleSort = (field: 'rollNumber' | 'fullName' | 'currentClass') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedStudents = useMemo(() => {
    if (!sortField) return students;
    return [...students].sort((a, b) => {
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [students, sortField, sortAsc]);

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

  const allCurrentIds = students.map((s) => s.id);
  const allCurrentSelected = allCurrentIds.length > 0 && allCurrentIds.every((id) => selectedStudentIds.includes(id));
  const canApproveFees = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const selectedUnpaidStudents = students.filter(
    (student) => selectedStudentIds.includes(student.id) && student.feeStatus !== 'PAID'
  );

  const handleApproveSelectedFees = async () => {
    if (!canApproveFees || selectedUnpaidStudents.length === 0 || isApprovingSelectedFees) return;

    const selectedForApproval = [...selectedUnpaidStudents];
    const totalAmount = selectedForApproval.length * 300;
    const confirmed = confirm(
      `Approve PKR ${totalAmount.toLocaleString()} in registration fees for ${selectedForApproval.length} selected candidate(s)?`
    );
    if (!confirmed) return;

    setIsApprovingSelectedFees(true);
    const succeededIds: string[] = [];
    const failures: Array<{ name: string; message: string }> = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < selectedForApproval.length) {
        const student = selectedForApproval[nextIndex++];
        try {
          await mockApi.approveStudentPayment(student.id);
          succeededIds.push(student.id);
        } catch (err: any) {
          failures.push({
            name: student.fullName,
            message: err?.message || 'Fee approval failed',
          });
        }
      }
    };

    try {
      const workerCount = Math.min(5, selectedForApproval.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (succeededIds.length > 0) {
        setSelectedStudentIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
      }

      await fetchStudents(false);

      if (failures.length === 0) {
        alert(`Successfully approved fees for ${succeededIds.length} candidate(s).`);
      } else {
        const preview = failures
          .slice(0, 3)
          .map((failure) => `${failure.name}: ${failure.message}`)
          .join('\n');
        const more = failures.length > 3 ? `\n…and ${failures.length - 3} more failure(s).` : '';
        alert(
          `Approved ${succeededIds.length} candidate(s). ${failures.length} failed.\n\n${preview}${more}`
        );
      }
    } finally {
      setIsApprovingSelectedFees(false);
    }
  };

  const toggleSelectAllCurrent = () => {
    if (allCurrentSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !allCurrentIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...allCurrentIds])));
    }
  };

  const renderActionMenu = (student: MockStudent, isUpward = false) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute right-0 ${isUpward ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100`}
    >
      {/* Approve Fee - SUPER_ADMIN, ADMIN, ACCOUNTANT */}
      {student.feeStatus !== 'PAID' && (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT') && (
        <button
          type="button"
          onClick={async () => {
            setActiveActionMenuId(null);
            if (confirm(`Approve PKR 300 fee payment for ${student.fullName}?`)) {
              try {
                setStudents((prev) =>
                  prev.map((s) => (s.id === student.id ? { ...s, feeStatus: 'PAID' } : s))
                );
                await mockApi.approveStudentPayment(student.id);
                alert(`Fee payment approved for ${student.fullName}. Status updated to PAID.`);
                fetchStudents();
              } catch (err: any) {
                alert(err.message || 'Failed to approve payment');
                fetchStudents();
              }
            }
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 font-medium flex items-center gap-2 transition cursor-pointer"
        >
          <IconApproveFee size={14} className="text-emerald-600" />
          <span>Approve Fee (PKR 300)</span>
        </button>
      )}

      {/* Edit Student - SUPER_ADMIN, ADMIN */}
      {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
        <button
          type="button"
          onClick={() => {
            setActiveActionMenuId(null);
            setStudentToEdit(student);
            setIsEditModalOpen(true);
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
        >
          <IconEditStudent size={14} className="text-slate-500" />
          <span>Edit Student</span>
        </button>
      )}

      {/* Print Roll Slip - SUPER_ADMIN, ADMIN */}
      {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
        <button
          type="button"
          onClick={() => {
            setActiveActionMenuId(null);
            setSlipStudent(student);
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
        >
          <IconPrintSlip size={14} className="text-slate-500" />
          <span>{student.rollNumber ? 'Print Official Slip' : 'Print Pre-Issue Slip'}</span>
        </button>
      )}

      {/* Print OMR Sheet - SUPER_ADMIN, ADMIN */}
      {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
        <button
          type="button"
          onClick={() => {
            setActiveActionMenuId(null);
            setOmrStudent(student);
          }}
          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
        >
          <IconFileText size={14} className="text-slate-500" />
          <span>Print OMR Bubble Sheet</span>
        </button>
      )}

      {/* Download Registration PDF - All staff */}
      <button
        type="button"
        onClick={() => {
          setActiveActionMenuId(null);
          mockApi.downloadStudentPdf(student.id, student.rollNumber);
        }}
        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
      >
        <IconDownloadSlip size={14} className="text-slate-500" />
        <span>Download PDF</span>
      </button>

      {/* Delete Candidate - Strictly SUPER_ADMIN only */}
      {role === 'SUPER_ADMIN' && (
        <>
          <div className="border-t border-slate-100 my-1" />
          <button
            type="button"
            onClick={() => {
              setActiveActionMenuId(null);
              setStudentToDelete(student);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <IconDeleteCandidate size={14} className="text-rose-600" />
            <span>Delete Candidate</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold">{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchStudents(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <IconRefresh size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Roster Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Toolbar: Search, Filters, and Operations */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-0 w-full sm:min-w-[200px] flex-1 max-w-sm">
              <IconSearch size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="student-directory-search"
                placeholder="Search name, roll, or CNIC..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
              />
            </div>

            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Classes</option>
              <option value="CLASS_6">Class 6th</option>
              <option value="CLASS_7">Class 7th</option>
              <option value="CLASS_8">Class 8th</option>
              <option value="CLASS_9">Class 9th (SSC-I)</option>
              <option value="CLASS_10">Class 10th (SSC-II)</option>
              <option value="HSSC_1">1st Year (HSSC-I)</option>
              <option value="HSSC_2">2nd Year (HSSC-II)</option>
              <option value="BS">BS / Undergraduate</option>
            </select>

            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button
              onClick={handleExportPdf}
              disabled={anyPdfExporting}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9"
              title="Download filtered candidate roster PDF (up to 250 matching students)"
            >
              <IconDownloadSlip size={14} className="text-[#185b9d]" />
              <span aria-live="polite">{isExportingPdf ? `Elapsed ${elapsedPdfLabel}` : 'Export Filtered PDF'}</span>
            </button>
            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
              <button
                type="button"
                onClick={handleExportAllPdf}
                disabled={anyPdfExporting}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#185b9d] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9"
                title="Export every student in the live database, including inactive records, without photos or a 250-row cap"
              >
                <IconDownloadSlip size={14} />
                <span aria-live="polite">{isExportingAllPdf ? `Elapsed ${elapsedPdfLabel}` : 'Export All Students PDF'}</span>
              </button>
            )}
          </div>

          {/* Operational Toolbar Actions (Add Student removed - authoritative in AdminHeader) */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={toggleSelectAllCurrent}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer h-9"
              title="Select or deselect all candidates on current page"
            >
              <span>{allCurrentSelected ? 'Deselect Page' : 'Select Page'}</span>
            </button>

            <button
              onClick={() => fetchStudents(true)}
              disabled={isRefreshing}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9"
              title="Sync latest student registrations"
            >
              <IconRefresh size={14} className={`text-[#185b9d] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
            </button>

            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
              <button
                type="button"
                onClick={() => setShowBatchRollModal(true)}
                className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 hover:text-[#185b9d] border border-slate-200 hover:border-[#185b9d]/30 focus:outline-none focus:ring-1 focus:ring-[#185b9d] rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer h-9"
                title="Batch assign roll numbers and QR codes to paid candidates"
              >
                <IconZap size={14} className="text-slate-500" />
                <span>Issue Roll Numbers</span>
                {rollStatus && rollStatus.readyCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 text-[#185b9d] border border-blue-200 ml-0.5">
                    {rollStatus.readyCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Integrated Batch Selection Bar (Active when candidates selected) */}
        {selectedStudentIds.length > 0 && (
          <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
            <div className="flex items-center gap-2">
              <span className="bg-[#185b9d] text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
                {selectedStudentIds.length} Selected
              </span>
              <span className="text-xs text-slate-600 font-medium">
                Candidates selected for batch actions
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canApproveFees && (
                <button
                  type="button"
                  onClick={handleApproveSelectedFees}
                  disabled={isApprovingSelectedFees || selectedUnpaidStudents.length === 0}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    selectedUnpaidStudents.length > 0
                      ? `Approve PKR 300 fee for ${selectedUnpaidStudents.length} selected unpaid candidate(s)`
                      : 'All selected candidates on this page are already paid'
                  }
                >
                  {isApprovingSelectedFees ? (
                    <IconLoader size={14} className="animate-spin" />
                  ) : (
                    <IconApproveFee size={14} />
                  )}
                  <span>
                    {isApprovingSelectedFees
                      ? 'Approving Fees...'
                      : `Approve Fees (${selectedUnpaidStudents.length})`}
                  </span>
                </button>
              )}

              <button
                onClick={() => setBulkPrintType('OMR')}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-xs font-medium transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <IconFileText size={14} className="text-[#185b9d]" />
                <span>Print OMR Sheets ({selectedStudentIds.length})</span>
              </button>

              <button
                onClick={() => setBulkPrintType('ROLL_SLIP')}
                className="px-3 py-1 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <IconPrintSlip size={14} />
                <span>Print Roll Slips ({selectedStudentIds.length})</span>
              </button>

              {(role === 'SUPER_ADMIN' || role === 'ADMIN') && (
                <button
                  type="button"
                  onClick={handleExportSelectedPdf}
                  disabled={anyPdfExporting || isLoading || !students.some((student) => selectedStudentIds.includes(student.id))}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[#185b9d] rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download one roster PDF containing only the checked students on this page"
                >
                  {isExportingSelectedPdf ? <IconLoader size={14} className="animate-spin" /> : <IconDownloadSlip size={14} />}
                  <span aria-live="polite">{isExportingSelectedPdf ? `Elapsed ${elapsedPdfLabel}` : `Export Selected PDF (${selectedStudentIds.length})`}</span>
                </button>
              )}

              <button
                onClick={() => setSelectedStudentIds([])}
                className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-md transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Content Area with Loading Spinner */}
        <div className="relative min-h-[360px]">
          {isLoading ? (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex flex-col items-center justify-center z-20 space-y-2">
              <IconLoader size={24} className="text-[#185b9d]" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading Candidates...</span>
            </div>
          ) : null}

          {/* Desktop & Tablet Table View (hidden on narrow screens < 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAllCurrent}
                      className="w-4 h-4 text-[#185b9d] rounded border-slate-300 focus:ring-[#185b9d] cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('rollNumber')}
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Roll / App No</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('fullName')}
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Student Identity</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('currentClass')}
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-900"
                  >
                    <div className="flex items-center gap-1">
                      <span>Class & Level</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Fee Status</th>
                  <th className="py-3.5 px-4">Assigned Seating</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStudents.length > 0 ? (
                  sortedStudents.map((student) => {
                    const isOfficial = !!student.rollNumber && student.rollNumberStatus !== 'PROVISIONAL';
                    const displayRoll = student.displayRollNumber || (student.rollNumber ? student.rollNumber : `PROV-${student.applicationNo}`);
                    const seating = student.assignedHall && student.seatNo
                      ? `${student.assignedRoom || student.assignedHall} · ${student.seatNo}`
                      : (student.assignedHall || student.seatNo ? `${student.assignedHall || ''} ${student.seatNo || ''}`.trim() : 'Unallocated');
                    const isPaid = student.feeStatus === 'PAID';
                    const wa = getStudentWhatsAppContact(student);

                    return (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${compactListMode ? 'h-[42px]' : 'h-[52px]'}`}
                      >
                        {/* Checkbox */}
                        <td onClick={(e) => e.stopPropagation()} className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(student.id)}
                            onChange={() => {
                              setSelectedStudentIds((prev) =>
                                prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
                              );
                            }}
                            className="w-4 h-4 text-[#185b9d] rounded border-slate-300 focus:ring-[#185b9d] cursor-pointer"
                          />
                        </td>

                        {/* Roll / App No */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono tabular-nums leading-tight">
                            {isOfficial ? (
                              <span className="font-bold text-[#185b9d] text-xs block leading-tight">{student.rollNumber}</span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                                <span className="font-bold text-amber-700 text-xs leading-tight">
                                  {displayRoll}
                                </span>
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase leading-none">
                                  Pre-Issue
                                </span>
                              </div>
                            )}
                            <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">App #{student.applicationNo}</span>
                          </div>
                        </td>

                        {/* Student Identity: thumbnails are intentionally disabled in compact large-page mode */}
                        <td className={`${compactListMode ? 'py-2' : 'py-3.5'} px-4`}>
                          <div className="flex items-center gap-2.5">
                            {!compactListMode && (
                              <div
                                className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600 shrink-0"
                                aria-hidden="true"
                              >
                                {thumbnailUrls[student.id] ? (
                                  <img
                                    src={thumbnailUrls[student.id]}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  student.fullName?.trim()?.charAt(0)?.toUpperCase() || '?'
                                )}
                              </div>
                            )}
                            <div className="min-w-0 leading-tight">
                              <span className="font-bold text-slate-900 text-xs block truncate leading-tight">{student.fullName}</span>
                              <span className="text-[11px] text-slate-500 block truncate leading-tight mt-0.5">S/D/O {student.fatherName}</span>
                            </div>
                          </div>
                        </td>

                        {/* Class & Level */}
                        <td className="py-3.5 px-4">
                          <div className="leading-tight">
                            <span className="font-semibold text-slate-800 text-xs block leading-tight">{student.currentClass}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px] leading-tight mt-0.5">
                              {(student.scholarshipCategory || 'GENERAL_MERIT').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={student.status} size="sm" />
                        </td>

                        {/* Fee Status: Semantic Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold leading-none ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                            {isPaid ? 'PKR 300 Paid' : 'Pending Fee'}
                          </span>
                        </td>

                        {/* Assigned Seating */}
                        <td className="py-3.5 px-4">
                          {seating !== 'Unallocated' ? (
                            <span className="font-mono text-xs font-medium text-slate-800 leading-tight block">{seating}</span>
                          ) : (
                            <span className="text-xs text-slate-400 italic leading-tight block">Unallocated</span>
                          )}
                        </td>

                        {/* Consolidated Row Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 leading-none">
                            {/* Visible View Profile Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedStudent(student)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer leading-tight"
                            >
                              View Profile
                            </button>

                            {/* WhatsApp Quick Icon (if valid contact exists) */}
                            {!wa.isDisabled && wa.url && (
                              <button
                                type="button"
                                onClick={(e) => openWhatsAppInNewTab(wa.url!, e)}
                                title={`Contact ${student.fullName} on WhatsApp (${wa.formattedPhone})`}
                                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition cursor-pointer shadow-2xs"
                                aria-label={`Contact ${student.fullName} on WhatsApp`}
                              >
                                <IconMessageSquare size={14} className="text-emerald-600" />
                              </button>
                            )}

                            {/* Overflow Menu Button */}
                            <div className="relative" data-action-menu>
                              <button
                                type="button"
                                onClick={() => setActiveActionMenuId(activeActionMenuId === student.id ? null : student.id)}
                                title="More actions"
                                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer shadow-2xs"
                                aria-label="More actions"
                              >
                                <IconMoreHorizontal size={14} />
                              </button>

                              {activeActionMenuId === student.id && renderActionMenu(student)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : !isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-1.5">
                        <p className="font-semibold text-slate-800 text-sm">No Students Found</p>
                        <p className="text-xs text-slate-400">Try adjusting your search criteria or filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile Flat Divided List View (active on screens < 768px) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {sortedStudents.length > 0 ? (
              sortedStudents.map((student, idx) => {
                const isPaid = student.feeStatus === 'PAID';
                const wa = getStudentWhatsAppContact(student);
                const seating = student.assignedHall && student.seatNo
                  ? `${student.assignedRoom || student.assignedHall} · ${student.seatNo}`
                  : (student.assignedHall || student.seatNo ? `${student.assignedHall || ''} ${student.seatNo || ''}`.trim() : 'Unallocated');
                const isNearBottom = idx >= sortedStudents.length - 2;

                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`${compactListMode ? 'p-2.5 space-y-1.5' : 'p-3.5 space-y-2.5'} hover:bg-slate-50/70 transition cursor-pointer`}
                  >
                    {/* Line 1: compact large-page mode omits photos entirely */}
                    <div className="flex items-center gap-3">
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => {
                            setSelectedStudentIds((prev) =>
                              prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
                            );
                          }}
                          className="w-4 h-4 text-[#185b9d] rounded border-slate-300 focus:ring-[#185b9d] cursor-pointer"
                        />
                      </div>

                      {!compactListMode && (
                        <div
                          className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600 shrink-0"
                          aria-hidden="true"
                        >
                          {thumbnailUrls[student.id] ? (
                            <img
                              src={thumbnailUrls[student.id]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            student.fullName?.trim()?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-900 text-xs truncate">{student.fullName}</span>
                          <StatusBadge status={student.status} size="sm" />
                        </div>
                        <span className="text-[11px] text-slate-500 block truncate">S/D/O {student.fatherName}</span>
                      </div>
                    </div>

                    {/* Line 2: Roll / App No · Class & Stream · Fee Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#185b9d]">
                          {student.rollNumber || `App #${student.applicationNo}`}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-medium text-slate-700 text-[11px]">
                          {student.currentClass}
                        </span>
                      </div>

                      <div>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Pending Fee
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line 3: Seating & Bottom Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50 text-xs">
                      <div className="text-[11px] text-slate-500">
                        <span className="text-slate-400">Seat: </span>
                        <span className="font-mono font-medium text-slate-700">
                          {seating}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(student)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer"
                        >
                          View Profile
                        </button>

                        {!wa.isDisabled && wa.url && (
                          <button
                            type="button"
                            onClick={(e) => openWhatsAppInNewTab(wa.url!, e)}
                            title={`Contact ${student.fullName} on WhatsApp (${wa.formattedPhone})`}
                            className="p-1 rounded-md border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer shadow-2xs"
                            aria-label={`WhatsApp ${student.fullName}`}
                          >
                            <IconMessageSquare size={14} className="text-emerald-600" />
                          </button>
                        )}

                        <div className="relative" data-action-menu>
                          <button
                            type="button"
                            onClick={() => setActiveActionMenuId(activeActionMenuId === student.id ? null : student.id)}
                            className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                            aria-label="More actions"
                          >
                            <IconMoreHorizontal size={14} />
                          </button>

                          {activeActionMenuId === student.id && renderActionMenu(student, isNearBottom)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : !isLoading ? (
              <div className="py-12 text-center text-slate-500">
                <p className="font-semibold text-slate-800 text-sm">No Students Found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or filters.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Unified Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-700">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-semibold text-slate-700">{pagination.total}</span> candidates
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 font-medium text-slate-600">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer"
                aria-label="Students per page"
              >
                {STUDENT_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            {compactListMode && (
              <span className="hidden sm:inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
                Compact list · photos off
              </span>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 font-medium text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Walk-In Registration Modal (When triggered from App shell or local trigger) */}
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

      {/* Admin Edit Student Modal */}
      {isEditModalOpen && studentToEdit && (
        <AdminWalkInModal
          isOpen={isEditModalOpen}
          mode="edit"
          studentToEdit={studentToEdit}
          onClose={() => {
            setIsEditModalOpen(false);
            setStudentToEdit(null);
          }}
          onSuccess={(updatedStudent) => {
            setIsEditModalOpen(false);
            setStudentToEdit(null);
            fetchStudents(false);
            if (selectedStudent?.id === updatedStudent.id) {
              setSelectedStudent(updatedStudent);
            }
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

      {/* Candidate history is checked server-side before permanent deletion. */}
      {studentToDelete && (
        <AttendanceDialog returnFocusId="student-directory-search" title="Candidate Record Actions" busy={isDeleting} onClose={() => setStudentToDelete(null)} footer={<>
          <button type="button" className={attendanceSecondary} disabled={isDeleting} onClick={() => setStudentToDelete(null)}>Cancel</button>
          {deletionProtection?.canDeactivate && <button type="button" className={attendanceSecondary} disabled={isDeleting} onClick={handleDeactivateCandidate}>Deactivate Candidate</button>}
          <button type="button" disabled={isDeleting || !deletionProtection?.canPermanentlyDelete} onClick={handleConfirmDelete}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50 disabled:cursor-not-allowed">{isDeleting ? 'Saving…' : 'Permanently Delete'}</button>
        </>}>
          <p className="text-sm text-slate-700"><strong>{studentToDelete.fullName}</strong> · {studentToDelete.rollNumber || studentToDelete.applicationNo}</p>
          {!deletionProtection && !deletionError && <p role="status" className="mt-3 text-xs text-slate-600">Checking protected records…</p>}
          {deletionError && <p role="alert" className="mt-3 text-xs text-rose-700">{deletionError}</p>}
          {deletionProtection && <>
            <p className="mt-3 text-xs text-slate-600">{deletionProtection.canPermanentlyDelete
              ? 'No protected history was found. Permanent deletion removes this registration and cannot be undone.'
              : 'Permanent deletion is blocked to preserve candidate history. Deactivation preserves registration, Hall assignments, attendance, financial records and documents.'}</p>
            {deletionProtection.blockers.length > 0 && <dl className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {deletionProtection.blockers.map(blocker => <div key={blocker.kind} className="flex justify-between gap-3 py-2 text-xs"><dt>{blocker.label}</dt><dd className="font-semibold tabular-nums">{blocker.count}</dd></div>)}
            </dl>}
            {deletionProtection.canDeactivate && <p className="mt-3 text-xs text-slate-600">Deactivate Candidate sets this candidate to Inactive and prevents new attendance marks or new Hall allocations. Existing historical records remain available.</p>}
          </>}
        </AttendanceDialog>
      )}

      {/* Batch Issue Roll Numbers Modal */}
      {showBatchRollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-blue-50 text-[#185b9d] rounded-xl flex items-center justify-center border border-blue-100">
                <IconZap size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Batch Issue Roll Numbers</h3>
                <p className="text-xs text-slate-500">Official sequential roll number assignment</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Candidates with Paid Verification:</span>
                  <span className="font-mono">{rollStatus?.totalPaidCount ?? 0}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Already Issued Roll Numbers:</span>
                  <span className="font-mono">{rollStatus?.issuedCount ?? 0}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>Ready for Batch Issuance Now:</span>
                  <span className="bg-[#185b9d] text-white px-2 py-0.5 rounded font-mono text-xs">
                    {rollStatus?.readyCount ?? 0}
                  </span>
                </div>
              </div>

              {rollStatus && rollStatus.scheduledDate && (
                <div className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-800">
                  <IconClock size={16} className="text-[#185b9d] shrink-0" />
                  <span>Scheduled Batch Issuance Date: <strong>{new Date(rollStatus.scheduledDate).toLocaleDateString()}</strong></span>
                </div>
              )}

              <p className="text-slate-500 leading-relaxed text-[11px]">
                Issuing will assign permanent canonical roll numbers in the sequence <code className="font-mono font-semibold text-slate-700">AZMVS-2026-XXXX</code>, generate secure QR codes, and lock official examination admittance.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchRollModal(false)}
                disabled={isIssuingBatch}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
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
                className="px-5 py-2 text-xs font-bold text-white bg-[#185b9d] hover:bg-[#13497d] rounded-lg shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isIssuingBatch ? (
                  <>
                    <IconLoader size={14} className="animate-spin" />
                    <span>Processing Batch Issuance...</span>
                  </>
                ) : (
                  <>
                    <IconZap size={14} />
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
