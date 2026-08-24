import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';

export const WhatsAppButton: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside
      aria-label="Candidate Support on WhatsApp"
      className="fixed bottom-5 right-5 z-30 pointer-events-auto select-none"
    >
      <a
        href="https://wa.me/923440197194?text=Hello%20AZM.AIO%20Scholarship%20Desk%2C%20I%20have%20an%20inquiry%20regarding%20Session%20V%20Scholarship%20Test."
        target="_blank"
        rel="noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-2 px-3.5 py-3 sm:px-4 sm:py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full shadow-[0_4px_16px_rgba(37,211,102,0.4)] hover:shadow-[0_6px_22px_rgba(37,211,102,0.6)] transition-all duration-300 transform hover:scale-105 active:scale-95 group border border-white/30 focus:outline-hidden"
        title="Direct WhatsApp Helpline (0344-0197194)"
      >
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold font-sans tracking-wide hidden md:inline-block max-w-0 md:max-w-xs overflow-hidden whitespace-nowrap transition-all duration-300">
          WhatsApp Support
        </span>
      </a>
    </aside>
  );
};
