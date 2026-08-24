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
import { mockApi, MockStudent, MockTestCenter } from '../../../lib/mockApi';

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
  centerId?: string;
  centerName?: string;
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
    centerName: 'Main Campus Examination Center, Mansehra',
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
    centerName: 'Main Campus Examination Center, Mansehra',
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
    centerName: 'Main Campus Examination Center, Mansehra',
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
    centerName: 'Main Campus Examination Center, Mansehra',
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
    centerName: 'Main Campus Examination Center, Mansehra',
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
    centerName: 'Main Campus Examination Center, Mansehra',
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

  const [testCenters, setTestCenters] = useState<MockTestCenter[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>(halls[0]?.id || 'hall-6');
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'NOT_MARKED'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
    invigilatorPhone: '0305-1755551',
    reportingTime: '09:00 AM',
    examDate: 'Sunday, 15 Nov 2026',
    centerName: 'Main Campus Examination Center, Mansehra',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [stData, tcData, hallsData] = await Promise.all([
      mockApi.getStudents().catch(() => []),
      mockApi.getTestCenters().catch(() => []),
      mockApi.getExamHalls().catch(() => []),
    ]);
    setStudents(stData);
    setTestCenters(tcData);
    if (hallsData && hallsData.length > 0) {
      setHalls(hallsData);
    }

    const map: Record<string, 'PRESENT' | 'ABSENT' | 'NOT_MARKED'> = {};
    stData.forEach((s) => {
      map[s.id] = s.feeStatus === 'PAID' ? 'PRESENT' : 'NOT_MARKED';
    });
    setAttendanceMap(map);
    setIsLoading(false);
  };

  const selectedHall = halls.find((h) => h.id === selectedHallId) || halls[0];

  // Candidates placed / assigned to this specific Hall & Room
  const hallStudents = students.filter((s) => {
    if (s.assignedHallId) return s.assignedHallId === selectedHall.id;
    if (s.assignedHall) {
      return (
        s.assignedHall.toLowerCase().includes(selectedHall.name.toLowerCase()) ||
        selectedHall.name.toLowerCase().includes(s.assignedHall.toLowerCase())
      );
    }
    // Default class match if not explicitly assigned elsewhere
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
    return false;
  });

  const filteredStudents = hallStudents.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.applicationNo && s.applicationNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.cnicOrBForm && s.cnicOrBForm.includes(searchQuery));

    const status = attendanceMap[s.id] || 'NOT_MARKED';
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'present' && status === 'PRESENT') ||
      (filterStatus === 'absent' && status === 'ABSENT') ||
      (filterStatus === 'pending' && status === 'NOT_MARKED');

    return matchesSearch && matchesStatus;
  });

  const totalAssigned = hallStudents.length;
  const presentCount = hallStudents.filter((s) => attendanceMap[s.id] === 'PRESENT').length;
  const absentCount = hallStudents.filter((s) => attendanceMap[s.id] === 'ABSENT').length;
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
    hallStudents.forEach((s) => {
      newMap[s.id] = 'PRESENT';
    });
    setAttendanceMap(newMap);
  };

  // Custom Place Candidates Handler
  const handleBatchPlace = async () => {
    if (selectedStudentIdsToPlace.length === 0) {
      alert('Please select at least one candidate to place into this hall.');
      return;
    }
    setIsSubmittingPlacement(true);
    try {
      await mockApi.batchAssignStudentsToHall(
        selectedHall.id,
        {
          hallName: selectedHall.name,
          roomNumber: selectedHall.roomNumber,
          testCenterName: selectedHall.centerName || 'Main Campus Examination Center, Mansehra',
        },
        selectedStudentIdsToPlace
      );
      alert(`Successfully placed ${selectedStudentIdsToPlace.length} candidate(s) into ${selectedHall.name} (${selectedHall.roomNumber})!`);
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
        testCenterName: targetHall.centerName || 'Main Campus Examination Center, Mansehra',
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to move student.');
    }
  };

  // Unassign Student from this Hall
  const handleUnassignStudent = async (studentId: string, studentName: string) => {
    if (confirm(`Remove ${studentName} from ${selectedHall.roomNumber}?`)) {
      await mockApi.unassignStudentFromHall(studentId);
      await loadData();
    }
  };

  // Quick Edit Seat Number
  const handleUpdateSeatNo = async (studentId: string, currentSeat: string) => {
    const newSeat = prompt(`Enter Desk / Seat Number for candidate:`, currentSeat || 'Seat #01');
    if (newSeat !== null && newSeat.trim()) {
      await mockApi.updateStudentAllocation(studentId, { seatNo: newSeat.trim() });
      await loadData();
    }
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
      centerName: 'Main Campus Examination Center, Mansehra',
    });
  };

  const printHallAttendanceSheet = () => {
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
        <th>Father Name</th>
        <th>Enrolled Class</th>
        <th style="width: 70px; text-align: center;">Fee Status</th>
        <th style="width: 120px;">Candidate Signature</th>
      </tr>
    </thead>
    <tbody>
      ${hallStudents.map((s, idx) => `
        <tr>
          <td style="font-weight: bold; text-align: center; color: #185b9d;">${s.seatNo || (idx + 1).toString().padStart(2, '0')}</td>
          <td style="font-family: monospace; font-weight: bold;">${s.rollNumber || s.applicationNo || 'PENDING'}</td>
          <td style="font-weight: bold;">${s.fullName}</td>
          <td>${s.fatherName}</td>
          <td>${s.currentClass || selectedHall.targetClass}</td>
          <td style="text-align: center; font-weight: bold; color: ${s.feeStatus === 'PAID' ? '#15803d' : '#b91c1c'};">
            ${s.feeStatus || 'UNPAID'}
          </td>
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
  const candidatesForPlacement = students.filter((s) => {
    const matchQuery =
      s.fullName.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(placeSearchQuery.toLowerCase())) ||
      (s.applicationNo && s.applicationNo.toLowerCase().includes(placeSearchQuery.toLowerCase())) ||
      (s.cnicOrBForm && s.cnicOrBForm.includes(placeSearchQuery));

    const matchClass =
      placeClassFilter === 'ALL' ||
      (s.currentClass && s.currentClass.toLowerCase().includes(placeClassFilter.toLowerCase()));

    return matchQuery && matchClass;
  });

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
            onClick={() => setIsPlaceModalOpen(true)}
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
            onClick={printHallAttendanceSheet}
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
          const assignedCount = students.filter((s) => {
            if (s.assignedHallId) return s.assignedHallId === hall.id;
            if (s.assignedHall) return s.assignedHall.toLowerCase().includes(hall.name.toLowerCase());
            return s.currentClass?.toLowerCase().includes(hall.targetClass.toLowerCase().replace('class ', ''));
          }).length;

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
            <p className="text-xs text-slate-500 flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-[#185b9d]" />
                {selectedHall.centerName || 'Main Campus Examination Center, Mansehra'} ({selectedHall.wing})
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
              onClick={() => setIsPlaceModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Place Students into {selectedHall.roomNumber}</span>
            </button>
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
              <span className="text-xs text-slate-400 font-bold">/ {selectedHall.capacity} Seats</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Allocated in this Class/Room</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Present Verified</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-emerald-900 font-display tabular-nums">{presentCount}</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold mt-1 block">Biometric &amp; Gate Check-in</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Absent Candidates</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-extrabold text-rose-900 font-display tabular-nums">{absentCount}</span>
            </div>
            <span className="text-[10px] text-rose-700 font-bold mt-1 block">Pending Arrival</span>
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
                className="bg-[#185b9d] h-full rounded-full transition-all duration-300"
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
                <th className="py-3 px-4">Desk / Seat</th>
                <th className="py-3 px-4">Candidate Photo &amp; Name</th>
                <th className="py-3 px-4">Roll / App No</th>
                <th className="py-3 px-4">Enrolled Class</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Fee Status</th>
                <th className="py-3 px-4 text-right">Reallocate / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s, idx) => {
                  const status = attendanceMap[s.id] || 'NOT_MARKED';
                  const rollNo = s.rollNumber || s.applicationNo || `APP-2026-${(idx + 1).toString().padStart(4, '0')}`;
                  const currentSeat = s.seatNo || `Seat #${(idx + 1).toString().padStart(2, '0')}`;

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
                      <td className="py-3 px-4 font-semibold text-slate-700">{s.currentClass || selectedHall.targetClass}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {s.parentMobile || s.studentMobile || s.whatsapp || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            s.feeStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.feeStatus || 'UNPAID'}
                        </span>
                      </td>
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
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <p className="text-xs font-bold text-slate-600">No candidates seated in this room yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click <strong>"+ Place Students into {selectedHall.roomNumber}"</strong> above to custom pick and assign students.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Pick & Place Candidates Modal */}
      {isPlaceModalOpen && (
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
                  placeholder="Search by candidate name, roll number, CNIC, app ID..."
                  value={placeSearchQuery}
                  onChange={(e) => setPlaceSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#185b9d] outline-none"
                />
              </div>

              <select
                value={placeClassFilter}
                onChange={(e) => setPlaceClassFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none"
              >
                <option value="ALL">All Classes ({students.length})</option>
                <option value="6">Class 6th</option>
                <option value="7">Class 7th</option>
                <option value="8">Class 8th</option>
                <option value="9">Class 9th</option>
                <option value="10">Class 10th</option>
                <option value="11">Class 11th (1st Year)</option>
                <option value="12">Class 12th (2nd Year)</option>
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
                {selectedStudentIdsToPlace.length === candidatesForPlacement.length ? 'Deselect All' : 'Select All Filtered'}
              </button>
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
                    <th className="p-3 text-center">Fee Status</th>
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
                            <div className="text-[10px] text-slate-400 font-normal">S/D/O {s.fatherName}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-700">{s.rollNumber || s.applicationNo || 'N/A'}</td>
                          <td className="p-3 font-semibold text-slate-700">{s.currentClass || 'SSC'}</td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                isCurrentHall
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.assignedRoom
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {s.assignedRoom ? `${s.assignedRoom}` : 'Unassigned'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                s.feeStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.feeStatus || 'UNPAID'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
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
                  disabled={selectedStudentIdsToPlace.length === 0 || isSubmittingPlacement}
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
                <label className="block font-bold text-slate-700 mb-1">Test Center / Campus</label>
                <select
                  value={newHallData.centerName}
                  onChange={(e) => setNewHallData({ ...newHallData, centerName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                >
                  {testCenters.length > 0 ? (
                    testCenters.map((tc) => (
                      <option key={tc.id} value={tc.name}>
                        {tc.name} ({tc.district})
                      </option>
                    ))
                  ) : (
                    <option value="Main Campus Examination Center, Mansehra">
                      Main Campus Examination Center, Mansehra
                    </option>
                  )}
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
