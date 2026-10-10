# 🍽️ RestoFlow

> **Logiciel de caisse et d'orchestration pour restaurants.**
> RestoFlow relie en temps réel la **Salle** (serveurs), la **Cuisine** (écran KDS) et la **Gestion** (back-office), même quand le réseau tombe.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline-blueviolet?logo=pwa&logoColor=white)
![Licence](https://img.shields.io/badge/Licence-MIT-green)

---

## 📌 Sommaire

- [Pourquoi RestoFlow ?](#-pourquoi-restoflow-)
- [Fonctionnalités](#-fonctionnalités)
- [Démarrage rapide](#-démarrage-rapide)
- [Configuration](#️-configuration)
- [Architecture](#-architecture)
- [Stack technique](#️-stack-technique)
- [Règles métier](#-règles-métier)
- [Roadmap](#️-roadmap)
- [Contribuer](#-contribuer)
- [Licence](#-licence)

---

## 🎯 Pourquoi RestoFlow ?

En salle, l'information se perd : tickets papier égarés, modifications de dernière minute mal transmises, allergies oubliées, additions difficiles à partager. RestoFlow remplace ce flux papier par une application tactile pensée pour les tablettes et écrans de l'établissement.

| Pour… | RestoFlow apporte |
|---|---|
| 🛎️ **Les serveurs** | Prise de commande au doigt, plan de salle vivant, envoi instantané en cuisine. |
| 🍳 **La cuisine** | Écran KDS lisible, chronomètres d'attente, alertes allergènes et sonores. |
| 📊 **Le gérant** | CA en direct, food cost, stocks, équipe et clôtures de caisse. |

---

## 🚀 Fonctionnalités

### 🛎️ Salle & prise de commande
- **Plan de salle interactif** : disposition libre (desktop) ou grille tactile (tablette, smartphone), statuts en couleur (libre, occupée, prête, alerte), réservations visibles sur les tables.
- **Prise de commande** : catalogue par catégories avec recherche, **menus composés** pas à pas, notes pour la cuisine.
- **Options et suppléments** : cuisson, extras payants, choix obligatoires ou limités, y compris dans les menus. Le prix est recalculé par le serveur.
- **Allergènes** : détection dans les notes et les fiches produit, badges d'alerte en salle et en cuisine.
- **Suites & réclame** : service découpé en vagues (entrées, plats, desserts), envoi cadencé en cuisine.
- **Tables** : transfert, fusion, signalement d'incident.
- **Annulation tracée** d'un article déjà envoyé en cuisine.

### 💳 Caisse & encaissement
- **4 modes de partage** : paiement unique, parts égales (centimes répartis équitablement), par article, montant libre.
- **Remises et codes promo**, validés selon le rôle.
- **Pourboires** : 0 / 5 / 10 / 15 % ou montant libre, tracés hors TVA.
- **TVA ventilée** par taux (10 % / 20 %), remises réparties au centime.
- **Encaissement recalculé et numéroté côté serveur** : le client ne fixe jamais un prix.
- **Simulateur de TPE** (sans contact, puce + PIN) pour les démonstrations.

### 🖨️ Impression thermique ESC/POS
- Tickets client, bons cuisine, bons bar et tickets TPE, en **80 mm et 58 mm**.
- Impression réseau directe (TCP raw, port 9100) ou via le navigateur.
- Aperçu réaliste du ticket avant impression.

### 🍳 Cuisine (KDS)
- Interface sombre lisible en cuisine, vue **Kanban** (nouvelles / en préparation / prêtes) ou **par table**.
- Chronomètre d'urgence : vert < 10 min, ambre 10-20 min, rouge > 20 min.
- **Dispatch multi-postes** : boissons vers le bar, plats vers la cuisine.
- Bouton **« 86 »** pour mettre un plat en rupture depuis le KDS.
- Alertes sonores (Web Audio API) et notifications.

### 📦 Stocks & fiches techniques
- Ingrédients, unités, seuils d'alerte, réassort et pertes avec motif.
- **Décompte automatique** à chaque envoi en cuisine (transaction atomique).
- **Food cost**, marge et coefficient par plat.
- **Rupture en cascade** : un ingrédient épuisé rend indisponibles les plats et menus qui en dépendent.
- Journal complet des mouvements de stock ; les ingrédients sont archivés, jamais supprimés.

### 📊 Tableau de bord
- CA, nombre de commandes, panier moyen, occupation des tables.
- Graphiques : CA sur 7 jours, commandes en cours, top produits.

### 👥 Équipe & sécurité
- **Connexion par code PIN** individuel, changement d'opérateur rapide.
- **Rôles et permissions** (RBAC) par domaine : salle, cuisine, gestion, caisse, administration.
- Contrôle des permissions **côté serveur** sur chaque action sensible, données validées à l'entrée.
- PINs hachés (bcrypt), sessions signées, déconnexion révoquant la session.

### 🏛️ Clôture de caisse & conformité fiscale
- **Rapport X** (lecture intermédiaire) et **rapport Z** (clôture journalière définitive).
- Grand total perpétuel, fond de caisse, contrôle du comptage des espèces.
- **Chaînage cryptographique** (SHA-256) des tickets et clôtures, avec audit d'intégrité dans le back-office.
- Avoirs, journal des événements techniques (JET) et **export comptable FEC**.

> ⚠️ RestoFlow suit les principes de la loi anti-fraude TVA (inaltérabilité, sécurisation, conservation, archivage). Il **n'est pas certifié NF525** : une certification par un organisme accrédité est requise pour un usage en caisse réelle en France.

### ⚡ Temps réel & hors-ligne
- Synchronisation instantanée entre tous les écrans (Socket.IO).
- **PWA installable**, fonctionnement complet sans réseau.
- État local persistant (IndexedDB) et **file d'actions hors-ligne** ordonnée, idempotente, rejouée au retour du réseau.
- Déverrouillage par PIN possible hors-ligne.

### 🎛️ Modules à la carte
Chaque établissement active seulement ce dont il a besoin. L'interface s'allège en conséquence.

| Module | Rôle |
|---|---|
| 📦 Stocks & ingrédients | Fiches techniques, food cost, blocage sur rupture |
| 📅 Réservations | Réservations affichées sur le plan de salle |
| ⏱️ Suites & réclame | Envoi du service en vagues |
| 🍸 KDS multi-postes | Séparation bar / cuisine |
| 🏷️ Remises | Remises et codes promo |
| 💳 Partage avancé | Split par article et montant libre |
| 🔒 PIN systématique | Verrouillage entre chaque opérateur |
| 💵 Pourboires | Sélecteur à l'encaissement, ventilation dans les rapports |

Trois préréglages en un clic : **Restaurant gastronomique**, **Bar & tapas**, **Food truck / fast-casual**.

---

## ⚡ Démarrage rapide

### Prérequis
- [Node.js](https://nodejs.org/) **20+**
- npm

### 1. Serveur (NestJS)

```bash
cd server
npm install
cp .env.example .env   # puis renseigner JWT_SECRET
npm run db:migrate     # crée la base SQLite locale
npm run db:seed        # charge les données de démonstration
npm run start:dev      # http://localhost:3000
```

### 2. Client (React / Vite)

Dans un second terminal, à la racine du dépôt :

```bash
npm install
npm run dev            # http://localhost:5173
```

### Comptes de démonstration

| Équipier | Rôle | PIN |
|---|---|---|
| Léa Martin | Serveur | `1011` |
| Marco Rossi | Serveur | `2022` |
| Inès Benali | Chef de rang | `3033` |
| Antoine Dubois | Cuisine | `4044` |
| Sarah Laurent | Admin | `5055` |

> Ces PINs ne servent qu'à la démo. Changez-les avant toute mise en service.

### Scripts utiles

| Commande | Effet |
|---|---|
| `npm run build` | Build de production du client |
| `npm run lint` | Lint du client (Oxlint) |
| `npm test` | Tests du client (Vitest) |
| `cd server && npm test` | Tests du serveur (Vitest) |
| `cd server && npm run build` | Build du serveur |
| `cd server && npm run db:migrate:dev` | Nouvelle migration après une modification du schéma |
| `cd server && npm run db:backup` | Sauvegarde vérifiée de la base |

> Mise en service sur place (HTTPS, services, sauvegardes) : voir [deploy/DEPLOIEMENT.md](deploy/DEPLOIEMENT.md).

---

## ⚙️ Configuration

Variables du serveur (`server/.env`) :

| Variable | Description | Défaut |
|---|---|---|
| `JWT_SECRET` | Secret de signature des sessions. **Obligatoire en production** (`openssl rand -hex 32`). | — |
| `CORS_ORIGIN` | Origines autorisées, séparées par des virgules | `http://localhost:5173` |
| `PORT` | Port du serveur | `3000` |
| `DATABASE_URL` | Fichier SQLite (relatif à `prisma/`) | `file:./dev.db` |
| `BACKUP_DIR` | Dossier des sauvegardes | `./backups` |
| `BACKUP_KEEP` | Nombre de sauvegardes conservées | `30` |

---

## 📂 Architecture

```text
RestoFlow/
├── src/                    # Client React (PWA)
│   ├── views/
│   │   ├── salle/          # Plan de salle, prise de commande, encaissement
│   │   ├── cuisine/        # Écran KDS
│   │   └── gestion/        # Dashboard, stocks, fiches techniques, équipe, caisse, modules
│   ├── components/         # Composants partagés (PIN pad, TPE, aperçu ticket, file hors-ligne…)
│   ├── hooks/              # État, persistance, synchro temps réel, actions de service
│   ├── services/           # Socket.IO et file d'actions hors-ligne
│   └── utils/              # Monnaie, TVA, options, permissions, ESC/POS, chaîne de signature
│
└── server/                 # API NestJS
    ├── prisma/             # Schéma et données de démonstration
    └── src/
        ├── websocket/      # Passerelle Socket.IO
        ├── auth/           # PIN, sessions, guards RBAC
        ├── orders/         # Commandes, suites, options
        ├── billing/        # Encaissement, tarification, TVA
        ├── closing/        # Rapports X / Z, FEC
        ├── journal/        # Journal des événements (JET)
        ├── catalog/        # Produits et menus
        ├── stock/          # Stocks et mouvements
        ├── recipes/        # Fiches techniques
        ├── tables/         # Tables, transferts, fusions
        ├── reservations/   # Réservations
        ├── staff/          # Équipe et rôles
        ├── management/     # Back-office
        ├── config/         # Paramètres de l'établissement
        └── printer/        # Impression TCP raw
```

---

## 🛠️ Stack technique

| Client | Serveur |
|---|---|
| **React 19** + **Vite 8** | **NestJS 10** (TypeScript) |
| **Tailwind CSS v4** | **Prisma 6** + **SQLite** |
| **vite-plugin-pwa** (Workbox) | **Socket.IO** gateway |
| **IndexedDB** (`idb`) | **bcrypt**, `class-validator` |
| **Recharts**, **Lucide** | **Vitest** |
| **Socket.IO client**, **Oxlint**, **Vitest** | |

---

## 📜 Règles métier

1. **Le serveur fait foi** : prix, options, TVA et numérotation sont toujours recalculés côté serveur.
2. **Intégrité de la commande** : un article envoyé en cuisine ne se modifie plus en silence ; toute annulation est tracée.
3. **Allergies en priorité** : les alertes allergènes sont mises en avant en salle et en cuisine.
4. **Partage équitable** : en parts égales, les centimes restants sont répartis de façon transparente.
5. **Stock atomique** : l'envoi en cuisine décrémente les ingrédients dans une seule transaction.
6. **Rupture proactive** : un ingrédient critique épuisé rend ses plats indisponibles immédiatement.
7. **Pertes tracées** : tout ajustement manuel de stock exige un motif et un opérateur identifié.
8. **Inaltérabilité** : un ticket ou une clôture signé ne se modifie pas ; une correction passe par un avoir.

---

## 🗺️ Roadmap

### ✅ Disponible
- [x] Socle temps réel (NestJS, Socket.IO, Prisma) et authentification PIN
- [x] Stocks, fiches techniques et food cost
- [x] Impression ESC/POS, caisse, TVA, remises
- [x] Réservations, suites & réclame, fusion / transfert de tables, KDS multi-postes
- [x] Sécurité serveur (RBAC, validation, sessions signées)
- [x] PWA et mode hors-ligne complet
- [x] Clôtures X / Z, chaînage cryptographique, FEC
- [x] Modules à la carte et pourboires
- [x] Options et suppléments produit, rupture « 86 » depuis le KDS

### 🔮 À venir
- [ ] 📱 **Commande à table par QR code** : menu, commande et paiement depuis le smartphone du client.
- [ ] 🖥️ **Borne de commande** : commande et encaissement en autonomie.
- [ ] 🛵 **Livraison** : connexion aux plateformes (Uber Eats, Deliveroo) ou livraison en propre.
- [ ] 💼 **Paie** : répartition des pourboires selon les heures travaillées.
- [ ] 🐘 **PostgreSQL** en production.

---

## 🤝 Contribuer

Les issues et pull requests sont bienvenues.

1. Forkez le dépôt et créez une branche (`feat/ma-fonctionnalite`).
2. Vérifiez `npm run lint` et `npm test` (client et serveur).
3. Utilisez des messages de commit [Conventional Commits](https://www.conventionalcommits.org/fr/).
4. Ouvrez une pull request vers `main`.

---

## 📄 Licence

Distribué sous licence [MIT](LICENSE).

---

<p align="center"><i>Conçu pour simplifier le quotidien des professionnels de la restauration.</i> 🍷👨‍🍳</p>
