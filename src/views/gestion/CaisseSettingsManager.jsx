import { useState } from "react";
import {
  Building2,
  Printer,
  Tag,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Volume2,
  Scissors,
  DollarSign,
  Play,
} from "lucide-react";
import ThermalReceiptPreview from "../../components/ThermalReceiptPreview.jsx";
import { money } from "../../utils/index.js";

/**
 * CaisseSettingsManager — Back-office de gestion des paramètres de caisse,
 * mentions légales, imprimantes ESC/POS et codes promotionnels.
 */
export default function CaisseSettingsManager({
  config,
  onUpdateConfig,
  pushToast,
}) {
  const [formData, setFormData] = useState({
    name: config?.name || "RestoFlow Bistrot",
    legalName: config?.legalName || "RESTOFLOW BISTROT SAS",
    siret: config?.siret || "987 654 321 00012",
    vatNumber: config?.vatNumber || "FR 12 987654321",
    address: config?.address || "14 Rue de la Paix",
    city: config?.city || "75002 Paris",
    phone: config?.phone || "01 42 68 55 00",
    email: config?.email || "contact@restoflow-bistrot.fr",
    website: config?.website || "www.restoflow.fr",
    footerNote: config?.footerNote || "Merci de votre visite ! Service & taxes compris.",
    currency: config?.currency || "EUR",
    tpeAutoPrint: config?.tpeAutoPrint ?? true,
    printers: config?.printers || [
      { id: "prn_caisse", name: "Imprimante Caisse", type: "caisse", width: "80mm", status: "online", autoCut: true, openDrawer: true },
      { id: "prn_cuisine", name: "Imprimante Cuisine", type: "cuisine", width: "80mm", status: "online", autoCut: true, beep: true },
      { id: "prn_bar", name: "Imprimante Bar", type: "bar", width: "58mm", status: "online", autoCut: true, beep: false },
    ],
    promoCodes: config?.promoCodes || [
      { code: "HAPPYHOUR", label: "Happy Hour (-15%)", type: "percent", value: 15, active: true },
      { code: "STAFF", label: "Tarif Équipe (-20%)", type: "percent", value: 20, active: true },
      { code: "BIENVENUE5", label: "Offre Bienvenue (-5€)", type: "fixed", value: 5, active: true },
      { code: "FIDELITE10", label: "Remise Fidélité (-10%)", type: "percent", value: 10, active: true },
      { code: "VIP25", label: "Client Privilège (-25%)", type: "percent", value: 25, active: true },
    ],
  });

  const [activeSubtab, setActiveSubtab] = useState("etablissement"); // "etablissement" | "imprimantes" | "promos"
  const [testPrintModal, setTestPrintModal] = useState(null); // null | { type: "caisse" | "cuisine" | "bar" }

  // Nouveau code promo
  const [newPromo, setNewPromo] = useState({
    code: "",
    label: "",
    type: "percent",
    value: 10,
  });

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    onUpdateConfig?.(formData);
    pushToast?.("success", "Paramètres de caisse et billetterie enregistrés avec succès.");
  };

  const handleTogglePrinterOption = (printerId, optionKey) => {
    setFormData((prev) => ({
      ...prev,
      printers: prev.printers.map((p) =>
        p.id === printerId ? { ...p, [optionKey]: !p[optionKey] } : p
      ),
    }));
  };

  const handleAddPromoCode = () => {
    if (!newPromo.code.trim()) return;
    const cleanCode = newPromo.code.trim().toUpperCase();
    if (formData.promoCodes.some((p) => p.code === cleanCode)) {
      pushToast?.("error", "Ce code promotionnel existe déjà.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      promoCodes: [
        ...prev.promoCodes,
        {
          code: cleanCode,
          label: newPromo.label.trim() || `Remise ${cleanCode}`,
          type: newPromo.type,
          value: Number(newPromo.value) || 5,
          active: true,
        },
      ],
    }));

    setNewPromo({ code: "", label: "", type: "percent", value: 10 });
    pushToast?.("success", `Code promo ${cleanCode} ajouté.`);
  };

  const handleDeletePromo = (codeToDelete) => {
    setFormData((prev) => ({
      ...prev,
      promoCodes: prev.promoCodes.filter((p) => p.code !== codeToDelete),
    }));
    pushToast?.("info", `Code promo ${codeToDelete} supprimé.`);
  };

  const handleTogglePromo = (codeToToggle) => {
    setFormData((prev) => ({
      ...prev,
      promoCodes: prev.promoCodes.map((p) =>
        p.code === codeToToggle ? { ...p, active: !p.active } : p
      ),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Barre de sous-navigation & Enregistrer */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-black/10">
        <div className="flex gap-1.5 p-1 rounded-2xl bg-black/5">
          <button
            onClick={() => setActiveSubtab("etablissement")}
            className={`rf-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubtab === "etablissement"
                ? "bg-[#2B2622] text-white shadow-xs"
                : "text-[#5B5346] hover:text-[#2B2622]"
            }`}
          >
            <Building2 size={14} />
            <span>Établissement & Mentions Légales</span>
          </button>

          <button
            onClick={() => setActiveSubtab("imprimantes")}
            className={`rf-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubtab === "imprimantes"
                ? "bg-[#2B2622] text-white shadow-xs"
                : "text-[#5B5346] hover:text-[#2B2622]"
            }`}
          >
            <Printer size={14} />
            <span>Imprimantes ESC/POS ({formData.printers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubtab("promos")}
            className={`rf-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubtab === "promos"
                ? "bg-[#2B2622] text-white shadow-xs"
                : "text-[#5B5346] hover:text-[#2B2622]"
            }`}
          >
            <Tag size={14} />
            <span>Codes Promo & Remises ({formData.promoCodes.length})</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          className="rf-tap px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm"
          style={{ background: "#2E9E5B" }}
        >
          <Save size={14} />
          <span>Enregistrer les modifications</span>
        </button>
      </div>

      {/* ── 1. ÉTABLISSEMENT & MENTIONS LÉGALES ─────────────────── */}
      {activeSubtab === "etablissement" && (
        <div className="bg-white rounded-3xl p-6 border border-black/10 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#2B2622]">
              Coordonnées de l'Établissement & Conformité Fiscale
            </h3>
            <p className="text-xs text-[#8A8378]">
              Ces informations figurent obligatoirement sur les factures et tickets de caisse légaux.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Nom d'enseigne / Restaurant
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Raison sociale (Forme juridique)
              </label>
              <input
                type="text"
                value={formData.legalName}
                onChange={(e) => handleChange("legalName", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Numéro SIRET
              </label>
              <input
                type="text"
                value={formData.siret}
                onChange={(e) => handleChange("siret", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-mono font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                N° de TVA Intracommunautaire
              </label>
              <input
                type="text"
                value={formData.vatNumber}
                onChange={(e) => handleChange("vatNumber", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-mono font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Adresse postale
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Code Postal & Ville
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Numéro de téléphone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Site web / Email
              </label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
              Message légal de pied de ticket
            </label>
            <input
              type="text"
              value={formData.footerNote}
              onChange={(e) => handleChange("footerNote", e.target.value)}
              placeholder="Service et taxes compris - Merci de votre visite !"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/15 text-sm font-semibold outline-none focus:border-[#C1440E]"
            />
          </div>
        </div>
      )}

      {/* ── 2. IMPRIMANTES ESC/POS ──────────────────────────────── */}
      {activeSubtab === "imprimantes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formData.printers.map((prn) => (
              <div
                key={prn.id}
                className="bg-white rounded-3xl p-5 border border-black/10 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#C1440E]/10 text-[#C1440E] flex items-center justify-center font-bold">
                      <Printer size={18} />
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#2E9E5B]/15 text-[#2E9E5B] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E5B]" />
                      {prn.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#2B2622]">{prn.name}</h4>
                  <p className="text-xs text-[#8A8378]">
                    Rôle : <strong className="text-[#2B2622]">{prn.type.toUpperCase()}</strong> · Format :{" "}
                    <strong className="text-[#2B2622]">{prn.width}</strong>
                  </p>

                  <div className="mt-4 pt-3 border-t border-black/10 space-y-2">
                    <label className="flex items-center justify-between text-xs font-semibold text-[#5B5346] cursor-pointer">
                      <span className="flex items-center gap-1.5">
                        <Scissors size={13} /> Coupe automatique
                      </span>
                      <input
                        type="checkbox"
                        checked={prn.autoCut ?? true}
                        onChange={() => handleTogglePrinterOption(prn.id, "autoCut")}
                        className="rounded accent-[#C1440E]"
                      />
                    </label>

                    {prn.type === "cuisine" && (
                      <label className="flex items-center justify-between text-xs font-semibold text-[#5B5346] cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <Volume2 size={13} /> Buzzer / Beep sonore
                        </span>
                        <input
                          type="checkbox"
                          checked={prn.beep ?? true}
                          onChange={() => handleTogglePrinterOption(prn.id, "beep")}
                          className="rounded accent-[#C1440E]"
                        />
                      </label>
                    )}

                    {prn.type === "caisse" && (
                      <label className="flex items-center justify-between text-xs font-semibold text-[#5B5346] cursor-pointer">
                        <span className="flex items-center gap-1.5">
                          <DollarSign size={13} /> Ouverture tiroir-caisse
                        </span>
                        <input
                          type="checkbox"
                          checked={prn.openDrawer ?? true}
                          onChange={() => handleTogglePrinterOption(prn.id, "openDrawer")}
                          className="rounded accent-[#C1440E]"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setTestPrintModal({ type: prn.type, width: prn.width })}
                  className="rf-tap w-full py-2.5 rounded-xl border border-black/15 bg-black/[.02] hover:bg-black/5 text-xs font-bold text-[#2B2622] flex items-center justify-center gap-1.5"
                >
                  <Play size={13} className="text-[#C1440E]" />
                  <span>Tester l'impression</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. CODES PROMO & REMISES ───────────────────────────── */}
      {activeSubtab === "promos" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulaire création code */}
          <div className="bg-white rounded-3xl p-5 border border-black/10 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-[#2B2622] flex items-center gap-2">
              <Plus size={16} className="text-[#C1440E]" />
              <span>Créer un Code Promotionnel</span>
            </h4>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Code (sans espaces)
              </label>
              <input
                type="text"
                placeholder="EX: FETEDESMERES"
                value={newPromo.code}
                onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-black/15 font-mono uppercase font-bold text-sm outline-none focus:border-[#C1440E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                Libellé descriptif
              </label>
              <input
                type="text"
                placeholder="Ex : Réduction Fête des Mères (-10%)"
                value={newPromo.label}
                onChange={(e) => setNewPromo({ ...newPromo, label: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-black/15 text-xs font-semibold outline-none focus:border-[#C1440E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                  Type
                </label>
                <select
                  value={newPromo.type}
                  onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-black/15 text-xs font-bold outline-none bg-white"
                >
                  <option value="percent">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6B6355] mb-1">
                  Valeur
                </label>
                <input
                  type="number"
                  min="1"
                  max={newPromo.type === "percent" ? 100 : 500}
                  value={newPromo.value}
                  onChange={(e) => setNewPromo({ ...newPromo, value: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-black/15 text-xs font-bold outline-none focus:border-[#C1440E]"
                />
              </div>
            </div>

            <button
              disabled={!newPromo.code.trim()}
              onClick={handleAddPromoCode}
              className="rf-tap w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-40"
              style={{ background: "#C1440E" }}
            >
              Ajouter ce code
            </button>
          </div>

          {/* Liste des codes existants */}
          <div className="md:col-span-2 bg-white rounded-3xl p-5 border border-black/10 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-[#2B2622]">
              Codes Promotionnels Actifs ({formData.promoCodes.length})
            </h4>

            <div className="space-y-2">
              {formData.promoCodes.map((p) => (
                <div
                  key={p.code}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    p.active !== false
                      ? "border-black/10 bg-white"
                      : "border-black/5 bg-black/[.02] opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-xs px-2 py-1 rounded bg-[#2B2622] text-white">
                      {p.code}
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-[#2B2622]">{p.label}</h5>
                      <span className="text-[11px] font-semibold text-[#2E9E5B]">
                        Réduction : {p.type === "percent" ? `-${p.value}%` : `-${money(p.value)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePromo(p.code)}
                      className={`rf-tap px-3 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                        p.active !== false
                          ? "border-[#2E9E5B]/40 bg-[#2E9E5B]/10 text-[#2E9E5B]"
                          : "border-black/15 bg-black/5 text-[#8A8378]"
                      }`}
                    >
                      {p.active !== false ? "Actif" : "Désactivé"}
                    </button>

                    <button
                      onClick={() => handleDeletePromo(p.code)}
                      className="rf-tap p-1.5 rounded-lg text-[#8A8378] hover:text-[#C1361B] hover:bg-[#C1361B]/10"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de test d'impression */}
      {testPrintModal && (
        <ThermalReceiptPreview
          defaultTab={testPrintModal.type}
          config={formData}
          receipt={{
            id: "rcpt_test_001",
            ticketNumber: "TEST-2026-0001",
            tableNumber: 4,
            server: "Service Démo",
            total: 39.50,
            subtotal: 44.50,
            discount: { code: "TESTPROMO", type: "fixed", value: 5, amount: 5 },
            paymentMethod: "carte",
            paidAt: Date.now(),
            items: [
              { id: "t1", name: "Burrata crémeuse", price: 9, qty: 1, cat: "entrees", vatRate: 10 },
              { id: "t2", name: "Entrecôte grillée", price: 22, qty: 1, notes: "À point", cat: "plats", vatRate: 10 },
              { id: "t3", name: "Verre Côtes du Rhône", price: 6, qty: 1, cat: "boissons", vatRate: 20 },
              { id: "t4", name: "Tiramisu maison", price: 7.5, qty: 1, cat: "desserts", vatRate: 10 },
            ],
          }}
          table={{ number: 4, seats: 2 }}
          onClose={() => setTestPrintModal(null)}
        />
      )}
    </div>
  );
}
