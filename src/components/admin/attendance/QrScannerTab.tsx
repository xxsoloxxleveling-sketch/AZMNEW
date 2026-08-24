import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Camera,
  CameraOff,
  SwitchCamera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
} from 'lucide-react';
import jsQR from 'jsqr';
import { mockApi, MockStudent, MockAttendance } from '../../../lib/mockApi';

interface QrScannerTabProps {
  onAttendanceMarked?: () => void;
}

export const QrScannerTab: React.FC<QrScannerTabProps> = ({ onAttendanceMarked }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    attendance: MockAttendance;
    student: MockStudent;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasScannedRecent, setHasScannedRecent] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScannedTokenRef = useRef<string>('');
  const lastScanTimestampRef = useRef<number>(0);

  // Simple Web Audio API success beep
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }, [soundEnabled]);

  // Process Scanned Token
  const handleScanToken = useCallback(
    async (rawToken: string) => {
      if (!rawToken || !rawToken.trim()) return;
      const token = rawToken.trim();

      // Debounce duplicate scans within 3 seconds
      const now = Date.now();
      if (token === lastScannedTokenRef.current && now - lastScanTimestampRef.current < 3000) {
        return;
      }

      lastScannedTokenRef.current = token;
      lastScanTimestampRef.current = now;

      setIsScanning(true);
      setErrorMessage(null);
      setHasScannedRecent(true);
      playBeep();

      if (navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (e) {}
      }

      try {
        const res = await mockApi.scanAttendance({
          qrToken: token,
          status: 'PRESENT',
        });
        setLastResult(res);
        if (onAttendanceMarked) onAttendanceMarked();
      } catch (err: any) {
        setErrorMessage(err.message || 'Scan verification failed.');
      } finally {
        setIsScanning(false);
        setTimeout(() => {
          setHasScannedRecent(false);
        }, 1200);
      }
    },
    [onAttendanceMarked, playBeep]
  );

  // Stop camera media tracks
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera media stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser or requires HTTPS.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device detected on this system.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unable to access device camera.'}`);
      }
    }
  }, [facingMode, stopCamera]);

  // Frame scanner loop using jsQR
  useEffect(() => {
    if (!isCameraActive) {
      stopCamera();
      return;
    }

    startCamera();

    let isSubscribed = true;

    const scanFrame = () => {
      if (!isSubscribed) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim()) {
            handleScanToken(code.data);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isSubscribed = false;
      stopCamera();
    };
  }, [isCameraActive, facingMode, startCamera, stopCamera, handleScanToken]);

  const toggleCamera = () => {
    setIsCameraActive((prev) => !prev);
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Camera Scanner Viewport */}
      <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Biometric QR Scanner</h3>
            <p className="text-xs text-slate-400">Live hardware camera stream with real-time OMR QR detection</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-xl text-xs font-semibold border transition ${
                soundEnabled
                  ? 'bg-blue-50 text-[#185b9d] border-blue-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
              title={soundEnabled ? 'Mute Scan Sound' : 'Unmute Scan Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
                isCameraActive && !cameraError
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCameraActive && !cameraError ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'
                }`}
              />
              {isCameraActive && !cameraError ? 'Camera Live' : 'Camera Paused'}
            </span>
          </div>
        </div>

        {/* Viewport Frame */}
        <div className="relative aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center text-center text-white border-4 border-slate-800 shadow-inner">
          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Live Video Feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${
              !isCameraActive || cameraError ? 'hidden' : 'block'
            }`}
          />


          {/* Fallback View when Camera is Off or Errored */}
          {(!isCameraActive || cameraError) && (
            <div className="p-6 space-y-3 max-w-sm mx-auto z-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <CameraOff className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                {cameraError ? 'Camera Access Notice' : 'Camera Feed Paused'}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {cameraError || 'The live device camera stream is paused. Click below to reconnect.'}
              </p>
              <button
                onClick={() => {
                  setIsCameraActive(true);
                  startCamera();
                }}
                className="px-4 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                Reconnect Camera
              </button>
            </div>
          )}

          {/* Holographic Overlay when Camera is Active */}
          {isCameraActive && !cameraError && (
            <>
              <div className="absolute inset-0 bg-radial from-transparent via-slate-950/20 to-slate-950/60 pointer-events-none" />

              {/* Scanning Reticle */}
              <div
                className={`w-56 h-56 sm:w-64 sm:h-64 border-2 rounded-2xl relative flex items-center justify-center transition-all duration-300 pointer-events-none ${
                  hasScannedRecent
                    ? 'border-emerald-400 scale-105 shadow-2xl shadow-emerald-500/50 bg-emerald-500/10'
                    : 'border-emerald-400/80 shadow-lg shadow-emerald-500/20'
                }`}
              >
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Laser Animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-md shadow-emerald-400 animate-bounce" />

                {hasScannedRecent ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-in zoom-in" />
                ) : (
                  <QrCode className="w-16 h-16 text-white/20" />
                )}
              </div>

              {/* Status Hint */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-medium text-slate-300 z-10">
                <span className="bg-slate-900/80 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                  {hasScannedRecent ? '✓ QR Code Recognized' : 'Align Candidate QR Code in Viewport'}
                </span>

                <div className="flex gap-1.5">
                  <button
                    onClick={flipCamera}
                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-xs transition"
                    title="Flip Camera (Front/Rear)"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleCamera}
                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-xs transition"
                    title="Pause Camera"
                  >
                    <CameraOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Simulator Buttons */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Simulate Instant QR Scan:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleScanToken('qr_AZMVS-2026-0001_signed_token_991823')}
              disabled={isScanning}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-left font-semibold text-slate-800 transition flex items-center justify-between shadow-2xs hover:border-slate-300"
            >
              <span>Scan AZMVS-2026-0001 (Hamza Tariq)</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </button>
            <button
              onClick={() => handleScanToken('qr_AZMVS-2026-0003_signed_token_776123')}
              disabled={isScanning}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-left font-semibold text-slate-800 transition flex items-center justify-between shadow-2xs hover:border-slate-300"
            >
              <span>Scan AZMVS-2026-0003 (Bilal Ahmed)</span>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>
        </div>

        {/* Manual Input Fallback */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste raw QR token or roll number (e.g. AZMVS-2026-0001)..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#185b9d]/20"
          />
          <button
            onClick={() => handleScanToken(tokenInput)}
            disabled={isScanning || !tokenInput.trim()}
            className="px-4 py-2 bg-[#185b9d] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#13497d] transition disabled:opacity-50"
          >
            {isScanning ? 'Verifying...' : 'Verify Token'}
          </button>
        </div>
      </div>

      {/* Right: Instant Scan Confirmation Card & Verification Result */}
      <div className="lg:col-span-5 space-y-4">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Attendance Verification Error</span>
            </div>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {lastResult ? (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-emerald-200 shadow-lg shadow-emerald-500/10 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Marked Present ✓
              </span>
              <span className="text-[11px] font-semibold text-slate-400 font-mono">
                {new Date(lastResult.attendance.createdAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={
                  lastResult.student.photoUrl ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                }
                alt="Student"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-md bg-slate-100"
              />
              <div className="min-w-0">
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {lastResult.student.fullName}
                </h4>
                <p className="text-xs text-slate-500 font-medium truncate">
                  S/D/O {lastResult.student.fatherName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="font-bold text-[#185b9d] font-mono">{lastResult.student.rollNumber}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-slate-600">{lastResult.student.currentClass}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Method:</span>
                <strong className="text-slate-800">{lastResult.attendance.method}</strong>
              </div>
              <div className="flex justify-between">
                <span>Examiner / Officer:</span>
                <strong className="text-slate-800">{lastResult.attendance.markedByName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Scholarship Stream:</span>
                <strong className="text-[#185b9d]">{lastResult.student.scholarshipCategory}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-200 text-center space-y-3 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
              <QrCode className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">Awaiting Scan</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Hold any candidate Roll Number Slip with its QR barcode in front of your camera to verify and mark attendance automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

