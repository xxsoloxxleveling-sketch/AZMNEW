import React, { useEffect, useRef, useState } from 'react';
import {
  Archive, Search, UploadCloud, FileText, Image as ImageIcon, CheckCircle2,
  Clock3, XCircle, ShieldCheck, Download, Eye, X, ChevronLeft, ChevronRight,
  Loader2, RefreshCcw, History, RotateCw, AlertCircle, UserRound,
} from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { mockApi, type MockStudent } from '../../../lib/mockApi';
import {
  vaultApi, type VaultDocument, type VaultDocumentType,
  type VaultReviewStatus, type VaultHistory, type VaultPage,
} from '../../../lib/vaultApi';

const DOCUMENT_TYPES: { value: VaultDocumentType; label: string }[] = [
  { value: 'photo', label: 'Student Photograph' },
  { value: 'bform', label: 'CNIC / B-Form' },
  { value: 'fatherCnic', label: 'Guardian CNIC' },
  { value: 'dmc', label: 'Academic DMC / Marks Sheet' },
  { value: 'domicile', label: 'Domicile' },
  { value: 'paymentReceipt', label: 'Payment Receipt' },
  { value: 'income', label: 'Income Certificate' },
  { value: 'signature', label: 'Signature' },
];
const statusLabel = (status: VaultReviewStatus) =>
  status === 'VERIFIED' ? 'Verified' : status === 'REJECTED' ? 'Rejected' : 'Pending review';
const statusClass = (status: VaultReviewStatus) =>
  status === 'VERIFIED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'REJECTED'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
const formatDate = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const formatSize = (bytes: number | null) =>
  bytes == null ? 'Size unavailable' : bytes < 1024 * 1024
    ? Math.ceil(bytes / 1024) + ' KB' : (bytes / (1024 * 1024)).toFixed(2) + ' MB';
const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const neutralButton = buttonBase + ' border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
const primaryButton = buttonBase + ' bg-[#185b9d] text-white hover:bg-[#13497d]';
const inputBase = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#185b9d]';
const blankPage: VaultPage = {
  documents: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 1 },
  summary: { total: 0, VERIFIED: 0, REJECTED: 0, PENDING_REVIEW: 0 }, classes: [],
};

export const DocumentVaultView: React.FC = () => {
  const { role, isLoading: authLoading } = useAuth();
  const authorized = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const [pageData, setPageData] = useState<VaultPage>(blankPage);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<VaultDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewGeneration = useRef(0);
  const activeUrl = useRef('');
  const activeDocumentId = useRef('');
  const [history, setHistory] = useState<VaultHistory | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateResults, setCandidateResults] = useState<MockStudent[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [chosenCandidate, setChosenCandidate] = useState<MockStudent | null>(null);
  const [uploadType, setUploadType] = useState<VaultDocumentType>('photo');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (authLoading || !authorized) return;
    let alive = true;
    setLoading(true); setLoadError('');
    vaultApi.list({
      page, limit: 24, search: debouncedSearch || undefined,
      type: (typeFilter || undefined) as VaultDocumentType | undefined,
      status: (statusFilter || undefined) as VaultReviewStatus | undefined,
      class: classFilter || undefined,
    }).then(data => {
      if (alive) {
        setPageData(data);
        if (data.pagination.totalPages < page) setPage(Math.max(1, data.pagination.totalPages));
      }
    }).catch(error => { if (alive) setLoadError(error.message || 'Unable to retrieve private vault records.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authLoading, authorized, page, debouncedSearch, typeFilter, statusFilter, classFilter, reload]);

  useEffect(() => () => {
    previewGeneration.current++;
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
  }, []);

  useEffect(() => {
    if (!uploadOpen || !authorized || candidateSearch.trim().length < 2) {
      setCandidateResults([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setCandidateLoading(true);
      mockApi.getStudentsPage({ search: candidateSearch.trim(), page: 1, limit: 10 })
        .then(result => { if (alive) setCandidateResults(result.students); })
        .catch(() => { if (alive) setCandidateResults([]); })
        .finally(() => { if (alive) setCandidateLoading(false); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [uploadOpen, authorized, candidateSearch]);

  const refresh = () => setReload(value => value + 1);
  const changeFilters = (run: () => void) => { run(); setPage(1); };
  const revokePreview = () => {
    previewGeneration.current++;
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = ''; setPreviewUrl('');
  };

  const loadHistory = async (documentId: string, nextPage = 1) => {
    setHistoryLoading(true);
    try {
      const result = await vaultApi.getHistory(documentId, nextPage);
      if (activeDocumentId.current === documentId) {
        setHistory(result); setHistoryPage(nextPage);
      }
    } catch (error: any) {
      setNotice(error.message || 'Unable to load document history.');
    } finally { setHistoryLoading(false); }
  };

  const openDocument = async (document: VaultDocument) => {
    revokePreview();
    const generation = previewGeneration.current;
    activeDocumentId.current = document.id;
    setSelected(document); setPreviewLoading(true); setPreviewError('');
    setHistory(null); setHistoryPage(1); setRejectionReason(''); setReplacementFile(null);
    void loadHistory(document.id);
    try {
      const url = await vaultApi.fileUrl(document.id);
      if (generation !== previewGeneration.current) { URL.revokeObjectURL(url); return; }
      activeUrl.current = url; setPreviewUrl(url);
    } catch (error: any) {
      if (generation === previewGeneration.current) setPreviewError(error.message || 'The stored file could not be opened.');
    } finally {
      if (generation === previewGeneration.current) setPreviewLoading(false);
    }
  };

  const closeDocument = () => {
    revokePreview(); activeDocumentId.current = ''; setSelected(null); setHistory(null); setReplacementFile(null);
  };

  const downloadFile = async (document: VaultDocument, eventId?: string) => {
    setBusy(true);
    let blobUrl = '';
    try {
      blobUrl = eventId
        ? await vaultApi.priorFileUrl(document.id, eventId)
        : await vaultApi.fileUrl(document.id);
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = eventId ? 'previous-' + document.originalFileName : document.originalFileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (error: any) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setNotice(error.message || 'Download failed.');
    } finally { setBusy(false); }
  };

  const updateReview = async (status: VaultReviewStatus) => {
    if (!selected || busy) return;
    if (status === 'REJECTED' && rejectionReason.trim().length < 5) {
      setNotice('Please enter a rejection reason of at least five characters.');
      return;
    }
    setBusy(true); setNotice('');
    try {
      const updated = await vaultApi.review(selected.id, selected.revision, status, status === 'REJECTED' ? rejectionReason.trim() : undefined);
      setSelected({ ...selected, ...updated });
      setRejectionReason(''); refresh();
      await loadHistory(selected.id);
      setNotice('Document review saved with an audit entry.');
    } catch (error: any) {
      setNotice(error.message || 'Unable to save review. Refresh the document.');
    } finally { setBusy(false); }
  };

  const replaceDocument = async () => {
    if (!selected || !replacementFile || busy) return;
    if (!window.confirm('Replace this private document? The original file will be kept in immutable history, and verification will reset to Pending Review.')) return;
    setBusy(true); setNotice('');
    try {
      const updated = await vaultApi.replace(selected.id, selected.revision, replacementFile);
      setReplacementFile(null); refresh();
      setNotice('Replacement saved. The previous version remains in history.');
      await openDocument({ ...selected, ...updated });
    } catch (error: any) {
      setNotice(error.message || 'Replacement failed. The original document was not changed.');
    } finally { setBusy(false); }
  };

  const uploadDocument = async () => {
    if (!chosenCandidate || !uploadFile || busy) return;
    setBusy(true); setNotice('');
    try {
      await vaultApi.upload(chosenCandidate.id, uploadType, uploadFile);
      setUploadOpen(false); setCandidateSearch(''); setChosenCandidate(null);
      setUploadFile(null); setPage(1); refresh();
      setNotice('Private document uploaded. Review status is Pending Review; an audit entry was created.');
    } catch (error: any) {
      setNotice(error.message || 'Upload failed. No verification status was changed.');
    } finally { setBusy(false); }
  };

  if (authLoading) return <p className="text-sm text-slate-500 p-4">Checking vault permissions…</p>;
  if (!authorized) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Only Administrators and Super Administrators may access the document vault.</div>;

  return (
    <div className="space-y-5 text-slate-800">
      <section className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-[#185b9d] rounded-xl"><Archive size={22}/></div>
            <div>
              <h1 className="text-lg font-extrabold">Candidate Document Storage Vault</h1>
              <p className="text-xs text-slate-500 mt-1">Private R2 storage · Individually reviewed records · Permanent action history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className={neutralButton} onClick={refresh} disabled={loading}><RefreshCcw size={15}/>Refresh</button>
            <button className={primaryButton} onClick={() => setUploadOpen(true)}><UploadCloud size={15}/>Upload Document</button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Stored Documents', value: pageData.summary.total, icon: Archive, color: 'text-[#185b9d]' },
            { label: 'Verified', value: pageData.summary.VERIFIED, icon: CheckCircle2, color: 'text-emerald-700' },
            { label: 'Pending Review', value: pageData.summary.PENDING_REVIEW, icon: Clock3, color: 'text-amber-700' },
            { label: 'Rejected', value: pageData.summary.REJECTED, icon: XCircle, color: 'text-red-700' },
          ].map(stat => <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" key={stat.label}>
            <div className="text-[11px] text-slate-500 flex items-center gap-2"><stat.icon size={14} className={stat.color}/>{stat.label}</div>
            <p className="text-xl font-extrabold mt-1 tabular-nums">{stat.value.toLocaleString()}</p>
          </div>)}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 text-blue-800 p-3 text-sm flex items-start justify-between gap-3">
        <span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16}/></button>
      </div>}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex-[2] min-w-[220px]">
            <span className="sr-only">Search documents</span>
            <Search size={16} className="absolute top-2.5 left-3 text-slate-400"/>
            <input value={search} onChange={e => changeFilters(() => setSearch(e.target.value))}
              className={inputBase + ' pl-9'} placeholder="Student, roll number, application or filename"/>
          </label>
          <select aria-label="Document type" className={inputBase + ' flex-1 min-w-[155px]'} value={typeFilter} onChange={e => changeFilters(() => setTypeFilter(e.target.value))}>
            <option value="">All document types</option>
            {DOCUMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select aria-label="Review status" className={inputBase + ' flex-1 min-w-[155px]'} value={statusFilter} onChange={e => changeFilters(() => setStatusFilter(e.target.value))}>
            <option value="">All review statuses</option><option value="PENDING_REVIEW">Pending review</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option>
          </select>
          <select aria-label="Student class" className={inputBase + ' flex-1 min-w-[155px]'} value={classFilter} onChange={e => changeFilters(() => setClassFilter(e.target.value))}>
            <option value="">All classes</option>
            {pageData.classes.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">Search, counts and filters are calculated from the database, not only the current page. Existing documents without review history start as Pending Review.</p>
      </section>

      {loadError && <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-center justify-between gap-3">
        <span><AlertCircle size={15} className="inline mr-2"/>{loadError}</span><button className={neutralButton} onClick={refresh}>Retry</button>
      </div>}
      {loading && <p role="status" className="text-sm text-slate-500 flex gap-2 items-center"><Loader2 size={16} className="animate-spin"/>Loading private document metadata…</p>}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {pageData.documents.map(doc => {
          const isImage = doc.mimeType.startsWith('image/');
          return <article key={doc.id} className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden hover:border-blue-200 transition-colors">
            <button type="button" className="bg-slate-50 w-full h-28 flex items-center justify-center border-b border-slate-100 relative" onClick={() => openDocument(doc)} title="Inspect private document">
              {isImage ? <ImageIcon size={34} className="text-[#185b9d]"/> : <FileText size={34} className="text-[#185b9d]"/>}
              <span className="absolute bottom-2 left-2 bg-white text-slate-500 text-[10px] border px-2 py-0.5 rounded-md">{isImage ? 'Private image' : 'PDF / document'}</span>
            </button>
            <div className="p-3 space-y-2">
              <span className={'inline-block border rounded-full px-2 py-0.5 text-[10px] font-semibold ' + statusClass(doc.reviewStatus)}>{statusLabel(doc.reviewStatus)}</span>
              <div>
                <p className="text-xs font-bold text-slate-900 truncate" title={doc.originalFileName}>{doc.originalFileName}</p>
                <p className="text-xs text-slate-600 mt-1 truncate" title={doc.studentName}>{doc.studentName}</p>
                <p className="text-[11px] text-slate-500 truncate">{doc.applicationNo} · {doc.currentClass}</p>
              </div>
              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex justify-between gap-2">
                <span>{formatSize(doc.byteSize)}</span><span>{formatDate(doc.uploadedAt).split(',')[0]}</span>
              </div>
              <div className="flex gap-2">
                <button className={neutralButton + ' flex-1'} onClick={() => openDocument(doc)}><Eye size={14}/>Review</button>
                <button className={neutralButton} aria-label={'Download ' + doc.originalFileName} title="Download" onClick={() => downloadFile(doc)} disabled={busy}><Download size={14}/></button>
              </div>
            </div>
          </article>;
        })}
      </section>
      {!loading && !loadError && !pageData.documents.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Archive size={36} className="mx-auto text-slate-300 mb-3"/>
        <h2 className="font-semibold text-sm">No documents match these filters</h2>
        <p className="text-xs text-slate-500 mt-1">Change the filters or upload a new student document.</p>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 text-xs">
        <span className="text-slate-500">Page {pageData.pagination.page} of {pageData.pagination.totalPages} · {pageData.pagination.total} matching files</span>
        <div className="flex gap-2">
          <button className={neutralButton} onClick={() => setPage(current => Math.max(1, current - 1))} disabled={loading || page <= 1}><ChevronLeft size={14}/>Previous</button>
          <button className={neutralButton} onClick={() => setPage(current => Math.min(pageData.pagination.totalPages, current + 1))} disabled={loading || page >= pageData.pagination.totalPages}>Next<ChevronRight size={14}/></button>
        </div>
      </div>

      {selected && <div role="dialog" aria-modal="true" aria-label="Inspect document" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5">
        <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
          <header className="p-4 border-b border-slate-200 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 truncate">{selected.originalFileName}</h2>
              <p className="text-xs text-slate-500 mt-1">{selected.studentName} · {selected.applicationNo} · Revision {selected.revision}</p>
            </div>
            <button className={neutralButton} onClick={closeDocument}><X size={16}/>Close</button>
          </header>
          {notice && <div role="status" className="border-b border-blue-200 bg-blue-50 text-blue-800 p-2 text-xs">{notice}</div>}
          <div className="overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] gap-0">
            <div className="p-4 bg-slate-100 border-r border-slate-200 min-h-[360px]">
              {previewLoading ? <div className="h-96 flex items-center justify-center text-sm text-slate-500 gap-2"><Loader2 size={16} className="animate-spin"/>Loading private file…</div>
                : previewError ? <div role="alert" className="p-4 bg-white rounded-xl text-sm text-red-700">{previewError}</div>
                : selected.mimeType === 'application/pdf' ? <iframe title={'PDF preview ' + selected.originalFileName} src={previewUrl} className="w-full h-[510px] bg-white rounded-lg border border-slate-200"/>
                : selected.mimeType.startsWith('image/') ? <img src={previewUrl} alt={selected.originalFileName} className="max-w-full max-h-[510px] object-contain mx-auto rounded-lg shadow-sm bg-white"/>
                : <p className="text-sm text-slate-600">Preview unavailable for this file type. Download the original instead.</p>}
              <button className={neutralButton + ' mt-3'} onClick={() => downloadFile(selected)} disabled={busy}><Download size={14}/>Download Original</button>
            </div>
            <div className="p-4 space-y-5">
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"><ShieldCheck size={15}/>Individual File Review</h3>
                <span className={'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ' + statusClass(selected.reviewStatus)}>{statusLabel(selected.reviewStatus)}</span>
                {selected.reviewedByName && <p className="text-xs text-slate-500">Reviewed by {selected.reviewedByName} · {formatDate(selected.reviewedAt)}</p>}
                {selected.rejectionReason && <p className="text-xs text-red-700">Reason: {selected.rejectionReason}</p>}
                <textarea aria-label="Rejection reason" rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                  className={inputBase} placeholder="Required reason when rejecting a document (at least 5 characters)"/>
                <div className="flex flex-wrap gap-2">
                  <button className={buttonBase + ' bg-emerald-600 text-white hover:bg-emerald-700'} onClick={() => updateReview('VERIFIED')} disabled={busy}><CheckCircle2 size={14}/>Verify</button>
                  <button className={buttonBase + ' bg-red-600 text-white hover:bg-red-700'} onClick={() => updateReview('REJECTED')} disabled={busy}><XCircle size={14}/>Reject</button>
                  <button className={neutralButton} onClick={() => updateReview('PENDING_REVIEW')} disabled={busy}><RotateCw size={14}/>Reopen</button>
                </div>
              </section>
              <section className="space-y-2 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex gap-2 items-center"><UploadCloud size={15}/>Replace File</h3>
                <p className="text-xs text-slate-500">Keeps the former private file in history and resets this document's review status.</p>
                <input aria-label="Choose replacement file" type="file" accept="image/jpeg,image/png,application/pdf" className="block w-full text-xs text-slate-600" onChange={e => setReplacementFile(e.target.files?.[0] || null)}/>
                <button className={neutralButton} disabled={busy || !replacementFile || (['photo', 'signature'].includes(selected.documentType) && replacementFile?.type === 'application/pdf')} onClick={replaceDocument}>Replace and preserve previous version</button>
              </section>
              <section className="space-y-2 border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex gap-2 items-center"><History size={15}/>Audit History</h3>
                {historyLoading && <p className="text-xs text-slate-500 flex gap-2 items-center"><Loader2 size={14} className="animate-spin"/>Loading history…</p>}
                {history && !history.events.length && <p className="text-xs text-slate-500">Historical registration upload. No recorded vault actions yet.</p>}
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {history?.events.map(event => <div key={event.id} className="py-2 text-xs space-y-1">
                    <div className="flex justify-between gap-2"><strong>{event.action.replace(/_/g, ' ')}</strong><span className="text-slate-400">{formatDate(event.createdAt)}</span></div>
                    <p className="text-slate-500">{event.actorName}{event.fromStatus && event.toStatus ? ' · ' + statusLabel(event.fromStatus) + ' → ' + statusLabel(event.toStatus) : ''}</p>
                    {event.reason && <p className="text-red-700">Reason: {event.reason}</p>}
                    {event.priorVersionAvailable && <button className="text-[#185b9d] font-semibold hover:underline flex gap-1 items-center" onClick={() => downloadFile(selected, event.id)} disabled={busy}><Download size={12}/>Download earlier version</button>}
                  </div>)}
                </div>
                {history && history.pagination.totalPages > 1 && <div className="flex gap-2 items-center text-xs">
                  <button className={neutralButton} disabled={historyPage <= 1} onClick={() => loadHistory(selected.id, historyPage - 1)}>Previous</button>
                  <span>{historyPage} / {history.pagination.totalPages}</span>
                  <button className={neutralButton} disabled={historyPage >= history.pagination.totalPages} onClick={() => loadHistory(selected.id, historyPage + 1)}>Next</button>
                </div>}
              </section>
            </div>
          </div>
        </div>
      </div>}

      {uploadOpen && <div role="dialog" aria-modal="true" aria-label="Upload student document" className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 p-4">
        <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="flex justify-between gap-2 items-center">
            <h2 className="font-bold text-slate-900">Upload Private Student Document</h2>
            <button className={neutralButton} onClick={() => {if (!busy) setUploadOpen(false);}} disabled={busy}><X size={15}/>Close</button>
          </div>
          <p className="text-xs text-slate-500">Select a registered candidate; upload an image or PDF up to 5 MB. New files start Pending Review.</p>
          {notice && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">{notice}</div>}
          <div className="space-y-2">
            <label htmlFor="vault-student-search" className="block text-xs font-semibold">Find student by name or application number</label>
            <input id="vault-student-search" className={inputBase} value={candidateSearch} onChange={e => { setCandidateSearch(e.target.value); setChosenCandidate(null); }} placeholder="Type at least two characters"/>
            {candidateLoading && <p className="text-xs text-slate-500 flex gap-2"><Loader2 size={14} className="animate-spin"/>Searching candidate register…</p>}
            {chosenCandidate && <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex gap-2 items-center"><UserRound size={14}/>Selected: {chosenCandidate.fullName} · {chosenCandidate.applicationNo}</div>}
            {!chosenCandidate && candidateResults.length > 0 && <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {candidateResults.map(student => <button type="button" key={student.id} onClick={() => setChosenCandidate(student)} className="w-full text-left p-2 hover:bg-blue-50 text-xs">
                <strong>{student.fullName}</strong> <span className="text-slate-500">{student.applicationNo} · {student.currentClass}</span>
              </button>)}
            </div>}
          </div>
          <div className="space-y-1"><label htmlFor="vault-upload-type" className="block text-xs font-semibold">Document type</label>
            <select id="vault-upload-type" className={inputBase} value={uploadType} onChange={e => setUploadType(e.target.value as VaultDocumentType)}>
              {DOCUMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select></div>
          <div className="space-y-1"><label htmlFor="vault-upload-file" className="block text-xs font-semibold">Select file</label>
            <input id="vault-upload-file" className="block w-full text-xs text-slate-600" type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)}/></div>
          {uploadType === 'photo' && uploadFile?.type === 'application/pdf' && <p role="alert" className="text-xs text-red-700">Photos must be JPEG or PNG.</p>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button className={neutralButton} onClick={() => setUploadOpen(false)} disabled={busy}>Cancel</button>
            <button className={primaryButton} onClick={uploadDocument} disabled={busy || !chosenCandidate || !uploadFile || (['photo','signature'].includes(uploadType) && uploadFile?.type === 'application/pdf')}>
              {busy ? <Loader2 size={14} className="animate-spin"/> : <UploadCloud size={14}/>}Upload to Private Vault
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
};
