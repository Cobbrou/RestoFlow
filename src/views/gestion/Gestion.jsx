import { useState } from "react";
import { Table2, Package, LayoutList, Plus, Pencil, Trash2, Lock, Users, Ban } from "lucide-react";
import { CATEGORIES } from "../../data/categories.js";
import { isAvailable, money } from "../../utils/index.js";
import Modal, { Field, inputCls } from "../../components/Modal.jsx";

/**
 * Gestion — Back-office avec 3 sous-vues :
 *  - tables   : gestion du plan de salle (CRUD + réservations)
 *  - produits : catalogue produits (CRUD + disponibilité)
 *  - menus    : menus composés (CRUD)
 */
export default function Gestion(props) {
  const { view, setView } = props;

  const tabs = [
    { id: "tables",   label: "Tables",   icon: Table2 },
    { id: "produits", label: "Produits", icon: Package },
    { id: "menus",    label: "Menus",    icon: LayoutList },
  ];

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="rf-display text-2xl font-semibold text-[#2B2622]">Gestion</h1>
          <p className="text-sm text-[#6B6355]">Tables, catalogue produits et menus du restaurant</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-black/5">
          {tabs.map((t) => {
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

      {view === "tables"   && <TableManager {...props} />}
      {view === "produits" && <ProductManager {...props} />}
      {view === "menus"    && <MenuManager {...props} />}
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

function ProductManager({ products, onAddProduct, onUpdateProduct, onDeleteProduct }) {
  const [editing,   setEditing]   = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");
  const shown = filterCat ? products.filter((p) => p.cat === filterCat) : products;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat(null)}
            className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: filterCat === null ? "#2B2622" : "rgba(0,0,0,.05)", color: filterCat === null ? "#FAF6EE" : "#5B5346" }}>
            Tous
          </button>
          {realCats.map((c) => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              className="rf-tap px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: filterCat === c.id ? c.accent : "rgba(0,0,0,.05)", color: filterCat === c.id ? "#FAF6EE" : "#5B5346" }}>
              {c.name}
            </button>
          ))}
        </div>
        <button onClick={() => setEditing("new")}
          className="rf-tap flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0"
          style={{ background: "#C1440E" }}>
          <Plus size={15} /> Ajouter un produit
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {shown.map((p) => {
          const cat = CATEGORIES.find((c) => c.id === p.cat);
          const available = isAvailable(p);
          return (
            <div key={p.id} className="rounded-xl border border-black/10 bg-white p-3 flex gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ background: (cat?.accent || "#999") + "22", filter: available ? "none" : "grayscale(1)" }}>
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-semibold text-[#2B2622] leading-tight">{p.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(p)} className="rf-tap p-1 rounded-full bg-black/5"><Pencil size={12} /></button>
                    <button onClick={() => onDeleteProduct(p.id)} className="rf-tap p-1 rounded-full bg-black/5 text-[#C1361B]"><Trash2 size={12} /></button>
                  </div>
                </div>
                <p className="text-[11px] text-[#8A8378] leading-snug">{p.desc}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold">{money(p.price)}</span>
                  <span className="text-[10px] text-[#8A8378]">{cat?.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: available ? "#4A785622" : "#C1361B22", color: available ? "#4A7856" : "#C1361B" }}>
                    {available ? "DISPONIBLE" : <><Ban size={9} /> RUPTURE</>}
                  </span>
                  <button onClick={() => onUpdateProduct(p.id, { available: !available })} className="rf-tap text-[10px] font-semibold text-[#3E7CB1]">
                    {available ? "Marquer en rupture" : "Remettre disponible"}
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

function ProductForm({ product, categories, onCancel, onSave }) {
  const [name,      setName]      = useState(product?.name  ?? "");
  const [cat,       setCat]       = useState(product?.cat   ?? categories[0]?.id);
  const [price,     setPrice]     = useState(product?.price ?? "");
  const [desc,      setDesc]      = useState(product?.desc  ?? "");
  const [emoji,     setEmoji]     = useState(product?.emoji ?? "🍽️");
  const [allergens, setAllergens] = useState((product?.allergens ?? []).join(", "));
  const [available, setAvailable] = useState(product ? isAvailable(product) : true);
  const valid = name.trim() && price !== "" && !isNaN(Number(price));

  return (
    <Modal title={product ? "Modifier le produit" : "Nouveau produit"} onClose={onCancel}>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du produit">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Burger Classic" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Prix (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="Description courte">
        <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex : Bœuf, cheddar, oignons confits" />
      </Field>
      <Field label="Allergènes (séparés par des virgules)">
        <input className={inputCls} value={allergens} onChange={(e) => setAllergens(e.target.value)} placeholder="Ex : Gluten, Lait" />
      </Field>
      <Field label="Disponibilité">
        <div className="flex gap-2">
          <button type="button" onClick={() => setAvailable(true)}
            className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold"
            style={{ background: available ? "#4A7856" : "rgba(0,0,0,.05)", color: available ? "#FAF6EE" : "#5B5346" }}>
            Disponible
          </button>
          <button type="button" onClick={() => setAvailable(false)}
            className="rf-tap flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
            style={{ background: !available ? "#C1361B" : "rgba(0,0,0,.05)", color: !available ? "#FAF6EE" : "#5B5346" }}>
            <Ban size={12} /> Rupture de stock
          </button>
        </div>
      </Field>
      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid}
          onClick={() => onSave({
            name: name.trim(), cat, price: Number(price), desc: desc.trim(),
            emoji: emoji || "🍽️",
            allergens: allergens.split(",").map((s) => s.trim()).filter(Boolean),
            available,
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
                  <span className="text-xl">{m.emoji}</span>
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
  const [emoji,  setEmoji]  = useState(menu?.emoji  ?? "🍽️");
  const [desc,   setDesc]   = useState(menu?.desc   ?? "");
  const [groups, setGroups] = useState(menu?.groups ?? []);
  const realCats = CATEGORIES.filter((c) => c.id !== "menus");
  const valid = name.trim() && price !== "" && !isNaN(Number(price));

  const addGroup = () => {
    setGroups((prev) => [...prev, { id: `g${Date.now()}`, title: "Nouveau groupe", count: 1, productIds: [] }]);
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
    <Modal title={menu ? `Modifier : ${menu.name}` : "Nouveau menu"} onClose={onCancel} wide>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <Field label="Icône">
          <input className={inputCls + " text-center text-xl"} value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        </Field>
        <Field label="Nom du menu">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Menu Midi" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prix (€)">
          <input type="number" step="0.5" min={0} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Description (optionnel)">
          <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Affiché sous le nom" />
        </Field>
      </div>

      {/* Groupes de choix */}
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B6355] mt-2 mb-2">Étapes de choix</p>
      <div className="space-y-4 max-h-[300px] overflow-y-auto rf-scrollbar pr-1">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-black/10 p-3 bg-black/[.01]">
            <div className="flex items-center gap-2 mb-2">
              <input value={g.title} onChange={(e) => updateGroup(g.id, { title: e.target.value })}
                className={inputCls + " flex-1"} placeholder="Nom de l'étape (ex : Plat)" />
              <Field label="">
                <input type="number" min={1} value={g.count} onChange={(e) => updateGroup(g.id, { count: Number(e.target.value) })}
                  className={inputCls + " w-16"} title="Nb de choix" />
              </Field>
              <button onClick={() => removeGroup(g.id)} className="rf-tap p-1.5 rounded-full bg-black/5 text-[#C1361B] shrink-0"><Trash2 size={13} /></button>
            </div>
            <p className="text-[10px] text-[#9A917E] mb-1.5">Produits proposés dans cette étape :</p>
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => {
                const cat = realCats.find((c) => c.id === p.cat);
                const selected = g.productIds.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleProduct(g.id, p.id)}
                    className="rf-tap text-[10px] px-2 py-1 rounded-full border font-semibold"
                    style={{
                      background:  selected ? (cat?.accent || "#2B2622") : "white",
                      color:       selected ? "#FAF6EE" : "#5B5346",
                      borderColor: selected ? (cat?.accent || "#2B2622") : "rgba(0,0,0,.1)",
                    }}>
                    {p.emoji} {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={addGroup}
        className="rf-tap w-full mt-3 py-2 rounded-xl border-2 border-dashed border-black/15 text-xs font-semibold text-[#5B5346] flex items-center justify-center gap-1 hover:bg-black/5">
        <Plus size={13} /> Ajouter une étape de choix
      </button>

      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-semibold bg-black/5">Annuler</button>
        <button disabled={!valid}
          onClick={() => onSave({ name: name.trim(), price: Number(price), emoji: emoji || "🍽️", desc: desc.trim(), groups })}
          className="rf-tap flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#C1440E" }}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
