import { useState } from "react";
import {
  Boxes,
  CalendarDays,
  Clock,
  Wine,
  Tag,
  CreditCard,
  Lock,
  HeartHandshake,
  Sparkles,
  Save,
  UtensilsCrossed,
  Truck,
  Beer,
  ShoppingBag,
} from "lucide-react";
import { DEFAULT_MODULES_CONFIG } from "../../hooks/useModules.js";

/**
 * ModulesManager — Panneau de gestion des fonctionnalités à la carte (Phase 8).
 * Permet d'adapter l'application au profil opérationnel du restaurant.
 */
export default function ModulesManager({
  config,
  onUpdateModules,
  pushToast,
}) {
  const initialModules = config?.modulesConfig || DEFAULT_MODULES_CONFIG;
  const [modules, setModules] = useState(() => ({
    ...DEFAULT_MODULES_CONFIG,
    ...(typeof initialModules === "string" ? JSON.parse(initialModules) : initialModules),
  }));

  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (key) => {
    setModules((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleApplyPreset = (presetName) => {
    let presetConfig = {};
    if (presetName === "gastro") {
      presetConfig = {
        enableStockManagement: true,
        enableOnlineReservations: true,
        enableCoursePacing: true,
        enableMultiStationKds: true,
        enableDiscounts: true,
        enableAdvancedSplitModes: true,
        enablePinAuth: true,
        enableTips: true,
        enableTakeaway: true,
      };
    } else if (presetName === "bar") {
      presetConfig = {
        enableStockManagement: true,
        enableOnlineReservations: false,
        enableCoursePacing: false,
        enableMultiStationKds: true,
        enableDiscounts: true,
        enableAdvancedSplitModes: true,
        enablePinAuth: true,
        enableTips: true,
        enableTakeaway: false,
      };
    } else if (presetName === "fast") {
      presetConfig = {
        enableStockManagement: false,
        enableOnlineReservations: false,
        enableCoursePacing: false,
        enableMultiStationKds: false,
        enableDiscounts: false,
        enableAdvancedSplitModes: false,
        enablePinAuth: false,
        enableTips: true,
        enableTakeaway: true,
      };
    }

    setModules(presetConfig);
    setHasChanges(true);
    pushToast?.("info", `Profil appliqué : ${presetName === "gastro" ? "Restaurant Traditionnel / Gastro" : presetName === "bar" ? "Bar & Tapas" : "Fast-Food / Food Truck"}. Cliquez sur Enregistrer pour synchroniser.`);
  };

  const handleSave = () => {
    onUpdateModules?.(modules);
    setHasChanges(false);
    pushToast?.("success", "Configuration des modules mise à jour et diffusée en temps réel.");
  };

  const moduleDefinitions = [
    {
      key: "enableStockManagement",
      title: "Gestion des Stocks & Fiches Techniques",
      subtitle: "Inventaire, fiches recettes, décompte atomique à la commande et alertes de rupture",
      icon: Boxes,
      badge: "Cuisine & Épicerie",
      color: "#D97706",
      impactWhenDisabled: "Masque les onglets 'Stocks' et 'Fiches & Coûts'. La prise de commande en salle s'effectue sans contrainte de stock restant.",
    },
    {
      key: "enableOnlineReservations",
      title: "Réservations en Ligne & Planificateur",
      subtitle: "Gestion des réservations clients, attribution de tables et affichage des créneaux",
      icon: CalendarDays,
      badge: "Accueil & Salle",
      color: "#2563EB",
      impactWhenDisabled: "Désactive la prise de réservation et épure le plan de salle de toute mention de réservation.",
    },
    {
      key: "enableCoursePacing",
      title: "Cadencement des Suites & Réclame",
      subtitle: "Découpage du service par vagues (Entrées, Plats, Desserts) avec bouton 'Envoyer la suite'",
      icon: Clock,
      badge: "Orchestration Cuisine",
      color: "#059669",
      impactWhenDisabled: "Envoi direct et global des commandes en cuisine sans temporisation ni réclame.",
    },
    {
      key: "enableMultiStationKds",
      title: "Dispatch Multi-Postes (Bar vs Cuisine)",
      subtitle: "Routage séparé des boissons vers l'écran/imprimante Bar et des plats vers la Cuisine",
      icon: Wine,
      badge: "Production Séparée",
      color: "#7C3AED",
      impactWhenDisabled: "Centralise l'ensemble des bons sur un écran KDS unique sans segmentation par poste.",
    },
    {
      key: "enableDiscounts",
      title: "Remises & Codes Promotionnels",
      subtitle: "Application de remises en pourcentage/montant, codes promo enregistrés ou motifs libres",
      icon: Tag,
      badge: "Caisse & Commercial",
      color: "#EA580C",
      impactWhenDisabled: "Encaissement direct au tarif carte sans option de réduction, simplifiant l'écran de caisse.",
    },
    {
      key: "enableAdvancedSplitModes",
      title: "Modes de Partage d'Addition Avancés",
      subtitle: "Partage nominatif par article (split itemisé) et règlements partiels au montant libre",
      icon: CreditCard,
      badge: "Caisse Pro",
      color: "#0D9488",
      impactWhenDisabled: "Restreint la caisse au règlement direct total et à la division équitable à parts égales.",
    },
    {
      key: "enablePinAuth",
      title: "Verrouillage PIN Multi-Opérateurs",
      subtitle: "Saisie d'un code PIN équipier entre chaque commande pour attribution et traçabilité",
      icon: Lock,
      badge: "Sécurité & Brigade",
      color: "#4B5563",
      impactWhenDisabled: "Mode 'Caisse rapide / Opérateur unique' : aucun verrouillage PIN intempestif en salle.",
    },
    {
      key: "enableTips",
      title: "Gestion des Pourboires (Tips) & Répartition",
      subtitle: "Saisie des pourboires sur TPE/caisse et suivi dédié sur les rapports journaliers Z",
      icon: HeartHandshake,
      badge: "Fidélisation Équipe",
      color: "#DB2777",
      impactWhenDisabled: "Désactive l'étape de sélection de pourboire lors des encaissements.",
    },
    {
      key: "enableTakeaway",
      title: "Vente à Emporter",
      subtitle: "Commandes hors salle (comptoir ou téléphone) avec numéro d'appel, nom du client et heure de retrait",
      icon: ShoppingBag,
      badge: "Comptoir & Emporter",
      color: "#0891B2",
      impactWhenDisabled: "Masque le bouton 'Emporter' : la prise de commande se fait uniquement à table.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête & Bouton Sauvegarder */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-700">
              <Sparkles size={20} />
            </span>
            <h2 className="text-lg font-bold text-stone-900">Modularité & Options "À la Carte"</h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Activez ou désactivez les fonctionnalités selon l'activité de votre établissement. Les modifications s'appliquent immédiatement sur tous les écrans.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-xs ${
            hasChanges
              ? "bg-[#C1440E] hover:bg-[#A83808] text-white cursor-pointer"
              : "bg-stone-100 text-stone-400 cursor-not-allowed"
          }`}
        >
          <Save size={16} />
          {hasChanges ? "Enregistrer les modifications" : "Paramètres à jour"}
        </button>
      </div>

      {/* Profils Rapides (Presets) */}
      <div className="bg-stone-50/80 p-5 rounded-2xl border border-stone-200/80">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-600" /> Profils Prédéfinis (Configuration en 1 clic)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleApplyPreset("gastro")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 group-hover:scale-105 transition-transform">
              <UtensilsCrossed size={18} />
            </div>
            <div>
              <div className="font-semibold text-xs text-stone-900">Restaurant Traditionnel / Gastro</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Tous les modules activés (stocks, réservations, suites, KDS bar/cuisine).</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("bar")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-stone-200 bg-white hover:border-purple-400 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-700 group-hover:scale-105 transition-transform">
              <Beer size={18} />
            </div>
            <div>
              <div className="font-semibold text-xs text-stone-900">Bar, Brasserie & Tapas</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Sans réservations ni suites, avec KDS bar, remises et pourboires.</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset("fast")}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-stone-200 bg-white hover:border-emerald-400 hover:shadow-xs text-left transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:scale-105 transition-transform">
              <Truck size={18} />
            </div>
            <div>
              <div className="font-semibold text-xs text-stone-900">Food Truck & Fast-Casual</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Mode ultra-épuré : paiement direct rapide, sans PIN récurrent, sans stocks bloquants.</div>
            </div>
          </button>
        </div>
      </div>

      {/* Grille des Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moduleDefinitions.map((mod) => {
          const Icon = mod.icon;
          const isEnabled = modules[mod.key] ?? true;

          return (
            <div
              key={mod.key}
              className={`p-4 rounded-2xl border transition-all ${
                isEnabled
                  ? "bg-white border-stone-200/90 shadow-2xs"
                  : "bg-stone-50/60 border-stone-200/50 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="p-2.5 rounded-xl shrink-0 transition-colors"
                    style={{
                      backgroundColor: isEnabled ? `${mod.color}15` : "#F3F4F6",
                      color: isEnabled ? mod.color : "#9CA3AF",
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-stone-900">{mod.title}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {mod.badge}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      {mod.subtitle}
                    </p>
                  </div>
                </div>

                {/* Switch Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(mod.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? "bg-[#059669]" : "bg-stone-300"
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {!isEnabled && (
                <div className="mt-3 pt-2.5 border-t border-stone-200/50 flex items-start gap-1.5 text-[11px] text-stone-500 italic">
                  <span>💡</span>
                  <span>{mod.impactWhenDisabled}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
