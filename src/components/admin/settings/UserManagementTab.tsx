import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, CheckCircle, X, Loader2 } from 'lucide-react';
import { mockApi, MockUserAccount, Role } from '../../../lib/mockApi';
import { DataTable, Column } from '../shared/DataTable';
import { StatusBadge } from '../shared/StatusBadge';

export const UserManagementTab: React.FC = () => {
  const [users, setUsers] = useState<MockUserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('TEACHER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mockApi.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await mockApi.createUser({
        name: newName,
        email: newEmail,
        role: newRole,
      });
      alert(`User account for ${newName} created successfully.`);
      setIsCreateOpen(false);
      setNewName('');
      setNewEmail('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<MockUserAccount>[] = [
    {
      header: 'User Name',
      accessor: 'name',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Official Email',
      accessor: 'email',
      sortable: true,
      render: (row) => <span className="font-medium text-slate-600">{row.email}</span>,
    },
    {
      header: 'Assigned Role',
      accessor: 'role',
      render: (row) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            row.role === 'SUPER_ADMIN'
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : row.role === 'ADMIN'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : row.role === 'ACCOUNTANT'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {row.role}
        </span>
      ),
    },
    {
      header: 'Account Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Created On',
      accessor: 'createdAt',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Portal User & Role Management</h3>
          <p className="text-xs text-slate-400">
            Control role-based access permissions for system administrators, teachers, and accountants.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 text-xs font-bold bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl shadow-md transition flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
          <span>Failed to load live user accounts: {error}</span>
          <button
            onClick={fetchUsers}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer transition"
          >
            Retry
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        searchPlaceholder="Search users by name or email..."
      />

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative space-y-5">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-[#185b9d] border border-blue-100">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Create System User</h3>
                <p className="text-xs text-slate-400">Grant authorized access with assigned role</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asad Ali (Examiner)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. asad@jadoon.edu.pk"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Access Level *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                >
                  <option value="TEACHER">TEACHER (Examiner - QR Scanner only)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Fees, Payroll, Ledger)</option>
                  <option value="ADMIN">ADMIN (Full management without user admin)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Complete root control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
