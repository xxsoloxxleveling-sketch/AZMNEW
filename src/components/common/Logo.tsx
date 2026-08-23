import React, { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'light',
  showSubtitle = true,
}) => {
  const [loadError, setLoadError] = useState(false);

  const iconSizes = {
    sm: 'w-9 h-9 sm:w-10 sm:h-10',
    md: 'w-12 h-12 sm:w-14 sm:h-14',
    lg: 'w-18 h-18 sm:w-22 sm:h-22',
    xl: 'w-26 h-26 sm:w-30 sm:h-30'
  };

  const textSizes = {
    sm: 'text-lg sm:text-xl',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl'
  };

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 select-none">
      {/* Tightly Cropped Transparent Logo with Zero Extra Space */}
      <div className={`relative ${iconSizes[size]} flex-shrink-0 flex items-center justify-center`}>
        {!loadError ? (
          <img
            src="/pictures/logo_cropped.png"
            alt="AZM.AIO Official Logo"
            onError={() => setLoadError(true)}
            className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(24,91,157,0.35)]"
          />
        ) : (
          <img
            src="/pictures/Logo1.jpeg"
            alt="AZM.AIO Official Logo"
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Brand Wordmark & Subtitle */}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-display font-extrabold tracking-tight ${textSizes[size]} ${
              variant === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            AZM<span className={variant === 'dark' ? 'text-[#38bdf8]' : 'text-[#185b9d]'}>.AIO</span>
          </span>
        </div>
        {showSubtitle && (
          <div
            className={`flex items-center gap-1 text-[11px] sm:text-xs font-medium mt-1 ${
              variant === 'light' ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            <span>Scholarship Portal · Session V 2026</span>
          </div>
        )}
      </div>
    </div>
  );
};
