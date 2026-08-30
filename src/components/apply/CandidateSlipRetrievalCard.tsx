import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Printer,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Receipt,
  MessageCircle,
  Copy,
  Check,
  Building2,
  CreditCard,
  Smartphone,
  User,
  Loader2,
} from 'lucide-react';
import { mockApi, MockStudent } from '../../lib/mockApi';
import { API_BASE_URL, wakeUpBackend } from '../../lib/apiClient';

interface CandidateSlipRetrievalCardProps {
  onBackToApply?: () => void;
}

export const CandidateSlipRetrievalCard: React.FC<CandidateSlipRetrievalCardProps> = ({
  onBackToApply,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cnicOrBForm, setCnicOrBForm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState<MockStudent | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showVoucher, setShowVoucher] = useState(false);

  // Pre-warm backend when opening retrieval card
  useEffect(() => {
    wakeUpBackend();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError('');
    setFoundStudent(null);
    const applicationNo = searchQuery.trim();
    const cnic = cnicOrBForm.trim();

    if (!applicationNo || cnic.replace(/\D/g, '').length < 5) {
      setSearchError('Enter your application ID and the complete CNIC / B-Form used at registration.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/students/search-registration?applicationNo=${encodeURIComponent(applicationNo)}&cnic=${encodeURIComponent(cnic)}`,
        { headers: { Accept: 'application/json' } }
      );
      const result = await response.json();
      if (response.ok && result?.success && result.data) {
        setFoundStudent({ ...result.data, cnicOrBForm: cnic } as MockStudent);
      } else {
        setSearchError(result?.error || 'No matching application was found. Check both entries and try again.');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search candidate registration.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!foundStudent) return;
    setIsDownloadingPdf(true);
    try {
      await mockApi.downloadStudentPdf(foundStudent.id, foundStudent.rollNumber, foundStudent);
    } catch (err: any) {
      alert(err.message || 'Failed to generate PDF. You can also use the "Print Registration Slip" button.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden max-w-3xl mx-auto space-y-6 p-6 sm:p-8">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 space-y-1 text-center sm:text-left">
        <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#185b9d] border border-blue-200">
          Candidate Self-Service Retrieval
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">
          Re-Download Registration Slip &amp; Fee Voucher
        </h2>
        <p className="text-xs text-slate-500">
          If you missed saving your registration slip or want to re-download your application form and PKR 300 payment voucher before paying, search below.
        </p>
      </div>

      {/* Search Bar Form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Application Tracking ID (APP-2026-...)"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none"
            />
          </div>

          <div className="relative flex-1 w-full">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={cnicOrBForm}
              onChange={(e) => setCnicOrBForm(e.target.value)}
              placeholder="CNIC / B-Form used at registration"
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-[#185b9d] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full sm:w-auto px-6 py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Application</span>
              </>
            )}
          </button>
        </div>

        {searchError && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>{searchError}</p>
          </div>
        )}
      </form>

      {/* Found Candidate Card */}
      {foundStudent && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <img
                src={
                  foundStudent.uploadedDocuments?.photo?.dataUrl ||
                  foundStudent.photoUrl ||
                  `data:image/svg+xml;utf8,${encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                      <rect width="100" height="100" fill="#e2e8f0"/>
                      <circle cx="50" cy="40" r="20" fill="#94a3b8"/>
                      <path d="M15 90 C15 65, 85 65, 85 90 Z" fill="#64748b"/>
                    </svg>`
                  )}`
                }
                alt={foundStudent.fullName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-slate-300 shadow-sm"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {foundStudent.fullName}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      foundStudent.feeStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {foundStudent.feeStatus === 'PAID' ? 'Fee Verified (Paid)' : 'Fee Voucher Pending (PKR 300)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Father: <strong className="text-slate-800">{foundStudent.fatherName}</strong> • Class: <strong className="text-slate-800">{foundStudent.currentClass}</strong>
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-mono pt-0.5">
                  <span className="bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold text-[#185b9d]">
                    App ID: {foundStudent.applicationNo || foundStudent.id}
                  </span>
                  <span className="bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 text-slate-600">
                    CNIC: {foundStudent.cnicOrBForm || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Download Buttons */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Available Documents for this Application:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="p-3.5 rounded-2xl bg-[#185b9d] hover:bg-[#13497e] disabled:opacity-60 text-white font-bold text-xs shadow-md transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Download className="w-5 h-5 text-sky-200" />
                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Registration Slip'}</span>
                <span className="text-[10px] text-sky-200 font-normal">Official PDF Format</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="p-3.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs shadow-xs transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Printer className="w-5 h-5 text-slate-600" />
                <span>Print Registration Slip</span>
                <span className="text-[10px] text-slate-500 font-normal">Official A4 PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoucher(!showVoucher)}
                className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-xs transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Receipt className="w-5 h-5 text-emerald-600" />
                <span>{showVoucher ? 'Hide Payment Details' : 'View Payment Details (PKR 300)'}</span>
                <span className="text-[10px] text-emerald-700 font-normal">EasyPaisa, JazzCash &amp; Bank Transfer</span>
              </button>
            </div>
          </div>

          {/* Collapsible PKR 300 Voucher Drawer */}
          {showVoucher && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-300 space-y-4 text-xs animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-slate-900 text-sm">
                  PKR 300 Registration Fee Payment Details
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold rounded-full">
                  Amount: PKR 300
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* EasyPaisa / JazzCash Account */}
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">EasyPaisa / JazzCash</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">Mobile Wallet</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 text-[9px] font-bold rounded">Instant</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-sm font-extrabold font-mono text-slate-900 tracking-wider">0344-0197194</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('03440197194', 'wallet')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'wallet' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'wallet' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-700 font-semibold block">Account Title: Sumama Khan</span>
                </div>

                {/* Bank Account: Bank Alfalah */}
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">Bank Alfalah</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded-full">Bank IBFT</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-bold rounded">IBFT</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-sm font-extrabold font-mono text-slate-900 tracking-wider">83861010161490</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('83861010161490', 'alfalah')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'alfalah' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'alfalah' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-700 font-semibold block">Account Title: Sumama Khan</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <strong>Important: Payment Reference / Remarks</strong>
                <p>
                  Please send PKR 300 via EasyPaisa, JazzCash, or Bank Alfalah and attach your deposit receipt/screenshot on WhatsApp for Roll Number activation.
                </p>
              </div>

              <a
                href={`https://wa.me/923051755551?text=${encodeURIComponent(
                  `Hello AZM Accounts Desk,\n\nI have registered for Session V (2026).\n• Application ID: ${foundStudent.applicationNo || foundStudent.id}\n• Candidate Name: ${foundStudent.fullName}\n• Class: ${foundStudent.currentClass}\n• Fee: PKR 300\n• Paid Via: EasyPaisa / JazzCash / Bank Transfer (To: Sumama Khan)\n\nPlease find attached my payment receipt/screenshot for Roll Number activation.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Payment Receipt to WhatsApp (0305-1755551)</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
