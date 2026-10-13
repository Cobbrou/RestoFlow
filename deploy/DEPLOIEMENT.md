# Déploiement de RestoFlow sur place

> ⚠️ RestoFlow n'est pas certifié NF525. Ne l'utilisez pas comme caisse enregistreuse légale en France sans certification.

Architecture : un mini-PC sur le réseau local du restaurant, avec une IP fixe (ex : `192.168.1.10`). Il héberge le serveur Node, la base SQLite et Caddy. Caddy fournit le HTTPS, sert le front et relaie `/api` et `/socket.io`. Les tablettes ouvrent `https://192.168.1.10` et installent la PWA.

Le HTTPS est obligatoire : sans lui, le service worker (mode hors-ligne) ne fonctionne pas sur les tablettes.

## 1. Installation (Linux, recommandé)

Prérequis : Node.js 20.6+ et [Caddy](https://caddyserver.com/docs/install).

```bash
sudo useradd -r -m -d /opt/restoflow restoflow
sudo -u restoflow git clone <dépôt> /opt/restoflow   # ou copie du dossier
cd /opt/restoflow
npm ci && npm run build                             # front -> dist/
cd server
npm ci && npm run build                             # serveur -> dist/src/main.js
cp .env.example .env
```

Éditez `server/.env` :

```ini
JWT_SECRET=<résultat de : openssl rand -hex 32>   # obligatoire : sans lui, le serveur refuse de démarrer
CORS_ORIGIN=https://192.168.1.10
DATABASE_URL=file:/opt/restoflow/data/restoflow.db
BACKUP_DIR=/mnt/usb/restoflow-backups
```

Créez la base :

```bash
mkdir -p /opt/restoflow/data
npm run db:migrate
npm run db:seed:vierge # rôles + compte « Gérant » (PIN affiché), sans données de démo
```

Puis, connecté en Gérant : changez le PIN (Équipe & Rôles), renseignez les mentions légales (Caisse & Imprimantes), créez les tables, et importez la carte depuis un CSV (Produits > Importer CSV, modèle téléchargeable).

> `npm run db:seed` charge à la place une démo complète (carte, équipe, tickets fictifs) : à réserver aux essais, jamais en production.

> Pour reprendre une base existante créée avant les migrations (`db push`), lancez une seule fois `npx prisma migrate resolve --applied 0_init` au lieu de `db:migrate`.

## 2. Services

Serveur Node (redémarrage automatique, migrations appliquées à chaque démarrage) :

```bash
sudo cp /opt/restoflow/deploy/restoflow.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now restoflow
journalctl -u restoflow -f        # logs
```

Caddy : ajoutez les variables puis pointez Caddy sur `deploy/Caddyfile`.

```bash
sudo systemctl edit caddy
#   [Service]
#   Environment=RESTOFLOW_HOST=192.168.1.10
#   Environment=RESTOFLOW_DIST=/opt/restoflow/dist
sudo cp /opt/restoflow/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

### Variante Windows

Utilisez [NSSM](https://nssm.cc/) pour transformer les deux programmes en services Windows :

```powershell
nssm install RestoFlow "C:\Program Files\nodejs\npm.cmd" "run start:prod"
nssm set RestoFlow AppDirectory C:\restoflow\server
nssm set RestoFlow AppEnvironmentExtra NODE_ENV=production
nssm install Caddy C:\caddy\caddy.exe "run --config C:\restoflow\deploy\Caddyfile"
nssm set Caddy AppEnvironmentExtra RESTOFLOW_HOST=192.168.1.10 RESTOFLOW_DIST=C:/restoflow/dist
nssm start RestoFlow; nssm start Caddy
```

Ouvrez le port 443 dans le pare-feu Windows. `start:prod` applique les migrations à chaque démarrage du service.
Vérifiez que le fuseau horaire de Windows est « Paris » : numéros d'appel, happy hour et heures imprimées en dépendent.

## 3. Certificat sur les tablettes

Caddy signe le certificat avec sa propre autorité locale. Installez cette autorité une fois sur chaque appareil :

1. Récupérez le fichier `root.crt` :
   - Linux : `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt` ;
   - Windows (service NSSM) : `C:\Windows\System32\config\systemprofile\AppData\Roaming\Caddy\pki\authorities\local\root.crt`.
2. Copiez-le sur la tablette.
3. Installez-le comme autorité de confiance :
   - Android : Paramètres > Sécurité > Chiffrement > Installer un certificat > Certificat CA ;
   - iPad : ouvrez le fichier, installez le profil, puis Réglages > Général > Informations > Réglages des certificats > activez la confiance totale.
4. Ouvrez `https://192.168.1.10`, connectez-vous, puis « Installer l'application ».

## 4. Sauvegardes

`npm run db:backup` fait une copie à chaud et cohérente de la base dans `BACKUP_DIR`, vérifie son intégrité et garde les 30 dernières (`BACKUP_KEEP`). Chaque copie contient tout l'historique.

Planifiez-la chaque nuit, après la fermeture :

```bash
# crontab -e (utilisateur restoflow) : tous les jours à 4 h
0 4 * * * cd /opt/restoflow/server && npm run db:backup >> /opt/restoflow/data/backup.log 2>&1
```

Sous Windows, utilisez le Planificateur de tâches : programme `npm.cmd`, arguments `run db:backup`, dossier `C:\restoflow\server`.

Gardez au moins une copie hors du mini-PC : clé USB, ou `BACKUP_DIR` dans un dossier synchronisé (Nextcloud, Google Drive…). Les données fiscales doivent être conservées 6 ans.

**Restauration** (à tester une fois avant la mise en service) :

```bash
sudo systemctl stop restoflow
rm -f /opt/restoflow/data/restoflow.db-wal /opt/restoflow/data/restoflow.db-shm   # journal WAL de l'ancienne base
cp /mnt/usb/restoflow-backups/restoflow-AAAA-MM-JJ-HH-MM-SS.db /opt/restoflow/data/restoflow.db
sudo systemctl start restoflow
```

Vérifiez ensuite l'audit d'intégrité dans Gestion > Clôtures & Fiscalité.

## 5. Mise à jour

```bash
npm run db:backup                    # toujours avant une mise à jour
cd /opt/restoflow && git pull
npm ci && npm run build
cd server && npm ci && npm run build
sudo systemctl restart restoflow     # applique les migrations au démarrage
```

Les tablettes proposent la nouvelle version au prochain chargement.

## 6. Pannes et mode dégradé

Le mode hors-ligne couvre une **tablette** qui perd le Wi-Fi : elle continue à prendre les commandes et les envoie au retour du réseau.
Il ne couvre pas la panne du **mini-PC**, de la box/du switch ou de l'imprimante cuisine : la cuisine ne reçoit alors plus rien.

**Matériel à prévoir**

- Un onduleur pour le mini-PC, la box (ou le switch) et l'imprimante cuisine : il absorbe les micro-coupures et laisse le temps de finir le service.
- Le BIOS du mini-PC réglé pour redémarrer seul au retour du courant (« Restore on AC power loss : Power on ») ; les services RestoFlow et Caddy démarrent automatiquement.

**Procédure papier** (à imprimer et ranger près du passe, avec un carnet de bons et un carnet de reçus)

1. Le badge passe à « Hors-ligne » sur toutes les tablettes en même temps : le problème vient du mini-PC ou du réseau, pas d'une tablette.
2. Prévenez la cuisine et passez aux bons papier. Les tablettes peuvent continuer à saisir les commandes pour les retrouver ensuite, mais rien n'arrive en cuisine.
3. Encaissez sur la tablette si possible (l'encaissement est mis en file et le ticket définitif est numéroté au retour du serveur). Sinon, remettez un reçu manuel et saisissez la vente au retour.
4. Redémarrez le mini-PC. S'il ne repart pas, restaurez la dernière sauvegarde sur un poste de secours (section 4).
5. Au retour du serveur, ouvrez le badge de chaque tablette : une action **refusée** (badge rouge) doit être traitée à la main, en particulier un encaissement refusé, car la table est alors toujours ouverte sur le serveur.

## Modifier le schéma (développement)

`npm run db:migrate:dev -- --name <description>` crée une migration dans `server/prisma/migrations/`. Versionnez-la. N'utilisez plus `prisma db push` : il ne garde pas d'historique et peut supprimer des données.
