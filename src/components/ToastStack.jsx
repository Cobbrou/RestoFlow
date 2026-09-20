/**
 * ToastStack — pile de notifications éphémères affichée en haut à droite.
 *
 * Chaque toast a un type `kind` qui détermine sa couleur :
 *  - "server"  → vert (commande prête à servir)
 *  - "warn"    → rouge (rupture de stock, erreur)
 *  - autre     → sombre (nouvelle commande en cuisine)
 */
export default function ToastStack({ toasts }) {
  return (
    <div className="fixed top-16 inset-x-2 sm:inset-x-auto sm:right-4 z-50 flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rf-anim-toast rf-mono text-xs font-semibold px-3.5 py-2.5 rounded-lg shadow-lg border text-center sm:text-left"
          style={{
            background:   t.kind === "server" ? "#2E9E5B" : t.kind === "warn" ? "#C1361B" : "#2B2622",
            color:        "#FAF6EE",
            borderColor:  "rgba(255,255,255,.15)",
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
