import React, { useState, useEffect, useRef } from 'react';
import {
  IconClose,
  IconLoader,
  IconAlertTriangle,
  IconRefresh,
} from '../../common/icons';
import { Shield, User, Mail, Calendar, Clock, KeyRound, Edit3, UserCheck, UserX } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../lib/authContext';
import type { UserAccountRecord, Role, UserStatus } from '../../../lib/mockApi';
import { useFocusTrap } from './useFocusTrap';
import { UserEditModal } from './UserEditModal';
import { UserStatusModal } from './UserStatusModal';
import { UserPasswordResetModal } from './UserPasswordResetModal';

export interface UserAccountDetailDrawerProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (updatedUser: UserAccountRecord) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function UserRoleBadge({ role }: { role: Role }) {
  switch (role) {
    case 'SUPER_ADMIN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 text-white border border-slate-900">
          Super Admin
        </span>
      );
    case 'ADMIN':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-300">
          Admin
        </span>
      );
    case 'ACCOUNTANT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Accountant
        </span>
      );
    case 'TEACHER':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
          Teacher
        </span>
      );
  }
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      Inactive
    </span>
  );
}

export const UserAccountDetailDrawer: React.FC<UserAccountDetailDrawerProps> = ({
  userId,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const { user: currentAuthUser } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [user, setUser] = useState<UserAccountRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Child modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const isSelf = Boolean(user && currentAuthUser && user.id === currentAuthUser.id);
  const isChildModalOpen = isEditOpen || isStatusOpen || isResetOpen;

  useFocusTrap({
    isOpen: isOpen && Boolean(userId) && !isChildModalOpen,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!isOpen || !userId) {
      setUser(null);
      setErrorMessage(null);
      setIsEditOpen(false);
      setIsStatusOpen(false);
      setIsResetOpen(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    api.users
      .getById(userId)
      .then((data) => {
        if (isMounted) {
          setUser(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(err?.message || 'Failed to load user details.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  const handleModalSuccess = (updated: UserAccountRecord) => {
    setUser(updated);
    if (onUserUpdated) {
      onUserUpdated(updated);
    }
  };

  if (!isOpen || !userId) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity"
        role="presentation"
        onClick={() => {
          if (!isChildModalOpen) onClose();
        }}
      >
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-drawer-title"
            aria-hidden={isChildModalOpen ? 'true' : undefined}
            inert={isChildModalOpen || undefined}
            onClick={(e) => e.stopPropagation()}
            className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#185b9d]">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="user-drawer-title" className="text-sm font-bold text-slate-900">
                    User Account Details
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {user ? user.id : userId}
                  </p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close user details drawer"
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 bg-slate-100 rounded-lg" />
                  <div className="h-4 bg-slate-200 rounded w-1/4 mt-4" />
                  <div className="h-10 bg-slate-100 rounded-lg" />
                  <div className="h-4 bg-slate-200 rounded w-1/2 mt-4" />
                  <div className="h-24 bg-slate-100 rounded-lg" />
                </div>
              ) : errorMessage ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <IconAlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span className="font-semibold">Unable to load account</span>
                  </div>
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoading(true);
                      setErrorMessage(null);
                      api.users
                        .getById(userId)
                        .then((data) => setUser(data))
                        .catch((err) => setErrorMessage(err?.message || 'Failed to load user details.'))
                        .finally(() => setIsLoading(false));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <IconRefresh size={13} />
                    <span>Retry</span>
                  </button>
                </div>
              ) : user ? (
                <>
                  {/* Account Summary Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">{user.email}</p>
                      </div>
                      <UserStatusBadge status={user.status} />
                    </div>
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Assigned Role:</span>
                      <UserRoleBadge role={user.role} />
                    </div>
                  </div>

                  {/* Administrative Actions Hub */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Account Administration
                    </h4>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {/* Primary Action: Edit Account */}
                        <button
                          type="button"
                          onClick={() => setIsEditOpen(true)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#185b9d] hover:bg-[#13497d] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Account</span>
                        </button>

                        {/* Secondary Action: Reset Password (only for other users) */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => setIsResetOpen(true)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                            <span>Reset Password</span>
                          </button>
                        )}
                      </div>

                      {/* Lifecycle Action */}
                      <div className="pt-2 border-t border-slate-200/80">
                        {isSelf ? (
                          <p className="text-[11px] text-slate-500 italic">
                            You cannot deactivate your own account or perform administrative password resets on yourself. Use My Account to manage your credentials.
                          </p>
                        ) : user.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => setIsStatusOpen(true)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5 text-rose-600" />
                            <span>Deactivate Account</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsStatusOpen(true)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Reactivate Account</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Identity & Permissions Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Account Identity
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Full Name
                        </span>
                        <span className="font-semibold text-slate-900">{user.name}</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          Official Email
                        </span>
                        <span className="font-semibold text-slate-900 font-mono">{user.email}</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                          Account ID
                        </span>
                        <span className="text-slate-700 font-mono text-[11px]">{user.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audit & Timestamps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Audit & Timestamps
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Provisioned Date
                        </span>
                        <span className="font-medium text-slate-800">{formatDate(user.createdAt)}</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Last Profile Update
                        </span>
                        <span className="font-medium text-slate-800">{formatDateTime(user.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Role & Self Advisories */}
                  {user.role === 'SUPER_ADMIN' && (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-slate-900">Super Admin Advisory:</span> Super Admin accounts have full administrative access across all system modules.
                    </div>
                  )}

                  {isSelf && (
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 text-xs text-blue-900 leading-relaxed">
                      <span className="font-semibold">Current Account:</span> This is your active account. Use <span className="font-semibold">My Account</span> to change your own password.
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Child Modals */}
      <UserEditModal
        user={user}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <UserStatusModal
        user={user}
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <UserPasswordResetModal
        user={user}
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </>
  );
};
