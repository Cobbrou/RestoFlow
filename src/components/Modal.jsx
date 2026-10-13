import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Socle de toute fenêtre modale : overlay, rôle dialog, Échap, piège du focus,
 * focus rendu à l'élément d'origine à la fermeture.
 *
 * Props :
 *  - onClose          : fermeture (Échap, clic sur l'overlay)
 *  - label            : nom accessible de la fenêtre
 *  - dismissible      : false bloque Échap et le clic sur l'overlay (saisie en cours à protéger)
 *  - overlayClassName : fond et marges de l'overlay
 *  - className        : classes du panneau
 */
export function Dialog({ onClose, label, dismissible = true, overlayClassName = "bg-black/50 p-6", className = "", children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (dismissible) onClose?.();
    } else if (e.key === "Tab") {
      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        first?.focus();
        e.preventDefault();
      } else if (e.shiftKey && document.activeElement === first) {
        last?.focus();
        e.preventDefault();
      }
    }
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 ${overlayClassName}`}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={`outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Composant modal générique avec en-tête et bouton de fermeture.
 *
 * Props :
 *  - title    : titre affiché dans l'en-tête
 *  - onClose  : callback de fermeture (Échap, clic overlay ou bouton ×)
 *  - wide     : si true, max-width = 2xl (au lieu de md)
 *  - children : contenu du corps
 */
export default function Modal({ isOpen = true, title, onClose, children, wide, opaque, "aria-label": ariaLabel }) {
  if (!isOpen) return null;
  return (
    <Dialog
      onClose={onClose}
      label={ariaLabel || title}
      overlayClassName={`${opaque ? "bg-[#14110D]" : "bg-black/50"} p-6`}
      className={`rf-anim-pop bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl`}
    >
      {/* En-tête sticky */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
        <h3 className="rf-display text-lg font-semibold text-[#2B2622]">{title}</h3>
        <button type="button" onClick={onClose} className="rf-tap p-1.5 rounded-full bg-black/5" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>

      {/* Corps */}
      <div className="p-5">{children}</div>
    </Dialog>
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
