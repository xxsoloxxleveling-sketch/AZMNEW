import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconStaff,
} from '../../common/icons';
import { api } from '../../../services/api';
import type {
  StaffDetailRecord,
  CreateStaffPayload,
  UpdateStaffPayload,
} from '../../../lib/mockApi';
import { useStaffFocusTrap } from './useStaffFocusTrap';

export interface AddEditStaffModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  staffDetail?: StaffDetailRecord | null;
  onClose: () => void;
  onSuccess: (saved: StaffDetailRecord) => void;
}

/**
 * Format CNIC for friendly human display (12345-1234567-1).
 */
function formatCnicForDisplay(cnic: string): string {
  const digits = cnic.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  }
  return cnic;
}

export const AddEditStaffModal: React.FC<AddEditStaffModalProps> = ({
  isOpen,
  mode,
  staffDetail,
  onClose,
  onSuccess,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const initialInputRef = useRef<HTMLInputElement>(null);

  // Form field state
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [joinDate, setJoinDate] = useState('');

  // Status and error handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    role?: string;
    cnic?: string;
    phone?: string;
    salary?: string;
    joinDate?: string;
  }>({});

  // Populate or reset form whenever modal opens or mode/staffDetail changes
  useEffect(() => {
    if (!isOpen) return;

    setFormError(null);
    setFieldErrors({});

    if (mode === 'edit' && staffDetail) {
      setFullName(staffDetail.fullName || '');
      setRole(staffDetail.role || '');
      setCnic(formatCnicForDisplay(staffDetail.cnic || ''));
      setPhone(staffDetail.phone || '');
      setSalary(staffDetail.salary ? String(staffDetail.salary) : '');
      const parsedDate = staffDetail.joinDate ? staffDetail.joinDate.split('T')[0] : '';
      setJoinDate(parsedDate);
    } else {
      // Create mode
      setFullName('');
      setRole('');
      setCnic('');
      setPhone('');
      setSalary('');
      setJoinDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, mode, staffDetail]);

  // Accessible focus trap
  useStaffFocusTrap({
    isOpen,
    containerRef: modalRef,
    initialFocusRef: initialInputRef,
    onEscape: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen) return null;

  // Validate form fields client-side before submission
  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    } else if (fullName.trim().length > 100) {
      errors.fullName = 'Full name cannot exceed 100 characters.';
    }

    if (!role.trim() || role.trim().length < 2) {
      errors.role = 'Designation must be at least 2 characters.';
    } else if (role.trim().length > 100) {
      errors.role = 'Designation cannot exceed 100 characters.';
    }

    const cnicPattern = /^(\d{13}|\d{5}-\d{7}-\d)$/;
    if (!cnic.trim()) {
      errors.cnic = 'CNIC is required.';
    } else if (!cnicPattern.test(cnic.trim())) {
      errors.cnic = 'Enter a valid 13-digit CNIC (e.g. 12345-1234567-1).';
    }

    const cleanedPhoneDigits = phone.replace(/\D/g, '');
    const phonePattern = /^\+?[0-9\s-]{7,20}$/;
    if (!phone.trim()) {
      errors.phone = 'Valid phone number is required.';
    } else if (!phonePattern.test(phone.trim()) || cleanedPhoneDigits.length < 7 || cleanedPhoneDigits.length > 15) {
      errors.phone = 'Please enter a valid telephone number (7-15 digits, optional + prefix).';
    }

    const salaryNum = parseFloat(salary);
    if (!salary || isNaN(salaryNum) || salaryNum <= 0) {
      errors.salary = 'Monthly salary must be a positive number greater than 0.';
    } else if (salaryNum > 10000000) {
      errors.salary = 'Salary exceeds maximum allowable limit.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const payload: CreateStaffPayload = {
          fullName: fullName.trim(),
          role: role.trim(),
          cnic: cnic.trim(),
          phone: phone.trim(),
          salary: parseFloat(salary),
          joinDate: joinDate || undefined,
        };

        const created = await api.staff.create(payload);
        onSuccess(created);
        onClose();
      } else if (mode === 'edit' && staffDetail) {
        const payload: UpdateStaffPayload = {
          fullName: fullName.trim(),
          role: role.trim(),
          cnic: cnic.trim(),
          phone: phone.trim(),
          salary: parseFloat(salary),
          joinDate: joinDate || undefined,
        };

        const updated = await api.staff.update(staffDetail.id, payload);
        onSuccess(updated);
        onClose();
      }
    } catch (err: any) {
      console.error('Staff form submission error:', err);

      if (err?.status === 409 || err?.message?.includes('already registered')) {
        setFieldErrors((prev) => ({
          ...prev,
          cnic: err?.message || 'Staff member with this CNIC is already registered.',
        }));
        setFormError(err?.message || 'Staff member with this CNIC is already registered.');
      } else if (err?.status === 400 && err?.details) {
        // Map backend validation errors
        const backendDetails = err.details;
        const newFieldErrors: typeof fieldErrors = {};
        if (backendDetails.fullName) newFieldErrors.fullName = backendDetails.fullName;
        if (backendDetails.role) newFieldErrors.role = backendDetails.role;
        if (backendDetails.cnic) newFieldErrors.cnic = backendDetails.cnic;
        if (backendDetails.phone) newFieldErrors.phone = backendDetails.phone;
        if (backendDetails.salary) newFieldErrors.salary = backendDetails.salary;
        if (backendDetails.joinDate) newFieldErrors.joinDate = backendDetails.joinDate;
        setFieldErrors(newFieldErrors);
        setFormError(err?.message || 'Please correct the highlighted form errors.');
      } else {
        setFormError(
          err?.message ||
            `Failed to ${mode === 'create' ? 'register' : 'update'} staff record. Please try again.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-form-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 relative flex flex-col max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#185b9d] flex items-center justify-center border border-blue-100">
              <IconStaff size={16} />
            </div>
            <div>
              <h2 id="staff-form-title" className="text-sm font-bold text-slate-900 tracking-tight">
                {mode === 'create' ? 'Register New Staff Member' : 'Edit Staff Personnel Details'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {mode === 'create'
                  ? 'Enroll institutional faculty or administrative personnel'
                  : `Updating personnel profile for ${staffDetail?.fullName || 'Staff Member'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            aria-label="Close form"
            title="Close"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Global Error Notice */}
        {formError && (
          <div
            className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2 text-xs"
            role="alert"
          >
            <IconAlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="flex-1 leading-relaxed">{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Full Name */}
          <div>
            <label htmlFor="staff-fullName" className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name <span className="text-rose-600">*</span>
            </label>
            <input
              ref={initialInputRef}
              id="staff-fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="e.g. Prof. Tariq Khan"
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition ${
                fieldErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
              }`}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
            />
            {fieldErrors.fullName && (
              <p id="fullName-error" className="text-[11px] text-rose-600 mt-1">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          {/* Designation */}
          <div>
            <label htmlFor="staff-role" className="block text-xs font-semibold text-slate-700 mb-1">
              Designation <span className="text-rose-600">*</span>
            </label>
            <input
              id="staff-role"
              type="text"
              required
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (fieldErrors.role) setFieldErrors((prev) => ({ ...prev, role: undefined }));
              }}
              placeholder="e.g. Senior Lecturer / Academic Coordinator"
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition ${
                fieldErrors.role ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
              }`}
              aria-invalid={Boolean(fieldErrors.role)}
              aria-describedby={fieldErrors.role ? 'role-error' : undefined}
            />
            {fieldErrors.role && (
              <p id="role-error" className="text-[11px] text-rose-600 mt-1">
                {fieldErrors.role}
              </p>
            )}
          </div>

          {/* CNIC and Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CNIC */}
            <div>
              <label htmlFor="staff-cnic" className="block text-xs font-semibold text-slate-700 mb-1">
                CNIC <span className="text-rose-600">*</span>
              </label>
              <input
                id="staff-cnic"
                type="text"
                required
                value={cnic}
                onChange={(e) => {
                  setCnic(e.target.value);
                  if (fieldErrors.cnic) setFieldErrors((prev) => ({ ...prev, cnic: undefined }));
                }}
                placeholder="12345-1234567-1"
                className={`w-full px-3 py-2 text-xs font-mono bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition ${
                  fieldErrors.cnic ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
                aria-invalid={Boolean(fieldErrors.cnic)}
                aria-describedby={fieldErrors.cnic ? 'cnic-error' : undefined}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">13-digit identity number</span>
              {fieldErrors.cnic && (
                <p id="cnic-error" className="text-[11px] text-rose-600 mt-0.5">
                  {fieldErrors.cnic}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="staff-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Phone <span className="text-rose-600">*</span>
              </label>
              <input
                id="staff-phone"
                type="text"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                placeholder="+923001234567"
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition ${
                  fieldErrors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Mobile or landline number</span>
              {fieldErrors.phone && (
                <p id="phone-error" className="text-[11px] text-rose-600 mt-0.5">
                  {fieldErrors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Salary and Join Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Monthly Salary */}
            <div>
              <label htmlFor="staff-salary" className="block text-xs font-semibold text-slate-700 mb-1">
                Monthly Salary (PKR) <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  PKR
                </span>
                <input
                  id="staff-salary"
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={salary}
                  onChange={(e) => {
                    setSalary(e.target.value);
                    if (fieldErrors.salary) setFieldErrors((prev) => ({ ...prev, salary: undefined }));
                  }}
                  placeholder="55000"
                  className={`w-full pl-12 pr-3 py-2 text-xs font-mono bg-white border rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition ${
                    fieldErrors.salary ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                  }`}
                  aria-invalid={Boolean(fieldErrors.salary)}
                  aria-describedby={fieldErrors.salary ? 'salary-error' : undefined}
                />
              </div>
              {fieldErrors.salary && (
                <p id="salary-error" className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.salary}
                </p>
              )}
            </div>

            {/* Date Joined */}
            <div>
              <label htmlFor="staff-joinDate" className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Joining
              </label>
              <input
                id="staff-joinDate"
                type="date"
                value={joinDate}
                onChange={(e) => {
                  setJoinDate(e.target.value);
                  if (fieldErrors.joinDate) setFieldErrors((prev) => ({ ...prev, joinDate: undefined }));
                }}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#185b9d] transition cursor-pointer ${
                  fieldErrors.joinDate ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                }`}
                aria-invalid={Boolean(fieldErrors.joinDate)}
                aria-describedby={fieldErrors.joinDate ? 'joinDate-error' : undefined}
              />
              {fieldErrors.joinDate && (
                <p id="joinDate-error" className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.joinDate}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <IconLoader size={13} className="animate-spin" />
                  <span>{mode === 'create' ? 'Registering...' : 'Saving Changes...'}</span>
                </>
              ) : (
                <span>{mode === 'create' ? 'Register Staff' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
