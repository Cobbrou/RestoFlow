import Modal from "./Modal.jsx";

/**
 * Nombre de couverts à l'ouverture d'une table : une touche, sans clavier.
 * Les places de la table sont mises en avant ; "Passer" ouvre la table sans couverts (estimés au Z).
 */
export default function CoversPicker({ table, onPick, onClose }) {
  if (!table) return null;
  const max = Math.max(8, (table.seats || 2) + 2);
  return (
    <Modal title={`Table ${table.number} — combien de couverts ?`} onClose={onClose}>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={`rf-tap py-4 rounded-xl text-xl font-bold ${
              n === table.seats ? "bg-[#2B2622] text-[#FAF6EE]" : "bg-black/5 text-[#2B2622]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onPick(null)} className="rf-tap mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-[#6B6355] bg-black/5">
        Passer
      </button>
    </Modal>
  );
}
