# Demande à `tech-skills` : skills à mettre à jour pour R316 (l'adresse d'une page suit son titre)

Remise par le `leader-technique`, après le chantier `docs/chantier-adresses.md` (décision R316, migration 0133). Aucun skill n'est modifié par ce chantier : chaque ligne donne la phrase à corriger (citée) et son remplacement proposé. Les skills ne se modifient que par `tech-skills` (`tenir-un-skill`). Citations relues contre les skills de `dev` après le rebase sur la connexion Discord (`ad5024da`, R310 à R313) : seule la ligne citée de `base-sqlite` a bougé (§8).

Fait nouveau à dire dans les skills :
- `page.slug_adresse` (`NULL` : l'adresse se tire de l'identifiant) et la table `page_ancienne_adresse` (migration `0133`, structure seule) ;
- `lib/adresses-renommees.mjs` (état installé, lu par le build et par la chaîne de l'édition du navigateur), `lib/metiers.mjs#cheminDePage(id, slug)`, `lib/adresses-db.mjs` (lecture en base) ;
- `serveur/edition-adresses.mjs#suivreLesTitres` (suivi en fin de lot, jamais en annulation ni au rejeu) ;
- le service lit toujours la base vivante (le segment, `null` compris) et n'appelle jamais `installerLesAdresses` ; le build et le navigateur installent l'état une fois.

## 1. `site-wiki-liens`

- Ligne 19, « `client/src/pages/404.astro` : renvois des anciennes adresses (`data-renvois` : le guide ; `data-eclatees` : les pages éclatées). »
  → ajouter « ; `data-renvois` reçoit aussi une ligne par `page_ancienne_adresse` (R316, adresse d'aujourd'hui de la page, requête et ancre gardées) ».
- Ligne 38, « Une page est à `/<type>/<slug>/` (`src/pages/[type]/`). »
  → « Une page est à `/<type>/<segment>/` (`src/pages/[type]/`) : `<segment>` est `page.slug_adresse` s'il est posé (page renommée, R316), sinon le slug de l'identifiant ; `cheminDePage` le lit (`lib/adresses-renommees.mjs`). »
- Ligne 42, « Ses anciennes adresses (`/guide/…`, `/regles/avancees/…`, `/decouvrir/<étape>/`) sont renvoyées par la page 404 d'après des listes figées »
  → ajouter à la suite de la liste : « et, pour une page renommée, d'après `page_ancienne_adresse` (R316) ».

## 2. `zone-mots-cles-liens`

- Ligne 11, « `lib/adresses-db.mjs` : `adressesDuSite` (où une adresse peut mener), `pageDeLAdresse` (la page où elle mène), »
  → ajouter « ; ils connaissent l'adresse renommée (`page.slug_adresse`, R316) ; une ancienne adresse (`page_ancienne_adresse`) n'est connue que de `pageDeLAncienneAdresse` (la page 404 du site de dev) : un lien saisi vers elle est refusé (400) ; `slugsDAdresse` lit les segments posés ».
- Nouvelle ligne après la ligne 22 (`mot_cle.url`) : « R316 : le service tient `mot_cle.url` d'une page renommée (le mot-clé ancré, et tout mot-clé dont le chemin était l'adresse quittée : requête et ancre gardées) ; `db:check` admet la nouvelle adresse. »

## 3. `zone-mots-cles-service`

- Nouvelle ligne après la ligne 34 (R221) : « R316 : en fin de lot, `serveur/edition-adresses.mjs#suivreLesTitres` (appelé par `edition-ancrage.mjs#suivreLesElements`) recalcule l'adresse de chaque page dont le titre a changé et écrit lui-même `mot_cle.url` du mot-clé ancré de la page et des mots-clés qui menaient à l'adresse quittée (pas `alignerMotCle`) ; jamais en annulation ni au rejeu. Aucun de ses refus ne cite un `R<n>`. »

## 4. `zone-guide`

- Ligne 11, « `client/src/lib/livres.mjs` : sans import, sans couleur (il entre dans la chaîne de l'édition du navigateur), testé. »
  → « `client/src/lib/livres.mjs` : un seul import, `lib/adresses-renommees.mjs` (qui n'importe rien), sans couleur (il entre dans la chaîne de l'édition du navigateur), testé. »
- Ligne 11, « L'adresse d'une page ne vient que de `adresseDuGuide`, appelée par `lib/metiers.mjs#adresseDePage`. »
  → « … appelée par `lib/metiers.mjs#adresseDePage`, à laquelle le segment d'une page renommée (`slug_adresse`, R316) est passé. »
- Ligne 31, « Le `<slug>` est celui de l'id, sauf pour la liste figée `ADRESSES_RENOMMEES_DU_GUIDE` de `livres.mjs` : … Exception voulue par le propriétaire à « Identifiants figés » : l'id ne change pas, seule l'adresse. »
  → « Le `<slug>` est `page.slug_adresse` s'il est posé (page renommée, R316), sinon celui de l'id, sauf pour la liste figée `ADRESSES_RENOMMEES_DU_GUIDE` de `livres.mjs` : … R228 et R272 restent vraies (deux adresses déjà changées à la main) ; un `slug_adresse` posé l'emporte sur cette liste. »
- Ligne 44, « Renvois figés (listes, jamais un préfixe deviné), servis par la page 404 »
  → ajouter « ; les anciennes adresses d'une page renommée viennent de `page_ancienne_adresse`, non de ces listes ».

## 5. `zone-metiers`

- Ligne 25, « qui renvoie un métier à `/metiers/#metier-<slug>`. »
  → « qui renvoie un métier à `/metiers/#metier-<segment>` (`<segment>` : `slug_adresse` s'il est posé, sinon le slug de l'id, R316) ; la ligne du tableau porte aussi ses anciennes ancres, et `/metiers/#metier-<ancien>` y mène. »
- Ligne 10, « `cheminDePage` » dans la liste de lecture → « `cheminDePage(id, slug)` (`slug` : le segment lu en base par le service, `null` compris ; absent, l'état installé du build) ».

## 6. `zone-edition` et `zone-edition-lots`

- `zone-edition`, ligne 23 (renvoi vers `zone-mots-cles-service`) : ajouter « ; l'adresse d'une page renommée : `serveur/edition-adresses.mjs` (R316, skill `zone-mots-cles-service`) ».
- `zone-edition`, nouvelle ligne : « La page 404 du site de dev, avant la refabrication, demande `GET /api/edition/page-de-l-adresse/?adresse=…` (classe `lecture`, comme `GET /api/edition/pages/`) quelle page vit à cette adresse, puis renvoie à l'adresse où le site construit sert encore la page renommée (`scripts/edition/nouvelles.mjs`) ; elle ne la dessine pas. »
- `zone-edition-lots`, ligne 35 (« Annuler une ligne … ») : ajouter « Les lignes d'un renommage d'adresse (`page.slug_adresse`, `page_ancienne_adresse`, `mot_cle.url`) s'annulent comme celles d'un renommage du chantier 1 ; `slug_adresse` et `page_ancienne_adresse` ne s'écrivent que par `edition-adresses.mjs`, l'annulation et le rejeu. »

## 7. `site-version-portable`

- Ligne 17, « `text.mjs`, `search.mjs`, `fiche-moteur.mjs`, `fiche-format.mjs`, `personnages-liste.mjs`, `liste-choix.mjs` sont importés côté navigateur. »
  → ajouter « `adresses-renommees.mjs` (sans import ; `Base.astro` l'écrit dans `#adresses-renommees`, la chaîne de l'édition l'installe une fois : jamais deux lectures mêlées côté service) ». La version portable n'écrit aucune adresse : rien d'autre à dire.

## 8. `base-sqlite`

- Ligne 9, « 222 tables STRICT, FTS5, 38 vues » → « 224 tables STRICT, FTS5, 38 vues » (`data/schema.sql` : 224 `CREATE TABLE`, 38 `CREATE VIEW`, 215 `CREATE INDEX`) ; ajouter, si le skill les compte, « 464 clés étrangères » (`client/test/debug-schema.test.mjs:529` : « 224 tables, 38 vues, 464 clés étrangères »).
- Section 1 (« pages, liens, mots-clés, sources »), liste des tables : ajouter `page_ancienne_adresse` (migration 0133, vide à la migration) et la colonne `page.slug_adresse`.
- Ligne 44 (43 avant la connexion Discord), « Identifiants figés : un id ne dérive plus du nom depuis la migration 0006 ; un nom corrigé ou renommé garde son id, une page renommée garde son adresse (skill `base-orthographe`). »
  → « … un nom corrigé ou renommé garde son id ; l'adresse d'une page renommée suit son titre (`page.slug_adresse`, R316) et l'ancienne mène à la page (`page_ancienne_adresse`) (skill `base-orthographe`). »
- Les « compteurs » de `ecrire-une-migration` (ligne 21) renvoient à ce skill : rien à changer là.

## 9. `base-orthographe`

- Ligne 35, « gardent la clé du nom d'origine ; une page renommée garde son adresse. »
  → « gardent la clé du nom d'origine ; l'adresse d'une page renommée suit son titre, hors correction d'accent ou de majuscule qui ne déplace rien (R316). »
- Ligne 32 (R266) : « ids, clés et adresses ne changent pas » reste vraie pour ces trois corrections (aucune page ne portait encore `slug_adresse`) ; rien à changer.

## 10. `relecture-db`

- Ligne 91, « **Identifiants figés** : un nom corrigé l'est partout et sa clé `*_cle` est recalculée, mais son identifiant ne change jamais »
  → ajouter « ; l'adresse d'une page suit son titre (R316) : un renommage écrit `slug_adresse` et `page_ancienne_adresse`, jamais une migration ».

## Sans changement

`base-sqlite-migrations:14` et `zone-ceinture:47` (identifiants figés d'une page retirée, histoire), `revue-de-diff:30`, `zone-magies` (ancres figées d'intertitres : R316 ne les touche pas), `sources-codex:39`.

## 11. Complément (service fini)

- `zone-edition-lots`, ligne 35 : la phrase proposée au §6 devient « Annuler la ligne d'un renommage qui a déplacé l'adresse emporte un groupe (`lignesEmportees`, `groupesDesAdresses` : la ligne de l'élément, celle de la page, ses anciennes adresses, l'`url` des mots-clés qui l'ont suivie), entier ou en place ; l'annulation est refusée tant qu'une autre page tient l'adresse d'avant (contrôle `adresse_en_double`). `slug_adresse` et `page_ancienne_adresse` ne s'écrivent que par `edition-adresses.mjs` (aucun lot déposé : `refusDeLAdresse`). »
- `zone-mise-a-jour-lots` : ajouter à sa liste de ce que fait l'annulation d'une ligne : « un renommage qui a déplacé l'adresse s'annule en groupe (`lignesEmportees`, R316) ; un groupe dont une ligne ne s'annule pas reste en place ; l'adresse n'a pas de ligne propre dans la note de version ».
- `zone-service` : si sa liste des modules `serveur/edition-*.mjs` nomme `edition-ancrage.mjs`, ajouter « `edition-adresses.mjs` (l'adresse qui suit le titre, R316 ; `outilsDesAdresses`, `refusDeLAdresse`) » ; `controles-du-contenu.mjs` : trois contrôles nouveaux, `adresse_en_double`, `ancienne_adresse_tenue`, `adresse_route_fixe`, lus aussi par `db:check`.
- `zone-api-rest` et `zone-edition` : ajouter « `GET /api/edition/page-de-l-adresse/?adresse=<chemin>` (classe `lecture`, comme `/api/edition/pages/` ; `{ page }`) : la page vivante à cette adresse, sinon celle dont c'est une ancienne adresse, sinon `null` ; lue par la page 404 du site de dev avant la refabrication (`scripts/edition/nouvelles.mjs`) ». Cette route n'est pas dans `/api/v1/` (`zone-api-rest` : à signaler seulement comme non reprise).
- Le libellé de la table `page_ancienne_adresse` (`lib/libelles-de-la-base.mjs`) est « Ancienne adresse de la page » : à reprendre si un skill cite la table.
