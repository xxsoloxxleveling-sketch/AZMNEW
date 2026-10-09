import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera } from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { mockApi, type AttendanceSession, type AttendanceSessionDetail } from '../../../lib/mockApi';
import { QrScannerTab } from './QrScannerTab';
import { CandidateQrReader } from './qrReader';

interface TeacherScanViewProps {
  onBackToDashboard?: () => void;
}

function cameraMessage(error: unknown): string {
  switch ((error as { name?: string }).name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in your browser settings and try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No suitable camera is available on this device.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera could not start. Close other apps using the camera and try again.';
    default:
      return 'The camera could not connect. Check browser permissions and try again.';
  }
}

export const TeacherScanView: React.FC<TeacherScanViewProps> = ({ onBackToDashboard }) => {
  const { user, role, logout } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [detail, setDetail] = useState<AttendanceSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewStarting, setPreviewStarting] = useState(false);
  const [previewFacing, setPreviewFacing] = useState<'environment' | 'user'>('environment');
  const [previewError, setPreviewError] = useState('');
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewFrameRef = useRef<number | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewGenerationRef = useRef(0);
  const [previewQrFound, setPreviewQrFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingSessions(true);
    setLoadError('');

    const load = async () => {
      const open: AttendanceSession[] = [];
      let page = 1;
      while (active) {
        const result = await mockApi.getAttendanceSessions({ status: 'OPEN', page, limit: 100 });
        open.push(...result.sessions.filter(session => session.status === 'OPEN'));
        if (page >= result.pagination.totalPages) break;
        page += 1;
      }
      if (!active) return;
      setSessions(open);
      setSessionId(previous => open.some(session => session.id === previous) ? previous : open[0]?.id ?? '');
    };

    load()
      .catch((error: Error) => {
        if (active) {
          setSessions([]);
          setSessionId('');
          setLoadError(error.message || 'Open attendance sessions could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setLoadingSessions(false);
      });

    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setDetailError('');

    if (!sessionId) {
      setLoadingDetail(false);
      return () => {
        active = false;
      };
    }

    setLoadingDetail(true);
    mockApi.getAttendanceSession(sessionId)
      .then(result => {
        if (!active) return;
        if (result.session.id !== sessionId || result.session.status !== 'OPEN') {
          throw new Error('The selected examination session is no longer open.');
        }
        setDetail(result);
      })
      .catch((error: Error) => {
        if (active) setDetailError(error.message || 'The selected attendance session could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId, refresh]);

  useEffect(() => {
    const generation = ++previewGenerationRef.current;
    const stop = () => {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
      previewStreamRef.current?.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      previewStreamRef.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
    };

    stop();
    setPreviewQrFound(false);
    if (!previewEnabled || sessions.length > 0) {
      setPreviewStarting(false);
      return () => {
        ++previewGenerationRef.current;
        stop();
      };
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPreviewError('Camera access requires a supported browser on HTTPS or localhost.');
      setPreviewEnabled(false);
      return () => {
        ++previewGenerationRef.current;
        stop();
      };
    }

    setPreviewStarting(true);
    setPreviewError('');

    const current = () => previewGenerationRef.current === generation;
    const start = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: previewFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (!current() || !previewRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
        if (!current()) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        setPreviewStarting(false);
        const reader = new CandidateQrReader();
        let decoding = false;
        let lastDecode = 0;
        let found = false;
        const previewFrame = (now: number) => {
          if (!current()) return;
          const source = previewRef.current, canvas = previewCanvasRef.current;
          if (!found && !decoding && source && canvas && source.readyState >= 2 && source.videoWidth > 0 && now - lastDecode >= 400) {
            lastDecode = now;
            decoding = true;
            void reader.decode(source, canvas).then(result => {
              // This local detection deliberately does not send a token or
              // claim the candidate's identity has been authenticated.
              if (current() && result) { found = true; setPreviewQrFound(true); }
            }).catch(() => {}).finally(() => { decoding = false; });
          }
          previewFrameRef.current = requestAnimationFrame(previewFrame);
        };
        previewFrameRef.current = requestAnimationFrame(previewFrame);
        stream.getVideoTracks().forEach(track => {
          track.onended = () => {
            if (current()) {
              setPreviewError('Camera disconnected. Reconnect to continue checking the device.');
              setPreviewEnabled(false);
            }
          };
        });
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        if (current()) {
          stop();
          setPreviewStarting(false);
          setPreviewEnabled(false);
          setPreviewError(cameraMessage(error));
        }
      }
    };

    void start();

    return () => {
      ++previewGenerationRef.current;
      stop();
    };
  }, [previewEnabled, previewFacing, sessions.length]);

  useEffect(() => {
    if (sessions.length > 0 && previewEnabled) setPreviewEnabled(false);
  }, [sessions.length, previewEnabled]);

  const sessionLabel = (session: AttendanceSession) =>
    `${session.examDateSnapshot || session.businessDate} · ${session.hallNameSnapshot || 'Exam Hall'} · ${session.roomNumberSnapshot || 'Room not set'}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="min-h-14 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold">AZM Mobile QR Scanner</h1>
          <p className="mt-0.5 text-xs text-slate-500">Camera check and Hall-session attendance scanning</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#185b9d] hover:bg-slate-50"
            >
              {role === 'TEACHER' ? 'Attendance Hub' : 'Dashboard'}
            </button>
          )}
          <button onClick={logout} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto flex-1 p-4 sm:p-6 space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Open Examination Session</h2>
              <p className="mt-1 text-xs text-slate-500">Attendance scans can only be saved against an OPEN frozen Hall session.</p>
            </div>
            <button
              type="button"
              onClick={() => setRefresh(value => value + 1)}
              disabled={loadingSessions}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loadingSessions && <p role="status" className="mt-3 text-sm text-slate-600">Loading open attendance sessions…</p>}
          {loadError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

          {!loadingSessions && !loadError && sessions.length > 0 && (
            <div className="mt-4">
              <label htmlFor="scanner-session" className="mb-1 block text-xs font-semibold text-slate-700">Select OPEN Hall session</label>
              <select
                id="scanner-session"
                value={sessionId}
                onChange={event => setSessionId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#185b9d]/20"
              >
                {sessions.map(session => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}
              </select>
            </div>
          )}

          {!loadingSessions && !loadError && sessions.length === 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">No OPEN attendance session exists yet.</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">You can check the camera and locally detect a QR below. Without an OPEN frozen Hall session the app cannot authenticate the QR or save attendance.</p>
            </div>
          )}
        </section>

        {!loadingSessions && !loadError && sessions.length === 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="camera-check-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="camera-check-title" className="text-sm font-bold">Camera Check</h2>
                <p className="mt-1 text-xs text-slate-500">Local QR recognition only. This does not authenticate the candidate or save attendance; open a Hall session first.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={previewStarting}
                  onClick={() => setPreviewEnabled(value => !value)}
                  className="rounded-lg bg-[#185b9d] px-3 py-2 text-xs font-bold text-white hover:bg-[#13497d] disabled:opacity-50"
                >
                  {previewEnabled ? 'Stop camera' : 'Connect camera'}
                </button>
                <button
                  type="button"
                  disabled={!previewEnabled || previewStarting}
                  onClick={() => setPreviewFacing(value => value === 'environment' ? 'user' : 'environment')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <SwitchCamera size={14} />
                  Switch camera
                </button>
              </div>
            </div>

            <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-slate-950">
              <video ref={previewRef} muted playsInline className={`h-full w-full object-contain ${previewFacing === 'user' ? 'scale-x-[-1]' : ''}`} aria-label="Camera check preview" />
              <canvas ref={previewCanvasRef} hidden />
              {previewEnabled && <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="h-[75%] aspect-square rounded-xl border-2 border-amber-300/80" /></div>}
              {!previewEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-300">
                  <Camera size={28} aria-hidden="true" />
                  <span>Connect the camera to preview it</span>
                </div>
              )}
            </div>

            {previewStarting && <p role="status" className="mt-2 text-sm text-slate-600">Connecting camera…</p>}
            {previewError && <p role="alert" className="mt-2 text-sm text-red-700">{previewError}</p>}
            {previewEnabled && !previewStarting && !previewError && <p role="status" className={'mt-2 text-sm font-semibold ' + (previewQrFound ? 'text-emerald-700' : 'text-amber-800')}>{previewQrFound ? 'QR decoded locally — not verified. Open a Hall session to verify attendance.' : 'Camera live — looking for a readable QR. Keep it centered and close.'}</p>}
            <p className="mt-3 text-xs text-slate-500">Signed in as {user?.name || 'Staff member'} ({role}). Camera permission is controlled by this browser/device.</p>
          </section>
        )}

        {sessions.length > 0 && (
          <>
            {loadingDetail && <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading selected Hall session…</section>}
            {detailError && <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detailError}</section>}
            {detail && !loadingDetail && !detailError && <QrScannerTab detail={detail} />}
          </>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        Camera Check may recognize a QR locally, but never verifies identity or marks attendance. Attendance scanning requires an OPEN Hall session.
      </footer>
    </main>
  );
};
