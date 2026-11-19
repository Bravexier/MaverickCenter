# Essai de bout en bout de `activer.sh` (lot 11, PR 5a)

Rejoue `deploy/installateur/activer.sh` sur un monde factice mais réel : le **vrai kit** (`deploy/installateur/kit.mjs`), un **vrai paquet** de mise à jour
(`serveur/paquet.mjs#fabriquerPaquet`, fait de l'extrait du jour `var/extrait/maverick-dev.db`), le **vrai service** de production (sous un petit superviseur qui le
relance comme `restart: unless-stopped`), et des conteneurs exécutés sous `setpriv` sans capacité, sans réseau, dans une racine en lecture seule (`docker.mjs`).

```bash
sudo bash tools/essai-activation/lancer.sh reussite      # la production passe à la version du kit
sudo bash tools/essai-activation/lancer.sh refus         # un autre paquet sous le nom que le kit annonce : refusé, rien ne change
sudo bash tools/essai-activation/lancer.sh retour        # le service du kit ne démarre pas : retour automatique
sudo bash tools/essai-activation/lancer.sh retour-base   # il démarre, refait la base, mais ne répond pas : retour automatique, base remise (sha256)
```

- Le monde est sous `ESSAI_ACTIVATION` (défaut `/srv/essai-activation`), refait à chaque cas ; le modèle (kit, site précédent, paquet) est gardé dans `modele/` (`rm modele/pret` le refait).
- Il lui faut : root, `unshare`, `setpriv`, `flock`, Node ≥ 22.13, un site précédent fabriqué (`ESSAI_SITE_PRECEDENT`, défaut `/srv/atelier-essai/travail/site`) et l'extrait du jour
  (`npm run db:extrait`, lecture seule : `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt MAVERICK_EXTRAIT_CLE=x`). Il crée l'utilisateur système `maverick-site` s'il manque.
- `lancer.sh` imprime, avant et après, le sha256 de la base de la production, celui de l'arbre de `site/` et de `site.precedent/`, l'état du gel, le rapport.
- Ne remplace pas `test/deploy-activer.test.mjs` (la suite, sans root ni Docker) : elle prouve la logique, cet essai prouve que le kit, le paquet et le service réels s'accordent.
