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
      { id: "caisse.history", label: "Historique des paiements", desc: "Consultation et réimpression des reçus encaissés" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion & Carte",
    color: "#6B5B95",
    permissions: [
      { id: "gestion.tables", label: "Configuration des tables", desc: "Ajout, suppression et coordonnées du mobilier" },
      { id: "gestion.products", label: "Catalogue produits & stock", desc: "Gestion des plats, tarifs et rupture de stock" },
      { id: "gestion.menus", label: "Création de formules / menus", desc: "Définition des étapes et formules au choix" },
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

export const INITIAL_ROLES = [
  {
    id: "admin",
    name: "Administrateur / Gérant",
    description: "Accès intégral à l'ensemble du système, aux configurations et aux paramètres financiers.",
    color: "#C1440E",
    isSystem: true,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    id: "head_waiter",
    name: "Responsable de salle",
    description: "Supervision du service en salle, réservations, gestion des tables et encaissements.",
    color: "#3E7CB1",
    isSystem: false,
    permissions: [
      "salle.view",
      "salle.order",
      "salle.send_kitchen",
      "salle.serve",
      "salle.reservations",
      "salle.alerts",
      "caisse.checkout",
      "caisse.split",
      "caisse.history",
      "gestion.tables",
      "dashboard.view",
    ],
  },
  {
    id: "server",
    name: "Serveur / Serveuse",
    description: "Prise de commande, transmission en cuisine, service des plats et encaissements courants.",
    color: "#D9A441",
    isSystem: false,
    permissions: [
      "salle.view",
      "salle.order",
      "salle.send_kitchen",
      "salle.serve",
      "salle.alerts",
      "caisse.checkout",
      "caisse.split",
    ],
  },
  {
    id: "cook",
    name: "Chef de cuisine",
    description: "Affichage des commandes en direct, gestion du KDS et signalement des ruptures de produits.",
    color: "#8B5A2B",
    isSystem: false,
    permissions: [
      "cuisine.view",
      "cuisine.status",
      "gestion.products",
    ],
  },
  {
    id: "accountant",
    name: "Comptable / Finance",
    description: "Suivi des ventes, consultation des rapports financiers et historique complet des paiements.",
    color: "#6B5B95",
    isSystem: false,
    permissions: [
      "caisse.history",
      "dashboard.view",
    ],
  },
];

export const INITIAL_STAFF = [
  {
    id: "stf_1",
    name: "Léa Martin",
    roleId: "server",
    pin: "1011",
    email: "lea.martin@restoflow.fr",
    phone: "06 12 34 56 78",
    active: true,
    avatarBg: "#D9A441",
  },
  {
    id: "stf_2",
    name: "Marco Rossi",
    roleId: "server",
    pin: "2022",
    email: "marco.rossi@restoflow.fr",
    phone: "06 23 45 67 89",
    active: true,
    avatarBg: "#D9A441",
  },
  {
    id: "stf_3",
    name: "Inès Benali",
    roleId: "head_waiter",
    pin: "3033",
    email: "ines.benali@restoflow.fr",
    phone: "06 34 56 78 90",
    active: true,
    avatarBg: "#3E7CB1",
  },
  {
    id: "stf_4",
    name: "Antoine Dubois",
    roleId: "cook",
    pin: "4044",
    email: "antoine.dubois@restoflow.fr",
    phone: "06 45 67 89 01",
    active: true,
    avatarBg: "#8B5A2B",
  },
  {
    id: "stf_5",
    name: "Sarah Laurent",
    roleId: "admin",
    pin: "5055",
    email: "sarah.laurent@restoflow.fr",
    phone: "06 56 78 90 12",
    active: true,
    avatarBg: "#C1440E",
  },
];
