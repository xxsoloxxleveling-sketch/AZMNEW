import React, { useState, useEffect } from 'react';
import { SAMPLE_QUESTION_BANK } from '../../data/scholarshipData';
import { X, CheckCircle2, AlertCircle, Sparkles, Clock, RefreshCw, Trophy, BookOpen } from 'lucide-react';

interface MockExamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MockExamModal: React.FC<MockExamModalProps> = ({ isOpen, onClose }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds

  useEffect(() => {
    if (!isOpen || isSubmitted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isSubmitted]);

  if (!isOpen) return null;

  const handleSelectOption = (qId: number, optIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const calculateScore = () => {
    let score = 0;
    SAMPLE_QUESTION_BANK.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        score += 1;
      }
    });
    return score;
  };

  const handleFinish = async () => {
    setIsSubmitted(true);
    const score = calculateScore();
    if (score >= 6) {
      try {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default || confettiModule;
        confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };


  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setTimeLeft(600);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const finalScore = calculateScore();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400 flex items-center justify-center text-blue-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display">
                  Official Session V (2026) Question Bank Simulator
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                  10 MCQs Sample
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Representative sample from the published ~1,000 MCQs AZM testing database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isSubmitted && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 font-mono text-xs font-bold text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Result Score Banner when submitted */}
          {isSubmitted && (
            <div
              className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                finalScore >= 6
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    finalScore >= 6 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold font-display">
                    {finalScore >= 6 ? 'Qualifying Benchmark Achieved!' : 'Practice Complete'}
                  </h4>
                  <p className="text-xs mt-0.5">
                    You scored <strong>{finalScore} out of 10 ({finalScore * 10}%)</strong> in this practice module.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake Simulator</span>
                </button>
              </div>
            </div>
          )}

          {/* Question List */}
          <div className="space-y-4">
            {SAMPLE_QUESTION_BANK.map((q, qIndex) => {
              const userAnswer = selectedAnswers[q.id];
              const isCorrect = isSubmitted && userAnswer === q.correctIndex;
              const isWrong = isSubmitted && userAnswer !== undefined && userAnswer !== q.correctIndex;

              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl bg-white border transition-all ${
                    isSubmitted
                      ? isCorrect
                        ? 'border-emerald-400 bg-emerald-50/20'
                        : isWrong
                        ? 'border-rose-300 bg-rose-50/20'
                        : 'border-slate-200'
                      : 'border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#185b9d] border border-blue-100">
                      Q{qIndex + 1} • {q.subject}
                    </span>
                    {isSubmitted && (
                      <span
                        className={`text-xs font-bold flex items-center gap-1 ${
                          isCorrect ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Correct (+1 Mark)
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" /> Incorrect (0 Mark)
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug mb-3">
                    {q.question}
                  </p>

                  {/* OMR Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userAnswer === optIdx;
                      const isOptionCorrect = isSubmitted && optIdx === q.correctIndex;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-3 rounded-xl text-left text-xs transition-all flex items-center gap-3 border ${
                            isSelected
                              ? isSubmitted
                                ? isOptionCorrect
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold'
                                  : 'bg-rose-100 border-rose-400 text-rose-950 font-bold'
                                : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : isOptionCorrect
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {/* Simulated OMR Bubble */}
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border ${
                              isSelected
                                ? 'bg-white text-slate-900 border-white'
                                : 'border-slate-300 text-slate-500 bg-white'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span className="leading-tight">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation note when submitted */}
                  {isSubmitted && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-700">
                      <strong className="text-slate-900">Explanation: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Answered: <strong>{Object.keys(selectedAnswers).length}</strong> of {SAMPLE_QUESTION_BANK.length}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Close
            </button>

            {!isSubmitted ? (
              <button
                onClick={handleFinish}
                className="px-6 py-2 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Submit Simulator & Evaluate</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
