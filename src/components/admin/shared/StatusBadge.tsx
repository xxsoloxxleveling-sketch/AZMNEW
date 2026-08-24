import React from 'react';

export type StatusType =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'OVERDUE'
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'SHORTLISTED'
  | 'ACCEPTED';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'ACTIVE':
      case 'PAID':
      case 'PRESENT':
      case 'APPROVED':
      case 'ELIGIBLE':
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-600/10';

      case 'PARTIAL':
      case 'LATE':
      case 'PENDING':
      case 'SHORTLISTED':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 ring-1 ring-amber-600/10';

      case 'UNPAID':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 ring-1 ring-blue-600/10';

      case 'OVERDUE':
      case 'ABSENT':
      case 'REJECTED':
      case 'INELIGIBLE':
      case 'INACTIVE':
      case 'EXPELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 ring-1 ring-rose-600/10';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getDotColor = () => {
    switch (normalized) {
      case 'ACTIVE':
      case 'PAID':
      case 'PRESENT':
      case 'APPROVED':
      case 'ELIGIBLE':
      case 'ACCEPTED':
        return 'bg-emerald-500';

      case 'PARTIAL':
      case 'LATE':
      case 'PENDING':
      case 'SHORTLISTED':
        return 'bg-amber-500';

      case 'UNPAID':
        return 'bg-blue-500';

      case 'OVERDUE':
      case 'ABSENT':
      case 'REJECTED':
      case 'INELIGIBLE':
      case 'INACTIVE':
      case 'EXPELLED':
        return 'bg-rose-500';

      default:
        return 'bg-slate-400';
    }
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, ' ');
  };

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${paddingClass} ${getStyle()} transition-all`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${getDotColor()}`} />
      {formatText(status)}
    </span>
  );
};
