import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle, Loader2, ArrowRight, X, RotateCcw, WifiOff } from 'lucide-react';
import { API_BASE_URL } from '../../lib/apiClient';

interface PreSubmitCaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

type ModalStep = 'warmup' | 'captcha' | 'submitting' | 'error';

interface MathChallenge {
  num1: number;
  num2: number;
  operator: '+' | '-';
  answer: number;
}

function createRandomChallenge(): MathChallenge {
  const isAddition = Math.random() > 0.3;
  if (isAddition) {
    const n1 = Math.floor(Math.random() * 12) + 2; // 2 to 13
    const n2 = Math.floor(Math.random() * 9) + 2;  // 2 to 10
    return { num1: n1, num2: n2, operator: '+', answer: n1 + n2 };
  } else {
    const n1 = Math.floor(Math.random() * 15) + 6; // 6 to 20
    const n2 = Math.floor(Math.random() * (n1 - 1)) + 1; // 1 to n1-1
    return { num1: n1, num2: n2, operator: '-', answer: n1 - n2 };
  }
}

export const PreSubmitCaptchaModal: React.FC<PreSubmitCaptchaModalProps> = ({
  isOpen,
  onClose,
  onConfirmSubmit,
  isSubmitting: parentSubmitting,
}) => {
  const [step, setStep] = useState<ModalStep>('warmup');
  const [challenge, setChallenge] = useState<MathChallenge>(() => createRandomChallenge());
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [captchaError, setCaptchaError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Timer ref for submitting elapsed duration
  const timerRef = useRef<any>(null);

  // Generate a new challenge explicitly
  const refreshChallenge = () => {
    setChallenge(createRandomChallenge());
    setUserAnswer('');
    setCaptchaError('');
  };

  // When modal opens, initialize state and trigger background warm-up
  useEffect(() => {
    if (isOpen) {
      setStep('warmup');
      refreshChallenge();
      setSubmissionError('');
      setElapsedSeconds(0);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, 45000);

      // Fast-path transition: If warm-up takes > 1.2s, let user solve CAPTCHA in parallel
      const parallelTransition = setTimeout(() => {
        setStep((prev) => (prev === 'warmup' ? 'captcha' : prev));
      }, 1200);

      fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then(() => {
          clearTimeout(timeoutId);
          clearTimeout(parallelTransition);
          setStep((prev) => (prev === 'warmup' ? 'captcha' : prev));
        })
        .catch(() => {
          clearTimeout(timeoutId);
          clearTimeout(parallelTransition);
          setStep((prev) => (prev === 'warmup' ? 'captcha' : prev));
        });

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(parallelTransition);
        try {
          controller.abort();
        } catch {}
      };
    }
  }, [isOpen]);

  // Handle submitting timer for user reassurance
  useEffect(() => {
    if (step === 'submitting' || isProcessing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [step, isProcessing]);

  if (!isOpen) return null;

  // Execute the actual submission
  const runSubmit = async () => {
    setStep('submitting');
    setIsProcessing(true);
    setSubmissionError('');

    try {
      await onConfirmSubmit();
      // On success, parent will close modal and show confirmation screen
    } catch (err: any) {
      const errMsg = err?.message || 'Server connection timed out. Please retry.';
      setSubmissionError(errMsg);
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaptchaError('');

    const parsed = parseInt(userAnswer.trim(), 10);
    if (isNaN(parsed) || parsed !== challenge.answer) {
      setCaptchaError('Incorrect answer. Please solve the challenge or click the refresh button for a new question.');
      return;
    }

    await runSubmit();
  };

  const handleDirectRetry = async () => {
    await runSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 relative overflow-hidden">
        {/* Close button (disabled while submitting) */}
        {!isProcessing && !parentSubmitting && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ================= STEP 1: SERVER WARM-UP ================= */}
        {step === 'warmup' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-[#185b9d]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Connecting to Server</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Establishing a secure connection to the AZM.AIO application database…
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                Step 1 of 2: Network Pre-Flight
              </span>
            </div>
          </div>
        )}

        {/* ================= STEP 2: CAPTCHA VERIFICATION ================= */}
        {step === 'captcha' && !isProcessing && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Human Verification</h3>
              <p className="text-xs text-slate-500">
                Please solve this quick math challenge to verify and complete your scholarship submission.
              </p>
            </div>

            {/* Visual Challenge Card */}
            <form onSubmit={handleVerifyAndSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <div className="flex items-center justify-center gap-3 font-mono text-2xl font-bold text-slate-800 tracking-wider">
                  <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs min-w-[44px]">
                    {challenge.num1}
                  </span>
                  <span className="text-[#185b9d] text-xl font-sans">{challenge.operator}</span>
                  <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs min-w-[44px]">
                    {challenge.num2}
                  </span>
                  <span className="text-slate-400">=</span>
                  <span className="text-slate-400 font-sans text-xl">?</span>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <input
                    type="number"
                    required
                    autoFocus
                    placeholder="Enter answer"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      if (captchaError) setCaptchaError('');
                    }}
                    className={`w-36 text-center py-2.5 px-3 rounded-xl border text-sm font-bold text-slate-900 focus:outline-hidden transition ${
                      captchaError
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/20'
                        : 'border-slate-300 focus:border-[#185b9d] bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={refreshChallenge}
                    className="p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition flex items-center justify-center cursor-pointer"
                    title="Get a different math question"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {captchaError && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{captchaError}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={!userAnswer.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#185b9d] hover:bg-[#13497d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Verify &amp; Submit Application</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[10px] text-center text-slate-400">
                  Your entered form details and uploaded files are preserved safely.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 3: SUBMITTING ================= */}
        {step === 'submitting' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-[#185b9d]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">
                {elapsedSeconds < 5
                  ? 'Submitting Application…'
                  : elapsedSeconds < 15
                  ? 'Connecting to Examination Server…'
                  : 'Waking Up Cloud Instance…'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                {elapsedSeconds < 15
                  ? 'Recording your candidate profile and generating your official Session V registration receipt…'
                  : 'The secure server is completing its cold-start activation (~30s). Please keep this screen open, all your uploaded documents and information are safe.'}
              </p>
            </div>
            {elapsedSeconds >= 8 && (
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                Elapsed: {elapsedSeconds}s
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 4: ERROR & DIRECT RETRY ================= */}
        {step === 'error' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 mb-2">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Submission Paused</h3>
              <p className="text-xs text-slate-500">
                We encountered an issue connecting to the application server.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                  {submissionError || "Could not complete the request. The server may be waking up."}
                </p>
              </div>
              <p className="text-[11px] text-slate-600 pl-6">
                ✓ <strong>Good news:</strong> None of your information was lost. You do not need to re-type your form.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleDirectRetry}
                className="w-full py-3 px-4 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Submission Now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  refreshChallenge();
                  setStep('captcha');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Solve a Different Verification Math Question
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
