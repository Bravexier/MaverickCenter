---
name: zone-mise-a-jour-lots
description: "Section « Modifications de l'équipe » de la page /mise-a-jour/ (R291) : lots de changements proposés ou appliqués, annulation ligne par ligne, Appliquer, Refuser, Refaire l'essai, lib/lots-rendu.mjs. À charger avant de lire, modifier ou relire ce rendu. Page et notes de version : `zone-mise-a-jour`."
paths: ["client/src/lib/lots-rendu.mjs", "client/test/lots-rendu*.test.mjs", "client/test/mise-a-jour-lots.test.mjs"]
user-invocable: false
---
# Mise à jour : modifications de l'équipe

Page, notes de version, référence, couleurs R29 : skill `zone-mise-a-jour`. Ce que le service fait d'un lot : skill `zone-edition-lots`. Le rendu pur est `lib/lots-rendu.mjs`, monté par `src/scripts/mise-a-jour.mjs`.

- R291 : un lot déposé avec la clé de dépôt est appliqué aussitôt (skill `zone-edition-lots`) ; la page montre les changements ligne par ligne, comme les notes de version. Section `[data-nv-lots]` « Modifications de l'équipe » entre les listes de la note en préparation et les conflits, qui restent derniers (`zone.append(sectionDesLots(), sectionDesConflits())`).
- `charger()` lit `GET edition/lots/` ; 401, 403 ou 404 (production, service sans les lots, mot de passe annulé) cachent la section ; toute autre erreur est dite. Le détail n'est lu que pour les propositions en attente et les 10 appliqués les plus récents (`APPLIQUES_RECENTS`).
- Un changement appliqué montre ses lignes (`lignes` du détail), chacune avec « Annuler cette modification » : aperçu, puis `<dialog>` de confirmation (mot de passe, par `scripts/acces.mjs`). Le bouton n'existe que si la ligne est `en_place` et `annulable_seule` ; sinon la page dit le `motif`. Plus d'« Annuler ce lot » sur la page.
- « Appliquer » et « Refuser » (confirmation ; une case par décision verrouillée, le bouton reste inactif tant qu'elle n'est pas cochée, le clic envoie `verrous_ouverts`) ne servent que les propositions en attente, dans `[data-nv-lots-attente]`, présent seulement s'il en reste (clé de dépôt non posée) ; aussi « Refaire l'essai » et « Tout recalculer ». Après un clic, `charger()` relit la note. Un dépôt refusé (`refus`) laisse une trace repliée `[data-nv-lots-refus]`, avec ses motifs.
- Aucun jargon sur la page (ni « nature », ni « opération ») ; toute valeur est échappée.

## Tests
- `lots-rendu` (module pur), `mise-a-jour-lots` (le script, en faux navigateur), `lots-rendu-service` (sur un vrai lot du service).
- `test/palette-css.test.mjs` : aucune couleur écrite dans la zone (`lots-rendu` compris : skill `ui-couleurs-theme`).
