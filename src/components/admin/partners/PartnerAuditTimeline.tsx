import React, { useState, useEffect, useCallback } from 'react';
import { IconLoader, IconAlertTriangle, IconRefresh } from '../../common/icons';
import { StatusBadge } from '../shared/StatusBadge';
import { PartnerStatusAuditRecord } from '../../../lib/mockApi';
import { api } from '../../../services/api';

export interface PartnerAuditTimelineProps {
  partnerId: string;
  initialAudits?: PartnerStatusAuditRecord[];
  onRefresh?: () => void;
}

function formatAuditDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

export const PartnerAuditTimeline: React.FC<PartnerAuditTimelineProps> = ({
  partnerId,
  initialAudits,
  onRefresh,
}) => {
  const [audits, setAudits] = useState<PartnerStatusAuditRecord[]>(initialAudits || []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialAudits);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    if (!partnerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const history = await api.partners.getStatusHistory(partnerId);
      // Defensive sort: newest first
      const sorted = [...(history || [])].sort((a, b) => {
        return new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime();
      });
      setAudits(sorted);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to load status history');
    } finally {
      setIsLoading(false);
    }
  }, [partnerId, onRefresh]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Status Audit Ledger
        </h3>
        <button
          type="button"
          onClick={fetchAudits}
          disabled={isLoading}
          className="p-1 text-slate-400 hover:text-slate-600 rounded transition disabled:opacity-50 cursor-pointer"
          title="Refresh audit history"
          aria-label="Refresh audit history"
        >
          <IconRefresh size={12} className={isLoading ? 'animate-spin text-[#185b9d]' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-3 px-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-500 text-xs flex items-center justify-center gap-2">
          <IconLoader size={13} className="animate-spin text-[#185b9d]" />
          <span>Loading status history...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs space-y-2">
          <div className="flex items-start gap-2 text-amber-800">
            <IconAlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="leading-snug">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchAudits}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 rounded font-semibold text-[11px] transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : audits.length === 0 ? (
        <div className="p-3 bg-slate-50 rounded-lg text-slate-400 text-xs text-center border border-slate-200/80">
          No status history recorded.
        </div>
      ) : (
        <div className="space-y-2">
          {audits.map((item, idx) => {
            const isSelfTransition = item.previousStatus === item.newStatus;
            return (
              <div
                key={item.id || idx}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <StatusBadge status={item.previousStatus} size="sm" />
                    <span className="text-slate-400 text-xs">&rarr;</span>
                    <StatusBadge status={item.newStatus} size="sm" />
                    {isSelfTransition && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        (Initial Record)
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                    {formatAuditDate(item.changedAt)}
                  </span>
                </div>

                {item.reason && (
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200/70 italic">
                    &ldquo;{item.reason}&rdquo;
                  </div>
                )}

                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                  <span>
                    Action by: <strong className="text-slate-700 font-medium">{item.changedByName || item.changedByEmail || '—'}</strong>
                  </span>
                  {item.changedByEmail && item.changedByName && (
                    <span className="text-slate-400 font-mono text-[9px]">{item.changedByEmail}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
