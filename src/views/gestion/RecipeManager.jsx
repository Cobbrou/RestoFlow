import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  DollarSign,
  Percent,
  Info,
  Scale,
  Sparkles,
} from "lucide-react";
import { money } from "../../utils/index.js";
import { compatibleUnits, toStockQty } from "../../utils/units.js";

export default function RecipeManager({
  products = [],
  ingredients = [],
  recipes = [],
  onSaveRecipe,
  onToggleProductAvailable,
}) {
  const standaloneProducts = useMemo(() => {
    return products.filter((p) => !p.isMenu);
  }, [products]);

  const [selectedProductId, setSelectedProductId] = useState(
    standaloneProducts[0]?.id || ""
  );
  const [searchTerm, setSearchTerm] = useState("");

  const selectedProduct = useMemo(() => {
    return standaloneProducts.find((p) => p.id === selectedProductId);
  }, [standaloneProducts, selectedProductId]);

  // Current recipe items for selected product
  const productRecipeItems = useMemo(() => {
    return recipes.filter((r) => r.productId === selectedProductId);
  }, [recipes, selectedProductId]);

  // Local draft state for editing recipe
  const [draftItems, setDraftItems] = useState(null);

  // Sync draft when selected product changes
  const activeItems = draftItems !== null ? draftItems : productRecipeItems;

  const handleSelectProduct = (pId) => {
    setSelectedProductId(pId);
    setDraftItems(null);
  };

  const handleAddItem = () => {
    const defaultIng = ingredients[0];
    if (!defaultIng) return alert("Aucun ingrédient disponible. Veuillez d'abord en créer dans l'onglet Stocks.");
    const newItem = {
      id: `temp_${Date.now()}`,
      productId: selectedProductId,
      ingredientId: defaultIng.id,
      quantity: 1,
      unit: defaultIng.unit,
      isCritical: true,
      notes: "",
    };
    setDraftItems([...(activeItems || []), newItem]);
  };

  const handleUpdateItem = (index, field, value) => {
    const updated = [...activeItems];
    updated[index] = { ...updated[index], [field]: value };

    // Si on change l'ingrédient, mettre à jour l'unité par défaut
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === value);
      if (ing) updated[index].unit = ing.unit;
    }

    setDraftItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = activeItems.filter((_, i) => i !== index);
    setDraftItems(updated);
  };

  // Financial calculations
  const financials = useMemo(() => {
    if (!selectedProduct) return null;

    let portionCost = 0;
    let minPortions = Infinity;

    for (const item of activeItems) {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const costPerUnit = ing?.costPerUnit || 0;
      const stockQty = toStockQty(item.quantity, item.unit, ing?.unit); // dosage dans l'unité du stock
      const lineCost = stockQty * costPerUnit;
      portionCost += lineCost;

      if (item.isCritical && stockQty > 0 && ing) {
        const possible = Math.floor(ing.currentStock / stockQty);
        if (possible < minPortions) {
          minPortions = Math.max(0, possible);
        }
      }
    }

    if (activeItems.length === 0 || minPortions === Infinity) {
      minPortions = selectedProduct.available ? 99 : 0;
    }

    const priceTTC = selectedProduct.price;
    const priceHT = priceTTC / 1.10; // TVA restauration assise 10%
    const grossMarginHT = Math.max(0, priceHT - portionCost);
    const foodCostRate = priceHT > 0 ? (portionCost / priceHT) * 100 : 0;
    const marginRate = priceHT > 0 ? (grossMarginHT / priceHT) * 100 : 0;
    const multiplier = portionCost > 0 ? priceTTC / portionCost : 0;

    let status = "optimal";
    if (foodCostRate > 35) status = "critical";
    else if (foodCostRate > 28) status = "warning";

    return {
      portionCost: Number(portionCost.toFixed(2)),
      priceHT: Number(priceHT.toFixed(2)),
      priceTTC,
      grossMarginHT: Number(grossMarginHT.toFixed(2)),
      foodCostRate: Number(foodCostRate.toFixed(1)),
      marginRate: Number(marginRate.toFixed(1)),
      multiplier: Number(multiplier.toFixed(2)),
      minPortions,
      status,
    };
  }, [selectedProduct, activeItems, ingredients]);

  const handleSave = () => {
    if (!selectedProductId) return;
    const formatted = activeItems.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit,
      isCritical: item.isCritical ?? true,
      notes: item.notes || "",
    }));

    onSaveRecipe?.(selectedProductId, formatted);
    setDraftItems(null);
  };

  const filteredProducts = standaloneProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* ── Colonne Gauche : Liste des Plats ────────────────────── */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-black/10 p-3 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8A8378]">Catalogue ({standaloneProducts.length})</h2>
          <span className="text-[11px] text-[#6B6355]">Sélectionnez un plat</span>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Filtrer les plats…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-3 py-1.5 text-xs rounded-xl bg-black/5 border-none focus:outline-none focus:ring-1 focus:ring-[#C1440E]"
          />
        </div>

        <div className="space-y-1.5 max-h-[580px] overflow-y-auto rf-scrollbar pr-1">
          {filteredProducts.map((p) => {
            const isSelected = p.id === selectedProductId;
            const rCount = recipes.filter((r) => r.productId === p.id).length;
            const hasRecipe = rCount > 0;

            return (
              <button
                key={p.id}
                onClick={() => handleSelectProduct(p.id)}
                className={`rf-tap w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                  isSelected
                    ? "border-[#C1440E] bg-[#C1440E]/5 shadow-xs"
                    : "border-black/5 hover:border-black/15 bg-white"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{p.emoji || "🍽️"}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isSelected ? "text-[#C1440E]" : "text-[#2B2622]"}`}>
                      {p.name}
                    </p>
                    <p className="text-[10px] text-[#8A8378]">{money(p.price)} TTC</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasRecipe ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#2E9E5B]/10 text-[#2E9E5B]">
                      {rCount} ingr.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-black/5 text-[#8A8378]">
                      Sans fiche
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Colonne Droite : Fiche Technique & Analyse Financière ──── */}
      <div className="lg:col-span-8 space-y-4">
        {selectedProduct ? (
          <>
            {/* Entête du plat sélectionné */}
            <div className="bg-white rounded-2xl border border-black/10 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-xl bg-black/5">{selectedProduct.emoji || "🍽️"}</span>
                <div>
                  <h1 className="rf-display text-xl font-bold text-[#2B2622]">{selectedProduct.name}</h1>
                  <p className="text-xs text-[#6B6355]">
                    Prix carte : <strong className="text-[#2B2622]">{money(selectedProduct.price)} TTC</strong> (soit {money(selectedProduct.price / 1.1)} HT)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleProductAvailable?.(selectedProduct.id)}
                  className={`rf-tap px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedProduct.available
                      ? "bg-[#2E9E5B]/15 text-[#2E9E5B] hover:bg-[#2E9E5B]/25"
                      : "bg-[#C1361B]/15 text-[#C1361B] hover:bg-[#C1361B]/25"
                  }`}
                >
                  {selectedProduct.available ? "✅ En vente" : "🔴 Rupture forcée"}
                </button>
              </div>
            </div>

            {/* Cartes KPIs Financiers */}
            {financials && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 border border-black/10 shadow-xs">
                  <div className="flex items-center justify-between text-[#8A8378] text-[10px] font-bold uppercase tracking-wider">
                    <span>Coût Portion</span>
                    <Scale size={14} className="text-[#3E7CB1]" />
                  </div>
                  <p className="rf-display text-lg font-bold text-[#2B2622] mt-1">{money(financials.portionCost)}</p>
                  <p className="text-[10px] text-[#6B6355]">Food Cost matière</p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-black/10 shadow-xs">
                  <div className="flex items-center justify-between text-[#8A8378] text-[10px] font-bold uppercase tracking-wider">
                    <span>Marge Brute</span>
                    <DollarSign size={14} className="text-[#2E9E5B]" />
                  </div>
                  <p className="rf-display text-lg font-bold text-[#2E9E5B] mt-1">{money(financials.grossMarginHT)}</p>
                  <p className="text-[10px] text-[#6B6355]">Par plat vendu HT</p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-black/10 shadow-xs">
                  <div className="flex items-center justify-between text-[#8A8378] text-[10px] font-bold uppercase tracking-wider">
                    <span>Ratio Matière</span>
                    <Percent size={14} className={financials.status === "optimal" ? "text-[#2E9E5B]" : financials.status === "warning" ? "text-[#D9A441]" : "text-[#C1361B]"} />
                  </div>
                  <p
                    className="rf-display text-lg font-bold mt-1"
                    style={{
                      color:
                        financials.status === "optimal"
                          ? "#2E9E5B"
                          : financials.status === "warning"
                          ? "#B5793A"
                          : "#C1361B",
                    }}
                  >
                    {financials.foodCostRate}%
                  </p>
                  <p className="text-[10px] text-[#6B6355]">
                    {financials.status === "optimal"
                      ? "🟢 Rentabilité optimale"
                      : financials.status === "warning"
                      ? "🟡 Marge standard"
                      : "🔴 Marge critique"}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-3 border border-black/10 shadow-xs">
                  <div className="flex items-center justify-between text-[#8A8378] text-[10px] font-bold uppercase tracking-wider">
                    <span>Stock Réalisable</span>
                    <Sparkles size={14} className="text-[#C1440E]" />
                  </div>
                  <p className="rf-display text-lg font-bold text-[#2B2622] mt-1">{financials.minPortions} portions</p>
                  <p className="text-[10px] text-[#6B6355]">Selon ingrédients critiques</p>
                </div>
              </div>
            )}

            {/* Tableau des Ingrédients de la Recette */}
            <div className="bg-white rounded-2xl border border-black/10 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-black/[.02] border-b border-black/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#2B2622]">Composition de la recette</h3>
                  <p className="text-[11px] text-[#6B6355]">Ingrédients décomptés à chaque envoi en cuisine</p>
                </div>
                <button
                  onClick={handleAddItem}
                  className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#C1440E] shadow-xs"
                >
                  <Plus size={13} /> Ajouter un ingrédient
                </button>
              </div>

              <div className="overflow-x-auto rf-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/10 text-[#8A8378] font-bold uppercase tracking-wider bg-black/[.01]">
                      <th className="py-2.5 px-3">Ingrédient</th>
                      <th className="py-2.5 px-3 w-28">Dosage</th>
                      <th className="py-2.5 px-3 w-24">Unité</th>
                      <th className="py-2.5 px-3">Coût unitaire</th>
                      <th className="py-2.5 px-3">Sous-total HT</th>
                      <th className="py-2.5 px-3 text-center">Critique</th>
                      <th className="py-2.5 px-3">Remarques</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {activeItems.map((item, idx) => {
                      const ing = ingredients.find((i) => i.id === item.ingredientId);
                      const cost = ing?.costPerUnit || 0;
                      const lineCost = toStockQty(parseFloat(item.quantity) || 0, item.unit, ing?.unit) * cost;

                      return (
                        <tr key={item.id || idx} className="hover:bg-black/[.01]">
                          <td className="py-2.5 px-3">
                            <select
                              className="w-full p-1.5 rounded-lg border border-black/15 bg-white text-xs font-semibold focus:outline-none focus:border-[#C1440E]"
                              value={item.ingredientId}
                              onChange={(e) => handleUpdateItem(idx, "ingredientId", e.target.value)}
                            >
                              {ingredients.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.category})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-black/15 bg-white text-xs font-bold text-center focus:outline-none focus:border-[#C1440E]"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-[#6B6355] font-medium">
                            {/* Dosage dans une unité de la même famille que le stock (g pour un stock en kg…) */}
                            <select
                              value={item.unit || ing?.unit || "u"}
                              onChange={(e) => handleUpdateItem(idx, "unit", e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-black/15 bg-white text-[11px] font-semibold text-center"
                            >
                              {[...new Set([item.unit || ing?.unit, ...compatibleUnits(ing?.unit)].filter(Boolean))].map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B6355]">
                            {cost > 0 ? `${money(cost)} / ${ing?.unit}` : "0 €"}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#2B2622]">{money(lineCost)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.isCritical ?? true}
                              onChange={(e) => handleUpdateItem(idx, "isCritical", e.target.checked)}
                              title="Si coché, une rupture de cet ingrédient désactivera le plat"
                              className="w-4 h-4 accent-[#C1440E]"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              placeholder="Notes…"
                              value={item.notes || ""}
                              onChange={(e) => handleUpdateItem(idx, "notes", e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-black/10 bg-transparent text-xs focus:outline-none focus:bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="rf-tap p-1.5 rounded-lg text-[#C1361B] hover:bg-[#C1361B]/10"
                              title="Supprimer la ligne"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {activeItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-[#8A8378]">
                          Ce plat ne possède pas encore de fiche technique. Cliquez sur "Ajouter un ingrédient" pour le composer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barre de sauvegarde */}
              {draftItems !== null && (
                <div className="p-3 bg-[#C1440E]/5 border-t border-[#C1440E]/20 flex items-center justify-between">
                  <span className="text-xs text-[#C1440E] font-semibold flex items-center gap-1.5">
                    <Info size={14} /> Modifications non enregistrées
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDraftItems(null)}
                      className="rf-tap px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 hover:bg-black/10"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSave}
                      className="rf-tap px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#C1440E] shadow-xs hover:opacity-95"
                    >
                      Enregistrer la fiche technique
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-black/10 p-12 text-center text-[#8A8378]">
            Sélectionnez un plat dans la colonne de gauche pour afficher et éditer sa fiche technique.
          </div>
        )}
      </div>
    </div>
  );
}
