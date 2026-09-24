import { useState, useMemo } from "react";
import {
  Boxes,
  AlertTriangle,
  TrendingDown,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  PackagePlus,
  History,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban,
  Clock,
} from "lucide-react";
import Modal, { Field, inputCls } from "../../components/Modal.jsx";
import { money } from "../../utils/index.js";

const CATEGORIES = [
  "Boucherie",
  "Poissonnerie",
  "Maraîchage",
  "Crémerie",
  "Pains",
  "Épicerie",
  "Boissons",
];

export default function StockManager({
  ingredients = [],
  stockMovements = [],
  onAddMovement,
  onAddIngredient,
  onUpdateIngredient,
  onDeleteIngredient,
}) {
  const [subView, setSubView] = useState("levels"); // "levels" | "movements"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "ok" | "low" | "out"
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals state
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [ingredientModal, setIngredientModal] = useState(null); // null | "new" | ingredient object

  // KPIs
  const summary = useMemo(() => {
    let totalValue = 0;
    let lowCount = 0;
    let outCount = 0;

    for (const ing of ingredients) {
      totalValue += ing.currentStock * ing.costPerUnit;
      if (ing.currentStock <= 0) {
        outCount++;
      } else if (ing.currentStock <= ing.minThreshold) {
        lowCount++;
      }
    }

    return {
      totalItems: ingredients.length,
      totalValue: Number(totalValue.toFixed(2)),
      lowCount,
      outCount,
      okCount: ingredients.length - lowCount - outCount,
    };
  }, [ingredients]);

  // Filtering
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchSearch =
        ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ing.supplier && ing.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      if (categoryFilter !== "all" && ing.category !== categoryFilter) return false;

      if (statusFilter === "low") return ing.currentStock > 0 && ing.currentStock <= ing.minThreshold;
      if (statusFilter === "out") return ing.currentStock <= 0;
      if (statusFilter === "ok") return ing.currentStock > ing.minThreshold;

      return true;
    });
  }, [ingredients, searchTerm, categoryFilter, statusFilter]);

  return (
    <div className="space-y-5">
      {/* ── Bandeau KPI ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <div className="flex items-center justify-between text-[#8A8378]">
            <span className="text-xs font-semibold uppercase tracking-wider">Valeur du Stock</span>
            <Boxes size={18} className="text-[#C1440E]" />
          </div>
          <p className="rf-display text-2xl font-bold text-[#2B2622] mt-1.5">{money(summary.totalValue)}</p>
          <p className="text-[11px] text-[#6B6355] mt-0.5">Sur {summary.totalItems} références suivies</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <div className="flex items-center justify-between text-[#8A8378]">
            <span className="text-xs font-semibold uppercase tracking-wider">Stocks Sains</span>
            <CheckCircle2 size={18} className="text-[#2E9E5B]" />
          </div>
          <p className="rf-display text-2xl font-bold text-[#2E9E5B] mt-1.5">{summary.okCount}</p>
          <p className="text-[11px] text-[#6B6355] mt-0.5">Niveau optimal garanti</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <div className="flex items-center justify-between text-[#8A8378]">
            <span className="text-xs font-semibold uppercase tracking-wider">Seuil Critique</span>
            <AlertTriangle size={18} className="text-[#D9A441]" />
          </div>
          <p className="rf-display text-2xl font-bold text-[#D9A441] mt-1.5">{summary.lowCount}</p>
          <p className="text-[11px] text-[#6B6355] mt-0.5">Réapprovisionnement suggéré</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <div className="flex items-center justify-between text-[#8A8378]">
            <span className="text-xs font-semibold uppercase tracking-wider">En Rupture</span>
            <Ban size={18} className="text-[#C1361B]" />
          </div>
          <p className="rf-display text-2xl font-bold text-[#C1361B] mt-1.5">{summary.outCount}</p>
          <p className="text-[11px] text-[#6B6355] mt-0.5">Plats dépendants désactivés</p>
        </div>
      </div>

      {/* ── Barre d'actions & Sous-onglets ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-black/5 shadow-xs">
        <div className="flex gap-1 p-1 rounded-xl bg-black/5 w-fit">
          <button
            onClick={() => setSubView("levels")}
            className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subView === "levels" ? "#2B2622" : "transparent",
              color: subView === "levels" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <Boxes size={14} /> Inventaire & Niveaux ({ingredients.length})
          </button>
          <button
            onClick={() => setSubView("movements")}
            className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: subView === "movements" ? "#2B2622" : "transparent",
              color: subView === "movements" ? "#FAF6EE" : "#5B5346",
            }}
          >
            <History size={14} /> Journal des Mouvements ({stockMovements.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDeliveryModalOpen(true)}
            className="rf-tap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#2E9E5B] hover:opacity-90 shadow-xs"
          >
            <PackagePlus size={14} /> Réception Livraison
          </button>
          <button
            onClick={() => setWasteModalOpen(true)}
            className="rf-tap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#C1361B] hover:opacity-90 shadow-xs"
          >
            <TrendingDown size={14} /> Déclarer une Perte
          </button>
          <button
            onClick={() => setIngredientModal("new")}
            className="rf-tap flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#2B2622] hover:opacity-90 shadow-xs"
          >
            <Plus size={14} /> Nouvel Ingrédient
          </button>
        </div>
      </div>

      {/* ── Vue 1 : Niveaux de Stock ──────────────────────────────── */}
      {subView === "levels" && (
        <div className="space-y-3">
          {/* Filtres de recherche */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8378]" />
                <input
                  type="text"
                  placeholder="Rechercher un ingrédient ou fournisseur…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-black/10 focus:outline-none focus:border-[#C1440E]"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs py-2 px-3 rounded-xl bg-white border border-black/10 text-[#2B2622] font-medium focus:outline-none focus:border-[#C1440E]"
              >
                <option value="all">Toutes catégories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto rf-scrollbar pb-1">
              <button
                onClick={() => setStatusFilter("all")}
                className="rf-tap px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{
                  background: statusFilter === "all" ? "#2B2622" : "rgba(0,0,0,.05)",
                  color: statusFilter === "all" ? "#FAF6EE" : "#5B5346",
                }}
              >
                Tous
              </button>
              <button
                onClick={() => setStatusFilter("ok")}
                className="rf-tap px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{
                  background: statusFilter === "ok" ? "#2E9E5B22" : "rgba(0,0,0,.05)",
                  color: statusFilter === "ok" ? "#2E9E5B" : "#5B5346",
                  fontWeight: statusFilter === "ok" ? 700 : 500,
                }}
              >
                🟢 En Stock
              </button>
              <button
                onClick={() => setStatusFilter("low")}
                className="rf-tap px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{
                  background: statusFilter === "low" ? "#D9A44122" : "rgba(0,0,0,.05)",
                  color: statusFilter === "low" ? "#B5793A" : "#5B5346",
                  fontWeight: statusFilter === "low" ? 700 : 500,
                }}
              >
                🟡 Seuil Critique
              </button>
              <button
                onClick={() => setStatusFilter("out")}
                className="rf-tap px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                style={{
                  background: statusFilter === "out" ? "#C1361B22" : "rgba(0,0,0,.05)",
                  color: statusFilter === "out" ? "#C1361B" : "#5B5346",
                  fontWeight: statusFilter === "out" ? 700 : 500,
                }}
              >
                🔴 En Rupture
              </button>
            </div>
          </div>

          {/* Grille / Tableau des ingrédients */}
          <div className="bg-white rounded-2xl border border-black/10 overflow-hidden shadow-xs">
            <div className="overflow-x-auto rf-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[.02] text-[#8A8378] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Ingrédient</th>
                    <th className="py-3 px-3">Catégorie</th>
                    <th className="py-3 px-3">Fournisseur</th>
                    <th className="py-3 px-3">Stock Actuel</th>
                    <th className="py-3 px-3 w-44">Jauge de Niveau</th>
                    <th className="py-3 px-3">Coût Unitaire</th>
                    <th className="py-3 px-3">Valeur HT</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredIngredients.map((ing) => {
                    const ratio = ing.idealStock > 0 ? Math.min(100, Math.round((ing.currentStock / ing.idealStock) * 100)) : 0;
                    const isOut = ing.currentStock <= 0;
                    const isLow = !isOut && ing.currentStock <= ing.minThreshold;

                    const barColor = isOut ? "#C1361B" : isLow ? "#D9A441" : "#2E9E5B";

                    return (
                      <tr key={ing.id} className="hover:bg-black/[.01] transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#2B2622]">
                          <div className="flex items-center gap-2">
                            <span>{ing.name}</span>
                            {isOut && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#C1361B]/10 text-[#C1361B]">
                                RUPTURE
                              </span>
                            )}
                            {isLow && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#D9A441]/15 text-[#B5793A]">
                                CRITIQUE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#6B6355]">
                          <span className="px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-medium">
                            {ing.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#8A8378]">{ing.supplier || "—"}</td>
                        <td className="py-3 px-3 font-bold text-[#2B2622]">
                          {ing.currentStock} <span className="font-normal text-[#8A8378] text-[11px]">{ing.unit}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${ratio}%`, background: barColor }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-[#8A8378]">
                              <span>Seuil: {ing.minThreshold}</span>
                              <span>Cible: {ing.idealStock}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#5B5346]">
                          {ing.costPerUnit > 0 ? `${money(ing.costPerUnit)} / ${ing.unit}` : "—"}
                        </td>
                        <td className="py-3 px-3 font-bold text-[#2B2622]">
                          {money(ing.currentStock * ing.costPerUnit)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setIngredientModal(ing)}
                              className="rf-tap p-1.5 rounded-lg text-[#5B5346] hover:bg-black/5"
                              title="Modifier l'ingrédient"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Supprimer définitivement l'ingrédient "${ing.name}" ?`)) {
                                  onDeleteIngredient?.(ing.id);
                                }
                              }}
                              className="rf-tap p-1.5 rounded-lg text-[#C1361B] hover:bg-[#C1361B]/10"
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredIngredients.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#8A8378]">
                        Aucun ingrédient ne correspond à vos critères de recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Vue 2 : Journal des Mouvements ───────────────────────── */}
      {subView === "movements" && (
        <div className="bg-white rounded-2xl border border-black/10 overflow-hidden shadow-xs">
          <div className="p-3 border-b border-black/5 bg-black/[.02] flex items-center justify-between">
            <p className="text-xs font-semibold text-[#2B2622]">
              Historique des 60 dernières entrées / sorties de stock
            </p>
            <span className="text-[11px] text-[#8A8378]">Mises à jour automatiques via commandes & saisies</span>
          </div>
          <div className="overflow-x-auto rf-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/10 text-[#8A8378] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Ingrédient</th>
                  <th className="py-3 px-3">Quantité</th>
                  <th className="py-3 px-3">Coût d'achat</th>
                  <th className="py-3 px-3">Motif / Contexte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {stockMovements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  const dateStr = new Date(mov.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  let badgeColor = "#2B2622";
                  let badgeBg = "rgba(0,0,0,0.05)";
                  let badgeLabel = mov.type;

                  if (mov.type === "DELIVERY") {
                    badgeColor = "#2E9E5B";
                    badgeBg = "#2E9E5B15";
                    badgeLabel = "LIVRAISON";
                  } else if (mov.type === "ORDER_CONSUMPTION") {
                    badgeColor = "#3E7CB1";
                    badgeBg = "#3E7CB115";
                    badgeLabel = "COMMANDE";
                  } else if (mov.type === "WASTE") {
                    badgeColor = "#C1361B";
                    badgeBg = "#C1361B15";
                    badgeLabel = "PERTE / CASSE";
                  } else if (mov.type === "ADJUSTMENT") {
                    badgeColor = "#B5793A";
                    badgeBg = "#B5793A15";
                    badgeLabel = "INVENTAIRE";
                  }

                  return (
                    <tr key={mov.id} className="hover:bg-black/[.01] transition-colors">
                      <td className="py-3 px-4 text-[#6B6355] flex items-center gap-1.5 whitespace-nowrap">
                        <Clock size={12} className="text-[#8A8378]" /> {dateStr}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: badgeBg, color: badgeColor }}
                        >
                          {badgeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#2B2622]">
                        {mov.ingredientName}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        <span
                          className="flex items-center gap-0.5"
                          style={{ color: isPositive ? "#2E9E5B" : "#C1361B" }}
                        >
                          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isPositive ? `+${mov.quantity}` : mov.quantity} {mov.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#6B6355]">
                        {mov.unitCost ? `${money(mov.unitCost)} / ${mov.unit}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-[#5B5346]">{mov.reason || "—"}</td>
                    </tr>
                  );
                })}
                {stockMovements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8A8378]">
                      Aucun mouvement de stock enregistré pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modale Réception Livraison ────────────────────────────── */}
      {deliveryModalOpen && (
        <DeliveryModal
          ingredients={ingredients}
          onClose={() => setDeliveryModalOpen(false)}
          onSave={(data) => {
            onAddMovement?.(data);
            setDeliveryModalOpen(false);
          }}
        />
      )}

      {/* ── Modale Déclaration de Perte ───────────────────────────── */}
      {wasteModalOpen && (
        <WasteModal
          ingredients={ingredients}
          onClose={() => setWasteModalOpen(false)}
          onSave={(data) => {
            onAddMovement?.(data);
            setWasteModalOpen(false);
          }}
        />
      )}

      {/* ── Modale Ingrédient (Création / Édition) ──────────────────── */}
      {ingredientModal && (
        <IngredientEditorModal
          ingredient={typeof ingredientModal === "object" ? ingredientModal : null}
          onClose={() => setIngredientModal(null)}
          onSave={(data) => {
            if (ingredientModal === "new") {
              onAddIngredient?.(data);
            } else {
              onUpdateIngredient?.(ingredientModal.id, data);
            }
            setIngredientModal(null);
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODALES SPÉCIALISÉES
══════════════════════════════════════════════════════════════ */

function DeliveryModal({ ingredients, onClose, onSave }) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");

  const selected = ingredients.find((i) => i.id === ingredientId);

  return (
    <Modal title="📦 Réception d'une livraison fournisseur" onClose={onClose}>
      <Field label="Ingrédient réceptionné">
        <select
          className={inputCls}
          value={ingredientId}
          onChange={(e) => {
            setIngredientId(e.target.value);
            const found = ingredients.find((i) => i.id === e.target.value);
            if (found && !unitCost) setUnitCost(found.costPerUnit || "");
          }}
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit}) — Fournisseur: {i.supplier || "Standard"}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantité reçue (${selected?.unit || "unités"})`}>
          <input
            type="number"
            min="0.1"
            step="any"
            className={inputCls}
            placeholder="Ex : 50"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Prix d'achat unitaire HT (€)">
          <input
            type="number"
            min="0"
            step="0.001"
            className={inputCls}
            placeholder={selected?.costPerUnit ? `${selected.costPerUnit} €` : "0.00"}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Numéro de bon de livraison / Facture">
        <input
          type="text"
          className={inputCls}
          placeholder="Ex : BL-2026-9481 Sysco"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">
          Annuler
        </button>
        <button
          onClick={() => {
            const q = parseFloat(quantity);
            if (!q || q <= 0) return alert("Veuillez saisir une quantité positive.");
            onSave({
              ingredientId,
              type: "DELIVERY",
              quantity: q,
              unitCost: unitCost ? parseFloat(unitCost) : selected?.costPerUnit,
              reason: reason.trim() || `Livraison ${selected?.supplier || "fournisseur"}`,
            });
          }}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2E9E5B]"
        >
          Valider la réception
        </button>
      </div>
    </Modal>
  );
}

function WasteModal({ ingredients, onClose, onSave }) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Casse ou gâchis en préparation");

  const selected = ingredients.find((i) => i.id === ingredientId);

  return (
    <Modal title="⚠️ Déclaration de perte ou démarque" onClose={onClose}>
      <Field label="Ingrédient concerné">
        <select
          className={inputCls}
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} (Stock actuel : {i.currentStock} {i.unit})
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Quantité perdue (${selected?.unit || "unités"})`}>
        <input
          type="number"
          min="0.1"
          step="any"
          className={inputCls}
          placeholder="Ex : 2"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Field>

      <Field label="Motif de la perte (obligatoire pour conformité)">
        <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="Casse ou accident en service">Casse ou accident en service</option>
          <option value="Dépassement de DLC / Périmé">Dépassement de DLC / Périmé</option>
          <option value="Erreur de dosage ou cuisson brûlée">Erreur de dosage ou cuisson brûlée</option>
          <option value="Défaut qualité fournisseur">Défaut qualité fournisseur</option>
          <option value="Régularisation d'écart d'inventaire">Régularisation d'écart d'inventaire</option>
        </select>
      </Field>

      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">
          Annuler
        </button>
        <button
          onClick={() => {
            const q = parseFloat(quantity);
            if (!q || q <= 0) return alert("Veuillez saisir une quantité positive.");
            onSave({
              ingredientId,
              type: "WASTE",
              quantity: -q, // Négatif pour décompter
              reason,
            });
          }}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C1361B]"
        >
          Enregistrer la perte
        </button>
      </div>
    </Modal>
  );
}

function IngredientEditorModal({ ingredient, onClose, onSave }) {
  const isNew = !ingredient;
  const [name, setName] = useState(ingredient?.name || "");
  const [category, setCategory] = useState(ingredient?.category || "Boucherie");
  const [unit, setUnit] = useState(ingredient?.unit || "piece");
  const [currentStock, setCurrentStock] = useState(ingredient?.currentStock ?? 0);
  const [minThreshold, setMinThreshold] = useState(ingredient?.minThreshold ?? 5);
  const [idealStock, setIdealStock] = useState(ingredient?.idealStock ?? 20);
  const [costPerUnit, setCostPerUnit] = useState(ingredient?.costPerUnit ?? 0);
  const [supplier, setSupplier] = useState(ingredient?.supplier || "");

  return (
    <Modal title={isNew ? "✨ Nouvel Ingrédient" : `✏️ Modifier : ${ingredient.name}`} onClose={onClose}>
      <Field label="Nom de l'ingrédient">
        <input
          type="text"
          className={inputCls}
          placeholder="Ex : Steak haché bœuf 180g"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unité de mesure">
          <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="piece">Pièce (portion / unité)</option>
            <option value="g">Grammes (g)</option>
            <option value="kg">Kilogrammes (kg)</option>
            <option value="ml">Millilitres (ml)</option>
            <option value="cl">Centilitres (cl)</option>
            <option value="l">Litres (l)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {isNew && (
          <Field label="Stock Initial">
            <input
              type="number"
              min="0"
              step="any"
              className={inputCls}
              value={currentStock}
              onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
            />
          </Field>
        )}
        <Field label="Seuil Critique (Min)">
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            value={minThreshold}
            onChange={(e) => setMinThreshold(parseFloat(e.target.value) || 0)}
          />
        </Field>
        <Field label="Stock Cible (Idéal)">
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            value={idealStock}
            onChange={(e) => setIdealStock(parseFloat(e.target.value) || 0)}
          />
        </Field>
        <Field label="Prix d'achat HT (€)">
          <input
            type="number"
            min="0"
            step="0.001"
            className={inputCls}
            value={costPerUnit}
            onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
          />
        </Field>
      </div>

      <Field label="Fournisseur principal">
        <input
          type="text"
          className={inputCls}
          placeholder="Ex : Metro, Sysco, Rungis Marée"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </Field>

      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">
          Annuler
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return alert("Veuillez saisir un nom d'ingrédient.");
            onSave({
              name: name.trim(),
              category,
              unit,
              currentStock: parseFloat(currentStock) || 0,
              minThreshold: parseFloat(minThreshold) || 5,
              idealStock: parseFloat(idealStock) || 20,
              costPerUnit: parseFloat(costPerUnit) || 0,
              supplier: supplier.trim() || null,
            });
          }}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#C1440E]"
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
