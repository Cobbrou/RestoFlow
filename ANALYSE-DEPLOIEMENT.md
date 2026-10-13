# Analyse avant déploiement

État au 13/10/2026 (branche `feat/terrain`). Procédure d'installation : `deploy/DEPLOIEMENT.md`.

Vérifié : tests client (45) et serveur (116), lint, typecheck et builds passent. Installation neuve testée (`npm ci`, build, migrations, démarrage).

Dépendances serveur : trois alertes `npm audit` restent, sans effet ici. `@nestjs/core` (injection dans les SSE, non utilisés), `file-type` (`ParseFilePipe`, aucun upload) et `deepmerge-ts` (CLI Prisma, jamais exposé). `@nestjs/core` est corrigé à partir de Nest 11.1.18.

## Bloquant

- **Pas de certification NF525.** Un commerçant assujetti à la TVA doit utiliser un logiciel de caisse certifié (amende de 7 500 € par logiciel). Le code a les briques techniques (tickets, rapports Z et journal en ajout seul, avoirs, triggers SQLite), mais aucun certificat n'existe. En attendant, RestoFlow sert uniquement à la prise de commande et à la cuisine, à côté d'une caisse certifiée.

## À valider sur le matériel cible

Rien de ce qui suit n'a encore été testé sur place.

- [ ] Caddy en HTTPS et autorité locale installée sur chaque tablette (Android et iPad).
- [ ] Installation de la PWA, puis fonctionnement hors-ligne : Wi-Fi coupé sur une tablette, reprise de la file au retour.
- [ ] Impression sur l'imprimante cuisine et l'imprimante ticket réelles.
- [ ] Coupure de courant : redémarrage automatique du mini-PC (BIOS), puis des services RestoFlow et Caddy.
- [ ] Sauvegarde nocturne planifiée, avec une copie hors du mini-PC.
- [ ] Restauration d'une sauvegarde, puis audit d'intégrité dans Gestion > Clôtures & Fiscalité.
- [ ] Fuseau horaire du mini-PC réglé sur Paris.
- [ ] Service à blanc complet : commandes, envoi cuisine, encaissements, avoir, clôture Z.

## Raccourcis connus (marqués `ponytail:` dans le code)

Sans conséquence avec un seul processus serveur sur un seul mini-PC. À reprendre si l'un d'eux se manifeste.

| Fichier | Limite | Correctif possible |
|---|---|---|
| `server/src/management/management.service.ts` | Deux arrivées simultanées depuis deux tablettes peuvent ouvrir deux services de pointage. | Index unique partiel (`staffId` où `endAt IS NULL`). |
| `server/src/orders/orders.service.ts` | Deux créations simultanées peuvent obtenir le même numéro d'appel (affichage seul). | Compteur atomique. |
| `server/src/orders/orders.service.ts` | Verrou en mémoire, valable pour un seul processus. | Index unique partiel en base. |
| `server/src/websocket/client-action.interceptor.ts` | Deux émissions simultanées du même `clientActionId` peuvent passer toutes les deux. | Verrou par id. |
| `server/src/auth/auth.service.ts` | Compteur d'échecs de PIN en mémoire, remis à zéro au redémarrage. | Compteur en base. |
| `server/src/stock/stock.service.ts` | Inventaire : un mouvement par ligne, pas une transaction unique. | Transaction unique. |
| `server/src/billing/billing.service.ts` | Avoir final plafonné au brut si les avoirs précédents ont trop remboursé (écart ≤ 1 ct). | — |
| `src/services/db.js` | Un PIN à 4 chiffres reste devinable hors-ligne ; les comptes sensibles sont exclus du cache. | — |
| `src/App.jsx` | Le rappel du Z oublié (ticket sans Z depuis plus de 20 h) est calculé au rendu, sans minuterie : il n'apparaît qu'à la prochaine action. | Minuterie si le rappel arrive trop tard. |

## Suivi

- [ ] Fusionner `feat/terrain` dans `main`.
- [ ] Pilote avec une caisse certifiée en parallèle.
