import React, { useEffect, useRef, useState } from 'react';
import {
  IconClose,
  IconAddStudent,
  IconEditStudent,
  IconLoader,
  IconCheckCircle,
  IconPlus,
  IconDeleteCandidate,
  IconUpload,
} from '../../common/icons';
import { mockApi, MockStudent } from '../../../lib/mockApi';
import { apiFetch } from '../../../lib/apiClient';
import { formatCnic, VALID_PROVINCES } from '../../../utils/formValidation';

interface AdminWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: MockStudent) => void;
  mode?: 'create' | 'edit';
  studentToEdit?: MockStudent | null;
}

const initialForm = () => ({
  fullName: '', fatherName: '', gender: 'MALE', dateOfBirth: '', cnicOrBForm: '',
  nationality: 'Pakistani', religion: '', parentMobile: '', studentMobile: '', whatsapp: '', email: '',
  address: '', district: 'Mansehra', province: 'Khyber Pakhtunkhwa', currentClass: '',
  hsscGroup: '', bsDepartment: '', bsSemester: '', schoolName: '', boardOrUniversity: '', currentRollNo: '',
  scholarshipCategory: 'GENERAL_MERIT', guardianOccupation: '', guardianMonthlyIncome: '',
  emergencyContact: '', emergencyRelation: 'Guardian', registrationCentre: '', referralSource: '',
});

type FormData = ReturnType<typeof initialForm>;
type AcademicRecord = { examLevel: string; boardOrUni: string; yearOfPassing: string; totalMarks: string; obtainedMarks: string };
type Attachment = { file: File; preview: string; stored?: Record<string, unknown> };

const documentTypes = [
  ['photo', 'Student photo'], ['bform', 'Student B-Form / CNIC'], ['fatherCnic', 'Father / guardian CNIC'],
  ['dmc', 'DMC / result card'], ['dmc_2', 'Additional result card'], ['domicile', 'Domicile certificate'],
  ['income', 'Income certificate'], ['paymentReceipt', 'Payment receipt'], ['signature', 'Applicant signature'],
] as const;

const essentialDocs = ['photo', 'bform', 'fatherCnic', 'dmc', 'signature'];
const inputStyle = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#185b9d] h-9';
const buttonStyle = 'rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 h-9 transition cursor-pointer';

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error(`Could not read ${file.name}. Please select it again.`));
  reader.readAsDataURL(file);
});

export const AdminWalkInModal: React.FC<AdminWalkInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'create',
  studentToEdit = null,
}) => {
  const isEdit = mode === 'edit';
  const [data, setData] = useState<FormData>(initialForm);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [allowMissing, setAllowMissing] = useState(false);
  const [sameContact, setSameContact] = useState(true);
  const [created, setCreated] = useState<MockStudent | null>(null);

  const dialog = useRef<HTMLDivElement>(null);
  const attachmentRef = useRef(attachments);
  const submitting = useRef(false);
  attachmentRef.current = attachments;

  const initialSnapshotRef = useRef<{ data: FormData; records: AcademicRecord[]; sameContact: boolean }>({
    data: initialForm(),
    records: [],
    sameContact: true,
  });

  const getFormDataFromStudent = (s: MockStudent): FormData => {
    const dobStr = s.dateOfBirth
      ? (typeof s.dateOfBirth === 'string'
          ? s.dateOfBirth.slice(0, 10)
          : new Date(s.dateOfBirth).toISOString().slice(0, 10))
      : '';
    return {
      fullName: s.fullName || '',
      fatherName: s.fatherName || '',
      gender: s.gender || 'MALE',
      dateOfBirth: dobStr,
      cnicOrBForm: s.cnicOrBForm || '',
      nationality: s.nationality || 'Pakistani',
      religion: s.religion || '',
      parentMobile: s.parentMobile || '',
      studentMobile: s.studentMobile || '',
      whatsapp: s.whatsapp || '',
      email: s.email || '',
      address: s.address || '',
      district: s.district || 'Mansehra',
      province: s.province || 'Khyber Pakhtunkhwa',
      currentClass: s.currentClass || '',
      hsscGroup: (s as any).hsscGroup || '',
      bsDepartment: (s as any).bsDepartment || '',
      bsSemester: (s as any).bsSemester || '',
      schoolName: s.schoolName || '',
      boardOrUniversity: s.boardOrUniversity || '',
      currentRollNo: s.currentRollNo || '',
      scholarshipCategory: s.scholarshipCategory || 'GENERAL_MERIT',
      guardianOccupation: s.guardianOccupation || '',
      guardianMonthlyIncome: s.guardianMonthlyIncome != null ? String(s.guardianMonthlyIncome) : '',
      emergencyContact: s.emergencyContact || '',
      emergencyRelation: s.emergencyRelation || 'Guardian',
      registrationCentre: (s as any).registrationCentre || '',
      referralSource: s.referralSource || '',
    };
  };

  const getRecordsFromStudent = (s: MockStudent): AcademicRecord[] => {
    if (!Array.isArray(s.academicRecords)) return [];
    return s.academicRecords.map((r: any) => ({
      examLevel: r.examLevel || '',
      boardOrUni: r.boardOrUni || '',
      yearOfPassing: String(r.yearOfPassing || ''),
      totalMarks: String(r.totalMarks || ''),
      obtainedMarks: String(r.obtainedMarks || ''),
    }));
  };

  const reset = () => {
    Object.values(attachmentRef.current as Record<string, Attachment>).forEach(a => URL.revokeObjectURL(a.preview));
    setData(initialForm());
    setRecords([]);
    setAttachments({});
    setError('');
    setAllowMissing(false);
    setSameContact(true);
    setCreated(null);
    setProgress('');
  };

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && studentToEdit) {
      const initData = getFormDataFromStudent(studentToEdit);
      const initRecords = getRecordsFromStudent(studentToEdit);
      const isSame = !studentToEdit.emergencyContact || studentToEdit.emergencyContact === studentToEdit.parentMobile;
      setData(initData);
      setRecords(initRecords);
      setSameContact(isSame);
      setAttachments({});
      setError('');
      setCreated(null);
      setProgress('');
      initialSnapshotRef.current = { data: initData, records: initRecords, sameContact: isSame };

      mockApi.getStudentById(studentToEdit.id).then((fullStudent) => {
        if (fullStudent) {
          const fullData = getFormDataFromStudent(fullStudent);
          const fullRecords = getRecordsFromStudent(fullStudent);
          const fullSame = !fullStudent.emergencyContact || fullStudent.emergencyContact === fullStudent.parentMobile;
          setData(fullData);
          setRecords(fullRecords);
          setSameContact(fullSame);
          initialSnapshotRef.current = { data: fullData, records: fullRecords, sameContact: fullSame };
        }
      }).catch(() => {});
    } else {
      const init = initialForm();
      setData(init);
      setRecords([]);
      setAttachments({});
      setError('');
      setCreated(null);
      setProgress('');
      setSameContact(true);
      setAllowMissing(false);
      initialSnapshotRef.current = { data: init, records: [], sameContact: true };
    }
  }, [isOpen, isEdit, studentToEdit]);

  const isFormDirty = () => {
    if (created) return false;
    if (Object.keys(attachments).length > 0) return true;
    const snap = initialSnapshotRef.current;
    if (JSON.stringify(data) !== JSON.stringify(snap.data)) return true;
    if (JSON.stringify(records) !== JSON.stringify(snap.records)) return true;
    if (sameContact !== snap.sameContact) return true;
    return false;
  };

  const close = () => {
    if (submitting.current) return;
    if (isFormDirty() && !window.confirm(isEdit ? 'Discard unsaved changes?' : 'Discard this unsaved student registration?')) {
      return;
    }
    reset();
    onClose();
  };

  useEffect(() => () => Object.values(attachmentRef.current as Record<string, Attachment>).forEach(a => URL.revokeObjectURL(a.preview)), []);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (key: keyof FormData, value: string) => setData(prev => ({ ...prev, [key]: value }));

  const field = (key: keyof FormData, label: string, required = false, type = 'text', options?: string[]) => (
    <label className="block text-xs font-semibold text-slate-600" key={key}>
      <span className="mb-1.5 block">{label}{required ? ' *' : ''}</span>
      {options ? (
        <select className={inputStyle} value={data[key]} required={required} onChange={e => set(key, e.target.value)}>
          <option value="">Select {label.toLowerCase()}</option>
          {data[key] && !options.includes(data[key]) && <option value={data[key]}>{data[key]}</option>}
          {options.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : (
        <input
          className={inputStyle}
          name={key}
          type={type}
          value={data[key]}
          required={required}
          min={type === 'number' ? 0 : undefined}
          max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
          pattern={key === 'cnicOrBForm' ? '[0-9]{5}-[0-9]{7}-[0-9]' : type === 'tel' ? '[+0-9() -]{10,18}' : undefined}
          title={key === 'cnicOrBForm' ? 'Enter the full 13-digit CNIC / B-Form.' : undefined}
          onChange={e => set(key, key === 'cnicOrBForm' ? formatCnic(e.target.value) : e.target.value)}
        />
      )}
    </label>
  );

  const section = (id: string, title: string, children: React.ReactNode) => (
    <section id={id} className="scroll-mt-4 pt-4 first:pt-0">
      <div className="border-b border-slate-200 pb-2 mb-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );

  const removeAttachment = (key: string) => {
    const old = attachments[key];
    if (old) URL.revokeObjectURL(old.preview);
    setAttachments(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const selectFile = (key: string, file?: File) => {
    if (!file) return;
    const imageOnly = key === 'photo' || key === 'signature';
    if (!(imageOnly ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf']).includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError(`${file.name}: choose a ${imageOnly ? 'JPG or PNG' : 'JPG, PNG or PDF'} file, up to 5 MB.`);
      return;
    }
    if (attachments[key]) URL.revokeObjectURL(attachments[key].preview);
    setAttachments(prev => ({ ...prev, [key]: { file, preview: URL.createObjectURL(file) } }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');

    if (Object.entries(data as FormData).some(([key, value]) => ['fullName', 'fatherName', 'address', 'district', 'schoolName'].includes(key) && !value.trim())) {
      setError('Required details cannot contain only spaces.');
      return;
    }
    if (records.some(r => Number(r.obtainedMarks) > Number(r.totalMarks))) {
      setError('Obtained marks cannot exceed total marks.');
      return;
    }

    if (!isEdit) {
      const missing = essentialDocs.filter(key => !attachments[key]);
      if (missing.length && !allowMissing) {
        setError(`Attach the standard application documents (${documentTypes.filter(([key]) => missing.includes(key)).map(([, label]) => label).join(', ')}) or choose to save with missing documents.`);
        return;
      }
    }

    submitting.current = true;
    setBusy(true);

    try {
      if (isEdit && studentToEdit) {
        // Edit flow
        const cleanCnic = data.cnicOrBForm.replace(/\D/g, '');
        const originalCleanCnic = (studentToEdit.cnicOrBForm || '').replace(/\D/g, '');

        if (cleanCnic !== originalCleanCnic) {
          setProgress('Checking CNIC uniqueness…');
          const matches = await apiFetch<{ students: MockStudent[] }>(`/api/students?search=${encodeURIComponent(cleanCnic)}&limit=50`);
          if (matches?.students?.some(s => s.id !== studentToEdit.id && s.cnicOrBForm.replace(/\D/g, '') === cleanCnic)) {
            throw new Error('Another candidate is already registered with this CNIC / B-Form.');
          }
        }

        // Upload any newly provided attachments
        if (Object.keys(attachments).length > 0) {
          for (const [key, attachment] of Object.entries(attachments) as [string, Attachment][]) {
            setProgress(`Uploading updated ${documentTypes.find(([id]) => id === key)?.[1] || key}…`);
            await mockApi.uploadStudentDocument({
              cnicOrBForm: data.cnicOrBForm,
              studentId: studentToEdit.id,
              docType: key,
              fileName: attachment.file.name,
              contentType: attachment.file.type,
              fileData: await readFile(attachment.file),
            });
          }
        }

        setProgress('Saving changes…');
        const updatePayload: Record<string, any> = {
          fullName: data.fullName.trim(),
          fatherName: data.fatherName.trim(),
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          cnicOrBForm: data.cnicOrBForm.trim(),
          nationality: data.nationality.trim(),
          religion: data.religion?.trim() || null,
          parentMobile: data.parentMobile.trim(),
          studentMobile: data.studentMobile?.trim() || null,
          whatsapp: data.whatsapp?.trim() || null,
          email: data.email?.trim() || null,
          address: data.address.trim(),
          district: data.district.trim(),
          province: data.province.trim(),
          currentClass: data.currentClass.trim(),
          schoolName: data.schoolName.trim(),
          boardOrUniversity: data.boardOrUniversity.trim(),
          currentRollNo: data.currentRollNo?.trim() || null,
          scholarshipCategory: data.scholarshipCategory,
          guardianOccupation: data.guardianOccupation?.trim() || null,
          guardianMonthlyIncome: data.guardianMonthlyIncome === '' ? null : Number(data.guardianMonthlyIncome),
          emergencyContact: sameContact ? data.parentMobile.trim() : data.emergencyContact.trim(),
          emergencyRelation: data.emergencyRelation.trim(),
          registrationCentre: data.registrationCentre?.trim() || null,
          referralSource: data.referralSource?.trim() || null,
          hsscGroup: (data.currentClass.includes('HSSC') || data.currentClass.includes('Year')) ? data.hsscGroup?.trim() || null : null,
          bsDepartment: data.currentClass === 'BS' ? data.bsDepartment?.trim() || null : null,
          bsSemester: data.currentClass === 'BS' ? data.bsSemester?.trim() || null : null,
        };

        const updatedStudent = await mockApi.updateStudent(studentToEdit.id, updatePayload);
        window.dispatchEvent(new Event('students-updated'));
        onSuccess(updatedStudent);
        reset();
        onClose();
      } else {
        // Create flow
        setProgress('Checking for an existing application…');
        const identities = [data.cnicOrBForm, data.cnicOrBForm.replace(/\D/g, '')];
        const matches = await Promise.all(identities.map(identity =>
          apiFetch<{ students: MockStudent[] }>(`/api/students?search=${encodeURIComponent(identity)}&limit=50`)
        ));
        if (matches.some(result => result.students.some(student =>
          student.cnicOrBForm.replace(/\D/g, '') === identities[1]
        ))) {
          throw new Error('This CNIC / B-Form already has an application. Open the existing student record instead of adding it again.');
        }

        const uploadedDocuments: Record<string, unknown> = {};
        for (const [key, attachment] of Object.entries(attachments as Record<string, Attachment>)) {
          setProgress(`Uploading ${documentTypes.find(([id]) => id === key)?.[1] || key}…`);
          let stored = attachment.stored;
          if (!stored || stored.candidateKey !== data.cnicOrBForm) {
            const result = await mockApi.uploadStudentDocument({
              cnicOrBForm: data.cnicOrBForm, docType: key,
              fileName: attachment.file.name, contentType: attachment.file.type, fileData: await readFile(attachment.file)
            });
            if (!result.path) throw new Error(`Upload of ${attachment.file.name} was not confirmed. Please try again.`);
            stored = {
              name: attachment.file.name, bucket: result.bucket, supabasePath: result.path,
              mimeType: result.mimeType, byteSize: result.byteSize, checksumSha256: result.checksumSha256,
              uploadedAt: new Date().toISOString(), candidateKey: data.cnicOrBForm
            };
            setAttachments(prev => ({ ...prev, [key]: { ...prev[key], stored } }));
            if (key === 'photo' && (result as any).thumbnail?.supabasePath) {
              uploadedDocuments['photoThumbnail'] = {
                name: `thumb-${attachment.file.name}`,
                bucket: result.bucket,
                supabasePath: (result as any).thumbnail.supabasePath,
                mimeType: (result as any).thumbnail.mimeType || 'image/jpeg',
                byteSize: (result as any).thumbnail.byteSize,
                uploadedAt: new Date().toISOString(),
                candidateKey: data.cnicOrBForm,
              };
            }
          }
          uploadedDocuments[key] = stored;
        }

        setProgress('Saving student…');
        const payload = {
          ...Object.fromEntries(Object.entries(data as FormData).map(([key, value]) => [key, value.trim()])),
          guardianMonthlyIncome: data.guardianMonthlyIncome === '' ? undefined : Number(data.guardianMonthlyIncome),
          emergencyContact: sameContact ? data.parentMobile.trim() : data.emergencyContact.trim(),
          hsscGroup: data.currentClass.includes('HSSC') ? data.hsscGroup : undefined,
          bsDepartment: data.currentClass === 'BS' ? data.bsDepartment : undefined,
          bsSemester: data.currentClass === 'BS' ? data.bsSemester : undefined,
          referralSource: data.referralSource.trim() || 'Admin walk-in registration',
          academicRecords: records.map(r => ({
            ...r, totalMarks: Number(r.totalMarks), obtainedMarks: Number(r.obtainedMarks),
            percentage: Number(((Number(r.obtainedMarks) / Number(r.totalMarks)) * 100).toFixed(2))
          })),
          uploadedDocuments,
          documents: {
            bformCnicCopy: !!attachments.bform, fatherCnicCopy: !!attachments.fatherCnic,
            passportPhotos: !!attachments.photo, previousResultCard: !!attachments.dmc,
            domicileCertificate: !!attachments.domicile, incomeCertificate: !!attachments.income
          },
        };
        const student = await apiFetch<MockStudent>('/api/students/admin-register', {
          method: 'POST', body: JSON.stringify(payload), timeoutMs: 90000,
        });
        setCreated(student);
        window.dispatchEvent(new Event('students-updated'));
        onSuccess(student);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? 'Changes could not be saved. Please retry.' : 'Registration could not be saved. Your details are still here; please retry.');
    } finally {
      submitting.current = false;
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 backdrop-blur-sm sm:p-5">
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-registration-title"
        className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl border border-slate-200"
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
          if (e.key === 'Tab') {
            const nodes = (Array.from(dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') || []) as HTMLElement[]).filter(el => el.getClientRects().length);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            {isEdit ? <IconEditStudent size={24} className="text-[#185b9d]" /> : <IconAddStudent size={24} className="text-[#185b9d]" />}
            <div>
              <h2 id="admin-registration-title" className="text-xl font-bold text-slate-900">
                {isEdit ? 'Edit Student' : 'Add student'}
              </h2>
              <p className="text-sm text-slate-500">
                {isEdit
                  ? `Update registration and profile details for ${studentToEdit?.fullName || 'student'}.`
                  : 'Complete application details, in one place.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label={isEdit ? 'Close edit student' : 'Close registration'}
            className={buttonStyle}
          >
            <IconClose size={20} />
          </button>
        </header>

        {created ? (
          <div className="overflow-y-auto p-8 text-center">
            <IconCheckCircle size={44} className="mx-auto mb-4 text-emerald-600" />
            <h3 className="text-xl font-bold">{created.fullName} has been added</h3>
            <p className="mt-2 text-slate-600">Application: {created.applicationNo || created.id}</p>
            <p className="mt-2 text-sm text-slate-500">Payment verification and roll number release follow the usual admin process.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button className={buttonStyle} onClick={close}>Done</button>
              <button
                className="rounded-xl bg-[#185b9d] hover:bg-[#13497d] px-5 py-2 text-xs font-bold text-white transition cursor-pointer"
                onClick={reset}
              >
                Add another student
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <nav aria-label="Registration sections" className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
              {['Personal', 'Education', 'Family', 'Documents'].map((title, index) => (
                <button
                  type="button"
                  key={title}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#185b9d] hover:bg-blue-100 cursor-pointer"
                  onClick={() => dialog.current?.querySelector(`#admin-${title}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {index + 1}. {title}
                </button>
              ))}
            </nav>

            <div className="overflow-y-auto px-4 py-5 sm:px-7">
              <fieldset disabled={busy} className="space-y-5">
                {section('admin-Personal', 'Personal & contact information', (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {field('fullName', 'Student full name', true)}
                    {field('fatherName', 'Father / guardian name', true)}
                    {field('cnicOrBForm', 'CNIC / B-Form', true)}
                    {field('gender', 'Gender', true, 'text', ['MALE', 'FEMALE'])}
                    {field('dateOfBirth', 'Date of birth', true, 'date')}
                    {field('nationality', 'Nationality')}
                    {field('religion', 'Religion')}
                    {field('parentMobile', 'Parent mobile', true, 'tel')}
                    {field('studentMobile', 'Student mobile', false, 'tel')}
                    {field('whatsapp', 'WhatsApp', false, 'tel')}
                    {field('email', 'Email', false, 'email')}
                    <div className="sm:col-span-2 lg:col-span-3">{field('address', 'Residential address', true)}</div>
                    {field('district', 'District', true)}
                    {field('province', 'Province', true, 'text', VALID_PROVINCES)}
                  </div>
                ))}

                {section('admin-Education', 'Education & academic history', (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {field('currentClass', 'Applying for class', true, 'text', [
                        'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th',
                        '1st Year', '2nd Year', 'SSC-I (Class 9th)', 'SSC-II (Class 10th)',
                        'HSSC-I (Class 11th)', 'HSSC-II (Class 12th)', 'BS'
                      ])}
                      {field('schoolName', 'School / college / university', true)}
                      {field('boardOrUniversity', 'Board / university', true)}
                      {field('currentRollNo', 'Current school roll number')}
                      {(data.currentClass.includes('HSSC') || data.currentClass.includes('Year')) && field('hsscGroup', 'HSSC group', false, 'text', [
                        'Pre-Medical', 'Pre-Engineering', 'ICS', 'FA', 'I.Com', 'General Science'
                      ])}
                      {data.currentClass === 'BS' && (
                        <>
                          {field('bsDepartment', 'BS department', false)}
                          {field('bsSemester', 'Semester', false, 'text', ['1', '2', '3', '4', '5', '6', '7', '8'])}
                        </>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">Previous qualifications</p>
                      <button
                        type="button"
                        className={buttonStyle}
                        onClick={() => setRecords(prev => [...prev, { examLevel: '', boardOrUni: data.boardOrUniversity, yearOfPassing: '', totalMarks: '', obtainedMarks: '' }])}
                      >
                        <IconPlus size={16} className="mr-1 inline" />Add qualification
                      </button>
                    </div>
                    {!records.length && <p className="text-xs text-slate-500">Add result details when available. Percentages are calculated automatically.</p>}
                    {records.map((record, index) => (
                      <div key={index} className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3 sm:grid-cols-3">
                        {(['examLevel', 'boardOrUni', 'yearOfPassing', 'totalMarks', 'obtainedMarks'] as const).map((key, i) => (
                          <label className="text-xs font-semibold text-slate-600" key={key}>
                            {['Exam / class', 'Board / institute', 'Passing year', 'Total marks', 'Obtained marks'][i]} *
                            <input
                              className={`${inputStyle} mt-1`}
                              value={record[key]}
                              required
                              type={i >= 2 ? 'number' : 'text'}
                              min={key === 'totalMarks' ? 1 : key === 'yearOfPassing' ? 1950 : i >= 2 ? 0 : undefined}
                              max={key === 'yearOfPassing' ? new Date().getFullYear() : key === 'obtainedMarks' ? Number(record.totalMarks) || undefined : undefined}
                              onChange={e => setRecords(prev => prev.map((r, n) => n === index ? { ...r, [key]: e.target.value } : r))}
                            />
                          </label>
                        ))}
                        <div className="flex items-end justify-between">
                          <span className="pb-3 text-sm text-blue-700 font-medium">
                            {Number(record.totalMarks) > 0 ? `${(Number(record.obtainedMarks) / Number(record.totalMarks) * 100).toFixed(2)}%` : '—'}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove qualification ${index + 1}`}
                            className={buttonStyle}
                            onClick={() => setRecords(prev => prev.filter((_, n) => n !== index))}
                          >
                            <IconDeleteCandidate size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                ))}

                {section('admin-Family', 'Scholarship, family & registration', (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-600">
                        Scholarship category *
                        <select
                          className={`${inputStyle} mt-1.5`}
                          value={data.scholarshipCategory}
                          onChange={e => set('scholarshipCategory', e.target.value)}
                        >
                          <option value="GENERAL_MERIT">General merit</option>
                          <option value="FINANCIALLY_NEEDY">Financially needy</option>
                          <option value="ORPHAN">Orphan</option>
                          <option value="PERSON_WITH_DISABILITY">Person with disability</option>
                        </select>
                      </label>
                      {field('guardianOccupation', 'Guardian occupation')}
                      {field('guardianMonthlyIncome', 'Monthly household income (PKR)', false, 'number')}
                      {field('registrationCentre', 'Registration centre')}
                      {field('referralSource', 'Referral source')}
                    </div>
                    <label className="my-4 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={sameContact}
                        onChange={e => setSameContact(e.target.checked)}
                      />
                      Use parent mobile as emergency contact
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {!sameContact && field('emergencyContact', 'Emergency contact number', true, 'tel')}
                      {field('emergencyRelation', 'Emergency contact relation', true)}
                    </div>
                  </>
                ))}

                {section('admin-Documents', 'Documents & photo', (
                  <>
                    <p className="mb-4 text-sm text-slate-500">
                      {isEdit
                        ? 'Existing candidate documents and photo remain preserved on file. Upload below only if you need to update or replace a document.'
                        : 'JPG, PNG or PDF, up to 5 MB each. Photo and signature must be images. Files upload when you save.'}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {documentTypes.map(([key, label]) => (
                        <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                          <p className="text-sm font-semibold text-slate-800">{label}</p>
                          {essentialDocs.includes(key) && !isEdit && (
                            <span className="text-xs text-slate-500">Standard application document</span>
                          )}
                          {attachments[key] ? (
                            <>
                              {attachments[key].file.type.startsWith('image/') && (
                                <img
                                  src={attachments[key].preview}
                                  alt={`${label} preview`}
                                  className="mt-2 h-24 w-full rounded-lg bg-slate-50 object-contain"
                                />
                              )}
                              <a
                                href={attachments[key].preview}
                                target="_blank"
                                rel="noreferrer"
                                className="my-2 block truncate text-xs text-blue-700 underline"
                              >
                                {attachments[key].file.name}
                              </a>
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-600 cursor-pointer"
                                onClick={() => removeAttachment(key)}
                              >
                                Remove / replace
                              </button>
                            </>
                          ) : (
                            <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-slate-300 p-3 text-xs text-[#185b9d] hover:bg-slate-50">
                              <IconUpload size={16} className="mb-2" />
                              {isEdit ? 'Choose file to replace' : 'Choose file'}
                              <input
                                aria-label={label}
                                type="file"
                                className="mt-2 block w-full text-xs"
                                accept={key === 'photo' || key === 'signature' ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf'}
                                onChange={e => {
                                  selectFile(key, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>

                    {!isEdit && (
                      <>
                        <p className="mt-4 text-sm font-medium text-slate-700">
                          {Object.keys(attachments).length} files selected · {essentialDocs.filter(key => attachments[key]).length}/5 standard documents
                        </p>
                        {essentialDocs.some(key => !attachments[key]) && (
                          <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={allowMissing}
                              onChange={e => setAllowMissing(e.target.checked)}
                            />
                            Save with missing documents. This application will have an incomplete document checklist.
                          </label>
                        )}
                      </>
                    )}
                  </>
                ))}
              </fieldset>
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 py-4">
              {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span aria-live="polite" className="text-sm text-slate-500">
                  {progress || (isEdit ? 'Required fields are marked *. Review changes before saving.' : 'Required fields are marked *. Review details before saving.')}
                </span>
                <div className="flex gap-2">
                  <button type="button" className={buttonStyle} disabled={busy} onClick={close}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-[#185b9d] hover:bg-[#13497d] px-5 py-2 text-xs font-bold text-white transition cursor-pointer disabled:opacity-60"
                  >
                    {busy ? <IconLoader size={18} className="animate-spin" /> : <IconCheckCircle size={18} />}
                    {busy ? (isEdit ? 'Saving changes…' : 'Saving…') : (isEdit ? 'Save Changes' : 'Register Student & Issue Challan')}
                  </button>
                </div>
              </div>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
};
