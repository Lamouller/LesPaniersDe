# Déploiement — Self-host VPS

Ce guide décrit le déploiement de LesPaniersDe sur un VPS Linux (Debian/Ubuntu recommandé).

---

## Prérequis

- Un VPS avec au moins **2 vCPU / 4 Go RAM / 40 Go SSD**
- Debian 12 ou Ubuntu 22.04 LTS (recommandé)
- Un domaine pointant vers l'IP du VPS
- Accès SSH root ou sudoer

---

## 1. Préparer le serveur

```bash
# Mise à jour système
apt update && apt upgrade -y

# Outils essentiels
apt install -y git curl wget htop ufw fail2ban

# Pare-feu — autoriser SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Créer un utilisateur dédié (ne pas tourner en root)
adduser deployer
usermod -aG sudo deployer
usermod -aG docker deployer
```

---

## 2. Installer Docker

```bash
# Méthode officielle Docker
curl -fsSL https://get.docker.com | sh

# Vérifier l'installation
docker --version
docker compose version
```

---

## 3. Configurer le DNS

Chez votre registrar ou hébergeur DNS, créer les enregistrements suivants (remplacer `1.2.3.4` par l'IP de votre VPS) :

```
Type    Nom               Valeur
A       @                 1.2.3.4
A       api               1.2.3.4
A       studio            1.2.3.4
A       www               1.2.3.4
```

Attendre la propagation DNS (quelques minutes à 48h selon le TTL).

Vérifier : `dig +short votredomaine.fr` doit retourner l'IP du VPS.

---

## 4. Cloner et configurer

```bash
su - deployer

# Cloner le dépôt
git clone https://github.com/Lamouller/LesPaniersDe.git
cd LesPaniersDe

# Configurer l'environnement
cp .env.example .env
nano .env
```

Variables à renseigner impérativement dans `.env` :

```bash
NEXT_PUBLIC_APP_URL=https://votredomaine.fr
NEXT_PUBLIC_SUPABASE_URL=https://api.votredomaine.fr
DOMAIN=votredomaine.fr
ADMIN_EMAIL=admin@votredomaine.fr
POSTGRES_PASSWORD=un-mot-de-passe-long-et-aleatoire
JWT_SECRET=un-secret-jwt-32-caracteres-minimum
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # généré dans l'étape suivante
SUPABASE_SERVICE_ROLE_KEY=...       # généré dans l'étape suivante
```

---

## 5. Générer les clés Supabase

Les clés JWT Supabase sont des tokens signés avec votre `JWT_SECRET`. Vous pouvez les générer sur [jwt.io](https://jwt.io) ou via la commande suivante :

```bash
# Installer Node.js si absent
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Générer les clés (remplacer YOUR_JWT_SECRET)
node -e "
const jwt = require('jsonwebtoken');
const secret = 'YOUR_JWT_SECRET';
const anon = jwt.sign({ role: 'anon', iss: 'supabase' }, secret, { expiresIn: '10y' });
const service = jwt.sign({ role: 'service_role', iss: 'supabase' }, secret, { expiresIn: '10y' });
console.log('ANON:', anon);
console.log('SERVICE_ROLE:', service);
"
```

Copier ces valeurs dans `.env`.

---

## 6. Configurer Kong

Créer le fichier de configuration Kong requis par le service Supabase :

```bash
# Le fichier kong.yml est inclus dans le dépôt
# Vérifier qu'il existe :
ls supabase/kong.yml
```

Si absent, se référer à la documentation officielle Supabase self-hosted : https://supabase.com/docs/guides/self-hosting/docker

---

## 7. Lancer la stack

```bash
# Lancement (Caddy va automatiquement générer les certificats SSL)
./setup.sh

# Ou manuellement :
docker compose up -d

# Vérifier que tous les services sont UP
docker compose ps
```

Caddy contacte Let's Encrypt automatiquement lors du premier démarrage. Votre site sera disponible en HTTPS dans quelques secondes.

---

## 8. Vérifier le déploiement

```bash
# Tester l'application
curl -I https://votredomaine.fr

# Tester l'API Supabase
curl https://api.votredomaine.fr/health

# Logs en temps réel
docker compose logs -f app
```

---

## 9. Charger les données OSM pour OSRM

```bash
# Créer le répertoire des données OSRM
mkdir -p volumes/osrm

# Télécharger les données France (ou votre région)
wget https://download.geofabrik.de/europe/france-latest.osm.pbf -P volumes/osrm/

# Pré-traiter les données (peut prendre 30-60 min pour la France entière)
docker run -t -v $(pwd)/volumes/osrm:/data osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/france-latest.osm.pbf

docker run -t -v $(pwd)/volumes/osrm:/data osrm/osrm-backend \
  osrm-partition /data/france-latest.osrm

docker run -t -v $(pwd)/volumes/osrm:/data osrm/osrm-backend \
  osrm-customize /data/france-latest.osrm

# Redémarrer OSRM avec les données chargées
docker compose restart osrm
```

Pour une région spécifique (plus rapide) : remplacer `france` par `bretagne`, `ile-de-france`, `occitanie`, etc. sur https://download.geofabrik.de/europe/france.html

---

## 10. Backup automatique PostgreSQL

Créer un script de backup quotidien :

```bash
cat > /home/deployer/backup-postgres.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/deployer/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Dump complet
docker compose -f /home/deployer/LesPaniersDe/docker-compose.yml exec -T db \
  pg_dump -U postgres postgres | gzip > "$BACKUP_DIR/lespaniersde_$DATE.sql.gz"

# Conserver seulement les 30 derniers jours
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup terminé : $BACKUP_DIR/lespaniersde_$DATE.sql.gz"
EOF

chmod +x /home/deployer/backup-postgres.sh

# Planifier via cron (backup quotidien à 3h du matin)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/deployer/backup-postgres.sh >> /home/deployer/backups/backup.log 2>&1") | crontab -
```

---

## 11. Monitoring (optionnel)

Vérification périodique de la santé des services :

```bash
cat > /home/deployer/healthcheck.sh << 'EOF'
#!/bin/bash
# Vérifier que l'application répond
if ! curl -sf https://votredomaine.fr/api/health > /dev/null; then
  echo "ALERTE : l'application ne répond pas"
  # Ajouter ici une notification (email, webhook...)
fi
EOF

chmod +x /home/deployer/healthcheck.sh

# Vérification toutes les 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/deployer/healthcheck.sh") | crontab -
```

---

## 12. Mises à jour

```bash
cd /home/deployer/LesPaniersDe

# Récupérer les nouvelles versions
git pull origin main

# Reconstruire et redémarrer l'application
docker compose up -d --build app

# Vérifier les logs après mise à jour
docker compose logs -f app
```

---

## Résolution de problèmes courants

### Caddy ne génère pas le certificat SSL

```bash
# Vérifier les logs Caddy
docker compose logs caddy

# Causes fréquentes :
# - DNS pas encore propagé (attendre)
# - Pare-feu bloque le port 80 (ACME HTTP challenge)
# - ADMIN_EMAIL invalide dans .env
```

### L'application renvoie une erreur 502

```bash
# Après un rebuild du backend, Nginx/Caddy cache le DNS
docker compose restart caddy

# Vérifier l'état de tous les services
docker compose ps
```

### PostgreSQL ne démarre pas

```bash
docker compose logs db

# Si données corrompues (dernier recours)
docker compose down
docker volume rm lespaniersde_postgres_data
docker compose up -d
# Puis restaurer depuis un backup
```
