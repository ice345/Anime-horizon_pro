import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusableElements = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true' && element.offsetParent !== null
  );

/** Keeps keyboard users inside an open dialog and returns focus to the opener. */
export const useModalA11y = <T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
  dialogRef: RefObject<T | null>
) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusDialog = () => {
      const focusableElements = getFocusableElements(dialog);
      const preferredElement = dialog.querySelector<HTMLElement>('[data-modal-autofocus="true"]');
      (preferredElement || focusableElements[0] || dialog).focus({ preventScroll: true });
    };
    const focusTimer = window.setTimeout(focusDialog, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialog);
      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const activeElement = document.activeElement;
      const activeIndex = focusableElements.indexOf(activeElement as HTMLElement);
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? focusableElements[focusableElements.length - 1] : focusableElements[0]).focus({
          preventScroll: true,
        });
        return;
      }

      if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        focusableElements[focusableElements.length - 1].focus({ preventScroll: true });
      } else if (!event.shiftKey && activeIndex === focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0].focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement?.isConnected) previousActiveElement.focus({ preventScroll: true });
    };
  }, [dialogRef, isOpen]);
};
