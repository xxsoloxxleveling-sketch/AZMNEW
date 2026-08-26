/**
 * Comprehensive client-side form validation, auto-formatting, and human-readable error mapping
 * for AZM.AIO scholarship applications.
 */

// Districts and Provinces for strict dropdown validation
export const VALID_PROVINCES = [
  'Khyber Pakhtunkhwa',
  'Punjab',
  'Sindh',
  'Balochistan',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
  'Islamabad Capital Territory',
];

export const VALID_DISTRICTS_KP = [
  'Mansehra',
  'Abbottabad',
  'Haripur',
  'Battagram',
  'Torghar',
  'Kohistan Upper',
  'Kohistan Lower',
  'Kolai-Palas',
  'Peshawar',
  'Mardan',
  'Swabi',
  'Charsadda',
  'Nowshera',
  'Kohat',
  'Bannu',
  'Dera Ismail Khan',
  'Swat',
  'Dir Upper',
  'Dir Lower',
  'Chitral Upper',
  'Chitral Lower',
  'Malakand',
  'Buner',
  'Shangla',
  'Other District',
];

/**
 * Auto-formats raw digits into 13501-XXXXXXX-X format.
 */
export function formatCnic(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').substring(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) {
    return `${digits.substring(0, 5)}-${digits.substring(5)}`;
  }
  return `${digits.substring(0, 5)}-${digits.substring(5, 12)}-${digits.substring(12, 13)}`;
}

/**
 * Auto-formats raw digits into 03XX-XXXXXXX format.
 */
export function formatPakistaniPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').substring(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.substring(0, 4)}-${digits.substring(4, 11)}`;
}

/**
 * Validates candidate full name.
 * Rules: Required, min 3 characters, English & Urdu letters / spaces / hyphens / dots / apostrophes only. No digits/special symbols.
 */
export function validateFullName(name?: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return 'Candidate full name is required.';
  }
  if (trimmed.length < 3) {
    return 'Full name must be at least 3 characters long.';
  }
  // Allow English letters, Urdu unicode characters (0600-06FF), spaces, dots, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\u0600-\u06FF\s\.\'\-]+$/;
  if (!nameRegex.test(trimmed)) {
    return 'Full name can only contain letters and spaces (no numbers or symbols).';
  }
  return null;
}

/**
 * Validates father/guardian name.
 */
export function validateFatherName(name?: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return "Father's / Guardian's name is required.";
  }
  if (trimmed.length < 3) {
    return "Father's / Guardian's name must be at least 3 characters long.";
  }
  const nameRegex = /^[a-zA-Z\u0600-\u06FF\s\.\'\-]+$/;
  if (!nameRegex.test(trimmed)) {
    return "Father's name can only contain letters and spaces (no numbers or symbols).";
  }
  return null;
}

/**
 * Validates CNIC / B-Form number.
 * Must match 13 digits (XXXXX-XXXXXXX-X).
 */
export function validateCnic(cnic?: string): string | null {
  const trimmed = (cnic || '').trim();
  if (!trimmed) {
    return 'Candidate CNIC / B-Form number is required.';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 13) {
    return 'CNIC / B-Form must contain exactly 13 digits (e.g. 13501-1234567-1).';
  }
  const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
  if (!cnicPattern.test(trimmed) && trimmed.length !== 13) {
    return 'Please enter a valid CNIC format (e.g. 13501-1234567-1).';
  }
  return null;
}

/**
 * Validates gender selection.
 */
export function validateGender(gender?: string): string | null {
  const trimmed = (gender || '').trim().toLowerCase();
  if (!trimmed || (trimmed !== 'male' && trimmed !== 'female' && trimmed !== 'other')) {
    return 'Please select a valid gender option.';
  }
  return null;
}

/**
 * Validates date of birth and candidate age.
 * Sane range for scholarship candidates: 10 to 22 years old.
 */
export function validateDobAndAge(dob?: string): { error: string | null; age: number | null } {
  const trimmed = (dob || '').trim();
  if (!trimmed) {
    return { error: 'Date of birth is required.', age: null };
  }

  const birthDate = new Date(trimmed);
  if (isNaN(birthDate.getTime())) {
    return { error: 'Please enter a valid calendar date.', age: null };
  }

  const today = new Date();
  if (birthDate > today) {
    return { error: 'Date of birth cannot be in the future.', age: null };
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 10 || age > 22) {
    return {
      error: `This doesn't look like a valid date of birth for a candidate (candidate age is ${age} years; must be between 10 and 22 years old).`,
      age,
    };
  }

  return { error: null, age };
}

/**
 * Validates passport photo file for MIME type, file size (<= 200 KB), and minimum dimensions (>= 200x200px).
 */
export function validatePhotoFile(file: File): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    // 1. File Type / MIME Validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      resolve({
        valid: false,
        error: 'Your photo must be a JPG, PNG, or WebP image file.',
      });
      return;
    }

    // 2. File Size Validation (<= 200 KB = 204,800 bytes)
    const maxBytes = 200 * 1024;
    if (file.size > maxBytes) {
      const actualKb = Math.round(file.size / 1024);
      resolve({
        valid: false,
        error: `Photo file size (${actualKb} KB) exceeds the maximum allowed 200 KB limit.`,
      });
      return;
    }

    // 3. Image Dimensions Validation (>= 200x200)
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 200 || img.height < 200) {
          resolve({
            valid: false,
            error: `Image dimensions (${img.width}×${img.height}px) are too small. Please upload a clear photo of at least 200×200 pixels.`,
          });
        } else {
          resolve({ valid: true });
        }
      };
      img.onerror = () => {
        resolve({
          valid: false,
          error: 'Corrupt or unreadable image file. Please choose another photograph.',
        });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve({
        valid: false,
        error: 'Unable to read photo file. Please try again.',
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates permanent address (min 10 characters).
 */
export function validateAddress(address?: string): string | null {
  const trimmed = (address || '').trim();
  if (!trimmed) {
    return 'Permanent residential address is required.';
  }
  if (trimmed.length < 10) {
    return 'Please enter a complete residential address (at least 10 characters).';
  }
  return null;
}

/**
 * Validates district and province selection.
 */
export function validateDistrictProvince(district?: string, province?: string): string | null {
  const trimmedDistrict = (district || '').trim();
  const trimmedProvince = (province || '').trim();

  if (!trimmedDistrict) {
    return 'Please select your home District.';
  }
  if (!trimmedProvince) {
    return 'Please select your Province.';
  }
  return null;
}

/**
 * Validates Pakistani mobile phone format 03XX-XXXXXXX (11 digits).
 */
export function validatePhone(phone?: string, fieldLabel = 'Mobile number'): string | null {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return `${fieldLabel} is required.`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 11) {
    return `${fieldLabel} must be exactly 11 digits (e.g. 0300-1234567).`;
  }
  if (!digits.startsWith('03')) {
    return `${fieldLabel} must start with 03 (e.g. 0300-XXXXXXX).`;
  }
  return null;
}

/**
 * Validates optional email. If provided, must match standard pattern.
 */
export function validateEmail(email?: string): string | null {
  const trimmed = (email || '').trim();
  if (!trimmed) return null; // Optional

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address (e.g. candidate@example.com).';
  }
  return null;
}

/**
 * Validates current school / college name (min 3 characters).
 */
export function validateSchoolName(name?: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return 'Current school or college name is required.';
  }
  if (trimmed.length < 3) {
    return 'School name must be at least 3 characters long.';
  }
  return null;
}

/**
 * Validates grade/class.
 */
export function validateGradeClass(grade?: string): string | null {
  const trimmed = (grade || '').trim();
  if (!trimmed || trimmed.length < 2) {
    return 'Target Applied Grade / Class is required.';
  }
  return null;
}

/**
 * Validates father/guardian occupation.
 */
export function validateOccupation(occupation?: string): string | null {
  const trimmed = (occupation || '').trim();
  if (!trimmed) {
    return "Father's / Guardian's occupation is required.";
  }
  if (trimmed.length < 3) {
    return 'Occupation must be at least 3 characters long.';
  }
  return null;
}

/**
 * Validates household monthly income.
 */
export function validateIncome(income: number | string): string | null {
  const num = typeof income === 'number' ? income : Number(income);
  if (isNaN(num) || num <= 0) {
    return 'Monthly household income is required and must be greater than 0.';
  }
  if (num > 10000000) {
    return 'Please double-check this figure (monthly income exceeds PKR 10,000,000).';
  }
  return null;
}

/**
 * Validates number of dependents.
 */
export function validateDependents(dependents: number | string): string | null {
  const num = typeof dependents === 'number' ? dependents : parseInt(String(dependents), 10);
  if (isNaN(num) || num < 0) {
    return 'Number of family dependents must be 0 or greater.';
  }
  if (num > 20) {
    return 'Please double-check the number of family dependents (maximum 20).';
  }
  return null;
}

/**
 * Validates Emergency Contact field.
 * Must contain BOTH a contact person name (at least 2 letters) AND a valid Pakistani phone number (03XX-XXXXXXX or 11 digits).
 */
export function validateEmergencyContact(contact?: string): string | null {
  const trimmed = (contact || '').trim();
  if (!trimmed) {
    return 'Emergency contact person name and mobile number are required.';
  }

  // Look for 11-digit phone number pattern inside the string
  const phonePattern = /(03\d{2}[-\s]?\d{7}|03\d{9})/;
  const phoneMatch = trimmed.match(phonePattern);

  if (!phoneMatch) {
    return 'Emergency contact must include a valid 11-digit Pakistani phone number (e.g. 0300-1234567).';
  }

  // Remove the matched phone number and inspect the remainder for name
  const namePart = trimmed.replace(phoneMatch[0], '').replace(/[\(\)\-\:\,\/]/g, '').trim();
  if (namePart.length < 2) {
    return 'Emergency contact must include both a contact person name and phone number (e.g. "Muhammad Tariq (Father) - 0300-1234567").';
  }

  return null;
}

/**
 * Validates school/institute name (min 3 characters).
 */
export function validateInstitute(institute?: string): string | null {
  const trimmed = (institute || '').trim();
  if (!trimmed) {
    return 'Institute name is required.';
  }
  if (trimmed.length < 3) {
    return 'Institute name must be at least 3 characters long.';
  }
  return null;
}

/**
 * Validates single academic record row.
 */
export function validateAcademicRecord(record: {
  gradeClass: string;
  passingYear: string;
  totalMarks: number;
  obtainedMarks: number;
  institute: string;
}): { [field: string]: string } | null {
  const errors: { [field: string]: string } = {};
  const currentYear = new Date().getFullYear();

  if (!record.gradeClass?.trim()) {
    errors.gradeClass = 'Exam / Class name is required.';
  }

  const yearNum = parseInt(record.passingYear, 10);
  if (!record.passingYear?.trim() || isNaN(yearNum) || yearNum < 2000 || yearNum > currentYear) {
    errors.passingYear = `Passing year must be a 4-digit year between 2000 and ${currentYear}.`;
  }

  const total = Number(record.totalMarks);
  const obt = Number(record.obtainedMarks);

  if (isNaN(total) || total <= 0) {
    errors.totalMarks = 'Total marks must be greater than 0.';
  }

  if (isNaN(obt) || obt < 0) {
    errors.obtainedMarks = 'Obtained marks must be 0 or greater.';
  } else if (total > 0 && obt > total) {
    errors.obtainedMarks = 'Obtained marks cannot be greater than total marks.';
  }

  const instErr = validateInstitute(record.institute);
  if (instErr) {
    errors.institute = instErr;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Maps technical backend / fetch / network errors into student-friendly, actionable messages.
 */
export function mapSubmitErrorToFriendlyMessage(error: any): string {
  if (!error) {
    return 'An unexpected issue occurred while submitting your application. Please try again.';
  }

  const msg = typeof error === 'string' ? error : error.message || '';
  const status = error.status || (typeof error === 'object' && 'statusCode' in error ? error.statusCode : null);

  // 1. Network / Connection Errors
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('aborted')
  ) {
    return "We couldn't reach the AZM.AIO server. Please check your internet connection and try submitting again.";
  }

  // 2. Timeout Errors
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('took longer')) {
    return 'The server is taking longer than usual to respond. Please wait about 15 seconds and press Submit again.';
  }

  // 3. Duplicate CNIC or Application
  if (
    msg.toLowerCase().includes('already registered') ||
    msg.toLowerCase().includes('cnic already exists') ||
    msg.toLowerCase().includes('unique constraint')
  ) {
    return 'An application with this CNIC / B-Form is already registered in our system. You can re-download your slip from the "Re-Download Slip" tab.';
  }

  // 4. 4xx Client Data Validation Error
  if (status && status >= 400 && status < 500) {
    return 'Some of the information in your application could not be accepted by the server. Please review Stages 1–7 for any highlighted fields and try again.';
  }

  // 5. 5xx Server-Side Error
  if (status && status >= 500) {
    return 'The AZM.AIO server ran into a temporary problem while saving your application. Nothing was lost — please try submitting again in a moment. If this keeps happening, contact our helpline at 0305-1755551.';
  }

  // Default clean message with helpline
  return msg.length > 0 && !msg.includes('TypeError') && !msg.includes('Object')
    ? msg
    : 'The application could not be submitted at this moment. Please check your details and try again, or contact the helpline at 0305-1755551.';
}

/**
 * Trims all string properties recursively in a form data object.
 */
export function trimObjectStrings<T extends Record<string, any>>(obj: T): T {
  const result: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string') {
        result[key] = val.trim();
      } else if (val && typeof val === 'object' && !(val instanceof File)) {
        result[key] = trimObjectStrings(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}
