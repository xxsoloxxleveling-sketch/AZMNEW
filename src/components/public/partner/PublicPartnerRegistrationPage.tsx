import React, { useState } from 'react';
import {
  School,
  Building,
  CheckCircle,
  Download,
  ArrowLeft,
  Loader2,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { mockApi, MockPartner } from '../../../lib/mockApi';

interface PublicPartnerRegistrationPageProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const PublicPartnerRegistrationPage: React.FC<PublicPartnerRegistrationPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [registeredPartner, setRegisteredPartner] = useState<MockPartner | null>(null);

  const [formData, setFormData] = useState({
    institutionName: '',
    institutionType: 'COLLEGE' as 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY',
    campus: '',
    address: '',
    district: 'Abbottabad',
    province: 'Khyber Pakhtunkhwa',
    contactName: '',
    contactDesignation: 'Principal / Regional Director',
    contactMobile: '',
    contactWhatsapp: '',
    contactEmail: '',
    website: '',
    classesOffered: ['SSC', 'HSSC'],
    studentStrength: 600,
    expectedApplicants: 80,
    agreedToTerms: true,
  });

  const handleClassToggle = (cls: string) => {
    setFormData((prev) => {
      const exists = prev.classesOffered.includes(cls);
      if (exists) {
        return { ...prev, classesOffered: prev.classesOffered.filter((c) => c !== cls) };
      } else {
        return { ...prev, classesOffered: [...prev.classesOffered, cls] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.classesOffered.length === 0) {
      alert('Please select at least one class offered.');
      return;
    }
    setIsLoading(true);

    try {
      const ptn = await mockApi.registerPartner({
        ...formData,
        studentStrength: Number(formData.studentStrength),
        expectedApplicants: Number(formData.expectedApplicants),
      });
      setRegisteredPartner(ptn);
    } catch (err: any) {
      alert(err.message || 'Failed to submit partner registration');
    } finally {
      setIsLoading(false);
    }
  };

  if (registeredPartner) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">Partner Institution Enrolled!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your institutional partnership registration has been submitted for official academic center accreditation.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Partner Code:</span>
              <span className="text-sm font-extrabold text-[#185b9d]">{registeredPartner.partnerCode}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Institution Name:</span>
              <span className="text-xs font-bold text-slate-900">{registeredPartner.institutionName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Accreditation Status:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                PENDING VERIFICATION
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => mockApi.downloadPartnerPdf(registeredPartner.id, registeredPartner.partnerCode)}
              className="w-full sm:w-auto px-6 py-3 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Partner Agreement PDF</span>
            </button>
            <button
              onClick={onNavigateHome}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateHome}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#185b9d] to-[#2563eb] flex items-center justify-center text-white shadow-sm">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900">Jadoon Public School & College</h1>
            <p className="text-[10px] text-slate-400 font-medium">Partner Institution Registration</p>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
        >
          Exit to Home
        </button>
      </nav>

      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-md space-y-8">
          <div className="space-y-1.5 border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Institutional Examination Center Agreement</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Schools, colleges, and academies partnering with JPS to host test sessions and register students.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Institution Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                1. Institution Profile
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institution Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Army Public School & College Abbottabad"
                    value={formData.institutionName}
                    onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#185b9d]/20 focus:border-[#185b9d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institution Category *</label>
                  <select
                    value={formData.institutionType}
                    onChange={(e) => setFormData({ ...formData, institutionType: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="SCHOOL">School (Class 6–10)</option>
                    <option value="COLLEGE">Higher Secondary / College</option>
                    <option value="ACADEMY">Coaching Academy</option>
                    <option value="UNIVERSITY">University / Degree College</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campus Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Main PMA Road Campus"
                    value={formData.campus}
                    onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campus Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="Complete street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact Person */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. Official Representative
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Col (R) Tariq Mahmood"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Principal / Academic Head"
                    value={formData.contactDesignation}
                    onChange={(e) => setFormData({ ...formData, contactDesignation: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Mobile *</label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={formData.contactMobile}
                    onChange={(e) => setFormData({ ...formData, contactMobile: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="principal@school.edu.pk"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Academic Stats & Classes Offered */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3. Academic Programs & Capacity
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Classes Offered (Select All Applicable) *</label>
                <div className="flex flex-wrap gap-2">
                  {['Class 6-8', 'SSC', 'HSSC', 'BS Degree'].map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => handleClassToggle(cls)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                        formData.classesOffered.includes(cls)
                          ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Student Strength</label>
                  <input
                    type="number"
                    value={formData.studentStrength}
                    onChange={(e) => setFormData({ ...formData, studentStrength: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expected Test Candidates</label>
                  <input
                    type="number"
                    value={formData.expectedApplicants}
                    onChange={(e) => setFormData({ ...formData, expectedApplicants: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
              <span className="text-xs font-bold text-[#185b9d] block">Institutional Undertaking</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                We agree to collaborate with Jadoon PS to facilitate candidate registration, examination hall supervision, and merit scholarship outreach.
              </p>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-900 pt-1">
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                  className="rounded text-[#185b9d]"
                />
                <span>We confirm and agree to institutional partnership terms</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Institutional Application...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Submit Partner Institution Registration</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
