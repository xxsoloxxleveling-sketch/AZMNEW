import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, UserRound, Flashlight, ImageUp, ScanLine } from 'lucide-react';
import { CandidateQrReader, decodeCandidateQrImage } from './qrReader';
import { mockApi, type AttendanceMarkResponse, type AttendanceSessionDetail } from '../../../lib/mockApi';
import { attendancePrimary, attendanceSecondary, attendanceValue } from './AttendanceDialog';

type ScanResult = AttendanceMarkResponse & { alreadyMarked?: boolean };
type ScanError = { title: string; message: string };
type Props = { detail?: AttendanceSessionDetail; onManualAttendance?: () => void; onBusyChange?: (busy: boolean) => void };
// Protect an outstanding request even if the scanner is unmounted/reopened.
let requestPending = false;

function scanError(error: unknown): ScanError {
  const failure = error as { status?: number; code?: string; message?: string };
  if (failure.code === 'INVALID_QR' || failure.status === 400) return { title: 'Invalid Candidate QR', message: 'Use the candidate’s signed AZM attendance QR, or mark attendance manually.' };
  if (failure.status === 401 || failure.status === 403) return { title: 'Attendance NOT saved', message: 'Your attendance access has expired or is unavailable. Sign in again before retrying.' };
  if (failure.status === 404) return { title: 'Candidate or session not found', message: 'The candidate QR or selected session is unavailable. Check the candidate and session before retrying.' };
  if (failure.status === 409) return { title: 'Attendance NOT saved', message: /CLOSED/.test(failure.message ?? '') ? 'This examination session is closed. Refresh the workspace.' : /ACTIVE/.test(failure.message ?? '') ? 'This candidate is not active. Check the candidate record.' : /frozen Hall/.test(failure.message ?? '') ? 'This candidate is not in the selected Hall’s frozen session roster.' : 'The attendance operation conflicted. Check the session and retry.' };
  return { title: 'Attendance NOT saved', message: 'The server could not confirm this attendance. Keep the candidate at the desk and retry.' };
}

function cameraError(error: unknown): string {
  switch ((error as { name?: string }).name) {
    case 'NotAllowedError': case 'SecurityError': return 'Camera permission was denied. Allow camera access in your browser and reconnect.';
    case 'NotFoundError': case 'OverconstrainedError': return 'The requested camera is unavailable. Try the other camera or use manual attendance.';
    case 'NotReadableError': case 'AbortError': return 'The camera could not start. Close other apps using it, then reconnect.';
    default: return 'The camera could not connect. Try reconnecting or use manual attendance.';
  }
}

function successFeedback() {
  try { navigator.vibrate?.(60); } catch { /* Feedback must not affect persistence. */ }
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = 880; gain.gain.value = 0.06;
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.onended = () => { void context.close().catch(() => {}); };
    void context.resume().then(() => { oscillator.start(); oscillator.stop(context.currentTime + 0.1); }).catch(() => { void context.close().catch(() => {}); });
  } catch { /* Audio is optional. */ }
}

export const QrScannerTab: React.FC<Props> = ({ detail, onManualAttendance, onBusyChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null), frameRef = useRef<number | null>(null);
  const generationRef = useRef(0), mountedRef = useRef(false), lockedRef = useRef(false), tokenRef = useRef('');
  const submitRef = useRef<(token: string) => Promise<void>>(async () => {});
  const busyCallbackRef = useRef(onBusyChange); busyCallbackRef.current = onBusyChange;
  const [cameraEnabled, setCameraEnabled] = useState(false), [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [cameraStarting, setCameraStarting] = useState(false), [cameraMessage, setCameraMessage] = useState('');
  const [cameraReady, setCameraReady] = useState(false), [torchAvailable, setTorchAvailable] = useState(false), [torchOn, setTorchOn] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [pending, setPending] = useState(false), [result, setResult] = useState<ScanResult | null>(null), [error, setError] = useState<ScanError | null>(null);
  const ready = detail?.session.status === 'OPEN';

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  submitRef.current = async (token: string) => {
    if (lockedRef.current || requestPending || !ready || !detail) return;
    // Synchronous guards precede every asynchronous operation and React state update.
    lockedRef.current = true; requestPending = true; tokenRef.current = token;
    setPending(true); setResult(null); setError(null); busyCallbackRef.current?.(true);
    let confirmationTimedOut = false;
    const watchdog = window.setTimeout(() => {
      confirmationTimedOut = true;
      if (mountedRef.current) setError(scanError(new Error('Confirmation timeout')));
    }, 20000);
    try {
      const confirmed = await mockApi.scanAttendance({ sessionId: detail.session.id, qrToken: token, status: 'PRESENT' });
      if (!mountedRef.current || confirmationTimedOut) return;
      setResult(confirmed);
      if (!confirmed.alreadyMarked) successFeedback();
    } catch (failure) {
      if (mountedRef.current) setError(scanError(failure));
    } finally {
      window.clearTimeout(watchdog); requestPending = false;
      if (mountedRef.current) { setPending(false); busyCallbackRef.current?.(false); }
      // Terminal results stay locked until the operator explicitly re-arms scanning.
    }
  };

  useEffect(() => {
    const generation = ++generationRef.current;
    const release = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      streamRef.current?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    release();
    setCameraReady(false); setTorchAvailable(false); setTorchOn(false);
    if (!cameraEnabled || !ready) { setCameraStarting(false); return release; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera scanning requires a supported browser on HTTPS or localhost. Use manual attendance here.');
      setCameraEnabled(false); return release;
    }
    setCameraStarting(true); setCameraMessage('');
    const current = () => mountedRef.current && generationRef.current === generation;
    const start = async () => {
      let acquired: MediaStream | null = null;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (!current() || !videoRef.current) { acquired.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = acquired;
        videoRef.current.srcObject = acquired;
        await videoRef.current.play();
        if (!current()) { acquired.getTracks().forEach(track => track.stop()); return; }
        setCameraStarting(false); setCameraReady(true);
        // Apply continuous autofocus only when advertised by the device.
        // Do not interrupt scanning if a camera driver rejects this hint.
        for (const track of acquired.getVideoTracks()) {
          try {
            const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }) | undefined;
            setTorchAvailable(Boolean(capabilities?.torch));
            if (capabilities?.focusMode?.includes('continuous')) {
              void track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
            }
          } catch {
            // Some camera drivers throw while reporting capabilities.
            // Keep the already-working stream and continue scanning.
          }
        }
        acquired.getVideoTracks().forEach(track => { track.onended = () => {
          if (current()) { setCameraMessage('Camera disconnected. Reconnect or use manual attendance.'); setCameraEnabled(false); }
        }; });
        const reader = new CandidateQrReader();
        let lastDecode = 0;
        let decoding = false;
        const frame = (now: number) => {
          if (!current()) return;
          const video = videoRef.current, canvas = canvasRef.current;
          if (!decoding && !lockedRef.current && !requestPending && video && canvas && video.readyState >= 2 && video.videoWidth > 0 && now - lastDecode >= 250) {
            lastDecode = now;
            decoding = true;
            void reader.decode(video, canvas).then(decoded => {
              // No scanned value is trusted here; mockApi verifies the signed
              // token and the backend confirms frozen Hall membership.
              if (current() && decoded && !lockedRef.current && !requestPending) {
                void submitRef.current(decoded.value);
              }
            }).catch(() => {
              if (current()) {
                setCameraMessage('The camera image could not be processed. Reconnect or use a QR image instead.');
                setCameraEnabled(false);
              }
            }).finally(() => { decoding = false; });
          }
          frameRef.current = requestAnimationFrame(frame);
        };
        frameRef.current = requestAnimationFrame(frame);
      } catch (failure) {
        acquired?.getTracks().forEach(track => track.stop());
        if (current()) { release(); setCameraStarting(false); setCameraEnabled(false); setCameraMessage(cameraError(failure)); }
      }
    };
    void start();
    return () => { ++generationRef.current; release(); };
  }, [cameraEnabled, facing, ready]);

  const nextCandidate = () => {
    if (pending || requestPending) return;
    setResult(null); setError(null); setImageMessage(''); tokenRef.current = ''; lockedRef.current = false;
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchAvailable) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(value => !value);
    } catch {
      setCameraMessage('This camera cannot switch its light right now. Continue scanning in better lighting.');
    }
  };

  const scanImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || pending || requestPending || lockedRef.current || !ready) return;
    setImageMessage('Reading QR from the selected image locally…');
    try {
      const decoded = await decodeCandidateQrImage(file, new CandidateQrReader(), document.createElement('canvas'));
      if (!mountedRef.current || !ready) return;
      if (!decoded) {
        setImageMessage('No readable QR was found. Try a clearer, closer image with the entire code visible.');
        return;
      }
      if (requestPending || lockedRef.current) return;
      setImageMessage('QR recognized — requesting secure Hall attendance verification.');
      await submitRef.current(decoded.value);
    } catch (failure) {
      if (mountedRef.current) setImageMessage((failure as Error).message || 'This QR image could not be read.');
    }
  };
  if (!ready || !detail) return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><h2 className="font-semibold text-slate-900">QR attendance</h2><p className="mt-1">Select an OPEN examination Hall session before scanning attendance.</p>{onManualAttendance && <button className={attendanceSecondary + ' mt-3'} onClick={onManualAttendance}>Can't scan? Mark attendance manually</button>}</section>;
  const candidate = result && detail.roster.find(row => row.studentId === result.student.id);
  const fields = result ? [
    ['Candidate', result.student.fullName], ['Roll number', result.student.rollNumber], ['Class', result.student.currentClass],
    ['Attendance status', result.attendance.status], ['Original attendance time', new Date(result.attendance.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) + ' PKT'],
    ['Attendance method', result.attendance.method], ['Test Center', detail.session.testCenterNameSnapshot], ['Hall', detail.session.hallNameSnapshot],
    ['Room', detail.session.roomNumberSnapshot], ['Seat', candidate?.seatNoSnapshot],
  ] : [];
  return <section aria-labelledby="qr-attendance-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="qr-attendance-title" className="text-sm font-bold">QR attendance</h2><p className="mt-1 text-xs text-slate-500">Scan a signed AZM candidate QR for this frozen Hall session.</p></div><div className="flex flex-wrap gap-2">
      <button className={attendanceSecondary} disabled={pending} onClick={() => setCameraEnabled(value => !value)}>{cameraEnabled ? 'Stop camera' : 'Connect camera'}</button>
      <button className={attendanceSecondary} disabled={!cameraEnabled || pending} onClick={() => setFacing(value => value === 'environment' ? 'user' : 'environment')}>Switch camera</button>
      {torchAvailable && <button className={attendanceSecondary} disabled={!cameraReady || pending} aria-pressed={torchOn} onClick={() => void toggleTorch()}><Flashlight size={14} aria-hidden="true" />{torchOn ? 'Light off' : 'Light on'}</button>}
    </div></div>
    <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-2">
      <div><div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
        <video ref={videoRef} muted playsInline className="h-full w-full object-contain" aria-label="Live candidate QR camera" />
        {cameraReady && !pending && !result && !error && <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="h-[75%] aspect-square rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]" /></div>}
        {cameraReady && <div className="pointer-events-none absolute bottom-2 inset-x-0 flex justify-center"><span className="rounded-md bg-slate-950/80 px-2 py-1 text-[11px] text-white">{pending ? 'QR recognized: checking server' : result ? 'Server verified attendance' : error ? 'QR rejected — review message' : 'Camera live · Finding QR…'}</span></div>}
        {!cameraEnabled && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-200"><Camera size={24} aria-hidden="true" /><span>Connect the camera to scan</span></div>}
      </div><canvas ref={canvasRef} hidden />
        {cameraStarting && <p role="status" className="mt-2 text-sm text-slate-600">Connecting camera…</p>}
        {cameraMessage && <div role="alert" className="mt-2 text-sm text-red-700"><p>{cameraMessage}</p><button className={attendanceSecondary + ' mt-2'} disabled={pending || cameraStarting} onClick={() => { setCameraMessage(''); setCameraEnabled(true); }}>Reconnect camera</button></div>}
        <p className="mt-2 text-xs text-slate-500">Place the complete QR inside the guide. Move the camera closer, hold steady, and avoid glare. Small printed slip QR codes may need a closer view.</p>
        <label className={attendanceSecondary + ' mt-3 inline-flex cursor-pointer items-center gap-2'}><ImageUp size={15} aria-hidden="true" />Scan QR from photo
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a QR image" className="sr-only" disabled={pending || Boolean(result) || Boolean(error)} onChange={event => void scanImage(event)} />
        </label>
        {imageMessage && <p role="status" className="mt-2 text-xs text-slate-600">{imageMessage}</p>}
        <p className="mt-2 text-xs text-slate-500">QR images are read locally. Only the decoded signed token is sent for attendance verification.</p>
      </div>
      <div className="min-w-0" aria-live="polite" aria-atomic="true">
        {pending && !error && <p role="status" className="text-sm text-slate-700">QR detected — verifying attendance…</p>}
        {error && <div role="alert" className="border-l-4 border-red-600 pl-3 text-sm"><h3 className="font-bold text-red-800">{error.title}</h3><p className="mt-1 text-slate-700">{error.message}</p>{pending && <p className="mt-2 text-xs text-slate-600">Waiting for the outstanding request to finish. Further scans remain blocked.</p>}</div>}
        {result && <><div className={'flex items-center gap-2 text-sm font-bold ' + (result.alreadyMarked ? 'text-slate-800' : 'text-emerald-800')}>{!result.alreadyMarked && <CheckCircle2 size={18} aria-hidden="true" />}<h3>{result.alreadyMarked ? 'Already Marked — ' + result.attendance.status : 'Attendance Marked'}</h3></div>
          <p className="mt-1 text-xs text-slate-500">{result.alreadyMarked ? 'Original attendance is unchanged.' : 'The server confirmed a persisted attendance record.'}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><UserRound size={20} aria-hidden="true" />Photo unavailable</div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">{fields.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{attendanceValue(value) === '—' ? 'Not available' : attendanceValue(value)}</dd></div>)}</dl>
        </>}
        {!pending && !result && !error && <p className="flex items-center gap-2 text-sm text-slate-600"><ScanLine size={17} aria-hidden="true" />{cameraReady ? 'Searching camera frames for a readable candidate QR…' : 'Ready to scan. Connect the camera or choose a QR photo.'} Attendance is confirmed only after the server saves it.</p>}
        {(result || error) && <button className={attendancePrimary + ' mt-4'} disabled={pending} onClick={nextCandidate}>Scan Next Candidate</button>}
      </div>
    </div>
    {onManualAttendance && <button className={attendanceSecondary + ' mt-4'} disabled={pending} onClick={onManualAttendance}>Can't scan? Mark attendance manually</button>}
  </section>;
};
