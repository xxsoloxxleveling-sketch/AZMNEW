import React, { useState } from 'react';
import { X, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';

interface AdminWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStudent: MockStudent) => void;
}

export const AdminWalkInModal: React.FC<AdminWalkInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    dateOfBirth: '2009-01-01',
    age: 17,
    cnicOrBForm: '',
    parentMobile: '',
    studentMobile: '',
    whatsapp: '',
    email: '',
    address: 'Mandian, Abbottabad',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    currentClass: 'SSC-I (Class 9th)',
    hsscGroup: '',
    schoolName: 'Jadoon Public School & College',
    boardOrUniversity: 'BISE Abbottabad',
    scholarshipCategory: 'GENERAL_MERIT' as any,
    guardianOccupation: 'Business',
    guardianMonthlyIncome: 80000,
    emergencyContact: '0300-1234567',
    emergencyRelation: 'Father',
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const student = await mockApi.createStudent({
        ...formData,
        guardianMonthlyIncome: Number(formData.guardianMonthlyIncome),
        age: Number(formData.age),
      });
      onSuccess(student);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to register student');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto space-y-6">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-[#185b9d] border border-blue-100">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Admin Walk-In Student Registration</h3>
            <p className="text-xs text-slate-400">Direct admission form (Parts A–E) for immediate enrollment</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Part A: Personal Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Part A: Personal Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Muhammad Ali"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Father Name *</label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Tariq Khan"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNIC or B-Form No *</label>
                <input
                  type="text"
                  name="cnicOrBForm"
                  value={formData.cnicOrBForm}
                  onChange={handleChange}
                  required
                  placeholder="13101-1234567-1"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>
            </div>
          </div>

          {/* Part B: Contact & Address */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Part B: Contact & Permanent Address
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Mobile *</label>
                <input
                  type="text"
                  name="parentMobile"
                  value={formData.parentMobile}
                  onChange={handleChange}
                  required
                  placeholder="0300-1234567"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp No</label>
                <input
                  type="text"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="0300-1234567"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent Residential Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  placeholder="House #, Street, Mohallah / Sector"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>
            </div>
          </div>

          {/* Part C: Education & Class */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Part C: Educational & Scholarship Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Class *</label>
                <select
                  name="currentClass"
                  value={formData.currentClass}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                >
                  <option value="Class 6th">Class 6th</option>
                  <option value="Class 7th">Class 7th</option>
                  <option value="Class 8th">Class 8th</option>
                  <option value="SSC-I (Class 9th)">SSC-I (Class 9th)</option>
                  <option value="SSC-II (Class 10th)">SSC-II (Class 10th)</option>
                  <option value="HSSC-I (Class 11th)">HSSC-I (Class 11th)</option>
                  <option value="HSSC-II (Class 12th)">HSSC-II (Class 12th)</option>
                  <option value="BS Computer Science">BS Computer Science</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scholarship Category *</label>
                <select
                  name="scholarshipCategory"
                  value={formData.scholarshipCategory}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                >
                  <option value="GENERAL_MERIT">General Merit (Academic Excellence)</option>
                  <option value="FINANCIALLY_NEEDY">Financially Needy / Need-Based</option>
                  <option value="ORPHAN">Orphan Welfare</option>
                  <option value="PERSON_WITH_DISABILITY">Special Needs / Disability</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Person *</label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  required
                  placeholder="0300-1234567"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relation</label>
                <input
                  type="text"
                  name="emergencyRelation"
                  value={formData.emergencyRelation}
                  onChange={handleChange}
                  placeholder="Father / Uncle / Brother"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enrolling Student...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Enrollment & Issue QR</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
