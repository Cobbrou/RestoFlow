import { useState } from "react";
import {
  ArrowLeft, Search, Plus, Minus, X, StickyNote,
  AlertTriangle, Check, LayoutList, Ban, Receipt
} from "lucide-react";
import { CATEGORIES } from "../../data/categories.js";
import { isAvailable, noteIndicatesAllergy, elapsed, money } from "../../utils/index.js";
import Modal from "../../components/Modal.jsx";
import PaymentModal from "./PaymentModal.jsx";

/* ─────────────────────────────────────────────────────────────
   OrderTaking — Écran de prise de commande (côté serveur)
   ───────────────────────────────────────────────────────────── */

export default function OrderTaking({
  table, order, now, products, isMobile,
  recipes = [], ingredients = [],
  onBack, onAdd, onAddComposedMenu,
  onQty, onRemove, onNote,
  onSend, onServe, onCheckout, onBackToPlan, onToast,
}) {
  const [activeCat, setActiveCat]     = useState(CATEGORIES[0].id);
  const [query, setQuery]             = useState("");
  const [noteFor, setNoteFor]         = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [mobileTab, setMobileTab]     = useState("menu");   // "menu" | "commande"
  const [composerMenu, setComposerMenu] = useState(null);
  const [paying, setPaying]           = useState(false);
  const [receipt, setReceipt]         = useState(null);

  const items        = order?.items || [];
  const draftItems   = items.filter((i) => i.status === "draft");
  const sentItems    = items.filter((i) => i.status !== "draft");
  const total        = items.reduce((s, i) => s + i.price * i.qty, 0);
  const draftTotal   = draftItems.reduce((s, i) => s + i.price * i.qty, 0);
  const hasReady     = items.some((i) => i.status === "ready");
  const allServedNoDraft = items.length > 0 && items.every((i) => i.status === "served");

  const filtered = products.filter(
    (p) =>
      (activeCat ? p.cat === activeCat : true) &&
      (query ? (p.name + p.desc).toLowerCase().includes(query.toLowerCase()) : true)
  );

  const getPortionsAvailable = (product) => {
    if (!product.available) return 0;
    const prodRecipes = recipes.filter((r) => r.productId === product.id);
    if (!prodRecipes || prodRecipes.length === 0) return null;
    let minPossible = Infinity;
    for (const rc of prodRecipes) {
      if (rc.isCritical && rc.quantity > 0) {
        const ing = ingredients.find((i) => i.id === rc.ingredientId);
        const currentStock = ing ? ing.currentStock : rc.currentStock ?? 0;
        const possible = Math.floor(currentStock / rc.quantity);
        if (possible < minPossible) {
          minPossible = Math.max(0, possible);
        }
      }
    }
    return minPossible === Infinity ? null : minPossible;
  };

  const handleProductTap = (p) => {
    const portions = getPortionsAvailable(p);
    if (!isAvailable(p) || portions === 0) {
      onToast?.(`⛔ ${p.name} est en rupture de stock`, "warn");
      return;
    }
    if (p.isMenu) setComposerMenu(p);
    else onAdd(p);
  };

  // ── Panneau gauche : catalogue ─────────────────────────────
  const menuPanel = (
    <div className="flex flex-col min-h-0 h-full">
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
            portionsLeft={getPortionsAvailable(p)}
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
              {sentItems.map((it) => <SentLine key={it.id} item={it} products={products} />)}
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
                noteOpen={noteFor === it.id}
                onToggleNote={() => setNoteFor(noteFor === it.id ? null : it.id)}
                onQty={(d) => onQty(it.id, d)}
                onRemove={() => onRemove(it.id)}
                onNote={(n) => { onNote(it.id, n); setNoteFor(null); }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pied du panier */}
      <div className="border-t border-black/10 p-3.5 space-y-2 bg-white">
        <div className="flex justify-between text-sm text-[#5B5346]"><span>Sous-total</span><span>{money(total)}</span></div>
        <div className="flex justify-between text-base font-bold text-[#2B2622]"><span>Total</span><span>{money(total)}</span></div>

        {hasReady && (
          <button onClick={onServe} className="rf-tap w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: "#2E9E5B" }}>
            ✅ Marquer comme servi
          </button>
        )}

        {draftItems.length > 0 && !confirmSend && (
          <button onClick={() => setConfirmSend(true)} className="rf-tap w-full py-3.5 rounded-xl font-bold text-sm text-white shadow-md" style={{ background: "#C1440E" }}>
            ENVOYER EN CUISINE
          </button>
        )}

        {confirmSend && (
          <div className="rounded-xl border border-[#C1440E]/30 bg-[#C1440E]/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-[#2B2622]">Confirmer l'envoi de {draftItems.length} article(s) en cuisine ?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSend(false)} className="rf-tap flex-1 py-2 rounded-lg text-xs font-semibold bg-black/5">Annuler</button>
              <button onClick={() => { onSend(); setConfirmSend(false); }} className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#C1440E" }}>Confirmer</button>
            </div>
          </div>
        )}

        {allServedNoDraft ? (
          <button onClick={() => setPaying(true)} className="rf-tap w-full py-2.5 rounded-xl font-semibold text-xs text-white flex items-center justify-center gap-1.5 shadow-sm" style={{ background: "#2B2622" }}>
            <Receipt size={14} /> Encaisser & libérer la table
          </button>
        ) : sentItems.length > 0 && draftItems.length === 0 ? (
          <button onClick={() => setPaying(true)} className="rf-tap w-full py-2 rounded-xl font-semibold text-xs text-[#2B2622] border border-[#2B2622]/20 bg-black/5 hover:bg-black/10 flex items-center justify-center gap-1.5">
            <Receipt size={14} /> Partager / Encaisser la note
          </button>
        ) : null}
      </div>
    </div>
  );

  // ── Composeur de menu ──────────────────────────────────────
  const composer = composerMenu && (
    <MenuComposer
      menu={composerMenu}
      products={products}
      onCancel={() => setComposerMenu(null)}
      onConfirm={(composition) => { onAddComposedMenu(composerMenu, composition); setComposerMenu(null); }}
    />
  );

  // ── Flux paiement ──────────────────────────────────────────
  const paymentFlow = (
    <>
      {paying && order && (
        <PaymentModal
          order={order}
          table={table}
          onCancel={() => setPaying(false)}
          onConfirm={(method, payments) => {
            const r = onCheckout(method, payments);
            setPaying(false);
            setReceipt(r);
          }}
        />
      )}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => { setReceipt(null); onBackToPlan?.(); }} />
      )}
    </>
  );

  // ── Rendu mobile ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-[640px]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-black/10">
          <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5 shrink-0"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <h2 className="rf-display text-base font-semibold text-[#2B2622] truncate">Table {table.number} · {table.seats} pers.</h2>
            <p className="text-[11px] text-[#6B6355]">{order ? `Ouverte ${elapsed(order.createdAt, now)}` : "Nouvelle commande"}</p>
          </div>
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
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/10">
        <button onClick={onBack} className="rf-tap p-2 rounded-full bg-black/5"><ArrowLeft size={16} /></button>
        <div>
          <h2 className="rf-display text-lg font-semibold text-[#2B2622]">Table {table.number} — {table.seats} personnes</h2>
          <p className="text-xs text-[#6B6355]">{order ? `Ouverte ${elapsed(order.createdAt, now)}` : "Nouvelle commande"}</p>
        </div>
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

function ProductCard({ p, isMobile, onTap, portionsLeft }) {
  const cat = CATEGORIES.find((c) => c.id === p.cat);
  const baseAvailable = isAvailable(p);
  const isOutOfStock = !baseAvailable || portionsLeft === 0;
  return (
    <button
      onClick={onTap}
      className={`rf-tap rf-anim-pop relative text-left rounded-xl border bg-white ${isMobile ? "p-3.5" : "p-3"} flex gap-3 items-start ${!isOutOfStock ? "border-black/10 hover:border-black/25" : "border-[#C1361B]/30"}`}
      style={{ opacity: !isOutOfStock ? 1 : 0.6 }}
    >
      {isOutOfStock ? (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: "#C1361B", color: "#FFF7ED" }}>
          <Ban size={9} /> RUPTURE
        </span>
      ) : portionsLeft !== null && portionsLeft <= 4 ? (
        <span className="absolute top-1.5 right-1.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs" style={{ background: "#D9A441", color: "#FFF7ED" }}>
          Plus que {portionsLeft}
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
        <div className="flex items-center justify-between mt-1.5">
          <span className={`font-bold text-[#2B2622] ${isMobile ? "text-sm" : "text-xs"}`}>{money(p.price)}</span>
          {p.allergens?.length > 0 && <span className="text-[9px] text-[#B5451B]">{p.allergens.join(", ")}</span>}
        </div>
      </div>
    </button>
  );
}

function DraftItemRow({ item, isMobile, products, noteOpen, onToggleNote, onQty, onRemove, onNote }) {
  const isAllergy = noteIndicatesAllergy(item.notes);
  const product = products?.find((p) => p.id === item.productId);
  return (
    <div className="rf-anim-pop rounded-lg border border-black/10 bg-white p-2.5">
      {isAllergy && <AllergyBadge item={item} product={product} />}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#2B2622] flex-1">{item.qty} × {item.name}</span>
        <button onClick={onRemove} className="text-[#B5451B] shrink-0 p-0.5"><X size={isMobile ? 16 : 14} /></button>
      </div>
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

function SentLine({ item, products }) {
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
  return (
    <div className="bg-black/[.03] rounded-lg px-2.5 py-1.5">
      {isAllergy && <AllergyBadge item={item} product={product} compact />}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[#5B5346]">
          {icon} {item.qty} × {item.name}{item.notes && !isAllergy ? ` (${item.notes})` : ""}
        </span>
        <span className="font-semibold shrink-0 ml-2" style={{ color: meta.c }}>{meta.l}</span>
      </div>
      {item.isMenu && item.composition?.length > 0 && (
        <div className="mt-1 pl-5 space-y-0.5">
          {item.composition.map((g, i) => <p key={i} className="text-[10px] text-[#8A8378]">• {g.title} : {g.names.join(", ")}</p>)}
        </div>
      )}
    </div>
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

/* ── Composeur de menu ─────────────────────────────────────── */

function MenuComposer({ menu, products, onCancel, onConfirm }) {
  const groups = menu.groups || [];
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(groups.map((g) => [g.id, []]))
  );

  const toggle = (group, productId) => {
    const product = products.find((p) => p.id === productId);
    if (!isAvailable(product)) return;
    setSelections((prev) => {
      const cur = prev[group.id] || [];
      if (cur.includes(productId)) return { ...prev, [group.id]: cur.filter((id) => id !== productId) };
      if (group.count === 1)       return { ...prev, [group.id]: [productId] };
      if (cur.length >= group.count) return prev;
      return { ...prev, [group.id]: [...cur, productId] };
    });
  };

  const complete = groups.length > 0 && groups.every((g) => (selections[g.id]?.length || 0) === g.count);

  const confirm = () => {
    const composition = groups.map((g) => ({
      title: g.title,
      names: (selections[g.id] || []).map((id) => products.find((p) => p.id === id)?.name).filter(Boolean),
    }));
    onConfirm(composition);
  };

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
                  const available = isAvailable(p);
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
                      {!available && <span className="text-[8px] font-extrabold shrink-0" style={{ color: "#C1361B" }}>RUPTURE</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!complete} onClick={confirm} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#C1440E" }}>
          Ajouter à la commande
        </button>
      </div>
    </Modal>
  );
}

/* ── Encaissement & Reçus ──────────────────────────────────── */

function ReceiptModal({ receipt, onClose }) {
  const date = new Date(receipt.paidAt);
  const isSplit = receipt.payments && receipt.payments.length > 1;
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(-1); // -1: Global, >=0: individual

  const activePayment = selectedPaymentIndex >= 0 ? receipt.payments[selectedPaymentIndex] : null;

  const methodLabelMap = {
    carte: "Carte bancaire",
    especes: "Espèces",
    autre: "Autre",
    partage: "Addition partagée",
  };

  const getMethodLabel = (m) => methodLabelMap[m] || m || "—";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6" onClick={onClose}>
      <div className="rf-anim-pop bg-white rounded-2xl w-full max-w-sm max-h-[88vh] flex flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Onglets de sélection de ticket si paiement partagé */}
        {isSplit && (
          <div className="p-2 border-b border-black/10 bg-[#FAF6EE] flex items-center gap-1 overflow-x-auto rf-scrollbar">
            <button
              onClick={() => setSelectedPaymentIndex(-1)}
              className={`rf-tap px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedPaymentIndex === -1
                  ? "bg-[#2B2622] text-white"
                  : "bg-black/5 text-[#5B5346] hover:bg-black/10"
              }`}
            >
              Ticket Global
            </button>
            {receipt.payments.map((p, idx) => (
              <button
                key={p.id || idx}
                onClick={() => setSelectedPaymentIndex(idx)}
                className={`rf-tap px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedPaymentIndex === idx
                    ? "bg-[#2B2622] text-white"
                    : "bg-black/5 text-[#5B5346] hover:bg-black/10"
                }`}
              >
                {p.label || `Part ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto rf-scrollbar p-5">
          <div id="rf-print-receipt" className="rf-ticket">
            <div className="text-center mb-3">
              <p className="rf-black text-lg tracking-wide">RESTOFLOW</p>
              <p className="text-[10px] opacity-70">
                {activePayment ? `Reçu individuel — ${activePayment.label}` : "Ticket de caisse"}
              </p>
            </div>

            <div className="rf-mono text-[11px] space-y-0.5 mb-2">
              <div className="flex justify-between"><span>Table</span><span>{receipt.tableNumber ?? "—"}</span></div>
              <div className="flex justify-between"><span>Commande</span><span>#{receipt.orderId.slice(-4).toUpperCase()}</span></div>
              <div className="flex justify-between"><span>Date</span><span>{date.toLocaleDateString("fr-FR")}</span></div>
              <div className="flex justify-between"><span>Heure</span><span>{date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex justify-between"><span>Serveur</span><span>{receipt.server}</span></div>
              {activePayment && (
                <div className="flex justify-between font-bold text-[#2B2622]">
                  <span>Convive / Part</span><span>{activePayment.label}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-black/30 my-2" />

            {/* Articles */}
            <div className="space-y-1">
              {activePayment && activePayment.items && activePayment.items.length > 0 ? (
                activePayment.items.map((it, idx) => (
                  <div key={idx} className="rf-mono text-[12px]">
                    <div className="flex justify-between gap-2">
                      <span className="flex-1">{it.qty} × {it.name}</span>
                      <span>{money(it.price * (typeof it.qty === 'number' ? it.qty : 1))}</span>
                    </div>
                  </div>
                ))
              ) : (
                receipt.items.map((it) => (
                  <div key={it.id} className="rf-mono text-[12px]">
                    <div className="flex justify-between gap-2">
                      <span className="flex-1">{it.qty} × {it.name}</span>
                      <span>{money(it.price * it.qty)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] opacity-60"><span>{money(it.price)} / unité</span></div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-dashed border-black/30 my-2" />

            {/* Totaux */}
            {activePayment ? (
              <>
                <div className="rf-mono text-[11px] flex justify-between opacity-80">
                  <span>Total commande</span><span>{money(receipt.total)}</span>
                </div>
                <div className="rf-mono text-[14px] flex justify-between font-bold mt-1">
                  <span>PART RÉGLÉE</span><span>{money(activePayment.amount)}</span>
                </div>
                <div className="rf-mono text-[11px] flex justify-between opacity-80 mt-1.5">
                  <span>Moyen de règlement</span><span>{getMethodLabel(activePayment.method)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="rf-mono text-[11px] flex justify-between opacity-80">
                  <span>Sous-total</span><span>{money(receipt.total)}</span>
                </div>
                <div className="rf-mono text-[14px] flex justify-between font-bold mt-1">
                  <span>TOTAL TTC</span><span>{money(receipt.total)}</span>
                </div>
                <div className="rf-mono text-[11px] flex justify-between opacity-80 mt-1.5">
                  <span>Paiement</span><span>{getMethodLabel(receipt.paymentMethod)}</span>
                </div>

                {isSplit && (
                  <div className="mt-3 pt-2 border-t border-dashed border-black/20">
                    <p className="rf-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                      Ventilation des règlements ({receipt.payments.length}) :
                    </p>
                    <div className="space-y-1">
                      {receipt.payments.map((p, idx) => (
                        <div key={p.id || idx} className="rf-mono text-[11px] flex justify-between">
                          <span className="opacity-80">• {p.label} ({getMethodLabel(p.method)})</span>
                          <span className="font-bold">{money(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-center text-xs mt-4 opacity-80">Merci et à bientôt !</p>
          </div>
        </div>

        <div className="p-4 border-t border-black/10 flex gap-2 bg-white">
          <button onClick={onClose} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Fermer</button>
          <button onClick={() => window.print()} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-1.5" style={{ background: "#C1440E" }}>
            🖨️ Imprimer {activePayment ? "cette part" : "le ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
