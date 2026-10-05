import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseLedgerFocusTrapOptions {
  isOpen: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  preventReturnFocus?: boolean;
}

/**
 * Keyboard focus-trap and accessible focus-management hook for Ledger modals and drawers.
 * - Captures the trigger element that opened the dialog and restores focus upon close.
 * - Directs initial focus into the primary input or first focusable control.
 * - Constrains Tab / Shift+Tab cycles strictly within the active dialog container.
 * - Handles Escape key presses safely when allowed.
 */
export function useLedgerFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
  preventReturnFocus = false,
}: UseLedgerFocusTrapOptions): void {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture the trigger element that opened the dialog
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Direct initial focus into the specified element or first focusable element
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
          // Shift + Tab: if on first element or outside, wrap to last
          if (
            document.activeElement === firstElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element or outside, wrap to first
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

      // Return focus to trigger upon close
      if (!preventReturnFocus && triggerRef.current) {
        const elemToFocus = triggerRef.current;
        setTimeout(() => {
          try {
            if (elemToFocus && typeof elemToFocus.focus === 'function') {
              elemToFocus.focus();
            }
          } catch {
            // Element might have been unmounted
          }
        }, 10);
      }
    };
  }, [isOpen, containerRef, initialFocusRef, onEscape, preventReturnFocus]);
}
