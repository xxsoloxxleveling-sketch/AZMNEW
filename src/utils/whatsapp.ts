/**
 * WhatsApp integration utility for AZM.AIO student contact.
 * Normalizes diverse Pakistani and international phone formats into valid wa.me links.
 */

export interface WhatsAppContactInfo {
  url: string | null;
  rawPhone: string | null;
  formattedPhone: string | null;
  phoneSource: 'parentMobile' | 'studentMobile' | 'mobile' | 'whatsapp' | 'emergencyContact' | null;
  isDisabled: boolean;
  disabledReason?: string;
  defaultMessage: string;
}

/**
 * Normalizes any Pakistani or international phone string into clean international digit format for wa.me links.
 * Handles:
 *  - "0305-1755551" -> "923051755551"
 *  - "0305 1755551" -> "923051755551"
 *  - "+92 305 1755551" -> "923051755551"
 *  - "00923051755551" -> "923051755551"
 *  - "3051755551" (missing 0/92) -> "923051755551"
 *  - "923051755551" -> "923051755551"
 */
export function formatWhatsAppPhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Extract digits only
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Remove leading 00 international dialing prefix (e.g. 0092300...)
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // If starts with 03 (standard local Pakistani format, 11 digits: 03XXXXXXXXX)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '92' + digits.substring(1);
  } else if (digits.startsWith('3') && digits.length === 10) {
    // Missing leading zero (e.g. 3051755551)
    digits = '92' + digits;
  } else if (digits.startsWith('920') && digits.length === 13) {
    // Accidental 92 + 03XXXXXXXXX
    digits = '92' + digits.substring(3);
  }

  // Minimum valid length for mobile is 10 digits; max ~15
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  // Prevent placeholder junk numbers like "0000000000", "1111111111"
  if (/^(\d)\1+$/.test(digits)) {
    return null;
  }

  return digits;
}

/**
 * Extracts and formats the primary WhatsApp contact number for a student.
 * Prioritizes: parentMobile -> studentMobile -> mobile -> whatsapp -> emergencyContact
 */
export function getStudentWhatsAppContact(student: {
  parentMobile?: string | null;
  studentMobile?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  emergencyContact?: string | null;
  applicationNo?: string | null;
  rollNumber?: string | null;
  fullName?: string | null;
}): WhatsAppContactInfo {
  const sources: Array<{ key: WhatsAppContactInfo['phoneSource']; val?: string | null }> = [
    { key: 'parentMobile', val: student?.parentMobile },
    { key: 'studentMobile', val: student?.studentMobile },
    { key: 'mobile', val: student?.mobile },
    { key: 'whatsapp', val: student?.whatsapp },
    { key: 'emergencyContact', val: student?.emergencyContact },
  ];

  let rawPhone: string | null = null;
  let normalizedPhone: string | null = null;
  let phoneSource: WhatsAppContactInfo['phoneSource'] = null;

  for (const src of sources) {
    if (src.val && src.val.trim()) {
      const formatted = formatWhatsAppPhone(src.val);
      if (formatted) {
        rawPhone = src.val.trim();
        normalizedPhone = formatted;
        phoneSource = src.key;
        break;
      }
    }
  }

  const appIdentifier = student?.applicationNo || student?.rollNumber || 'Candidate';
  const defaultMessage = `Assalam-o-Alaikum, this is AZM.AIO regarding your Session V scholarship application (${appIdentifier}).`;

  if (!normalizedPhone) {
    return {
      url: null,
      rawPhone: null,
      formattedPhone: null,
      phoneSource: null,
      isDisabled: true,
      disabledReason: 'No valid mobile phone number available on file for this candidate.',
      defaultMessage,
    };
  }

  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(defaultMessage)}`;

  return {
    url,
    rawPhone,
    formattedPhone: normalizedPhone,
    phoneSource,
    isDisabled: false,
    defaultMessage,
  };
}

/**
 * Safely opens WhatsApp deep link in a NEW TAB to ensure the admin never loses
 * their active table filters, pagination state, or scroll position.
 */
export function openWhatsAppInNewTab(url: string | null, e?: React.MouseEvent): void {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!url) return;

  window.open(url, '_blank', 'noopener,noreferrer');
}
