import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from 'lucide-react';
import { API_BASE_URL } from '../../lib/apiClient';

interface PreSubmitCaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

type ModalStep = 'warmup' | 'captcha' | 'submitting';

interface MathChallenge {
  num1: number;
  num2: number;
  operator: '+' | '-';
  answer: number;
}

export const PreSubmitCaptchaModal: React.FC<PreSubmitCaptchaModalProps> = ({
  isOpen,
  onClose,
  onConfirmSubmit,
  isSubmitting: parentSubmitting,
}) => {
  const [step, setStep] = useState<ModalStep>('warmup');
  const [warmupStatus, setWarmupStatus] = useState<'pinging' | 'ready' | 'timeout'>('pinging');
  const [challenge, setChallenge] = useState<MathChallenge>({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [captchaError, setCaptchaError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Generate a random arithmetic challenge (e.g. 7 + 6 or 15 - 4)
  const generateNewChallenge = () => {
    const isAddition = Math.random() > 0.3;
    let n1: number;
    let n2: number;
    let ans: number;
    let op: '+' | '-' = '+';

    if (isAddition) {
      n1 = Math.floor(Math.random() * 12) + 2; // 2 to 13
      n2 = Math.floor(Math.random() * 9) + 2;  // 2 to 10
      ans = n1 + n2;
      op = '+';
    } else {
      n1 = Math.floor(Math.random() * 15) + 6; // 6 to 20
      n2 = Math.floor(Math.random() * (n1 - 1)) + 1; // 1 to n1-1
      ans = n1 - n2;
      op = '-';
    }

    setChallenge({ num1: n1, num2: n2, operator: op, answer: ans });
    setUserAnswer('');
    setCaptchaError('');
  };

  // When modal opens, run Step 1: Server warm-up ping
  useEffect(() => {
    if (isOpen) {
      setStep('warmup');
      setWarmupStatus('pinging');
      generateNewChallenge();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
        setWarmupStatus('timeout');
      }, 15000);

      fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
        .then(() => {
          clearTimeout(timeoutId);
          setWarmupStatus('ready');
          // Smooth transition to CAPTCHA step
          setTimeout(() => {
            setStep('captcha');
          }, 800);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          // Even if ping fails or times out, allow candidate to proceed to CAPTCHA
          setWarmupStatus('ready');
          setTimeout(() => {
            setStep('captcha');
          }, 1200);
        });

      return () => {
        clearTimeout(timeoutId);
        try {
          controller.abort();
        } catch {}
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaptchaError('');

    const parsed = parseInt(userAnswer.trim(), 10);
    if (isNaN(parsed) || parsed !== challenge.answer) {
      setCaptchaError('Incorrect answer. Please solve the new challenge below to continue.');
      generateNewChallenge();
      return;
    }

    // CAPTCHA solved! Move to Step 3: Submitting
    setStep('submitting');
    setIsProcessing(true);

    try {
      await onConfirmSubmit();
    } catch (err: any) {
      // If parent submit fails, let user retry without leaving modal or losing data
      setStep('captcha');
      generateNewChallenge();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-8 relative overflow-hidden">
        {/* Close button (disabled while submitting) */}
        {!isProcessing && !parentSubmitting && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
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
                Connecting to the AZM.AIO server… this can take a few seconds during initial activation.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                Step 1 of 3: Network Pre-Flight
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
                  <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs min-w-[40px]">
                    {challenge.num1}
                  </span>
                  <span className="text-[#185b9d] text-xl">{challenge.operator}</span>
                  <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs min-w-[40px]">
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
                    onClick={generateNewChallenge}
                    className="p-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition flex items-center justify-center"
                    title="Get a different challenge"
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
                  Your entered form details are preserved safely.
                </p>
              </div>
            </form>
          </div>
        )}

        {/* ================= STEP 3: SUBMITTING ================= */}
        {(step === 'submitting' || isProcessing || parentSubmitting) && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Submitting Application…</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Recording your candidate profile and generating your official Session V registration receipt…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
