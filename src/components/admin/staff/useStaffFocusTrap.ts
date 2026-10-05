import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseStaffFocusTrapOptions {
  isOpen: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  preventReturnFocus?: boolean;
}

/**
 * Accessible focus trap and focus restoration hook for Staff modals and drawers.
 */
export function useStaffFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
  preventReturnFocus = false,
}: UseStaffFocusTrapOptions): void {
  const triggerRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isOpen) return;

    // Capture the element that had focus when opening
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Direct initial focus only once on open
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
      if (!containerRef.current || e.defaultPrevented) return;

      // Yield keydown handling if another dialog is open on top of this container
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs.length > 1 && dialogs[dialogs.length - 1] !== containerRef.current) {
        return;
      }

      // Handle Escape
      if (e.key === 'Escape') {
        if (onEscapeRef.current) {
          e.preventDefault();
          e.stopImmediatePropagation();
          onEscapeRef.current();
        }
        return;
      }

      // Handle Tab wrap
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
          // Shift + Tab
          if (
            document.activeElement === firstElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
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

      // Return focus to captured trigger
      if (!preventReturnFocus && triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, preventReturnFocus, containerRef, initialFocusRef]);
}
