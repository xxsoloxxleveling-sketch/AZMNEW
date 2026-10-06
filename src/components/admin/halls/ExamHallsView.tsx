import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  QrCode,
  Printer,
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Download,
  Check,
  AlertCircle,
  Eye,
  UserPlus,
  ArrowRightLeft,
  Trash2,
  X,
  Edit3,
} from 'lucide-react';
import { mockApi, HallCandidate, MockTestCenter } from '../../../lib/mockApi';
import { useAuth } from '../../../lib/authContext';

export interface ExamHall {
  id: string;
  name: string;
  roomNumber: string;
  targetClass: string;
  wing: string;
  capacity: number;
  invigilatorName: string;
  invigilatorPhone: string;
  reportingTime: string;
  examDate: string;
  assignedCount: number;
  availableSeats: number;
  utilizationPercent: number | null;
  isOverCapacity: boolean;
  testCenterId?: string;
  centerName?: string;
}

interface ExamHallsViewProps {
  onOpenQrScanner?: () => void;
}

export const ExamHallsView: React.FC<ExamHallsViewProps> = ({ onOpenQrScanner }) => {
  const [halls, setHalls] = useState<ExamHall[]>([]);

  const [testCenters, setTestCenters] = useState<MockTestCenter[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [students, setStudents] = useState<HallCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [loadError, setLoadError] = useState('');
  const [rosterError, setRosterError] = useState('');
  const [rosterHallId, setRosterHallId] = useState('');
  const [rosterRevision, setRosterRevision] = useState(0);
  const [placementCandidates, setPlacementCandidates] = useState<HallCandidate[]>([]);
  const [placePage, setPlacePage] = useState(1);
  const [placeTotal, setPlaceTotal] = useState(0);
  const [placeTotalPages, setPlaceTotalPages] = useState(0);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState('');

  // Custom Student Placement Modal State
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState<boolean>(false);
  const [placeSearchQuery, setPlaceSearchQuery] = useState<string>('');
  const [placeClassFilter, setPlaceClassFilter] = useState<string>('ALL');
  const [selectedStudentIdsToPlace, setSelectedStudentIdsToPlace] = useState<string[]>([]);
  const [isSubmittingPlacement, setIsSubmittingPlacement] = useState<boolean>(false);

  // Add Custom Hall Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newHallData, setNewHallData] = useState({
    name: '',
    roomNumber: '',
    targetClass: 'Class 6th',
    wing: '',
    capacity: 60,
    invigilatorName: '',
    invigilatorPhone: '',
    reportingTime: '',
    examDate: '',
    testCenterId: '',
  });

  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  const loadData = async () => {
    if (authLoading) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const [tcData, hallsData] = await Promise.all([mockApi.getTestCenters(), mockApi.getExamHalls()]);
      setTestCenters(tcData);
      setHalls(hallsData);
      const id = hallsData.some(h => h.id === selectedHallId) ? selectedHallId : hallsData[0]?.id || '';
      setSelectedHallId(id);
      setRosterRevision(value => value + 1);
    } catch (error: any) {
      setLoadError(error.message || 'Unable to load exam halls.');
      setHalls([]);
      setStudents([]);
      setSelectedHallId('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setStudents([]);
    setRosterHallId('');
    setRosterError('');
    if (!selectedHallId) return;
    mockApi.getExamHall(selectedHallId).then(hall => {
      if (active) { setStudents(hall.assignedStudents); setRosterHallId(hall.id); }
    }).catch(error => { if (active) setRosterError(error.message); });
    return () => { active = false; };
  }, [selectedHallId, rosterRevision]);

  useEffect(() => {
    let active = true;
    if (!isPlaceModalOpen) return;
    setPlaceLoading(true);
    setPlaceError('');
    setPlacementCandidates([]);
    mockApi.getHallCandidates({ search: placeSearchQuery, class: placeClassFilter === 'ALL' ? undefined : placeClassFilter,
      assignment: 'all', page: placePage, limit: 25 }).then(result => {
      if (!active) return;
      setPlacementCandidates(result.candidates);
      setPlaceTotal(result.pagination.total);
      setPlaceTotalPages(result.pagination.totalPages);
    }).catch(error => { if (active) setPlaceError(error.message); })
      .finally(() => { if (active) setPlaceLoading(false); });
    return () => { active = false; };
  }, [isPlaceModalOpen, placeSearchQuery, placeClassFilter, placePage]);

  const selectedHall = halls.find(h => h.id === selectedHallId) || halls[0];
  const hallStudents = students.filter(s => s.assignedHallId === selectedHall?.id);
  const filteredStudents = hallStudents.filter(s => [s.fullName, s.rollNumber, s.applicationNo]
    .some(value => value?.toLowerCase().includes(searchQuery.toLowerCase())));
  const totalAssigned = selectedHall?.assignedCount ?? 0;

  // Custom Place Candidates Handler
  const handleBatchPlace = async () => {
    if (selectedStudentIdsToPlace.length === 0) {
      alert('Please select at least one candidate to place into this hall.');
      return;
    }
    setIsSubmittingPlacement(true);
    try {
      const assignedCount = await mockApi.batchAssignStudentsToHall(
        selectedHall.id,
        {
          hallName: selectedHall.name,
          roomNumber: selectedHall.roomNumber,
          testCenterName: selectedHall.centerName || undefined,
        },
        selectedStudentIdsToPlace
      );
      alert(`Successfully placed ${assignedCount} candidate(s) into ${selectedHall.name} (${selectedHall.roomNumber})!`);
      setSelectedStudentIdsToPlace([]);
      setIsPlaceModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign candidates.');
    } finally {
      setIsSubmittingPlacement(false);
    }
  };

  // Move Single Student to Another Hall
  const handleMoveStudentToHall = async (studentId: string, targetHallId: string) => {
    const targetHall = halls.find((h) => h.id === targetHallId);
    if (!targetHall) return;
    try {
      await mockApi.updateStudentAllocation(studentId, {
        assignedHallId: targetHall.id,
        assignedHall: targetHall.name,
        assignedRoom: targetHall.roomNumber,
        testCenterName: targetHall.centerName || undefined,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to move student.');
    }
  };

  // Unassign Student from this Hall
  const handleUnassignStudent = async (studentId: string, studentName: string) => {
    if (confirm(`Remove ${studentName} from ${selectedHall.roomNumber}?`)) {
      try {
        await mockApi.unassignStudentFromHall(studentId);
        await loadData();
      } catch (error: any) {
        alert(error.message || 'Failed to unassign candidate.');
      }
    }
  };

  // Quick Edit Seat Number
  const handleUpdateSeatNo = async (studentId: string, currentSeat: string) => {
    const newSeat = prompt(`Enter Desk / Seat Number for candidate:`, currentSeat || 'Seat #01');
    if (newSeat !== null && newSeat.trim()) {
      try {
        await mockApi.updateStudentAllocation(studentId, { seatNo: newSeat.trim() });
        await loadData();
      } catch (error: any) {
        alert(error.message || 'Failed to update seat.');
      }
    }
  };

  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHallData.name.trim() || !newHallData.roomNumber.trim()) {
      alert('Please provide hall name and room number.');
      return;
    }
    try {
      const { testCenterId, reportingTime, examDate, ...fields } = newHallData;
      const created = await mockApi.createExamHall({ ...fields, testCenterId: testCenterId || null,
        reportingTime: reportingTime || undefined, examDate: examDate || undefined });
      await loadData();
      setSelectedHallId(created.id);
      setIsAddModalOpen(false);
      setNewHallData({ name: '', roomNumber: '', targetClass: 'Class 6th', wing: '', capacity: 60,
        invigilatorName: '', invigilatorPhone: '', reportingTime: '', examDate: '', testCenterId: '' });
    } catch (error: any) {
      alert(error.message || 'Failed to create hall.');
    }
  };

  const printHallRoster = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the Hall Gate Seating Roster.');
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Examination Gate Seating Chart - ${selectedHall.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; }
    body { padding: 24px; background: #fff; }
    .header { border-bottom: 2px solid #185b9d; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 18px; font-weight: 900; color: #185b9d; }
    .header p { font-size: 11px; color: #64748b; margin-top: 2px; }
    .hall-banner { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px; }
    .hall-banner div strong { display: block; font-size: 12px; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
    td { padding: 6px; border: 1px solid #cbd5e1; }
    tr:nth-child(even) { background: #f8fafc; }
    .sign-box { height: 28px; border-bottom: 1px dotted #94a3b8; }
    .footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #0f172a; display: flex; justify-content: space-between; font-size: 11px; }
    .btn-bar { text-align: center; margin-top: 20px; }
    .btn { background: #185b9d; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    @media print {
      body { padding: 0; }
      .btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>AZM ACADEMIC INITIATIVE ORGANIZATION</h1>
      <p>Official Examination Center Room Seating Chart &amp; Invigilator Desk</p>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 900; font-size: 13px; color: #185b9d;">${selectedHall.roomNumber}</div>
      <div style="font-size: 10px; color: #64748b;">${selectedHall.examDate}</div>
    </div>
  </div>

  <div class="hall-banner">
    <div>Hall Name: <strong>${selectedHall.name}</strong></div>
    <div>Target Class: <strong>${selectedHall.targetClass}</strong></div>
    <div>Room Invigilator: <strong>${selectedHall.invigilatorName}</strong></div>
    <div>Capacity / Seated: <strong>${selectedHall.capacity} / ${totalAssigned}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 55px;">Desk #</th>
        <th style="width: 110px;">Roll Number</th>
        <th>Candidate Name</th>
        <th>Enrolled Class</th>
        <th style="width: 120px;">Candidate Signature</th>
      </tr>
    </thead>
    <tbody>
      ${hallStudents.map((s, idx) => `
        <tr>
          <td style="font-weight: bold; text-align: center; color: #185b9d;">${s.seatNo || 'Not allocated'}</td>
          <td style="font-family: monospace; font-weight: bold;">${s.rollNumber || s.applicationNo || 'PENDING'}</td>
          <td style="font-weight: bold;">${s.fullName}</td>
          <td>${s.currentClass || 'Unknown'}</td>
          <td><div class="sign-box"></div></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>Total Seated Candidates: <strong>${totalAssigned}</strong></div>
    <div>Invigilator Signature: _______________________</div>
    <div>Center Superintendent: _______________________</div>
  </div>

  <div class="btn-bar">
    <button class="btn" onclick="window.print()">🖨️ Print Gate Seating Chart</button>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  // Candidates available for placement modal
  const candidatesForPlacement = placementCandidates;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-[#185b9d]/10 text-[#185b9d]">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display">
                Examination Centers &amp; Hall Seating Management
              </h2>
              <p className="text-xs text-slate-500">
                Custom place candidates into specific test centers, examination halls, classes, and desk numbers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Place Candidates Button */}
          <button
            disabled={!selectedHall || isLoading || !!loadError}
            onClick={() => { setSelectedStudentIdsToPlace([]); setPlacePage(1); setIsPlaceModalOpen(true); }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Custom Pick &amp; Place Candidates</span>
          </button>

          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>QR Scanner</span>
            </button>
          )}

          <button
            disabled={!selectedHall || isLoading || !!loadError || rosterHallId !== selectedHall.id}
            onClick={printHallRoster}
            className="px-3.5 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Seating Chart (A4)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#185b9d]" />
            <span>Add Custom Room</span>
          </button>
        </div>
      </div>

      {/* Class / Examination Hall Selector Carousel / Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {halls.map((hall) => {
          const isSelected = hall.id === selectedHallId;
          const assignedCount = hall.assignedCount;

          return (
            <button
              key={hall.id}
              onClick={() => setSelectedHallId(hall.id)}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-[#185b9d]/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-blue-100 text-[#185b9d]'
                    }`}
                  >
                    {hall.targetClass}
                  </span>
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {hall.roomNumber}
                  </span>
                </div>
                <h4 className={`text-xs font-bold truncate mt-2 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {hall.name.split('(')[0]}
                </h4>
                <p className={`text-[10px] truncate ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                  {hall.wing}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/40 flex items-center justify-between text-[10px]">
                <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>Seated</span>
                <span className={`font-mono font-extrabold ${isSelected ? 'text-emerald-400' : 'text-slate-900'}`}>
                  {assignedCount} / {hall.capacity}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {isLoading && <p role="status">Loading exam halls...</p>}
      {loadError && <p role="alert">{loadError} <button onClick={loadData}>Retry</button></p>}
      {!isLoading && !loadError && halls.length === 0 && <p>No exam halls configured.</p>}
      {/* Selected Hall allocation details */}
      {selectedHall && <>
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 font-display">
                {selectedHall.name} — {selectedHall.roomNumber}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#185b9d] text-xs font-extrabold">
                Dedicated for: {selectedHall.targetClass}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-[#185b9d]" />
                {selectedHall.centerName || 'No test center'} {selectedHall.wing ? `(${selectedHall.wing})` : ''}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Invigilator: <strong>{selectedHall.invigilatorName || 'Not specified'}</strong>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#185b9d]" />
                {selectedHall.reportingTime || 'Reporting time unknown'} ({selectedHall.examDate || 'Date unknown'})
              </span>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              disabled={!selectedHall || isLoading || !!loadError}
            onClick={() => { setSelectedStudentIdsToPlace([]); setPlacePage(1); setIsPlaceModalOpen(true); }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Place Students into {selectedHall.roomNumber}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Seated</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-slate-900 font-display tabular-nums">{totalAssigned}</span>
              <span className="text-xs text-slate-400 font-bold">/ {selectedHall.capacity} Seats</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Allocated in this Class/Room</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
            <span className="text-[10px] font-bold text-[#185b9d] uppercase tracking-wider block">Room Occupancy</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-[#185b9d] font-display tabular-nums">
                {selectedHall.capacity > 0 ? Math.round((totalAssigned / selectedHall.capacity) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-blue-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#185b9d] h-full rounded-full"
                style={{
                  width: `${selectedHall.capacity > 0 ? Math.min(100, Math.round((totalAssigned / selectedHall.capacity) * 100)) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Search & Filter Header for Hall Table */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidates in this hall by name, roll or application number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
              />
            </div>
          </div>

        </div>

        {rosterError && <p role="alert">{rosterError} <button onClick={() => setRosterRevision(value => value + 1)}>Retry roster</button></p>}
        {!rosterError && rosterHallId !== selectedHall.id && <p role="status">Loading hall roster...</p>}
        {/* Students Table for Selected Hall */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Desk / Seat</th>
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4">Roll / App No</th>
                <th className="py-3 px-4">Enrolled Class</th>
                <th className="py-3 px-4 text-right">Reallocate / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s, idx) => {
                  const rollNo = s.rollNumber || s.applicationNo || 'Not issued';
                  const currentSeat = s.seatNo || 'Not allocated';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleUpdateSeatNo(s.id, currentSeat)}
                          title="Click to edit seat number"
                          className="inline-flex items-center gap-1 font-mono font-bold text-[#185b9d] bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 cursor-pointer"
                        >
                          <span>{currentSeat}</span>
                          <Edit3 className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.fullName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{rollNo}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{s.currentClass || 'Unknown'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Move Room Dropdown */}
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleMoveStudentToHall(s.id, e.target.value);
                              }
                            }}
                            defaultValue=""
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 cursor-pointer"
                          >
                            <option value="" disabled>
                              Move Room ▾
                            </option>
                            {halls
                              .filter((h) => h.id !== selectedHall.id)
                              .map((h) => (
                                <option key={h.id} value={h.id}>
                                  To {h.roomNumber} ({h.name.split('(')[0]})
                                </option>
                              ))}
                          </select>

                          <button
                            onClick={() => handleUnassignStudent(s.id, s.fullName)}
                            title="Unseat from this room"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : rosterHallId === selectedHall.id ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <p className="text-xs font-bold text-slate-600">No candidates seated in this room yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click <strong>"+ Place Students into {selectedHall.roomNumber}"</strong> above to custom pick and assign students.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Pick & Place Candidates Modal */}
      {isPlaceModalOpen && selectedHall && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Custom Pick &amp; Place Candidates into {selectedHall.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Target Room: <strong className="text-[#185b9d]">{selectedHall.roomNumber}</strong> ({selectedHall.targetClass}) • Capacity: {selectedHall.capacity} Seats
                </p>
              </div>
              <button
                onClick={() => setIsPlaceModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Class Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by candidate name, roll or application number..."
                  value={placeSearchQuery}
                  onChange={(e) => { setPlacePage(1); setSelectedStudentIdsToPlace([]); setPlaceSearchQuery(e.target.value); }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#185b9d] outline-none"
                />
              </div>

              <select
                value={placeClassFilter}
                onChange={(e) => { setPlacePage(1); setSelectedStudentIdsToPlace([]); setPlaceClassFilter(e.target.value); }}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none"
              >
                <option value="ALL">All Classes</option>
                <option value="Class 6th">Class 6th</option>
                <option value="Class 7th">Class 7th</option>
                <option value="Class 8th">Class 8th</option>
                <option value="Class 9th">Class 9th</option>
                <option value="Class 10th">Class 10th</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  if (selectedStudentIdsToPlace.length === candidatesForPlacement.length) {
                    setSelectedStudentIdsToPlace([]);
                  } else {
                    setSelectedStudentIdsToPlace(candidatesForPlacement.map((s) => s.id));
                  }
                }}
                className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer whitespace-nowrap"
              >
                {selectedStudentIdsToPlace.length === candidatesForPlacement.length ? 'Deselect All' : 'Select This Page'}
              </button>
            </div>

            {placeLoading && <p role="status">Loading candidates...</p>}
            {placeError && <p role="alert">{placeError}</p>}
            <div className="flex items-center gap-3 text-xs">
              <button disabled={placePage <= 1 || placeLoading} onClick={() => { setSelectedStudentIdsToPlace([]); setPlacePage(p => p - 1); }}>Previous</button>
              <span>Page {placePage} of {placeTotalPages || 1} — {placeTotal} candidates</span>
              <button disabled={placePage >= placeTotalPages || placeLoading} onClick={() => { setSelectedStudentIdsToPlace([]); setPlacePage(p => p + 1); }}>Next</button>
            </div>
            {/* Candidates Selection Table */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          candidatesForPlacement.length > 0 &&
                          selectedStudentIdsToPlace.length === candidatesForPlacement.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIdsToPlace(candidatesForPlacement.map((s) => s.id));
                          } else {
                            setSelectedStudentIdsToPlace([]);
                          }
                        }}
                        className="rounded text-[#185b9d] cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">Roll / App No</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Current Hall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidatesForPlacement.length > 0 ? (
                    candidatesForPlacement.map((s) => {
                      const isChecked = selectedStudentIdsToPlace.includes(s.id);
                      const isCurrentHall = s.assignedHallId === selectedHall.id;

                      return (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setSelectedStudentIdsToPlace((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                            );
                          }}
                          className={`cursor-pointer transition ${
                            isChecked ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIdsToPlace((prev) => [...prev, s.id]);
                                } else {
                                  setSelectedStudentIdsToPlace((prev) => prev.filter((id) => id !== s.id));
                                }
                              }}
                              className="rounded text-[#185b9d] cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            <div>{s.fullName}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-700">{s.rollNumber || s.applicationNo || 'N/A'}</td>
                          <td className="p-3 font-semibold text-slate-700">{s.currentClass || 'Unknown'}</td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                isCurrentHall
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.assignedHallId
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {s.assignedHallId ? s.assignedRoom || 'Assigned' : 'Unassigned'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No candidates match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                Selected: <strong className="text-[#185b9d] font-mono text-sm">{selectedStudentIdsToPlace.length}</strong> Candidate(s)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedStudentIdsToPlace.length === 0 || isSubmittingPlacement || placeLoading || !!placeError}
                  onClick={handleBatchPlace}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-900/10 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmittingPlacement
                      ? 'Placing Candidates...'
                      : `Place ${selectedStudentIdsToPlace.length} Candidate(s) into ${selectedHall.roomNumber}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* Add Custom Examination Hall Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Add Custom Examination Hall / Room</h3>
              <p className="text-xs text-slate-500">Configure room capacity and candidate allocation.</p>
            </div>

            <form onSubmit={handleCreateHall} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Test Center / Campus</label>
                <select
                  value={newHallData.testCenterId}
                  onChange={(e) => setNewHallData({ ...newHallData, testCenterId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                >
                  <option value="">No test center — schedule unknown</option>
                  {testCenters.map(tc => <option key={tc.id} value={tc.id}>{tc.name} ({tc.district})</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Hall / Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hall G (Post-Graduate Wing)"
                  value={newHallData.name}
                  onChange={(e) => setNewHallData({ ...newHallData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Room 401"
                    value={newHallData.roomNumber}
                    onChange={(e) => setNewHallData({ ...newHallData, roomNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={newHallData.targetClass}
                    onChange={(e) => setNewHallData({ ...newHallData, targetClass: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  >
                    <option value="Class 6th">Class 6th</option>
                    <option value="Class 7th">Class 7th</option>
                    <option value="Class 8th">Class 8th</option>
                    <option value="Class 9th">Class 9th</option>
                    <option value="Class 10th">Class 10th</option>
                    <option value="1st Year">1st Year (College)</option>
                    <option value="2nd Year">2nd Year (College)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Campus Wing / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Floor, Science Block"
                    value={newHallData.wing}
                    onChange={(e) => setNewHallData({ ...newHallData, wing: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newHallData.capacity}
                    onChange={(e) => setNewHallData({ ...newHallData, capacity: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invigilator Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sir Asif Ali"
                    value={newHallData.invigilatorName}
                    onChange={(e) => setNewHallData({ ...newHallData, invigilatorName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Invigilator Contact</label>
                  <input
                    type="text"
                    value={newHallData.invigilatorPhone}
                    onChange={(e) => setNewHallData({ ...newHallData, invigilatorPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#185b9d] text-white font-bold hover:bg-[#13497d] shadow-sm cursor-pointer"
                >
                  Create Examination Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
