import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Clock,
  Pin,
  Sparkles,
  BookOpen,
  ShieldCheck,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  mockApi,
  ManagedAnnouncement,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  AlertVisualType,
} from '../../../lib/mockApi';

type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'EXPIRED';

function computeAnnouncementStatus(item: ManagedAnnouncement): AnnouncementStatus {
  if (!item.isPublished) return 'DRAFT';
  const now = new Date();
  if (item.publishStartAt && new Date(item.publishStartAt) > now) return 'SCHEDULED';
  if (item.publishEndAt && new Date(item.publishEndAt) < now) return 'EXPIRED';
  return 'LIVE';
}

function getStatusBadgeStyle(status: AnnouncementStatus) {
  switch (status) {
    case 'LIVE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
    case 'SCHEDULED':
      return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
    case 'EXPIRED':
      return 'bg-rose-100 text-rose-800 border-rose-300 font-semibold';
  }
}

function getAlertVisualIcon(type: AlertVisualType) {
  switch (type) {
    case 'urgent':
    case 'registration':
      return <BellRing className="w-4 h-4 text-amber-500 animate-pulse" />;
    case 'exam':
      return <BookOpen className="w-4 h-4 text-[#185b9d]" />;
    case 'info':
    default:
      return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
  }
}

function getBadgeStyle(type: AlertVisualType) {
  switch (type) {
    case 'urgent':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'registration':
      return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    case 'exam':
      return 'bg-blue-100 text-blue-800 border-blue-200 font-semibold';
    case 'info':
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
}

// Convert ISO string to input datetime-local value (YYYY-MM-DDTHH:mm)
function isoToLocalInputValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

// Convert input datetime-local value to ISO string
function localInputValueToIso(val?: string | null): string | null {
  if (!val || val.trim() === '') return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function formatDateDisplay(iso?: string | null): string {
  if (!iso) return 'Not set';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

export const AnnouncementsTab: React.FC = () => {
  const [announcements, setAnnouncements] = useState<ManagedAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formType, setFormType] = useState<AlertVisualType>('info');
  const [formBadge, setFormBadge] = useState('OFFICIAL NOTICE');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formPublishStartAt, setFormPublishStartAt] = useState('');
  const [formPublishEndAt, setFormPublishEndAt] = useState('');

  const loadAnnouncements = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await mockApi.getAnnouncements();
      setAnnouncements(res.items);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormMessage('');
    setFormType('info');
    setFormBadge('OFFICIAL NOTICE');
    setFormIsPinned(false);
    setFormIsPublished(true);
    setFormPublishStartAt('');
    setFormPublishEndAt('');
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEditForm = (item: ManagedAnnouncement) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormSubtitle(item.subtitle || '');
    setFormMessage(item.message);
    setFormType(item.type);
    setFormBadge(item.badge);
    setFormIsPinned(item.isPinned);
    setFormIsPublished(item.isPublished);
    setFormPublishStartAt(isoToLocalInputValue(item.publishStartAt));
    setFormPublishEndAt(isoToLocalInputValue(item.publishEndAt));
    setErrorMsg(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side validation checks
    const trimmedTitle = formTitle.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 150) {
      setErrorMsg('Title must be between 3 and 150 characters.');
      return;
    }

    const trimmedMsg = formMessage.trim();
    if (trimmedMsg.length < 5 || trimmedMsg.length > 2000) {
      setErrorMsg('Message must be between 5 and 2000 characters.');
      return;
    }

    const trimmedBadge = formBadge.trim();
    if (trimmedBadge.length < 1 || trimmedBadge.length > 30) {
      setErrorMsg('Badge must be between 1 and 30 characters.');
      return;
    }

    const startIso = localInputValueToIso(formPublishStartAt);
    const endIso = localInputValueToIso(formPublishEndAt);

    if (startIso && endIso && new Date(startIso) > new Date(endIso)) {
      setErrorMsg('Publish Start Date cannot be later than Publish End Date.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const payload: UpdateAnnouncementPayload = {
          title: trimmedTitle,
          subtitle: formSubtitle.trim() || null,
          message: trimmedMsg,
          type: formType,
          badge: trimmedBadge,
          isPinned: formIsPinned,
          isPublished: formIsPublished,
          publishStartAt: startIso,
          publishEndAt: endIso,
        };
        await mockApi.updateAnnouncement(editingId, payload);
        setSuccessMsg('Announcement updated successfully.');
      } else {
        const payload: CreateAnnouncementPayload = {
          title: trimmedTitle,
          subtitle: formSubtitle.trim() || null,
          message: trimmedMsg,
          type: formType,
          badge: trimmedBadge,
          isPinned: formIsPinned,
          isPublished: formIsPublished,
          publishStartAt: startIso,
          publishEndAt: endIso,
        };
        await mockApi.createAnnouncement(payload);
        setSuccessMsg('Announcement created successfully.');
      }

      closeForm();
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (item: ManagedAnnouncement) => {
    try {
      await mockApi.updateAnnouncement(item.id, {
        isPublished: !item.isPublished,
      });
      setSuccessMsg(`Announcement ${!item.isPublished ? 'published' : 'unpublished'}.`);
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to toggle publication status.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete this announcement?\n\n"${title}"`)) {
      return;
    }

    try {
      await mockApi.deleteAnnouncement(id);
      setSuccessMsg('Announcement deleted successfully.');
      await loadAnnouncements();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete announcement.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200 mb-2">
            <BellRing className="w-3.5 h-3.5 text-[#185b9d]" />
            <span>Public Noticeboard Manager</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Official Announcements &amp; Live Bulletins
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Create, schedule, and publish live official notices to the public portal noticeboard. Changes appear immediately on next public page refresh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAnnouncements}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="px-4 py-2.5 rounded-xl bg-[#185b9d] hover:bg-[#13497e] text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>
                <p className="text-xs text-slate-500">
                  Controlled announcement builder with instant live card preview.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Fields (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Announcement Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={150}
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Session V Examination Schedule Confirmed"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/30"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>Clear, informative headline</span>
                      <span>{formTitle.length}/150</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Subtitle / Category Tagline (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      value={formSubtitle}
                      onChange={(e) => setFormSubtitle(e.target.value)}
                      placeholder="e.g. Regional Testing Centers &amp; Timings Released"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Message Body <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      minLength={5}
                      maxLength={2000}
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      placeholder="Enter the official details, guidelines, or notices for students and candidates..."
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/30 resize-y"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>Plain text only (no raw HTML or script tags)</span>
                      <span>{formMessage.length}/2000</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Visual Style Theme <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as AlertVisualType)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/30 cursor-pointer font-semibold"
                      >
                        <option value="info">General Info (Emerald / Shield)</option>
                        <option value="exam">Exams &amp; Results (Blue / Book)</option>
                        <option value="registration">Registration (Amber / Bell)</option>
                        <option value="urgent">Urgent Notice (Rose / Pulse)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Badge Label <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={30}
                        value={formBadge}
                        onChange={(e) => setFormBadge(e.target.value)}
                        placeholder="e.g. RESULT, SYLLABUS, URGENT"
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#185b9d]/30 uppercase font-bold"
                      />
                    </div>
                  </div>

                  {/* Scheduling Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-[#185b9d]" />
                      <span>Publication Scheduling (Optional)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Leave blank to publish immediately upon saving. If set, visibility activates and deactivates automatically without cron jobs.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Publish Start Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={formPublishStartAt}
                          onChange={(e) => setFormPublishStartAt(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Publish Expiry Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={formPublishEndAt}
                          onChange={(e) => setFormPublishEndAt(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-wrap items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={formIsPublished}
                        onChange={(e) => setFormIsPublished(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#185b9d] focus:ring-[#185b9d]"
                      />
                      <span>Active / Published</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
                      <input
                        type="checkbox"
                        checked={formIsPinned}
                        onChange={(e) => setFormIsPinned(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="flex items-center gap-1">
                        <Pin className="w-3.5 h-3.5 text-amber-500" />
                        <span>Pin / Highlight on Noticeboard</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Live Card Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Live Public Card Preview</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Real-time CSS
                    </span>
                  </div>

                  {/* Public Card Replica */}
                  <div
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                      formIsPinned
                        ? 'bg-gradient-to-br from-amber-50/70 via-white to-blue-50/30 border-amber-300 shadow-md ring-1 ring-amber-300/40'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    {formIsPinned && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-[#185b9d]" />
                    )}

                    <div className="space-y-3">
                      {/* Badge & Date Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(
                              formType
                            )}`}
                          >
                            {formBadge || 'BADGE'}
                          </span>
                          {formIsPinned && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300">
                              ★ Highlight
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-mono text-slate-500 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Today</span>
                        </span>
                      </div>

                      {/* Title & Subtitle */}
                      <div>
                        <h3 className="text-base font-bold font-display text-slate-900 leading-snug flex items-center gap-2">
                          {getAlertVisualIcon(formType)}
                          <span>{formTitle || 'Sample Announcement Title'}</span>
                        </h3>
                        {formSubtitle && (
                          <p className="text-xs font-semibold text-[#185b9d] mt-0.5">
                            {formSubtitle}
                          </p>
                        )}
                      </div>

                      {/* Message Body */}
                      <p className="text-xs text-slate-600 leading-relaxed break-words whitespace-pre-wrap">
                        {formMessage ||
                          'This is a preview of your announcement message. The actual content entered in the editor will be rendered here with safe JSX text bindings.'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>AZM.AIO Central Testing</span>
                      <span>{formIsPublished ? 'Status: Active' : 'Status: Draft'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                    <strong>Note:</strong> Public visitors will only see this announcement when <em>Active / Published</em> is checked and the current time is within the configured schedule window.
                  </div>
                </div>
              </div>

              {/* Form Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#185b9d] hover:bg-[#13497e] text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingId ? 'Update Announcement' : 'Publish Announcement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Managed Announcements List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Configured Announcements ({announcements.length})
            </h3>
            <p className="text-xs text-slate-400">
              Sorted by pinned items first, then newest creation date.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#185b9d]" />
            <span className="text-xs">Loading announcements from server...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#185b9d] flex items-center justify-center mx-auto">
              <BellRing className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Custom Announcements Created Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click &quot;New Announcement&quot; above to create your first bulletin. If no custom announcements are configured, the portal seamlessly displays the default official notices.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => {
              const status = computeAnnouncementStatus(item);
              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    item.isPinned
                      ? 'bg-amber-50/40 border-amber-200/90'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(status)}`}>
                        {status}
                      </span>

                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getBadgeStyle(item.type)}`}>
                        {item.badge}
                      </span>

                      {item.isPinned && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5 text-amber-400" />
                          <span>Pinned</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {item.id.slice(0, 8)}...
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                      {getAlertVisualIcon(item.type)}
                      <span>{item.title}</span>
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2 max-w-3xl">
                      {item.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 pt-1">
                      <span>Created: {formatDateDisplay(item.createdAt)}</span>
                      {item.publishStartAt && (
                        <span>Starts: {formatDateDisplay(item.publishStartAt)}</span>
                      )}
                      {item.publishEndAt && (
                        <span>Expires: {formatDateDisplay(item.publishEndAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Strip */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(item)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                        item.isPublished
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-xs'
                      }`}
                      title={item.isPublished ? 'Unpublish notice' : 'Publish notice'}
                    >
                      {item.isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                      title="Edit announcement"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-2 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
