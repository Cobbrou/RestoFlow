# 🍽️ RestoFlow

> **Application moderne de gestion de commandes et d'orchestration de restaurant physique.**  
> Fluidifie la coordination en temps réel entre la **Salle** (serveurs), la **Cuisine** (KDS) et la **Gestion** (back-office & direction).

---

![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-3.10-22B5BF)
![Licence](https://img.shields.io/badge/Licence-Propriétaire-orange)
![Statut](https://img.shields.io/badge/Statut-En%20Développement%20Actif-success)

---

## 📌 Sommaire

1. [Contexte initial du projet](#-contexte-initial-du-projet)
2. [Fonctionnalités clés (Features)](#-fonctionnalités-clés-features)
   - [🛎️ Salle & Prise de commande](#1-salle--prise-de-commande)
   - [💳 Caisse & Encaissement multi-modes](#2-caisse--encaissement-multi-modes)
   - [🍳 Cuisine (KDS - Kitchen Display System)](#3-cuisine-kds---kitchen-display-system)
   - [📊 Tableau de bord (Dashboard)](#4-tableau-de-bord-dashboard)
   - [📦 Stocks, Ingrédients & Fiches Techniques](#5-stocks-ingrédients--fiches-techniques)
   - [👥 Équipe, Sécurité & Droits d'accès (RBAC)](#6-équipe-sécurité--droits-daccès-rbac)
   - [⚡ Synchronisation Temps Réel & Mode Déconnecté](#7-synchronisation-temps-réel--mode-déconnecté)
3. [Stack Technique](#-stack-technique)
4. [Prochaines Features & Roadmap](#-prochaines-features--roadmap)
   - [Jalons de la Roadmap (v1.0)](#jalons-de-la-roadmap-v10)
   - [Perspectives & Idées futures (Post-v1.0)](#perspectives--idées-futures-post-v10)
5. [Architecture du Projet](#-architecture-du-projet)
6. [Démarrage Rapide](#-démarrage-rapide)
7. [Règles Métier Clés](#-règles-métier-clés)

---

## 🎯 Contexte initial du projet

Dans la restauration physique traditionnelle, les dysfonctionnements proviennent souvent de la perte d'information entre la salle et la cuisine : tickets papier égarés ou illisibles, retards de transmission, difficultés de gestion des modifications ou des allergies de dernière minute, et frictions lors du partage de l'addition au moment de l'encaissement.

**RestoFlow** a été conçu comme une solution numérique clé en main destinée à être déployée sur les tablettes et écrans tactiles de l'établissement :
- **Pour les serveurs en salle** : prise de commande rapide au doigt, visualisation dynamique des tables, transmission instantanée en cuisine sans allers-retours superflus.
- **Pour la brigade en cuisine** : affichage lisible (KDS) des commandes à préparer, alertes sur les temps d'attente, détection des allergènes et notification sonore lors de l'arrivée de nouveaux bons.
- **Pour le gérant / manager** : vue à 360° en temps réel sur le chiffre d'affaires, le panier moyen, la rotation des tables, la rentabilité des plats (fiches techniques & food cost), la gestion des stocks et les permissions de l'équipe.

---

## 🚀 Fonctionnalités clés (Features)

### 1. 🛎️ Salle & Prise de commande
- **Plan de salle interactif (FloorPlan)** :
  - *Affichage double mode* : disposition libre 2D des tables (desktop) ou grille tactile réactive 2 colonnes (tablettes / smartphones).
  - *Statuts visuels en direct* : codes couleur instantanés (**Libre**, **Occupée**, **En attente**, **Prête** avec animation de pulsation, **Alerte** avec flash).
  - *Réservations* : indication visuelle de l'heure, du nom du client et du nombre de couverts réservés.
  - *Signalement d'incident* : déclenchement d'une alerte sur une table par simple clic droit ou appui long.
- **Prise de commande intuitive (OrderTaking)** :
  - Catalogue produits organisé par catégories (Entrées, Plats, Desserts, Boissons, Formules) avec recherche instantanée.
  - Gestion des **menus composés** pas-à-pas (sélection des entrées, plats et desserts).
  - Ajustement des quantités, suppression d'articles et ajout de **notes spécifiques** pour la cuisine (ex. : *"Cuisson à point"*, *"Sans sel"*).
  - **Détection automatique des allergènes** : analyse intelligente des notes et de la fiche produit pour afficher des badges d'alerte (Gluten, Lactose, Fruits à coque...).
  - Suivi du cycle de vie des articles : `Brouillon` ➔ `Envoyé` ➔ `En préparation` ➔ `Prêt` ➔ `Servi`.
  - **Gestion des stocks en direct** : badges d'avertissement de stock restant (*"Plus que X portions"*) et verrouillage automatique des plats en rupture.

### 2. 💳 Caisse & Encaissement multi-modes
Le module d'encaissement (`PaymentModal`) propose **4 modes de partage d'addition** pour accélérer le départ des clients :
1. **Paiement unique** : règlement direct de la note totale en un clic (Carte, Espèces, Autre).
2. **Parts égales** : division automatique entre 2 et 20 convives avec lissage équitable des centimes résiduels.
3. **Par article (Split itemisé)** : affectation nominative des plats et boissons à chaque convive avec calcul du sous-total.
4. **Montant libre / Proportionnel** : paiement libre en plusieurs règlements successifs (% ou montant saisi), avec suivi du reste à payer.
- Génération d'un **ticket de caisse dématérialisé (reçu)** complet.
- Libération automatique de la table et archivage dans le journal de caisse après règlement.

### 3. 🍳 Cuisine (KDS - Kitchen Display System)
- **Interface sombre immersive (`#14110D`)** : optimisée pour réduire la fatigue oculaire et maximiser la lisibilité dans l'ambiance de cuisine.
- **Deux modes d'affichage** :
  - *Board Kanban* : répartition des commandes en 3 colonnes de flux (**Nouvelles**, **En préparation**, **Prêtes**).
  - *Vue Par table* : regroupement consolidé des plats d'une même table pour un départ groupé.
- **Chronomètre d'urgence en direct (TicketTimer)** : vert (< 10 min), ambre (10-20 min), rouge clignotant (> 20 min).
- **Notifications audio & toasts** : signal sonore distinct (synthèse Web Audio API) et notification toast lors de l'arrivée d'un bon ou du passage à l'état prêt.

### 4. 📊 Tableau de bord (Dashboard)
- **KPIs en temps réel** : Chiffre d'affaires cumulé, nombre de commandes traitées, panier moyen et taux d'occupation des tables.
- **Graphiques d'analyse (Recharts)** :
  - Évolution du chiffre d'affaires sur les 7 derniers jours (AreaChart).
  - Répartition instantanée des commandes en cuisine (PieChart).
  - Top des produits les plus vendus (BarChart horizontal).
- **Filtres temporels** : *Aujourd'hui*, *Cette semaine*, *Historique complet*.

### 5. 📦 Stocks, Ingrédients & Fiches Techniques
- **Gestion des Stocks (`StockManager`)** :
  - Suivi des ingrédients avec quantités réelles, unités de mesure (`g`, `ml`, `pièce`...) et seuils d'alerte critique.
  - Décompte automatique des stocks à chaque commande envoyée en cuisine via transaction ACID.
  - Modale de réassort (livraisons fournisseurs avec mise à jour du prix d'achat).
  - Enregistrement des pertes et démarque (casse, péremption) avec motif réglementaire.
  - Journal d'audit chronologique de tous les mouvements de stock.
- **Fiches Techniques & Food Cost (`RecipeManager`)** :
  - Définition de la recette de chaque plat avec dosage précis de chaque ingrédient.
  - Calcul dynamique du coût de revient portion (**Food Cost**), de la marge brute unitaire (€) et du coefficient multiplicateur.
  - Marqueur d'ingrédient critique : bascule automatique du plat en rupture dès épuisement de l'ingrédient.

### 6. 👥 Équipe, Sécurité & Droits d'accès (RBAC)
- **Authentification par Code PIN individuel** :
  - Clavier numérique tactile virtuel (`PinPadModal`) permettant un changement d'opérateur rapide entre deux prises de commande.
  - Masquage / affichage sécurisé du code PIN.
- **Gestion fine des Rôles & Permissions (`StaffRoleManager`)** :
  - Rôles personnalisables (Serveur, Chef de rang, Cuisine, Manager, Admin) avec palette de couleurs.
  - Matrice granulaire de permissions découpée par domaine : Salle, Cuisine, Gestion, Caisse et Administration.

### 7. ⚡ Synchronisation Temps Réel & Mode Déconnecté
- **Passerelle WebSockets (Socket.IO)** : diffusion instantanée de tous les événements (nouvelles commandes, changements de statut, alertes de stock, règlements).
- **Tolérance aux pannes réseau** :
  - Indicateur visuel d'état de connexion (`ConnectionBadge`).
  - File d'attente d'actions hors-ligne (`actionQueue`) avec rejeu automatique et synchronisation dès le rétablissement du réseau.

---

## 🛠️ Stack Technique

### Frontend SPA
| Outil | Rôle |
|---|---|
| **React 19** | Bibliothèque UI moderne avec hooks réactifs |
| **Vite 8** | Environnement de développement et bundler ultra-rapide |
| **Tailwind CSS v4** | Moteur de styles utility-first optimisé avec `@tailwindcss/vite` |
| **Recharts 3** | Graphiques interactifs du tableau de bord |
| **Lucide React** | Bibliothèque d'icônes vectorielles cohérente |
| **Socket.IO Client** | Connexion bidirectionnelle temps réel avec gestion de reconnexion |
| **Oxlint** | Linter Rust haute performance pour l'intégrité du code |
| **Web Audio API** | Synthèse sonore native pour les alertes de service et de cuisine |

### Backend Applicatif
| Outil | Rôle |
|---|---|
| **NestJS 10 (TypeScript)** | Framework backend structuré et modulaire avec injection de dépendances |
| **Socket.IO Gateway** | Passerelle WebSocket pour la synchronisation multi-écrans en temps réel |
| **Prisma 6 ORM** | Gestion de schéma déclaratif, migrations et requêtes typées |
| **SQLite / PostgreSQL 16** | Base de données locale de dev (`dev.db`) et cible de production PostgreSQL |
| **Auth PIN & Guards** | Contrôle d'accès et validation des permissions par rôle (RBAC) |

---

## 🔮 Prochaines Features & Roadmap

### Jalons de la Roadmap (v1.0)

| Jalon | Statut | Fonctionnalités clés |
|---|---|---|
| **Phase 1 : Socle Fullstack & Temps Réel** | 🟢 **Terminée** | NestJS, Socket.IO Gateway, Prisma, authentification PIN, buffer offline avec synchronisation automatique. |
| **Phase 2 : Stocks & Fiches Techniques** | 🟢 **Terminée** | Gestion des ingrédients, décompte automatique des stocks, fiches techniques, calcul du food cost et alertes de rupture. |
| **Phase 3 : Impression, Caisse Pro & Réductions** | 🟡 **Prochaine étape** | Imprimantes thermiques ESC/POS (bar, cuisine, caisse), liaison TPE bancaire, **tickets de caisse professionnels** (mentions légales, TVA détaillée, logo) et **codes promo / remises** (% ou montant fixe). |
| **Phase 4 : Réservations en Ligne & Salle** | 🔵 Planifiée | Widget de réservation en ligne pour les clients, affectation intelligente des tables et rappels automatiques (SMS/Email). |
| **Phase 5 : Mode PWA & Offline Complet** | 🟣 Planifiée | Service Workers, stockage local IndexedDB, fonctionnement 100% autonome garanti lors des coupures Wi-Fi prolongées. |
| **Phase 6 : Clôture de Caisse & Comptabilité** | 🔴 Planifiée | Génération des rapports Z et X de caisse certifiés, ventilation automatisée de la TVA et export comptable normalisé (FEC). |

### 💡 Perspectives & Idées futures (Post-v1.0)

Ces fonctionnalités constituent des pistes d'extension majeures envisagées pour les évolutions futures après la release 1.0 :

- 📱 **Commande à table par QR Code** : Scan d'un QR code dynamique sur la table permettant aux clients d'accéder au menu digital, de passer commande en direct depuis leur smartphone et d'alimenter immédiatement le KDS en cuisine.
- 🖥️ **Borne de commande interactive (Kiosk)** : Interface client autonome sur grand écran tactile pour la prise de commande et le paiement direct en autonomie, avec injection immédiate des bons en production.
- 🛵 **Module de Livraison intégré** : Passerelle centralisée connectée aux plateformes de livraison (Uber Eats, Deliveroo) ou module dédié pour la livraison opérée en propre par le restaurant avec suivi des courses.

---

## 📂 Architecture du Projet

```text
RestoFlow/
├── index.html                  # Point d'entrée HTML
├── package.json                # Dépendances & scripts du frontend
├── vite.config.js              # Configuration Vite & Tailwind CSS v4
│
├── server/                     # Backend NestJS & Synchronisation Temps Réel
│   ├── package.json            # Dépendances backend (@nestjs, @prisma/client, socket.io)
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma ORM (Tables, Staff, Orders, Stocks, Recettes...)
│   │   ├── dev.db              # Base SQLite de développement
│   │   └── seed.ts             # Données de démonstration (carte, tables, équipiers, stocks)
│   └── src/
│       ├── main.ts             # Démarrage du serveur NestJS (port 3001)
│       ├── app.module.ts       # Module racine
│       ├── websocket/          # Passerelle Socket.IO centrale (diffusion multi-écrans)
│       ├── auth/               # Authentification par code PIN
│       ├── tables/             # API tables & réservations
│       ├── orders/             # API commandes & cycle de vie
│       ├── catalog/            # API produits, catégories et menus
│       ├── staff/              # API personnel & rôles RBAC
│       ├── stock/              # Moteur de stocks, inventaire et alertes
│       └── recipes/            # Fiches techniques et calcul du food cost
│
└── src/                        # Client Frontend React 19 SPA
    ├── main.jsx                # Montage de l'application
    ├── App.jsx                 # État global, gestion des rôles et écoutes Socket.IO
    ├── components/             # Composants partagés (TopNav, PinPadModal, ToastStack, Modal...)
    ├── services/               # Services réseau (socket.js, actionQueue.js pour le offline)
    ├── views/
    │   ├── salle/              # Plan de salle (FloorPlan), commande (OrderTaking), caisse (PaymentModal)
    │   ├── cuisine/            # Écran cuisine KDS (CuisineShell, tickets, timers)
    │   └── gestion/            # Dashboard, Gestion, StockManager, RecipeManager, StaffRoleManager
    ├── hooks/                  # Hooks (useBeep, useNow, useContainerWidth)
    └── utils/                  # Utilitaires monétaires, calculs d'état et vérificateurs de permissions
```

---

## ⚡ Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) version **20+** recommandé (minimum 18.x)
- `npm` (inclus avec Node.js)

### 1. Démarrer le Serveur Backend (NestJS)

Dans un premier terminal :

```bash
cd server
npm install
npm run db:push     # Synchronise la base de données SQLite locale avec Prisma
npm run db:seed     # Charge les données de démonstration complètes
npm run start:dev   # Lance le serveur NestJS sur http://localhost:3001
```

### 2. Démarrer le Client Frontend (React / Vite)

Dans un second terminal :

```bash
npm install
npm run dev         # Lance le frontend sur http://localhost:5173
```

### 3. Autres scripts utiles

```bash
npm run build               # Compile le client frontend pour la production
npm run lint                # Vérifie le code client avec Oxlint
cd server && npm run build  # Compile le serveur NestJS
```

---

## 📜 Règles Métier Clés

1. **Intégrité de la commande** : Un article envoyé en cuisine (`new` ou `preparing`) ne peut plus être modifié silencieusement ; toute modification ou annulation est tracée.
2. **Priorité aux alertes d'allergie** : Les avertissements d'allergènes sont affichés de façon prioritaire lors de la saisie en salle et sur les tickets du KDS cuisine.
3. **Équité absolue du partage de note** : En division à parts égales, les centimes résiduels sont lissés équitablement et de manière transparente.
4. **Décompte atomique des stocks** : Tout envoi de commande en cuisine décrémente automatiquement les ingrédients des recettes associées au sein d'une transaction sécurisée.
5. **Rupture proactive** : Dès qu'un ingrédient critique est épuisé, tous les plats et menus dépendants sont instantanément marqués indisponibles en salle.
6. **Traçabilité des pertes** : Toute modification manuelle de stock (démarque, casse, régularisation d'inventaire) nécessite la saisie d'un motif et l'identification de l'opérateur.

---

*Développé pour simplifier le quotidien et maximiser la rentabilité des professionnels de la restauration.* 🍷👨‍🍳
