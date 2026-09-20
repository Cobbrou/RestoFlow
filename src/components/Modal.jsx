import { X } from "lucide-react";

/**
 * Composant modal générique avec overlay sombre.
 *
 * Props :
 *  - title    : titre affiché dans l'en-tête
 *  - onClose  : callback de fermeture (clic overlay ou bouton ×)
 *  - wide     : si true, max-width = 2xl (au lieu de md)
 *  - children : contenu du corps
 */
export default function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className={`rf-anim-pop bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête sticky */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
          <h3 className="rf-display text-lg font-semibold text-[#2B2622]">{title}</h3>
          <button onClick={onClose} className="rf-tap p-1.5 rounded-full bg-black/5">
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
