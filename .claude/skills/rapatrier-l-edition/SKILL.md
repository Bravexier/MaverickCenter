---
name: rapatrier-l-edition
description: "Rapatrier dans data/rows les modifications faites sur le site de dev (journal téléchargé, npm run db:appliquer-edition), puis contrôler et commiter. À charger quand le propriétaire fournit un journal d'édition ou demande de reprendre ses modifications du site de dev."
---

# Rapatrier les modifications du site de dev

Le site de dev est la source de ce qu'il modifie (décision du propriétaire). Ses modifications reviennent dans le dépôt de deux façons :
- par le bouton « Effectuer la mise à jour » de `/mise-a-jour/` (`zone-mise-a-jour`) ;
- par un journal que le propriétaire télécharge (« N modifications à rapatrier »).

Détail : `docs/serveur.md`, « Édition des règles » (rapatriement).

```bash
cd client
npm run db:appliquer-edition -- <chemin/journal-edition-AAAA-MM-JJ.json>   # rejoue le journal sur data/rows ; rien n'est écrit en cas de conflit
npm run db:build && npm run db:check && npm test
```

- **Conflit.** Un lot en conflit n'écrit rien. Rapporter le message tel quel au chef : c'est le propriétaire qui dit quoi refaire sur le site de dev, jamais une correction à la main de `data/rows`.
- **Historique.** Les modifications rejouées entrent dans `historique_modification` avec une version vide. Un lot déjà présent dans l'historique n'est pas repris.
- **Textes refusés.** Un texte qui ajoute du HTML brut ou un lien non sûr est refusé après le rejeu (`lib/markdown-sur.mjs`) : rien n'est écrit.
- **Publication.** `tech-publication` commite `data/rows`, jamais le journal (`publier-une-branche`). Le rapport liste les fichiers du lot.
