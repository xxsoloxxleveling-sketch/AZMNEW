import React, { useState } from 'react';
import { PARTNER_SCHOOLS, REGISTRATION_HUBS, OFFICIAL_DATA } from '../../data/scholarshipData';
import { PageTab } from '../../types';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Search, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  ExternalLink,
  Award
} from 'lucide-react';

interface PartnerDirectoryViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const PartnerDirectoryView: React.FC<PartnerDirectoryViewProps> = ({ onSelectTab }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  const filteredSchools = PARTNER_SCHOOLS.filter((school) => {
    const matchesDistrict = districtFilter === 'all' || school.district === districtFilter;
    const matchesSearch =
      school.institutionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDistrict && matchesSearch;
  });

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold text-[#185b9d] uppercase tracking-widest">
          Affiliated Network Directory
        </span>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
          Partner Schools & Registration Hubs
        </h1>
        <p className="text-sm text-slate-600">
          Explore our network of accredited examination venues, partner high schools, and intermediate colleges across Hazara Division and KP.
        </p>
      </div>

      {/* 3 Prominent Mansehra In-Person Registration Hubs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-900">
            Official Mansehra In-Person Registration Hubs (Session V)
          </h2>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REGISTRATION_HUBS.map((hub) => (
            <div
              key={hub.id}
              className={`p-6 rounded-3xl border transition-all flex flex-col justify-between ${
                hub.isHeadOffice
                  ? 'bg-gradient-to-br from-[#185b9d]/10 via-emerald-50/50 to-white border-[#185b9d] shadow-md ring-2 ring-[#185b9d]/20'
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      hub.isHeadOffice
                        ? 'bg-[#185b9d] text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {hub.isHeadOffice ? 'Head Office & Hub 1' : 'Registration Hub'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{hub.capacity}</span>
                </div>

                <h3 className="text-base font-bold font-display text-slate-900 leading-snug">
                  {hub.name}
                </h3>
                <p className="text-xs font-semibold text-[#185b9d]">{hub.campus}</p>

                <div className="space-y-2 pt-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <span>{hub.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-mono font-bold text-slate-800">{hub.contact}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Focal: <strong>{hub.focalPerson}</strong></span>
                <span className="text-emerald-700 font-bold">{hub.timing}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Directory Filter & Search */}
      <div className="space-y-6 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold font-display text-slate-900">
            Affiliated Schools & Colleges Directory
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Regional Districts</option>
              <option value="Mansehra">Mansehra District</option>
              <option value="Abbottabad">Abbottabad District</option>
              <option value="Haripur">Haripur District</option>
              <option value="Battagram">Battagram District</option>
            </select>

            <div className="relative">
              <input
                type="text"
                placeholder="Search institution..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-300 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Directory Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchools.map((school) => (
            <div
              key={school.id}
              className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {school.category}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {school.district}
                  </span>
                </div>

                <h3 className="text-sm font-bold font-display text-slate-900 leading-snug">
                  {school.institutionName}
                </h3>
                <p className="text-xs text-slate-500">{school.campus}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{school.address}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Focal Person:</span>
                  <strong className="text-slate-800">{school.contactPerson}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>WhatsApp:</span>
                  <span className="font-mono font-bold text-[#185b9d]">{school.whatsapp}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Student Body:</span>
                  <span className="font-mono">{school.totalStudentStrength} Students</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
