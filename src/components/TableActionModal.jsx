import { useState, useMemo } from "react";
import { ArrowRightLeft, Merge, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import Modal from "./Modal.jsx";
import { orderTotal, money } from "../utils/index.js";

export default function TableActionModal({
  isOpen,
  onClose,
  initialMode = "transfer", // "transfer" | "merge"
  sourceTable,
  tables = [],
  orders = [],
  onTransfer,
  onMerge,
}) {
  const [mode, setMode] = useState(initialMode);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [error, setError] = useState("");

  const sourceOrder = useMemo(() => {
    if (!sourceTable) return null;
    return orders.find((o) => o.tableId === sourceTable.id && (!o.status || o.status === "open"));
  }, [sourceTable, orders]);

  // Tables disponibles pour le transfert (libres sans commande ouverte)
  const freeTables = useMemo(() => {
    return tables.filter(
      (t) =>
        t.id !== sourceTable?.id &&
        !orders.some((o) => o.tableId === t.id && (!o.status || o.status === "open"))
    );
  }, [tables, orders, sourceTable]);

  // Tables disponibles pour la fusion (occupées avec commande ouverte)
  const occupiedTables = useMemo(() => {
    return tables.filter(
      (t) =>
        t.id !== sourceTable?.id &&
        orders.some((o) => o.tableId === t.id && (!o.status || o.status === "open"))
    );
  }, [tables, orders, sourceTable]);

  const targetTable = tables.find((t) => t.id === selectedTargetId);
  const targetOrder = orders.find((o) => o.tableId === selectedTargetId && (!o.status || o.status === "open"));

  const handleSubmit = () => {
    setError("");
    if (!selectedTargetId) {
      setError("Veuillez sélectionner une table cible.");
      return;
    }

    if (mode === "transfer") {
      onTransfer(sourceTable.id, selectedTargetId);
      onClose();
    } else {
      if (!window.confirm(`Confirmer la fusion de la Table ${sourceTable.number} vers la Table ${targetTable.number} ? Les articles seront regroupés sur la Table ${targetTable.number}.`)) {
        return;
      }
      onMerge(sourceTable.id, selectedTargetId);
      onClose();
    }
  };

  if (!isOpen) return null;
  if (!sourceTable || !sourceOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Gestion Table ${sourceTable.number} — Salle Dynamique`}
    >
      <div className="p-4 space-y-4">
        {/* Sélecteur de mode */}
        <div className="flex gap-2 p-1 rounded-xl bg-black/5">
          <button
            onClick={() => { setMode("transfer"); setSelectedTargetId(""); setError(""); }}
            className={`rf-tap flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === "transfer"
                ? "bg-white text-[#2B2622] shadow-xs"
                : "text-[#6B6355] hover:text-[#2B2622]"
            }`}
          >
            <ArrowRightLeft size={14} className="text-[#C1440E]" />
            <span>Transférer de table</span>
          </button>
          <button
            onClick={() => { setMode("merge"); setSelectedTargetId(""); setError(""); }}
            className={`rf-tap flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === "merge"
                ? "bg-white text-[#2B2622] shadow-xs"
                : "text-[#6B6355] hover:text-[#2B2622]"
            }`}
          >
            <Merge size={14} className="text-[#3E7CB1]" />
            <span>Fusionner deux tables</span>
          </button>
        </div>

        {/* Récapitulatif Table source */}
        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#E4DAC6] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#8A8378] uppercase tracking-wider">Table d'origine</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="rf-black text-lg text-[#2B2622]">Table {sourceTable.number}</span>
              <span className="text-xs text-[#5B5346] flex items-center gap-0.5">
                <Users size={11} /> {sourceTable.seats} pers.
              </span>
            </div>
            <p className="text-xs text-[#6B6355] mt-0.5">
              {sourceOrder.items.length} article(s) · Serveur : {sourceOrder.server}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#8A8378]">Total actuel</span>
            <div className="font-extrabold text-base text-[#2B2622]">
              {money(orderTotal(sourceOrder))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Mode Transfert */}
        {mode === "transfer" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1">
                Choisir la table de destination libre :
              </label>
              {freeTables.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/5 text-center text-xs text-[#8A8378]">
                  Aucune autre table n'est actuellement libre en salle.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto rf-scrollbar p-1">
                  {freeTables.map((t) => {
                    const isSelected = selectedTargetId === t.id;
                    const isEnoughSeats = t.seats >= sourceTable.seats;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTargetId(t.id)}
                        className={`rf-tap p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "border-[#C1440E] bg-[#C1440E]/5 ring-2 ring-[#C1440E]"
                            : "border-black/10 bg-white hover:border-black/25"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rf-black text-base text-[#2B2622]">{t.number}</span>
                          <span className="text-[10px] text-[#2E9E5B] font-bold">Libre</span>
                        </div>
                        <span className={`text-[11px] mt-1 flex items-center gap-0.5 ${isEnoughSeats ? "text-[#5B5346]" : "text-amber-700"}`}>
                          <Users size={10} /> {t.seats} pers.
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#6B6355] bg-black/[.03] p-2.5 rounded-lg">
              ℹ️ L'intégralité de la commande sera déplacée vers la nouvelle table. La table {sourceTable.number} redeviendra instantanément libre.
            </p>
          </div>
        )}

        {/* Mode Fusion */}
        {mode === "merge" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#5B5346] mb-1">
                Choisir la table à fusionner avec la Table {sourceTable.number} :
              </label>
              {occupiedTables.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/5 text-center text-xs text-[#8A8378]">
                  Aucune autre table avec commande ouverte n'est disponible pour la fusion.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto rf-scrollbar p-1">
                  {occupiedTables.map((t) => {
                    const o = orders.find((ord) => ord.tableId === t.id && ord.status === "open");
                    const isSelected = selectedTargetId === t.id;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTargetId(t.id)}
                        className={`rf-tap p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "border-[#3E7CB1] bg-[#3E7CB1]/5 ring-2 ring-[#3E7CB1]"
                            : "border-black/10 bg-white hover:border-black/25"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rf-black text-base text-[#2B2622]">Table {t.number}</span>
                          <span className="text-[10px] text-[#3E7CB1] font-bold">Occupée</span>
                        </div>
                        <div className="text-xs text-[#5B5346] mt-1">
                          {o ? money(orderTotal(o)) : "-"} · {o?.items?.length || 0} art.
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {targetOrder && (
              <div className="p-2.5 rounded-lg bg-[#3E7CB1]/10 border border-[#3E7CB1]/20 text-xs text-[#1D4A6E] flex justify-between items-center">
                <span>Nouveau total après fusion :</span>
                <span className="font-extrabold text-sm">
                  {money(orderTotal(sourceOrder) + orderTotal(targetOrder))}
                </span>
              </div>
            )}

            <p className="text-[11px] text-[#6B6355] bg-black/[.03] p-2.5 rounded-lg">
              ℹ️ Tous les articles de la Table {sourceTable.number} seront ajoutés à la commande de la Table cible. La Table {sourceTable.number} sera ensuite libérée.
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex justify-end gap-2 pt-2 border-t border-black/10">
          <button
            onClick={onClose}
            className="rf-tap px-4 py-2 rounded-xl text-xs font-semibold bg-black/5 text-[#5B5346]"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTargetId}
            className={`rf-tap px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all ${
              !selectedTargetId
                ? "bg-black/20 cursor-not-allowed"
                : mode === "transfer"
                ? "bg-[#C1440E] hover:bg-[#a93b0b]"
                : "bg-[#3E7CB1] hover:bg-[#2e628f]"
            }`}
          >
            <CheckCircle2 size={14} />
            <span>
              {mode === "transfer" ? "Valider le transfert" : "Confirmer la fusion"}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
