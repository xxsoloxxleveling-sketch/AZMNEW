import React, { useRef, useState } from 'react';
import { api } from '../../../services/api';
import type { StaffDetailRecord, OneTimeSalaryPaymentInput, PaymentMethod } from '../../../lib/mockApi';
import { useStaffFocusTrap } from './useStaffFocusTrap';

export function StaffSalaryPaymentModal({ staff, onClose, onSuccess }: { staff: StaffDetailRecord; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(staff.salary);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState(''); const [note, setNote] = useState('');
  const [date, setDate] = useState(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); });
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null); const submitting = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  useStaffFocusTrap({ isOpen: true, containerRef, onEscape: () => { if (!submitting.current) onClose(); } });
  const changed = () => { attempt.current = null; setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (submitting.current) return;
    const number = Number(amount), paidAt = new Date(date);
    if (!Number.isFinite(number) || number <= 0 || number > 10000000 || Number.isNaN(paidAt.getTime())) { setError('Enter a valid amount (greater than 0, up to PKR 10,000,000) and payment date.'); return; }
    const input: OneTimeSalaryPaymentInput = { amount: number, paymentMethod: method, referenceNumber: reference.trim() || undefined, note: note.trim() || undefined, paidAt: paidAt.toISOString() };
    const payload = JSON.stringify(input);
    if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    submitting.current = true; setPending(true); setError('');
    try { await api.staff.paySalaryOnce(staff.id, input, attempt.current.key); attempt.current = null; onSuccess(); onClose(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Payment could not be confirmed. Retry the unchanged request using the same payment key.'); }
    finally { submitting.current = false; setPending(false); }
  };
  const field = 'w-full border border-slate-300 rounded px-2 py-2 mt-1 text-sm focus:ring-2 focus:ring-[#185b9d]';
  return <div className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4"><div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="salary-payment-title" className="bg-white rounded-lg border p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <h2 id="salary-payment-title" className="font-bold text-base">Pay Salary Once — {staff.fullName}</h2>
    <form onSubmit={submit} className="space-y-3 mt-4">
      <fieldset disabled={pending} className="space-y-3">
        <label className="block text-xs">Amount (PKR)<input required type="number" min="0.01" max="10000000" step="0.01" className={field} value={amount} onChange={e => { changed(); setAmount(e.target.value); }} /></label>
        <label className="block text-xs">Payment Method<select className={field} value={method} onChange={e => { changed(); setMethod(e.target.value as PaymentMethod); }}>{[['CASH','Cash'],['BANK_TRANSFER','Bank Transfer'],['CHEQUE','Cheque'],['ONLINE','Online'],['OTHER','Other']].map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></label>
        <label className="block text-xs">Reference Number (optional)<input maxLength={100} className={field} value={reference} onChange={e => { changed(); setReference(e.target.value); }} /></label>
        <label className="block text-xs">Note (optional)<textarea maxLength={500} className={field} value={note} onChange={e => { changed(); setNote(e.target.value); }} /></label>
        <label className="block text-xs">Payment Date and Time<input required type="datetime-local" className={field} value={date} onChange={e => { changed(); setDate(e.target.value); }} /></label>
      </fieldset>
      <p className="text-xs text-slate-600">This will record a one-time salary expense in the Financial Ledger. It does not create monthly payroll.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 text-xs"><button type="button" disabled={pending} className="border rounded px-3 py-2" onClick={onClose}>Cancel</button><button disabled={pending} className="bg-[#185b9d] text-white rounded px-3 py-2">{pending ? 'Recording…' : 'Record Salary Payment'}</button></div>
    </form>
  </div></div>;
}
