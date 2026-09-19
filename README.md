# RestoFlow — README

Document de spécification normative du projet RestoFlow, écrit pour servir de contexte à un agent IA chargé d'implémenter ou de faire évoluer l'application.

## 1. Vue d'ensemble

RestoFlow est une application interne de gestion de commandes pour un restaurant physique. Elle orchestre le travail entre trois postes de travail :

- **Cuisine (KDS)** — écran d'affichage des commandes en cuisine (Kanban).
- **Salle** — plan des tables, prise de commande et encaissement côté serveur.
- **Gestion** — back-office : tableau de bord, gestion des tables, des produits, des menus et de l'historique des paiements.

Le périmètre produit est strictement limité à la gestion de commandes sur place. Tout domaine hors-périmètre (réservation en ligne grand public, livraison, fidélité, click-and-collect) est explicitement **hors scope v1** et listé dans `ROADMAP.md` § « Évolutions futures ».

## 2. Objectif métier

Fluidifier le service en salle et la production cuisine en assurant en temps réel la cohérence entre :

- ce que le serveur prend comme commande,
- ce que la cuisine prépare,
- ce qui est servi et encaissé,
- et ce que la gestion peut analyser a posteriori.

## 3. Stack technique cible

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Backend | Node.js 20 + TypeScript + **NestJS** | Structure modulaire, DI native, guards d'autorisation, bonne intégration WebSocket |
| ORM | **Prisma** | Types générés alignés sur le schéma, migrations versionnées |
| Base de données | **PostgreSQL 16** | Transactions ACID, contraintes FK rigoureuses, JSONB pour les snapshots |
| Cache / sessions | **Redis 7** (optionnel v1.1) | Verrous de session, invalidation, throttling |
| Temps réel | **Socket.IO** (over NestJS Gateway) | Rooms par rôle, reconnexion, fallback long-polling |
| Auth | **JWT** access (15 min) + refresh (7 j), argon2id pour les mots de passe | Standard, stateless, compatible WebSocket via handshake |
| Frontend | React 18 + TypeScript + **Vite** | Remplacement du bundle `RestoFlow.jsx` |
| State serveur | **TanStack Query** | Cache, invalidation, optimistic updates |
| State local | **Zustand** (stores légers) | Sélection, UI, modales |
| Routing | **React Router 6** | URLs par vue (`/salle/plan`, `/cuisine/kds`, …) |
| Tests unitaires | **Vitest** | Compatible TS, rapide |
| Tests E2E | **Playwright** | Parcours serveur → cuisine → encaissement |
| Conteneurisation | **Docker Compose** | Postgres + API + Web + reverse-proxy Caddy |
| CI | GitHub Actions | Lint, tests, build d'image |
| Lint / format | ESLint + Prettier | Règles strictes, import order |

## 4. Structure des documents

| Fichier | Contenu |
|---------|---------|
| `README.md` | Ce document (point d'entrée) |
| `AI_CONTEXT.md` | Synthèse dense injectable dans le contexte d'un LLM |
| `ARCHITECTURE.md` | Découpage backend / frontend, modules, flux |
| `DATA_MODEL.md` | Schéma Prisma complet, enums, contraintes, index |
| `API.md` | Endpoints REST + événements WebSocket |
| `BUSINESS_LOGIC.md` | Machines à états, règles métier, formules |
| `COMPONENTS.md` | Architecture frontend cible (composants cibles) |
| `CONVENTIONS.md` | Nommage, format, git, gestion d'erreurs |
| `SECURITY.md` | Auth, RBAC, durcissement, secrets |
| `TESTING.md` | Stratégie de tests, fixtures, scénarios |
| `SETUP.md` | Variables d'environnement, démarrage local, seed |
| `ROADMAP.md` | Phases de migration du prototype au produit |

## 5. Démarrage rapide (référence)

Voir `SETUP.md` pour les commandes exactes (`pnpm install`, `docker compose up`, `pnpm db:seed`, `pnpm dev`).

## 6. Règles cardinales du projet

1. **Une seule source de vérité : le backend.** Le frontend ne persiste rien en local durable.
2. **Tous les identifiants sont des UUID v4 générés côté serveur.** Le client ne génère jamais d'ID.
3. **Les statuts sont énumérés en base** (voir `DATA_MODEL.md`) ; toute valeur hors énumération est rejetée.
4. **Les transitions d'état passent par le backend**, qui valide le rôle et l'état courant avant mutation.
5. **Le temps n'est jamais dans le state React.** Chaque composant qui en a besoin calcule un âge à partir d'un timestamp serveur.
6. **Les libellés UI sont en français.** Les identifiants techniques (noms de champs, endpoints, événements) sont en anglais.
