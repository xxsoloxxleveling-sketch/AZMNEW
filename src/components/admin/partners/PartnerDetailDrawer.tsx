import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconClose,
  IconDownloadSlip,
  IconAlertTriangle,
  IconLoader,
  IconMessageSquare,
  IconCheck,
  IconExternalLink,
  IconEditStudent,
} from '../../common/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { MockPartner } from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { getPartnerFocalWhatsAppContact, openWhatsAppInNewTab } from '../../../utils/whatsapp';
import { PartnerAuditTimeline } from './PartnerAuditTimeline';
import { PartnerFormModal } from './PartnerFormModal';
import { PartnerStatusModal } from './PartnerStatusModal';
import { usePartnerFocusTrap } from './usePartnerFocusTrap';

export interface PartnerDetailDrawerProps {
  partnerId: string | null;
  initialPartner?: MockPartner | null;
  onClose: () => void;
  onPartnerUpdated?: (partner: MockPartner) => void;
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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

export const PartnerDetailDrawer: React.FC<PartnerDetailDrawerProps> = ({
  partnerId,
  initialPartner,
  onClose,
  onPartnerUpdated,
}) => {
  const [partner, setPartner] = useState<MockPartner | null>(() => {
    if (initialPartner && initialPartner.id === partnerId) return initialPartner;
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!initialPartner || initialPartner.id !== partnerId);
  const [error, setError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);

  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard management for accessible drawer
  usePartnerFocusTrap({
    isOpen: !!partnerId,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  const onPartnerUpdatedRef = useRef(onPartnerUpdated);
  useEffect(() => {
    onPartnerUpdatedRef.current = onPartnerUpdated;
  }, [onPartnerUpdated]);

  // Authoritative detail fetch
  const fetchAuthoritativeDetail = useCallback(async () => {
    if (!partnerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.partners.getById(partnerId);
      setPartner(data);
      if (onPartnerUpdatedRef.current) {
        onPartnerUpdatedRef.current(data);
      }
    } catch (err: any) {
      console.warn('Failed to load authoritative partner detail:', err);
      setError(err?.message || 'Unable to load institution dossier.');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (partnerId) {
      fetchAuthoritativeDetail();
    }
  }, [partnerId, fetchAuthoritativeDetail]);

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!partner) return;
    setIsDownloadingPdf(true);
    setPdfError(null);
    try {
      await api.partners.downloadPdf(partner.id, partner.partnerCode);
    } catch (err: any) {
      console.error('Failed to download partner agreement PDF:', err);
      setPdfError(err?.message || 'Failed to generate registration PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!partnerId) return null;

  return (
    <div
      id="partner-detail-drawer"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-dossier-title"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-[560px] md:w-[70vw] lg:max-w-[580px] bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
      >
        {/* Loading State without existing record */}
        {isLoading && !partner && (
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
            <IconLoader size={22} className="animate-spin text-[#185b9d]" />
            <p className="text-xs font-medium">Loading authoritative institution dossier...</p>
          </div>
        )}

        {/* Error State without record */}
        {!isLoading && !partner && error && (
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600">
              <IconAlertTriangle size={22} />
            </div>
            <p className="text-xs font-semibold text-slate-800">{error}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={fetchAuthoritativeDetail}
                className="px-3 py-1.5 bg-[#185b9d] text-white rounded-md text-xs font-semibold hover:bg-[#144a80] transition cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Content View */}
        {partner && (
          <>
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5">
                    <span className="font-mono text-xs font-bold text-[#185b9d]">
                      {partner.partnerCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(partner.partnerCode)}
                      className="text-slate-400 hover:text-[#185b9d] transition cursor-pointer p-0.5"
                      title="Copy Partner Code"
                      aria-label="Copy Partner Code"
                    >
                      {copiedCode ? (
                        <IconCheck size={11} className="text-emerald-600" />
                      ) : (
                        <span className="text-[10px] font-sans text-slate-400 hover:underline">Copy</span>
                      )}
                    </button>
                  </div>
                  <StatusBadge status={partner.status} size="sm" />
                </div>
                <h2
                  id="partner-dossier-title"
                  className="text-base font-bold text-slate-900 leading-snug break-words"
                >
                  {partner.institutionName}
                </h2>
                <p className="text-xs text-slate-500">
                  {formatCategory(partner.institutionType)} &bull; {partner.campus || 'Main Campus'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                  title="Close Dossier"
                  aria-label="Close dossier"
                >
                  <IconClose size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-4 sm:p-5 space-y-4 flex-1 text-xs overflow-y-auto">
              {/* Feedback / Conflict Operational Banner */}
              {feedbackNotice && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`p-3 rounded-lg border flex items-start justify-between gap-2.5 ${
                    feedbackNotice.type === 'conflict'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : feedbackNotice.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {feedbackNotice.type === 'conflict' ? (
                      <IconAlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                    ) : feedbackNotice.type === 'error' ? (
                      <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <IconCheck size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs leading-relaxed font-medium">{feedbackNotice.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackNotice(null)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer shrink-0"
                    title="Dismiss notification"
                    aria-label="Dismiss notification"
                  >
                    <IconClose size={13} />
                  </button>
                </div>
              )}

              {/* PDF Error Notice if Occurred */}
              {pdfError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
                    <IconAlertTriangle size={14} className="text-rose-600 shrink-0" />
                    <span>PDF Generation Notice:</span>
                  </div>
                  <p className="text-xs leading-relaxed">{pdfError}</p>
                </div>
              )}

              {/* Rejection Notice if Present */}
              {partner.rejectionReason && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
                    <IconAlertTriangle size={14} className="text-rose-600 shrink-0" />
                    <span>Application Rejection Note:</span>
                  </div>
                  <p className="leading-relaxed">{partner.rejectionReason}</p>
                </div>
              )}

              {/* Section 1: Institutional Profile */}
              <div className="space-y-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Institutional Profile
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Institution Type</span>
                    <span className="font-semibold text-slate-800">{formatCategory(partner.institutionType)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Campus</span>
                    <span className="font-semibold text-slate-800">{partner.campus || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Physical Street Address</span>
                    <span className="font-semibold text-slate-800">{partner.address || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">District &amp; Province</span>
                    <span className="font-semibold text-slate-800">
                      {partner.district}, {partner.province}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Website</span>
                    {partner.website ? (
                      <a
                        href={partner.website.startsWith('http') ? partner.website : `https://${partner.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#185b9d] hover:underline inline-flex items-center gap-1 truncate max-w-full"
                        title={partner.website}
                      >
                        <span className="truncate">{partner.website.replace(/^https?:\/\//, '')}</span>
                        <IconExternalLink size={11} className="shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Registration Record Date</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(partner.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Focal Representative */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Focal Representative
                  </h3>
                  {(() => {
                    const wa = getPartnerFocalWhatsAppContact(partner);
                    if (!wa.url) return null;
                    return (
                      <button
                        type="button"
                        onClick={(e) => openWhatsAppInNewTab(wa.url, e)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title={`Send WhatsApp message to ${partner.contactName}`}
                        aria-label={`Send WhatsApp message to ${partner.contactName}`}
                      >
                        <IconMessageSquare size={13} />
                        <span>WhatsApp</span>
                      </button>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Representative Name</span>
                    <span className="font-bold text-slate-900">{partner.contactName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Official Designation</span>
                    <span className="font-semibold text-slate-800">{partner.contactDesignation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mobile Phone</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-semibold text-slate-800">{partner.contactMobile}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(partner.contactMobile)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer"
                        title="Copy Mobile Phone"
                        aria-label="Copy mobile phone"
                      >
                        {copiedPhone ? (
                          <IconCheck size={11} className="text-emerald-600" />
                        ) : (
                          <span className="text-[10px] font-sans text-slate-400 hover:underline">Copy</span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email Address</span>
                    {partner.contactEmail ? (
                      <a
                        href={`mailto:${partner.contactEmail}`}
                        className="font-semibold text-[#185b9d] hover:underline truncate block mt-0.5"
                        title={partner.contactEmail}
                      >
                        {partner.contactEmail}
                      </a>
                    ) : (
                      <span className="text-slate-400 font-normal mt-0.5 block">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Academic Scope & Self-Reported Capacity */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Academic Scope &amp; Self-Reported Capacity
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-400 block text-[10px] mb-1.5">Classes Offered</span>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.classesOffered && partner.classesOffered.length > 0 ? (
                        partner.classesOffered.map((cls) => (
                          <span
                            key={cls}
                            className="px-2 py-0.5 bg-blue-50 text-[#185b9d] font-semibold rounded text-[11px] border border-blue-100"
                          >
                            {cls}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1.5 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Self-Reported Student Strength</span>
                      <span className="font-bold text-slate-800 text-xs">
                        {partner.studentStrength != null ? partner.studentStrength.toLocaleString() : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Estimated Session V Candidates</span>
                      <span className="font-bold text-slate-800 text-xs">
                        {partner.expectedApplicants != null ? partner.expectedApplicants.toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Terms & Consent Record */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Terms &amp; Consent Record
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Agreed to Partnership Terms</span>
                    <span className="font-semibold text-slate-800">
                      {partner.agreedToTerms ? 'Terms recorded as agreed' : 'Agreement not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Signature Timestamp</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(partner.signedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5: Administrative Review State */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200/80">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Administrative Review State
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Current Status</span>
                    <div className="mt-0.5">
                      <StatusBadge status={partner.status} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Reviewed At</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(partner.reviewedAt)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Reviewed By</span>
                    <span className="font-semibold text-slate-800">
                      {partner.reviewedBy || '—'}
                    </span>
                  </div>
                  {partner.rejectionReason && (
                    <div className="col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-rose-500 block text-[10px] font-medium">Rejection Reason</span>
                      <span className="text-rose-800 font-medium">
                        {partner.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 6: Status Audit Ledger */}
              <div className="pt-4 border-t border-slate-200/80">
                <PartnerAuditTimeline partnerId={partner.id} />
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                {partner.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => setIsStatusModalOpen(true)}
                    className="flex-1 sm:flex-initial justify-center px-3.5 py-2 sm:py-1.5 bg-[#185b9d] hover:bg-[#144a80] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Review Institutional Affiliation Application"
                  >
                    <IconCheck size={14} />
                    <span>Review Application</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsStatusModalOpen(true)}
                    className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Change Institutional Affiliation Status"
                  >
                    <IconCheck size={14} className={partner.status === 'APPROVED' ? 'text-emerald-600' : 'text-slate-500'} />
                    <span>Change Status</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Edit Institution Profile"
                >
                  <IconEditStudent size={14} className="text-slate-600" />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Download official registration acknowledgement PDF"
                >
                  {isDownloadingPdf ? (
                    <>
                      <IconLoader size={14} className="animate-spin text-[#185b9d]" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <IconDownloadSlip size={14} />
                      <span>Agreement PDF</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>

      {/* Edit Partner Profile Modal */}
      {isEditModalOpen && partner && (
        <PartnerFormModal
          open={isEditModalOpen}
          mode="edit"
          partner={partner}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => {
            setPartner(updated);
            setIsEditModalOpen(false);
            setFeedbackNotice({
              type: 'success',
              message: 'Institution profile updated successfully.',
            });
            if (onPartnerUpdated) {
              onPartnerUpdated(updated);
            }
          }}
        />
      )}

      {/* Status Review / Change Status Modal (Step 11.3D & 11.3E) */}
      {isStatusModalOpen && partner && (
        <PartnerStatusModal
          open={isStatusModalOpen}
          partner={partner}
          onClose={() => setIsStatusModalOpen(false)}
          onSuccess={(updated) => {
            setPartner(updated);
            setIsStatusModalOpen(false);
            setFeedbackNotice({
              type: 'success',
              message: `Institutional status successfully updated to ${updated.status}.`,
            });
            fetchAuthoritativeDetail();
            if (onPartnerUpdated) {
              onPartnerUpdated(updated);
            }
          }}
          onConflict={(latest) => {
            setPartner(latest);
            setIsStatusModalOpen(false);
            setFeedbackNotice({
              type: 'conflict',
              message: 'This institution was updated by another administrator. The latest record has been loaded.',
            });
            fetchAuthoritativeDetail();
            if (onPartnerUpdated) {
              onPartnerUpdated(latest);
            }
          }}
        />
      )}
    </div>
  );
};
