import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UsePartnerFocusTrapOptions {
  isOpen: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  preventReturnFocus?: boolean;
}

/**
 * Robust keyboard focus-trap and focus-management hook for accessible dialogs & drawers.
 * - Captures previous active element on mount and restores focus on close.
 * - Directs initial focus into the surface.
 * - Wraps Tab and Shift+Tab strictly within the container.
 * - Handles Escape key cleanly.
 */
export function usePartnerFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
  preventReturnFocus = false,
}: UsePartnerFocusTrapOptions): void {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the trigger element that opened the dialog
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Focus the initial element or the first focusable element inside the container
    const initialTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const firstVisible = Array.from(focusable).find((el) => el.offsetParent !== null);
        if (firstVisible) {
          firstVisible.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      // Handle Escape
      if (e.key === 'Escape') {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }

      // Handle Tab trap
      if (e.key === 'Tab') {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (
            document.activeElement === firstElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (
            document.activeElement === lastElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('keydown', handleKeyDown);

      // Return focus to the trigger that opened the dialog
      if (!preventReturnFocus && triggerRef.current && typeof triggerRef.current.focus === 'function') {
        setTimeout(() => {
          try {
            triggerRef.current?.focus();
          } catch {}
        }, 50);
      }
    };
  }, [isOpen, onEscape, initialFocusRef, containerRef, preventReturnFocus]);
}
