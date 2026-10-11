import { useNow } from "../../hooks/index.js";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  ArrowLeft, Search, Plus, Minus, X, StickyNote,
  AlertTriangle, Check, LayoutList, Ban, Receipt, Tag, Sparkles,
  ArrowRightLeft, Merge, BellRing
} from "lucide-react";
import { CATEGORIES } from "../../data/categories.js";
import { isAvailable, noteIndicatesAllergy, elapsed, money, isHappyHourActive, getProductEffectivePrice, resolveOptions, resolveMenuOptions, isOffPremise, orderLabel, formatPickup } from "../../utils/index.js";
import Modal from "../../components/Modal.jsx";
import PaymentModal from "./PaymentModal.jsx";
import DiscountModal from "./DiscountModal.jsx";
import ThermalReceiptPreview from "../../components/ThermalReceiptPreview.jsx";
import { useModules } from "../../hooks/useModules.js";
import { hasPermission } from "../../utils/permissions.js";
import { toStockQty } from "../../utils/units.js";

const TableActionModal = lazy(() => import("../../components/TableActionModal.jsx"));

export const COURSE_META = {
  direct:  { label: "Direct",  emoji: "⚡", color: "#2E9E5B" },
  entree:  { label: "Entrée",  emoji: "🥗", color: "#B5451B" },
  plat:    { label: "Plat",    emoji: "🥩", color: "#8B5E34" },
  dessert: { label: "Dessert", emoji: "🍰", color: "#B5793A" },
  boisson: { label: "Boisson", emoji: "🍸", color: "#3E7CB1" },
};

const COURSE_CYCLE = ["entree", "plat", "dessert", "boisson", "direct"];

/* ─────────────────────────────────────────────────────────────
   OrderTaking — Écran de prise de commande (côté serveur)
   ───────────────────────────────────────────────────────────── */

export default function OrderTaking({
  table, order, products, isMobile,
  recipes = [], ingredients = [], config = {},
  tables = [], orders = [],
  currentStaff, roles = [],
  onToggleProductAvailable,
  onBack, onAdd, onAddComposedMenu,
  onQty, onRemove, onVoid, onNote, onSetCovers,
  onSend, onServe, onCheckout, onPartialCheckout, onCancelOrder, onBackToPlan, onToast,
  onApplyDiscount, onRemoveDiscount,
  onCallCourse,
  onChangeItemCourse,
  onTransferTable,
  onMergeTable,
}) {
  const now = useNow();
  const { hasSuites: suitesModule, hasStocks, hasDiscounts } = useModules();
  // Dernière commande connue : le libellé reste juste après l'encaissement (commande retirée, ticket affiché)
  const lastOrderRef = useRef(order);
  if (order) lastOrderRef.current = order;
  const offPremise = isOffPremise(lastOrderRef.current);
  const hasSuites = suitesModule && !offPremise; // Hors salle : pas de suites
  const title = table ? `Table ${table.number}` : orderLabel(lastOrderRef.current);
  const subtitle = [
    order ? `Ouverte ${elapsed(order.createdAt, now)}` : "Nouvelle commande",
    order?.pickupAt && `Retrait ${formatPickup(order.pickupAt)}`,
    order?.channel === "phone" && "Téléphone",
    order?.customerPhone,
  ].filter(Boolean).join(" · ");
  const isHeadWaiterOrAdmin = currentStaff?.roleId === "head_waiter" || currentStaff?.roleId === "admin";
  const [activeCat, setActiveCat]     = useState(CATEGORIES[0].id);
  const [query, setQuery]             = useState("");
  const [noteFor, setNoteFor]         = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [mobileTab, setMobileTab]     = useState("menu");   // "menu" | "commande"
  const [composerMenu, setComposerMenu] = useState(null);
  const [optionsFor, setOptionsFor] = useState(null); // produit à options (cuisson, suppléments)
  const [paying, setPaying]           = useState(false);
  const [receipt, setReceipt]         = useState(null);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [kitchenPrintModal, setKitchenPrintModal] = useState(false);
  const [tableActionModal, setTableActionModal] = useState(null); // "transfer" | "merge" | null
  const [voidTarget, setVoidTarget] = useState(null); // article envoyé à annuler
  // Même droit que les avoirs, revérifié par le serveur
  const canVoid = hasPermission(currentStaff, roles.find((r) => r.id === currentStaff?.roleId), "caisse.close");

  // 🪟 Axe 6 : Détection de clôture ou encaissement concurrent par un autre terminal
  const initialOrderIdRef = useRef(order?.id);
  const checkedOutHereRef = useRef(false); // Encaissée sur ce terminal : on reste pour afficher le ticket
  useEffect(() => {
    // Si la commande initiale qui a ouvert cet écran n'existe plus ou est fermée
    if (initialOrderIdRef.current && !checkedOutHereRef.current && (!order || order.status === "closed")) {
      onToast?.(`⚠️ ${title} a été encaissée ou libérée sur un autre terminal`, "warn");
      onBackToPlan?.();
    }
  }, [order, title, onToast, onBackToPlan]);

  const items        = order?.items || [];
  const draftItems   = items.filter((i) => i.status === "draft");
  const sentItems    = items.filter((i) => i.status !== "draft");
  const subtotal     = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);

  const discount = order?.discount;
  const discountAmount = discount
    ? (discount.amount != null
        ? discount.amount
        : discount.type === "percent"
        ? Math.round(subtotal * (discount.value / 100) * 100) / 100
        : Math.min(subtotal, discount.value || 0))
    : 0;

  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const draftTotal   = draftItems.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
  const readyItems   = items.filter((i) => i.status === "ready");
  const hasReady     = readyItems.length > 0;
  const allServedNoDraft = items.length > 0 && items.every((i) => i.status === "served");
  // Vente comptoir : pas d'envoi en cuisine, les articles saisis s'encaissent directement
  const isCounter = order?.type === "counter";
  const payableOrder = isCounter && order
    ? { ...order, items: items.map((i) => (i.status === "draft" ? { ...i, status: "served" } : i)) }
    : order;

  const filtered = products.filter(
    (p) =>
      (activeCat ? p.cat === activeCat : true) &&
      (query ? (p.name + p.desc).toLowerCase().includes(query.toLowerCase()) : true)
  );

  const getPortionsAvailable = (product) => {
    if (!isAvailable(product)) return 0;
    if (product.isMenu) {
      const groups = product.groups || [];
      if (groups.length === 0) return null;
      for (const g of groups) {
        const availableOptions = (g.productIds || []).filter((id) => {
          const item = products.find((prod) => prod.id === id);
          return item && isAvailable(item) && getPortionsAvailable(item) !== 0;
        });
        if (availableOptions.length < (g.count || 1)) {
          return 0;
        }
      }
      return null;
    }
    const prodRecipes = recipes.filter((r) => r.productId === product.id);
    if (!prodRecipes || prodRecipes.length === 0) return null;
    let minPossible = Infinity;
    for (const rc of prodRecipes) {
      if (rc.isCritical && rc.quantity > 0) {
        const ing = ingredients.find((i) => i.id === rc.ingredientId);
        const currentStock = ing ? ing.currentStock : rc.currentStock ?? 0;
        const possible = Math.floor(currentStock / toStockQty(rc.quantity, rc.unit, ing?.unit ?? rc.stockUnit));
        if (possible < minPossible) {
          minPossible = Math.max(0, possible);
        }
      }
    }
    return minPossible === Infinity ? null : minPossible;
  };

  const handleProductTap = (p) => {
    const portions = hasStocks ? getPortionsAvailable(p) : null;
    const outOfStock = !isAvailable(p) || (hasStocks && portions === 0);

    if (outOfStock) {
      if (isHeadWaiterOrAdmin) {
        if (confirm(`Le produit "${p.name}" est en rupture. En tant que responsable de salle, souhaitez-vous le remettre en vente ?`)) {
          onToggleProductAvailable?.(p.id);
        }
      } else {
        onToast?.(`⛔ ${p.name} est en rupture de stock. Contactez le responsable de salle pour modifier la disponibilité.`, "warn");
      }
      return;
    }
    if (p.isMenu) setComposerMenu(p);
    else if (p.options?.length) setOptionsFor(p);
    else onAdd(p);
  };

  const isHH = isHappyHourActive(config, new Date(now || Date.now()));

  // ── Panneau gauche : catalogue ─────────────────────────────
  const menuPanel = (
    <div className="flex flex-col min-h-0 h-full">
      {/* Bannière Happy Hour si actif */}
      {isHH && (
        <div className="bg-[#C1440E10] border-b border-[#C1440E25] px-3.5 py-2 flex items-center justify-between text-xs text-[#C1440E]">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles size={14} className="animate-pulse" />
            <span>Happy Hour en cours (jusqu'à {config?.happyHourConfig?.endTime || "20:00"})</span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#C1440E15]">
            -{config?.happyHourConfig?.discountPercent || 20}% sur les boissons
          </span>
        </div>
      )}

      {/* Recherche */}
      <div className="p-3 border-b border-black/10 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
          <Search size={15} className="text-[#8A8378]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-[#9A917E]"
          />
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto rf-scrollbar border-b border-black/10">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{
              background: activeCat === c.id ? c.accent : "rgba(0,0,0,.05)",
              color:      activeCat === c.id ? "#FAF6EE" : "#5B5346",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grille de produits */}
      <div className={`flex-1 overflow-y-auto rf-scrollbar p-3 grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            isMobile={isMobile}
            portionsLeft={hasStocks ? getPortionsAvailable(p) : null}
            config={config}
            now={now}
            canManageAvailability={isHeadWaiterOrAdmin}
            onToggleAvailability={() => onToggleProductAvailable?.(p.id)}
            onTap={() => handleProductTap(p)}
          />
        ))}
        {filtered.length === 0 && (
          <p className={`text-sm text-[#9A917E] text-center py-8 ${isMobile ? "" : "col-span-2"}`}>Aucun produit trouvé.</p>
        )}
      </div>
    </div>
  );

  // ── Panneau droit : panier ─────────────────────────────────
  const cartPanel = (
    <div className="flex flex-col min-h-0 h-full bg-[#FFFDF7]">
      <div className="flex-1 overflow-y-auto rf-scrollbar p-3 space-y-4">
        {sentItems.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8378] mb-1.5">Déjà envoyé</p>
            <div className="space-y-1.5">
              {sentItems.map((it) => (
                <SentLine key={it.id} item={it} products={products} hasSuites={hasSuites} onVoid={canVoid && onVoid ? () => setVoidTarget(it) : null} />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8378] mb-1.5">
            {sentItems.length > 0 ? "Nouveaux articles" : "Commande"}
          </p>
          {draftItems.length === 0 && (
            <p className="text-sm text-[#9A917E] py-4 text-center">Ajoutez des produits depuis le menu.</p>
          )}
          <div className="space-y-2">
            {draftItems.map((it) => (
              <DraftItemRow
                key={it.id}
                item={it}
                isMobile={isMobile}
                products={products}
                hasSuites={hasSuites}
                noteOpen={noteFor === it.id}
                onToggleNote={() => setNoteFor(noteFor === it.id ? null : it.id)}
                onQty={(d) => onQty(it.id, d)}
                onRemove={() => onRemove(it.id)}
                onNote={(n) => { onNote(it.id, n); setNoteFor(null); }}
                onChangeCourse={(newCourse) => onChangeItemCourse?.(it.id, newCourse)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pied du panier */}
      <div className="border-t border-black/10 p-3.5 space-y-2 bg-white">
        <div className="flex justify-between text-xs text-[#5B5346]">
          <span>Sous-total brut</span>
          <span className="font-semibold">{money(subtotal)}</span>
        </div>

        {discount && (
          <div className="flex justify-between text-xs text-[#2E9E5B] font-bold items-center">
            <span className="flex items-center gap-1">
              <Sparkles size={12} />
              {discount.code ? `Remise [${discount.code}]` : "Remise"}
            </span>
            <span>-{money(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-extrabold text-[#2B2622] pt-1 border-t border-black/5">
          <span>Total TTC</span>
          <span>{money(total)}</span>
        </div>

        {/* Phase 4 : Gestion des Réclames de Suites */}
        {hasSuites && sentItems.filter((i) => i.course === "plat" && i.courseStatus === "held").length > 0 && (
          <button
            onClick={() => onCallCourse?.("plat")}
            className="rf-tap w-full py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm bg-[#D9A441] hover:bg-[#c29135]"
          >
            <BellRing size={14} />
            <span>🔔 Réclamer la suite : Plats ({sentItems.filter((i) => i.course === "plat" && i.courseStatus === "held").length})</span>
          </button>
        )}

        {hasSuites && sentItems.filter((i) => i.course === "dessert" && i.courseStatus === "held").length > 0 && (
          <button
            onClick={() => onCallCourse?.("dessert")}
            className="rf-tap w-full py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm bg-[#B5793A] hover:bg-[#9e672e]"
          >
            <BellRing size={14} />
            <span>🔔 Réclamer les Desserts ({sentItems.filter((i) => i.course === "dessert" && i.courseStatus === "held").length})</span>
          </button>
        )}

        {/* Bouton Remise & Codes Promo */}
        {hasDiscounts && items.length > 0 && (
          <button
            onClick={() => setDiscountModalOpen(true)}
            className="rf-tap w-full py-1.5 px-3 rounded-xl border border-black/15 bg-black/[.02] hover:bg-black/5 text-xs font-semibold text-[#5B5346] flex items-center justify-center gap-1.5"
          >
            <Tag size={13} className="text-[#C1440E]" />
            <span>{discount ? "Modifier la remise" : "Code promo / Remise"}</span>
          </button>
        )}

        {hasReady && (
          <button
            onClick={onServe}
            className="rf-tap w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-1.5 shadow-sm"
            style={{ background: "#2E9E5B" }}
          >
            <span>✅ Marquer comme servi ({readyItems.length})</span>
          </button>
        )}

        {draftItems.length > 0 && !confirmSend && !isCounter && (
          <button onClick={() => setConfirmSend(true)} className="rf-tap w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md" style={{ background: "#C1440E" }}>
            ENVOYER EN CUISINE
          </button>
        )}

        {confirmSend && (
          <div className="rounded-xl border border-[#C1440E]/30 bg-[#C1440E]/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-[#2B2622]">Confirmer l'envoi de {draftItems.length} article(s) en cuisine ?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSend(false)} className="rf-tap flex-1 py-2 rounded-lg text-xs font-semibold bg-black/5">Annuler</button>
              <button
                onClick={() => {
                  onSend();
                  setConfirmSend(false);
                  onToast?.("success", "Commande envoyée en cuisine avec succès.");
                }}
                className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1"
                style={{ background: "#C1440E" }}
              >
                <span>Confirmer</span>
              </button>
            </div>
          </div>
        )}

        {isCounter ? (
          items.length > 0 && (
            <button onClick={() => setPaying(true)} className="rf-tap w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 shadow-md" style={{ background: "#7C3AED" }}>
              <Receipt size={14} /> Encaisser · {money(total)}
            </button>
          )
        ) : allServedNoDraft ? (
          <button onClick={() => setPaying(true)} className="rf-tap w-full py-2.5 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm" style={{ background: "#2B2622" }}>
            <Receipt size={14} /> {table ? "Encaisser & libérer la table" : "Encaisser"}
          </button>
        ) : sentItems.length > 0 && draftItems.length === 0 ? (
          <button onClick={() => setPaying(true)} className="rf-tap w-full py-2 rounded-xl font-semibold text-xs text-[#2B2622] border border-[#2B2622]/20 bg-black/5 hover:bg-black/10 flex items-center justify-center gap-1.5">
            <Receipt size={14} /> Partager / Encaisser la note
          </button>
        ) : null}

        {/* Emporter / comptoir créé par erreur : annulable tant que rien n'est parti en cuisine ni encaissé */}
        {!table && order && onCancelOrder && sentItems.length === 0 && !(order.paidTotal > 0) && (
          <button
            onClick={() => {
              if (!window.confirm(`Annuler ${title} ?${items.length > 0 ? ` Les ${items.length} article(s) saisi(s) seront perdus.` : ""}`)) return;
              checkedOutHereRef.current = true; // pas d'alerte « libérée sur un autre terminal »
              onCancelOrder();
            }}
            className="rf-tap w-full py-2 rounded-xl font-semibold text-xs text-[#C1361B] bg-[#C1361B]/5 hover:bg-[#C1361B]/10"
          >
            Annuler cette commande
          </button>
        )}
      </div>
    </div>
  );

  // ── Composeur de menu ──────────────────────────────────────
  const composer = composerMenu && (
    <MenuComposer
      menu={composerMenu}
      products={products}
      getPortionsAvailable={getPortionsAvailable}
      onCancel={() => setComposerMenu(null)}
      onConfirm={(composition) => { onAddComposedMenu(composerMenu, composition); setComposerMenu(null); }}
    />
  ) || optionsFor && (
    <OptionPicker
      product={optionsFor}
      basePrice={getProductEffectivePrice(optionsFor, config)}
      onCancel={() => setOptionsFor(null)}
      onConfirm={(picks) => { onAdd(optionsFor, picks); setOptionsFor(null); }}
    />
  );

  // ── Flux paiement & Billetterie ────────────────────────────
  const paymentFlow = (
    <>
      {paying && order && (
        <PaymentModal
          order={payableOrder}
          table={table}
          config={config}
          onCancel={() => setPaying(false)}
          onPartialCheckout={onPartialCheckout}
          onConfirm={(method, payments, meta) => {
            checkedOutHereRef.current = true;
            const r = onCheckout(method, payments, meta);
            setPaying(false);
            setReceipt(r);
          }}
        />
      )}

      {voidTarget && (
        <VoidItemModal
          item={voidTarget}
          onCancel={() => setVoidTarget(null)}
          onConfirm={(qty, reason, done) =>
            onVoid(voidTarget.id, qty, reason, (ok) => {
              done();
              if (ok) setVoidTarget(null);
            })
          }
        />
      )}

      {receipt && (
        <ThermalReceiptPreview
          receipt={receipt}
          order={order}
          table={table}
          config={config}
          tpeData={receipt.tpeData}
          defaultTab="caisse"
          onClose={() => { setReceipt(null); onBackToPlan?.(); }}
        />
      )}

      {discountModalOpen && order && (
        <DiscountModal
          order={order}
          config={config}
          onApply={(disc) => {
            onApplyDiscount?.(order.id, disc);
            setDiscountModalOpen(false);
          }}
          onRemove={() => {
            onRemoveDiscount?.(order.id);
            setDiscountModalOpen(false);
          }}
          onClose={() => setDiscountModalOpen(false)}
        />
      )}

      {kitchenPrintModal && order && (
        <ThermalReceiptPreview
          order={order}
          table={table}
          config={config}
          defaultTab="cuisine"
          onClose={() => setKitchenPrintModal(false)}
        />
      )}

      {tableActionModal && (
        <Suspense fallback={null}>
          <TableActionModal
            isOpen={!!tableActionModal}
            initialMode={tableActionModal}
            sourceTable={table}
            tables={tables}
            orders={orders}
            onTransfer={(srcId, tgtId) => {
              onTransferTable?.(srcId, tgtId);
              setTableActionModal(null);
              onBackToPlan?.();
            }}
            onMerge={(srcId, tgtId) => {
              onMergeTable?.(srcId, tgtId);
              setTableActionModal(null);
              onBackToPlan?.();
            }}
            onClose={() => setTableActionModal(null)}
          />
        </Suspense>
      )}
    </>
  );

  // ── Rendu mobile ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-[640px]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-black/10">
          <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5 shrink-0"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="rf-display text-base font-semibold text-[#2B2622] truncate flex items-center gap-2">{title}{order && table && <CoversStepper covers={order.covers} onChange={onSetCovers} />}</h2>
            <p className="text-[11px] text-[#6B6355]">{subtitle}</p>
          </div>
          {order && table && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setTableActionModal("transfer")}
                className="rf-tap p-1.5 rounded-lg border border-black/15 bg-black/[.03] text-[#5B5346]"
                title="Transférer la table"
              >
                <ArrowRightLeft size={14} className="text-[#C1440E]" />
              </button>
              <button
                type="button"
                onClick={() => setTableActionModal("merge")}
                className="rf-tap p-1.5 rounded-lg border border-black/15 bg-black/[.03] text-[#5B5346]"
                title="Fusionner avec une autre table"
              >
                <Merge size={14} className="text-[#3E7CB1]" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-3 py-2 border-b border-black/10">
          <button onClick={() => setMobileTab("menu")} className="rf-tap py-2 rounded-xl text-xs font-bold"
            style={{ background: mobileTab === "menu" ? "#2B2622" : "rgba(0,0,0,.05)", color: mobileTab === "menu" ? "#FAF6EE" : "#5B5346" }}>
            Menu
          </button>
          <button onClick={() => setMobileTab("commande")} className="rf-tap py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: mobileTab === "commande" ? "#2B2622" : "rgba(0,0,0,.05)", color: mobileTab === "commande" ? "#FAF6EE" : "#5B5346" }}>
            Commande
            {items.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#C1440E", color: "#FAF6EE" }}>{items.length}</span>}
          </button>
        </div>

        <div className="flex-1 min-h-0 relative">
          {mobileTab === "menu" ? menuPanel : cartPanel}
          {mobileTab === "menu" && draftItems.length > 0 && (
            <button
              onClick={() => setMobileTab("commande")}
              className="rf-tap absolute bottom-3 left-3 right-3 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-between px-4"
              style={{ background: "#C1440E" }}
            >
              <span>{draftItems.length} article(s)</span>
              <span>Voir la commande · {money(draftTotal)}</span>
            </button>
          )}
        </div>
        {composer}
        {paymentFlow}
      </div>
    );
  }

  // ── Rendu desktop ──────────────────────────────────────────
  return (
    <div className="flex flex-col h-[640px]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5"><ArrowLeft size={16} /></button>
          <div>
            <h2 className="rf-display text-lg font-semibold text-[#2B2622] flex items-center gap-2">{title}{order && table && <CoversStepper covers={order.covers} onChange={onSetCovers} />}</h2>
            <p className="text-xs text-[#6B6355]">{subtitle}</p>
          </div>
        </div>
        {order && table && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTableActionModal("transfer")}
              className="rf-tap px-3 py-1.5 rounded-xl border border-black/15 bg-black/[.02] hover:bg-black/5 text-xs font-bold text-[#5B5346] flex items-center gap-1.5 shadow-2xs"
            >
              <ArrowRightLeft size={13} className="text-[#C1440E]" />
              <span>Transférer table</span>
            </button>
            <button
              type="button"
              onClick={() => setTableActionModal("merge")}
              className="rf-tap px-3 py-1.5 rounded-xl border border-black/15 bg-black/[.02] hover:bg-black/5 text-xs font-bold text-[#5B5346] flex items-center gap-1.5 shadow-2xs"
            >
              <Merge size={13} className="text-[#3E7CB1]" />
              <span>Fusionner tables</span>
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-[62%] flex flex-col border-r border-black/10 min-h-0">{menuPanel}</div>
        <div className="w-[38%] flex flex-col min-h-0">{cartPanel}</div>
      </div>
      {composer}
      {paymentFlow}
    </div>
  );
}

/* ── Sous-composants ─────────────────────────────────────────── */

function ProductCard({ p, isMobile, onTap, portionsLeft, config, now, canManageAvailability, onToggleAvailability }) {
  const cat = CATEGORIES.find((c) => c.id === p.cat);
  const baseAvailable = isAvailable(p);
  const isOutOfStock = !baseAvailable || portionsLeft === 0;

  const isHH = isHappyHourActive(config, new Date(now || Date.now()));
  const effectivePrice = getProductEffectivePrice(p, config, new Date(now || Date.now()));
  const hasHhDiscount = isHH && effectivePrice < p.price;

  return (
    <button
      onClick={onTap}
      className={`rf-tap rf-anim-pop relative text-left rounded-xl border bg-white ${isMobile ? "p-3.5" : "p-3"} flex gap-3 items-start ${!isOutOfStock ? "border-black/10 hover:border-black/25" : "border-[#C1361B]/30"}`}
      style={{ opacity: !isOutOfStock ? 1 : 0.6 }}
    >
      {isOutOfStock ? (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: "#C1361B", color: "#FFF7ED" }}>
            <Ban size={9} /> RUPTURE
          </span>
          {canManageAvailability && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleAvailability?.();
              }}
              title="Responsable de salle : Remettre en vente"
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/10 hover:bg-black/20 text-[#2B2622] font-bold cursor-pointer"
            >
              Remettre
            </span>
          )}
        </div>
      ) : portionsLeft !== null && portionsLeft <= 4 ? (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10">
          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs" style={{ background: "#D9A441", color: "#FFF7ED" }}>
            Plus que {portionsLeft}
          </span>
          {canManageAvailability && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onToggleAvailability?.();
              }}
              title="Responsable de salle : Basculer en rupture"
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/10 hover:bg-black/20 text-[#2B2622] font-bold cursor-pointer"
            >
              86
            </span>
          )}
        </div>
      ) : canManageAvailability ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onToggleAvailability?.();
          }}
          title="Responsable de salle : Marquer rupture (86)"
          className="absolute top-1.5 right-1.5 opacity-0 hover:opacity-100 text-[8px] px-1.5 py-0.5 rounded-full bg-black/10 text-[#5B5346] font-bold cursor-pointer transition-opacity z-10"
        >
          86
        </span>
      ) : null}
      <div className={`rounded-lg flex items-center justify-center shrink-0 ${isMobile ? "w-14 h-14 text-3xl" : "w-12 h-12 text-2xl"}`}
        style={{ background: (cat?.accent || "#999") + "22", filter: !isOutOfStock ? "none" : "grayscale(1)" }}>
        {p.emoji || "🍽️"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={`font-semibold text-[#2B2622] leading-tight ${isMobile ? "text-[15px]" : "text-sm"}`}>
            {p.name}
            {p.isMenu && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle" style={{ background: "#6B422622", color: "#6B4226" }}>MENU</span>}
          </span>
          {!isOutOfStock && (
            <span className={`rounded-full bg-[#2B2622] text-[#FAF6EE] flex items-center justify-center shrink-0 ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}>
              {p.isMenu ? <LayoutList size={isMobile ? 14 : 12} /> : <Plus size={isMobile ? 14 : 12} />}
            </span>
          )}
        </div>
        <p className={`text-[#8A8378] mt-0.5 leading-snug ${isMobile ? "text-xs" : "text-[11px]"}`}>{p.desc}</p>
        <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            {hasHhDiscount ? (
              <>
                <span className="line-through text-[#8A8378] text-[10px]">{money(p.price)}</span>
                <span className={`font-bold text-[#C1440E] ${isMobile ? "text-sm" : "text-xs"}`}>{money(effectivePrice)}</span>
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#C1440E15] text-[#C1440E]">
                  HAPPY HOUR
                </span>
              </>
            ) : (
              <span className={`font-bold text-[#2B2622] ${isMobile ? "text-sm" : "text-xs"}`}>{money(p.price)}</span>
            )}
          </div>
          {p.allergens?.length > 0 && <span className="text-[9px] text-[#B5451B]">{p.allergens.join(", ")}</span>}
        </div>
      </div>
    </button>
  );
}

// Couverts de la table, corrigeables pendant le service (statistiques du Z)
function CoversStepper({ covers, onChange }) {
  const set = (n) => n >= 1 && n <= 99 && onChange?.(n);
  const btn = "rf-tap w-6 h-6 rounded-full bg-black/5 text-sm font-bold leading-none";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B6355] shrink-0">
      <button type="button" className={btn} onClick={() => set((covers || 1) - 1)} aria-label="Retirer un couvert">−</button>
      <span className="min-w-[3.5rem] text-center">{covers ? `${covers} couv.` : "? couv."}</span>
      <button type="button" className={btn} onClick={() => set((covers || 0) + 1)} aria-label="Ajouter un couvert">+</button>
    </span>
  );
}

function DraftItemRow({ item, isMobile, products, hasSuites, noteOpen, onToggleNote, onQty, onRemove, onNote, onChangeCourse }) {
  const isAllergy = noteIndicatesAllergy(item.notes);
  const product = products?.find((p) => p.id === item.productId);
  const course = item.course || "direct";
  const courseMeta = COURSE_META[course] || COURSE_META.direct;

  return (
    <div className="rf-anim-pop rounded-lg border border-black/10 bg-white p-2.5">
      {isAllergy && <AllergyBadge item={item} product={product} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasSuites && (
            <button
              type="button"
              onClick={() => {
                const nextIdx = (COURSE_CYCLE.indexOf(course) + 1) % COURSE_CYCLE.length;
                onChangeCourse?.(COURSE_CYCLE[nextIdx]);
              }}
              title="Cliquer pour cadencer (Entrée / Plat / Dessert / Boisson / Direct)"
              className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 border border-black/10 hover:border-black/30 transition-colors shadow-2xs"
              style={{
                background: courseMeta.color + "18",
                color: courseMeta.color,
              }}
            >
              <span>{courseMeta.emoji}</span>
              <span>{courseMeta.label}</span>
            </button>
          )}
          <span className="text-sm font-semibold text-[#2B2622] truncate">{item.qty} × {item.name}</span>
        </div>
        <button onClick={onRemove} className="text-[#B5451B] shrink-0 p-0.5"><X size={isMobile ? 16 : 14} /></button>
      </div>
      {item.options && <p className="text-[11px] text-[#6B4226] mt-0.5">↳ {item.options}</p>}
      {item.isMenu && item.composition?.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {item.composition.map((g, i) => <p key={i} className="text-[11px] text-[#6B4226]">• {g.title} : {g.names.join(", ")}</p>)}
        </div>
      )}
      {item.notes && !isAllergy && (
        <p className="text-[11px] text-[#B5451B] mt-0.5 flex items-center gap-1"><StickyNote size={10} />{item.notes}</p>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onQty(-1)} className={`rf-tap rounded-full bg-black/5 flex items-center justify-center ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}><Minus size={isMobile ? 14 : 11} /></button>
          <span className="text-xs font-semibold w-4 text-center">{item.qty}</span>
          <button onClick={() => onQty(1)} className={`rf-tap rounded-full bg-black/5 flex items-center justify-center ${isMobile ? "w-8 h-8" : "w-6 h-6"}`}><Plus size={isMobile ? 14 : 11} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleNote} className="text-[10px] font-semibold text-[#3E7CB1]">Note</button>
          <span className="text-xs font-bold">{money(item.price * item.qty)}</span>
        </div>
      </div>
      {noteOpen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {["Sans oignons", "Cuisson saignante", "Sauce à part", "Sans fromage", "Allergie"].map((s) => (
            <button key={s} onClick={() => onNote(s)} className="rf-tap text-[10px] px-2 py-1 rounded-full bg-black/5">{s}</button>
          ))}
          <input
            placeholder="Note libre…"
            defaultValue={item.notes}
            onKeyDown={(e) => { if (e.key === "Enter") onNote(e.currentTarget.value); }}
            className="text-[11px] px-2 py-1 rounded-full bg-black/5 outline-none flex-1 min-w-[100px]"
          />
        </div>
      )}
    </div>
  );
}

function SentLine({ item, products, hasSuites, onVoid }) {
  const statusMap = {
    new:       { l: "envoyé", c: "#D9A441" },
    preparing: { l: "en préparation", c: "#3E7CB1" },
    ready:     { l: "prêt", c: "#2E9E5B" },
    served:    { l: "servi", c: "#8A8378" },
  };
  const meta = statusMap[item.status] || { l: item.status, c: "#8A8378" };
  const icon = item.status === "served" ? "✅" : item.status === "ready" ? "🟢" : item.status === "preparing" ? "🟠" : "⚪";
  const isAllergy = noteIndicatesAllergy(item.notes);
  const product = products?.find((p) => p.id === item.productId);
  const courseMeta = COURSE_META[item.course || "direct"];

  return (
    <div className="bg-black/[.03] rounded-lg px-2.5 py-1.5">
      {isAllergy && <AllergyBadge item={item} product={product} compact />}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#5B5346] min-w-0">
          {icon}
          {hasSuites && item.course && item.course !== "direct" && courseMeta && (
            <span
              className="text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0"
              style={{
                background: courseMeta.color + "20",
                color: courseMeta.color,
              }}
            >
              {courseMeta.emoji} {courseMeta.label}
            </span>
          )}
          <span className="truncate">{item.qty} × {item.name}{item.notes && !isAllergy ? ` (${item.notes})` : ""}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {hasSuites && item.courseStatus === "held" && item.status !== "served" && item.status !== "ready" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 animate-pulse">
              ⏸️ À réclamer
            </span>
          )}
          {hasSuites && item.courseStatus === "called" && item.status !== "served" && item.status !== "ready" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700">
              🔔 Réclamé
            </span>
          )}
          <span className="font-semibold" style={{ color: meta.c }}>{meta.l}</span>
          {onVoid && (
            <button
              type="button"
              onClick={onVoid}
              title="Annuler cet article (motif obligatoire)"
              aria-label={`Annuler ${item.name}`}
              className="rf-tap p-0.5 rounded text-[#B5451B] hover:bg-[#C1361B]/10"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {item.options && <p className="text-[10px] text-[#6B4226] mt-0.5 pl-5">↳ {item.options}</p>}
      {item.isMenu && item.composition?.length > 0 && (
        <div className="mt-1 pl-5 space-y-0.5">
          {item.composition.map((g, i) => <p key={i} className="text-[10px] text-[#8A8378]">• {g.title} : {g.names.join(", ")}</p>)}
        </div>
      )}
    </div>
  );
}

const VOID_REASONS = ["Erreur de saisie", "Client a changé d'avis", "Plat renvoyé", "Plat tombé / cassé", "Rupture en cuisine"];

function VoidItemModal({ item, onCancel, onConfirm }) {
  const [qty, setQty] = useState(item.qty);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 3;
  const restockHint =
    item.status === "new"
      ? "Pas encore commencé : les ingrédients seront réintégrés au stock."
      : "Déjà en préparation ou servi : la consommation de stock est conservée.";

  return (
    <Modal title={`Annuler : ${item.name}`} onClose={onCancel}>
      <div className="space-y-3">
        {item.qty > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#5B5346]">Quantité à annuler</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="rf-tap w-8 h-8 rounded-full bg-black/5 flex items-center justify-center" aria-label="Moins"><Minus size={14} /></button>
              <span className="text-sm font-bold w-10 text-center">{qty} / {item.qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(item.qty, q + 1))} className="rf-tap w-8 h-8 rounded-full bg-black/5 flex items-center justify-center" aria-label="Plus"><Plus size={14} /></button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {VOID_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rf-tap text-xs px-2.5 py-1 rounded-full"
              style={{ background: reason === r ? "#2B2622" : "rgba(0,0,0,.05)", color: reason === r ? "#FAF6EE" : "#5B5346" }}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Motif (obligatoire)"
          aria-label="Motif d'annulation"
          className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 outline-none focus:border-black/40"
        />
        <p className="text-[11px] text-[#8A8378]">{restockHint} L'annulation est tracée dans le journal fiscal.</p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="rf-tap px-3 py-2 rounded-lg text-sm font-semibold bg-black/5">Retour</button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => { setBusy(true); onConfirm(qty, reason.trim(), () => setBusy(false)); }}
            className="rf-tap px-3 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
            style={{ background: "#C1361B" }}
          >
            {busy ? "Annulation…" : `Annuler ${qty} article${qty > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AllergyBadge({ item, product, compact }) {
  const allergens = product?.allergens || [];
  return (
    <div
      className={`rounded-md font-extrabold uppercase tracking-wide flex flex-col gap-0.5 mb-1.5 ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"}`}
      style={{ background: "#C1361B", color: "#FFF7ED" }}
    >
      <span className="flex items-center gap-1">
        <AlertTriangle size={compact ? 11 : 13} /> ⚠ ALLERGIE{allergens.length ? ` — ${allergens.join(", ")}` : ""}
      </span>
      {item?.notes && <span className="font-semibold normal-case tracking-normal opacity-90">{item.notes}</span>}
    </div>
  );
}

/* ── Options produit (cuisson, suppléments) ────────────────── */

// Bascule un choix ; choix unique : on remplace, sinon on ajoute dans la limite du groupe
const togglePick = (prev, g, label) => {
  const mine = prev.filter((p) => p.group === g.name);
  if (mine.some((p) => p.choice === label)) return prev.filter((p) => !(p.group === g.name && p.choice === label));
  if (g.max === 1) return [...prev.filter((p) => p.group !== g.name), { group: g.name, choice: label }];
  return mine.length >= g.max ? prev : [...prev, { group: g.name, choice: label }];
};

const optionsComplete = (groups = [], picks = []) =>
  groups.every((g) => !g.required || picks.some((p) => p.group === g.name));

function OptionPicker({ product, basePrice, onCancel, onConfirm }) {
  const groups = product.options || [];
  const [picks, setPicks] = useState([]); // [{ group, choice }]
  const { extra } = resolveOptions(groups, picks);

  return (
    <Modal title={`${product.emoji || "🍽️"} ${product.name}`} onClose={onCancel}>
      <div className="max-h-[400px] overflow-y-auto rf-scrollbar pr-1">
        <OptionGroups groups={groups} picks={picks} onToggle={(g, label) => setPicks((prev) => togglePick(prev, g, label))} />
      </div>
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button
          type="button"
          disabled={!optionsComplete(groups, picks)}
          onClick={() => onConfirm(picks)}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}
        >
          Ajouter · {money(basePrice + extra)}
        </button>
      </div>
    </Modal>
  );
}

function OptionGroups({ groups, picks, onToggle }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const count = picks.filter((p) => p.group === g.name).length;
        return (
          <div key={g.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[#6B4226]">
                {g.name}{g.required && <span className="text-[#C1361B]"> *</span>}
              </span>
              <span className="text-[10px] text-[#9A917E]">
                {g.max === 1 ? (g.required ? "1 choix obligatoire" : "1 choix max") : `${count}/${g.max} max`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {g.choices.map((c) => {
                const on = picks.some((p) => p.group === g.name && p.choice === c.label);
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(g, c.label)}
                    className="rf-tap py-2.5 px-3 rounded-lg text-sm font-semibold flex items-center justify-between gap-2 border"
                    style={{ background: on ? "#2B2622" : "#fff", color: on ? "#FAF6EE" : "#2B2622", borderColor: on ? "#2B2622" : "rgba(0,0,0,.1)" }}
                  >
                    <span className="truncate">{c.label}</span>
                    {c.price > 0 && <span className="text-xs opacity-80 shrink-0">+{money(c.price)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Composeur de menu ─────────────────────────────────────── */

function MenuComposer({ menu, products, getPortionsAvailable, onCancel, onConfirm }) {
  const groups = menu.groups || [];
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(groups.map((g) => [g.id, []]))
  );

  const isProdAvailable = (p) => {
    if (!p || !isAvailable(p)) return false;
    if (getPortionsAvailable && getPortionsAvailable(p) === 0) return false;
    return true;
  };

  const toggle = (group, productId) => {
    const product = products.find((p) => p.id === productId);
    if (!isProdAvailable(product)) return;
    setSelections((prev) => {
      const cur = prev[group.id] || [];
      if (cur.includes(productId)) return { ...prev, [group.id]: cur.filter((id) => id !== productId) };
      if (group.count === 1)       return { ...prev, [group.id]: [productId] };
      if (cur.length >= group.count) return prev;
      return { ...prev, [group.id]: [...cur, productId] };
    });
  };

  // Options des composants choisis (cuisson du burger…), clé `${groupe}:${produit}`
  const [optPicks, setOptPicks] = useState({});
  const chosenWithOptions = (g) =>
    (selections[g.id] || []).map((id) => products.find((p) => p.id === id)).filter((p) => p?.options?.length);

  const complete =
    groups.length > 0 &&
    groups.every((g) => (selections[g.id]?.length || 0) === g.count) &&
    groups.every((g) => chosenWithOptions(g).every((p) => optionsComplete(p.options, optPicks[`${g.id}:${p.id}`])));

  const composition = groups.map((g) => {
    // Identifiants requis par le serveur pour décompter le stock de chaque composant
    const productIds = (selections[g.id] || []).filter((id) => products.some((p) => p.id === id));
    return {
      title: g.title,
      names: productIds.map((id) => products.find((p) => p.id === id).name),
      productIds,
      options: productIds.map((id) => optPicks[`${g.id}:${id}`] || []),
    };
  });
  const { extra } = resolveMenuOptions(composition, products);
  const confirm = () => onConfirm(composition);

  return (
    <Modal title={`Composer : ${menu.name}`} onClose={onCancel} wide>
      <p className="text-xs text-[#8A8378] mb-3">{money(menu.price)} — sélectionnez un choix pour chaque étape.</p>
      <div className="space-y-4 max-h-[380px] overflow-y-auto rf-scrollbar pr-1">
        {groups.map((g) => {
          const candidates = g.productIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
          const chosen = selections[g.id] || [];
          return (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[#6B4226]">{g.title}</span>
                <span className="text-[10px] text-[#9A917E]">{chosen.length}/{g.count} sélectionné(s)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {candidates.map((p) => {
                  const checked = chosen.includes(p.id);
                  const available = isProdAvailable(p);
                  const portions = getPortionsAvailable ? getPortionsAvailable(p) : null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(g, p.id)}
                      disabled={!available}
                      className="rf-tap flex items-center gap-2 text-left px-2.5 py-2.5 rounded-lg border text-xs disabled:cursor-not-allowed"
                      style={{
                        borderColor: checked ? "#C1440E" : "rgba(0,0,0,.1)",
                        background:  checked ? "#C1440E12" : available ? "white" : "#00000006",
                        opacity: available ? 1 : 0.55,
                      }}
                    >
                      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: checked ? "#C1440E" : "rgba(0,0,0,.08)" }}>
                        {checked && <Check size={11} color="white" />}
                      </span>
                      <span className="flex-1 truncate">{p.emoji} {p.name}</span>
                      {!available ? (
                        <span className="text-[8px] font-extrabold shrink-0" style={{ color: "#C1361B" }}>RUPTURE</span>
                      ) : portions !== null && portions <= 4 ? (
                        <span className="text-[8px] font-bold text-[#D9A441] shrink-0">Plus que {portions}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {chosenWithOptions(g).map((p) => {
                const key = `${g.id}:${p.id}`;
                return (
                  <div key={key} className="mt-2 p-2.5 rounded-lg bg-black/[.03]">
                    <p className="text-[11px] font-bold text-[#2B2622] mb-1.5">{p.emoji} {p.name}</p>
                    <OptionGroups
                      groups={p.options}
                      picks={optPicks[key] || []}
                      onToggle={(og, label) => setOptPicks((prev) => ({ ...prev, [key]: togglePick(prev[key] || [], og, label) }))}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!complete} onClick={confirm} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#C1440E" }}>
          Ajouter · {money(menu.price + extra)}
        </button>
      </div>
    </Modal>
  );
}


