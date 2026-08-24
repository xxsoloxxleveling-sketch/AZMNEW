import React, { useState, useEffect } from 'react';
import { OFFICIAL_DATA } from '../../data/scholarshipData';
import { searchCandidateResult, fetchPublicMeritList } from '../../services/api';
import { ResultCard, PublicMeritEntry, PageTab } from '../../types';
import { Logo } from '../common/Logo';
import { 
  Search, 
  Award, 
  Trophy, 
  CheckCircle2, 
  Download, 
  Printer, 
  Calendar, 
  MapPin, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  FileText,
  Filter,
  Loader2,
  AlertTriangle,
  FileQuestion
} from 'lucide-react';
import { motion } from 'motion/react';

interface ResultsDeskViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const ResultsDeskView: React.FC<ResultsDeskViewProps> = ({ onSelectTab }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<ResultCard | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [meritList, setMeritList] = useState<PublicMeritEntry[]>([]);
  const [activeMeritFilter, setActiveMeritFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [meritSearch, setMeritSearch] = useState<string>('');

  useEffect(() => {
    fetchPublicMeritList({ category: activeMeritFilter, district: districtFilter, search: meritSearch })
      .then((res) => {
        if (res.data) setMeritList(res.data);
      });
  }, [activeMeritFilter, districtFilter, meritSearch]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) {
      setErrorMsg('Please enter a valid Roll Number or CNIC.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);
    setHasSearched(true);

    const res = await searchCandidateResult(cleanQuery);
    setIsLoading(false);

    if (res.success && res.data) {
      setCurrentResult(res.data);
      if (res.data.status === 'QUALIFIED FOR INTERVIEW') {
        try {
          const confettiModule = await import('canvas-confetti');
          const confetti = confettiModule.default || confettiModule;
          confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
        } catch (err) {}
      }
    } else {
      setCurrentResult(null);
      setErrorMsg(res.error || `No result record found for "${cleanQuery}". Results will be announced on 20 November 2026.`);
    }
  };

  const filteredMeritList = meritList.filter((entry) => {
    const matchesCategory =
      activeMeritFilter === 'all' || entry.category.toLowerCase().includes(activeMeritFilter.toLowerCase());
    const matchesDistrict = districtFilter === 'all' || entry.district === districtFilter;
    const matchesSearch =
      entry.candidateName.toLowerCase().includes(meritSearch.toLowerCase()) ||
      entry.rollNo.toLowerCase().includes(meritSearch.toLowerCase()) ||
      entry.classLevel.toLowerCase().includes(meritSearch.toLowerCase());
    return matchesCategory && matchesDistrict && matchesSearch;
  });

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 no-print">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#185b9d]/10 text-[#185b9d] border border-[#185b9d]/20">
          <Award className="w-3.5 h-3.5" />
          Official Central Evaluation Desk
        </span>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
          Results & Session V Merit Ledger
        </h1>
        <p className="text-sm text-slate-600">
          Enter your Roll Number or CNIC to access your authenticated digital result card with subject breakdowns, percentile ranks, and interview call letters.
        </p>
      </div>

      {/* Result Card Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 max-w-3xl mx-auto no-print space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Enter Candidate Roll No (e.g. AZM-2026-...) or CNIC / B-Form"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm font-mono rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-[#185b9d] hover:bg-[#13497e] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Check Result</span>
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>Results Announcement Date: <strong className="text-slate-800">20 November 2026</strong></span>
          <span className="text-emerald-700 font-semibold">Optical OMR Evaluated</span>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Notice</span>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}
      </div>

      {/* Initial Empty Search Helper */}
      {!hasSearched && !currentResult && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-4 shadow-sm no-print max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#185b9d] border border-blue-100 flex items-center justify-center mx-auto">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold font-display text-slate-900">
            Check Individual Candidate Result Card
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            Candidates who appear in the 100 MCQs optical test can enter their Roll Number above to download their verified score certificate and interview call slot.
          </p>
        </div>
      )}

      {/* Explicit Not Found State */}
      {hasSearched && !currentResult && !isLoading && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 text-center space-y-4 shadow-sm no-print max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold font-display text-slate-900">
            Result Record Not Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            We could not find an evaluated test record matching "<strong className="text-slate-800">{searchQuery}</strong>". Official Session V examination results are published following OMR optical scanning on <strong>20 November 2026</strong>.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/923440197194?text=Hello%20AZM.AIO%20Helpline%2C%20I%20have%20an%20inquiry%20regarding%20my%20Result%20Card."
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#20bd5a] transition-colors"
            >
              Contact on WhatsApp
            </a>
            <button
              onClick={() => onSelectTab('contact')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              Submit Result Inquiry
            </button>
          </div>
        </div>
      )}


      {/* ================= DIGITAL RESULT CARD ================= */}
      {currentResult && (
        <div className="printable-document bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
          {/* Top Document Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <Logo size="md" />
            <div className="text-center sm:text-right">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase">
                Official Digital Result Card
              </span>
              <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                Roll No: {currentResult.rollNo}
              </div>
            </div>
          </div>

          {/* Candidate Profile Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Candidate:</span>
              <span className="font-bold text-slate-900 text-sm font-display">{currentResult.candidateName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Father Name:</span>
              <span className="font-semibold text-slate-800">{currentResult.fatherName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Class Level:</span>
              <span className="font-semibold text-[#185b9d]">{currentResult.classLevel}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">CNIC / B-Form:</span>
              <span className="font-mono text-slate-700">{currentResult.cnicBForm}</span>
            </div>
          </div>

          {/* Core Score Highlight Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Radial Score Gauge */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0e2d4e] text-white flex flex-col items-center justify-center text-center space-y-2">
              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                Total Obtained Score
              </div>
              <div className="flex items-baseline gap-1 font-display">
                <span className="text-5xl font-extrabold text-amber-300 tabular-nums">
                  {currentResult.obtainedScore}
                </span>
                <span className="text-slate-400 text-lg font-bold">/ 100</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                {currentResult.percentage}% Score
              </span>
            </div>

            {/* Merit Standing */}
            <div className="p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                  Merit Position
                </span>
                <Trophy className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-3xl font-extrabold text-emerald-900 font-display tabular-nums">
                  Rank #{currentResult.overallRank}
                </div>
                <div className="text-xs text-emerald-700 font-medium mt-1">
                  Top {100 - currentResult.percentileRank}% Percentile Nationally
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                Allocated: {currentResult.category}
              </span>
            </div>

            {/* Qualification Status */}
            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#185b9d] tracking-wider">
                  Evaluation Status
                </span>
                <CheckCircle2 className="w-5 h-5 text-[#185b9d]" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-xs inline-block">
                  {currentResult.status}
                </span>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Candidate has passed the 60/100 threshold and is invited for the 6-member interview panel.
                </p>
              </div>
            </div>
          </div>

          {/* Subject-by-Subject Breakdown Progress Bars */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Subject-wise Performance Breakdown:
            </h4>
            <div className="space-y-3">
              {currentResult.subjectScores.map((subj) => (
                <div key={subj.subject} className="text-xs">
                  <div className="flex items-center justify-between mb-1 font-semibold text-slate-700">
                    <span>{subj.subject}</span>
                    <span className="font-mono text-[#185b9d] font-bold">
                      {subj.obtained} / {subj.total} ({subj.accuracy}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#185b9d] to-emerald-500"
                      style={{ width: `${subj.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interview Invitation Letter Callout */}
          {currentResult.interviewDate && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-800">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Official 6-Member Interview Call Letter
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {currentResult.reportingSlot}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#70a9db] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Interview Schedule:</span>
                    <span className="font-bold text-white">{currentResult.interviewDate}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Assigned Venue:</span>
                    <span className="font-bold text-white">{currentResult.interviewVenue}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 pt-1">
                Please bring original CNIC/B-Form, original DMC transcripts, and domicile certificate.
              </p>
            </div>
          )}

          {/* Actions Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-[#185b9d] text-white font-bold text-xs shadow-md flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Result Certificate</span>
            </button>

            <button
              onClick={() => onSelectTab('about')}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              Learn more about 6-Member Interview Scoring →
            </button>
          </div>
        </div>
      )}

      {/* ================= PUBLIC MERIT LISTS TABLE ================= */}
      <div className="space-y-6 pt-8 border-t border-slate-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
              Public Ledger Transparency
            </span>
            <h2 className="text-2xl font-bold font-display text-slate-900">
              Session V (2026) Public Merit Lists
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified score rankings with masked CNICs protecting candidate privacy.
            </p>
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={activeMeritFilter}
              onChange={(e) => setActiveMeritFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Categories (A to F)</option>
              <option value="Category A">Category A (Top 2)</option>
              <option value="Category B">Category B (Merit 3-20)</option>
              <option value="Category C">Category C (Tuition %)</option>
              <option value="Category D">Category D (Laptops)</option>
              <option value="Category E">Category E (Orphans)</option>
              <option value="Category F">Category F (Cash Prizes)</option>
            </select>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Districts</option>
              <option value="Mansehra">Mansehra</option>
              <option value="Abbottabad">Abbottabad</option>
              <option value="Haripur">Haripur</option>
              <option value="Battagram">Battagram</option>
              <option value="Torghar">Torghar</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search candidate / roll..."
                value={meritSearch}
                onChange={(e) => setMeritSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Merit Table View */}
        <div className="overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Roll Number</th>
                <th className="py-3.5 px-4">Candidate Name</th>
                <th className="py-3.5 px-4">Masked CNIC</th>
                <th className="py-3.5 px-4">Class</th>
                <th className="py-3.5 px-4">District</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Award Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMeritList.length > 0 ? (
                filteredMeritList.map((entry) => (
                  <tr key={entry.rollNo} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                        entry.rank <= 2 ? 'bg-amber-100 text-amber-900 font-extrabold' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#185b9d]">
                      {entry.rollNo}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {entry.candidateName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {entry.maskedCnic}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {entry.classLevel}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {entry.district}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 text-sm tabular-nums">
                      {entry.testScore} / 100
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#185b9d] font-semibold text-[11px]">
                        {entry.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                      {entry.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <Clock className="w-8 h-8 text-[#185b9d] mx-auto opacity-70" />
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        Session V Public Merit Ledger Pending Examination
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Official ranked lists will be published following the November 2026 standardized OMR test and 6-member interview evaluation rounds.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

