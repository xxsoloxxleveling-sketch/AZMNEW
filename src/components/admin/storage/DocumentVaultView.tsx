import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Image,
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  User,
  ArrowUpDown,
  FileCheck,
} from 'lucide-react';
import { mockApi, MockStudentDocument } from '../../../lib/mockApi';

export const DocumentVaultView: React.FC = () => {
  const [documents, setDocuments] = useState<MockStudentDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<MockStudentDocument | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    const docs = await mockApi.getStudentDocuments();
    setDocuments(docs);
    setIsLoading(false);
  };

  const handleUpdateStatus = async (
    docId: string,
    status: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED'
  ) => {
    await mockApi.updateDocumentStatus(docId, status);
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status } : d))
    );
    if (selectedDoc && selectedDoc.id === docId) {
      setSelectedDoc({ ...selectedDoc, status });
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.applicationNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'ALL' || doc.docType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const totalCount = documents.length;
  const verifiedCount = documents.filter((d) => d.status === 'VERIFIED').length;
  const pendingCount = documents.filter((d) => d.status === 'PENDING_REVIEW').length;
  const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Storage KPIs */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#185b9d]/10 text-[#185b9d] flex items-center justify-center font-bold">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display">
                Candidate Document Storage Vault
              </h2>
              <p className="text-xs text-slate-500">
                Official digital repository of candidate photos, CNIC/B-Forms, academic DMCs, and deposit slips.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                documents.forEach((d) => handleUpdateStatus(d.id, 'VERIFIED'));
                alert('All candidate documents approved and marked as verified.');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Approve All Verified</span>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Vault Files</span>
            <span className="text-2xl font-extrabold text-slate-900 font-display block mt-1">{totalCount}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Stored across all applicants</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Verified & Approved</span>
            <span className="text-2xl font-extrabold text-emerald-900 font-display block mt-1">{verifiedCount}</span>
            <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">Legally cleared for exam</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Pending Review</span>
            <span className="text-2xl font-extrabold text-amber-900 font-display block mt-1">{pendingCount}</span>
            <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">Awaiting admin clearance</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Rejected / Resubmit</span>
            <span className="text-2xl font-extrabold text-rose-900 font-display block mt-1">{rejectedCount}</span>
            <span className="text-[10px] text-rose-700 font-bold mt-0.5 block">Invalid / blurry scans</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by student name, roll number, application ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Document Types</option>
            <option value="CANDIDATE_PHOTO">Candidate Photos</option>
            <option value="CNIC_BFORM">CNIC / B-Form Scans</option>
            <option value="PREVIOUS_DMC">Academic DMCs / Mark Sheets</option>
            <option value="PAYMENT_CHALLAN">Fee Deposit Receipts</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">Verified Only</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="REJECTED">Rejected Only</option>
          </select>
        </div>
      </div>

      {/* Document Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredDocs.map((doc) => {
          const isPhoto = doc.docType === 'CANDIDATE_PHOTO' || doc.fileType.includes('image');

          return (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group"
            >
              {/* Thumbnail / Preview Area */}
              <div
                onClick={() => setSelectedDoc(doc)}
                className="h-44 bg-slate-100 relative cursor-pointer overflow-hidden flex items-center justify-center"
              >
                {isPhoto ? (
                  <img
                    src={doc.fileUrl}
                    alt={doc.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FileText className="w-12 h-12 text-[#185b9d]" />
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-500">PDF Document</span>
                  </div>
                )}

                {/* Status Overlay Badge */}
                <div className="absolute top-2.5 left-2.5">
                  {doc.status === 'VERIFIED' && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-extrabold shadow-sm">
                      VERIFIED ✓
                    </span>
                  )}
                  {doc.status === 'PENDING_REVIEW' && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-white text-[9px] font-extrabold shadow-sm">
                      PENDING
                    </span>
                  )}
                  {doc.status === 'REJECTED' && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-600/90 text-white text-[9px] font-extrabold shadow-sm">
                      REJECTED ✗
                    </span>
                  )}
                </div>

                {/* Hover Eye Trigger */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="px-3 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </span>
                </div>
              </div>

              {/* Document Meta Info */}
              <div className="p-4 space-y-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 truncate" title={doc.title}>
                    {doc.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-semibold truncate mt-0.5">
                    Student: <strong>{doc.studentName}</strong>
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                    Roll: {doc.rollNumber} | {doc.currentClass}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">{doc.fileSize}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateStatus(doc.id, 'VERIFIED')}
                      title="Approve Document"
                      className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(doc.id, 'REJECTED')}
                      title="Reject Document"
                      className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox / Full Document Inspection Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-100">{selectedDoc.title}</h3>
                <p className="text-[11px] text-slate-400">
                  Candidate: {selectedDoc.studentName} ({selectedDoc.rollNumber})
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image / Preview Body */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex items-center justify-center min-h-[300px]">
              <img
                src={selectedDoc.fileUrl}
                alt={selectedDoc.title}
                className="max-h-[500px] w-auto max-w-full object-contain rounded-xl shadow-md border border-slate-300 bg-white"
              />
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedDoc.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedDoc.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedDoc.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedDoc.id, 'VERIFIED')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Verify Document</span>
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedDoc.id, 'REJECTED')}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Reject</span>
                </button>
                <a
                  href={selectedDoc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs shadow-2xs flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4 text-[#185b9d]" />
                  <span>Open Full Size</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
