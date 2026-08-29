import React, { useState, useEffect } from 'react';
import {
  School,
  Building,
  CheckCircle,
  Download,
  ArrowLeft,
  Loader2,
  FileCheck,
  ShieldCheck,
  Phone,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { mockApi, MockPartner } from '../../../lib/mockApi';
import { api } from '../../../services/api';
import { getPartnerSecretariatWhatsAppUrl, openWhatsAppInNewTab } from '../../../utils/whatsapp';

interface PublicPartnerRegistrationPageProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const PublicPartnerRegistrationPage: React.FC<PublicPartnerRegistrationPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredPartner, setRegisteredPartner] = useState<MockPartner | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  useEffect(() => {
    // Generate a fresh idempotency key for this form session
    try {
      const key = crypto.randomUUID ? crypto.randomUUID() : `ptn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setIdempotencyKey(key);
    } catch {
      setIdempotencyKey(`ptn-${Date.now()}`);
    }
  }, []);

  const [formData, setFormData] = useState({
    institutionName: '',
    institutionType: 'COLLEGE' as 'SCHOOL' | 'COLLEGE' | 'ACADEMY' | 'UNIVERSITY',
    campus: '',
    address: '',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    contactName: '',
    contactDesignation: 'Principal / Academic Head',
    contactMobile: '',
    contactWhatsapp: '',
    contactEmail: '',
    website: '',
    classesOffered: ['SSC', 'HSSC'],
    studentStrength: 500,
    expectedApplicants: 60,
    agreedToTerms: true,
  });

  const DISTRICT_OPTIONS = [
    'Mansehra',
    'Abbottabad',
    'Haripur',
    'Battagram',
    'Torghar',
    'Kohistan Upper',
    'Kohistan Lower',
    'Kolai-Palas',
    'Peshawar',
    'Mardan',
    'Swat',
    'Rawalpindi',
    'Islamabad',
    'Other',
  ];

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

  const handleDownloadPdf = async (partner: MockPartner) => {
    try {
      setIsPdfDownloading(true);
      await api.partners.downloadPdf(partner.id, partner.partnerCode);
    } catch (err: any) {
      alert('PDF generation encountered an error: ' + (err.message || 'Please try again.'));
    } finally {
      setIsPdfDownloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (formData.classesOffered.length === 0) {
      setErrorMessage('Please select at least one class offered by your institution.');
      return;
    }

    if (!formData.contactMobile || formData.contactMobile.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10 to 15-digit mobile contact number.');
      return;
    }

    setIsLoading(true);

    try {
      const ptn = await api.partners.register(
        {
          ...formData,
          studentStrength: formData.studentStrength ? Number(formData.studentStrength) : undefined,
          expectedApplicants: formData.expectedApplicants ? Number(formData.expectedApplicants) : undefined,
        },
        idempotencyKey
      );
      setRegisteredPartner(ptn);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setErrorMessage(err.message || 'Failed to submit partner institution registration. Please verify details and retry.');
    } finally {
      setIsLoading(false);
    }
  };

  if (registeredPartner) {
    const whatsAppUrl = getPartnerSecretariatWhatsAppUrl({
      partnerCode: registeredPartner.partnerCode,
      institutionName: registeredPartner.institutionName,
      district: registeredPartner.district,
      contactName: registeredPartner.contactName,
      contactMobile: registeredPartner.contactMobile,
    });

    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5" />
              Registration Application Submitted
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">Partner Institution Enrolled!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Your institutional partnership registration has been assigned an official Partner Code and queued for academic verification.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Assigned Partner Code:</span>
              <span className="text-base font-extrabold text-[#185b9d] font-mono tracking-wider">
                {registeredPartner.partnerCode}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">Institution Name:</span>
              <span className="text-xs font-bold text-slate-900">{registeredPartner.institutionName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs text-slate-500 font-medium">District &amp; Campus:</span>
              <span className="text-xs font-semibold text-slate-700">
                {registeredPartner.district} {registeredPartner.campus ? `(${registeredPartner.campus})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Verification Status:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                PENDING VERIFICATION
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 text-left flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-[#185b9d] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Next Step:</strong> Download your signed Acknowledgement &amp; MOU PDF and dispatch it to the AZM Central Secretariat via WhatsApp (<span className="font-mono font-bold">0305-1755551</span>) for priority accreditation.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleDownloadPdf(registeredPartner)}
                disabled={isPdfDownloading}
                className="w-full sm:w-auto flex-1 px-5 py-3 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPdfDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Official PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Agreement &amp; MOU PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={(e) => openWhatsAppInNewTab(whatsAppUrl, e)}
                className="w-full sm:w-auto flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Secretariat (0305)</span>
              </button>
            </div>

            <button
              onClick={onNavigateHome}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
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
            <h1 className="text-sm font-extrabold text-slate-900">AZM.AIO Educational Network</h1>
            <p className="text-[10px] text-slate-400 font-medium">Partner Institution Registration &amp; Accreditation</p>
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Session V (2026) Institutional Partnership
            </div>
            <h2 className="text-xl font-bold text-slate-900">Institutional Examination Center Agreement</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Partner with AZM.AIO to host official examination sessions, facilitate candidate scholarship enrollment, and receive institutional accreditation.
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Registration Alert</p>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

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
                    placeholder="e.g. Army Public School & College or Govt Degree College"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campus Name / Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Campus / Girls Wing"
                    value={formData.campus}
                    onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    {DISTRICT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Province *</label>
                  <input
                    type="text"
                    required
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Physical Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="Complete physical street / building address"
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
                2. Official Representative / Focal Person
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Focal Person Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Tariq Mahmood"
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
                    placeholder="e.g. Principal / Academic Head / Administrator"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="0300-1234567 (optional)"
                    value={formData.contactWhatsapp}
                    onChange={(e) => setFormData({ ...formData, contactWhatsapp: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="principal@school.edu.pk (optional)"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Website / Portal</label>
                  <input
                    type="text"
                    placeholder="https://... (optional)"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
                    min="1"
                    value={formData.studentStrength}
                    onChange={(e) => setFormData({ ...formData, studentStrength: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expected Test Candidates</label>
                  <input
                    type="number"
                    min="1"
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
                We agree to collaborate with the AZM.AIO Educational Network to facilitate candidate registration, examination hall supervision, and merit scholarship outreach for Session V (2026).
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
              disabled={isLoading || !formData.agreedToTerms}
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

