/**
 * Données et définitions pour la gestion de l'équipe, des rôles et des permissions.
 */

export const PERMISSION_MODULES = [
  {
    id: "salle",
    label: "Salle & Commandes",
    color: "#3E7CB1",
    permissions: [
      { id: "salle.view", label: "Consulter le plan de salle", desc: "Visualisation des tables et statuts en temps réel" },
      { id: "salle.order", label: "Prendre des commandes", desc: "Création et modification du panier d'une table" },
      { id: "salle.send_kitchen", label: "Envoyer en cuisine", desc: "Transmission des bons de commande au KDS" },
      { id: "salle.serve", label: "Marquer comme servi", desc: "Valider le service des plats prêts en salle" },
      { id: "salle.reservations", label: "Gérer les réservations", desc: "Ajout, modification et levée de réservations" },
      { id: "salle.alerts", label: "Gérer les alertes de table", desc: "Activer/désactiver les signalements d'urgence ou allergies" },
    ],
  },
  {
    id: "cuisine",
    label: "Cuisine (KDS)",
    color: "#C1440E",
    permissions: [
      { id: "cuisine.view", label: "Accéder au KDS", desc: "Affichage des commandes en direct par bon et par plat" },
      { id: "cuisine.status", label: "Valider les préparations", desc: "Lancer la cuisson et sonner les plats prêts à servir" },
    ],
  },
  {
    id: "caisse",
    label: "Caisse & Règlements",
    color: "#2E9E5B",
    permissions: [
      { id: "caisse.checkout", label: "Encaisser les additions", desc: "Validation des paiements et impression des tickets" },
      { id: "caisse.split", label: "Paiements partagés", desc: "Gestion des règlements multiples et division d'addition" },
      { id: "caisse.discount", label: "Appliquer des remises", desc: "Application de codes promotionnels ou remises manuelles" },
      { id: "caisse.history", label: "Historique des paiements", desc: "Consultation et réimpression des reçus encaissés" },
      { id: "caisse.close", label: "Clôture de caisse & Rapports Z/X", desc: "Lecture X intermédiaire et clôture journalière définitive Z" },
      { id: "caisse.fec", label: "Export comptable FEC & Audit NF525", desc: "Téléchargement du FEC et vérification de la chaîne fiscale inaltérable" },
      { id: "caisse.settings", label: "Paramètres de caisse & Imprimantes", desc: "Mentions légales, configuration des imprimantes et codes promo" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion & Carte",
    color: "#6B5B95",
    permissions: [
      { id: "gestion.tables", label: "Configuration des tables", desc: "Ajout, suppression et coordonnées du mobilier" },
      { id: "gestion.products", label: "Catalogue produits & carte", desc: "Gestion des plats, tarifs et disponibilité" },
      { id: "gestion.menus", label: "Création de formules / menus", desc: "Définition des étapes et formules au choix" },
      { id: "gestion.stocks", label: "Stocks & Inventaire", desc: "Suivi des quantités, réapprovisionnement et pertes" },
      { id: "gestion.recipes", label: "Fiches techniques & Food Cost", desc: "Recettes, composition et calcul des marges" },
      { id: "gestion.staff", label: "Équipe, rôles & permissions", desc: "Administration des comptes collaborateurs et droits" },
    ],
  },
  {
    id: "dashboard",
    label: "Pilotage & Statistiques",
    color: "#D9A441",
    permissions: [
      { id: "dashboard.view", label: "Consulter le Dashboard", desc: "Chiffre d'affaires, panier moyen et suivi de l'activité" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.id));
