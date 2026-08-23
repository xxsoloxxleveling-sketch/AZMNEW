import React, { useState, useEffect } from 'react';
import { GALLERY_ITEMS } from '../../data/scholarshipData';
import { GalleryItem, PageTab } from '../../types';
import { 
  Images, 
  Sparkles, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Calendar, 
  Award, 
  Maximize2,
  Download,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryViewProps {
  onSelectTab: (tab: PageTab) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ onSelectTab }) => {
  const [activeSessionFilter, setActiveSessionFilter] = useState<string>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(18);

  const sessionFilters = [
    { id: 'all', label: 'All Historic Archives' },
    { id: 'Session IV', label: 'Session IV (OMR Testing & Exams)' },
    { id: 'Winter Session III & Ceremony', label: 'Winter Session III & Ceremony' },
    { id: 'Winter Sessions I & II', label: 'Winter Sessions I & II' },
  ];

  const categoryFilters = [
    { id: 'all', label: 'All Activities' },
    { id: 'Ceremony', label: 'Award Ceremonies' },
    { id: 'Examination', label: 'OMR Exam Halls' },
    { id: 'Foundation', label: 'Scholar Honors' },
  ];

  const filteredItems = GALLERY_ITEMS.filter((item) => {
    const matchesSession = activeSessionFilter === 'all' || item.session === activeSessionFilter;
    const matchesCategory = activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    return matchesSession && matchesCategory;
  });

  const displayedItems = filteredItems.slice(0, visibleCount);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedItemIndex === null) return;
      if (e.key === 'Escape') {
        setSelectedItemIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedItemIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowLeft') {
        setSelectedItemIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIndex, filteredItems]);

  const currentModalItem = selectedItemIndex !== null ? filteredItems[selectedItemIndex] : null;

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-[#185b9d]/10 text-[#185b9d] border border-[#185b9d]/20">
          <Images className="w-3.5 h-3.5" />
          Official Historical Photographic Archives
        </span>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight">
          Session Archives & Ceremony Gallery
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto">
          Explore real photographs from past AZM.AIO testing sessions, award conferments, laptop distributions, and optical OMR testing centers across Hazara Division and Khyber Pakhtunkhwa.
        </p>

        {/* Filter Navigation Bars */}
        <div className="space-y-2.5 pt-4">
          {/* Session Filters */}
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {sessionFilters.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSessionFilter(s.id);
                  setVisibleCount(18);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeSessionFilter === s.id
                    ? 'bg-[#185b9d] text-white border-[#185b9d] shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Activity Category Filters */}
          <div className="flex flex-wrap justify-center items-center gap-1.5 text-xs text-slate-500 pt-1">
            <span className="font-semibold text-slate-400 mr-1 text-[11px] uppercase tracking-wider">Type:</span>
            {categoryFilters.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCategoryFilter(c.id);
                  setVisibleCount(18);
                }}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeCategoryFilter === c.id
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery Count Status */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 border-b border-slate-200 pb-3">
        <span>
          Showing <strong className="text-slate-800">{displayedItems.length}</strong> of{' '}
          <strong className="text-slate-800">{filteredItems.length}</strong> verified photos
        </span>
        <span className="text-[11px] font-mono text-slate-400">Click any photo to view in high resolution</span>
      </div>

      {/* Masonry / Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedItems.map((item, idx) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="group relative bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-xl hover:border-slate-300 transition-all cursor-pointer flex flex-col"
            onClick={() => setSelectedItemIndex(idx)}
          >
            <div className="relative h-60 sm:h-64 overflow-hidden bg-slate-900">
              <img
                src={item.image}
                alt={item.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />

              {/* Session Tag Top-Left */}
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white font-mono text-[10px] font-bold border border-slate-700/60 shadow-xs">
                {item.session}
              </span>

              {/* Expand Icon Top-Right */}
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
                <Maximize2 className="w-4 h-4" />
              </div>

              {/* Card Footer Overlay */}
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold font-display leading-snug line-clamp-1">{item.title}</h3>
                <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">{item.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More Button */}
      {visibleCount < filteredItems.length && (
        <div className="text-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 18)}
            className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm rounded-2xl border border-slate-300 shadow-xs hover:shadow-md transition-all"
          >
            Load More Photographs ({filteredItems.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* High Resolution Lightbox Modal */}
      <AnimatePresence>
        {currentModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="relative max-w-5xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#185b9d]/30 text-[#38bdf8] border border-[#185b9d]/50 text-xs font-bold">
                    {currentModalItem.session}
                  </span>
                  <span className="text-xs text-slate-400">
                    Photo {(selectedItemIndex ?? 0) + 1} of {filteredItems.length}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedItemIndex(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors focus:outline-hidden"
                  aria-label="Close photo preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Image Display with Prev/Next Controls */}
              <div className="relative flex-1 bg-black flex items-center justify-center min-h-[50vh] max-h-[68vh] overflow-hidden">
                <img
                  src={currentModalItem.image}
                  alt={currentModalItem.title}
                  className="max-w-full max-h-full object-contain select-none"
                />

                {/* Previous Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/90 border border-white/20 transition-all focus:outline-hidden"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Next Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/90 border border-white/20 transition-all focus:outline-hidden"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Footer Details */}
              <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-display">{currentModalItem.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{currentModalItem.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={currentModalItem.image}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Original File</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
