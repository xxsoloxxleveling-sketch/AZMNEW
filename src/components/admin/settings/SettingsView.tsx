import React, { useState } from 'react';
import { School, Lock, Users, Shield, Save, CheckCircle, MapPin, Calendar, Trash2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../lib/authContext';
import { UserManagementTab } from './UserManagementTab';
import { TestCentersTab } from './TestCentersTab';
import { RollNumberScheduleTab } from './RollNumberScheduleTab';
import { mockApi } from '../../../lib/mockApi';

export const SettingsView: React.FC = () => {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'centers' | 'profile' | 'security' | 'users' | 'purge'>('schedule');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  const [schoolProfile, setSchoolProfile] = useState({
    name: 'AZM Educational Network & Testing Organization',
    tagline: 'Empowering Future Leaders through Merit-Based Scholarships',
    campus: 'Main Regional Headquarters, Hazara Division, KP',
    phone: '0305-1755551 / info@azmaio.com',
    email: 'info@azmaio.com',
    website: 'https://azmaio.com',
    principalName: 'Prof. Dr. Sumama Khan',
    examinationCenterCode: 'AZM-KP-2026',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Institutional profile preferences saved successfully.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirm password do not match.');
      return;
    }
    alert('Password updated successfully.');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs max-w-4xl">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'schedule'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Roll No. Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab('centers')}
          className={`flex-1 min-w-[130px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'centers'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Test Centers</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 min-w-[130px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <School className="w-4 h-4" />
          <span>Institution Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 min-w-[100px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Security</span>
        </button>

        {role === 'SUPER_ADMIN' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 min-w-[130px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#185b9d] text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Accounts</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('purge')}
          className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'purge'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
              : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Reset System / Purge</span>
        </button>
      </div>

      {/* Tab: Exam & Roll Numbers Release Schedule */}
      {activeTab === 'schedule' && <RollNumberScheduleTab />}



      {/* Tab 1: School Profile */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 max-w-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Institutional Profile Configuration</h3>
            <p className="text-xs text-slate-400">
              Details displayed on printed roll number slips, fee challans, and result cards.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">School / College Legal Name</label>
                <input
                  type="text"
                  value={schoolProfile.name}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Campus Location & Address</label>
                <input
                  type="text"
                  value={schoolProfile.campus}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, campus: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Helpline / Mobile</label>
                <input
                  type="text"
                  value={schoolProfile.phone}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={schoolProfile.email}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Director / Principal In-Charge</label>
                <input
                  type="text"
                  value={schoolProfile.principalName}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, principalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">BISE Exam Center Code</label>
                <input
                  type="text"
                  value={schoolProfile.examinationCenterCode}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, examinationCenterCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 max-w-md">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
            <p className="text-xs text-slate-400">Ensure a strong alphanumeric password</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 0: Test Centers Management */}
      {activeTab === 'centers' && <TestCentersTab />}

      {/* Tab 3: User Management (Super Admin) */}
      {activeTab === 'users' && role === 'SUPER_ADMIN' && <UserManagementTab />}

      {/* Tab: Reset System / Purge All Data */}
      {activeTab === 'purge' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200/90 shadow-sm space-y-6 max-w-2xl">
          <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Danger Zone: Complete System Reset &amp; Fresh Start</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deletes all candidate records, uploaded documents from cloud storage, fee logs, attendance entries, and caches to start with a 100% clean database.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
            <strong className="block font-bold">What will be purged:</strong>
            <ul className="list-disc list-inside space-y-1 text-rose-800 text-[11px]">
              <li>All registered student applications, academic scores &amp; biometric QR tokens</li>
              <li>All candidate photos, CNIC/B-Form scans &amp; DMC marksheet uploads from Supabase Storage</li>
              <li>All generated PDF registration forms &amp; 3-part bank fee challans</li>
              <li>All fee collection receipts &amp; attendance timestamps</li>
              <li>All partner school applications &amp; staff payroll entries</li>
              <li>Browser cache and local storage keys</li>
            </ul>
            <p className="text-[11px] text-slate-600 font-semibold pt-1 border-t border-rose-200">
              Note: System Administrator and staff login accounts are preserved.
            </p>
          </div>

          {purgeSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <strong className="block font-bold">System Successfully Reset!</strong>
                <span>All database records and storage buckets have been emptied. You are ready for fresh data.</span>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">This action cannot be undone.</span>
              <button
                type="button"
                disabled={isPurging}
                onClick={async () => {
                  if (
                    window.confirm(
                      'ARE YOU ABSOLUTELY SURE?\n\nThis will PERMANENTLY ERASE all students, documents, fee records, and attachments from both the Database and Cloud Storage.\n\nType OK to confirm fresh start.'
                    )
                  ) {
                    setIsPurging(true);
                    try {
                      await mockApi.purgeAllData();
                      setPurgeSuccess(true);
                      setTimeout(() => {
                        window.location.reload();
                      }, 2000);
                    } catch (err: any) {
                      alert(err.message || 'Failed to purge data');
                    } finally {
                      setIsPurging(false);
                    }
                  }
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                {isPurging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Purging System &amp; Storage...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Wipe All Data &amp; Storage (Start Fresh)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


