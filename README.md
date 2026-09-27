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
![PWA](https://img.shields.io/badge/PWA-Prête%20%26%20Offline-blueviolet?logo=pwa&logoColor=white)
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
   - [Détail de la Phase 8 : Modularité & Modules à la Carte](#-détail-de-la-phase-8--modularité--paramétrage-à-la-carte-feature-flags)
   - [Perspectives & Idées futures (Post-v1.0)](#perspectives--idées-futures-post-v10)
5. [Axes d'Amélioration & Correctifs Identifiés](#-axes-damélioration--correctifs-identifiés)
   - [🔒 Sécurité Backend & Guards RBAC](#1--sécurité--absence-de-guards-rbac-sur-le-backend-websocket--rest)
   - [🛡️ Validation des Données & Schémas DTO](#2-️-validation-des-données--absence-de-validationpipe-et-schémas-dto)
   - [⚡ Résilience UI & Rollback Optimiste](#3--résilience-ui--rollback-en-cas-déchec-serveur-désynchronisation-optimiste)
   - [📦 Traçabilité & Audit des Stocks](#4--traçabilité--suppression-en-cascade-des-mouvements-de-stock-dans-prisma)
   - [🔊 Fiabilité KDS & AudioContext](#5--fiabilité-kds--déblocage-de-laudiocontext-autoplay-policy-navigateurs)
   - [🪟 Concurrence Multi-terminaux (OrderTaking)](#6--concurrence-multi-terminaux--écran-fantôme-lors-dun-checkout-concurrent)
   - [🧪 Tests Automatisés & Fiabilité Financière](#7--tests-automatisés--fiabilité-financière)
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

### 8. ⚡ Synchronisation Temps Réel & Mode PWA / Offline Complet
- **Passerelle WebSockets (Socket.IO)** : diffusion instantanée de tous les événements (nouvelles commandes, changements de statut, alertes de stock, règlements).
- **Service Worker & Manifest PWA (`vite-plugin-pwa`)** :
  - Mise en cache intégrale de l'application (HTML, CSS, JS, icônes, alertes sonores) via Workbox.
  - Fonctionnement autonome sans connexion internet (lancement direct depuis l'écran d'accueil ou le bureau).
  - Bannière d'installation PWA (`PwaInstallPrompt`) et invite de mise à jour non-intrusive.
- **Persistance Locale Haute Performance (`IndexedDB`)** :
  - Sauvegarde automatique de l'état complet du restaurant (`restoflow_db`) : tables, commandes, réservations, stocks, personnel, configuration.
  - Au rechargement ou au démarrage hors-ligne, restauration instantanée du dernier état réel (aucun écrasement par les données de démo).
- **File d'Attente Résiliente & Rejeu (`OfflineQueueModal`)** :
  - Enregistrement transactionnel de toutes les actions déconnectées (prises de commande, encaissements, transferts).
  - Badge interactif (`ConnectionBadge`) affichant le nombre d'opérations en attente et ouvrant la modale d'inspection.
  - Rejeu automatique avec suivi des statuts (`pending`, `syncing`, `failed`), bouton "Forcer la synchronisation" et notification de confirmation.
- **Authentification PIN Déconnectée** :
  - Hachage cryptographique SHA-256 local permettant aux serveurs de changer de profil et de déverrouiller la tablette même lors d'une coupure réseau prolongée.

---

## 🛠️ Stack Technique

### Frontend SPA & PWA
| Outil | Rôle |
|---|---|
| **React 19** | Bibliothèque UI moderne avec hooks réactifs |
| **Vite 8** | Environnement de développement et bundler ultra-rapide |
| **Vite PWA (`vite-plugin-pwa`)** | Service Worker Workbox, manifest web et gestion de cache hors-ligne |
| **IndexedDB (`idb`)** | Persistance locale transactionnelle haute performance de l'état et de la file d'attente |
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
| **Phase 4 : Réservations, Salle Dynamique & Service** | 🟢 **Terminée** | Widget de réservation en ligne, **gestion des "Suites" & réclame** (envoi cadencé en cuisine), **fusion & transfert de tables**, et **dispatch multi-postes (KDS Bar vs KDS Cuisine)**. |
| **Phase 5 : Sécurité PIN, Modularité & Impression TCP Raw** | 🟢 **Terminée** | Hachage cryptographique des PINs (bcrypt) & sessions signées HMAC, exclusion des PINs de `sync:init`, découpage modulaire NestJS (`OrdersService`, `BillingService`, `ConfigService`, `TablesService`, `StockService`, `PrinterService`), suppression du prop drilling via `RestoFlowContext`, code-splitting Vite (bundle initial réduit à 157 ko), et impression directe hardware TCP raw port 9100. |
| **Phase 6 : Mode PWA & Offline Complet** | 🟢 **Terminée** | Service Worker (`vite-plugin-pwa`), persistance locale haute fidélité IndexedDB, validation du code PIN hors-ligne, file d'attente d'actions résiliente avec inspection manuelle (`OfflineQueueModal`), et fonctionnement 100% autonome garanti lors des coupures prolongées. |
| **Phase 7 : Clôture de Caisse & Conformité Fiscale** | 🟡 **Prochaine étape** | Rapports Z et X journaliers certifiés, journal d'encaissement inaltérable chaîné (loi anti-fraude TVA / NF525), tarification Happy Hour programmée et export comptable (FEC). |
| **Phase 8 : Modularité & Activation des Modules "À la Carte" (Feature Toggles)** | ⚪ **Planifiée (avant v1.0)** | Hub centralisé de configuration permettant d'activer/désactiver les fonctionnalités non primordiales selon le profil du restaurant (stocks, réservations en ligne, cadencement des suites, KDS bar/cuisine, remises...), allégement visuel dynamique de l'interface et persistance offline/serveur. |

#### 🎛️ Détail de la Phase 8 : Modularité & Paramétrage "À la Carte" (Feature Flags)

Tous les établissements n'ont pas les mêmes contraintes opérationnelles : un food truck, un bar à tapas ou un bistrot rapide cherchent une vélocité maximale sans inventaire complexe ni réservations, tandis qu'un restaurant gastronomique exploite l'intégralité des fiches techniques, des réservations en ligne et du cadencement de service.

Cette phase introduit un **panneau de contrôle des modules activables à la demande** dans l'espace Configuration / Back-office :

- **📦 Gestion des Stocks & Ingrédients** (`enableStockManagement`) :
  - *Actif* : fiches techniques, calcul du food cost, décompte atomique à la commande, alertes et blocage automatique sur rupture.
  - *Inactif* : masquage des onglets *Stocks* et *Fiches Techniques*, aucune contrainte de stock à la commande pour une saisie ultra-rapide.
- **📅 Réservations en ligne & Planificateur de Salle** (`enableOnlineReservations`) :
  - *Actif* : widget client de réservation en ligne, affichage des heures réservées et des noms de clients sur les tables du plan de salle.
  - *Inactif* : masquage complet du module de réservation (plan de salle 100% épuré dédié au flux sans réservation).
- **⏱️ Cadencement des "Suites" & Réclame** (`enableCoursePacing`) :
  - *Actif* : découpage du service par vagues (Entrées, Plats, Desserts) avec envoi cadencé et bouton "Envoyer la suite" en cuisine.
  - *Inactif* : envoi direct et global de la commande en cuisine sans étapes intermédiaires (idéal brasserie rapide, snacking, bars).
- **🍸 Dispatch Multi-Postes (KDS Bar vs KDS Cuisine)** (`enableMultiStationKds`) :
  - *Actif* : routage séparé des boissons vers l'écran ou l'imprimante Bar et des plats chauds vers la Cuisine.
  - *Inactif* : centralisation de tous les bons sur un écran KDS unique.
- **🏷️ Remises & Codes Promotionnels** (`enableDiscounts`) :
  - *Actif* : modale d'application de remises fixes/pourcentages et gestion des codes promo.
  - *Inactif* : encaissement direct au tarif carte sans option de réduction pour simplifier l'écran de caisse.
- **💳 Modes de Partage d'Addition Avancés** (`enableAdvancedSplitModes`) :
  - *Actif* : 4 modes complets (unique, parts égales, par article/split itemisé, montant proportionnel libre).
  - *Inactif* : mode épuré restreint au règlement direct total et à la division à parts égales.
- **🔒 Authentification PIN Multi-Serveurs** (`enablePinAuth`) :
  - *Actif* : verrouillage par code PIN entre chaque action pour traçabilité multi-opérateurs.
  - *Inactif* : mode "Opérateur unique / Caisse rapide" sans demande de PIN récurrent pour les gérants seuls.

**Architecture technique :**
- Schéma Prisma étendu avec un modèle `ModulesConfig` synchronisé en temps réel via WebSocket (`config:modules_update`).
- Hook réactif `useModules()` côté client React pour masquer dynamiquement onglets, boutons, modales et menus sans alourdir le DOM.
- Persistance locale dans IndexedDB (`restoflow_db`) pour garantir la conservation du paramétrage même lors d'une utilisation hors-ligne.

### 💡 Perspectives & Idées futures (Post-v1.0)

- 📱 **Commande à table par QR Code** : Scan d'un QR code dynamique sur la table permettant aux clients d'accéder au menu digital, de passer commande et de payer en direct depuis leur smartphone.
- 🖥️ **Borne de commande interactive (Kiosk)** : Interface client grand écran tactile pour la prise de commande et l'encaissement en autonomie complète.
- 🛵 **Module de Livraison intégré** : Passerelle centralisée connectée aux plateformes de livraison (Uber Eats, Deliveroo) ou module dédié pour la livraison en propre avec suivi des livreurs.
- 💵 **Gestion des Pourboires (Tips) & Répartition** : Saisie des pourboires sur TPE et calcul automatique de la répartition équitable en fin de service.

---

## 🛠️ Axes d'Amélioration & Correctifs Appliqués (Résolus)

L'ensemble des 7 axes de consolidation technique, de sécurité et d'ergonomie opérationnelle ont été intégralement implémentés et validés par des suites de tests automatisées :

### 1. 🔒 Sécurité : Guards RBAC sur le Backend (WebSocket & REST)
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Création de `WsAuthGuard` (`server/src/auth/guards/ws-auth.guard.ts`) et `WsPermissionsGuard` (`server/src/auth/guards/ws-permissions.guard.ts`).
  - Décorateur `@RequirePermissions(...)` (`server/src/auth/decorators/permissions.decorator.ts`) appliqué sur tous les événements sensibles (`config:update`, `order:checkout`, `stock:*`, `recipe:*`, `catalog:*`, `closing:process_z`).
  - Propagation automatique du token de session JWT côté client (`src/services/socket.js`, `src/App.jsx`) lors de la saisie du code PIN équipier.
  - Rejet immédiat avec message d'erreur explicite en cas de droits insuffisants ou token manquant/expiré.

### 2. 🛡️ Validation des Données : `ValidationPipe` et Schémas DTO
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Activation globale du `ValidationPipe` dans `server/src/main.ts` (`whitelist: true, transform: true`).
  - Création de DTOs stricts avec `class-validator` :
    - `AddItemDto` (`server/src/orders/dto/add-item.dto.ts`) : contrôle des types et quantités positives.
    - `ChangeQtyDto` (`server/src/orders/dto/change-qty.dto.ts`)
    - `CheckoutDto` (`server/src/orders/dto/checkout.dto.ts`) : validation des paiements et montants.
    - `StockMovementDto` (`server/src/stock/dto/stock-movement.dto.ts`) : typage strict des mouvements d'inventaire (`DELIVERY`, `WASTE`, etc.).
    - `TransferTableDto` & `MergeTableDto` (`server/src/tables/dto/table-action.dto.ts`).

### 3. ⚡ Résilience UI : Rollback en cas d'échec serveur (Désynchronisation Optimiste)
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Refonte de `emitOrQueue(eventType, payload, onAck)` dans `src/App.jsx` avec gestion des acquittements (ACK callbacks).
  - Snapshot de l'état React préalable lors des fusions et transferts de tables (`handleTransferTable`, `handleMergeTable`).
  - En cas de réponse `{ ok: false, error }` du serveur : rollback instantané de l'état local, notification Toast d'alerte et émission automatique de `sync:request` pour restaurer la vérité authoritative de la base de données.

### 4. 📦 Traçabilité : Soft Delete des Ingrédients & Intégrité Prisma
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Ajout du champ `archived Boolean @default(false)` sur le modèle `Ingredient` dans `server/prisma/schema.prisma`.
  - Modification de la contrainte relationnelle vers `StockMovement` en `onDelete: Restrict` pour interdire la suppression en cascade de l'historique comptable.
  - Conversion de la suppression en archivage soft-delete dans `server/src/stock/stock.service.ts` et ajout de la méthode `restoreIngredient`.
  - Mise à jour de l'interface `StockManager.jsx` : calcul des KPIs sur les ingrédients actifs, badge visuel `ARCHIVÉ`, bouton de restauration et commutateur *"Voir archivés"*.

### 5. 🔊 Fiabilité KDS : Déblocage de l'AudioContext (Autoplay Policy Navigateurs)
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Création d'une instance partagée singleton de l'AudioContext dans `src/hooks/index.js` avec déverrouillage automatique dès la première interaction physique de l'utilisateur (`pointerdown` / `keydown`).
  - Hook `useAudioState()` exposant l'état (`isSuspended`, `isUnlocked`).
  - Bouton interactif d'alerte et de déblocage sonore manuel *"🔊 Activer les bips KDS"* dans l'en-tête de l'écran de production `src/views/cuisine/CuisineShell.jsx` si l'AudioContext est suspendu par le navigateur (iPads/tablettes tactiles).

### 6. 🪟 Concurrence Multi-terminaux : Prévention d'Écran Fantôme
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Détection réactive dans `src/views/salle/OrderTaking.jsx` : surveillance du statut de la commande active et de la table.
  - Si un autre terminal encaisse ou libère la table courante (`order:closed`), l'écran affiche une notification d'avertissement Toast (*"⚠️ La Table X a été encaissée ou libérée sur un autre terminal"*) et redirige automatiquement vers le plan de salle.

### 7. 🧪 Tests Automatisés & Fiabilité Financière
- **Statut** : ✅ **Résolu & Vérifié**
- **Implémentation** :
  - Mise en place de suites de tests unitaires Vitest côté client et backend :
    - `src/utils/vat.test.js` : tests exhaustifs de la ventilation multi-taux (10% et 20%), du lissage des centimes résiduels et de l'exclusion des brouillons.
    - `src/utils/securityChain.test.js` : tests de conformité NF525, vérification des signatures déterministes et détection des ruptures de chaîne cryptographique en cas de falsification.
    - `server/src/billing/billing.service.spec.ts` : validation du calcul des remises, de la clôture des commandes et de la génération des signatures HMAC-SHA256 de facturation.
  - Scripts de test intégrés : `npm test` (Frontend : 9/9 tests réussis) et `npm test` dans `server/` (Backend : 3/3 tests réussis).

---

## 📂 Architecture du Projet

```text
RestoFlow/
├── index.html                  # Point d'entrée HTML
├── package.json                # Dépendances & scripts du frontend (React 19, Vite, Tailwind v4)
├── vite.config.js              # Configuration Vite & Tailwind CSS v4 (code splitting optimisé)
│
├── server/                     # Backend NestJS & Synchronisation Temps Réel
│   ├── package.json            # Dépendances backend (@nestjs, @prisma/client, socket.io, bcryptjs)
│   ├── prisma/
│   │   ├── schema.prisma       # Schéma ORM (Tables, Staff, Orders, Stocks, Recettes, Config...)
│   │   ├── dev.db              # Base SQLite de développement
│   │   └── seed.ts             # Données de démonstration (carte, tables, équipiers, stocks, caisse)
│   └── src/
│       ├── main.ts             # Démarrage du serveur NestJS (port 3000)
│       ├── app.module.ts       # Module racine
│       ├── websocket/          # Passerelle Socket.IO centrale & broadcast
│       ├── auth/               # Authentification par code PIN (hachage bcrypt & tokens de session signés)
│       ├── tables/             # API tables, réservations, alertes, transferts et fusions
│       ├── orders/             # API commandes, cycle de vie et suites/réclame
│       ├── billing/            # Facturation, encaissement multi-modes et remises
│       ├── config/             # Configuration de l'établissement et périphériques
│       ├── printer/            # Impression hardware directe TCP Raw (port 9100)
│       ├── catalog/            # API produits, catégories et menus
│       ├── staff/              # API personnel & rôles RBAC
│       ├── stock/              # Moteur de stocks, inventaire, mouvements et alertes
│       └── recipes/            # Fiches techniques et calcul du food cost
│
└── src/                        # Client Frontend React 19 SPA
    ├── main.jsx                # Montage de l'application
    ├── App.jsx                 # État global, gestion des rôles, lazy loading et écoutes Socket.IO
    ├── context/                # Gestion d'état React Context (RestoFlowContext)
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
npm run db:seed     # Charge les données de démonstration complètes (avec PINs hachés)
npm run start:dev   # Lance le serveur NestJS sur http://localhost:3000
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
