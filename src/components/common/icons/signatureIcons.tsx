import React from 'react';
import { IconProps, defaultIconProps } from './types';

// ============================================================================
// 1. SIDEBAR NAVIGATION SIGNATURE ICONS
// ============================================================================

/**
 * Institutional Dashboard Overview
 * Distinctive asymmetric operational console with primary command panel and two stacked side cards
 */
export const IconDashboard: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <rect x="3" y="3" width="10" height="18" rx="1.5" />
    <line x1="3" y1="9" x2="13" y2="9" />
    <rect x="15" y="3" width="6" height="8" rx="1.25" />
    <rect x="15" y="13" width="6" height="8" rx="1.25" />
  </svg>
);

/**
 * Students & Candidate Roster
 * Clear candidate bust silhouette with integrated academic mortarboard cap
 */
export const IconStudents: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M12 2L3 6.5l9 4 9-4L12 2z" />
    <path d="M20 7v4" />
    <path d="M7 9v2.5a5 5 0 0 0 10 0V9" />
    <path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21" />
  </svg>
);

/**
 * Partner Institutions & Colleges
 * Classical university facade with heraldic seal, sturdy columns, and bilateral arched portal
 */
export const IconPartners: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M12 2.5L2 7.5h20L12 2.5z" />
    <circle cx="12" cy="5.2" r="0.8" fill="currentColor" stroke="none" />
    <line x1="3" y1="7.5" x2="21" y2="7.5" />
    <line x1="5.5" y1="10" x2="5.5" y2="18" />
    <line x1="18.5" y1="10" x2="18.5" y2="18" />
    <path d="M9 18v-5a3 3 0 0 1 6 0v5" />
    <line x1="12" y1="13" x2="12" y2="18" />
    <path d="M3 18.5h18" />
    <path d="M1.5 21.5h21" />
  </svg>
);

/**
 * Exam Halls & Seating Allocations
 * Front invigilator dais with clean desk rows and seated candidates flanking a central aisle
 */
export const IconHalls: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <rect x="7" y="3" width="10" height="3" rx="1" />
    <line x1="3.5" y1="10" x2="10" y2="10" />
    <circle cx="6.75" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    <line x1="14" y1="10" x2="20.5" y2="10" />
    <circle cx="17.25" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    <line x1="3.5" y1="17" x2="10" y2="17" />
    <circle cx="6.75" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
    <line x1="14" y1="17" x2="20.5" y2="17" />
    <circle cx="17.25" cy="20.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Document Storage Vault
 * Sturdy institutional archive folder with bold embedded security padlock
 */
export const IconStorage: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    <rect x="9.5" y="12" width="5" height="4.5" rx="1" />
    <path d="M10.5 12V10a1.5 1.5 0 0 1 3 0v2" />
  </svg>
);

/**
 * Attendance & QR Management
 * Calendar register with binder lugs, optical QR finder module, and clearance checkmark
 */
export const IconAttendance: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <line x1="7" y1="2" x2="7" y2="5" />
    <line x1="17" y1="2" x2="17" y2="5" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <rect x="5.5" y="11.5" width="4.5" height="4.5" rx="0.75" />
    <rect x="7" y="13" width="1.5" height="1.5" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="14.5" r="3.25" />
    <path d="M14.2 14.5l1 1 1.8-1.8" />
  </svg>
);

/**
 * Fee Challans & Vouchers
 * Institutional bank deposit voucher with perforated teller stub and accounting rows
 */
export const IconFees: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M4 3h11l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M15 3v5h5" />
    <line x1="9" y1="3" x2="9" y2="22" strokeDasharray="1.75 2" />
    <circle cx="6.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <line x1="12" y1="11" x2="17" y2="11" />
    <line x1="12" y1="14.5" x2="17" y2="14.5" />
    <line x1="12" y1="18" x2="15.5" y2="18" />
  </svg>
);

/**
 * Staff Directory & Administration
 * Senior faculty officer with formal collar & tie, flanked by collegiate faculty wings
 */
export const IconStaff: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <circle cx="12" cy="7" r="3.5" />
    <path d="M5.5 21v-1.5a5 5 0 0 1 5-4.5h3a5 5 0 0 1 5 4.5V21" />
    <path d="M12 15v3.5l-.75-.75.75-2 .75 2-.75.75" />
    <path d="M4 14a2.5 2.5 0 0 1 1.5-2.2" />
    <path d="M18.5 11.8A2.5 2.5 0 0 1 20 14" />
  </svg>
);

/**
 * Payroll & Salary Ledger
 * Official salary disbursement folio with compensation slip and institutional monetary seal
 */
export const IconPayroll: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M6 6V4a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 4v2" />
    <rect x="3" y="6" width="18" height="15" rx="2" />
    <line x1="3" y1="11" x2="21" y2="11" />
    <circle cx="12" cy="15.5" r="2.5" />
    <circle cx="12" cy="15.5" r="0.8" fill="currentColor" stroke="none" />
    <line x1="6.5" y1="15.5" x2="8" y2="15.5" />
    <line x1="16" y1="15.5" x2="17.5" y2="15.5" />
  </svg>
);

/**
 * General Accounting Ledger
 * Bound institutional double-entry ledger with spine straps, debit/credit columns, and audit balance line
 */
export const IconLedger: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M4 3h15a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H4a1.5 1.5 0 0 1-1.5-1.5V4.5A1.5 1.5 0 0 1 4 3z" />
    <line x1="7.5" y1="3" x2="7.5" y2="22" />
    <line x1="3" y1="6.5" x2="7.5" y2="6.5" />
    <line x1="3" y1="18.5" x2="7.5" y2="18.5" />
    <line x1="14" y1="6.5" x2="14" y2="18.5" />
    <line x1="10" y1="7" x2="18.5" y2="7" />
    <line x1="10" y1="10.5" x2="12.5" y2="10.5" />
    <line x1="15.5" y1="10.5" x2="18" y2="10.5" />
    <line x1="10" y1="14" x2="12.5" y2="14" />
    <line x1="15.5" y1="14" x2="18" y2="14" />
    <line x1="10" y1="17.5" x2="18.5" y2="17.5" />
  </svg>
);

/**
 * Settings & Security Governance
 * Institutional security shield with internal precision calibrator dial and security bolt
 */
export const IconSettings: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="10.5" r="2.5" />
    <line x1="12" y1="6" x2="12" y2="7.5" />
    <line x1="12" y1="13.5" x2="12" y2="15" />
    <line x1="7.5" y1="10.5" x2="9" y2="10.5" />
    <line x1="15" y1="10.5" x2="16.5" y2="10.5" />
  </svg>
);

/**
 * Optical QR Scanner
 * Precision viewfinder frame enclosing a single recognizable QR position finder pattern
 */
export const IconScan: React.FC<IconProps> = ({
  size = defaultIconProps.size,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <rect x="8" y="8" width="8" height="8" rx="1.5" />
    <rect x="10.5" y="10.5" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);

// ============================================================================
// 2. TOP HEADER ACTIONS SIGNATURE ICONS
// ============================================================================

/**
 * Top Action: Add Student
 * Distinctive candidate silhouette with crisp circular plus badge
 */
export const IconAddStudent: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 19c0-3.5 3.5-5.5 7-5.5 1.5 0 2.8.4 3.9 1.1" />
    <circle cx="18" cy="15.5" r="4.5" />
    <line x1="18" y1="13.5" x2="18" y2="17.5" />
    <line x1="16" y1="15.5" x2="20" y2="15.5" />
  </svg>
);

/**
 * Top Action: Mark Attendance
 * Scanner target frame with authenticated checkmark
 */
export const IconMarkAttendance: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M4 7V4h3" />
    <path d="M17 4h3v3" />
    <path d="M20 17v3h-3" />
    <path d="M7 20H4v-3" />
    <path d="M8 12.5l3 3 5.5-5.5" />
  </svg>
);

/**
 * Top Action: Generate Challan
 * Official voucher with fold corner and issuance seal
 */
export const IconGenerateChallan: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <circle cx="12" cy="15" r="3.5" />
    <line x1="12" y1="13.5" x2="12" y2="16.5" />
    <line x1="10.5" y1="15" x2="13.5" y2="15" />
  </svg>
);

// ============================================================================
// 3. CORE ACTION SIGNATURE ICONS (WORKFLOWS & ROSTER)
// ============================================================================

/**
 * View Profile / View Details
 * Candidate dossier inspection with miniature ID photo outline and profile lines
 */
export const IconViewProfile: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8" cy="10" r="2" />
    <path d="M5.5 15.5c.7-1.3 2-2 3.5-2s2.8.7 3.5 2" />
    <line x1="14" y1="9" x2="18.5" y2="9" />
    <line x1="14" y1="12" x2="18.5" y2="12" />
    <line x1="14" y1="15" x2="17" y2="15" />
  </svg>
);

/**
 * Edit Student / Modify Record
 * Precision technical stylus drafting onto document line
 */
export const IconEditStudent: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 18.5 3 20l1.5-4L16.5 3.5z" />
    <line x1="14" y1="20" x2="20" y2="20" />
  </svg>
);

/**
 * Approve Fee Payment
 * Official clearance seal with verified checkmark
 */
export const IconApproveFee: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12l2.5 2.5 4.5-4.5" />
  </svg>
);

/**
 * Print Slip / Document
 * Institutional printer with roll slip feed and extrusion
 */
export const IconPrintSlip: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <rect x="4" y="9" width="16" height="8" rx="1.5" />
    <path d="M7 9V4h10v5" />
    <path d="M7 14v6h10v-6" />
    <circle cx="16.5" cy="11.5" r="0.75" fill="currentColor" />
  </svg>
);

/**
 * Download / Export Document
 * Clean downward vector onto sturdy baseline tray
 */
export const IconDownloadSlip: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    <line x1="12" y1="4" x2="12" y2="14" />
    <polyline points="7 10 12 15 17 10" />
  </svg>
);

/**
 * Delete Candidate / Destructive Removal
 * Restrained administrative waste container with lid
 */
export const IconDeleteCandidate: React.FC<IconProps> = ({
  size = 16,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <line x1="4" y1="7" x2="20" y2="7" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

/**
 * AZM Institutional Brand Crest
 * Restrained academic emblem with institutional shield and star
 */
export const IconBrandCrest: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 7l1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4L12 7z" fill="currentColor" stroke="none" />
  </svg>
);
