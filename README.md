# 🍽️ RestoFlow

> **Application moderne de gestion de commandes et d'orchestration de restaurant physique.**  
> Fluidifie la coordination en temps réel entre la **Salle** (serveurs), la **Cuisine** (KDS) et la **Gestion** (back-office & direction).

---

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-3.10-22B5BF)
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
   - [Stack Actuelle (Frontend SPA)](#stack-actuelle-frontend-spa)
   - [Stack Cible (Architecture Fullstack)](#stack-cible-architecture-fullstack)
4. [Prochaines Features & Roadmap](#-prochaines-features--roadmap)
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

### Stack Actuelle (Frontend SPA)

L'application actuelle est une Single Page Application moderne, performante et sans dépendance superflue :

| Rôle | Technologie | Description |
|------|-------------|-------------|
| **Framework** | [React 19](https://react.dev/) | Utilisation des dernières API React (`useMemo`, `useCallback`, Hooks modernes). |
| **Bundler / Outillage** | [Vite 8](https://vitejs.dev/) | Démarrage instantané, HMR ultra-rapide et builds optimisés. |
| **Styles & Design** | [Tailwind CSS v4](https://tailwindcss.com/) | Moteur nouvelle génération `@tailwindcss/vite`, thémage fluide et animations CSS personnalisées. |
| **Icônes** | [Lucide React](https://lucide.dev/) | Jeu d'icônes vectorielles complet, lisible et cohérent. |
| **Data Visualisation** | [Recharts 3](https://recharts.org/) | Graphiques réactifs et interactifs pour le tableau de bord d'analyse. |
| **Qualité de code** | [Oxlint](https://oxc.rs/) | Linter Rust ultra-rapide garantissant la propreté du code. |
| **Audio** | [Web Audio API](https://developer.mozilla.org/fr/docs/Web/API/Web_Audio_API) | Synthèse sonore native sans dépendance de fichiers audio externes. |

---

### Stack Cible (Architecture Fullstack)

Pour le déploiement multi-postes en restaurant avec plusieurs tablettes synchronisées, la stack cible prévoit un backend dédié avec synchronisation temps réel :

```
┌────────────────────────────────────────────────────────┐
│               Terminaux Clients (Web / PWA)            │
│  [Tablettes Salle]      [Écrans KDS]     [Poste Caisse]│
└───────────▲──────────────────▲──────────────────▲──────┘
            │                  │                  │
            │ HTTP / REST      │ WebSockets       │
            ▼                  ▼                  ▼
┌────────────────────────────────────────────────────────┐
│                   Backend (NestJS)                     │
│  • API REST (Modules, DTOs, Guards RBAC)               │
│  • Gateway WebSocket (Socket.IO / Rooms par rôle)       │
│  • Auth JWT + Codes PIN serveurs                       │
└───────────▲─────────────────────────────────────▲──────┘
            │                                     │
            ▼ Prisma ORM                          ▼
┌────────────────────────┐             ┌─────────────────┐
│   PostgreSQL 16        │             │     Redis 7     │
│ (Persistance ACID,     │             │ (Cache, Pub/Sub,│
│  Snapshots JSONB)      │             │  Verrous table) │
└────────────────────────┘             └─────────────────┘
```

| Couche | Technologie Cible | Justification technique |
|--------|-------------------|--------------------------|
| **Backend API** | **Node.js 20+ / NestJS (TypeScript)** | Architecture modulaire d'entreprise, injection de dépendances, validation DTO native et guards RBAC. |
| **Temps Réel** | **Socket.IO over NestJS Gateway** | Synchronisation bi-directionnelle instantanée (salle ⇄ cuisine), gestion de rooms et reconnexion automatique. |
| **Base de Données** | **PostgreSQL 16** | Robustesse transactionnelle ACID, intégrité référentielle, indexation avancée et stockage JSONB pour les reçus fiscaux. |
| **ORM** | **Prisma ORM** | Typage TypeScript de bout en bout, migrations versionnées et sécurité des requêtes. |
| **Cache & Événements** | **Redis 7** | Gestion des verrous temporaires (ex. : éviter que 2 serveurs ouvrent la même table simultanément) et courtier de messages. |
| **Sécurité & Auth** | **JWT (Access/Refresh) + Argon2id** | Authentification sécurisée des comptes administrateurs, complétée par une identification par code PIN rapide pour les serveurs. |
| **Déploiement** | **Docker Compose & Caddy / Nginx** | Conteneurisation de la stack complète, reverse-proxy SSL automatique et simplicité de maintenance sur site. |

---

## 🔮 Prochaines Features & Roadmap

Le projet évolue selon une feuille de route structurée en plusieurs jalons :

### 🟢 Phase 1 : Câblage Backend & Synchronisation Temps Réel *(Terminée)*
- [x] Création du serveur **NestJS** et modélisation du schéma **Prisma**.
- [x] Remplacement de l'état React local par une synchronisation **Socket.IO** multi-écrans.
- [x] Gestion des reconnexions réseau automatiques avec mise en mémoire tampon des requêtes.
- [x] Authentification par code PIN individuel à la prise de commande pour traçabilité du serveur.

### 🟢 Phase 2 : Gestion des Stocks & Fiches Techniques
- [ ] Décompte automatique des stocks d'ingrédients à chaque validation de commande.
- [ ] Alertes proactives de seuil critique (passage automatique en "Rupture de stock").
- [ ] Fiches techniques des plats avec calcul du coût matière et de la marge brute.

### 🔵 Phase 3 : Impression Matérielle & Périphériques de Caisse
- [ ] Support des imprimantes thermiques de caisse et de cuisine via protocole **ESC/POS** (réseau/USB).
- [ ] Routage d'impression différencié : les boissons vers le bar, les plats chauds vers le passe cuisine, les desserts vers la pâtisserie.
- [ ] Intégration d'un connecteur pour **Terminaux de Paiement Électronique (TPE)** bancaires.

### 🟣 Phase 4 : Réservations en Ligne & Optimisation de Salle
- [ ] Module de réservation accessible aux clients en ligne (widget intégrable).
- [ ] Algorithme d'optimisation de l'occupation des tables selon la taille des groupes et les créneaux horaires.
- [ ] Notifications de rappel par SMS / Email pour limiter le *no-show*.

### 🟠 Phase 5 : Mode Hors-Ligne Résilient (Offline-First / PWA)
- [ ] Mise en cache locale complète des données via Service Workers et IndexedDB.
- [ ] Prise de commande continue garantie même en cas de panne temporaire du réseau Wi-Fi, avec réconciliation automatique dès le rétablissement.

### 🔴 Phase 6 : Clôture de Caisse & Comptabilité Certifiée
- [ ] Clôtures de caisse journalières conformes (**Rapport Z de caisse** et X de caisse).
- [ ] Ventilation automatisée des taux de TVA (5.5%, 10%, 20%).
- [ ] Export des journaux de vente au format FEC (Fichier des Écritures Comptables) pour l'expert-comptable.

---

## 📂 Architecture du Code

```text
RestoFlow/
├── index.html                  # Point d'entrée HTML
├── package.json                # Dépendances & scripts npm
├── vite.config.js              # Configuration Vite & Tailwind CSS
├── public/                     # Ressources statiques (favicon, icônes)
├── src/
│   ├── main.jsx                # Montage de l'application React
│   ├── App.jsx                 # Composant racine, orchestration de l'état global
│   ├── App.css                 # Styles applicatifs
│   ├── index.css               # Imports Tailwind CSS
│   │
│   ├── components/             # Composants d'interface partagés
│   │   ├── TopNav.jsx          # Barre de navigation supérieure (rôles, son, statut)
│   │   ├── Modal.jsx           # Modale générique réutilisable
│   │   ├── ToastStack.jsx      # Pile de notifications toast
│   │   └── GlobalStyle.jsx     # Typographies et règles CSS globales
│   │
│   ├── views/                  # Écrans principaux par domaine métier
│   │   ├── salle/
│   │   │   ├── FloorPlan.jsx   # Plan de salle interactif (desktop 2D / mobile)
│   │   │   ├── OrderTaking.jsx # Prise de commande tactile et gestion du panier
│   │   │   └── PaymentModal.jsx# Module d'encaissement et partage de note (4 modes)
│   │   ├── cuisine/
│   │   │   └── CuisineShell.jsx# KDS cuisine (Kanban, Par table, alertes timers)
│   │   └── gestion/
│   │       ├── Dashboard.jsx   # Tableau de bord analytique et KPIs (Recharts)
│   │       ├── Gestion.jsx     # Back-office (Tables, Produits, Menus, Historique)
│   │       └── StaffRoleManager.jsx # Équipe, codes PIN et matrice de permissions
│   │
│   ├── hooks/                  # Hooks React sur-mesure
│   │   └── index.js            # useBeep (audio), useNow (horloge), useContainerWidth
│   ├── data/                   # Données de démonstration et graines initiales
│   │   ├── categories.js       # Catégories de produits
│   │   ├── products.js         # Catalogue de produits & allergènes
│   │   ├── tables.js           # Configuration initiale des tables
│   │   ├── staff.js            # Données de personnel, rôles et permissions
│   │   └── seed.js             # Initialisation des jeux d'essai
│   └── utils/
│       └── index.js            # Formatage monétaire, calculs de délais, logique métier
```

---

## ⚡ Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) version **18.x** ou supérieure
- Un gestionnaire de paquets (`npm`, `pnpm` ou `yarn`)

### Installation & Lancement

1. **Cloner le projet** (ou naviguer dans le dossier) :
   ```bash
   cd RestoFlow
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Lancer le serveur de développement local** :
   ```bash
   npm run dev
   ```
   L'application sera accessible immédiatement sur `http://localhost:5173`.

4. **Autres scripts disponibles** :
   ```bash
   npm run build     # Compile l'application pour la production (dossier dist/)
   npm run preview   # Prévisualise la version de production en local
   npm run lint      # Analyse le code avec Oxlint
   ```

---

## 📜 Principes & Règles Métier

1. **Intégrité de la commande** : Un article envoyé en cuisine (`new` ou `preparing`) ne peut plus être modifié silencieusement ; toute annulation ou ajustement doit être tracé.
2. **Priorité aux alertes d'allergie** : Les avertissements d'allergènes sont injectés visuellement à la fois lors de la saisie en salle et sur les tickets d'impression du KDS cuisine.
3. **Équité absolue du calcul d'addition** : En mode partage de note à parts égales, le reste des centimes non divisibles est réparti équitablement sur les premières parts de manière transparente.
4. **Calcul dynamique du temps** : Les durées et chronomètres ne sont pas incrémentés dans un état persistant, mais calculés à la volée par rapport à un timestamp d'émission serveur (`Date.now() - sentAt`), garantissant l'exactitude de l'information même après reconnexion.
5. **Ergonomie "Coup de feu"** : Chaque écran est conçu pour minimiser le nombre de clics requis pour accomplir les actions les plus fréquentes (envoi cuisine, validation de plat, encaissement rapide).

---

*Développé avec passion pour simplifier le quotidien des professionnels de la restauration.* 🍷👨‍🍳
