import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search as IconSearch,
  X as IconClose,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  RefreshCw as IconRefresh,
  AlertTriangle as IconAlertTriangle,
  Users as IconStaff,
  Loader2 as IconLoader,
  Plus as IconPlus,
  Check as IconCheck,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { api } from '../../../services/api';
import type {
  StaffDirectoryRecord,
  StaffStatus,
  StaffPagination,
  StaffDetailRecord,
} from '../../../lib/mockApi';
import { AddEditStaffModal } from './AddEditStaffModal';
import { StaffDetailDrawer } from './StaffDetailDrawer';

/**
 * Format ISO date string into standard British/Pakistani administrative date format (DD MMM YYYY).
 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Restrained status badge component for Staff Directory.
 */
function StaffStatusBadge({ status }: { status: StaffStatus }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Inactive
    </span>
  );
}

export const StaffListView: React.FC = () => {
  const { role, isLoading: authLoading } = useAuth();

  // Role authorization check (Backend allows SUPER_ADMIN, ADMIN, ACCOUNTANT to read; SUPER_ADMIN and ADMIN to write)
  const isAuthorized = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'ACCOUNTANT';
  const canWrite = role === 'SUPER_ADMIN' || role === 'ADMIN';

  // Directory and pagination state
  const [staffList, setStaffList] = useState<StaffDirectoryRecord[]>([]);
  const [pagination, setPagination] = useState<StaffPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StaffStatus>('ALL');

  // Modal, Drawer & Feedback state
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffDetailRecord | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);

  // Auto-dismiss feedback notice
  useEffect(() => {
    if (!feedbackNotice) return;
    const timer = setTimeout(() => {
      setFeedbackNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [feedbackNotice]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(debouncedSearch || statusFilter !== 'ALL');
  }, [debouncedSearch, statusFilter]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Fetch staff directory from GET /api/staff
  const fetchStaff = useCallback(
    async (isManualRefresh = false) => {
      if (!isAuthorized) return;

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const response = await api.staff.getAll({
          search: debouncedSearch || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          page: pagination.page,
          limit: pagination.limit,
        });

        setStaffList(response.staff);
        setPagination(response.pagination);
      } catch (err: any) {
        console.error('Error fetching staff directory:', err);
        setErrorMessage(
          err?.status === 403
            ? 'Access restricted. You do not have permission to view the staff directory.'
            : err?.message || 'Staff records could not be loaded. Please verify connection and retry.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthorized, debouncedSearch, statusFilter, pagination.page, pagination.limit]
  );

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      fetchStaff();
    }
  }, [authLoading, isAuthorized, fetchStaff]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || isLoading) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // RBAC Access Guard: If user role is not authorized (e.g. TEACHER)
  if (!authLoading && !isAuthorized) {
    return (
      <div className="p-6 max-w-4xl mx-auto" role="alert">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <IconAlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You do not have administrative permission to view the institutional staff directory.
              Permitted roles: Super Administrator, Administrator, and Accountant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Staff &amp; Faculty Directory
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {pagination.total} {pagination.total === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional personnel and faculty records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#185b9d] hover:bg-[#13497d] text-white text-xs font-semibold shadow-2xs transition cursor-pointer"
              title="Register a new staff member"
            >
              <IconPlus size={13} />
              <span>Register Staff</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchStaff(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh staff directory"
            title="Refresh staff records"
          >
            <IconRefresh
              size={13}
              className={isRefreshing ? 'animate-spin text-[#185b9d]' : 'text-slate-500'}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            <IconCheck size={14} className="text-emerald-600 shrink-0" />
            <span>{feedbackNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <IconClose size={12} />
          </button>
        </div>
      )}

      {/* Main Directory Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Operational Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
            {/* Search Input */}
            <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 max-w-sm">
              <IconSearch size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, designation, phone or CNIC..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
                aria-label="Search staff records"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | StaffStatus);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 h-9 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition cursor-pointer"
                aria-label="Filter by staff status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Reset Filters Shortcut */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#185b9d] hover:text-[#13497d] font-medium transition cursor-pointer px-1 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 flex items-center justify-between gap-3 text-xs" role="alert">
            <div className="flex items-center gap-2">
              <IconAlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchStaff()}
              className="px-2.5 py-1 bg-white border border-rose-200 rounded-md text-rose-700 font-medium hover:bg-rose-100 transition cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50/80 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 min-w-[220px]">Personnel</th>
                <th className="py-3.5 px-4 min-w-[160px]">CNIC</th>
                <th className="py-3.5 px-4 min-w-[140px]">Contact</th>
                <th className="py-3.5 px-4 min-w-[120px]">Joined</th>
                <th className="py-3.5 px-4 min-w-[100px]">Status</th>
                <th className="py-3.5 px-4 text-right min-w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <IconLoader size={16} className="animate-spin text-[#185b9d]" />
                      <span>Loading staff records...</span>
                    </div>
                  </td>
                </tr>
              ) : staffList.length > 0 ? (
                staffList.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelectedStaffId(member.id)}
                    className="hover:bg-slate-50/70 transition-colors h-[48px] cursor-pointer"
                  >
                    {/* Personnel Name & Role */}
                    <td className="py-3.5 px-4">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block truncate">
                          {member.fullName}
                        </span>
                        <span className="text-[11px] text-[#185b9d] font-medium block truncate">
                          {member.role || 'Unspecified'}
                        </span>
                      </div>
                    </td>

                    {/* Masked CNIC */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                      {member.cnic || '—'}
                    </td>

                    {/* Phone Contact */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {member.phone || '—'}
                    </td>

                    {/* Join Date */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {formatDate(member.joinDate)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StaffStatusBadge status={member.status} />
                    </td>

                    {/* Actions: View Details */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStaffId(member.id);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer"
                        title="View authoritative personnel dossier"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : !isLoading && !errorMessage ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                        {hasActiveFilters ? (
                          <IconSearch size={20} className="text-slate-400" />
                        ) : (
                          <IconStaff size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-800 text-xs">
                          {hasActiveFilters
                            ? 'No staff members match the current filters.'
                            : 'No staff members have been registered yet.'}
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          {hasActiveFilters
                            ? 'Try adjusting your search query or status filter.'
                            : 'Institutional personnel and faculty records will appear here once registered.'}
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          <IconClose size={11} />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile Flat Divided List View (< 768px) */}
        <div className="block md:hidden divide-y divide-slate-100 bg-white">
          {isLoading && staffList.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <IconLoader size={16} className="animate-spin text-[#185b9d]" />
              <span>Loading staff records...</span>
            </div>
          ) : staffList.length > 0 ? (
            staffList.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedStaffId(member.id)}
                className="p-3.5 space-y-2 hover:bg-slate-50/70 transition cursor-pointer"
              >
                {/* Top Row: Full Name & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 text-xs">
                    {member.fullName}
                  </span>
                  <StaffStatusBadge status={member.status} />
                </div>

                {/* Line 2: Designation */}
                <div className="text-[11px] text-[#185b9d] font-medium">
                  {member.role || 'Unspecified'}
                </div>

                {/* Line 3: CNIC and Phone */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                  <span className="font-mono">{member.cnic || '—'}</span>
                  <span>{member.phone || '—'}</span>
                </div>

                {/* Line 4: Joined Date & View Details Action */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    Joined: {formatDate(member.joinDate)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStaffId(member.id);
                    }}
                    className="px-2 py-0.5 text-xs font-medium text-[#185b9d] hover:bg-blue-50 border border-blue-200 rounded transition cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          ) : !isLoading && !errorMessage ? (
            <div className="py-10 px-4 text-center text-slate-500 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                {hasActiveFilters ? (
                  <IconSearch size={20} className="text-slate-400" />
                ) : (
                  <IconStaff size={20} className="text-slate-400" />
                )}
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 text-xs">
                  {hasActiveFilters
                    ? 'No staff members match the current filters.'
                    : 'No staff members have been registered yet.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {hasActiveFilters
                    ? 'Try adjusting your search query or status filter.'
                    : 'Staff and faculty members will appear here once registered.'}
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                >
                  <IconClose size={11} />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Server Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </strong>{' '}
              of <strong className="text-slate-900">{pagination.total}</strong> records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
                aria-label="Previous page"
              >
                <IconChevronLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
                aria-label="Next page"
              >
                <IconChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Detail Drawer */}
      <StaffDetailDrawer
        staffId={selectedStaffId}
        canEdit={canWrite}
        onClose={() => setSelectedStaffId(null)}
        onEditClick={(staff) => {
          setSelectedStaffDetail(staff);
          setIsEditModalOpen(true);
        }}
        onStatusChanged={(updated) => {
          setSelectedStaffDetail(updated);
          setFeedbackNotice({
            type: 'success',
            message:
              updated.status === 'ACTIVE'
                ? 'Staff member reactivated.'
                : 'Staff member deactivated.',
          });
          fetchStaff(true);
        }}
        updatedStaff={selectedStaffDetail}
      />

      {/* Register Staff Modal */}
      <AddEditStaffModal
        isOpen={isRegisterModalOpen}
        mode="create"
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={(newStaff) => {
          setFeedbackNotice({
            type: 'success',
            message: `Staff member "${newStaff.fullName}" registered successfully.`,
          });
          fetchStaff();
        }}
      />

      {/* Edit Staff Modal */}
      <AddEditStaffModal
        isOpen={isEditModalOpen}
        mode="edit"
        staffDetail={selectedStaffDetail}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updatedStaff) => {
          setSelectedStaffDetail(updatedStaff);
          setFeedbackNotice({
            type: 'success',
            message: 'Staff record updated successfully.',
          });
          fetchStaff();
        }}
      />
    </div>
  );
};
