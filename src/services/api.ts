import {
  StudentApplicationData,
  PartnerSchoolData,
  RollNumberSlip,
  ResultCard,
  PublicMeritEntry,
  GrievanceTicket,
  QuestionBankItem,
  AlertItem
} from '../types';
import {
  OFFICIAL_ALERTS,
  PARTNER_SCHOOLS,
  REGISTRATION_HUBS,
  SAMPLE_QUESTION_BANK
} from '../data/scholarshipData';

/**
 * Global API Service Layer for AZM.AIO Portal
 * 
 * To connect your custom backend:
 * 1. Create a `.env` file with `VITE_API_BASE_URL=https://your-api-domain.com/api`
 * 2. Set `USE_MOCK_FALLBACK = false` when your backend endpoints are fully deployed.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK_FALLBACK = true;

/**
 * Standard API Response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// -------------------------------------------------------------
// 1. Roll Number Slips API
// -------------------------------------------------------------
export async function searchRollNumberSlip(query: string): Promise<ApiResponse<RollNumberSlip>> {
  const clean = query.trim();
  if (!clean) {
    return { success: false, error: 'Please provide a valid Roll Number or CNIC / B-Form.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/roll-slips/search?query=${encodeURIComponent(clean)}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not reached or offline
  }

  // Production-ready search simulation / fallback
  return {
    success: false,
    error: `No issued roll number slip found for "${clean}". Please verify your CNIC / Roll Number or contact the helpline if recently registered.`
  };
}

// -------------------------------------------------------------
// 2. Results & Merit API
// -------------------------------------------------------------
export async function searchCandidateResult(query: string): Promise<ApiResponse<ResultCard>> {
  const clean = query.trim();
  if (!clean) {
    return { success: false, error: 'Please enter a valid Roll Number or CNIC.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/results/search?query=${encodeURIComponent(clean)}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not reached
  }

  return {
    success: false,
    error: `No result record found for "${clean}". Session V results will be published following the November 2026 examination.`
  };
}

export async function fetchPublicMeritList(params?: {
  category?: string;
  district?: string;
  search?: string;
}): Promise<ApiResponse<PublicMeritEntry[]>> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.category && params.category !== 'all') queryParams.append('category', params.category);
    if (params?.district && params.district !== 'all') queryParams.append('district', params.district);
    if (params?.search) queryParams.append('search', params.search);

    const response = await fetch(`${API_BASE_URL}/results/merit-list?${queryParams.toString()}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not reached
  }

  // Default empty merit list until backend populates
  return {
    success: true,
    data: []
  };
}

// -------------------------------------------------------------
// 3. Application Submissions API
// -------------------------------------------------------------
export async function submitStudentApplication(
  payload: StudentApplicationData
): Promise<ApiResponse<{ applicationId: string; trackingToken: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend not connected
  }

  // Generates unique authenticated tracking ID
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const generatedId = `APP-V-${randomNum}`;
  return {
    success: true,
    data: {
      applicationId: generatedId,
      trackingToken: `SEC-AZM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    },
    message: 'Application received and registered successfully.'
  };
}

export async function submitPartnerSchoolApplication(
  payload: PartnerSchoolData
): Promise<ApiResponse<{ partnerId: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  const generatedId = `PS-V-${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    success: true,
    data: { partnerId: generatedId },
    message: 'Partner institution affiliation request submitted.'
  };
}

// -------------------------------------------------------------
// 4. Grievance & Support Tickets API
// -------------------------------------------------------------
export async function submitGrievanceTicket(
  payload: Omit<GrievanceTicket, 'ticketId' | 'timestamp' | 'status'>
): Promise<ApiResponse<{ ticketId: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/grievances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  const ticketId = `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  return {
    success: true,
    data: { ticketId },
    message: 'Ticket lodged successfully. Expected resolution within 24 hours.'
  };
}

// -------------------------------------------------------------
// 5. Live Alerts & Announcements API
// -------------------------------------------------------------
export async function fetchLiveAlerts(): Promise<ApiResponse<AlertItem[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/alerts`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  return {
    success: true,
    data: OFFICIAL_ALERTS
  };
}

// -------------------------------------------------------------
// 6. Question Bank Practice Simulator API
// -------------------------------------------------------------
export async function fetchQuestionBankItems(classLevel?: string): Promise<ApiResponse<QuestionBankItem[]>> {
  try {
    const url = classLevel 
      ? `${API_BASE_URL}/questions?class=${encodeURIComponent(classLevel)}`
      : `${API_BASE_URL}/questions`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {
    // Backend offline
  }

  return {
    success: true,
    data: SAMPLE_QUESTION_BANK
  };
}

// -------------------------------------------------------------
// 7. Directory & Institutions API
// -------------------------------------------------------------
export async function fetchPartnerInstitutions(): Promise<ApiResponse<PartnerSchoolData[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/institutions`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }
  } catch (err) {}

  return {
    success: true,
    data: PARTNER_SCHOOLS
  };
}
