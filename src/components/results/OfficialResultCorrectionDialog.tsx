import { useMemo, useState } from 'react';
import { correctOfficialResult } from './ResultsApi';
import type {
  OfficialCorrectionInput,
  OfficialIdentityStatus,
  OfficialPublicationStatus,
  OfficialResponseClassification,
  OfficialResultDetail,
  OfficialScoringStatus,
  OfficialVerificationStatus,
} from './ResultsApi';

interface Props {
  result: OfficialResultDetail;
  source: 'STUDENT_PROFILE' | 'RESULTS_DASHBOARD';
  onCancel: () => void;
  onSaved: (result: OfficialResultDetail) => void;
}

const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:border-[#185b9d] focus:outline-none focus:ring-2 focus:ring-blue-100';
const responseStates: OfficialResponseClassification[] = ['CORRECT', 'WRONG', 'BLANK', 'MULTIPLE', 'UNCERTAIN'];
type ResponseOverride = { classification?: OfficialResponseClassification; reviewedAnswer?: string | null };

export function OfficialResultCorrectionDialog({ result, source, onCancel, onSaved }: Props) {
  const [marks, setMarks] = useState(result.obtainedMarks ?? '');
  const [paperVersion, setPaperVersion] = useState(result.paperVersion ?? '');
  const [identityStatus, setIdentityStatus] = useState<OfficialIdentityStatus>(result.identityStatus);
  const [scoringStatus, setScoringStatus] = useState<OfficialScoringStatus>(result.scoringStatus);
  const [verificationStatus, setVerificationStatus] = useState<OfficialVerificationStatus>(result.verificationStatus);
  const [publicationStatus, setPublicationStatus] = useState<OfficialPublicationStatus>(result.publicationStatus);
  const [remarks, setRemarks] = useState(result.administrativeRemarks ?? '');
  const [reason, setReason] = useState('');
  const [editResponses, setEditResponses] = useState(false);
  const [responseOverrides, setResponseOverrides] = useState<Record<number, ResponseOverride>>({});
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const responseChanges = useMemo(() => result.responses.flatMap((response) => {
    const override = responseOverrides[response.questionNumber];
    if (!override) return [];
    const classification = override.classification ?? response.classification;
    const reviewedAnswer = Object.prototype.hasOwnProperty.call(override, 'reviewedAnswer') ? override.reviewedAnswer ?? null : response.reviewedAnswer;
    if (classification === response.classification && reviewedAnswer === response.reviewedAnswer) return [];
    return [{
      questionNumber: response.questionNumber,
      detectedAnswer: response.detectedAnswer,
      reviewedAnswer,
      classification,
    }];
  }), [result.responses, responseOverrides]);

  const changes: OfficialCorrectionInput['changes'] = {
    ...(marks !== (result.obtainedMarks ?? '') ? { obtainedMarks: marks.trim() || null } : {}),
    ...(paperVersion !== (result.paperVersion ?? '') ? { paperVersion: paperVersion.trim() || null } : {}),
    ...(identityStatus !== result.identityStatus ? { identityStatus } : {}),
    ...(scoringStatus !== result.scoringStatus ? { scoringStatus } : {}),
    ...(verificationStatus !== result.verificationStatus ? { verificationStatus } : {}),
    ...(publicationStatus !== result.publicationStatus ? { publicationStatus } : {}),
    ...(remarks !== (result.administrativeRemarks ?? '') ? { administrativeRemarks: remarks.trim() || null } : {}),
    ...(responseChanges.length ? { responses: responseChanges } : {}),
  };
  const changed = Object.keys(changes).length > 0;
  const marksChanged = marks !== (result.obtainedMarks ?? '');

  const review = () => {
    setError('');
    if (!changed) return setError('No changes have been made.');
    if (reason.trim().length < 12) return setError('Enter a correction reason of at least 12 characters.');
    if (marks.trim() && (!/^\d{1,6}(?:\.\d{1,2})?$/.test(marks.trim()) || !Number.isFinite(Number(marks)) || Number(marks) > Number(result.maximumMarks))) {
      return setError(`Marks must be a non-negative number with up to two decimal places, no greater than ${result.maximumMarks}.`);
    }
    if (paperVersion.trim().length > 16) return setError('Paper version must be 16 characters or fewer.');
    if (responseChanges.length > 0 && marksChanged) return setError('Question-level corrections calculate marks from the exam policy. Save response changes separately from a score-only adjustment.');
    setReviewing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await correctOfficialResult(result.id, {
        expectedRevision: result.resultRevision,
        reason: reason.trim(),
        source,
        changes,
      });
      onSaved(updated);
    } catch (cause) {
      const err = cause as Error & { status?: number };
      setError(err.status === 409
        ? 'This result changed after you opened it. Close this dialog, refresh the result, and review the current revision before correcting it.'
        : err.message || 'The correction could not be saved.');
      setReviewing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="official-correction-title" className="my-4 w-full max-w-4xl rounded-lg border border-slate-200 bg-white shadow-xl">
        <header className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Super Admin · audit required</p>
              <h2 id="official-correction-title" className="mt-1 text-lg font-bold text-slate-900">{reviewing ? 'Review result correction' : 'Edit Examination Result'}</h2>
              <p className="mt-1 text-sm text-slate-600">{result.student.fullName} · {result.student.rollNumber || result.student.applicationNo} · {result.examination.title}</p>
            </div>
            <button type="button" aria-label="Close correction dialog" disabled={saving} onClick={onCancel} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40">×</button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
            <Fact label="Revision" value={`v${result.resultRevision}`} />
            <Fact label="Identity" value={result.identityStatus} />
            <Fact label="Verification" value={result.verificationStatus} />
            <Fact label="Publication" value={result.publicationStatus} />
          </dl>
        </header>

        <div className="space-y-5 px-4 py-4 sm:px-6">
          <section aria-label="Current result snapshot" className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Current result</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Fact label="Marks" value={result.obtainedMarks === null ? 'Unavailable' : `${result.obtainedMarks} / ${result.maximumMarks}`} />
              <Fact label="Paper version" value={result.paperVersion || 'Unavailable'} />
              <Fact label="Correct / wrong" value={countPair(result.correctCount, result.wrongCount)} />
              <Fact label="Blank / multiple / uncertain" value={`${countText(result.blankCount)} / ${countText(result.multipleCount)} / ${countText(result.uncertainCount)}`} />
            </dl>
          </section>

          {!reviewing ? <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Proposed correction fields">
              <label className="text-xs font-semibold text-slate-700">Marks obtained
                <input className={fieldClass} inputMode="decimal" value={marks} onChange={(event) => setMarks(event.target.value)} placeholder="Leave empty if not available" />
                <span className="mt-1 block font-normal text-slate-500">A score-only change is recorded as an administrative adjustment; answer counts stay unchanged.</span>
              </label>
              <label className="text-xs font-semibold text-slate-700">Paper version
                <select className={fieldClass} value={paperVersion} onChange={(event) => setPaperVersion(event.target.value)}>
                  <option value="">Unrecorded</option>
                  {paperVersion && !result.examination.paperVersions.includes(paperVersion) && <option value={paperVersion}>{paperVersion} · not mapped</option>}
                  {result.examination.paperVersions.map((version) => <option key={version} value={version}>{version}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Identity status
                <select className={fieldClass} value={identityStatus} onChange={(event) => setIdentityStatus(event.target.value as OfficialIdentityStatus)}>{['PENDING', 'VERIFIED', 'MISMATCH'].map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Scoring status
                <select className={fieldClass} value={scoringStatus} onChange={(event) => setScoringStatus(event.target.value as OfficialScoringStatus)}>{['PROVISIONAL', 'VERIFIED'].map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Verification status
                <select className={fieldClass} value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as OfficialVerificationStatus)}>{['PENDING', 'VERIFIED', 'WITHHELD'].map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Publication status
                <select className={fieldClass} value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as OfficialPublicationStatus)}>{['UNPUBLISHED', 'PUBLISHED', 'WITHHELD'].map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Authorized remarks
                <textarea className={fieldClass} rows={2} maxLength={1000} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional result-specific note" />
              </label>
            </section>

            {result.responses.length > 0 && <section className="rounded-md border border-slate-200 p-3">
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                <input className="mt-0.5" type="checkbox" checked={editResponses} onChange={(event) => setEditResponses(event.target.checked)} />
                Correct question classifications
              </label>
              <p className="mt-1 text-[11px] text-slate-500">Original detected answers remain visible as evidence. A changed classification is audited and totals are recalculated under the examination policy.</p>
              {editResponses && <div className="mt-3 max-h-64 overflow-auto rounded border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr><th className="px-2 py-2">Q#</th><th className="px-2 py-2">Detected</th><th className="px-2 py-2">Reviewed</th><th className="px-2 py-2">Classification</th></tr></thead><tbody className="divide-y divide-slate-100">
                  {result.responses.map((response) => <tr key={response.questionNumber}>
                    <td className="px-2 py-1.5">{response.questionNumber}</td>
                    <td className="px-2 py-1.5">{response.detectedAnswer || '—'}</td>
                    <td className="px-2 py-1.5"><select aria-label={`Question ${response.questionNumber} reviewed answer`} className="rounded border border-slate-300 px-2 py-1" value={Object.prototype.hasOwnProperty.call(responseOverrides[response.questionNumber] ?? {}, 'reviewedAnswer') ? (responseOverrides[response.questionNumber]?.reviewedAnswer ?? '') : (response.reviewedAnswer ?? '')} onChange={(event) => setResponseOverrides((current) => ({ ...current, [response.questionNumber]: { ...current[response.questionNumber], reviewedAnswer: event.target.value || null } }))}><option value="">No reviewed answer</option>{response.reviewedAnswer && !['A', 'B', 'C', 'D', 'MULTIPLE'].includes(response.reviewedAnswer) && <option value={response.reviewedAnswer}>{response.reviewedAnswer}</option>}{['A', 'B', 'C', 'D', 'MULTIPLE'].map((value) => <option key={value}>{value}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select aria-label={`Question ${response.questionNumber} classification`} className="rounded border border-slate-300 px-2 py-1" value={responseOverrides[response.questionNumber]?.classification ?? response.classification} onChange={(event) => setResponseOverrides((current) => ({ ...current, [response.questionNumber]: { ...current[response.questionNumber], classification: event.target.value as OfficialResponseClassification } }))}>{responseStates.map((value) => <option key={value}>{value}</option>)}</select></td>
                  </tr>)}
                </tbody></table>
              </div>}
            </section>}

            <label className="block text-xs font-semibold text-slate-700">Reason for result correction
              <textarea className={fieldClass} rows={3} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what evidence supports this correction." />
                <span className="mt-1 block font-normal text-slate-500">Minimum 12 characters. This reason is included in the audit history.</span>
            </label>
          </> : <>
            <section aria-label="Change comparison" className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[500px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Previous</th><th className="px-3 py-2">Proposed</th></tr></thead><tbody className="divide-y divide-slate-100">
                {fieldRows(result, changes).map((row) => <tr key={row.label}><td className="px-3 py-2 font-semibold text-slate-700">{row.label}</td><td className="px-3 py-2">{row.previous}</td><td className="px-3 py-2">{row.next}</td></tr>)}
                {responseChanges.length > 0 && <tr><td className="px-3 py-2 font-semibold">Question classifications</td><td className="px-3 py-2">Existing classifications</td><td className="px-3 py-2">{responseChanges.length} question(s) changed</td></tr>}
              </tbody></table>
            </section>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-bold">Confirm the correction</p>
              <p className="mt-1">This creates revision {result.resultRevision + 1} and an audit entry. Any existing Official DMC for the previous revision will be superseded. Publication changes take effect only if the server accepts the explicit requested state.</p>
              <p className="mt-2"><strong>Reason:</strong> {reason.trim()}</p>
            </div>
          </>}

          {error && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">{error}</p>}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-6">
          {!reviewing ? <>
            <button type="button" disabled={saving} onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
            <button type="button" disabled={saving || !changed} onClick={review} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Review changes</button>
          </> : <>
            <button type="button" disabled={saving} onClick={() => setReviewing(false)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Back to edit</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-md bg-[#185b9d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving audited correction…' : 'Confirm correction'}</button>
          </>}
        </footer>
      </section>
    </div>
  );
}

function fieldRows(result: OfficialResultDetail, changes: OfficialCorrectionInput['changes']) {
  const rows: Array<{ label: string; previous: string; next: string }> = [];
  const add = (label: string, previous: unknown, next: unknown) => rows.push({ label, previous: formatValue(previous), next: formatValue(next) });
  if (changes.obtainedMarks !== undefined) add('Marks obtained', result.obtainedMarks ?? 'Unavailable', changes.obtainedMarks === null ? 'Unavailable' : `${changes.obtainedMarks} / ${result.maximumMarks}`);
  if (changes.paperVersion !== undefined) add('Paper version', result.paperVersion ?? 'Unavailable', changes.paperVersion ?? 'Unavailable');
  if (changes.identityStatus !== undefined) add('Identity status', result.identityStatus, changes.identityStatus);
  if (changes.scoringStatus !== undefined) add('Scoring status', result.scoringStatus, changes.scoringStatus);
  if (changes.verificationStatus !== undefined) add('Verification status', result.verificationStatus, changes.verificationStatus);
  if (changes.publicationStatus !== undefined) add('Publication status', result.publicationStatus, changes.publicationStatus);
  if (changes.administrativeRemarks !== undefined) add('Administrative remarks', result.administrativeRemarks || 'None', changes.administrativeRemarks || 'None');
  return rows;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  return String(value);
}

function countPair(first: number | null, second: number | null) {
  return first === null || second === null ? 'Unavailable' : `${first} / ${second}`;
}

function countText(value: number | null) { return value === null ? '—' : String(value); }

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>;
}
