import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconCheck,
  IconPlus,
} from '../../common/icons';
import { StatusBadge } from '../shared/StatusBadge';
import {
  MockPartner,
  CreatePartnerPayload,
  UpdatePartnerProfilePayload,
} from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { VALID_PROVINCES } from '../../../utils/formValidation';
import { usePartnerFocusTrap } from './usePartnerFocusTrap';

export interface PartnerFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  partner?: MockPartner | null;
  onClose: () => void;
  onSuccess: (savedPartner: MockPartner) => void;
}

const PRESET_CLASSES = [
  'Class 6-8',
  'SSC',
  'SSC-I',
  'SSC-II',
  'HSSC',
  'HSSC-I',
  'HSSC-II',
  'BS Degree',
];

interface FormState {
  institutionName: string;
  institutionType: 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY';
  campus: string;
  address: string;
  district: string;
  province: string;
  contactName: string;
  contactDesignation: string;
  contactMobile: string;
  contactWhatsapp: string;
  contactEmail: string;
  website: string;
  classesOffered: string[];
  studentStrength: string;
  expectedApplicants: string;
  agreedToTerms: boolean;
  signedAt: string;
}

const getInitialState = (p?: MockPartner | null): FormState => ({
  institutionName: p?.institutionName || '',
  institutionType: (p?.institutionType as any) || 'SCHOOL',
  campus: p?.campus || '',
  address: p?.address || '',
  district: p?.district || 'Abbottabad',
  province: p?.province || 'Khyber Pakhtunkhwa',
  contactName: p?.contactName || '',
  contactDesignation: p?.contactDesignation || 'Principal',
  contactMobile: p?.contactMobile || '',
  contactWhatsapp: p?.contactWhatsapp || '',
  contactEmail: p?.contactEmail || '',
  website: p?.website || '',
  classesOffered: p?.classesOffered && p.classesOffered.length > 0 ? [...p.classesOffered] : ['SSC', 'HSSC'],
  studentStrength: p?.studentStrength != null ? String(p.studentStrength) : '',
  expectedApplicants: p?.expectedApplicants != null ? String(p.expectedApplicants) : '',
  agreedToTerms: false,
  signedAt: '',
});

export const PartnerFormModal: React.FC<PartnerFormModalProps> = ({
  open,
  mode,
  partner,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormState>(() => getInitialState(partner));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customClassInput, setCustomClassInput] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);
  const prevPartnerIdRef = useRef<string | null | undefined>(undefined);

  const handleAttemptClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes in this form. Discard changes and close?')) {
      return;
    }
    onClose();
  };

  // Standardized Antigravity modal focus trap and escape handler
  usePartnerFocusTrap({
    isOpen: open,
    containerRef: modalRef,
    initialFocusRef: firstInputRef,
    onEscape: handleAttemptClose,
  });

  // Reset or populate on open or distinct partner ID change
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    const partnerChanged = partner?.id !== prevPartnerIdRef.current;

    if (open && (justOpened || partnerChanged)) {
      setFormData(getInitialState(partner));
      setErrors({});
      setGeneralError(null);
      setIsSubmitting(false);
      setCustomClassInput('');
      setIsDirty(false);
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
    prevOpenRef.current = open;
    prevPartnerIdRef.current = partner?.id;
  }, [open, partner?.id]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Toggle class selection
  const handleToggleClass = (cls: string) => {
    setIsDirty(true);
    setFormData((prev) => {
      const exists = prev.classesOffered.includes(cls);
      const updated = exists
        ? prev.classesOffered.filter((c) => c !== cls)
        : [...prev.classesOffered, cls];
      return { ...prev, classesOffered: updated };
    });
    if (errors.classesOffered) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.classesOffered;
        return next;
      });
    }
  };

  // Add custom class tag
  const handleAddCustomClass = () => {
    const trimmed = customClassInput.trim();
    if (!trimmed) return;
    if (!formData.classesOffered.includes(trimmed)) {
      setIsDirty(true);
      setFormData((prev) => ({
        ...prev,
        classesOffered: [...prev.classesOffered, trimmed],
      }));
    }
    setCustomClassInput('');
    if (errors.classesOffered) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.classesOffered;
        return next;
      });
    }
  };

  // Client-side validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.institutionName.trim() || formData.institutionName.trim().length < 3) {
      newErrors.institutionName = 'Institution name must be at least 3 characters.';
    }

    if (!formData.address.trim() || formData.address.trim().length < 3) {
      newErrors.address = 'Physical street address is required (at least 3 characters).';
    }

    if (!formData.district.trim() || formData.district.trim().length < 2) {
      newErrors.district = 'District is required.';
    }

    if (!formData.province.trim() || formData.province.trim().length < 2) {
      newErrors.province = 'Province is required.';
    }

    if (!formData.contactName.trim() || formData.contactName.trim().length < 2) {
      newErrors.contactName = 'Contact person name is required.';
    }

    if (!formData.contactDesignation.trim() || formData.contactDesignation.trim().length < 2) {
      newErrors.contactDesignation = 'Contact designation is required.';
    }

    const cleanMobile = formData.contactMobile.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10 || cleanMobile.length > 15) {
      newErrors.contactMobile = 'Valid 10–15 digit mobile number is required (e.g., 03001234567).';
    }

    if (formData.contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contactEmail.trim())) {
        newErrors.contactEmail = 'Please provide a valid email address.';
      }
    }

    if (formData.classesOffered.length === 0) {
      newErrors.classesOffered = 'Select or add at least one class offered.';
    }

    if (formData.studentStrength.trim()) {
      const strengthNum = parseInt(formData.studentStrength, 10);
      if (isNaN(strengthNum) || strengthNum <= 0) {
        newErrors.studentStrength = 'Student strength must be a positive whole number.';
      }
    }

    if (formData.expectedApplicants.trim()) {
      const applicantsNum = parseInt(formData.expectedApplicants, 10);
      if (isNaN(applicantsNum) || applicantsNum <= 0) {
        newErrors.expectedApplicants = 'Estimated applicants must be a positive whole number.';
      }
    }

    // Consent check rule in create mode: signedAt cannot be set if agreedToTerms is false
    if (mode === 'create' && formData.signedAt && !formData.agreedToTerms) {
      newErrors.signedAt = 'signedAt cannot be provided when agreedToTerms is false.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        const payload: CreatePartnerPayload = {
          institutionName: formData.institutionName.trim(),
          institutionType: formData.institutionType,
          campus: formData.campus.trim() || null,
          address: formData.address.trim(),
          district: formData.district.trim(),
          province: formData.province.trim(),
          contactName: formData.contactName.trim(),
          contactDesignation: formData.contactDesignation.trim(),
          contactMobile: formData.contactMobile.trim(),
          contactWhatsapp: formData.contactWhatsapp.trim() || null,
          contactEmail: formData.contactEmail.trim() || null,
          website: formData.website.trim() || null,
          classesOffered: formData.classesOffered,
          studentStrength: formData.studentStrength.trim() ? parseInt(formData.studentStrength, 10) : null,
          expectedApplicants: formData.expectedApplicants.trim() ? parseInt(formData.expectedApplicants, 10) : null,
          agreedToTerms: formData.agreedToTerms,
          signedAt: formData.signedAt ? new Date(formData.signedAt).toISOString() : null,
        };

        const created = await api.partners.create(payload);
        setIsDirty(false);
        onSuccess(created);
        onClose();
      } else {
        if (!partner?.id) throw new Error('Partner identifier missing for profile update.');

        const payload: UpdatePartnerProfilePayload = {
          institutionName: formData.institutionName.trim(),
          institutionType: formData.institutionType,
          campus: formData.campus.trim() || null,
          address: formData.address.trim(),
          district: formData.district.trim(),
          province: formData.province.trim(),
          contactName: formData.contactName.trim(),
          contactDesignation: formData.contactDesignation.trim(),
          contactMobile: formData.contactMobile.trim(),
          contactWhatsapp: formData.contactWhatsapp.trim() || null,
          contactEmail: formData.contactEmail.trim() || null,
          website: formData.website.trim() || null,
          classesOffered: formData.classesOffered,
          studentStrength: formData.studentStrength.trim() ? parseInt(formData.studentStrength, 10) : null,
          expectedApplicants: formData.expectedApplicants.trim() ? parseInt(formData.expectedApplicants, 10) : null,
        };

        const updated = await api.partners.updateProfile(partner.id, payload);
        setIsDirty(false);
        onSuccess(updated);
        onClose();
      }
    } catch (err: any) {
      console.error(`Failed to ${mode} partner institution:`, err);
      let msg = err?.message || `Failed to ${mode} partner institution. Please review form entries.`;
      if (msg.includes('already exists') || msg.includes('409') || msg.includes('conflict')) {
        msg = 'An institution with this name, district, and campus already exists in the registry.';
      }
      setGeneralError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleAttemptClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-form-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h2 id="partner-form-title" className="text-sm font-bold text-slate-900">
                {mode === 'create' ? 'Add Partner Institution' : 'Edit Institution Profile'}
              </h2>
              {mode === 'edit' && partner && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-[#185b9d] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {partner.partnerCode}
                  </span>
                  <StatusBadge status={partner.status} size="sm" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {mode === 'create'
                ? 'Register a new institutional examination partner venue. Partner Code and Initial Status (Pending) are assigned automatically.'
                : 'Modify contact, campus, and self-reported operational capacity details. System identifiers and status remain strictly immutable.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer shrink-0"
            title="Close modal"
            aria-label="Close modal"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" noValidate>
          <div className="px-4 sm:px-5 py-4 overflow-y-auto space-y-5 text-xs flex-1">
            {/* General Submission Error Banner */}
            {generalError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                <IconAlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{generalError}</p>
              </div>
            )}

            {/* Section 1: Institutional Profile */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                1. Institutional Profile
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="form-inst-name" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Institution Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    id="form-inst-name"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.institutionName}
                    aria-describedby={errors.institutionName ? "err-inst-name" : undefined}
                    value={formData.institutionName}
                    onChange={(e) => updateField('institutionName', e.target.value)}
                    placeholder="e.g., Army Public School & College"
                    className={`w-full rounded-lg border ${
                      errors.institutionName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.institutionName && (
                    <p id="err-inst-name" className="text-[11px] text-rose-600 mt-1">{errors.institutionName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-inst-type" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Institution Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="form-inst-type"
                    value={formData.institutionType}
                    onChange={(e) => updateField('institutionType', e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9"
                  >
                    <option value="SCHOOL">School</option>
                    <option value="COLLEGE">College</option>
                    <option value="ACADEMY">Academy</option>
                    <option value="UNIVERSITY">University</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="form-inst-campus" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Campus (Optional)
                  </label>
                  <input
                    id="form-inst-campus"
                    type="text"
                    value={formData.campus}
                    onChange={(e) => updateField('campus', e.target.value)}
                    placeholder="e.g., Cantt Campus / Main"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9"
                  />
                </div>

                <div>
                  <label htmlFor="form-inst-district" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    District <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="form-inst-district"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.district}
                    aria-describedby={errors.district ? "err-inst-district" : undefined}
                    value={formData.district}
                    onChange={(e) => updateField('district', e.target.value)}
                    placeholder="e.g., Abbottabad"
                    className={`w-full rounded-lg border ${
                      errors.district ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.district && (
                    <p id="err-inst-district" className="text-[11px] text-rose-600 mt-1">{errors.district}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-inst-province" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Province <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="form-inst-province"
                    value={formData.province}
                    onChange={(e) => updateField('province', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9"
                  >
                    {VALID_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="form-inst-address" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Physical Street Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="form-inst-address"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? "err-inst-address" : undefined}
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="e.g., Military College Road, Cantt Area"
                    className={`w-full rounded-lg border ${
                      errors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.address && (
                    <p id="err-inst-address" className="text-[11px] text-rose-600 mt-1">{errors.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Focal Representative */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                2. Focal Representative
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-contact-name" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Representative Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="form-contact-name"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.contactName}
                    aria-describedby={errors.contactName ? "err-contact-name" : undefined}
                    value={formData.contactName}
                    onChange={(e) => updateField('contactName', e.target.value)}
                    placeholder="e.g., Col. (R) Tariq Mehmood"
                    className={`w-full rounded-lg border ${
                      errors.contactName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.contactName && (
                    <p id="err-contact-name" className="text-[11px] text-rose-600 mt-1">{errors.contactName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-contact-desig" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Official Designation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="form-contact-desig"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.contactDesignation}
                    aria-describedby={errors.contactDesignation ? "err-contact-desig" : undefined}
                    value={formData.contactDesignation}
                    onChange={(e) => updateField('contactDesignation', e.target.value)}
                    placeholder="e.g., Principal / Director"
                    className={`w-full rounded-lg border ${
                      errors.contactDesignation ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.contactDesignation && (
                    <p id="err-contact-desig" className="text-[11px] text-rose-600 mt-1">{errors.contactDesignation}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-contact-mobile" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="form-contact-mobile"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errors.contactMobile}
                    aria-describedby={errors.contactMobile ? "err-contact-mobile" : undefined}
                    value={formData.contactMobile}
                    onChange={(e) => updateField('contactMobile', e.target.value)}
                    placeholder="e.g., 03001234567"
                    className={`w-full rounded-lg border ${
                      errors.contactMobile ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.contactMobile && (
                    <p id="err-contact-mobile" className="text-[11px] text-rose-600 mt-1">{errors.contactMobile}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-contact-wa" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    WhatsApp Number (Optional)
                  </label>
                  <input
                    id="form-contact-wa"
                    type="text"
                    value={formData.contactWhatsapp}
                    onChange={(e) => updateField('contactWhatsapp', e.target.value)}
                    placeholder="e.g., 03001234567"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9"
                  />
                </div>

                <div>
                  <label htmlFor="form-contact-email" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Official Email (Optional)
                  </label>
                  <input
                    id="form-contact-email"
                    type="email"
                    aria-invalid={!!errors.contactEmail}
                    aria-describedby={errors.contactEmail ? "err-contact-email" : undefined}
                    value={formData.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    placeholder="e.g., principal@institution.edu.pk"
                    className={`w-full rounded-lg border ${
                      errors.contactEmail ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.contactEmail && (
                    <p id="err-contact-email" className="text-[11px] text-rose-600 mt-1">{errors.contactEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-inst-web" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Website URL (Optional)
                  </label>
                  <input
                    id="form-inst-web"
                    type="text"
                    value={formData.website}
                    onChange={(e) => updateField('website', e.target.value)}
                    placeholder="e.g., https://institution.edu.pk"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Academic Scope & Self-Reported Capacity */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                3. Academic Scope &amp; Self-Reported Capacity
              </h3>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  Classes Offered <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_CLASSES.map((cls) => {
                    const selected = formData.classesOffered.includes(cls);
                    return (
                      <button
                        type="button"
                        key={cls}
                        onClick={() => handleToggleClass(cls)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                          selected
                            ? 'bg-[#185b9d] text-white border-[#185b9d]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <IconCheck size={11} className="inline-block mr-1" />}
                        {cls}
                      </button>
                    );
                  })}
                </div>

                {/* Custom class tag input */}
                <div className="flex items-center gap-2 max-w-sm mt-2">
                  <input
                    type="text"
                    value={customClassInput}
                    onChange={(e) => setCustomClassInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomClass();
                      }
                    }}
                    placeholder="Add custom class (e.g., O-Levels)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-8"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition cursor-pointer shrink-0 h-8 flex items-center gap-1"
                  >
                    <IconPlus size={12} />
                    <span>Add</span>
                  </button>
                </div>

                {/* Display active custom classes not in presets */}
                {formData.classesOffered.some((c) => !PRESET_CLASSES.includes(c)) && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 self-center mr-1">Custom:</span>
                    {formData.classesOffered
                      .filter((c) => !PRESET_CLASSES.includes(c))
                      .map((cls) => (
                        <span
                          key={cls}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#185b9d] border border-blue-200 rounded text-xs font-semibold"
                        >
                          {cls}
                          <button
                            type="button"
                            onClick={() => handleToggleClass(cls)}
                            className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title={`Remove ${cls}`}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                {errors.classesOffered && (
                  <p id="err-classes-offered" className="text-[11px] text-rose-600 mt-1">{errors.classesOffered}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="form-strength" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Self-Reported Student Strength (Optional)
                  </label>
                  <input
                    id="form-strength"
                    type="number"
                    min="1"
                    aria-invalid={!!errors.studentStrength}
                    aria-describedby={errors.studentStrength ? "err-student-strength" : undefined}
                    value={formData.studentStrength}
                    onChange={(e) => updateField('studentStrength', e.target.value)}
                    placeholder="e.g., 1450"
                    className={`w-full rounded-lg border ${
                      errors.studentStrength ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.studentStrength && (
                    <p id="err-student-strength" className="text-[11px] text-rose-600 mt-1">{errors.studentStrength}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-applicants" className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Estimated Session V Candidates (Optional)
                  </label>
                  <input
                    id="form-applicants"
                    type="number"
                    min="1"
                    aria-invalid={!!errors.expectedApplicants}
                    aria-describedby={errors.expectedApplicants ? "err-expected-applicants" : undefined}
                    value={formData.expectedApplicants}
                    onChange={(e) => updateField('expectedApplicants', e.target.value)}
                    placeholder="e.g., 320"
                    className={`w-full rounded-lg border ${
                      errors.expectedApplicants ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                    } px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9`}
                  />
                  {errors.expectedApplicants && (
                    <p id="err-expected-applicants" className="text-[11px] text-rose-600 mt-1">{errors.expectedApplicants}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Institutional Consent Record (Create Mode Only) */}
            {mode === 'create' && (
              <div className="space-y-3 pt-1">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  4. Institutional Consent Record
                </h3>

                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.agreedToTerms}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDirty(true);
                        setFormData((prev) => ({
                          ...prev,
                          agreedToTerms: checked,
                          // If unchecked, clear signedAt
                          signedAt: checked ? prev.signedAt : '',
                        }));
                      }}
                      className="mt-0.5 rounded border-slate-300 text-[#185b9d] focus:ring-[#185b9d]"
                    />
                    <div className="leading-snug">
                      <span className="font-semibold text-slate-800 block text-xs">
                        Record institutional agreement as received
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Enable only when the institution&apos;s agreement has actually been received or recorded.
                      </span>
                    </div>
                  </label>

                  {formData.agreedToTerms && (
                    <div className="pt-2 border-t border-slate-200/60 max-w-xs">
                      <label htmlFor="form-signed-at" className="text-[10px] font-semibold text-slate-600 block mb-1">
                        Signed Date / Time (Optional)
                      </label>
                      <input
                        id="form-signed-at"
                        type="datetime-local"
                        aria-invalid={!!errors.signedAt}
                        aria-describedby={errors.signedAt ? "err-signed-at" : undefined}
                        value={formData.signedAt}
                        onChange={(e) => updateField('signedAt', e.target.value)}
                        className={`w-full rounded border ${
                          errors.signedAt ? 'border-rose-400' : 'border-slate-300'
                        } bg-white px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#185b9d]`}
                      />
                      {errors.signedAt && (
                        <p id="err-signed-at" className="text-[10px] text-rose-600 mt-1">{errors.signedAt}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#185b9d] hover:bg-[#144a80] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin text-white" />
                  <span>{mode === 'create' ? 'Creating...' : 'Saving Changes...'}</span>
                </>
              ) : (
                <span>{mode === 'create' ? 'Create Institution' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
