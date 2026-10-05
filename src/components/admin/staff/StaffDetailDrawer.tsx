import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconStaff,
} from '../../common/icons';
import { api } from '../../../services/api';
import type {
  StaffDetailRecord,
  StaffStatus,
} from '../../../lib/mockApi';
import { useStaffFocusTrap } from './useStaffFocusTrap';
import { StaffStatusModal } from './StaffStatusModal';

function formatCurrency(val: string | number): string {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCnicForDisplay(cnic: string): string {
  const digits = cnic.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  }
  return cnic;
}

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

export interface StaffDetailDrawerProps {
  staffId: string | null;
  canEdit?: boolean;
  onClose: () => void;
  onEditClick?: (staff: StaffDetailRecord) => void;
  onStatusChanged?: (updated: StaffDetailRecord) => void;
  updatedStaff?: StaffDetailRecord | null;
}

export const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({
  staffId,
  canEdit = false,
  onClose,
  onEditClick,
  onStatusChanged,
  updatedStaff,
}) => {
  const [staff, setStaff] = useState<StaffDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCnic, setCopiedCnic] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Accessible focus trap
  useStaffFocusTrap({
    isOpen: Boolean(staffId),
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  const fetchStaffDetail = useCallback(async () => {
    if (!staffId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.staff.getById(staffId);
      setStaff(data);
    } catch (err: any) {
      console.error('Failed to load staff detail:', err);
      setError(err?.message || 'Staff details could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (staffId) {
      fetchStaffDetail();
    } else {
      setStaff(null);
    }
  }, [staffId, fetchStaffDetail]);

  // Sync when parent provides updatedStaff from Edit modal
  useEffect(() => {
    if (updatedStaff && updatedStaff.id === staffId) {
      fetchStaffDetail();
    }
  }, [updatedStaff, staffId, fetchStaffDetail]);

  const handleCopyCnic = (cnicVal: string) => {
    navigator.clipboard.writeText(cnicVal);
    setCopiedCnic(true);
    setTimeout(() => setCopiedCnic(false), 2000);
  };

  if (!staffId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-drawer-title"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="staff-drawer-title" className="text-base font-bold text-slate-900 tracking-tight truncate">
                {isLoading ? 'Loading Personnel Profile...' : staff?.fullName || 'Staff Member'}
              </h2>
              {staff && <StaffStatusBadge status={staff.status} />}
            </div>
            <p className="text-xs text-[#185b9d] font-medium mt-0.5 truncate">
              {staff?.role || 'Staff Profile'}
            </p>
            {staff && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {staff.status === 'ACTIVE'
                  ? 'Included in future payroll runs.'
                  : 'Excluded from future payroll runs.'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {canEdit && staff && (
              <>
                <button
                  type="button"
                  onClick={() => onEditClick && onEditClick(staff)}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#185b9d] hover:bg-[#13497d] rounded-lg transition shadow-2xs cursor-pointer"
                  title="Edit staff details"
                >
                  Edit Staff
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(true)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                    staff.status === 'ACTIVE'
                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                  }`}
                  title={staff.status === 'ACTIVE' ? 'Deactivate staff member' : 'Reactivate staff member'}
                >
                  {staff.status === 'ACTIVE' ? 'Deactivate Staff' : 'Reactivate Staff'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={fetchStaffDetail}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
              title="Refresh details"
              aria-label="Refresh staff details"
            >
              <IconRefresh size={14} className={isLoading ? 'animate-spin text-[#185b9d]' : ''} />
            </button>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Close drawer"
              aria-label="Close drawer"
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {isLoading && !staff ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
              <IconLoader size={24} className="animate-spin text-[#185b9d]" />
              <span className="text-xs font-medium">Fetching authoritative staff profile...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3" role="alert">
              <div className="flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <IconAlertTriangle size={16} />
                <span>{error}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchStaffDetail}
                  className="px-3 py-1 bg-white border border-rose-300 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-100 transition cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 bg-transparent text-slate-600 hover:text-slate-900 text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : staff ? (
            <>
              {/* Personnel Information Section */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Personnel Information
                </span>
                <div className="bg-slate-50/70 border border-slate-200/70 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Identity (CNIC)</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-semibold text-slate-800">
                        {formatCnicForDisplay(staff.cnic)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCnic(staff.cnic)}
                        className="text-[11px] text-slate-400 hover:text-[#185b9d] transition cursor-pointer"
                        title="Copy CNIC"
                        aria-label="Copy CNIC"
                      >
                        {copiedCnic ? (
                          <span className="text-emerald-600 flex items-center gap-0.5 font-sans">
                            <IconCheck size={11} /> Copied
                          </span>
                        ) : (
                          <span className="hover:underline font-sans">Copy</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Designation</span>
                    <span className="font-semibold text-slate-800">{staff.role || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Contact Telephone</span>
                    <span className="font-semibold text-slate-800">{staff.phone || '—'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Date Joined</span>
                    <span className="font-semibold text-slate-800">{formatDate(staff.joinDate)}</span>
                  </div>
                </div>
              </div>

              {/* Compensation Section */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Compensation
                </span>
                <div className="bg-slate-50/70 border border-slate-200/70 rounded-lg p-3">
                  <span className="text-[11px] text-slate-500 block">Monthly Salary</span>
                  <div className="mt-1">
                    <span className="text-lg font-bold text-slate-900 font-mono tracking-tight block">
                      PKR {formatCurrency(staff.salary)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Authorized monthly base compensation
                  </span>
                </div>
              </div>

              {/* Read-Only Payroll History Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Payroll History
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {staff.payroll.length} {staff.payroll.length === 1 ? 'Record' : 'Records'}
                  </span>
                </div>

                {staff.payroll && staff.payroll.length > 0 ? (
                  <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Paid Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {staff.payroll.map((p) => {
                            const isPaid = p.status === 'PAID';
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {p.month}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-900 font-medium">
                                  PKR {formatCurrency(p.amount)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isPaid ? (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Paid
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Pending
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {p.paidAt ? formatDate(p.paidAt) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50/60 border border-slate-200/60 rounded-lg text-center text-xs text-slate-500">
                    <p>No payroll history has been recorded for this staff member.</p>
                  </div>
                )}
              </div>

              {/* Record Metadata Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Record Metadata
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Created</span>
                    <span className="text-slate-700 font-medium text-[11px]">
                      {formatDateTime(staff.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Last Updated</span>
                    <span className="text-slate-700 font-medium text-[11px]">
                      {formatDateTime(staff.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Staff Status Confirmation Modal */}
      {staff && (
        <StaffStatusModal
          isOpen={isStatusModalOpen}
          staff={staff}
          targetStatus={staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}
          onClose={() => setIsStatusModalOpen(false)}
          onSuccess={(updated) => {
            setStaff(updated);
            fetchStaffDetail();
            if (onStatusChanged) {
              onStatusChanged(updated);
            }
          }}
        />
      )}
    </div>
  );
};
