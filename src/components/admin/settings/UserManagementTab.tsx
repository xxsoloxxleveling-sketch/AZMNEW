import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IconSearch,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconAlertTriangle,
  IconLoader,
  IconPlus,
  IconCheck,
} from '../../common/icons';
import { Users, Eye, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { api } from '../../../services/api';
import type {
  UserAccountRecord,
  Role,
  UserStatus,
  UserPagination,
} from '../../../lib/mockApi';
import { UserRoleBadge, UserStatusBadge, UserAccountDetailDrawer } from './UserAccountDetailDrawer';
import { UserProvisionModal } from './UserProvisionModal';

function formatDate(iso?: string | null): string {
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

export const UserManagementTab: React.FC = () => {
  const { role, isLoading: authLoading } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Directory and pagination state
  const [userList, setUserList] = useState<UserAccountRecord[]>([]);
  const [pagination, setPagination] = useState<UserPagination>({
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
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

  // Modal, Drawer & Feedback state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Auto-dismiss success notice
  useEffect(() => {
    if (!successNotice) return;
    const timer = setTimeout(() => {
      setSuccessNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successNotice]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(debouncedSearch || roleFilter !== 'ALL' || statusFilter !== 'ALL');
  }, [debouncedSearch, roleFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Fetch users from API
  const fetchDirectory = useCallback(
    async (targetPage = 1, silent = false) => {
      if (!isSuperAdmin || authLoading) return;

      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(null);

      try {
        const response = await api.users.getAll({
          search: debouncedSearch || undefined,
          role: roleFilter,
          status: statusFilter,
          page: targetPage,
          limit: pagination.limit || 20,
        });

        setUserList(response.users);
        setPagination(response.pagination);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load user accounts.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isSuperAdmin, authLoading, debouncedSearch, roleFilter, statusFilter, pagination.limit]
  );

  useEffect(() => {
    if (isSuperAdmin && !authLoading) {
      fetchDirectory(pagination.page);
    }
  }, [isSuperAdmin, authLoading, debouncedSearch, roleFilter, statusFilter, pagination.page]);

  // Handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleOpenDetail = (id: string) => {
    setSelectedUserId(id);
    setIsDrawerOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDrawerOpen(false);
    setSelectedUserId(null);
  };

  const handleProvisionSuccess = (newUser: UserAccountRecord) => {
    setSuccessNotice(`User account "${newUser.name}" (${newUser.email}) provisioned successfully.`);
    fetchDirectory(pagination.page, true);
  };

  const handleUserUpdated = (updatedUser: UserAccountRecord) => {
    setUserList((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    setSuccessNotice(`Account "${updatedUser.name}" (${updatedUser.email}) updated successfully.`);
    fetchDirectory(pagination.page, true);
  };

  // Access check fallback
  if (!authLoading && !isSuperAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Super Administrator Access Required</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          User provisioning and authoritative account directory management are strictly restricted to Super Administrators.
        </p>
      </div>
    );
  }

  const startRecordIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecordIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#185b9d]" />
            User Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated access to AZM.AIO.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsProvisionModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
        >
          <IconPlus size={14} />
          <span>Provision User</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successNotice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <IconCheck size={15} className="text-emerald-600 shrink-0" />
            <span className="font-medium">{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* Toolbar: Search, Role Filter, Status Filter, Refresh */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <IconSearch size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search"
            >
              <IconClose size={13} />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <div className="w-full md:w-44">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'ALL' | Role);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="TEACHER">Teacher</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-36">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | UserStatus);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#185b9d] focus:border-[#185b9d] transition cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={() => fetchDirectory(pagination.page, true)}
          disabled={isRefreshing || isLoading}
          className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          title="Refresh user accounts directory"
        >
          <IconRefresh size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <IconAlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDirectory(pagination.page)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Directory Content */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          /* Loading Skeletons */
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : userList.length === 0 ? (
          /* Empty States */
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-sm font-bold text-slate-800">No Matching User Accounts</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No user accounts match the current search query or filter criteria.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-800">No User Accounts Provisioned</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No user accounts have been provisioned in the system yet.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsProvisionModalOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#185b9d] hover:bg-[#13497d] rounded-lg transition cursor-pointer"
                  >
                    Provision First User
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table (Hidden on small mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th scope="col" className="px-4 py-2.5">
                      Account / Identity
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Assigned Role
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Provisioned
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {userList.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/60 transition-colors h-11"
                    >
                      {/* Name & Email */}
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{user.email}</div>
                      </td>

                      {/* Assigned Role */}
                      <td className="px-4 py-2">
                        <UserRoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2">
                        <UserStatusBadge status={user.status} />
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-2 text-slate-600">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(user.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Cards list on small screens) */}
            <div className="md:hidden divide-y divide-slate-100">
              {userList.map((user) => (
                <div key={user.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{user.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{user.email}</p>
                    </div>
                    <UserStatusBadge status={user.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <UserRoleBadge role={user.role} />
                    <span className="text-[11px] text-slate-500">{formatDate(user.createdAt)}</span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(user.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-700">{startRecordIndex}</span>–
                <span className="font-semibold text-slate-700">{endRecordIndex}</span> of{' '}
                <span className="font-semibold text-slate-700">{pagination.total}</span> accounts
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  aria-label="Previous page"
                >
                  <IconChevronLeft size={13} />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <span className="px-2 text-slate-600 font-medium">
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>

                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <IconChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Provision User Modal */}
      <UserProvisionModal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        onSuccess={handleProvisionSuccess}
      />

      {/* User Detail Drawer */}
      <UserAccountDetailDrawer
        userId={selectedUserId}
        isOpen={isDrawerOpen}
        onClose={handleCloseDetail}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
};
