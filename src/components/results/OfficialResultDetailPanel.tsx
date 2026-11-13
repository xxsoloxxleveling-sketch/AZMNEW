import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Download, Eye, FileCheck2, Loader2, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  downloadElectronicDmc,
  downloadOfficialDmc,
  getOfficialDmcIssuances,
  getOfficialResultCorrections,
  getOfficialResultDetail,
  issuePreparedOfficialDmc,
  prepareOfficialDmc,
  previewElectronicDmc,
  previewPreparedOfficialDmc,
  printElectronicDmc,
  printOfficialDmc,
  revokeOfficialDmc,
  getOfficialAttemptChoices,
  bindOfficialAttempt,
} from './ResultsApi';
import type { OfficialAttemptChoice, OfficialCorrectionAudit, OfficialDocumentIssuance, OfficialResultDetail } from './ResultsApi';
import { OfficialResultCorrectionDialog } from './OfficialResultCorrectionDialog';

interface Props {
  resultId: string;
  source: 'STUDENT_PROFILE' | 'RESULTS_DASHBOARD';
  canEdit: boolean;
  onOpenProfile?: (studentId: string) => void;
  onResultChanged?: (result: OfficialResultDetail) => void;
}

const actionClass = 'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

export function OfficialResultDetailPanel({ resultId, source, canEdit, onOpenProfile, onResultChanged }: Props) {
  const [detail, setDetail] = useState<OfficialResultDetail | null>(null);
  const [corrections, setCorrections] = useState<OfficialCorrectionAudit[]>([]);
  const [issuances, setIssuances] = useState<OfficialDocumentIssuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string; preparationId?: string; idempotencyKey?: string } | null>(null);
  const [revokeId, setRevokeId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [attemptChoices,setAttemptChoices]=useState<OfficialAttemptChoice[]|null>(null);
  const [attemptId,setAttemptId]=useState('');
  const [attemptEvidence,setAttemptEvidence]=useState('');
  const [attemptConfirmed,setAttemptConfirmed]=useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextDetail, nextCorrections, nextIssuances] = await Promise.all([
        getOfficialResultDetail(resultId),
        getOfficialResultCorrections(resultId),
        getOfficialDmcIssuances(resultId),
      ]);
      setDetail(nextDetail);
      setCorrections(nextCorrections);
      setIssuances(nextIssuances);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this examination result.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    setEditing(false);
    setPreview(null);
    setRevokeId('');
    setRevokeReason('');
    setAttemptChoices(null); setAttemptId(''); setAttemptEvidence(''); setAttemptConfirmed(false);
    void load();
  }, [load]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);

  const handleSaved = (updated: OfficialResultDetail) => {
    setEditing(false);
    setDetail(updated);
    onResultChanged?.(updated);
    void load();
  };

  const loadAttempts=async()=>{if(!detail)return;setBusyAction('attempts');setError('');try{setAttemptChoices(await getOfficialAttemptChoices(detail.studentId));}catch(cause){setError(cause instanceof Error?cause.message:'Could not load roster attempts.');}finally{setBusyAction('');}};
  const confirmAttempt=async()=>{if(!detail||!attemptId||!attemptConfirmed)return;setBusyAction('bind-attempt');setError('');try{await bindOfficialAttempt(detail.id,attemptId,attemptEvidence);setAttemptChoices(null);setAttemptId('');setAttemptEvidence('');setAttemptConfirmed(false);await load();}catch(cause){setError(cause instanceof Error?cause.message:'Could not verify the attempt.');}finally{setBusyAction('');}};

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const showElectronicPreview = async () => {
    if (!detail) return;
    setBusyAction('preview-electronic'); setError('');
    try {
      const url = await previewElectronicDmc(detail.id);
      setPreview({ url, title: 'Electronic Detailed Marks Certificate' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'E-DMC preview is unavailable.'); }
    finally { setBusyAction(''); }
  };

  const prepareOfficialPreview = async () => {
    if (!detail) return;
    setBusyAction('prepare-official'); setError('');
    try {
      const preparation = await prepareOfficialDmc(detail.id, detail.resultRevision);
      const url = await previewPreparedOfficialDmc(detail.id, preparation.preparationId);
      setPreview({ url, title: 'Official Detailed Marks Certificate · Preview', preparationId: preparation.preparationId, idempotencyKey: createIdempotencyKey() });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The Official DMC preview could not be prepared.'); }
    finally { setBusyAction(''); }
  };

  const issuePrepared = async () => {
    if (!detail || !preview?.preparationId || !preview.idempotencyKey) return;
    setBusyAction('issue-official'); setError('');
    try {
      await issuePreparedOfficialDmc(detail.id, {
        preparationId: preview.preparationId,
        expectedRevision: detail.resultRevision,
        idempotencyKey: preview.idempotencyKey,
      });
      closePreview();
      await load();
      onResultChanged?.(detail);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Official DMC issuance failed.'); }
    finally { setBusyAction(''); }
  };

  const confirmRevoke = async () => {
    if (!detail || !revokeId || revokeReason.trim().length < 12) return;
    setBusyAction('revoke'); setError('');
    try {
      await revokeOfficialDmc(detail.id, revokeId, { reason: revokeReason.trim() });
      setRevokeId(''); setRevokeReason('');
      await load();
      onResultChanged?.(detail);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The document could not be revoked.'); }
    finally { setBusyAction(''); }
  };

  if (loading) return <div className="flex items-center gap-2 border-t border-slate-200 py-5 text-sm text-slate-600"><Loader2 size={16} className="animate-spin" />Loading official result…</div>;
  if (!detail) return <div role="alert" className="border-t border-red-200 py-4 text-sm text-red-900"><div className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" /><div><strong>Official result unavailable.</strong><p className="mt-1">{error}</p><button type="button" onClick={() => void load()} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={13} /> Retry</button></div></div></div>;

  const electronicReady = detail.documents.electronicAvailable;
  const currentIssued = issuances.find((item) => item.status === 'ISSUED' && item.resultRevision === detail.resultRevision);
  const profileAction = () => {
    onOpenProfile?.(detail.studentId);
    if (!onOpenProfile) window.dispatchEvent(new CustomEvent('azm:open-student-results-profile', { detail: { studentId: detail.studentId, resultId: detail.id, examinationId: detail.examinationId, section: 'results' } }));
  };

  return (
    <section aria-label="Official examination result details" className="border-t border-slate-300 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Official exam-specific record · revision {detail.resultRevision}</p>
          <h2 className="mt-1 text-base font-bold text-slate-900">{detail.student.fullName} · {detail.student.rollNumber || detail.student.applicationNo}</h2>
          <p className="mt-1 text-xs text-slate-600">{detail.student.classGroup} · {detail.examination.title} · {detail.examination.examDate || 'Date unavailable'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={profileAction} className={actionClass}><ArrowUpRight size={14} /> View student profile</button>
          <button type="button" disabled={!canEdit||!detail.attempt} title={!canEdit ? 'Only a Super Admin can correct official results' : !detail.attempt ? 'Verify the examination attempt first' : 'Correct this official result'} onClick={() => setEditing(true)} className={actionClass}>Edit result</button>
          <button type="button" onClick={() => void load()} disabled={loading || !!busyAction} className={actionClass}><RefreshCw size={14} /> Refresh</button>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-slate-200 py-3 text-xs sm:grid-cols-4 xl:grid-cols-6">
        <Fact label="Exam" value={detail.examination.reference} />
        <Fact label="Session" value={detail.examination.sessionReference} />
        <Fact label="Result reference" value={detail.resultReference} />
        <Fact label="Identity" value={detail.identityStatus} />
        <Fact label="Scoring" value={detail.scoringStatus} />
        <Fact label="Verification" value={detail.verificationStatus} />
        <Fact label="Publication" value={detail.publicationStatus} />
        <Fact label="Marks" value={detail.obtainedMarks === null ? 'Unavailable' : `${detail.obtainedMarks} / ${detail.maximumMarks}`} />
        <Fact label="Percentage" value={percentage(detail.obtainedMarks, detail.maximumMarks)} />
        <Fact label="Paper version" value={detail.paperVersion || 'Unavailable'} />
        <Fact label="Paper versions" value={detail.examination.paperVersions.join(', ') || 'Not configured'} />
        <Fact label="Document status" value={currentIssued ? `Official DMC · ${currentIssued.documentNumber}` : 'Official DMC not issued'} />
      </dl>

      <section className="mt-3 rounded border border-slate-200 p-3 text-xs" aria-label="Examination attempt association">
        <h3 className="font-semibold">Examination attempt</h3>
        {detail.attempt ? <p>Attempt {detail.attempt.attemptNumber} · {detail.attempt.businessDate} · {detail.attempt.state === 'CURRENT' ? 'Current' : 'Historical'} · verified {formatDate(detail.attempt.boundAt)}</p> : <>
          <p className="mt-1 text-amber-800">Not verified. Result verification, publication and DMC issuance require an explicitly verified roster attempt.</p>
          {canEdit && !attemptChoices && <button type="button" className={actionClass+' mt-2'} disabled={!!busyAction} onClick={()=>void loadAttempts()}>Review roster attempts</button>}
          {canEdit && attemptChoices && <div className="mt-2 space-y-2">
            <p>Choose the attempt only after checking that its roster and the examination record refer to the same paper. This association cannot be changed.</p>
            <label className="block">Roster attempt <select className="ml-2 rounded border p-1" value={attemptId} onChange={e=>setAttemptId(e.target.value)}><option value="">Select a verified attempt</option>{attemptChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.businessDate} · {choice.center||'Center unavailable'} · {choice.hall} · attempt {choice.attemptNumber} · {choice.state}</option>)}</select></label>
            {attemptChoices.length===0&&<p>No frozen roster attempt was found for this student.</p>}
            <label className="block">Evidence reference <textarea className="mt-1 block w-full rounded border p-2" value={attemptEvidence} maxLength={1000} onChange={e=>setAttemptEvidence(e.target.value)} /></label>
            <label className="flex gap-2"><input type="checkbox" checked={attemptConfirmed} onChange={e=>setAttemptConfirmed(e.target.checked)}/>I checked the examination record, candidate and original roster.</label>
            <button type="button" className={actionClass} disabled={!!busyAction||!attemptId||attemptEvidence.trim().length<12||!attemptConfirmed} onClick={()=>void confirmAttempt()}>Confirm verified attempt</button>
          </div>}
        </>}
      </section>

      {detail.administrativelyAdjusted && <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"><strong>Administratively adjusted score.</strong> Original question classifications remain unchanged. {detail.administrativeAdjustmentReason || ''}</p>}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,1fr)]">
        <section className="rounded-md border border-slate-200 p-3" aria-label="Answer summary">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Answer summary</h3>
          <dl className="mt-3 grid grid-cols-2 gap-y-3 text-xs sm:grid-cols-5">
            <Fact label="Correct" value={countText(detail.correctCount)} />
            <Fact label="Wrong" value={countText(detail.wrongCount)} />
            <Fact label="Blank" value={countText(detail.blankCount)} />
            <Fact label="Multiple" value={countText(detail.multipleCount)} />
            <Fact label="Uncertain" value={countText(detail.uncertainCount)} />
          </dl>
          {detail.responses.length > 0 ? <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200"><table className="w-full min-w-[420px] text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="px-2 py-2">Q#</th><th className="px-2 py-2">Detected</th><th className="px-2 py-2">Reviewed</th><th className="px-2 py-2">Classification</th><th className="px-2 py-2 text-right">Marks</th></tr></thead><tbody className="divide-y divide-slate-100">{detail.responses.map((row) => <tr key={row.questionNumber}><td className="px-2 py-1.5">{row.questionNumber}</td><td className="px-2 py-1.5">{row.detectedAnswer || '—'}</td><td className="px-2 py-1.5">{row.reviewedAnswer || '—'}</td><td className="px-2 py-1.5">{row.classification}</td><td className="px-2 py-1.5 text-right">{row.marksAwarded ?? '—'}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-xs text-slate-500">Question-level responses were not recorded.</p>}
        </section>

        <section className="rounded-md border border-slate-200 p-3" aria-label="Result documents">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Result documents</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">No candidate self-service download is enabled until secure student sign-in is implemented. Staff actions below require authenticated admin access.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!electronicReady || !!busyAction} title={electronicReady ? 'Preview a private E-DMC for this published result' : 'E-DMC will be available after official publication and verification'} onClick={() => void showElectronicPreview()} className={actionClass}><Eye size={14} /> Preview E-DMC</button>
            <button type="button" disabled={!electronicReady || !!busyAction} title={electronicReady ? 'Download a private E-DMC' : 'E-DMC will be available after official publication and verification'} onClick={() => void downloadElectronicDmc(detail.id, safeFilename('AZM_E-DMC', detail.examination.reference, detail.student.rollNumber || detail.student.applicationNo))} className={actionClass}><Download size={14} /> Download E-DMC</button>
            <button type="button" disabled={!electronicReady || !!busyAction} title={electronicReady ? 'Open E-DMC for printing' : 'E-DMC is unavailable until publication and verification'} onClick={() => void printElectronicDmc(detail.id)} className={actionClass}><Printer size={14} /> Print E-DMC</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{electronicReady ? 'This result is eligible for the E-DMC.' : 'E-DMC will be available after official result publication, verification, and resolution of uncertain answers.'}</p>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-slate-800">Official DMC</h4>
              <button type="button" disabled={!canEdit || !electronicReady || !!busyAction} title={!canEdit ? 'Only a Super Admin may issue an Official DMC' : !electronicReady ? 'A verified published result is required' : 'Prepare exact Official DMC preview'} onClick={() => void prepareOfficialPreview()} className={actionClass}><FileCheck2 size={14} /> Preview / issue</button>
            </div>
            <div className="mt-2 space-y-2 text-xs">
              {issuances.length ? issuances.map((issuance) => <div key={issuance.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-2">
                <div><p className="font-semibold text-slate-800">{issuance.documentNumber} · {issuance.status}</p><p className="mt-0.5 text-[11px] text-slate-500">Revision {issuance.resultRevision} · {formatDate(issuance.issuedAt)} · {issuance.issuer}</p>{issuance.reason && <p className="mt-0.5 text-[11px] text-slate-500">Latest event: {issuance.reason}</p>}</div>
                <div className="flex gap-1.5">
                  <button type="button" disabled={issuance.status !== 'ISSUED' || !!busyAction} title={issuance.status !== 'ISSUED' ? 'Only a current issued certificate is downloadable' : 'Download current Official DMC'} onClick={() => void downloadOfficialDmc(detail.id, issuance.id, safeFilename('AZM_Official_DMC', detail.examination.reference, detail.student.rollNumber || detail.student.applicationNo))} className="rounded border border-slate-300 px-2 py-1 font-semibold disabled:opacity-40">Download</button>
                  <button type="button" disabled={issuance.status !== 'ISSUED' || !!busyAction} title={issuance.status !== 'ISSUED' ? 'Only a current issued certificate can be printed' : 'Print Official DMC'} onClick={() => void printOfficialDmc(detail.id, issuance.id)} className="rounded border border-slate-300 px-2 py-1 font-semibold disabled:opacity-40">Print</button>
                  {canEdit && issuance.status === 'ISSUED' && <button type="button" disabled={!!busyAction} onClick={() => { setRevokeId(issuance.id); setRevokeReason(''); }} className="rounded border border-red-300 px-2 py-1 font-semibold text-red-800 disabled:opacity-40">Revoke</button>}
                </div>
              </div>) : <p className="rounded bg-slate-50 px-3 py-3 text-slate-600">No Official DMC has been issued for this result revision.</p>}
            </div>
          </div>
        </section>
      </div>

      {revokeId && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3" role="group" aria-label="Revoke official DMC">
        <label className="block text-xs font-semibold text-red-950">Reason for revoking this Official DMC<textarea className="mt-1 w-full rounded border border-red-300 bg-white px-3 py-2 text-sm" rows={2} maxLength={1000} value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} /></label>
        <p className="mt-1 text-[11px] text-red-900">A reason of at least 12 characters is required. Revocation is recorded and cannot be undone.</p>
        <div className="mt-2 flex justify-end gap-2"><button type="button" disabled={!!busyAction} onClick={() => setRevokeId('')} className={actionClass}>Cancel</button><button type="button" disabled={busyAction === 'revoke' || revokeReason.trim().length < 12} onClick={() => void confirmRevoke()} className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busyAction === 'revoke' ? 'Revoking…' : 'Confirm revoke'}</button></div>
      </div>}

      {corrections.length > 0 && <section className="mt-4" aria-label="Result correction history">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Correction history</h3>
        <div className="mt-2 overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="px-2 py-2">Revision</th><th className="px-2 py-2">When / who</th><th className="px-2 py-2">Reason</th><th className="px-2 py-2">Publication impact</th></tr></thead><tbody className="divide-y divide-slate-100">{corrections.map((entry) => <tr key={entry.id}><td className="px-2 py-2">v{entry.previousRevision} → v{entry.newRevision}</td><td className="px-2 py-2">{formatDate(entry.occurredAt)}<br /><span className="text-slate-500">{entry.actorName}</span></td><td className="max-w-xs whitespace-normal px-2 py-2">{entry.reason}</td><td className="px-2 py-2">{entry.publicationImpact}</td></tr>)}</tbody></table></div>
      </section>}

      {error && <p role="alert" className="mt-3 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
      {detail.uncertainCount !== null && detail.uncertainCount > 0 && <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"><ShieldCheck size={14} className="mr-1 inline" />{detail.uncertainCount} response(s) remain unresolved. Final DMCs stay unavailable until the result is resolved.</p>}

      {editing && <OfficialResultCorrectionDialog result={detail} source={source} onCancel={() => setEditing(false)} onSaved={handleSaved} />}
      {preview && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-2 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="dmc-preview-title" className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 id="dmc-preview-title" className="text-sm font-bold text-slate-900">{preview.title}</h2><p className="mt-1 text-[11px] text-slate-500">Result revision {detail.resultRevision} · private preview</p></div><button type="button" onClick={closePreview} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold">Close preview</button></header>
          <iframe title={preview.title} src={preview.url} className="min-h-0 flex-1 bg-slate-100" />
          {preview.preparationId && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3"><p className="text-xs text-slate-600">Review the exact certificate above. Issuance records this revision and makes it the current Official DMC.</p><div className="flex gap-2"><button type="button" disabled={!!busyAction} onClick={closePreview} className={actionClass}>Cancel</button><button type="button" disabled={!!busyAction} onClick={() => void issuePrepared()} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyAction === 'issue-official' ? 'Issuing…' : 'Confirm and issue Official DMC'}</button></div></footer>}
        </section>
      </div>}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>;
}

function countText(value: number | null) { return value === null ? 'Not available' : String(value); }

function percentage(obtained: string | null, maximum: string) {
  if (obtained === null || !Number.isFinite(Number(obtained)) || !Number.isFinite(Number(maximum)) || Number(maximum) <= 0) return 'Unavailable';
  return `${((Number(obtained) / Number(maximum)) * 100).toFixed(2)}%`;
}

function safeFilename(prefix: string, exam: string, roll: string) {
  const safe = (value: string) => value.normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'result';
  return `${prefix}_${safe(exam)}_${safe(roll)}.pdf`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function createIdempotencyKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
