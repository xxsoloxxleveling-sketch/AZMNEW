import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search as IconSearch,
  X as IconClose,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  ChevronsUpDown as IconChevronsUpDown,
  MoreHorizontal as IconMoreHorizontal,
  RefreshCw as IconRefresh,
  AlertTriangle as IconAlertTriangle,
  Loader2 as IconLoader,
  MessageSquare as IconMessageSquare,
  Download as IconDownloadSlip,
  Check as IconCheck,
  School as IconPartners,
  Plus as IconPlus,
  Pencil as IconEditStudent,
} from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { MockPartner, PartnerPagination } from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { getPartnerFocalWhatsAppContact, openWhatsAppInNewTab } from '../../../utils/whatsapp';
import { PartnerDetailDrawer } from './PartnerDetailDrawer';
import { PartnerFormModal } from './PartnerFormModal';
import { PartnerStatusModal } from './PartnerStatusModal';

function getInitials(name: string): string {
  if (!name) return 'AZM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCategory(type?: string): string {
  switch (type) {
    case 'SCHOOL':
      return 'School';
    case 'COLLEGE':
      return 'College';
    case 'ACADEMY':
      return 'Academy';
    case 'UNIVERSITY':
      return 'University';
    default:
      return type ? type.replace(/_/g, ' ') : '—';
  }
}

export const AdminPartnersListView: React.FC = () => {
  const [partners, setPartners] = useState<MockPartner[]>([]);
  const [pagination, setPagination] = useState<PartnerPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY'>('ALL');

  const [districtInput, setDistrictInput] = useState('');
  const [debouncedDistrict, setDebouncedDistrict] = useState('');

  // Sorting State
  const [sortBy, setSortBy] = useState<'createdAt' | 'institutionName' | 'partnerCode' | 'status' | 'district'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Drawer & Selection State
  const [selectedPartner, setSelectedPartner] = useState<MockPartner | null>(null);

  // Menu, Copy, and PDF Feedback State
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Add & Edit Institution Modal State (Step 11.3C)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [partnerToEdit, setPartnerToEdit] = useState<MockPartner | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Status Review Modal State (Step 11.3D)
  const [partnerToReview, setPartnerToReview] = useState<MockPartner | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Directory Feedback Notice (409 Conflict / Success)
  const [directoryNotice, setDirectoryNotice] = useState<{
    type: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);

  // Close active row action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeActionMenuId && !(e.target as Element).closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionMenuId]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounce district input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDistrict(districtInput);
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [districtInput]);

  // Fetch partners from server
  const fetchPartners = useCallback(
    async (showFullLoading = true) => {
      if (showFullLoading && partners.length === 0) setIsLoading(true);
      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const res = await api.partners.getAll({
          search: debouncedSearch.trim() || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          institutionType: typeFilter !== 'ALL' ? typeFilter : undefined,
          district: debouncedDistrict.trim() || undefined,
          sortBy,
          sortOrder,
          page: pagination.page,
          limit: pagination.limit,
        });

        if (res && res.data) {
          setPartners(res.data);
          if (res.pagination) {
            setPagination({
              page: res.pagination.page,
              limit: res.pagination.limit,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
            });
          }
        }
      } catch (err: any) {
        console.error('Error fetching partner institutions:', err);
        setErrorMessage(err?.message || 'Unable to load partner institutions from server.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, typeFilter, debouncedDistrict, sortBy, sortOrder, pagination.page, pagination.limit, partners.length]
  );

  useEffect(() => {
    fetchPartners(partners.length === 0);
  }, [fetchPartners]);

  // Handle column sort toggle
  const handleSort = (field: 'createdAt' | 'institutionName' | 'partnerCode' | 'status' | 'district') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'institutionName' || field === 'partnerCode' ? 'asc' : 'desc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Open drawer
  const handleOpenDrawer = (partner: MockPartner) => {
    setSelectedPartner(partner);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDownloadPdf = async (partner: MockPartner) => {
    try {
      setDownloadingPdfId(partner.id);
      await api.partners.downloadPdf(partner.id, partner.partnerCode);
    } catch (err: any) {
      alert('Failed to generate registration PDF: ' + (err?.message || 'Please retry.'));
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return !!(searchInput.trim() || districtInput.trim() || statusFilter !== 'ALL' || typeFilter !== 'ALL');
  }, [searchInput, districtInput, statusFilter, typeFilter]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setDistrictInput('');
    setDebouncedDistrict('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handlePartnerCreated = (newPartner: MockPartner) => {
    setIsAddModalOpen(false);
    fetchPartners(true);
    setSelectedPartner(newPartner);
  };

  const handlePartnerUpdated = useCallback((updatedPartner: MockPartner) => {
    setIsEditModalOpen(false);
    setPartnerToEdit(null);
    setPartners((prev) => prev.map((p) => (p.id === updatedPartner.id ? updatedPartner : p)));
    setSelectedPartner((current) => (current && current.id === updatedPartner.id ? updatedPartner : current));
  }, []);

  // Render overflow actions dropdown
  const renderActionMenu = (partner: MockPartner) => {
    return (
      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 text-xs divide-y divide-slate-100">
        <div className="py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveActionMenuId(null);
              setPartnerToReview(partner);
              setIsStatusModalOpen(true);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <IconCheck
              size={14}
              className={partner.status === 'PENDING' ? 'text-amber-600' : 'text-[#185b9d]'}
            />
            <span>{partner.status === 'PENDING' ? 'Review Application' : 'Change Status'}</span>
          </button>
        </div>

        <div className="py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveActionMenuId(null);
              setPartnerToEdit(partner);
              setIsEditModalOpen(true);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <IconEditStudent size={14} className="text-slate-500" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveActionMenuId(null);
              handleDownloadPdf(partner);
            }}
            disabled={downloadingPdfId === partner.id}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            <IconDownloadSlip size={14} className="text-[#185b9d]" />
            <span>{downloadingPdfId === partner.id ? 'Generating PDF...' : 'Download MOU / PDF'}</span>
          </button>
        </div>

        <div className="py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveActionMenuId(null);
              handleCopyCode(partner.partnerCode);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <IconCheck size={14} className="text-slate-400" />
            <span>Copy Partner Code</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchPartners(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <IconRefresh size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Directory Feedback / Conflict Operational Banner */}
      {directoryNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 ${
            directoryNotice.type === 'conflict'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : directoryNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {directoryNotice.type === 'conflict' ? (
              <IconAlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
            ) : directoryNotice.type === 'error' ? (
              <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <IconCheck size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="text-xs leading-relaxed font-medium">{directoryNotice.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setDirectoryNotice(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <IconClose size={13} />
          </button>
        </div>
      )}

      {/* Main Roster Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {/* Unified Operational Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-0 w-full sm:min-w-[220px] flex-1 max-w-sm">
              <IconSearch size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search institution, partner code, contact..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Category / Institution Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] cursor-pointer h-9"
            >
              <option value="ALL">All Categories</option>
              <option value="SCHOOL">School</option>
              <option value="COLLEGE">College</option>
              <option value="ACADEMY">Academy</option>
              <option value="UNIVERSITY">University</option>
            </select>

            {/* District Filter Input */}
            <div className="relative min-w-[140px] max-w-[180px]">
              <input
                type="text"
                placeholder="Filter district..."
                value={districtInput}
                onChange={(e) => setDistrictInput(e.target.value)}
                className="w-full px-2.5 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition h-9"
              />
              {districtInput && (
                <button
                  type="button"
                  onClick={() => setDistrictInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear district filter"
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            {/* Reset Filters Affordance */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer h-9 shadow-2xs"
                title="Reset all active filters"
              >
                <IconClose size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            <button
              type="button"
              onClick={() => fetchPartners(true)}
              disabled={isRefreshing}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9"
              title="Refresh database records"
            >
              <IconRefresh size={14} className={isRefreshing ? 'animate-spin text-[#185b9d]' : 'text-slate-500'} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#185b9d] hover:bg-[#144a80] rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer h-9 shrink-0"
              title="Register new partner institution"
            >
              <IconPlus size={14} className="text-white" />
              <span>+ Add Institution</span>
            </button>
          </div>
        </div>

        {/* Content Area with Loading Spinner Overlay */}
        <div className="relative min-h-[380px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex flex-col items-center justify-center z-20 space-y-2">
              <IconLoader size={24} className="text-[#185b9d]" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Loading Partner Directory...
              </span>
            </div>
          )}

          {/* Desktop & Tablet Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto min-h-[280px] pb-28">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider select-none">
                  <th
                    onClick={() => handleSort('institutionName')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Institution & Code</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Category & Campus</th>
                  <th
                    onClick={() => handleSort('district')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Location</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Focal Contact</th>
                  <th className="py-3.5 px-4 hidden min-[1360px]:table-cell">Academic Scope</th>
                  <th
                    onClick={() => handleSort('status')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('createdAt')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition hidden xl:table-cell"
                  >
                    <div className="flex items-center gap-1">
                      <span>Registered</span>
                      <IconChevronsUpDown size={12} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.length > 0 ? (
                  partners.map((partner) => {
                    const whatsAppInfo = getPartnerFocalWhatsAppContact(partner);

                    return (
                      <tr
                        key={partner.id}
                        onClick={() => handleOpenDrawer(partner)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer h-[50px]"
                      >
                        {/* Institution & Partner Code */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 tracking-tight"
                              aria-hidden="true"
                            >
                              {getInitials(partner.institutionName)}
                            </div>
                            <div className="min-w-0">
                              <span
                                className="font-semibold text-slate-900 text-xs block leading-tight truncate max-w-[190px] min-[1360px]:max-w-[240px]"
                                title={partner.institutionName}
                              >
                                {partner.institutionName}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[11px] font-semibold text-[#185b9d] leading-none">
                                  {partner.partnerCode}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCode(partner.partnerCode);
                                  }}
                                  className="text-slate-400 hover:text-[#185b9d] transition cursor-pointer"
                                  title="Copy Partner Code"
                                >
                                  {copiedCode === partner.partnerCode ? (
                                    <IconCheck size={11} className="text-emerald-600" />
                                  ) : (
                                    <span className="text-[10px] font-sans text-slate-400 hover:underline">Copy</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Campus */}
                        <td className="py-3.5 px-4">
                          <div className="leading-tight">
                            <span className="text-xs font-medium text-slate-800 block">
                              {formatCategory(partner.institutionType)}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[110px] min-[1360px]:max-w-[140px] mt-0.5">
                              {partner.campus ? partner.campus : 'Main Campus'}
                            </span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4">
                          <div className="leading-tight">
                            <span className="text-xs font-medium text-slate-800 block">
                              {partner.district}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[90px] min-[1360px]:max-w-[120px] mt-0.5">
                              {partner.province}
                            </span>
                          </div>
                        </td>

                        {/* Focal Contact */}
                        <td className="py-3.5 px-4 hidden lg:table-cell">
                          <div className="leading-tight">
                            <span className="text-xs font-semibold text-slate-900 block truncate max-w-[140px] min-[1360px]:max-w-[180px]">
                              {partner.contactName}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[140px] min-[1360px]:max-w-[180px] mt-0.5">
                              {partner.contactDesignation}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              {partner.contactMobile}
                            </span>
                          </div>
                        </td>

                        {/* Academic Scope - Collapses on narrower desktop */}
                        <td className="py-3.5 px-4 hidden min-[1360px]:table-cell">
                          <div className="leading-tight">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {partner.classesOffered && partner.classesOffered.length > 0 ? (
                                <>
                                  {partner.classesOffered.slice(0, 2).map((cls) => (
                                    <span
                                      key={cls}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#185b9d] border border-blue-100"
                                    >
                                      {cls}
                                    </span>
                                  ))}
                                  {partner.classesOffered.length > 2 && (
                                    <span className="text-[10px] text-slate-400 font-medium self-center">
                                      +{partner.classesOffered.length - 2}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Est. Applicants:{' '}
                              <span className="font-semibold text-slate-700">
                                {partner.expectedApplicants != null ? partner.expectedApplicants.toLocaleString() : '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={partner.status} size="sm" />
                        </td>

                        {/* Registered Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap hidden xl:table-cell">
                          <span className="text-xs text-slate-600 block">
                            {partner.createdAt
                              ? new Date(partner.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 leading-none">
                            {/* Direct View Dossier Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer(partner)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-2xs transition cursor-pointer leading-tight"
                            >
                              View Dossier
                            </button>

                            {/* Restrained WhatsApp Quick Button if valid mobile exists */}
                            {!whatsAppInfo.isDisabled && whatsAppInfo.url && (
                              <button
                                type="button"
                                onClick={(e) => openWhatsAppInNewTab(whatsAppInfo.url!, e)}
                                title={`Message Focal Person on WhatsApp (${partner.contactMobile})`}
                                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition cursor-pointer shadow-2xs"
                                aria-label="WhatsApp Focal Person"
                              >
                                <IconMessageSquare size={14} className="text-emerald-600" />
                              </button>
                            )}

                            {/* Overflow Menu */}
                            <div className="relative" data-action-menu>
                              <button
                                type="button"
                                onClick={() => setActiveActionMenuId(activeActionMenuId === partner.id ? null : partner.id)}
                                title="More actions"
                                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer shadow-2xs"
                                aria-label="More actions"
                              >
                                <IconMoreHorizontal size={14} />
                              </button>

                              {activeActionMenuId === partner.id && renderActionMenu(partner)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : !isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-2.5">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                          <IconPartners size={24} className="text-slate-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800 text-sm">
                            {hasActiveFilters
                              ? 'No Matching Partner Institutions'
                              : 'No partner institutions have been registered yet.'}
                          </p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            {hasActiveFilters
                              ? 'No institutions match the current search query or filter selection. Try adjusting your criteria.'
                              : 'Public institutional registrations and manually added institutions will appear here for administrative review.'}
                          </p>
                        </div>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            <IconClose size={12} />
                            <span>Reset All Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile Flat Divided List (< 768px) */}
          <div className="block md:hidden divide-y divide-slate-100 bg-white">
            {partners.length > 0 ? (
              partners.map((partner) => {
                const whatsAppInfo = getPartnerFocalWhatsAppContact(partner);

                return (
                  <div
                    key={partner.id}
                    onClick={() => handleOpenDrawer(partner)}
                    className="p-3.5 hover:bg-slate-50/70 transition cursor-pointer space-y-2.5"
                  >
                    {/* Top: Institution Name + StatusBadge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug break-words flex-1">
                        {partner.institutionName}
                      </h3>
                      <StatusBadge status={partner.status} size="sm" />
                    </div>

                    {/* Secondary: Partner Code + Type • Campus */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span className="font-mono font-bold text-[#185b9d] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                        {partner.partnerCode}
                      </span>
                      <span>•</span>
                      <span>{formatCategory(partner.institutionType)}</span>
                      <span>•</span>
                      <span>{partner.campus || 'Main Campus'}</span>
                    </div>

                    {/* Metadata: District/Province & Focal Contact */}
                    <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                      <div className="text-slate-500 text-[11px]">
                        <span className="font-medium text-slate-700">{partner.district || '—'}</span>, {partner.province || '—'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-medium text-slate-700">{partner.contactName || '—'}</span>
                        {partner.contactDesignation && (
                          <>
                            <span>•</span>
                            <span>{partner.contactDesignation}</span>
                          </>
                        )}
                        {partner.contactMobile && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-slate-500">{partner.contactMobile}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions: View Dossier + WhatsApp + Overflow Menu */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenDrawer(partner)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        View Dossier
                      </button>

                      <div className="flex items-center gap-1.5">
                        {!whatsAppInfo.isDisabled && whatsAppInfo.url && (
                          <button
                            type="button"
                            onClick={(e) => openWhatsAppInNewTab(whatsAppInfo.url!, e)}
                            title={`Message Focal Person on WhatsApp (${partner.contactMobile})`}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition cursor-pointer shadow-2xs"
                            aria-label="WhatsApp Focal Person"
                          >
                            <IconMessageSquare size={14} className="text-emerald-600" />
                          </button>
                        )}

                        {/* Overflow Menu */}
                        <div className="relative" data-action-menu>
                          <button
                            type="button"
                            onClick={() => setActiveActionMenuId(activeActionMenuId === partner.id ? null : partner.id)}
                            title="More actions"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer shadow-2xs"
                            aria-label="More actions"
                          >
                            <IconMoreHorizontal size={14} />
                          </button>

                          {activeActionMenuId === partner.id && renderActionMenu(partner)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : !isLoading ? (
              <div className="py-12 text-center text-slate-500 px-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200 mb-2">
                  <IconPartners size={24} className="text-slate-400" />
                </div>
                <p className="font-semibold text-slate-800 text-sm">
                  {hasActiveFilters ? 'No Matching Institutions' : 'No partner institutions registered yet.'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {hasActiveFilters
                    ? 'Try clearing active filters.'
                    : 'Registrations will appear here for review.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    <IconClose size={12} />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Server-Driven Pagination Footer */}
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
            of <span className="font-semibold text-slate-700">{pagination.total}</span> institutions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Details Dossier Drawer (Step 11.3B) */}
      {selectedPartner && (
        <PartnerDetailDrawer
          partnerId={selectedPartner.id}
          initialPartner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onPartnerUpdated={handlePartnerUpdated}
        />
      )}

      {/* Add Partner Modal (Step 11.3C) */}
      {isAddModalOpen && (
        <PartnerFormModal
          open={isAddModalOpen}
          mode="create"
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handlePartnerCreated}
        />
      )}

      {/* Edit Partner Modal (Step 11.3C) */}
      {isEditModalOpen && partnerToEdit && (
        <PartnerFormModal
          open={isEditModalOpen}
          mode="edit"
          partner={partnerToEdit}
          onClose={() => {
            setIsEditModalOpen(false);
            setPartnerToEdit(null);
          }}
          onSuccess={handlePartnerUpdated}
        />
      )}

      {/* Status Review Modal (Step 11.3D) */}
      {isStatusModalOpen && partnerToReview && (
        <PartnerStatusModal
          open={isStatusModalOpen}
          partner={partnerToReview}
          onClose={() => {
            setIsStatusModalOpen(false);
            setPartnerToReview(null);
          }}
          onSuccess={(updated) => {
            handlePartnerUpdated(updated);
            setIsStatusModalOpen(false);
            setPartnerToReview(null);
            setDirectoryNotice({
              type: 'success',
              message: `Institutional status successfully updated to ${updated.status}.`,
            });
          }}
          onConflict={(latest) => {
            handlePartnerUpdated(latest);
            setIsStatusModalOpen(false);
            setPartnerToReview(null);
            setDirectoryNotice({
              type: 'conflict',
              message: 'This institution was updated by another administrator. The latest record has been loaded.',
            });
          }}
        />
      )}
    </div>
  );
};