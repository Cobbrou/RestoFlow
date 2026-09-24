# 🍽️ RestoFlow

> **Application moderne de gestion de commandes et d'orchestration de restaurant physique.**  
> Fluidifie la coordination en temps réel entre la **Salle** (serveurs), la **Cuisine** (KDS) et la **Gestion** (back-office & direction).

---

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-3.10-22B5BF)
![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)
![Licence](https://img.shields.io/badge/Licence-Propriétaire-orange)
![Statut](https://img.shields.io/badge/Statut-En%20Développement%20Actif-success)

---

## 📌 Sommaire

1. [Contexte initial du projet](#-contexte-initial-du-projet)
2. [Fonctionnalités actuelles (Features)](#-fonctionnalités-actuelles-features)
   - [🛎️ Salle & Prise de commande](#1-salle--prise-de-commande)
   - [💳 Caisse & Encaissement multi-modes](#2-caisse--encaissement-multi-modes)
   - [🍳 Cuisine (KDS - Kitchen Display System)](#3-cuisine-kds---kitchen-display-system)
   - [📊 Tableau de bord (Dashboard)](#4-tableau-de-bord-dashboard)
   - [⚙️ Back-office & Gestion d'équipe](#5-back-office--gestion-déquipe)
3. [Stack Technique](#-stack-technique)
   - [Frontend SPA](#frontend-spa)
   - [Backend & Temps Réel (Phase 1 active)](#backend--temps-réel-phase-1-active)
4. [Feuille de Route & Spécifications de la Phase 2](#-feuille-de-route--spécifications-de-la-phase-2)
   - [Jalons de la Roadmap](#jalons-de-la-roadmap)
   - [Dossier de Cadrage Phase 2 : Stocks & Fiches Techniques](#dossier-de-cadrage-phase-2--stocks--fiches-techniques)
     - [1. Objectifs & Enjeux Métier](#1-objectifs--enjeux-métier)
     - [2. Modélisation des Données (Schéma Prisma)](#2-modélisation-des-données-schéma-prisma)
     - [3. Formules Économiques & Fiches Techniques](#3-formules-économiques--fiches-techniques)
     - [4. Moteur Backend & Événements Temps Réel](#4-moteur-backend--événements-temps-réel)
     - [5. Parcours Utilisateurs & Nouveaux Écrans](#5-parcours-utilisateurs--nouveaux-écrans)
     - [6. Checklist Opérationnelle d'Implémentation](#6-checklist-opérationnelle-dimplémentation)
5. [Architecture du Code](#-architecture-du-code)
6. [Démarrage Rapide](#-démarrage-rapide)
7. [Principes & Règles Métier](#-principes--règles-métier)

---

## 🎯 Contexte initial du projet

Dans la restauration physique traditionnelle, les dysfonctionnements proviennent souvent de la perte d'information entre la salle et la cuisine : tickets papier égarés ou illisibles, retards de transmission, difficultés de gestion des modifications ou des allergies de dernière minute, et frictions lors du partage de l'addition au moment de l'encaissement.

**RestoFlow** a été conçu comme une solution numérique clé en main destinée à être déployée sur les tablettes et écrans tactiles de l'établissement :
- **Pour les serveurs en salle** : prise de commande rapide au doigt, visualisation dynamique des tables, transmission instantanée en cuisine sans allers-retours superflus.
- **Pour la brigade en cuisine** : affichage lisible (KDS) des commandes à préparer, alertes sur les temps d'attente, détection des allergènes et notification sonore lors de l'arrivée de nouveaux bons.
- **Pour le gérant / manager** : vue à 360° en temps réel sur le chiffre d'affaires, le panier moyen, la rotation des tables, la gestion des stocks, la configuration de la carte et les permissions de l'équipe.

---

## 🚀 Fonctionnalités actuelles (Features)

L'application intègre une suite complète d'écrans spécialisés, conçus avec une ergonomie soignée et adaptée aux contraintes du coup de feu.

### 1. 🛎️ Salle & Prise de commande
- **Plan de salle interactif (FloorPlan)** :
  - *Mode desktop* : disposition libre des tables sur un plateau visuel 2D avec coordonnées précises.
  - *Mode mobile* : grille tactile réactive 2 colonnes avec accès direct à chaque table.
  - *Statuts visuels dynamiques* : code couleur immédiat pour chaque table (**Libre**, **Occupée**, **En attente**, **Prête** avec animation de pulsation, **Alerte** avec flash d'urgence).
  - *Gestion des réservations* : badge visuel indiquant l'heure, le nom du client et le nombre de couverts réservés.
  - *Signalement d'incident* : déclenchement d'une alerte sur une table par simple clic droit ou appui long.
- **Prise de commande intuitive (OrderTaking)** :
  - Catalogue produits organisé par catégories (Entrées, Plats, Desserts, Boissons, Formules).
  - Barre de recherche textuelle avec filtrage instantané.
  - Gestion des **menus composés** pas-à-pas (sélection des entrées, plats et desserts inclus).
  - Ajustement des quantités, suppression d'articles et ajout de **notes spécifiques** pour la cuisine (ex. : *"Cuisson à point"*, *"Sans sel"*).
  - **Détection automatique des allergènes** : analyse intelligente des notes et de la fiche produit pour afficher des badges d'alerte bien visibles (Gluten, Lactose, Fruits à coque, etc.).
  - Cycle de vie d'un article : `Brouillon (draft)` ➔ `Envoyé (new)` ➔ `En préparation (preparing)` ➔ `Prêt (ready)` ➔ `Servi (served)`.
  - Contrôle des ruptures de stock en temps réel (verrouillage des produits indisponibles).

### 2. 💳 Caisse & Encaissement multi-modes
Le module d'encaissement (`PaymentModal`) est l'un des piliers de RestoFlow. Il résout la complexité du règlement d'une table grâce à **4 modes de partage** :
1. **Paiement unique** : règlement direct de la note totale en un clic (Carte bancaire, Espèces, Autre).
2. **Parts égales** : division automatique entre 2 et 20 convives avec gestion équitable du lissage des centimes résiduels.
3. **Par article (Split itemisé)** : affectation nominative des plats et boissons à chaque convive, avec calcul automatique du montant individuel.
4. **Montant libre / Proportionnel** : paiement libre en plusieurs règlements successifs (% de la note ou montant saisi), avec suivi du reste à payer jusqu'à solderie complète.
- Génération d'un **ticket de caisse dématérialisé (reçu)** complet avec historique des transactions.
- Libération automatique de la table et remise à zéro des statuts après validation du paiement.

### 3. 🍳 Cuisine (KDS - Kitchen Display System)
- **Interface sombre immersive (`#14110D`)** : pensée pour réduire la fatigue oculaire dans l'environnement lumineux et exigeant d'une cuisine.
- **Deux modes de visualisation** :
  - *Board Kanban* : répartition des bons en 3 colonnes de flux (**Nouvelles**, **En préparation**, **Prêtes**).
  - *Vue Par table* : regroupement consolidé de tous les plats d'une même table pour un contrôle optimal avant le départ des assiettes.
- **Chronomètre d'urgence en direct (TicketTimer)** :
  - Vert : commande récente (< 10 min).
  - Ambre : délai standard (10 - 20 min).
  - Rouge clignotant : délai critique (> 20 min).
- **Notifications audio & toasts** : émission d'un signal sonore distinct (synthétisé via la Web Audio API) et notification toast lors de l'arrivée d'une nouvelle commande ou du passage à l'état prêt.

### 4. 📊 Tableau de bord (Dashboard)
- **KPIs clés en temps réel** : Chiffre d'affaires cumulé, nombre de commandes traitées, panier moyen et taux d'occupation des tables.
- **Visualisations graphiques Recharts** :
  - Évolution du chiffre d'affaires sur les 7 derniers jours (AreaChart).
  - Répartition instantanée des commandes en cuisine (PieChart).
  - Palmarès des produits les plus vendus (BarChart horizontal).
- **Filtres temporels** : *Aujourd'hui*, *Cette semaine*, *Historique complet*.

### 5. ⚙️ Back-office & Gestion d'équipe
- **Gestion des tables** : ajout, modification du numéro, réglage de la capacité en places, gestion des réservations (nom, heure, couverts, notes).
- **Catalogue produits** : création et édition des références, tarification, catégorisation, fiches allergènes et bascule de disponibilité (stock).
- **Menus & Formules** : paramétrage de formules combinées avec sélection des groupes d'articles éligibles.
- **Journal de caisse & Historique** : consultation chronologique de tous les encaissements passés, ventilation par mode de paiement et détail des articles.
- **Gestion de l'équipe & Rôles (`StaffRoleManager`)** :
  - Fiches équipiers avec attribution de rôles et **codes PIN sécurisés** (avec bascule de visibilité).
  - Création de rôles personnalisés avec palette de couleurs et identifiants visuels.
  - **Matrice granulaire de permissions** articulée autour de 5 domaines : Salle, Cuisine, Gestion, Encaissement et Administration.

---

## 🛠️ Stack Technique

### Frontend SPA

L'interface client est une Single Page Application réactive, optimisée pour les écrans tactiles et tablettes :

| Rôle | Technologie | Description |
|------|-------------|-------------|
| **Framework** | [React 19](https://react.dev/) | Utilisation des dernières API React (`useMemo`, `useCallback`, Hooks modernes). |
| **Bundler / Outillage** | [Vite 8](https://vitejs.dev/) | Démarrage instantané, HMR ultra-rapide et builds optimisés. |
| **Styles & Design** | [Tailwind CSS v4](https://tailwindcss.com/) | Moteur nouvelle génération `@tailwindcss/vite`, thémage fluide et animations CSS personnalisées. |
| **Icônes** | [Lucide React](https://lucide.dev/) | Jeu d'icônes vectorielles complet, lisible et cohérent. |
| **Data Visualisation** | [Recharts 3](https://recharts.org/) | Graphiques réactifs et interactifs pour le tableau de bord d'analyse. |
| **Temps Réel Client** | [Socket.IO Client](https://socket.io/) | Connexion bidirectionnelle avec reconnexion automatique et buffer offline. |
| **Qualité de code** | [Oxlint](https://oxc.rs/) | Linter Rust ultra-rapide garantissant la propreté du code. |
| **Audio** | [Web Audio API](https://developer.mozilla.org/fr/docs/Web/API/Web_Audio_API) | Synthèse sonore native sans dépendance de fichiers audio externes. |

---

### Backend & Temps Réel (Phase 1 active)

Le serveur applicatif centralise l'orchestration des flux, la persistance des données et la synchronisation en temps réel de tous les postes :

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Terminaux Clients (Web / PWA)                     │
│    [Tablettes Salle]           [Écrans KDS]           [Poste Caisse]   │
└───────────────▲─────────────────────▲────────────────────────▲─────────┘
                │                     │                        │
                │ HTTP / REST         │ WebSockets (Socket.IO) │
                ▼                     ▼                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Backend NestJS (TypeScript)                      │
│  • Passerelle Temps Réel (WebSocketGateway / Broadcast instantané)     │
│  • Authentification rapide par code PIN équipier + Sécurité RBAC       │
│  • Contrôleurs REST & DTOs (Tables, Commandes, Catalogue, Équipe)     │
│  • Moteur de Stock & Fiches Techniques (Phase 2 en cours)              │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                                    ▼ Prisma ORM
┌────────────────────────────────────────────────────────────────────────┐
│                 Base de Données Relationnelle (ACID)                   │
│   • SQLite (Environnement de développement local `dev.db`)             │
│   • PostgreSQL 16 (Cible production / Snapshots JSONB & Transactions)  │
└────────────────────────────────────────────────────────────────────────┘
```

| Couche | Technologie | Rôle dans RestoFlow |
|--------|-------------|---------------------|
| **Serveur d'Application** | **Node.js 20+ / NestJS 10 (TypeScript)** | Architecture modulaire d'entreprise, injection de dépendances, services isolés et validation des entrées. |
| **Temps Réel & Événements** | **Socket.IO (WebSocket Gateway)** | Synchronisation bi-directionnelle instantanée (salle ⇄ cuisine ⇄ gestion), distribution d'événements et reprise après coupure. |
| **Couche ORM** | **Prisma 6 ORM** | Typage TypeScript de bout en bout, schéma déclaratif, migrations fluides et requêtes transactionnelles sécurisées. |
| **Base de Données** | **SQLite (dev) / PostgreSQL 16 (prod)** | Persistance ACID, intégrité référentielle, indexation des commandes et archivage fiscal. |
| **Authentification** | **Code PIN équipier & RBAC** | Saisie rapide sur pavé numérique tactile pour prise de commande nominative et contrôle d'accès aux modules. |

---

## 🔮 Feuille de Route & Spécifications de la Phase 2

Le projet évolue selon une feuille de route structurée en plusieurs jalons :

### Jalons de la Roadmap

| Jalon | Intitulé | Statut | Objectif synthétique |
|-------|----------|--------|----------------------|
| **Phase 1** | Câblage Backend & Synchronisation Temps Réel | 🟢 **Terminée** | NestJS, Prisma, Socket.IO, Auth PIN, buffer offline avec reconnexion automatique. |
| **Phase 2** | Gestion des Stocks & Fiches Techniques | 🟡 **Prochaine étape (En préparation)** | Décompte automatique, fiches techniques, calcul des marges, ruptures prédictives. |
| **Phase 3** | Impression Matérielle & Périphériques de Caisse | 🔵 Planifiée | Imprimantes thermiques ESC/POS (bar, cuisine, caisse), TPE bancaires. |
| **Phase 4** | Réservations en Ligne & Optimisation de Salle | 🟣 Planifiée | Module web client, algorithme de placement dynamique, rappels SMS/email. |
| **Phase 5** | Mode Hors-Ligne Résilient (Offline-First / PWA) | 🟠 Planifiée | Service Workers, persistance IndexedDB, tolérance totale aux coupures réseau. |
| **Phase 6** | Clôture de Caisse & Comptabilité Certifiée | 🔴 Planifiée | Ticket Z/X de caisse certifié, ventilation TVA, exports comptables normalisés. |

---

### 📦 Dossier de Cadrage Phase 2 : Stocks & Fiches Techniques

La **Phase 2** introduit le cœur de rentabilité et de maîtrise opérationnelle de RestoFlow. Dans la restauration physique, la mauvaise gestion des stocks et l'imprécision des dosages entraînent en moyenne **4 à 8% de perte de marge brute** (gâchis, sur-portionnement, vols, ruptures inopinées en plein coup de feu).

Cette phase relie le catalogue produits existant (`Product`) à un registre d'ingrédients bruts (`Ingredient`), gouverné par des fiches techniques précises (`RecipeItem`), un suivi des mouvements (`StockMovement`) et un décompte transactionnel en temps réel.

```
                  ┌───────────────────────────────┐
                  │    Commande Salle / KDS       │
                  │   (ex: 2x Burger RestoFlow)   │
                  └──────────────┬────────────────┘
                                 │ Événement order:sent
                                 ▼
                  ┌───────────────────────────────┐
                  │      Moteur de Décompte       │
                  │     (NestJS StockService)     │
                  └──────────────┬────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────────────────────┐   ┌───────────────────────────────────┐
│     Fiche Technique (Burger)    │   │      Mouvements de Stock          │
│ • 2x Steak haché 180g (-360g)   │   │  Journal d'audit horodaté         │
│ • 2x Pain brioché (-2 pcs)      │   │  (ORDER_CONSUMPTION, staff, date) │
│ • 2x Cheddar affiné (-60g)      │   └───────────────────────────────────┘
│ • 2x Sauce secrète (-40ml)      │
└────────────────┬────────────────┘
                 │
                 ▼ Mise à jour du stock physique
┌────────────────────────────────────────────────────────┐
│             Alertes & Disponibilité Temps Réel         │
│  • Si stock <= seuil critique ➔ 🟡 Alerte KDS / Admin  │
│  • Si stock = 0 (ingrédient clé) ➔ 🔴 Rupture auto     │
│    Le produit passe `available: false` sur la Salle     │
└────────────────────────────────────────────────────────┘
```

#### 1. Objectifs & Enjeux Métier

1. **Décompte automatique et transparent** : Chaque plat ou formule commandé décrémente instantanément les stocks des ingrédients qui le composent sans saisie manuelle.
2. **Fiches techniques & Maîtrise des coûts** : Pour chaque plat, calcul instantané du coût portion (Food Cost), du taux de marge brute (%) et du coefficient multiplicateur en fonction du prix d'achat HT des ingrédients.
3. **Prévention des ruptures en plein service** :
   - Badges visuels en temps réel en Salle (ex. : *"Plus que 4 portions"*).
   - Bascule automatique en rupture de stock (`available = false`) dès qu'un ingrédient critique est épuisé, empêchant les serveurs de vendre un plat infaisable.
4. **Traçabilité totale des flux (Audit Trail)** :
   - Entrées de stock (réceptions fournisseurs avec prix d'achat pour actualisation du coût moyen unitaire).
   - Sorties automatiques (commandes clients).
   - Démarque et pertes (gâchis, casse, DLC dépassée avec motif obligatoire).
   - Régularisations d'inventaire périodiques.

---

#### 2. Modélisation des Données (Schéma Prisma)

Le schéma Prisma sera étendu avec 3 nouveaux modèles relationnels et une relation bidirectionnelle sur `Product` :

```prisma
// ==========================================
// NOUVEAUX MODÈLES PHASE 2 : STOCKS & RECETTES
// ==========================================

model Ingredient {
  id             String          @id @default(uuid())
  name           String          // Ex: "Steak haché pur bœuf 180g", "Tomates fraîches"
  category       String          // "Boucherie", "Maraîchage", "Épicerie", "Crémerie", "Boissons"...
  unit           String          // Unité standard : "g", "kg", "ml", "cl", "l", "piece"
  currentStock   Float           @default(0)   // Stock physique restant
  minThreshold   Float           @default(5)   // Seuil d'alerte critique
  idealStock     Float           @default(20)  // Niveau de commande idéal
  costPerUnit    Float           @default(0)   // Prix d'achat HT unitaire de référence (€)
  supplier       String?         // Nom du fournisseur principal (ex: "Transgourmet", "Métro")
  supplierRef    String?         // Référence catalogue fournisseur
  updatedAt      DateTime        @updatedAt
  createdAt      DateTime        @default(now())

  recipeItems    RecipeItem[]
  movements      StockMovement[]
}

model RecipeItem {
  id           String      @id @default(uuid())
  productId    String
  product      Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient  @relation(fields: [ingredientId], references: [id], onDelete: Restrict)
  quantity     Float       // Quantité nette par portion (ex: 180 pour 180g, 1 pour 1 pièce)
  unit         String      // Unité de dosage ("g", "ml", "piece"...)
  isCritical   Boolean     @default(true) // Si épuisé -> bloque immédiatement la vente du plat
  notes        String?     // Remarques de préparation (ex: "Poids avant cuisson")

  @@unique([productId, ingredientId])
}

model StockMovement {
  id           String      @id @default(uuid())
  ingredientId String
  ingredient   Ingredient  @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  type         String      // "ORDER_CONSUMPTION" | "DELIVERY" | "WASTE" | "ADJUSTMENT" | "CANCEL_RETURN"
  quantity     Float       // Quantité (+ pour entrée/livraison, - pour conso/perte)
  unitCost     Float?      // Coût unitaire d'achat au moment du mouvement
  orderId      String?     // Lié à une commande si ORDER_CONSUMPTION
  staffId      String?     // Auteur de l'action pour audit
  reason       String?     // Motif obligatoire en cas de perte/ajustement ("Casse", "Erreur cuisson", "Inventaire mensuel")
  createdAt    DateTime    @default(now())
}
```

---

#### 3. Formules Économiques & Fiches Techniques

Le module de fiches techniques intègre un moteur de calcul financier en temps réel :

1. **Coût Portion (Food Cost unitaire)** :
   $$C_{\text{portion}} = \sum_{i=1}^{n} \left( Q_i \times P_i \right)$$
   *Où \(Q_i\) est la quantité de l'ingrédient \(i\) et \(P_i\) son coût d'achat unitaire ramené à l'unité de recette.*

2. **Marge Brute (€)** :
   $$MB = PV_{\text{HT}} - C_{\text{portion}}$$
   *Avec \(PV_{\text{HT}} = \frac{PV_{\text{TTC}}}{1 + \tau_{\text{TVA}}}\) (\(\tau_{\text{TVA}} = 10\%\) sur la restauration assise).*

3. **Ratio Matière (% Food Cost)** :
   $$R_{\text{matière}} = \frac{C_{\text{portion}}}{PV_{\text{HT}}} \times 100$$
   - 🟢 **Optimal** : \(< 28\%\)
   - 🟡 **Standard / Vigilance** : \(28\% \text{ à } 35\%\)
   - 🔴 **Critique (Marge érodée)** : \(> 35\%\)

4. **Coefficient Multiplicateur TTC** :
   $$K = \frac{PV_{\text{TTC}}}{C_{\text{portion}}}$$
   *(Indicateur usuel de rentabilité en restauration, généralement ciblé entre \(3.8\) et \(4.5\)).*

---

#### 4. Moteur Backend & Événements Temps Réel

Le backend NestJS s'enrichit de deux nouveaux modules : `StockModule` et `RecipesModule`.

##### Logique Transactionnelle de Décompte
- Lors de l'émission de l'événement `order:send_kitchen` :
  1. Le backend résout tous les `RecipeItem` associés aux plats de la commande (y compris les choix d'articles des menus composés).
  2. Une transaction Prisma atomique (`prisma.$transaction`) décrémente chaque `currentStock`.
  3. Des lignes de `StockMovement` de type `ORDER_CONSUMPTION` sont générées avec l'identifiant de la commande et du serveur.
  4. Si un ingrédient passe sous `minThreshold`, un événement WebSocket `stock:low_alert` est diffusé.
  5. Si un ingrédient `isCritical` atteint `0`, le produit passe `available: false` et un événement `catalog:product_status` est broadcasté à tous les terminaux.
- En cas d'annulation de commande avant cuisson (état `draft` ou `new`), une restauration de stock est possible via le type `CANCEL_RETURN`.

##### Événements WebSocket de la Passerelle (Gateway)
| Événement Socket.IO | Direction | Description |
|---------------------|-----------|-------------|
| `stock:list` | Client ➔ Serveur | Demande de l'état initial des stocks à l'ouverture de l'écran. |
| `stock:sync` | Serveur ➔ Client | Payload complet des stocks et alertes actuelles. |
| `stock:updated` | Serveur ➔ Tous | Notification d'un ou plusieurs stocks modifiés (post-commande ou livraison). |
| `stock:alert` | Serveur ➔ Tous | Toast d'urgence : seuil critique franchi ou rupture avérée. |
| `stock:movement_logged` | Serveur ➔ Gestion | Nouvel élément ajouté au journal d'audit des flux. |
| `recipe:save` | Client ➔ Serveur | Création ou mise à jour d'une fiche technique produit. |

---

#### 5. Parcours Utilisateurs & Nouveaux Écrans

1. **Back-office : Vue "Stocks & Inventaire"**
   - **Dashboard synthétique** : Valeur totale du stock immobilisé (€ HT), nombre de références en alerte, top des ingrédients les plus consommés.
   - **Tableau des Ingrédients** : recherche instantanée, filtres par catégorie et état (Tous, 🟢 OK, 🟡 Alerte, 🔴 Rupture).
   - **Modale d'Entrée de stock (Livraison)** : sélection fournisseur, saisie quantité reçue et prix unitaire facturé.
   - **Modale de Perte / Casse** : saisie rapide avec motif réglementaire obligatoire.
   - **Journal des Mouvements** : historique chronologique complet avec filtres et export CSV.

2. **Back-office : Vue "Fiches Techniques & Marges"**
   - Sélection d'un produit du catalogue existant.
   - Composition pas-à-pas de la recette : ajout des ingrédients par auto-complétion, saisie des dosages.
   - Jauge dynamique de rentabilité : calcul instantané du coût de revient, de la marge brute et du Food Cost %.
   - Simulateur de prix : suggestion du prix de vente TTC idéal selon le coefficient cible du restaurant.

3. **Salle & Prise de commande (Impact opérationnel)**
   - **Badges de stock restant** : pastille discrète *"Plus que X"* lorsque le stock approche du seuil critique.
   - **Désactivation instantanée** : tuile grisée avec mention *"Épuisé"* dès confirmation de la rupture par le serveur, prévenant toute commande impossible.
   - **Gestion d'accès concurrent** : si deux serveurs commandent la dernière portion à la même seconde, le premier valide et le second reçoit un toast explicatif bienveillant l'invitant à réorienter le client.

---

#### 6. Checklist Opérationnelle d'Implémentation

- [ ] **2.1. Schéma Prisma & Migrations**
  - [ ] Déclarer les modèles `Ingredient`, `RecipeItem`, `StockMovement` dans `server/prisma/schema.prisma`.
  - [ ] Appliquer la migration de base de données (`npm run db:push`).
  - [ ] Rédiger les graines de démonstration (`server/prisma/seed.ts`) avec ~25 ingrédients réels et les fiches techniques associées aux plats emblématiques du restaurant.
- [ ] **2.2. Services Backend NestJS**
  - [ ] Créer `server/src/stock/` : contrôleur REST, service de gestion des stocks, gestion des entrées/sorties et DTOs de validation.
  - [ ] Créer `server/src/recipes/` : contrôleur REST, service de calcul des coûts et gestion des fiches techniques.
- [ ] **2.3. Moteur Temps Réel & Décompte Transactionnel**
  - [ ] Connecter le `WebsocketGateway` pour intercepter les commandes validées et déclencher le décompte atomique.
  - [ ] Émettre les événements de seuil critique et de rupture automatique.
  - [ ] Implémenter la logique de remise en stock sur annulation de plat.
- [ ] **2.4. Composant Back-office : Stocks & Inventaire**
  - [ ] Créer `src/views/gestion/StockManager.jsx` intégré dans l'interface de Gestion.
  - [ ] Développer la modale de réassort (livraison) et de déclaration des pertes.
  - [ ] Afficher le journal d'audit des mouvements horodatés.
- [ ] **2.5. Composant Back-office : Fiches Techniques & Simulateur**
  - [ ] Créer `src/views/gestion/RecipeManager.jsx` pour éditer les recettes associées aux produits.
  - [ ] Intégrer les indicateurs financiers visuels (Food Cost %, Marge unitaire, Coefficient multiplicateur).
- [ ] **2.6. Intégration Salle & Alertes Visuelles**
  - [ ] Adapter `OrderTaking.jsx` pour afficher les badges de disponibilité et gérer le verrouillage en cas de rupture.
  - [ ] Déclencher un toast d'alerte doux lorsqu'un plat passe indisponible pendant le service.
- [ ] **2.7. Tests de Validation & Recette Métier**
  - [ ] Simuler la commande de burgers et vérifier la baisse exacte des steaks, pains et sauces.
  - [ ] Vérifier le passage automatique en indisponible d'un plat lors de l'épuisement d'un ingrédient critique.
  - [ ] Valider l'intégrité de l'affichage sur tablettes multiples simultanées.

---

## 📂 Architecture du Code

```text
RestoFlow/
├── index.html                  # Point d'entrée HTML de la SPA React
├── package.json                # Dépendances & scripts npm frontend
├── vite.config.js              # Configuration Vite & Tailwind CSS v4
├── public/                     # Ressources statiques (favicon, icônes)
│
├── server/                     # Backend NestJS & Synchronisation Temps Réel
│   ├── package.json            # Dépendances backend (@nestjs, @prisma/client, socket.io)
│   ├── nest-cli.json           # Configuration du CLI NestJS
│   ├── tsconfig.json           # Configuration TypeScript backend
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma ORM complet (Tables, Staff, Orders, Stocks, Recettes...)
│   │   ├── dev.db              # Base de données SQLite locale de développement
│   │   └── seed.ts             # Script d'ensemencement des données (équipiers, carte, stocks)
│   └── src/
│       ├── main.ts             # Bootstrap NestJS & configuration CORS (port 3001)
│       ├── app.module.ts       # Module racine assemblant tous les domaines applicatifs
│       ├── prisma/             # Service Prisma partagé pour l'accès aux données
│       ├── websocket/          # Passerelle Socket.IO centrale (événements multi-écrans)
│       ├── auth/               # Vérification du code PIN et session équipier
│       ├── tables/             # API REST tables & réservations
│       ├── orders/             # API REST & gestion de cycle de vie des commandes
│       ├── catalog/            # API REST produits, catégories et menus
│       ├── staff/              # API REST membres de l'équipe et rôles
│       ├── stock/              # (Phase 2) Moteur de décompte, inventaire & alertes de seuil
│       └── recipes/            # (Phase 2) Fiches techniques, calculs de food cost & marges
│
└── src/                        # Client Frontend React 19 SPA
    ├── main.jsx                # Montage React dans le DOM
    ├── App.jsx                 # Orchestrateur d'état global, écoutes Socket.IO & sécurité PIN
    ├── App.css                 # Styles de mise en page
    ├── index.css               # Imports Tailwind CSS
    │
    ├── components/             # Composants d'interface partagés
    │   ├── TopNav.jsx          # Barre supérieure (poste, profil actif, badge statut, son)
    │   ├── ConnectionBadge.jsx # Indicateur visuel d'état de connexion Socket.IO
    │   ├── PinPadModal.jsx     # Clavier numérique virtuel tactile pour saisie du PIN
    │   ├── Modal.jsx           # Modale générique réutilisable
    │   ├── ToastStack.jsx      # Pile de notifications toast animées
    │   └── GlobalStyle.jsx     # Typographies et règles CSS globales
    │
    ├── services/               # Services réseau et persistance locale
    │   ├── socket.js           # Client Socket.IO et synchronisation temps réel
    │   └── actionQueue.js      # File d'attente (buffer) offline et rejeu automatique
    │
    ├── views/                  # Écrans principaux par domaine métier
    │   ├── salle/
    │   │   ├── FloorPlan.jsx   # Plan de salle interactif (desktop 2D / grille mobile)
    │   │   ├── OrderTaking.jsx # Prise de commande tactile, badges stock & allergènes
    │   │   └── PaymentModal.jsx# Module d'encaissement et partage de note (4 modes)
    │   ├── cuisine/
    │   │   └── CuisineShell.jsx# KDS cuisine (Kanban, Par table, alertes timers)
    │   └── gestion/
    │       ├── Dashboard.jsx   # Tableau de bord analytique et KPIs (Recharts)
    │       ├── Gestion.jsx     # Back-office (Tables, Produits, Menus, Historique)
    │       ├── StaffRoleManager.jsx # Équipe, codes PIN et matrice RBAC
    │       ├── StockManager.jsx# (Phase 2) Vue Stocks, réapprovisionnement & inventaire
    │       └── RecipeManager.jsx# (Phase 2) Fiches techniques & simulateur de marge
    │
    ├── hooks/                  # Hooks React réutilisables
    │   └── index.js            # useBeep (audio), useNow (horloge), useContainerWidth
    ├── data/                   # Données de repli hors-ligne et graines initiales
    │   ├── categories.js       # Catégories de produits
    │   ├── products.js         # Catalogue de produits & allergènes
    │   ├── tables.js           # Configuration initiale des tables
    │   ├── staff.js            # Données de personnel, rôles et permissions
    │   └── seed.js             # Initialisation locale de secours
    └── utils/
        ├── index.js            # Formatage monétaire, calculs de délais, logique métier
        └── permissions.js      # Matrice RBAC et vérificateurs de droits d'accès
```

---

## ⚡ Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) version **18.x** ou supérieure (recommandé : **20+**)
- Un gestionnaire de paquets (`npm`, `pnpm` ou `yarn`)

### Installation & Lancement

Le projet fonctionne en architecture Fullstack composée du serveur **NestJS** (backend & Socket.IO) et du client **Vite / React** (frontend).

#### 1. Démarrer le Serveur Backend (NestJS & Prisma)

Dans un premier terminal :

```bash
# 1. Naviguer dans le dossier du serveur
cd server

# 2. Installer les dépendances backend
npm install

# 3. Synchroniser la base de données SQLite locale avec Prisma
npm run db:push

# 4. Ensemencer la base avec les données de démonstration
npm run db:seed

# 5. Lancer le serveur NestJS en mode développement (hot-reload)
npm run start:dev
```
*Le serveur démarrera sur `http://localhost:3001` et initialisera la passerelle WebSocket.*

#### 2. Démarrer le Client Frontend (React & Vite)

Dans un second terminal :

```bash
# 1. Revenir à la racine du projet RestoFlow
cd RestoFlow

# 2. Installer les dépendances du frontend
npm install

# 3. Lancer l'application React
npm run dev
```
*L'application sera accessible immédiatement sur `http://localhost:5173`.*

#### 3. Autres scripts disponibles
```bash
npm run build     # Compile le frontend React pour la production (dossier dist/)
npm run preview   # Prévisualise la version de production frontend en local
npm run lint      # Analyse le code frontend avec Oxlint

cd server && npm run build  # Compile le serveur NestJS (dossier dist/)
```

---

## 📜 Principes & Règles Métier

1. **Intégrité de la commande** : Un article envoyé en cuisine (`new` ou `preparing`) ne peut plus être modifié silencieusement ; toute annulation ou ajustement doit être tracé et horodaté.
2. **Priorité aux alertes d'allergie** : Les avertissements d'allergènes sont injectés visuellement à la fois lors de la saisie en salle et sur les tickets du KDS cuisine.
3. **Équité absolue du calcul d'addition** : En mode partage de note à parts égales, le reste des centimes non divisibles est réparti équitablement sur les premières parts de manière transparente.
4. **Calcul dynamique du temps** : Les durées et chronomètres ne sont pas incrémentés dans un état persistant, mais calculés à la volée par rapport à un timestamp d'émission serveur (`Date.now() - sentAt`), garantissant l'exactitude de l'information même après reconnexion.
5. **Ergonomie "Coup de feu"** : Chaque écran est conçu pour minimiser le nombre de clics requis pour accomplir les actions les plus fréquentes (envoi cuisine, validation de plat, encaissement rapide).
6. **Décompte atomique & Intégrité des stocks (Phase 2)** : Tout envoi de commande en cuisine décrémente instantanément les ingrédients des fiches techniques associées au sein d'une transaction Prisma ACID, sans risque de double comptage.
7. **Rupture proactive en cascade (Phase 2)** : Dès qu'un ingrédient marqué `isCritical` atteint un stock nul, tous les plats et menus dépendants basculent immédiatement en statut indisponible (`available: false`) et sont grisés en Salle.
8. **Traçabilité totale des flux (Pertes & Inventaire - Phase 2)** : Aucune variation de stock physique ne s'opère sans l'enregistrement d'un `StockMovement` horodaté, qualifié (consommation, livraison, démarque, inventaire) et signé par l'équipier responsable.
9. **Surveillance du Food Cost & Rentabilité (Phase 2)** : Le coût de revient portion et le ratio matière sont recalculés dynamiquement selon les cours d'achat réels des ingrédients, garantissant la préservation des marges de l'établissement.

---

*Développé avec passion pour simplifier le quotidien des professionnels de la restauration.* 🍷👨‍🍳
