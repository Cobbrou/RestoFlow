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
   - [💳 Caisse Pro, Encaissement multi-modes & TPE](#2-caisse-pro-encaissement-multi-modes--tpe)
   - [🖨️ Impression Thermique ESC/POS](#3-impression-thermique-escpos)
   - [🍳 Cuisine (KDS - Kitchen Display System)](#4-cuisine-kds---kitchen-display-system)
   - [📊 Tableau de bord (Dashboard)](#5-tableau-de-bord-dashboard)
   - [📦 Stocks, Ingrédients & Fiches Techniques](#6-stocks-ingrédients--fiches-techniques)
   - [👥 Équipe, Sécurité & Droits d'accès (RBAC)](#7-équipe-sécurité--droits-daccès-rbac)
   - [⚡ Synchronisation Temps Réel & Mode Déconnecté](#8-synchronisation-temps-réel--mode-déconnecté)
3. [Stack Technique](#-stack-technique)
4. [Prochaines Features & Roadmap](#-prochaines-features--roadmap)
   - [Jalons de la Roadmap (v1.0)](#jalons-de-la-roadmap-v10)
   - [Perspectives & Idées futures (Post-v1.0)](#perspectives--idées-futures-post-v10)
5. [Axes d'Amélioration & Correctifs Identifiés](#-axes-damélioration--correctifs-identifiés)
   - [🔒 Sécurité & Gestion des PINs](#1-sécurité--gestion-des-codes-pin-prioritaire)
   - [🏗️ Refactorisation Backend & Découpage Modulaire](#2-refactorisation-backend--découpage-modulaire)
   - [⚛️ Architecture Frontend & Gestion d'État](#3-architecture-frontend--gestion-détat)
   - [🖨️ Impression Réseau Hardware Directe](#4-impression-réseau-hardware-directe-tcp-raw)
   - [🧪 Tests Automatisés & Fiabilité Financière](#5-tests-automatisés--fiabilité-financière)
6. [Architecture du Projet](#-architecture-du-projet)
7. [Démarrage Rapide](#-démarrage-rapide)
8. [Règles Métier Clés](#-règles-métier-clés)

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

### 2. 💳 Caisse Pro, Encaissement multi-modes & TPE
Le module d'encaissement (`PaymentModal`) propose **4 modes de partage d'addition** pour accélérer le départ des clients :
1. **Paiement unique** : règlement direct de la note totale en un clic (Carte, Espèces, Autre).
2. **Parts égales** : division automatique entre 2 et 20 convives avec lissage équitable des centimes résiduels.
3. **Par article (Split itemisé)** : affectation nominative des plats et boissons à chaque convive avec calcul du sous-total.
4. **Montant libre / Proportionnel** : paiement libre en plusieurs règlements successifs (% ou montant saisi), avec suivi du reste à payer.
- **Simulateur TPE bancaire interactif (`TpeModal`)** : flux réaliste de paiement par Carte Bancaire avec animations de paiement sans-contact (NFC) et puce EMV + code PIN, gestion des échecs et génération de télécollecte.
- **Gestion des remises & codes promotionnels (`DiscountModal`)** : application de remises en pourcentage ou montant fixe, codes promo enregistrés (`HAPPYHOUR`, `STAFF`, `FIDELITE10`...) ou motif libre avec validation par rôle.
- **Moteur de ventilation fiscale de la TVA** : décomposition normalisée de la TVA (taux réduit à 10% sur l'alimentaire et softs, taux normal à 20% sur les alcools) avec répartition proportionnelle au centime près des remises appliquées.
- **Numérotation séquentielle certifiée** : attribution automatique d'un numéro d'ordre unique chronologique (ex. `FAC-2026-0001`).

### 3. 🖨️ Impression Thermique ESC/POS
- **Générateur binaire ESC/POS (`escpos.js`)** : création de flux d'instructions normalisés pour imprimantes thermiques compatibles 80mm et 58mm (Epson, Star Micronics, Munbyn...).
- **4 formats de tickets dédiés** :
  - *Ticket client (Note / Facturette)* : mentions légales obligatoires, coordonnées complètes, détail des articles, ventilation TVA et pied de page personnalisé.
  - *Bon de commande cuisine (KDS ticket)* : gros caractères gras, table, heure d'envoi, cuisson et allergènes mis en avant.
  - *Bon de commande bar* : format compact 58mm pour le barman.
  - *Ticket commerçant TPE* : récapitulatif de transaction bancaire avec montant, horodatage et numéro d'autorisation.
- **Modale de prévisualisation thermique réaliste (`ThermalReceiptPreview`)** : rendu fidèle effet papier thermique avec découpe dentelée, bascule 80mm/58mm et impression directe via CSS `@media print`.
- **Gestionnaire Caisse & Imprimantes (`CaisseSettingsManager`)** : configuration back-office des coordonnées de l'établissement (SIRET, N° TVA, raison sociale), des imprimantes réseau (IP/port 9100) ou USB, et du catalogue de codes promotionnels.

### 4. 🍳 Cuisine (KDS - Kitchen Display System)
- **Interface sombre immersive (`#14110D`)** : optimisée pour réduire la fatigue oculaire et maximiser la lisibilité dans l'ambiance de cuisine.
- **Deux modes d'affichage** :
  - *Board Kanban* : répartition des commandes en 3 colonnes de flux (**Nouvelles**, **En préparation**, **Prêtes**).
  - *Vue Par table* : regroupement consolidé des plats d'une même table pour un départ groupé.
- **Chronomètre d'urgence en direct (TicketTimer)** : vert (< 10 min), ambre (10-20 min), rouge clignotant (> 20 min).
- **Notifications audio & toasts** : signal sonore distinct (synthèse Web Audio API) et notification toast lors de l'arrivée d'un bon ou du passage à l'état prêt.

### 5. 📊 Tableau de bord (Dashboard)
- **KPIs en temps réel** : Chiffre d'affaires cumulé, nombre de commandes traitées, panier moyen et taux d'occupation des tables.
- **Graphiques d'analyse (Recharts)** :
  - Évolution du chiffre d'affaires sur les 7 derniers jours (AreaChart).
  - Répartition instantanée des commandes en cuisine (PieChart).
  - Top des produits les plus vendus (BarChart horizontal).
- **Filtres temporels** : *Aujourd'hui*, *Cette semaine*, *Historique complet*.

### 6. 📦 Stocks, Ingrédients & Fiches Techniques
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

### 7. 👥 Équipe, Sécurité & Droits d'accès (RBAC)
- **Authentification par Code PIN individuel** :
  - Clavier numérique tactile virtuel (`PinPadModal`) permettant un changement d'opérateur rapide entre deux prises de commande.
  - Masquage / affichage sécurisé du code PIN.
- **Gestion fine des Rôles & Permissions (`StaffRoleManager`)** :
  - Rôles personnalisables (Serveur, Chef de rang, Cuisine, Manager, Admin) avec palette de couleurs.
  - Matrice granulaire de permissions découpée par domaine : Salle, Cuisine, Gestion, Caisse et Administration.

### 8. ⚡ Synchronisation Temps Réel & Mode Déconnecté
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
| **Phase 3 : Impression, Caisse Pro & Réductions** | 🟢 **Terminée** | Générateur thermique binaire ESC/POS (80/58mm), simulateur TPE (NFC / puce), ventilation TVA (10%/20%), remises/codes promo et modale back-office "Caisse & Imprimantes". |
| **Phase 4 : Réservations, Salle Dynamique & Service** | 🟡 **Prochaine étape** | Widget de réservation en ligne, **gestion des "Suites" & réclame** (envoi cadencé en cuisine), **fusion & transfert de tables**, et **dispatch multi-postes (KDS Bar vs KDS Cuisine)**. |
| **Phase 5 : Mode PWA & Offline Complet** | 🔵 Planifiée | Service Workers (`vite-plugin-pwa`), persistance locale IndexedDB, fonctionnement 100% autonome garanti lors des coupures prolongées. |
| **Phase 6 : Clôture de Caisse & Conformité Fiscale** | 🔴 Planifiée | Rapports Z et X journaliers certifiés, journal d'encaissement inaltérable chaîné (loi anti-fraude TVA / NF525), tarification Happy Hour programmée et export comptable (FEC). |

### 💡 Perspectives & Idées futures (Post-v1.0)

- 📱 **Commande à table par QR Code** : Scan d'un QR code dynamique sur la table permettant aux clients d'accéder au menu digital, de passer commande et de payer en direct depuis leur smartphone.
- 🖥️ **Borne de commande interactive (Kiosk)** : Interface client grand écran tactile pour la prise de commande et l'encaissement en autonomie complète.
- 🛵 **Module de Livraison intégré** : Passerelle centralisée connectée aux plateformes de livraison (Uber Eats, Deliveroo) ou module dédié pour la livraison en propre avec suivi des livreurs.
- 💵 **Gestion des Pourboires (Tips) & Répartition** : Saisie des pourboires sur TPE et calcul automatique de la répartition équitable en fin de service.

---

## 🛠️ Axes d'Amélioration & Correctifs Identifiés

L'analyse de l'architecture et du code source met en lumière plusieurs axes de consolidation prioritaires :

### 1. 🔒 Sécurité & Gestion des codes PIN (Prioritaire)
- **Suppression de l'exposition des PINs** : Dans [`server/src/websocket/websocket.gateway.ts`](file:///c:/Users/Utilisateur/Desktop/RestoFlow/server/src/websocket/websocket.gateway.ts), l'état initial diffusé par `sync:init` inclut actuellement le champ `pin: true` de tous les équipiers. Ce champ doit impérativement être exclu (`select: { pin: false }`) pour éviter toute divulgation via les DevTools du navigateur.
- **Hachage cryptographique** : Remplacer le stockage des codes PIN en clair par un hachage sécurisé (ex. `bcrypt` ou `argon2`).
- **Signature de session** : Implémenter des jetons de session (JWT éphémère ou handshake socket sécurisé) validant les droits de l'opérateur pour chaque transaction sensible.

### 2. 🏗️ Refactorisation Backend & Découpage Modulaire
- **Désengorgement de la Gateway WebSocket** : `websocket.gateway.ts` regroupe plus de 1 300 lignes contenant toute la logique métier. Il convient de déléguer ces responsabilités aux services NestJS injectables :
  - `OrdersService` : cycle de vie et modifications de commandes.
  - `StockService` : décompte atomique, alertes et pertes.
  - `BillingService` : calculs de TVA, remises, encaissement et clôtures.
  - `ConfigService` : configuration de l'établissement et des périphériques.

### 3. ⚛️ Architecture Frontend & Gestion d'État
- **Suppression du Prop Drilling dans `App.jsx`** : Le composant racine passe actuellement jusqu'à 26 props à `Gestion.jsx`. L'adoption d'un store global réactif (**Zustand**) ou de Contexts ciblés (`OrderContext`, `AuthContext`, `StockContext`) rendra le code plus lisible et maintenable.
- **Optimisation du Bundle & Code Splitting** : Le build Vite actuel produit un chunk JavaScript monolithique de ~920 ko. L'utilisation de `React.lazy` et `Suspense` pour les vues secondaires (Dashboard Recharts, Gestion, Paramètres) permettra de réduire drastiquement le temps de chargement initial sur tablettes tactiles.

### 4. 🖨️ Impression Réseau Hardware Directe (TCP Raw)
- **Passerelle d'impression directe** : Bien que le générateur de trames binaires ESC/POS soit complet (`escpos.js`), l'envoi physique vers les imprimantes réseau de caisse ou de cuisine passe actuellement par la fenêtre d'impression du navigateur.
- **Évolution recommandée** : Ajouter un service backend NestJS utilisant des sockets TCP directes (`net.Socket`) sur le port 9100 des imprimantes réseau pour imprimer instantanément et de façon totalement silencieuse dès validation d'un bon.

### 5. 🧪 Tests Automatisés & Fiabilité Financière
- **Intégration de Vitest** : Mettre en place une suite de tests unitaires et d'intégration pour sécuriser les algorithmes financiers critiques :
  - Calculs de ventilation de la TVA au centime près.
  - Répartition proportionnelle des remises et avoirs.
  - Lissage équitable des centimes lors des partages à parts égales.
  - Décrémentation atomique des stocks sous forte concurrence.

---

## 📂 Architecture du Projet

```text
RestoFlow/
├── index.html                  # Point d'entrée HTML
├── package.json                # Dépendances & scripts du frontend (React 19, Vite, Tailwind v4)
├── vite.config.js              # Configuration Vite & Tailwind CSS v4
│
├── server/                     # Backend NestJS & Synchronisation Temps Réel
│   ├── package.json            # Dépendances backend (@nestjs, @prisma/client, socket.io)
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma ORM (Tables, Staff, Orders, Stocks, Recettes, Config...)
│   │   ├── dev.db              # Base SQLite de développement
│   │   └── seed.ts             # Données de démonstration (carte, tables, équipiers, stocks, caisse)
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
    ├── components/             # Composants partagés (TopNav, PinPadModal, TpeModal, ThermalReceiptPreview...)
    ├── services/               # Services réseau (socket.js, actionQueue.js pour le offline)
    ├── views/
    │   ├── salle/              # Plan de salle (FloorPlan), commande (OrderTaking), caisse (PaymentModal, DiscountModal)
    │   ├── cuisine/            # Écran cuisine KDS (CuisineShell, tickets, timers)
    │   └── gestion/            # Dashboard, Gestion, StockManager, RecipeManager, StaffRoleManager, CaisseSettingsManager
    ├── hooks/                  # Hooks (useBeep, useNow, useContainerWidth)
    └── utils/                  # Utilitaires monétaires, calculs d'état, permissions, TVA et générateur ESC/POS
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
cd ..
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
7. **Rigueur fiscale & TVA** : Chaque encaissement applique la ventilation fiscale exacte selon la nature du produit (10% nourriture / softs, 20% alcools) avec imputation proportionnelle des remises.

---

*Développé pour simplifier le quotidien et maximiser la rentabilité des professionnels de la restauration.* 🍷👨‍🍳
