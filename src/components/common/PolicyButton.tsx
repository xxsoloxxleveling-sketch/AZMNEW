import React from 'react';
import { FileText } from 'lucide-react';

/** Persistent access to the complete official scholarship policy. */
export const PolicyButton: React.FC = () => {
  return (
    <aside
      aria-label="Scholarship policy"
      className="fixed bottom-5 left-5 z-30 pointer-events-auto select-none"
    >
      <a
        href="/AZM-Scholarship-Policy.pdf"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-full border border-white/40 bg-[#185b9d] px-3.5 py-3 text-white shadow-[0_4px_16px_rgba(24,91,157,0.35)] transition-all duration-300 hover:scale-105 hover:bg-[#124879] hover:shadow-[0_6px_22px_rgba(24,91,157,0.5)] focus:outline-hidden focus:ring-2 focus:ring-[#70a9db] focus:ring-offset-2"
        title="Open AZM Scholarship Policy"
      >
        <FileText className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs font-bold tracking-wide">Scholarship Policy</span>
      </a>
    </aside>
  );
};
