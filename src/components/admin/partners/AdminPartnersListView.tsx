import React, { useState, useEffect, useCallback } from 'react';
import {
  School,
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Users,
  GraduationCap,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ShieldCheck,
  History,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { mockApi, MockPartner } from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { getPartnerFocalWhatsAppContact, openWhatsAppInNewTab } from '../../../utils/whatsapp';

export const AdminPartnersListView: React.FC = () => {
  const [partners, setPartners] = useState<MockPartner[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected partner for Drawer / Modal
  const [selectedPartner, setSelectedPartner] = useState<MockPartner | null>(null);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);

  // Status Action Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    partner: MockPartner | null;
    targetStatus: 'APPROVED' | 'REJECTED';
    reason: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    partner: null,
    targetStatus: 'APPROVED',
    reason: '',
    isSubmitting: false,
    error: null,
  });

  // Copied code feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const fetchPartners = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const res = await api.partners.getAll({
          search: searchTerm || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          institutionType: typeFilter !== 'ALL' ? typeFilter : undefined,
          district: districtFilter !== 'ALL' ? districtFilter : undefined,
          sortBy,
          sortOrder,
          page: pagination.page,
          limit: pagination.limit,
        });

        if (res && res.data) {
          setPartners(res.data);
          if (res.pagination) {
            setPagination((prev) => ({
              ...prev,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
            }));
          }
        }
      } catch (err: any) {
        console.error('Error fetching partner institutions:', err);
        setErrorMessage(err.message || 'Unable to load partner institutions.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchTerm, statusFilter, typeFilter, districtFilter, sortBy, sortOrder, pagination.page, pagination.limit]
  );

  useEffect(() => {
    fetchPartners(true);
  }, [fetchPartners]);

  // Load audit history when drawer opens for a partner
  const handleOpenDrawer = async (partner: MockPartner) => {
    setSelectedPartner(partner);
    setIsLoadingAudits(true);
    try {
      const history = await api.partners.getStatusHistory(partner.id);
      setAuditHistory(history || []);
    } catch (err) {
      console.warn('Failed to load audit history:', err);
      setAuditHistory([]);
    } finally {
      setIsLoadingAudits(false);
    }
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
      alert('Failed to generate PDF agreement: ' + (err.message || 'Please try again.'));
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleOpenActionModal = (partner: MockPartner, targetStatus: 'APPROVED' | 'REJECTED') => {
    setActionModal({
      isOpen: true,
      partner,
      targetStatus,
      reason: '',
      isSubmitting: false,
      error: null,
    });
  };

  const handleSubmitStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal.partner) return;

    if (actionModal.targetStatus === 'REJECTED' && !actionModal.reason.trim()) {
      setActionModal((prev) => ({ ...prev, error: 'A valid explanation reason is required to reject an application.' }));
      return;
    }

    if (actionModal.partner.status === 'REJECTED' && actionModal.targetStatus === 'APPROVED' && !actionModal.reason.trim()) {
      setActionModal((prev) => ({ ...prev, error: 'A justification note is required to reverse a rejected institution to approved.' }));
      return;
    }

    setActionModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const updated = await api.partners.updateStatus(actionModal.partner.id, {
        status: actionModal.targetStatus,
        reason: actionModal.reason.trim() || undefined,
        expectedStatus: actionModal.partner.status,
      });

      // Update in local list
      setPartners((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));

      // If drawer is currently open for this partner, update drawer state too
      if (selectedPartner && selectedPartner.id === updated.id) {
        setSelectedPartner({ ...selectedPartner, ...updated });
        const history = await api.partners.getStatusHistory(updated.id);
        setAuditHistory(history || []);
      }

      setActionModal({
        isOpen: false,
        partner: null,
        targetStatus: 'APPROVED',
        reason: '',
        isSubmitting: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Status update failed:', err);
      setActionModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Status transition failed. Please refresh and try again.',
      }));
    }
  };

  // Stats calculation
  const totalApproved = partners.filter((p) => p.status === 'APPROVED').length;
  const totalPending = partners.filter((p) => p.status === 'PENDING').length;
  const totalExpectedApplicants = partners.reduce((sum, p) => sum + (p.expectedApplicants || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Quick Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <School className="w-6 h-6 text-[#185b9d]" />
            <span>Partner Institutions Directory</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage affiliated schools, colleges, coaching academies, and official AZM examination centers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPartners(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#185b9d]' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Total Enrolled Partners</span>
          <div className="text-2xl font-black text-slate-900">{pagination.total}</div>
          <span className="text-[10px] text-blue-600 font-medium">All registered institutions</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-amber-700">Pending Verification</span>
          <div className="text-2xl font-black text-amber-600">
            {partners.filter((p) => p.status === 'PENDING').length}
          </div>
          <span className="text-[10px] text-amber-600 font-medium">Requires administrative review</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-emerald-700">Officially Accredited</span>
          <div className="text-2xl font-black text-emerald-600">
            {partners.filter((p) => p.status === 'APPROVED').length}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Active test centers</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Projected Candidates</span>
          <div className="text-2xl font-black text-[#185b9d]">{totalExpectedApplicants.toLocaleString()}</div>
          <span className="text-[10px] text-slate-400 font-medium">Session V applicants</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by Institution, Code, Focal Person, District..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Verification</option>
              <option value="APPROVED">Approved / Accredited</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="SCHOOL">School</option>
              <option value="COLLEGE">College</option>
              <option value="ACADEMY">Academy</option>
              <option value="UNIVERSITY">University</option>
            </select>
          </div>

          {/* District Filter */}
          <div>
            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Districts</option>
              <option value="Mansehra">Mansehra</option>
              <option value="Abbottabad">Abbottabad</option>
              <option value="Haripur">Haripur</option>
              <option value="Battagram">Battagram</option>
              <option value="Torghar">Torghar</option>
              <option value="Kohistan Upper">Kohistan Upper</option>
              <option value="Kohistan Lower">Kohistan Lower</option>
              <option value="Peshawar">Peshawar</option>
              <option value="Rawalpindi">Rawalpindi</option>
              <option value="Islamabad">Islamabad</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading && partners.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#185b9d] animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Loading Partner Directory...
            </span>
          </div>
        ) : partners.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <School className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">No partner institutions found</h3>
              <p className="text-xs text-slate-400">Try adjusting your search terms or filter criteria.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Partner Code</th>
                  <th className="py-3.5 px-4">Institution Profile</th>
                  <th className="py-3.5 px-4">Focal Person</th>
                  <th className="py-3.5 px-4">Academic Scope</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {partners.map((partner) => {
                  const whatsAppInfo = getPartnerFocalWhatsAppContact(partner);
                  const isApproved = partner.status === 'APPROVED';
                  const isPending = partner.status === 'PENDING';
                  const isRejected = partner.status === 'REJECTED';

                  return (
                    <tr key={partner.id} className="hover:bg-slate-50/70 transition">
                      {/* Partner Code */}
                      <td className="py-4 px-4 font-mono font-bold text-[#185b9d] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{partner.partnerCode}</span>
                          <button
                            onClick={() => handleCopyCode(partner.partnerCode)}
                            className="p-1 hover:bg-blue-50 text-slate-400 hover:text-[#185b9d] rounded transition"
                            title="Copy Partner Code"
                          >
                            {copiedCode === partner.partnerCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] font-sans font-normal text-slate-400 mt-0.5">
                          {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString() : '—'}
                        </div>
                      </td>

                      {/* Institution Profile */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {partner.institutionName}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700">
                            {partner.institutionType}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {partner.district} {partner.campus ? `(${partner.campus})` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Focal Person */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">{partner.contactName}</div>
                        <div className="text-[11px] text-slate-500">{partner.contactDesignation}</div>
                        <div className="font-mono text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{partner.contactMobile}</span>
                        </div>
                      </td>

                      {/* Academic Scope */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {partner.classesOffered?.map((cls) => (
                            <span
                              key={cls}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#185b9d] border border-blue-100"
                            >
                              {cls}
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Strength: <strong>{partner.studentStrength || '—'}</strong> | Expected:{' '}
                          <strong className="text-emerald-700">{partner.expectedApplicants || '—'}</strong>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            APPROVED
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            PENDING
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" />
                            REJECTED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp Focal Person */}
                          <button
                            onClick={(e) => openWhatsAppInNewTab(whatsAppInfo.url, e)}
                            disabled={!whatsAppInfo.url}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition disabled:opacity-40"
                            title="Message Focal Person on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Download PDF MOU */}
                          <button
                            onClick={() => handleDownloadPdf(partner)}
                            disabled={downloadingPdfId === partner.id}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#185b9d] rounded-lg transition disabled:opacity-50"
                            title="Download Partner Agreement PDF"
                          >
                            {downloadingPdfId === partner.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          {/* View Details Drawer */}
                          <button
                            onClick={() => handleOpenDrawer(partner)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="View Full Dossier & Audit History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Approve Button */}
                          {!isApproved && (
                            <button
                              onClick={() => handleOpenActionModal(partner, 'APPROVED')}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs"
                            >
                              Approve
                            </button>
                          )}

                          {/* Reject Button */}
                          {!isRejected && (
                            <button
                              onClick={() => handleOpenActionModal(partner, 'REJECTED')}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] transition"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong>{partners.length}</strong> of <strong>{pagination.total}</strong> registered institutions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1 || isLoading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg font-semibold transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-bold text-slate-800">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg font-semibold transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Details Dossier Drawer */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-[#185b9d] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    {selectedPartner.partnerCode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedPartner.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedPartner.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedPartner.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{selectedPartner.institutionName}</h2>
                <p className="text-xs text-slate-500">
                  {selectedPartner.institutionType} &bull; {selectedPartner.district}, {selectedPartner.province}
                </p>
              </div>
              <button
                onClick={() => setSelectedPartner(null)}
                className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Rejection notice if present */}
              {selectedPartner.rejectionReason && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Application Rejection Note:
                  </span>
                  <p className="leading-relaxed">{selectedPartner.rejectionReason}</p>
                </div>
              )}

              {/* Institutional Overview */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional Details</h3>
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Campus</span>
                    <span className="font-semibold text-slate-800">{selectedPartner.campus || 'Main Campus'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">District &amp; Province</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPartner.district}, {selectedPartner.province}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Physical Address</span>
                    <span className="font-semibold text-slate-800">{selectedPartner.address}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Website</span>
                    <span className="font-semibold text-slate-800">{selectedPartner.website || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Registered On</span>
                    <span className="font-semibold text-slate-800">
                      {selectedPartner.createdAt ? new Date(selectedPartner.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Focal Person Contact */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Focal Representative</h3>
                <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedPartner.contactName}</div>
                      <div className="text-slate-500 text-[11px]">{selectedPartner.contactDesignation}</div>
                    </div>
                    <button
                      onClick={(e) => openWhatsAppInNewTab(getPartnerFocalWhatsAppContact(selectedPartner).url, e)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mobile Number</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedPartner.contactMobile}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email Address</span>
                      <span className="font-semibold text-slate-800">{selectedPartner.contactEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Scope */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic Capacity</h3>
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] mb-1">Classes Offered</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPartner.classesOffered?.map((cls) => (
                        <span key={cls} className="px-2 py-0.5 bg-blue-50 text-[#185b9d] font-bold rounded-md text-[11px]">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Enrolled Strength</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedPartner.studentStrength?.toLocaleString() || '—'} Students
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Expected Session V Candidates</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {selectedPartner.expectedApplicants?.toLocaleString() || '—'} Candidates
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Audit Trail */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Administrative Audit History</span>
                </h3>

                {isLoadingAudits ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                    Loading audit trail...
                  </div>
                ) : auditHistory.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 text-center">
                    No status modifications recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditHistory.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700">
                            {item.previousStatus} &rarr;{' '}
                            <span className="font-bold text-slate-900">{item.newStatus}</span>
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {item.changedAt ? new Date(item.changedAt).toLocaleString() : '—'}
                          </span>
                        </div>
                        {item.reason && (
                          <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
                            &ldquo;{item.reason}&rdquo;
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400">
                          Reviewed By: <strong>{item.changedByName || 'Administrator'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => handleDownloadPdf(selectedPartner)}
                disabled={downloadingPdfId === selectedPartner.id}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Agreement PDF</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedPartner.status !== 'APPROVED' && (
                  <button
                    onClick={() => handleOpenActionModal(selectedPartner, 'APPROVED')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    Accredit / Approve
                  </button>
                )}
                {selectedPartner.status !== 'REJECTED' && (
                  <button
                    onClick={() => handleOpenActionModal(selectedPartner, 'REJECTED')}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    Reject Partner
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Transition Action Modal */}
      {actionModal.isOpen && actionModal.partner && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {actionModal.targetStatus === 'APPROVED' ? 'Accredit Partner Institution' : 'Reject Partner Application'}
                </h3>
                <p className="text-xs text-slate-500">
                  {actionModal.partner.institutionName} ({actionModal.partner.partnerCode})
                </p>
              </div>
              <button
                onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionModal.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{actionModal.error}</span>
              </div>
            )}

            <form onSubmit={handleSubmitStatusChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {actionModal.targetStatus === 'REJECTED'
                    ? 'Reason for Rejection * (Required)'
                    : 'Accreditation Notes / Reason (Optional)'}
                </label>
                <textarea
                  rows={3}
                  required={actionModal.targetStatus === 'REJECTED'}
                  placeholder={
                    actionModal.targetStatus === 'REJECTED'
                      ? 'Specify reasons (e.g. Incomplete documentation, outside target operational territory...)'
                      : 'Add any specific notes regarding examination venue capacity or approvals...'
                  }
                  value={actionModal.reason}
                  onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionModal.isSubmitting}
                  className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 disabled:opacity-60 ${
                    actionModal.targetStatus === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionModal.isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Status...</span>
                    </>
                  ) : (
                    <span>Confirm {actionModal.targetStatus === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};