import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Composant modal générique avec overlay sombre.
 *
 * Props :
 *  - title    : titre affiché dans l'en-tête
 *  - onClose  : callback de fermeture (clic overlay ou bouton ×)
 *  - wide     : si true, max-width = 2xl (au lieu de md)
 *  - children : contenu du corps
 */
export default function Modal({ isOpen = true, title, onClose, children, wide, "aria-label": ariaLabel }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (onClose) onClose();
    } else if (e.key === "Tab") {
      // Simple focus trap (prevents tabbing outside the modal)
      const focusableElements = modalRef.current.querySelectorAll(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      } else if (e.shiftKey && document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      }
    }
  };

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        onKeyDown={handleKeyDown}
        className={`rf-anim-pop bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête sticky */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
          <h3 className="rf-display text-lg font-semibold text-[#2B2622]">{title}</h3>
          <button onClick={onClose} className="rf-tap p-1.5 rounded-full bg-black/5" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Field — label + champ de formulaire avec espacement cohérent.
 */
export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold text-[#6B6355] mb-1">{label}</span>
      {children}
    </label>
  );
}

/** Classes CSS communes pour les inputs/selects du back-office */
export const inputCls =
  "w-full px-3 py-2 rounded-lg border border-black/15 text-sm outline-none focus:border-[#C1440E] bg-white";
