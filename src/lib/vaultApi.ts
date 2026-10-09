import { apiFetch, apiFetchProtectedObjectUrl } from './apiClient';

export type VaultReviewStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type VaultDocumentType = 'photo' | 'bform' | 'fatherCnic' | 'dmc' | 'domicile' | 'paymentReceipt' | 'income' | 'signature';

export interface VaultDocument {
  id: string;
  studentId: string;
  studentName: string;
  applicationNo: string;
  rollNumber: string | null;
  currentClass: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  byteSize: number | null;
  reviewStatus: VaultReviewStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  revision: number;
  uploadedAt: string;
  updatedAt: string;
  fileEndpoint: string;
}

export interface VaultPage {
  documents: VaultDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { total: number; PENDING_REVIEW: number; VERIFIED: number; REJECTED: number };
  classes: string[];
}

export interface VaultAuditEvent {
  id: string;
  documentId: string;
  action: 'UPLOADED' | 'REPLACED' | 'VERIFIED' | 'REJECTED' | 'REOPENED';
  actorName: string;
  createdAt: string;
  fromStatus: VaultReviewStatus | null;
  toStatus: VaultReviewStatus | null;
  reason: string | null;
  previousFileName: string | null;
  newFileName: string | null;
  priorVersionAvailable: boolean;
}

export interface VaultHistory {
  events: VaultAuditEvent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const queryString = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
};

function checkFile(file: File): void {
  if (!file || file.size === 0) throw new Error('Choose a nonempty file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Files must be 5 MB or smaller.');
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or PDF file.');
  }
}

export const vaultApi = {
  list(params: { page?: number; limit?: number; search?: string; type?: VaultDocumentType; class?: string; status?: VaultReviewStatus; studentId?: string }) {
    return apiFetch<VaultPage>('/api/vault/documents?' + queryString(params));
  },
  get(id: string) {
    return apiFetch<VaultDocument>('/api/vault/documents/' + encodeURIComponent(id));
  },
  getHistory(id: string, page = 1) {
    return apiFetch<VaultHistory>('/api/vault/documents/' + encodeURIComponent(id) + '/history?page=' + page + '&limit=20');
  },
  fileUrl(id: string) {
    return apiFetchProtectedObjectUrl('/api/vault/documents/' + encodeURIComponent(id) + '/file');
  },
  priorFileUrl(id: string, eventId: string) {
    return apiFetchProtectedObjectUrl('/api/vault/documents/' + encodeURIComponent(id) + '/history/' + encodeURIComponent(eventId) + '/file');
  },
  upload(studentId: string, documentType: VaultDocumentType, file: File) {
    checkFile(file);
    return apiFetch<VaultDocument>('/api/vault/documents', {
      method: 'POST',
      headers: {
        'Content-Type': file.type, 'X-Candidate-Key': studentId, 'X-Document-Type': documentType,
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
      timeoutMs: 120000,
    });
  },
  replace(id: string, expectedRevision: number, file: File) {
    checkFile(file);
    return apiFetch<VaultDocument>('/api/vault/documents/' + encodeURIComponent(id) + '/file?revision=' + expectedRevision, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
      timeoutMs: 120000,
    });
  },
  review(id: string, expectedRevision: number, status: VaultReviewStatus, reason?: string) {
    return apiFetch<VaultDocument>('/api/vault/documents/' + encodeURIComponent(id) + '/review', {
      method: 'PATCH',
      body: JSON.stringify({ status, expectedRevision, ...(status === 'REJECTED' ? { reason } : {}) }),
    });
  },
};
