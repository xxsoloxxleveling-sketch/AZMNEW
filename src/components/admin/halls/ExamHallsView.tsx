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
} from 'lucide-react';
import { mockApi, MockStudent } from '../../../lib/mockApi';

interface ExamHall {
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
}

const DEFAULT_HALLS: ExamHall[] = [
  {
    id: 'hall-6',
    name: 'Hall A (Junior Examination Wing)',
    roomNumber: 'Room 101-A',
    targetClass: 'Class 6th',
    wing: 'Ground Floor, East Wing',
    capacity: 60,
    invigilatorName: 'Prof. Asim Khan',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
  {
    id: 'hall-7',
    name: 'Hall B (Middle Standard Wing)',
    roomNumber: 'Room 102-B',
    targetClass: 'Class 7th',
    wing: 'Ground Floor, West Wing',
    capacity: 60,
    invigilatorName: 'Madam Samina Bibi',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
  {
    id: 'hall-8',
    name: 'Hall C (Middle Assessment Hall)',
    roomNumber: 'Room 201-C',
    targetClass: 'Class 8th',
    wing: '1st Floor, Academic Block',
    capacity: 75,
    invigilatorName: 'Sir Tariq Mahmood',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
  {
    id: 'hall-9',
    name: 'Hall D (Matric SSC-I Hall)',
    roomNumber: 'Room 202-D',
    targetClass: 'Class 9th',
    wing: '1st Floor, Science Wing',
    capacity: 80,
    invigilatorName: 'Sir Naveed Qureshi',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
  {
    id: 'hall-10',
    name: 'Hall E (Matric SSC-II Main Examination Hall)',
    roomNumber: 'Hall 301-E',
    targetClass: 'Class 10th',
    wing: '2nd Floor, Central Wing',
    capacity: 90,
    invigilatorName: 'Dr. Sumama Khan',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
  {
    id: 'hall-11',
    name: 'Hall F (Intermediate / College Wing)',
    roomNumber: 'Auditorium Hall',
    targetClass: '1st Year / 2nd Year',
    wing: 'Main Campus Central Auditorium',
    capacity: 150,
    invigilatorName: 'Prof. Dr. M. Jadoon (Chief Supt.)',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  },
];

const HALLS_STORAGE_KEY = 'AZM_EXAM_HALLS_V';

interface ExamHallsViewProps {
  onOpenQrScanner?: () => void;
}

export const ExamHallsView: React.FC<ExamHallsViewProps> = ({ onOpenQrScanner }) => {
  const [halls, setHalls] = useState<ExamHall[]>(() => {
    try {
      const raw = localStorage.getItem(HALLS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_HALLS;
  });

  const [selectedHallId, setSelectedHallId] = useState<string>(halls[0]?.id || 'hall-6');
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'NOT_MARKED'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add Custom Hall Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newHallData, setNewHallData] = useState({
    name: '',
    roomNumber: '',
    targetClass: 'Class 6th',
    wing: '',
    capacity: 60,
    invigilatorName: '',
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    const data = await mockApi.getStudents();
    setStudents(data);

    // Initial attendance mapping
    const map: Record<string, 'PRESENT' | 'ABSENT' | 'NOT_MARKED'> = {};
    data.forEach((s) => {
      // Mark verified paid students as present by default or mock
      map[s.id] = s.feeStatus === 'PAID' ? 'PRESENT' : 'NOT_MARKED';
    });
    setAttendanceMap(map);
    setIsLoading(false);
  };

  const selectedHall = halls.find((h) => h.id === selectedHallId) || halls[0];

  // Filter students assigned to this hall's target class
  const hallStudents = students.filter((s) => {
    const sClass = (s.currentClass || '').toLowerCase();
    const tClass = selectedHall.targetClass.toLowerCase();

    if (tClass.includes('6') && (sClass.includes('6') || sClass.includes('six'))) return true;
    if (tClass.includes('7') && (sClass.includes('7') || sClass.includes('seven'))) return true;
    if (tClass.includes('8') && (sClass.includes('8') || sClass.includes('eight'))) return true;
    if (tClass.includes('9') && (sClass.includes('9') || sClass.includes('nine') || sClass.includes('ssc-i'))) return true;
    if (tClass.includes('10') && (sClass.includes('10') || sClass.includes('ten') || sClass.includes('matric') || sClass.includes('ssc-ii'))) return true;
    if (tClass.includes('1st') || tClass.includes('2nd') || tClass.includes('intermediate') || tClass.includes('college')) {
      if (sClass.includes('11') || sClass.includes('12') || sClass.includes('fsc') || sClass.includes('ics') || sClass.includes('fa')) return true;
    }
    // Fallback: If no match, include unassigned students proportionally
    return false;
  });

  // If hallStudents is empty, show default distribution for demonstration
  const displayStudents = hallStudents.length > 0 ? hallStudents : students.slice(0, 15);

  const filteredStudents = displayStudents.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.cnicOrBForm && s.cnicOrBForm.includes(searchQuery));

    const status = attendanceMap[s.id] || 'NOT_MARKED';
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'present' && status === 'PRESENT') ||
      (filterStatus === 'absent' && status === 'ABSENT') ||
      (filterStatus === 'pending' && status === 'NOT_MARKED');

    return matchesSearch && matchesStatus;
  });

  // Calculate live stats
  const totalAssigned = displayStudents.length;
  const presentCount = displayStudents.filter((s) => attendanceMap[s.id] === 'PRESENT').length;
  const absentCount = displayStudents.filter((s) => attendanceMap[s.id] === 'ABSENT').length;
  const pendingCount = totalAssigned - presentCount - absentCount;
  const attendanceRate = totalAssigned > 0 ? Math.round((presentCount / totalAssigned) * 100) : 0;

  const toggleAttendance = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? 'NOT_MARKED' : status,
    }));
  };

  const markAllPresent = () => {
    const newMap = { ...attendanceMap };
    displayStudents.forEach((s) => {
      newMap[s.id] = 'PRESENT';
    });
    setAttendanceMap(newMap);
  };

  const handleCreateHall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHallData.name.trim() || !newHallData.roomNumber.trim()) {
      alert('Please provide hall name and room number.');
      return;
    }
    const created: ExamHall = {
      id: `hall_${Date.now()}`,
      ...newHallData,
      capacity: Number(newHallData.capacity) || 50,
    };
    const updated = [...halls, created];
    setHalls(updated);
    try {
      localStorage.setItem(HALLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    setSelectedHallId(created.id);
    setIsAddModalOpen(false);
    setNewHallData({
      name: '',
      roomNumber: '',
      targetClass: 'Class 6th',
      wing: '',
      capacity: 60,
      invigilatorName: '',
      invigilatorPhone: '0305-1755551',
      reportingTime: '09:00 AM',
      examDate: 'Sunday, 15 Nov 2026',
    });
  };

  const printHallAttendanceSheet = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow popups to print the Hall Attendance Roster.');
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AZM Examination Attendance Roster - ${selectedHall.name}</title>
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
      <p>Session V (2026) Official Room Attendance & Invigilation Desk Roster</p>
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
    <div>Capacity / Assigned: <strong>${selectedHall.capacity} / ${totalAssigned}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">Seat #</th>
        <th style="width: 100px;">Roll Number</th>
        <th>Candidate Name</th>
        <th>Father Name</th>
        <th>CNIC / B-Form</th>
        <th style="width: 70px; text-align: center;">Status</th>
        <th style="width: 120px;">Candidate Signature</th>
      </tr>
    </thead>
    <tbody>
      ${displayStudents.map((s, idx) => `
        <tr>
          <td style="font-weight: bold; text-align: center;">${(idx + 1).toString().padStart(2, '0')}</td>
          <td style="font-family: monospace; font-weight: bold;">${s.rollNumber || `AZMVS-2026-${(idx + 1).toString().padStart(4, '0')}`}</td>
          <td style="font-weight: bold;">${s.fullName}</td>
          <td>${s.fatherName}</td>
          <td style="font-family: monospace;">${s.cnicOrBForm || 'N/A'}</td>
          <td style="text-align: center; font-weight: bold; color: ${attendanceMap[s.id] === 'PRESENT' ? '#15803d' : '#b91c1c'};">
            ${attendanceMap[s.id] || 'PRESENT'}
          </td>
          <td><div class="sign-box"></div></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>Total Seated: <strong>${totalAssigned}</strong> | Present: <strong>${presentCount}</strong> | Absent: <strong>${absentCount}</strong></div>
    <div>Invigilator Signature: _______________________</div>
    <div>Center Superintendent: _______________________</div>
  </div>

  <div class="btn-bar">
    <button class="btn" onclick="window.print()">🖨️ Print Invigilator Roster</button>
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#185b9d]/10 text-[#185b9d]">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 font-display">
                Class-Wise Examination Halls & Attendance
              </h2>
              <p className="text-xs text-slate-500">
                Live seating hall allocations, invigilator assignments, and real-time biometric attendance tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Camera QR Scanner</span>
            </button>
          )}

          <button
            onClick={printHallAttendanceSheet}
            className="px-4 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white font-bold text-xs shadow-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Hall Roster (A4)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
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
                <span className={isSelected ? 'text-slate-400' : 'text-slate-500'}>Capacity</span>
                <span className={`font-mono font-extrabold ${isSelected ? 'text-emerald-400' : 'text-slate-900'}`}>
                  {hall.capacity} Seats
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Hall Info Card & Live Attendance KPIs */}
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
            <p className="text-xs text-slate-500 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {selectedHall.wing}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Invigilator: <strong>{selectedHall.invigilatorName}</strong>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#185b9d]" />
                {selectedHall.reportingTime} ({selectedHall.examDate})
              </span>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={markAllPresent}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Seated</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-slate-900 font-display tabular-nums">{totalAssigned}</span>
              <span className="text-xs text-slate-400 font-bold">/ {selectedHall.capacity}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Assigned Candidates</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Present Verified</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-emerald-900 font-display tabular-nums">{presentCount}</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold mt-1 block">Biometric & Room Check-in</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Absent Candidates</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-rose-900 font-display tabular-nums">{absentCount}</span>
            </div>
            <span className="text-[10px] text-rose-700 font-bold mt-1 block">Pending / No-Show</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
            <span className="text-[10px] font-bold text-[#185b9d] uppercase tracking-wider block">Attendance Rate</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-[#185b9d] font-display tabular-nums">{attendanceRate}%</span>
            </div>
            <div className="w-full bg-blue-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-[#185b9d] h-full rounded-full transition-all duration-300" style={{ width: `${attendanceRate}%` }} />
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
                placeholder="Search candidates in this hall by name, roll number, CNIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#185b9d] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Candidates ({totalAssigned})</option>
              <option value="present">Present ({presentCount})</option>
              <option value="absent">Absent ({absentCount})</option>
              <option value="pending">Pending ({pendingCount})</option>
            </select>
          </div>
        </div>

        {/* Students Table for Selected Hall */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="py-3 px-4">Seat #</th>
                <th className="py-3 px-4">Candidate Photo & Name</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">CNIC / B-Form</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Quick Attendance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.map((s, idx) => {
                const status = attendanceMap[s.id] || 'NOT_MARKED';
                const rollNo = s.rollNumber || `AZMVS-2026-${(idx + 1).toString().padStart(4, '0')}`;
                const seatIndex = `SEAT-${(idx + 1).toString().padStart(2, '0')}`;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#185b9d]">{seatIndex}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            s.photoUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                          }
                          alt={s.fullName}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{s.fullName}</div>
                          <div className="text-[10px] text-slate-500">Father: {s.fatherName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{rollNo}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{s.cnicOrBForm || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {s.parentMobile || s.studentMobile || s.mobile || '0305-1755551'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {status === 'PRESENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          <CheckCircle2 className="w-3 h-3" />
                          PRESENT ✓
                        </span>
                      )}
                      {status === 'ABSENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                          <XCircle className="w-3 h-3" />
                          ABSENT ✗
                        </span>
                      )}
                      {status === 'NOT_MARKED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => toggleAttendance(s.id, 'PRESENT')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Present</span>
                        </button>
                        <button
                          onClick={() => toggleAttendance(s.id, 'ABSENT')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Absent</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Examination Hall Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">Add Custom Examination Hall / Room</h3>
              <p className="text-xs text-slate-500">Configure room capacity and class allocation for Session V (2026).</p>
            </div>

            <form onSubmit={handleCreateHall} className="space-y-4 text-xs">
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
                    min="10"
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
