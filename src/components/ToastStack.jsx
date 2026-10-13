import { X } from "lucide-react";

/**
 * ToastStack — pile de notifications éphémères affichée en haut à droite.
 *
 * Chaque toast a un type `kind` qui détermine sa couleur :
 *  - "server"  → vert (commande prête à servir)
 *  - "warn"    → rouge (rupture de stock, erreur), reste affiché jusqu'à fermeture
 *  - autre     → sombre (nouvelle commande en cuisine)
 */
export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      className="fixed top-16 inset-x-2 sm:inset-x-auto sm:right-4 z-50 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "warn" ? "alert" : "status"}
          className="rf-anim-toast rf-mono text-xs font-semibold pl-3.5 pr-1.5 py-1.5 rounded-lg shadow-lg border flex items-center gap-2 pointer-events-auto"
          style={{
            background:   t.kind === "server" ? "#237A46" : t.kind === "warn" ? "#C1361B" : "#2B2622",
            color:        "#FAF6EE",
            borderColor:  "rgba(255,255,255,.15)",
          }}
        >
          <span className="flex-1 py-1 text-center sm:text-left">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="rf-tap p-1.5 rounded-full hover:bg-white/15 shrink-0"
            aria-label="Fermer la notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
