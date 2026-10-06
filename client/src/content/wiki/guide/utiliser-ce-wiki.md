---
title: Utiliser ce wiki
aliases: [Aide, Comment contribuer]
tags: [aide]
summary: Comment écrire des pages reliées entre elles par mots-clés.
status: example
sources: [Page de démonstration — à remplacer]
---

Chaque page est un fichier Markdown dans `client/src/content/wiki/<catégorie>/`. Pour relier deux pages, écrivez le titre
(ou un alias) entre doubles crochets :

- `[[Titre]]` crée un lien vers la page qui porte ce titre, ce slug ou cet alias ;
- `[[Titre|texte affiché]]` change le texte du lien ;
- `[[races/slug]]` désigne une page précisément quand deux titres se ressemblent.

La casse, les accents et les apostrophes sont ignorés. Un lien vers une page qui n'existe pas s'affiche en rouge
et la page est listée dans « Pages à créer » de l'index.

## Exemple de liens

Un personnage de démonstration est une [[Race d'exemple]] qui suit la [[Classe d'exemple]] et pratique la [[Magie d'exemple]].
Il peut affronter une [[Créature d'exemple|créature quelconque]].

Chaque page cible affiche automatiquement les pages qui la mentionnent (« Mentionnée par »).
