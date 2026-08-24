import React, { useState } from 'react';
import { QrCode, History, CalendarCheck } from 'lucide-react';
import { QrScannerTab } from './QrScannerTab';
import { ManualAttendanceTab } from './ManualAttendanceTab';

export const AttendanceHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs max-w-md">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'scan'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Biometric QR Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'manual'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Manual Entry & Registry</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scan' ? <QrScannerTab /> : <ManualAttendanceTab />}
    </div>
  );
};
