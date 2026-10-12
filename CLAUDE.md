# RestoFlow

Caisse et orchestration de restaurant : Salle (tablettes), Cuisine (KDS), Gestion (back-office), temps réel et hors-ligne.
Déploiement cible : un mini-PC sur le LAN du restaurant (Node + SQLite + Caddy en HTTPS), tablettes en PWA. Voir `deploy/DEPLOIEMENT.md`.
Problèmes connus et correctifs à faire : `ANALYSE-DEPLOIEMENT.md`.

## Commandes

| Où | Commande | Effet |
|---|---|---|
| racine | `npm run dev` / `npm run build` | Client Vite (http://localhost:5173) |
| racine | `npm test` / `npm run lint` | Vitest / Oxlint client |
| `server/` | `npm run start:dev` | API NestJS (http://localhost:3000) |
| `server/` | `npm test` / `npx tsc --noEmit` | Vitest / typecheck serveur |
| `server/` | `npm run db:migrate:dev -- --name <nom>` | Nouvelle migration après une modification de `schema.prisma` |
| `server/` | `npm run db:seed` / `db:seed:vierge` | Démo complète / base de production vide |

Avant de rendre la main : tests client et serveur, lint, typecheck.

## Architecture

- `src/` : React 19 + Vite + Tailwind v4, JavaScript (pas de TS). État dans `hooks/`, Socket.IO et file hors-ligne dans `services/`.
- `server/src/` : NestJS 10 + Prisma 6 + SQLite. Presque toute l'API passe par Socket.IO : `websocket/websocket.gateway.ts`, `management/management.gateway.ts`, `reservations/reservations.gateway.ts`. Seul `POST /api/auth/pin` est utilisé en REST.
- Le client applique d'abord ses changements en local (optimiste), puis émet via `emitOrQueue` (`src/services/emitOrQueue.js`). Le serveur répond par un ack `{ ok, error }` et diffuse l'état à jour.

## Règles à respecter

- **Le serveur fait foi** : prix, options, TVA, remises et numéros de ticket sont recalculés côté serveur. Ne jamais faire confiance à un montant envoyé par le client.
- **Argent en centimes entiers** : utiliser `toCents` / `toEuros` (`server/src/billing/pricing.ts`). Certaines logiques existent en double dans `src/utils/` (TVA dont `menuVatSplit` et `partialNetCents`, options, happy hour, `heldToRelease`, conversion d'unités `units`, couverts `ticketCovers`, reste remboursable `refundableLines`) : modifier les deux copies.
- **NF525** : tickets (`OrderHistory`), rapports Z (`DailyClosing`) et journal (`EventLog`) sont en ajout seul, protégés par des triggers SQLite (`server/src/prisma/prisma.service.ts`). Toute correction passe par un avoir. Toute action sensible est journalisée via `JournalService.log`. `nf525Key` ne doit jamais quitter le serveur.
- **Sécurité des handlers socket** : toute nouvelle action déclare `@RequirePermissions(...)`. Les guards renvoient un refus via l'événement `exception`, pas via l'ack. Le catalogue des permissions est dans `src/data/staff.js`, les contrôles côté front dans `src/utils/permissions.js`. Le rôle `admin` a tous les droits.
- **Idempotence** : chaque action client porte un `clientActionId` (`server/src/websocket/client-action.interceptor.ts`). Un handler doit supporter le rejeu de la file hors-ligne : ids fournis par le client, état vérifié avant d'écrire.
- **Un article envoyé en cuisine (`status !== "draft"`) ne se modifie plus en silence.** Une annulation passe par `order:void_item`, avec un motif.
- **Schéma** : toujours passer par une migration Prisma, jamais `prisma db push`.

## Conventions

- Code, commentaires, messages d'erreur et UI en français.
- Commits Conventional Commits en français : `feat(emporter): …`, `fix(caisse): …`.
- Garder les diffs minimaux. Un raccourci assumé se marque `// ponytail: <limite>, <évolution possible>`.
