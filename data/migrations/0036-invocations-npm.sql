-- 0036-invocations-npm : les créatures invoquées n'ont pas d'échelle de puissance (EP) ; le « EP1 » à « EP5 » de l'onglet « Marionette de lombre » du
-- classeur « Invocation » est une faute du classeur pour leur niveau de puissance magique, le NPM (décision R53 du propriétaire : « Les créatures
-- invoquées n'ont pas de EP. c'est les pets invoqués par les joueurs. Leur "rang" c'est directement lié au Niveau de Puissance Magique » ; « C'est pour
-- le coup une faute sur le classeur »). Migration de STRUCTURE et de DONNÉES.
--   * Structure : la colonne invocation_bloc.ep devient npm (même place, même contrainte) ; la vue v_creature_cout_invocation, qui la lisait, est
--     refaite (sa colonne ep devient npm).
--   * Données : « EPN » devient « NPM N » dans le texte des pages, la ligne « Libellé du bloc » des cinq marionnettes et la liste « Créatures » de la page
--     de l'invocation. L'écriture de la marge reste en trace, comme toute colonne `_brut` (invocation_bloc.marge_brut = 'EP1'…), de même que la clé du
--     bloc ('ep1'…), qui est dans son identifiant (identifiants stables : creature.bloc_id le cite).

DROP VIEW v_creature_cout_invocation;

ALTER TABLE invocation_bloc RENAME COLUMN ep TO npm;

CREATE VIEW v_creature_cout_invocation AS
  SELECT c.id AS creature_id, i.id AS invocation_id, s.id AS sort_id, s.nom AS sort_nom,
         s.cout_brut AS cout_brut, s.cout_chakra AS cout_chakra, s.cout_ressource AS cout_ressource,
         s.cout_ressource_valeur AS cout_ressource_valeur, b.npm AS npm
  FROM creature c
  JOIN invocation i ON i.id = c.invocation_id
  JOIN invocation_bloc b ON b.id = c.bloc_id
  JOIN sort s ON s.id = i.sort_id;

-- la page d'une marionnette (même identifiant que sa créature) : « **Libellé du bloc** : EP3 » -> « **Libellé du bloc** : NPM 3 »
UPDATE page SET corps_md = replace(corps_md,
    '**Libellé du bloc** : ' || (SELECT b.marge_brut FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id WHERE c.id = page.id),
    '**Libellé du bloc** : NPM ' || (SELECT b.npm FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id WHERE c.id = page.id))
WHERE id IN (SELECT c.id FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id WHERE b.npm IS NOT NULL);

-- la page de l'invocation : « - EP1 : Ombre rampante » … « - EP5 : Bête de l'Ombre » -> « - NPM 1 : Ombre rampante » …
UPDATE page SET corps_md =
    replace(replace(replace(replace(replace(corps_md,
      char(10) || '- EP1 : ', char(10) || '- NPM 1 : '),
      char(10) || '- EP2 : ', char(10) || '- NPM 2 : '),
      char(10) || '- EP3 : ', char(10) || '- NPM 3 : '),
      char(10) || '- EP4 : ', char(10) || '- NPM 4 : '),
      char(10) || '- EP5 : ', char(10) || '- NPM 5 : ')
WHERE id = 'bestiaire/marionette-de-lombre';
