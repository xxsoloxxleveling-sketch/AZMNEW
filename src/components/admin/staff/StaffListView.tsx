import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Phone, Mail, DollarSign } from 'lucide-react';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';
import { mockApi, MockStaff } from '../../../lib/mockApi';
import { AddEditStaffModal } from './AddEditStaffModal';

export const StaffListView: React.FC = () => {
  const [staffList, setStaffList] = useState<MockStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getStaff();
      setStaffList(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const columns: Column<MockStaff>[] = [
    {
      header: 'Staff Name & Role',
      accessor: 'fullName',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.fullName}</span>
          <span className="text-xs text-[#185b9d] font-semibold">{row.role}</span>
        </div>
      ),
    },
    {
      header: 'CNIC / Identity',
      accessor: 'cnic',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-700">{row.cnic}</span>,
    },
    {
      header: 'Phone / Contact',
      accessor: 'phone',
      render: (row) => <span className="text-xs text-slate-600 font-medium">{row.phone}</span>,
    },
    {
      header: 'Monthly Salary',
      accessor: 'salary',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-slate-900">PKR {(Number(row.salary) || 0).toLocaleString()}</span>
      ),
    },
    {
      header: 'Join Date',
      accessor: 'joinDate',
      sortable: true,
      render: (row) => <span className="text-xs text-slate-500">{row.joinDate}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
  ];

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        data={staffList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search staff member by name, role, or CNIC..."
        emptyTitle="No Staff Members Found"
        emptyMessage="Add faculty and administrative staff using the button above."
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        }
      />

      <AddEditStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchStaff}
      />
    </div>
  );
};
