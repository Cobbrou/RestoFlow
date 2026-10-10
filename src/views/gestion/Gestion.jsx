import { useState, useMemo } from "react";
import { Table2, Package, LayoutList, Plus, Pencil, Trash2, Lock, Users, Ban, Receipt, CreditCard, Banknote, Wallet, ShieldCheck, Boxes, FileSpreadsheet, Printer } from "lucide-react";
import { CATEGORIES } from "../../data/categories.js";
import { isAvailable, money, deduplicateHistory, parseOptionsText, formatOptionsText } from "../../utils/index.js";
import Modal, { Field, inputCls } from "../../components/Modal.jsx";
import { uid } from "../../data/seed.js";
import StaffRoleManager from "./StaffRoleManager.jsx";
import StockManager from "./StockManager.jsx";
import RecipeManager from "./RecipeManager.jsx";
import CaisseSettingsManager from "./CaisseSettingsManager.jsx";
import ClosingManager from "./ClosingManager.jsx";
import ModulesManager from "./ModulesManager.jsx";
import ThermalReceiptPreview from "../../components/ThermalReceiptPreview.jsx";

import { hasPermission } from "../../utils/permissions.js";
import { useRestoFlow } from "../../context/RestoFlowContext.jsx";
import { getSocket } from "../../services/socket.js";
import { useModules } from "../../hooks/useModules.js";
import { SlidersHorizontal } from "lucide-react";

/**
 * Gestion — Back-office avec 9 sous-vues :
 *  - tables        : gestion du plan de salle (CRUD + réservations)
 *  - produits      : catalogue produits (CRUD + disponibilité)
 *  - menus         : menus composés (CRUD)
 *  - stocks        : gestion des stocks, inventaire et alertes (Phase 2)
 *  - recettes      : fiches techniques et calcul du food cost (Phase 2)
 *  - historique    : historique des paiements encaissés
 *  - clotures      : clôtures journalières Z, lecture X, audit NF525 et FEC (Phase 7)
 *  - caisse_params : mentions légales, imprimantes ESC/POS et codes promo (Phase 3)
 *  - equipe        : rôles, permissions et membres du personnel
 */
export default function Gestion(props) {
  let ctx = {};
  try {
    ctx = useRestoFlow() || {};
  } catch {
    ctx = {};
  }
  const merged = { ...ctx, ...props };
  const { hasStocks } = useModules();
  const { view, setView, currentStaff, roles } = merged;

  const tabs = [
    { id: "tables",        label: "Tables",               icon: Table2 },
    { id: "produits",      label: "Produits",             icon: Package },
    { id: "menus",         label: "Menus",                icon: LayoutList },
    ...(hasStocks ? [
      { id: "stocks",        label: "Stocks",               icon: Boxes },
      { id: "recettes",      label: "Fiches & Coûts",       icon: FileSpreadsheet },
    ] : []),
    { id: "historique",    label: "Historique",           icon: Receipt },
    { id: "clotures",      label: "Clôtures & Fiscalité", icon: Lock },
    { id: "caisse_params", label: "Caisse & Imprimantes", icon: Printer },
    { id: "modules",       label: "Modules & Options",    icon: SlidersHorizontal },
    { id: "equipe",        label: "Équipe & Rôles",       icon: ShieldCheck },
  ];

  const currentRoleObj = roles?.find((r) => r.id === currentStaff?.roleId);

  const canAccessSubtab = (tabId) => {
    if (!currentStaff) return false;
    if (currentStaff.roleId === "admin") return true;
    switch (tabId) {
      case "tables":        return hasPermission(currentStaff, currentRoleObj, "gestion.tables");
      case "produits":      return hasPermission(currentStaff, currentRoleObj, "gestion.products");
      case "menus":         return hasPermission(currentStaff, currentRoleObj, "gestion.menus");
      case "stocks":        return hasStocks && hasPermission(currentStaff, currentRoleObj, "gestion.stocks");
      case "recettes":      return hasStocks && hasPermission(currentStaff, currentRoleObj, "gestion.recipes");
      case "historique":    return hasPermission(currentStaff, currentRoleObj, "caisse.history");
      case "clotures":      return hasPermission(currentStaff, currentRoleObj, "caisse.close") || hasPermission(currentStaff, currentRoleObj, "caisse.history");
      case "caisse_params": return hasPermission(currentStaff, currentRoleObj, "caisse.settings");
      case "modules":       return hasPermission(currentStaff, currentRoleObj, "caisse.settings");
      case "equipe":        return hasPermission(currentStaff, currentRoleObj, "gestion.staff");
      default:              return false;
    }
  };

  const visibleTabs = tabs.filter((t) => canAccessSubtab(t.id));

  // Auto-redirection si la vue active n'est pas autorisée
  if (visibleTabs.length > 0 && !canAccessSubtab(view)) {
    setView(visibleTabs[0].id);
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Gestion</h1>
          <p className="text-sm text-[#6B6355]">Tables, catalogue produits, stocks, fiches techniques, historique, clôtures et équipe</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-black/5 flex-wrap">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button key={t.id} onClick={() => setView(t.id)}
                className="rf-tap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
                style={{ background: active ? "#2B2622" : "transparent", color: active ? "#FAF6EE" : "#5B5346" }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "tables"        && <TableManager {...merged} />}
      {view === "produits"      && <ProductManager {...merged} />}
      {view === "menus"         && <MenuManager {...merged} />}
      {view === "stocks"        && <StockManager {...merged} />}
      {view === "recettes"      && <RecipeManager {...merged} />}
      {view === "historique"    && (
        <HistoryManager
          history={merged.history || []}
          config={merged.config}
          pushToast={merged.pushToast}
          canRefund={hasPermission(currentStaff, roles?.find((r) => r.id === currentStaff?.roleId), "caisse.settings")}
        />
      )}
      {view === "clotures"      && <ClosingManager {...merged} />}
      {view === "caisse_params" && <CaisseSettingsManager config={merged.config} onUpdateConfig={merged.onUpdateConfig} pushToast={merged.pushToast} />}
      {view === "modules"       && <ModulesManager config={merged.config} onUpdateModules={merged.onUpdateModules} pushToast={merged.pushToast} />}
      {view === "equipe"        && <StaffRoleManager {...merged} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TABLES
══════════════════════════════════════════════════════════════ */

function TableManager({ tables, orders, onAddTable, onUpdateTable, onDeleteTable }) {
  const [editing, setEditing] = useState(null);
  const nextNumber = (Math.max(0, ...tables.map((t) => t.number)) || 0) + 1;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing("new")}
          className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#C1440E" }}>
          <Plus size={15} /> Ajouter une table
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {tables.map((t) => {
          const busy = orders.some((o) => o.tableId === t.id);
          return (
            <div key={t.id} className="rounded-xl border border-black/10 bg-white p-3.5">
              <div className="flex items-center justify-between mb-1">
                <span className="rf-black text-lg text-[#2B2622]">Table {t.number}</span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t)} className="rf-tap p-1.5 rounded-full bg-black/5"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteTable(t.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B]" title={busy ? "Commande en cours" : "Supprimer"}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#8A8378] flex items-center gap-1"><Users size={11} />{t.seats} places</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {busy && <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-[#5B5346]">Commande active</span>}
              </div>

              {t.reserved ? (
                <div className="mt-2 rounded-lg p-2 space-y-0.5" style={{ background: "#5B534614" }}>
                  <p className="text-[10px] font-extrabold flex items-center gap-1" style={{ color: "#5B5346" }}>
                    <Lock size={10} /> RÉSERVÉE
                  </p>
                  {(t.reservationName || t.reservationPeople || t.reservationTime) && (
                    <p className="text-[11px] text-[#5B5346]">
                      {t.reservationName || "—"}{t.reservationPeople ? ` · ${t.reservationPeople} pers.` : ""}{t.reservationTime ? ` · ${t.reservationTime}` : ""}
                    </p>
                  )}
                  {t.reservationNote && <p className="text-[10px] text-[#8A8378] italic">{t.reservationNote}</p>}
                  <div className="flex gap-2 pt-0.5">
                    <button onClick={() => setEditing(t)} className="rf-tap text-[10px] font-semibold text-[#3E7CB1]">Modifier</button>
                    <button onClick={() => onUpdateTable(t.id, { reserved: false, reservationName: "", reservationPeople: "", reservationTime: "", reservationNote: "" })}
                      className="rf-tap text-[10px] font-semibold text-[#C1361B]">Annuler la réservation</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing({ ...t, reserved: true })}
                  className="rf-tap mt-2 text-[10px] font-semibold text-[#3E7CB1] flex items-center gap-1">
                  <Lock size={10} /> Réserver cette table
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <TableForm
          table={editing === "new" ? null : editing}
          defaultNumber={nextNumber}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") onAddTable(data);
            else onUpdateTable(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TableForm({ table, defaultNumber, onCancel, onSave }) {
  const [number,          setNumber]          = useState(table?.number          ?? defaultNumber);
  const [seats,           setSeats]           = useState(table?.seats           ?? 2);
  const [x,               setX]               = useState(table?.x               ?? 50);
  const [y,               setY]               = useState(table?.y               ?? 50);
  const [reserved,        setReserved]        = useState(table?.reserved        ?? false);
  const [reservationName, setReservationName] = useState(table?.reservationName ?? "");
  const [reservationPeople, setReservationPeople] = useState(table?.reservationPeople ?? "");
  const [reservationTime, setReservationTime] = useState(table?.reservationTime ?? "");
  const [reservationNote, setReservationNote] = useState(table?.reservationNote ?? "");

  return (
    <Modal title={table ? `Modifier la table ${table.number}` : "Nouvelle table"} onClose={onCancel}>
      <Field label="Numéro de table">
        <input type="number" min={1} className={inputCls} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
      </Field>
      <Field label="Nombre de places">
        <input type="number" min={1} max={20} className={inputCls} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Position horizontale (${x}%)`}>
          <input type="range" min={4} max={94} value={x} onChange={(e) => setX(Number(e.target.value))} className="w-full" />
        </Field>
        <Field label={`Position verticale (${y}%)`}>
          <input type="range" min={4} max={90} value={y} onChange={(e) => setY(Number(e.target.value))} className="w-full" />
        </Field>
      </div>
      <label className="flex items-center gap-2 mb-3 text-sm text-[#5B5346]">
        <input type="checkbox" checked={reserved} onChange={(e) => setReserved(e.target.checked)} /> Table réservée
      </label>
      {reserved && (
        <div className="rounded-xl border border-black/10 p-3 mb-4 bg-black/[.02]">
          <Field label="Nom de la réservation">
            <input className={inputCls} value={reservationName} onChange={(e) => setReservationName(e.target.value)} placeholder="Ex : Famille Dubois" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre de personnes">
              <input type="number" min={1} className={inputCls} value={reservationPeople} onChange={(e) => setReservationPeople(e.target.value)} />
            </Field>
            <Field label="Heure de réservation">
              <input type="time" className={inputCls} value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (optionnel)">
            <input className={inputCls} value={reservationNote} onChange={(e) => setReservationNote(e.target.value)} placeholder="Ex : anniversaire, chaise bébé…" />
          </Field>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button
          onClick={() => onSave({
            number, seats, x, y, reserved,
            reservationName:   reserved ? reservationName.trim()  : "",
            reservationPeople: reserved ? reservationPeople       : "",
            reservationTime:   reserved ? reservationTime         : "",
            reservationNote:   reserved ? reservationNote.trim()  : "",
          })}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "#C1440E" }}
        >
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRODUITS
══════════════════════════════════════════════════════════════ */

function ProductManager({ products, ingredients, recipes, onAddProduct, onUpdateProduct, onDeleteProduct }) {
  const [editing,   setEditing]   = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");
  const shown = filterCat ? products.filter((p) => p.cat === filterCat) : products;

  const getProductStockInfo = (product) => {
    const prodRecipes = recipes?.filter((r) => r.productId === product.id) || [];
    if (prodRecipes.length === 0) return { tracked: false, portions: null };

    let minPossible = Infinity;
    let criticalCount = 0;
    for (const rc of prodRecipes) {
      if (rc.isCritical && rc.quantity > 0) {
        criticalCount++;
        const ing = ingredients?.find((i) => i.id === rc.ingredientId);
        const currentStock = ing ? ing.currentStock : rc.currentStock ?? 0;
        const possible = Math.floor(currentStock / rc.quantity);
        if (possible < minPossible) {
          minPossible = Math.max(0, possible);
        }
      }
    }
    const portions = minPossible === Infinity ? null : minPossible;
    return { tracked: true, portions, recipeCount: prodRecipes.length, criticalCount };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat(null)}
            className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: filterCat === null ? "#2B2622" : "rgba(0,0,0,.05)", color: filterCat === null ? "#FAF6EE" : "#5B5346" }}>
            Tous ({products.length})
          </button>
          {realCats.map((c) => {
            const count = products.filter((p) => p.cat === c.id).length;
            return (
              <button key={c.id} onClick={() => setFilterCat(c.id)}
                className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: filterCat === c.id ? c.accent : "rgba(0,0,0,.05)", color: filterCat === c.id ? "#FAF6EE" : "#5B5346" }}>
                {c.name} ({count})
              </button>
            );
          })}
        </div>
        <button onClick={() => setEditing("new")}
          className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0"
          style={{ background: "#C1440E" }}>
          <Plus size={15} /> Ajouter un produit
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((p) => {
          const cat = CATEGORIES.find((c) => c.id === p.cat);
          const available = isAvailable(p);
          const stockInfo = getProductStockInfo(p);

          return (
            <div key={p.id} className="rounded-xl border border-black/10 bg-white p-3 flex gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: (cat?.accent || "#999") + "22", filter: available ? "none" : "grayscale(1)" }}>
                {p.emoji || "🍽️"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-[#2B2622] leading-tight truncate">{p.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(p)} className="rf-tap p-1 rounded-full bg-black/5" title="Modifier"><Pencil size={12} /></button>
                    <button onClick={() => onDeleteProduct(p.id)} className="rf-tap p-1 rounded-full bg-black/5 text-[#C1361B]" title="Supprimer"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[11px] text-[#8A8378] leading-snug line-clamp-1">{p.desc || "Aucune description"}</p>

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs font-bold text-[#2B2622]">{money(p.price)}</span>
                  {stockInfo.tracked ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      stockInfo.portions === 0
                        ? "bg-[#C1361B]/10 text-[#C1361B]"
                        : stockInfo.portions <= 5
                        ? "bg-[#D9A441]/15 text-[#B5793A]"
                        : "bg-[#2E9E5B]/10 text-[#2E9E5B]"
                    }`}>
                      <Boxes size={10} />
                      {stockInfo.portions === 0 ? "Épuisé (0 en stock)" : `${stockInfo.portions} portion${stockInfo.portions > 1 ? "s" : ""}`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#8A8378] italic">Stock non suivi</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: available ? "#4A785622" : "#C1361B22", color: available ? "#4A7856" : "#C1361B" }}>
                    {available ? "EN VENTE" : <><Ban size={9} /> RUPTURE</>}
                  </span>
                  <button onClick={() => onUpdateProduct(p.id, { available: !available })} className="rf-tap text-[10px] font-semibold text-[#3E7CB1]">
                    {available ? "Marquer rupture" : "Remettre en vente"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-[#9A917E] col-span-3 text-center py-8">Aucun produit dans cette catégorie.</p>}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={realCats}
          recipes={recipes}
          ingredients={ingredients}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") onAddProduct(data);
            else onUpdateProduct(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, recipes, ingredients, onCancel, onSave }) {
  const [name,           setName]           = useState(product?.name           ?? "");
  const [cat,            setCat]            = useState(product?.cat            ?? categories[0]?.id);
  const [price,          setPrice]          = useState(product?.price          ?? "");
  const [happyHourPrice, setHappyHourPrice] = useState(product?.happyHourPrice ?? "");
  const [desc,           setDesc]           = useState(product?.desc           ?? "");
  const [emoji,          setEmoji]          = useState(product?.emoji          ?? "🍽️");
  const [allergens,      setAllergens]      = useState((product?.allergens     ?? []).join(", "));
  const [available,      setAvailable]      = useState(product ? isAvailable(product) : true);
  const [optionsText,    setOptionsText]    = useState(formatOptionsText(product?.options ?? []));
  const parsedOptions = parseOptionsText(optionsText);

  // Détection si le produit a déjà un suivi direct ou une recette
  const existingRecipes = recipes?.filter((r) => r.productId === product?.id) || [];
  const isDirectRecipe = existingRecipes.length === 1 && existingRecipes[0].quantity === 1 && existingRecipes[0].unit === "piece";
  const directIng = isDirectRecipe ? ingredients?.find((i) => i.id === existingRecipes[0].ingredientId) : null;

  // Mode de stock: "direct" | "recipe" | "none"
  const [stockMode, setStockMode] = useState(() => {
    if (!product) return "direct"; // Par défaut à la création : suivi direct simple recommandé !
    if (isDirectRecipe) return "direct";
    if (existingRecipes.length > 0) return "recipe";
    return "none";
  });

  const [initialStock, setInitialStock] = useState(directIng?.currentStock ?? 20);
  const [minThreshold, setMinThreshold] = useState(directIng?.minThreshold ?? 5);
  const [costPerUnit,  setCostPerUnit]  = useState(directIng?.costPerUnit ?? "");

  const valid = name.trim() && price !== "" && !isNaN(Number(price));

  return (
    <Modal title={product ? "Modifier le produit" : "Nouveau produit"} onClose={onCancel} wide>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du produit">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Burger Classic, Bière Blonde, Tiramisu…" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Catégorie">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Prix standard (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Prix Happy Hour (€, opt.)">
          <input type="number" step="0.5" min={0} className={inputCls} value={happyHourPrice} onChange={(e) => setHappyHourPrice(e.target.value)} placeholder="Optionnel" />
        </Field>
      </div>

      <Field label="Description courte">
        <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : Bœuf charolais, cheddar affiné, oignons confits" />
      </Field>

      <Field label="Allergènes (séparés par des virgules)">
        <input className={inputCls} value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="Ex : Gluten, Lait" />
      </Field>

      <Field label="Options & suppléments (un groupe par ligne)">
        <textarea
          className={inputCls + " font-mono text-xs"}
          rows={3}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder={"Cuisson* : Bleu, Saignant, À point, Bien cuit\nSuppléments (max 2) : Bacon +2, Œuf +1.5"}
        />
        <p className="text-[10px] text-[#8A8378] mt-1">
          « * » = choix obligatoire · « (max N) » = nombre de choix · « +2 » = supplément en €.
          {parsedOptions.length > 0 && ` Reconnu : ${parsedOptions.map((g) => `${g.name} (${g.choices.length} choix${g.required ? ", obligatoire" : ""})`).join(" · ")}`}
        </p>
      </Field>

      {/* ── Section Suivi de Stock Unifiée ── */}
      <div className="p-3.5 rounded-xl border border-black/10 bg-black/[.02] space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[#2B2622] block">
            📦 Suivi du Stock & Inventaire
          </label>
          <p className="text-[11px] text-[#8A8378]">
            Définissez comment ce produit est approvisionné et décompté
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setStockMode("direct")}
            className="rf-tap p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between"
            style={{
              borderColor: stockMode === "direct" ? "#C1440E" : "rgba(0,0,0,0.1)",
              background: stockMode === "direct" ? "#C1440E10" : "white",
            }}
          >
            <span className="font-bold text-[#2B2622]">🥤 Stock Direct Unitaire</span>
            <span className="text-[10px] text-[#6B6355] mt-1">1 portion = 1 unité (Boissons, bières, desserts prêts, revente)</span>
          </button>

          <button
            type="button"
            onClick={() => setStockMode("recipe")}
            className="rf-tap p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between"
            style={{
              borderColor: stockMode === "recipe" ? "#C1440E" : "rgba(0,0,0,0.1)",
              background: stockMode === "recipe" ? "#C1440E10" : "white",
            }}
          >
            <span className="font-bold text-[#2B2622]">🍳 Fiche Technique</span>
            <span className="text-[10px] text-[#6B6355] mt-1">Plat cuisiné complexe avec plusieurs ingrédients</span>
          </button>

          <button
            type="button"
            onClick={() => setStockMode("none")}
            className="rf-tap p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col justify-between"
            style={{
              borderColor: stockMode === "none" ? "#C1440E" : "rgba(0,0,0,0.1)",
              background: stockMode === "none" ? "#C1440E10" : "white",
            }}
          >
            <span className="font-bold text-[#2B2622]">⚪ Aucun Suivi</span>
            <span className="text-[10px] text-[#6B6355] mt-1">Produit toujours disponible, sans décompte</span>
          </button>
        </div>

        {stockMode === "direct" && (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Field label={product ? "Stock actuel (portions)" : "Stock initial (portions)"}>
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                placeholder="Ex : 24"
              />
            </Field>
            <Field label="Seuil d'alerte mini">
              <input
                type="number"
                min="1"
                step="1"
                className={inputCls}
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                placeholder="Ex : 5"
              />
            </Field>
            <Field label="Coût d'achat HT (€, opt.)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder="Ex : 0.85"
              />
            </Field>
          </div>
        )}

        {stockMode === "recipe" && (
          <p className="text-[11px] text-[#5B5346] bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
            ℹ️ Vous pourrez composer la fiche technique (ingrédients, dosages et coûts matière) dans l'onglet <strong>Fiches & Coûts</strong>.
          </p>
        )}
      </div>

      <Field label="Disponibilité immédiate">
        <div className="flex gap-2">
          <button type="button" onClick={() => setAvailable(true)}
            className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: available ? "#4A7856" : "rgba(0,0,0,.05)", color: available ? "#FAF6EE" : "#5B5346" }}>
            En vente
          </button>
          <button type="button" onClick={() => setAvailable(false)}
            className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
            style={{ background: !available ? "#C1361B" : "rgba(0,0,0,.05)", color: !available ? "#FAF6EE" : "#5B5346" }}>
            <Ban size={12} /> Rupture de stock
          </button>
        </div>
      </Field>

      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid}
          onClick={() => onSave({
            name: name.trim(), cat, price: Number(price),
            happyHourPrice: happyHourPrice !== "" && !isNaN(Number(happyHourPrice)) ? Number(happyHourPrice) : null,
            desc: desc.trim(),
            emoji: emoji || "🍽️",
            allergens: allergens.split(",").map((s) => s.trim()).filter(Boolean),
            options: parsedOptions,
            available,
            directStock: stockMode === "direct",
            initialStock: Number(initialStock) || 0,
            minThreshold: Number(minThreshold) || 5,
            costPerUnit: costPerUnit !== "" && !isNaN(Number(costPerUnit)) ? Number(costPerUnit) : 0,
          })}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   MENUS
══════════════════════════════════════════════════════════════ */

function MenuManager({ products, menus, onAddMenu, onUpdateMenu, onDeleteMenu }) {
  const [editing, setEditing] = useState(null);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setEditing("new")}
          className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#C1440E" }}>
          <Plus size={15} /> Créer un menu
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {menus.map((m) => {
          const groups = m.groups || [];
          return (
            <div key={m.id} className="rounded-xl border border-black/10 bg-white p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.emoji || "📋"}</span>
                  <span className="rf-display text-base font-semibold text-[#2B2622]">{m.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-bold text-[#C1440E] mr-1">{money(m.price)}</span>
                  <button onClick={() => setEditing(m)} className="rf-tap p-1.5 rounded-full bg-black/5"><Pencil size={13} /></button>
                  <button onClick={() => onDeleteMenu(m.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B]"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="space-y-1">
                {groups.length === 0 && <span className="text-xs text-[#9A917E]">Aucune étape de choix configurée</span>}
                {groups.map((g) => {
                  const opts = g.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
                  return (
                    <div key={g.id} className="text-[11px] text-[#5B5346]">
                      <span className="font-semibold text-[#6B4226]">{g.title}</span>
                      {" "}({g.count} au choix parmi {opts.length}) : {opts.map((p) => p.name).join(", ") || "—"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {menus.length === 0 && <p className="text-sm text-[#9A917E] col-span-2 text-center py-8">Aucun menu configuré.</p>}
      </div>

      {editing && (
        <MenuForm
          menu={editing === "new" ? null : editing}
          products={products}
          onCancel={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") onAddMenu(data);
            else onUpdateMenu(editing.id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MenuForm({ menu, products, onCancel, onSave }) {
  const [name,   setName]   = useState(menu?.name   ?? "");
  const [price,  setPrice]  = useState(menu?.price  ?? "");
  const [emoji,  setEmoji]  = useState(menu?.emoji  ?? "📋");
  const [desc,   setDesc]   = useState(menu?.desc   ?? "");
  const [groups, setGroups] = useState(
    menu?.groups ?? [{ id: uid("grp"), title: "Entrée", count: 1, productIds: [] }]
  );
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");

  // Validation stricte : chaque groupe doit avoir au moins autant de produits que le nombre de choix requis
  const valid =
    name.trim() &&
    price !== "" &&
    !isNaN(Number(price)) &&
    groups.length > 0 &&
    groups.every((g) => g.title.trim() && g.count >= 1 && g.productIds.length >= g.count);

  const addGroup = () => {
    setGroups((prev) => [...prev, { id: uid("grp"), title: `Étape ${prev.length + 1}`, count: 1, productIds: [] }]);
  };

  const updateGroup = (id, patch) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
  };

  const removeGroup = (id) => setGroups((prev) => prev.filter((g) => g.id !== id));

  const toggleProduct = (groupId, productId) => {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      const ids = g.productIds.includes(productId)
        ? g.productIds.filter((id) => id !== productId)
        : [...g.productIds, productId];
      return { ...g, productIds: ids };
    }));
  };

  return (
    <Modal title={menu ? "Modifier le menu" : "Nouveau menu"} onClose={onCancel} wide>
      <div className="grid grid-cols-[64px_1fr_120px] gap-3 mb-2">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du menu">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Menu Burger" />
        </Field>
        <Field label="Prix (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="Description (optionnelle)">
        <input className={inputCls + " mb-2"} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : Entrée + Plat + Boisson" />
      </Field>
      <p className="text-[11px] text-[#8A8378] mb-3">
        Composez le menu en étapes de choix (ex. «&nbsp;Entrée&nbsp;» au choix parmi plusieurs plats). Le serveur devra sélectionner une option par étape avant d'ajouter le menu à la commande.
      </p>

      {/* Groupes de choix */}
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.id} className="border border-black/10 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <input value={g.title} onChange={(e) => updateGroup(g.id, { title: e.target.value })}
                placeholder="Ex : Entrée" className={inputCls + " flex-1 font-semibold"} />
              <label className="flex items-center gap-1.5 text-xs text-[#6B6355] shrink-0">
                Choix
                <input type="number" min={1} max={Math.max(1, g.productIds.length)} value={g.count}
                  onChange={(e) => updateGroup(g.id, { count: Math.max(1, Number(e.target.value)) })}
                  className="w-14 px-2 py-1.5 rounded-lg border border-black/15 text-sm outline-none text-center" />
              </label>
              {groups.length > 1 && (
                <button onClick={() => removeGroup(g.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B] shrink-0"><Trash2 size={13} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[180px] overflow-y-auto rf-scrollbar pr-1">
              {realCats.map((c) => {
                const catProducts = products.filter((p) => p.cat === c.id);
                return catProducts.map((p) => {
                  const checked = g.productIds.includes(p.id);
                  return (
                    <button type="button" key={p.id} onClick={() => toggleProduct(g.id, p.id)}
                      className="rf-tap flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg border text-xs"
                      style={{ borderColor: checked ? "#C1440E" : "rgba(0,0,0,.1)", background: checked ? "#C1440E12" : "white" }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: checked ? "#C1440E" : "rgba(0,0,0,.08)" }}>
                        {checked && <span style={{ color: "white", fontSize: 10, fontWeight: 900 }}>✓</span>}
                      </span>
                      <span className="flex-1 truncate">{p.emoji} {p.name}</span>
                    </button>
                  );
                });
              })}
            </div>
            {g.count > g.productIds.length && (
              <p className="text-[10px] text-[#C1361B] mt-1.5">Sélectionnez au moins {g.count} produit(s) pour cette étape.</p>
            )}
          </div>
        ))}
      </div>
      <button onClick={addGroup}
        className="rf-tap w-full mt-3 py-2 rounded-xl text-xs font-semibold bg-black/5 flex items-center justify-center gap-1.5">
        <Plus size={14} /> Ajouter une étape de choix
      </button>

      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid}
          onClick={() => onSave({ name: name.trim(), price: Number(price), emoji: emoji || "📋", desc: desc.trim(), groups })}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   HISTORIQUE DES PAIEMENTS
══════════════════════════════════════════════════════════════ */

const METHOD_ICONS  = { carte: CreditCard, especes: Banknote, autre: Wallet, partage: Users };
const METHOD_LABELS = { carte: "Carte",    especes: "Espèces", autre: "Autre",  partage: "Partagé" };

function HistoryManager({ history, config, pushToast, canRefund }) {
  const [search,               setSearch]               = useState("");
  const [refundReason,         setRefundReason]         = useState("");
  const [refundBusy,           setRefundBusy]           = useState(false);
  const [methodFilter,         setMethodFilter]         = useState(null);
  const [detailId,             setDetailId]             = useState(null);
  const [thermalPreviewDetail, setThermalPreviewDetail] = useState(null);

  const deduped  = useMemo(() => deduplicateHistory(history), [history]);
  const sorted   = [...deduped].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = sorted.filter((h) => {
    const matchSearch  = !search || String(h.tableNumber ?? "").includes(search) ||
      (h.server || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.orderId || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.ticketNumber || "").toLowerCase().includes(search.toLowerCase());
    const matchMethod = !methodFilter || h.paymentMethod === methodFilter;
    return matchSearch && matchMethod;
  });

  const totalCA = filtered.reduce((s, h) => s + h.total, 0);
  const detail  = detailId ? deduped.find((h) => h.id === detailId) : null;
  // Tickets déjà annulés par un avoir
  const refundedTickets = useMemo(
    () => new Set(deduped.filter((h) => h.type === "CREDIT_NOTE").map((h) => h.refTicketNumber)),
    [deduped]
  );
  const canRefundDetail =
    canRefund && detail && detail.type !== "CREDIT_NOTE" && detail.signature && !refundedTickets.has(detail.ticketNumber);

  // Avoir NF525 : le ticket d'origine reste intact, un ticket négatif signé l'annule
  const emitRefund = () => {
    const socket = getSocket();
    if (!socket?.connected) {
      pushToast?.("Avoir impossible hors-ligne : reconnectez la caisse au serveur", "warn");
      return;
    }
    setRefundBusy(true);
    socket.emit("history:refund", { historyId: detail.id, reason: refundReason }, (res) => {
      setRefundBusy(false);
      if (res?.ok) {
        pushToast?.(`Avoir ${res.history.ticketNumber} émis (annule ${detail.ticketNumber})`, "server");
        setRefundReason("");
        setDetailId(res.history.id);
      } else {
        pushToast?.(res?.error || "Échec de l'émission de l'avoir", "warn");
      }
    });
  };

  return (
    <div>
      {/* Barre de filtres */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
          <Receipt size={14} className="text-[#8A8378]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche par table, serveur…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#9A917E]"
          />
        </div>
        <div className="flex gap-1">
          {[null, "carte", "especes", "partage", "autre"].map((m) => {
            const Icon   = m ? METHOD_ICONS[m] : Receipt;
            const active = methodFilter === m;
            return (
              <button key={m ?? "all"} onClick={() => setMethodFilter(m)}
                className="rf-tap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: active ? "#2B2622" : "rgba(0,0,0,.05)", color: active ? "#FAF6EE" : "#5B5346" }}>
                <Icon size={12} /> {m ? METHOD_LABELS[m] : "Tous"}
              </button>
            );
          })}
        </div>
        <div className="text-sm font-bold text-[#2B2622] shrink-0">
          {filtered.length} paiement{filtered.length !== 1 ? "s" : ""} · {money(totalCA)}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[#9A917E] text-center py-12">Aucun paiement dans l'historique.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => {
            const date       = new Date(h.createdAt);
            const MethodIcon = METHOD_ICONS[h.paymentMethod] || Wallet;
            return (
              <div key={h.id}
                className="rf-tap rounded-xl border border-black/10 bg-white px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-black/25"
                onClick={() => setDetailId(h.id)}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#C1440E18" }}>
                  <MethodIcon size={16} style={{ color: "#C1440E" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rf-mono text-xs font-bold text-[#2B2622]">
                      {h.tableNumber ? `Table ${h.tableNumber}` : "—"}
                    </span>
                    {h.server && <span className="text-[11px] text-[#8A8378]">· {h.server}</span>}
                    {h.type === "CREDIT_NOTE" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#C1361B15", color: "#C1361B" }}>AVOIR</span>
                    )}
                    {refundedTickets.has(h.ticketNumber) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#2B262212", color: "#8A8378" }}>Annulé</span>
                    )}
                    <span className="text-[10px] text-[#9A917E] ml-auto shrink-0">
                      {date.toLocaleDateString("fr-FR")} {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[#5B5346]">
                      {h.items?.length ?? 0} article{(h.items?.length ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#2B262212", color: "#5B5346" }}>
                      {METHOD_LABELS[h.paymentMethod] || (h.paymentMethod ?? "—")}
                    </span>
                  </div>
                </div>
                <span className="rf-mono text-base font-bold text-[#2B2622] shrink-0">{money(h.total)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détail paiement */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setDetailId(null)}>
          <div className="rf-anim-pop bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto rf-scrollbar shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
              <h3 className="rf-display text-lg font-semibold text-[#2B2622]">
                Ticket — {detail.tableNumber ? `Table ${detail.tableNumber}` : "—"}
              </h3>
              <button onClick={() => setDetailId(null)} className="rf-tap p-1.5 rounded-full bg-black/5 text-lg leading-none">×</button>
            </div>
            <div className="p-5 rf-ticket">
              <div className="text-center mb-3">
                <p className="rf-black text-lg tracking-wide">{config?.name || "RESTOFLOW BISTROT"}</p>
                {config?.siret && <p className="text-[9px] opacity-70">SIRET : {config.siret}</p>}
                <p className="text-[10px] opacity-70">Ticket de caisse & Facture</p>
              </div>
              <div className="rf-mono text-[11px] space-y-0.5 mb-2">
                <div className="flex justify-between font-bold text-[#2B2622]">
                  <span>{detail.type === "CREDIT_NOTE" ? "Avoir N°" : "Facture N°"}</span>
                  <span>{detail.ticketNumber || `FAC-${new Date(detail.createdAt).getFullYear()}-${(detail.orderId || detail.id).slice(-4).toUpperCase()}`}</span>
                </div>
                {detail.type === "CREDIT_NOTE" && (
                  <>
                    <div className="flex justify-between font-bold text-[#C1361B]"><span>Annule</span><span>{detail.refTicketNumber}</span></div>
                    <div className="flex justify-between gap-3"><span>Motif</span><span className="text-right">{detail.reason}</span></div>
                  </>
                )}
                {detail.tableNumber && <div className="flex justify-between"><span>Table</span><span>{detail.tableNumber}</span></div>}
                <div className="flex justify-between"><span>Commande</span><span>#{(detail.orderId || detail.id).slice(-4).toUpperCase()}</span></div>
                <div className="flex justify-between"><span>Date</span><span>{new Date(detail.createdAt).toLocaleDateString("fr-FR")}</span></div>
                <div className="flex justify-between"><span>Heure</span><span>{new Date(detail.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
                {detail.server && <div className="flex justify-between"><span>Serveur</span><span>{detail.server}</span></div>}
              </div>
              <div className="border-t border-dashed border-black/30 my-2" />
              <div className="space-y-1">
                {(detail.items || []).map((it, idx) => (
                  <div key={it.id ?? idx} className="rf-mono text-[12px]">
                    <div className="flex justify-between gap-2">
                      <span className="flex-1">{it.qty} × {it.name}{it.options && <span className="block text-[10px] text-[#8A8378]">{it.options}</span>}</span>
                      <span>{money(it.price * it.qty)}</span>
                    </div>
                    <div className="text-[10px] opacity-60">{money(it.price)} / unité</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-black/30 my-2" />
              <div className="rf-mono text-[11px] flex justify-between opacity-80">
                <span>Sous-total brut</span>
                <span>{money(detail.subtotal != null ? detail.subtotal : detail.total)}</span>
              </div>
              {detail.discount && (
                <div className="rf-mono text-[11px] flex justify-between text-[#2E9E5B] font-bold">
                  <span>Remise {detail.discount.code ? `[${detail.discount.code}]` : ""}</span>
                  <span>-{money(detail.discount.amount)}</span>
                </div>
              )}
              <div className="rf-mono text-[14px] flex justify-between font-bold mt-1">
                <span>TOTAL TTC</span>
                <span>{money(detail.total)}</span>
              </div>
              {detail.paymentMethod && (
                <div className="rf-mono text-[11px] flex justify-between opacity-80 mt-1.5">
                  <span>Paiement</span><span>{METHOD_LABELS[detail.paymentMethod] || detail.paymentMethod}</span>
                </div>
              )}
              {detail.payments && detail.payments.length > 1 && (
                <div className="mt-3 pt-2 border-t border-dashed border-black/20">
                  <p className="rf-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                    Ventilation des règlements ({detail.payments.length}) :
                  </p>
                  <div className="space-y-1">
                    {detail.payments.map((p, idx) => (
                      <div key={p.id || idx} className="rf-mono text-[11px] flex justify-between">
                        <span className="opacity-80">• {p.label} ({METHOD_LABELS[p.method] || p.method})</span>
                        <span className="font-bold">{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-center text-xs mt-4 opacity-80">Merci et à bientôt !</p>
            </div>
            {canRefundDetail && (
              <div className="px-5 pb-3">
                <p className="text-xs font-bold text-[#2B2622] mb-1.5">Annuler ce ticket par un avoir</p>
                <div className="flex gap-2">
                  <input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Motif obligatoire (ex : erreur d'encaissement)"
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-black/15 outline-none"
                  />
                  <button
                    onClick={emitRefund}
                    disabled={refundBusy || refundReason.trim().length < 3}
                    className="rf-tap px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                    style={{ background: "#C1361B" }}
                  >
                    Émettre l'avoir
                  </button>
                </div>
              </div>
            )}
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setDetailId(null)} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Fermer</button>
              <button
                onClick={() => setThermalPreviewDetail(detail)}
                className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5"
                style={{ background: "#C1440E" }}
              >
                <Printer size={15} />
                <span>Format Thermique ESC/POS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prévisualisation thermique */}
      {thermalPreviewDetail && (
        <ThermalReceiptPreview
          receipt={thermalPreviewDetail}
          config={config}
          defaultTab="caisse"
          onClose={() => setThermalPreviewDetail(null)}
        />
      )}
    </div>
  );
}
