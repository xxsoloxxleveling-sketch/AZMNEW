import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Building,
  CheckCircle2,
  Clock,
  Calendar,
  Phone,
  User,
  Check,
  X,
} from 'lucide-react';
import { mockApi, MockTestCenter } from '../../../lib/mockApi';

export const TestCentersTab: React.FC = () => {
  const [centers, setCenters] = useState<MockTestCenter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCenter, setEditingCenter] = useState<MockTestCenter | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    campus: '',
    address: '',
    district: 'Mansehra',
    province: 'Khyber Pakhtunkhwa',
    capacity: 300,
    reportingTime: '09:00 AM',
    testDate: 'Sunday, 15 November 2026',
    contactPerson: '',
    contactPhone: '0344-0197194',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  useEffect(() => {
    loadCenters();
  }, []);

  const loadCenters = async () => {
    setIsLoading(true);
    const data = await mockApi.getTestCenters();
    setCenters(data);
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingCenter(null);
    setFormData({
      name: '',
      code: `TC-${Math.floor(100 + Math.random() * 900)}`,
      campus: 'Main Campus',
      address: '',
      district: 'Mansehra',
      province: 'Khyber Pakhtunkhwa',
      capacity: 300,
      reportingTime: '09:00 AM',
      testDate: 'Sunday, 15 November 2026',
      contactPerson: '',
      contactPhone: '0344-0197194',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (center: MockTestCenter) => {
    setEditingCenter(center);
    setFormData({
      name: center.name,
      code: center.code,
      campus: center.campus,
      address: center.address,
      district: center.district,
      province: center.province,
      capacity: center.capacity,
      reportingTime: center.reportingTime,
      testDate: center.testDate,
      contactPerson: center.contactPerson,
      contactPhone: center.contactPhone,
      status: center.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete test center "${name}"?`)) {
      await mockApi.deleteTestCenter(id);
      loadCenters();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a test center name.');
      return;
    }

    if (editingCenter) {
      await mockApi.updateTestCenter(editingCenter.id, formData);
    } else {
      await mockApi.createTestCenter(formData);
    }

    setIsModalOpen(false);
    loadCenters();
  };

  const filteredCenters = centers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Custom Examination Test Centers</h3>
          <p className="text-xs text-slate-500">
            Manage test locations, seating limits, and assigned applicants. Centers added here appear dynamically across the portal.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497d] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Test Center</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search test centers by city, name, code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-[#185b9d]"
        />
      </div>

      {/* Test Center Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCenters.map((center) => (
          <div
            key={center.id}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#185b9d] font-mono text-[10px] font-bold">
                    {center.code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1.5">{center.name}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {center.address}, {center.district}
                  </p>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                    center.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {center.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Seating Limit</span>
                  <span className="font-extrabold text-slate-900">{center.capacity} Candidates</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Live</span>
                  <span className="font-extrabold text-[#185b9d]">{center.assignedCount || 0} Registered</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Reporting Time</span>
                  <span className="font-bold text-slate-800">{center.reportingTime}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 pt-1 flex items-center justify-between">
                <span>Superintendent: <strong>{center.contactPerson || 'Assigned Coordinator'}</strong></span>
                <span className="font-mono text-slate-500">{center.contactPhone}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => handleOpenEdit(center)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => handleDelete(center.id, center.name)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Test Center Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingCenter ? 'Edit Test Center' : 'Add Custom Test Center'}
                </h3>
                <p className="text-xs text-slate-500">Configure examination venue details and seating limits.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Center Legal / Campus Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AZM Examination Center - Mansehra Main Campus"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Center Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TC-MHR-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">District</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  >
                    <option value="Mansehra">Mansehra</option>
                    <option value="Abbottabad">Abbottabad</option>
                    <option value="Haripur">Haripur</option>
                    <option value="Battagram">Battagram</option>
                    <option value="Torghar">Torghar</option>
                    <option value="Peshawar">Peshawar</option>
                    <option value="Mardan">Mardan</option>
                    <option value="Swat">Swat</option>
                    <option value="Kohistan">Kohistan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Physical Street Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Near College Chowk, Karakoram Highway, Mansehra"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Seating Capacity</label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reporting Time</label>
                  <input
                    type="text"
                    value={formData.reportingTime}
                    onChange={(e) => setFormData({ ...formData, reportingTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Center Superintendent</label>
                  <input
                    type="text"
                    placeholder="e.g. Prof. Dr. Sumama Khan"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Helpline / Contact Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-[#185b9d]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#185b9d] text-white font-bold hover:bg-[#13497d] shadow-sm cursor-pointer"
                >
                  {editingCenter ? 'Update Test Center' : 'Save Test Center'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
