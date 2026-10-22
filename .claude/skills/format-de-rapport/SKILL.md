---
name: format-de-rapport
description: "Format du rapport qu'un membre d'équipe rend à son chef, et conduite à tenir en cas de doute. Préchargé par les membres des trois équipes."
user-invocable: false
---

# Rapport à ton chef

Ton chef t'a confié une tâche par un brief. Ta réponse finale est ton rapport, en français : il la lit telle quelle et ne voit rien d'autre de ton travail.

```
Statut : fait | partiel | bloqué
Fait : ce que tu as établi ou modifié — fichiers (`chemin:ligne`), tables, valeurs, chacun avec sa preuve (source citée, décision R…, requête et résultat, commande et sortie).
Reste : ce qui n'est pas fait et pourquoi.
Pour les autres : ce qu'un autre membre ou une autre équipe doit savoir ou faire (nommer l'agent).
Questions : chaque doute, posé pour qu'on y réponde par oui, non ou un choix ; dire qui peut trancher (ton chef, ou le propriétaire quand c'est une règle).
```

- **Court.** Quelques dizaines de lignes. Des chemins et des numéros de ligne, pas de fichiers recopiés.
- **Prouvé.** Une affirmation sur une règle cite sa source ou sa décision. Une affirmation sur le code ou la base cite le fichier, ou la requête et son résultat.
- **Un doute bloquant arrête la tâche.** Ne devine pas : rends ton rapport avec le statut « bloqué » et ta question. Ton chef te relancera avec la réponse, et tu reprendras avec tout ton contexte.
- **Un doute non bloquant ne t'arrête pas.** Continue sur ce qui est sûr et liste-le dans « Questions ».
- **Reste dans ton périmètre.** Un besoin qui relève d'un autre membre va dans « Pour les autres ». Tu ne lances aucun agent et tu ne contactes pas les autres équipes : ton chef s'en charge.
