import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, RefreshCw, Save, Search, Users } from 'lucide-react';
import { assessmentApi } from './assessmentApi';
import type { AssessmentFilters, AssessmentPanel, AssessmentRoster, CandidateAssessment, CandidateAssessmentDetail, SaveAssessmentInput } from './assessmentApi';
import { assessmentPayload, draftTotals, formatAssessmentScore, makeAssessmentDraft, submissionIssues } from './assessmentViewModel';
import type { AssessmentDraft } from './assessmentViewModel';
import { AssessmentTotalsStrip, assessmentUi as ui, writtenMarkLabel } from './assessmentUi';

const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed. Please retry.';

function PanelMembersEditor({ roundId, panelNumbers, panels, disabled, onSaved }: {
  roundId: string; panelNumbers: number[]; panels: AssessmentPanel[]; disabled: boolean; onSaved: () => void;
}) {
  const [panelNumber, setPanelNumber] = useState<number | ''>('');
  const [names, setNames] = useState(['', '', '']);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = panels.find(panel => panel.panel === panelNumber);
  useEffect(() => {
    setNames([1, 2, 3].map(position => selected?.members.find(member => member.position === position)?.name ?? ''));
    setReason('');
    setError('');
  }, [panelNumber, selected?.revision, roundId]);
  useEffect(() => { setNotice(''); }, [panelNumber, roundId]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!panelNumber || disabled) return;
    const trimmed = names.map(name => name.trim());
    if (trimmed.some(name => name.length < 2) || new Set(trimmed.map(name => name.toLowerCase())).size !== 3) {
      setError('Enter three different panel member names.');
      return;
    }
    if (selected && !window.confirm('Changing this panel creates a new membership revision. Existing assessments will need review and resubmission with the current members. Continue?')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await assessmentApi.savePanel(roundId, panelNumber, { expectedRevision: selected?.revision ?? 0, members: trimmed.map(name => ({ name })), reason: reason.trim() });
      onSaved();
      setNotice('Panel ' + panelNumber + ' members saved.');
    } catch (err) { setError(message(err)); }
    finally { setSaving(false); }
  }
  return <details className="border border-slate-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-semibold text-slate-900"><Users size={16} className="mr-2 inline-block" />Panel members</summary>
    <p className="mt-2 text-xs text-slate-500">Record the three assessors for each panel. An administrator may enter their paper scores; the assessor names remain attached to each saved assessment. Changes after a submitted assessment require a Super Admin.</p>
    {error && <div role="alert" className={ui.error + ' mt-3'}>{error}</div>}
    {notice && <div role="status" className={ui.notice + ' mt-3'}>{notice}</div>}
    <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label><span className={ui.label}>Panel</span><select required aria-label="Panel" className={ui.input} value={panelNumber} disabled={disabled || saving} onChange={event => setPanelNumber(event.target.value ? Number(event.target.value) : '')}><option value="">Choose panel</option>{panelNumbers.map(panel => <option key={panel} value={panel}>Panel {panel}</option>)}</select></label>
      {names.map((name, index) => <label key={index}><span className={ui.label}>Member {index + 1} name</span><input required minLength={2} maxLength={100} className={ui.input} value={name} disabled={disabled || saving || !panelNumber} onChange={event => setNames(current => current.map((value, i) => i === index ? event.target.value : value))} /></label>)}
      <label className="sm:col-span-2 xl:col-span-3"><span className={ui.label}>Setup / change reason</span><input required minLength={3} maxLength={2000} className={ui.input} value={reason} disabled={disabled || saving || !panelNumber} onChange={event => setReason(event.target.value)} placeholder="Panel appointment or replacement reference" /></label>
      <div className="flex items-end"><button type="submit" className={ui.button} disabled={disabled || saving || !panelNumber}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save panel members</button></div>
    </form>
  </details>;
}

export function InterviewAssessmentView({ roundId, canEdit, isSuperAdmin, onDirtyChange }: {
  roundId: string; canEdit: boolean; isSuperAdmin: boolean; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [roster, setRoster] = useState<AssessmentRoster | null>(null);
  const [filterDraft, setFilterDraft] = useState({ search: '', panel: '', batch: '', className: '' });
  const [filters, setFilters] = useState<AssessmentFilters>({});
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<CandidateAssessmentDetail | null>(null);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const retryMutation = useRef<{ body: string; key: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = Boolean(draft && JSON.stringify(draft) !== baseline);

  useEffect(() => { onDirtyChange?.(dirty || saving); }, [dirty, saving, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLeave);
    return () => window.removeEventListener('beforeunload', preventLeave);
  }, [dirty]);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    void assessmentApi.roster(roundId, { ...filters, page, limit: 25 }).then(next => {
      if (!active) return;
      setRoster(next);
      if (next.pagination.totalPages > 0 && page > next.pagination.totalPages) setPage(next.pagination.totalPages);
    }).catch(err => { if (active) setLoadError(message(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roundId, filters, page, refresh]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDraft(null); return; }
    let active = true;
    setDetailLoading(true); setError(''); setConflict(false); setDetail(null); setDraft(null);
    void assessmentApi.candidate(roundId, selectedId).then(next => {
      if (!active) return;
      const value = makeAssessmentDraft(next.assessment, next.panelConfiguration);
      setDetail(next); setDraft(value); setBaseline(JSON.stringify(value)); retryMutation.current = null;
    }).catch(err => { if (active) setError(message(err)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [roundId, selectedId, detailRefresh]);

  const selectCandidate = useCallback((id: string) => {
    if (saving || detailLoading) return;
    if (dirty && !window.confirm('Discard the unsaved assessment entries and open another candidate?')) return;
    setSelectedId(id); setNotice('');
  }, [dirty, saving, detailLoading]);

  function updateDraft<K extends keyof AssessmentDraft>(key: K, value: AssessmentDraft[K]) {
    setDraft(current => current ? { ...current, [key]: value } : current);
    setNotice('');
  }

  const calculation = useMemo(() => {
    if (!draft || !detail?.panelConfiguration) return null;
    try {
      const payload = assessmentPayload(draft, detail.assessment, detail.panelConfiguration);
      return { payload, totals: draftTotals(payload, detail.written), issues: submissionIssues(payload, detail.written, detail.assessment, detail.hasSubmittedAssessment), error: '' };
    } catch (err) { return { payload: null, totals: null, issues: [], error: message(err) }; }
  }, [draft, detail]);

  async function persist(kind: 'draft' | 'submit', next = false) {
    if (!draft || !detail?.panelConfiguration || !canEdit || ((detail.hasSubmittedAssessment || detail.assessment?.status === 'SUBMITTED') && !isSuperAdmin) || saving || conflict || !formRef.current?.reportValidity()) return;
    setError(''); setNotice('');
    try {
      const body: SaveAssessmentInput = assessmentPayload(draft, detail.assessment, detail.panelConfiguration);
      if ((detail.hasSubmittedAssessment || detail.assessment?.status === 'SUBMITTED') && (body.reason?.length ?? 0) < 3) throw new Error('Enter a reason for correcting the submitted assessment.');
      if (kind === 'submit') {
        const issues = submissionIssues(body, detail.written, detail.assessment, detail.hasSubmittedAssessment);
        if (issues.length) throw new Error(issues.join(' '));
      }
      setSaving(true);
      const serialized = kind + ':' + JSON.stringify(body);
      if (retryMutation.current?.body !== serialized) retryMutation.current = { body: serialized, key: crypto.randomUUID() };
      const request = { ...body, idempotencyKey: retryMutation.current.key };
      const saved = kind === 'submit'
        ? await assessmentApi.submit(roundId, selectedId, request)
        : await assessmentApi.save(roundId, selectedId, request);
      const value = makeAssessmentDraft(saved, detail.panelConfiguration);
      setDetail(current => current ? { ...current, written: saved.written, assessment: saved, hasSubmittedAssessment: current.hasSubmittedAssessment || kind === 'submit' } : current);
      setDraft(value); setBaseline(JSON.stringify(value)); retryMutation.current = null;
      setNotice((kind === 'submit' ? 'Assessment submitted' : 'Draft saved') + ' for ' + detail.studentName + ' · revision ' + saved.revision + '.');
      setRefresh(current => current + 1);
      if (next) {
        const index = roster?.rows.findIndex(row => row.placementId === selectedId) ?? -1;
        const nextRow = index >= 0 ? roster?.rows[index + 1] : undefined;
        if (nextRow) setSelectedId(nextRow.placementId);
        else setNotice('Draft saved for ' + detail.studentName + '. You reached the end of this page; use the roster pagination to continue.');
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        setConflict(true);
        setError(message(err) + ' Your unsaved entries remain in this form. Review them before loading the latest record.');
      } else setError(message(err));
    } finally { setSaving(false); }
  }

  function reloadSelected() {
    if (dirty && !window.confirm('Loading the latest record will discard the unsaved entries currently shown. Continue?')) return;
    setDetailRefresh(value => value + 1); setNotice('');
  }

  const selectedRosterRow = roster?.rows.find(row => row.placementId === selectedId);
  const previousPanel = Boolean(detail?.assessment && detail.panelConfiguration && detail.assessment.panelRevision !== detail.panelConfiguration.revision);
  const everSubmitted = Boolean(detail?.hasSubmittedAssessment || detail?.assessment?.status === 'SUBMITTED');
  const correctionRestricted = everSubmitted && !isSuperAdmin;
  const controlsDisabled = !canEdit || saving || conflict || correctionRestricted;

  return <section className="space-y-4" aria-label="Interview marks and assessments">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold text-slate-900">Marks & assessments</h3><p className="mt-1 text-sm text-slate-600">Three member scores per candidate. Written marks come from the final verified exam result; the fixed timetable stays locked.</p></div>
      <button type="button" className={ui.button} disabled={loading || saving} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} />Refresh roster</button>
    </div>
    {!canEdit && <p className="border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">This round is read-only. Existing assessments and merit previews remain available.</p>}
    {loadError && <div role="alert" className={ui.error}>{loadError}<button type="button" className={ui.button + ' ml-3'} onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
    {roster && <PanelMembersEditor roundId={roundId} panelNumbers={roster.panelOptions} panels={roster.panels} disabled={!canEdit || saving || dirty} onSaved={() => { setRefresh(value => value + 1); if (selectedId) setDetailRefresh(value => value + 1); }} />}
    <form className="grid gap-3 border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]" onSubmit={event => {
      event.preventDefault(); setPage(1);
      setFilters({ search: filterDraft.search.trim(), panel: filterDraft.panel ? Number(filterDraft.panel) : undefined, batch: filterDraft.batch ? Number(filterDraft.batch) : undefined, className: filterDraft.className });
    }}>
      <label><span className={ui.label}>Name or roll number</span><input className={ui.input} value={filterDraft.search} onChange={event => setFilterDraft(current => ({ ...current, search: event.target.value }))} /></label>
      <label><span className={ui.label}>Panel</span><select className={ui.input} value={filterDraft.panel} onChange={event => setFilterDraft(current => ({ ...current, panel: event.target.value }))}><option value="">All panels</option>{roster?.panelOptions.map(panel => <option key={panel} value={panel}>Panel {panel}</option>)}</select></label>
      <label><span className={ui.label}>Batch</span><select className={ui.input} value={filterDraft.batch} onChange={event => setFilterDraft(current => ({ ...current, batch: event.target.value }))}><option value="">All batches</option>{roster?.batchOptions.map(batch => <option key={batch} value={batch}>Batch {batch}</option>)}</select></label>
      <label><span className={ui.label}>Class</span><select className={ui.input} value={filterDraft.className} onChange={event => setFilterDraft(current => ({ ...current, className: event.target.value }))}><option value="">All classes</option>{roster?.classOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className="flex items-end"><button type="submit" className={ui.button} disabled={loading || saving}><Search size={15} />Apply filters</button></div>
    </form>
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-500"><span>{roster ? roster.pagination.total + ' candidates · 25 per page' : 'Loading fixed roster…'}</span>{loading && <span role="status" className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" />Loading</span>}</div>
      <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[720px]"><thead><tr><th className={ui.th}>Candidate</th><th className={ui.th}>Class</th><th className={ui.th}>Panel / batch</th><th className={ui.th}>Time</th><th className={ui.th}>Written /100</th><th className={ui.th}>Assessment</th><th className={ui.th}>Open</th></tr></thead><tbody>
        {roster?.rows.map(row => <tr key={row.placementId} className={selectedId === row.placementId ? 'bg-blue-50' : 'hover:bg-slate-50'}>
          <td className={ui.td}><span className="block font-medium text-slate-900">{row.studentName}</span><span className="text-xs text-slate-500">{row.rollNumber ?? 'No roll number'}</span></td><td className={ui.td}>{row.className}</td><td className={ui.td}>{row.panel} / {row.batch}<span className="block text-xs text-slate-500">Sequence {row.sequence}</span></td><td className={ui.td}>{row.slotTime}</td><td className={ui.td}>{formatAssessmentScore(row.written.marks)}<span className={'block text-xs ' + (row.written.isFinal ? 'text-emerald-700' : 'text-amber-800')}>{writtenMarkLabel(row.written)}</span></td><td className={ui.td}>{row.assessment?.status === 'SUBMITTED' ? row.assessment.attendance === 'ABSENT' ? 'Absent · submitted' : 'Submitted' : row.assessment ? 'Draft' : 'Not entered'}</td><td className={ui.td}><button type="button" className={ui.button} disabled={saving || detailLoading} onClick={() => selectCandidate(row.placementId)} aria-label={'Open assessment for ' + row.studentName}>{selectedId === row.placementId ? 'Open' : 'Assess'}</button></td>
        </tr>)}
        {roster && roster.rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-500">No fixed placements match these filters. Assessment entry uses the approved imported timetable.</td></tr>}
      </tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="text-xs text-slate-500">Page {roster?.pagination.page ?? page} of {Math.max(1, roster?.pagination.totalPages ?? 1)}</span><div className="flex gap-2"><button type="button" className={ui.button} disabled={page <= 1 || loading || saving} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} />Previous</button><button type="button" className={ui.button} disabled={!roster || page >= roster.pagination.totalPages || loading || saving} onClick={() => setPage(value => value + 1)}>Next<ChevronRight size={15} /></button></div></div>
    </div>
    {notice && <div role="status" className={ui.notice}>{notice}</div>}
    {error && <div role="alert" className={ui.error}><AlertCircle size={16} className="mr-2 inline" />{error}{selectedId && <button type="button" disabled={saving || detailLoading} className={ui.button + ' ml-3'} onClick={reloadSelected}>Load latest record</button>}</div>}
    {detailLoading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading candidate assessment…</p>}
    {!selectedId && <p className="text-sm text-slate-500">Choose a candidate from the roster to enter or review marks.</p>}
    {detail && draft && <form ref={formRef} onSubmit={event => { event.preventDefault(); void persist('draft'); }} className="space-y-4 border border-slate-200 bg-white p-4" aria-label={'Assessment for ' + detail.studentName}>
      {correctionRestricted && <p className="border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">This submitted assessment is read-only. A Super Admin can record a correction with a reason.</p>}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h4 className="font-semibold text-slate-900">{detail.studentName}</h4><p className="mt-1 text-sm text-slate-600">{detail.rollNumber ?? 'No roll number'} · {detail.className} · Panel {detail.panelConfiguration?.panel ?? selectedRosterRow?.panel ?? '—'} / batch {detail.batch} · {detail.slotTime}</p></div><div className="text-right text-xs text-slate-500">{dirty ? 'Unsaved changes' : detail.assessment ? 'Saved revision ' + detail.assessment.revision + ' · ' + detail.assessment.status.toLowerCase() : 'No saved assessment'}{detail.assessment && <span className="mt-1 block">Entered by {detail.assessment.actorName} · {new Date(detail.assessment.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</span>}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><span className={ui.label}>Final written exam</span><p className="font-semibold text-slate-900">{formatAssessmentScore(detail.written.marks)} / {detail.written.maximumMarks}</p><p className={'mt-1 text-xs ' + (detail.written.isFinal ? 'text-emerald-700' : 'text-amber-800')}>{writtenMarkLabel(detail.written)}</p>{detail.written.reference && <p className="mt-1 break-all text-xs text-slate-500">{detail.written.reference}</p>}<p className="mt-1 text-xs text-slate-500">Schedule printed mark: {detail.printedMarks} · comparison only</p></div><label><span className={ui.label}>Interview attendance</span><select aria-label="Interview attendance" className={ui.input} value={draft.attendance} disabled={controlsDisabled} onChange={event => updateDraft('attendance', event.target.value as AssessmentDraft['attendance'])}><option value="UNKNOWN">Not recorded</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select></label></div>
      {!detail.panelConfiguration && <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Set up this panel’s three members above before saving an assessment.</p>}
      {previousPanel && <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>The panel membership has changed. Enter new scores for the current members; previous scores have not been reassigned.</p><details className="mt-2"><summary className="cursor-pointer font-medium">Previous submitted member scores</summary><ul className="mt-2 space-y-1">{detail.assessment?.members.map(member => { const score = detail.assessment?.scores.find(item => item.memberId === member.id); return <li key={member.id}>{member.name}: interview {formatAssessmentScore(score?.interview)} /20 · personality {formatAssessmentScore(score?.personality)} /5</li>; })}</ul></details></div>}
      <fieldset disabled={controlsDisabled || !detail.panelConfiguration} className="space-y-3"><legend className="mb-2 text-sm font-semibold text-slate-900">Individual panel member scores</legend>
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(80px,140px)_minmax(80px,140px)]"><div className="text-xs font-semibold text-slate-500">Assessor</div><div className="text-xs font-semibold text-slate-500">Interview /20</div><div className="text-xs font-semibold text-slate-500">Personality /5</div>
          {detail.panelConfiguration?.members.map((member, index) => <MemberScoreRow key={member.id} memberName={member.name} position={member.position} interview={draft.scores[index]?.interview ?? ''} personality={draft.scores[index]?.personality ?? ''} disabled={controlsDisabled} onChange={(field, value) => updateDraft('scores', draft.scores.map(score => score.memberId === member.id ? { ...score, [field]: value } : score))} />)}
        </div><p className="text-xs text-slate-500">Each component uses the average of all three members. Personality covers discipline, confidence and overall personality. Blank means pending; enter 0 only when zero was awarded.</p>
      </fieldset>
      <fieldset disabled={controlsDisabled || !detail.panelConfiguration} className="grid gap-4 border-t border-slate-200 pt-3 sm:grid-cols-2"><legend className="text-sm font-semibold text-slate-900">Evidence-based components</legend>
        <EvidenceScore label="Extracurricular activities" maximum={10} score={draft.extracurricular} evidence={draft.extracurricularEvidence} reviewed={draft.extracurricularReviewed} onScore={value => updateDraft('extracurricular', value)} onEvidence={value => updateDraft('extracurricularEvidence', value)} onReviewed={value => updateDraft('extracurricularReviewed', value)} />
        <EvidenceScore label="Previous academic record" maximum={5} score={draft.academic} evidence={draft.academicEvidence} reviewed={draft.academicReviewed} onScore={value => updateDraft('academic', value)} onEvidence={value => updateDraft('academicEvidence', value)} onReviewed={value => updateDraft('academicReviewed', value)} />
      </fieldset>
      <p className="text-xs text-slate-500">Use the approved assessment sheet for component marks. Record the evidence reference used to verify each score.</p>
      <label className="block"><span className={ui.label}>Assessment notes</span><textarea className={ui.input + ' min-h-20'} maxLength={4000} value={draft.notes} disabled={controlsDisabled} onChange={event => updateDraft('notes', event.target.value)} /></label>
      {(everSubmitted || previousPanel) && <label className="block"><span className={ui.label}>Correction reason *</span><input required minLength={3} maxLength={2000} className={ui.input} value={draft.reason} disabled={controlsDisabled} onChange={event => updateDraft('reason', event.target.value)} placeholder="Explain the revised score, source check or panel reassessment" /></label>}
      {calculation?.totals && <AssessmentTotalsStrip totals={calculation.totals} label={dirty || !detail.assessment ? 'Unsaved calculation · provisional' : 'Calculation preview · provisional'} />}
      {detail.assessment && <p className="text-xs text-slate-500">Last saved server total: {formatAssessmentScore(detail.assessment.totals.total)} /100. {detail.assessment.status === 'DRAFT' ? 'Drafts are excluded from ranked merit.' : 'Submitted records remain subject to current source and completeness checks.'}</p>}
      {draft.attendance === 'ABSENT' && <p className="text-sm text-amber-800">An absent candidate is recorded as absent and excluded from merit. No missing score is converted to zero.</p>}
      {calculation?.error && <p role="alert" className="text-sm text-red-700">{calculation.error}</p>}
      {calculation && calculation.issues.length > 0 && <div className="text-sm text-amber-800"><p className="font-medium">Before submission</p><ul className="mt-1 list-disc space-y-1 pl-5">{calculation.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      {detail.assessment && detail.assessment.issues.length > 0 && <details className="text-sm text-slate-600"><summary className="cursor-pointer">Last saved record checks</summary><ul className="mt-1 list-disc pl-5">{detail.assessment.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3"><button type="submit" className={ui.button} disabled={controlsDisabled || !detail.panelConfiguration}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save draft</button><button type="button" className={ui.button} disabled={controlsDisabled || !detail.panelConfiguration} onClick={() => void persist('draft', true)}>Save draft & next<ChevronRight size={15} /></button><button type="button" className={ui.primary} disabled={controlsDisabled || !detail.panelConfiguration || !calculation?.payload || Boolean(calculation?.issues.length)} onClick={() => void persist('submit')}><ClipboardCheck size={15} />{detail.assessment?.status === 'SUBMITTED' ? 'Submit correction' : draft.attendance === 'ABSENT' ? 'Submit absence' : 'Submit assessment'}</button></div>
    </form>}
    {detail?.assessment && <AssessmentRevisionHistory key={detail.placementId + ':' + detail.assessment.revision} roundId={roundId} placementId={detail.placementId} />}
  </section>;
}

function AssessmentRevisionHistory({ roundId, placementId }: { roundId: string; placementId: string }) {
  const [history, setHistory] = useState<CandidateAssessment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    if (loading) return;
    setLoading(true); setError('');
    try { setHistory(await assessmentApi.history(roundId, placementId)); }
    catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }
  return <details className="border border-slate-200 bg-white p-3" onToggle={event => {
    if (event.currentTarget.open && !history && !loading) void load();
  }}><summary className="cursor-pointer text-sm font-semibold text-slate-900">Assessment revision history</summary>
    {loading && <p role="status" className="mt-2 text-sm text-slate-500">Loading saved revisions…</p>}
    {error && <div role="alert" className={ui.error + ' mt-2'}>{error}<button className={ui.button + ' ml-2'} type="button" onClick={() => void load()}>Retry</button></div>}
    {history && <div className="mt-2 divide-y divide-slate-100">{history.map(item => <details key={item.id} className="py-2 text-sm text-slate-700"><summary className="cursor-pointer">Revision {item.revision} · {item.status.toLowerCase()} · {item.actorName} · {new Date(item.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</summary><p className="mt-2">Attendance: {item.attendance.toLowerCase()} · {item.reason || 'Initial assessment entry'}</p><ul className="mt-2 space-y-1">{item.members.map(member => { const score = item.scores.find(value => value.memberId === member.id); return <li key={member.id}>{member.name}: {formatAssessmentScore(score?.interview)} /20 interview · {formatAssessmentScore(score?.personality)} /5 personality</li>; })}</ul><p className="mt-2">Activities: {formatAssessmentScore(item.extracurricular)} /10 · Academics: {formatAssessmentScore(item.academic)} /5 · Stored total: {formatAssessmentScore(item.totals.total)} /100</p><p className="mt-1 text-xs text-slate-500">{writtenMarkLabel(item.written)} · {item.written.reference ?? 'No written-source reference'}</p></details>)}</div>}
  </details>;
}

function MemberScoreRow({ memberName, position, interview, personality, disabled, onChange }: {
  memberName: string; position: number; interview: string; personality: string; disabled: boolean; onChange: (field: 'interview' | 'personality', value: string) => void;
}) {
  return <><div className="min-w-0 self-center break-words text-sm text-slate-900"><span className="block font-medium">{memberName}</span><span className="text-xs text-slate-500">Member {position}</span></div><input type="number" inputMode="decimal" min={0} max={20} step="0.01" className={ui.input + ' tabular-nums'} aria-label={memberName + ' interview marks out of 20'} placeholder="Pending" value={interview} disabled={disabled} onChange={event => onChange('interview', event.target.value)} /><input type="number" inputMode="decimal" min={0} max={5} step="0.01" className={ui.input + ' tabular-nums'} aria-label={memberName + ' personality marks out of 5'} placeholder="Pending" value={personality} disabled={disabled} onChange={event => onChange('personality', event.target.value)} /></>;
}

function EvidenceScore({ label, maximum, score, evidence, reviewed, onScore, onEvidence, onReviewed }: {
  label: string; maximum: number; score: string; evidence: string; reviewed: boolean;
  onScore: (value: string) => void; onEvidence: (value: string) => void; onReviewed: (value: boolean) => void;
}) {
  return <div className="space-y-2"><label className="block"><span className={ui.label}>{label} /{maximum}</span><input type="number" inputMode="decimal" min={0} max={maximum} step="0.01" className={ui.input} placeholder="Pending" value={score} onChange={event => onScore(event.target.value)} /></label><label className="block"><span className={ui.label}>Evidence / assessment-sheet reference</span><input maxLength={2000} className={ui.input} value={evidence} onChange={event => onEvidence(event.target.value)} placeholder="Document, certificate or checked record reference" /></label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={reviewed} onChange={event => onReviewed(event.target.checked)} />Evidence and score reviewed</label></div>;
}
