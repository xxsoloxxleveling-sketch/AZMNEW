import { BookOpenCheck, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import './EdmcCertificate.css';

export interface PublicEdmcRecord {
  status: 'PROVISIONAL';
  fullName: string;
  fatherName: string;
  rollNumber: string;
  applicationNo: string;
  className: string;
  studyGroup: string | null;
  semester: string | null;
  schoolName: string;
  district: string | null;
  testCenter: string | null;
  session: string;
  publishedAt: string;
  photoDataUrl: string | null;
  obtainedMarks: number;
  maximumMarks: number;
  percentage: number;
  resultStatus: 'PASS' | 'FAIL';
  passThreshold: number;
  reviewPending: boolean;
  notice: string;
}

const certificateNotices = [
  'This is an electronic provisional DMC. It is not the Final or Official DMC.',
  'The Official / Original DMC will be provided by the Regional Office.',
  'Errors and omissions excepted.',
  'This provisional E-DMC is not valid as an original certificate for government or private-sector purposes.',
  'This E-DMC does not guarantee the award of a scholarship.',
  'The second phase of selection will be interviews.',
];

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="edmc-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi',
  }).format(date);
}

/** Informational E-DMC: never substitute official issuance or a signed certificate. */
export function EdmcCertificate({ record }: { record: PublicEdmcRecord }) {
  const marks = Number(record.obtainedMarks);
  const maximum = Number(record.maximumMarks);
  const percentage = Number(record.percentage);
  const isPass = marks > record.passThreshold;
  const status = isPass ? 'PASS' : 'FAIL';

  return (
    <article className="azm-edmc-certificate" data-result-print-root="true" aria-label="AZM.AIO electronic provisional detailed marks certificate">
      <div className="edmc-corner edmc-corner-tl" aria-hidden="true" />
      <div className="edmc-corner edmc-corner-tr" aria-hidden="true" />
      <div className="edmc-corner edmc-corner-bl" aria-hidden="true" />
      <div className="edmc-corner edmc-corner-br" aria-hidden="true" />
      <header className="edmc-heading">
        <img className="edmc-logo" src="/logo_cropped.png" alt="AZM.AIO official logo" />
        <span className="edmc-kicker"><GraduationCap size={16} aria-hidden="true" /> AZM.AIO · Session V 2026</span>
        <h2>E-DMC</h2>
        <p className="edmc-ribbon">Electronic Detailed Marks Certificate</p>
        <p className="edmc-subtitle">PROVISIONAL RESULT · NOT AN OFFICIAL / ORIGINAL DMC</p>
      </header>

      <section className="edmc-identity" aria-labelledby="edmc-student-heading">
        <div className="edmc-details">
          <h3 id="edmc-student-heading"><UserRound size={17} aria-hidden="true" /> Candidate information</h3>
          <dl>
            <Field label="Student name" value={record.fullName} />
            <Field label="Father's name" value={record.fatherName} />
            <Field label="Roll number" value={record.rollNumber} />
            <Field label="Application number" value={record.applicationNo} />
            <Field label="Class" value={record.className} />
            <Field label="Study group" value={record.studyGroup} />
            <Field label="Semester" value={record.semester} />
            <Field label="School / institution" value={record.schoolName} />
            <Field label="Test centre" value={record.testCenter} />
            <Field label="District" value={record.district} />
            <Field label="Examination session" value={record.session} />
            <Field label="Marks published" value={formatDate(record.publishedAt)} />
          </dl>
        </div>
        <figure className="edmc-portrait">
          {record.photoDataUrl
            ? <img src={record.photoDataUrl} alt={`Student photograph for ${record.fullName}`} />
            : <div className="edmc-no-photo"><UserRound size={44} strokeWidth={1.4} aria-hidden="true" /><span>PHOTO NOT AVAILABLE</span></div>}
          <figcaption>STUDENT PHOTOGRAPH</figcaption>
        </figure>
      </section>

      <section className="edmc-results" aria-labelledby="edmc-marks-heading">
        <div className="edmc-section-heading">
          <BookOpenCheck size={18} aria-hidden="true" />
          <h3 id="edmc-marks-heading">Examination marks summary</h3>
        </div>
        <div className="edmc-stats">
          <div className="edmc-stat">
            <span>Obtained marks</span>
            <strong>{marks}<small> / {maximum}</small></strong>
          </div>
          <div className="edmc-stat">
            <span>Percentage</span>
            <strong>{Number.isFinite(percentage) ? percentage.toFixed(percentage % 1 === 0 ? 0 : 2) : '—'}<small>%</small></strong>
          </div>
          <div className={`edmc-stat edmc-result ${isPass ? 'edmc-pass' : 'edmc-fail'}`}>
            <span>Result status</span>
            <strong>{status}</strong>
            <small>Provisional</small>
          </div>
        </div>
        <p className="edmc-passing-rule"><ShieldCheck size={17} aria-hidden="true" /> Passing rule: <strong>Above 60 marks = Pass.</strong> Exactly 60 or below is not a pass.</p>
        {record.reviewPending && <p className="edmc-pending-notice" role="note">Some examination records are still under review. The published provisional marks may be corrected.</p>}
      </section>

      <section className="edmc-notices" aria-labelledby="edmc-terms-heading">
        <div className="edmc-section-heading">
          <BookOpenCheck size={18} aria-hidden="true" />
          <h3 id="edmc-terms-heading">Important notice</h3>
        </div>
        <ol>
          {certificateNotices.map((notice, index) => (
            <li key={notice}><span className="edmc-notice-number">{index + 1}</span><span>{notice}</span></li>
          ))}
        </ol>
      </section>

      <footer className="edmc-footer">
        <div><strong>AZM.AIO</strong><span>Scholarship Examination · Session V 2026</span></div>
        <div className="edmc-footer-note">Electronically displayed for information only · Original DMC issued separately by Regional Office.</div>
      </footer>
    </article>
  );
}
