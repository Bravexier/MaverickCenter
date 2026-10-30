-- 0087-r180-reussite-critique : décision R180 du propriétaire, « nerf de la réussite critique » (docs/decisions-regles.md, 2026-10-30).
-- Migration de STRUCTURE et de DONNÉES. Les originaux (lus le 2026-10-30, R83) gardent l'ancienne valeur : chaque valeur changée d'un classeur
-- a son entrée `voulus` R180 dans tools/sources/ignorer/<classeur>.json. Les pages du guide qui disent la règle sont passées par db:sync-pages.
--   * Affûtage (Foudre, niveau 1) coûte 4 chakra (« Le sort monte à 4 chakra pour l'utiliser ») ; son effet « 2% (+1/NM) » ne change pas
--     (« Garder le +1/NM »), son coût secondaire reste NULL (R105, R106). La ligne du tableau « Sorts » de sa page suit (« 4.0 », écriture des
--     nombres du classeur que lib/corps-magies.mjs tient pour égale à « 4 »).
--   * « Prends ça … » (Moine guerrier, niveau 20) est un IC (« La réussite critique augmente de 5% (au lieu de 10%) pour la prochaine attaque et
--     c'est un IC »), écrit dans son effet ; son type « Actif (3 fois/combat) » ne change pas. Sa fiche (corps et résumé) suit
--     (lib/corps-classes.mjs#changementsDePageDeDon).
--   * Mode Hyper de la Lumière : « Toutes les amplification deviennent des IC en plus de tout le reste », « Ajouter, mêmes exceptions » : les trois
--     copies du même texte (versions classeur_modes, onglet_magie, fiche ; mono et bi), pas magie_masque (« Les soins deviennent des IC (Instant
--     Cast) et sont au maximum de leur effet. », Magie V8 › Mode Hyper (Magie) › H13:M13, un autre texte). Le bloc « Capacité Mode Hyper » de la
--     page de la magie suit (lib/corps-magies.mjs). Chaque UPDATE est gardé par la valeur d'avant.
--   * Les nombres du critique en données, dans regle_constante (une phrase de guide/reussir-une-action chacun, comme R26 et R34) : base 5 ; paliers
--     96 (+2) et 103 (+5 au total) ; plafond 15 (« Le maximum absolu pour les réussites critiques est de 15% »).
--   * posture_critique (nouvelle table) : les jets où compte le bonus de critique d'une posture (« Le +5 % de l'Offensive ne compte que
--     pour les jets d'attaque (Arc, Arbalète, Arme légère, Arme lourde, Magie, Concentration). » ; Défensif : Esquive et Parade, R180 (4)) et d'un
--     don « (Posture Offensif) » (mêmes six jets, choix provisoire de game-design, Q90).

-- 1. Affûtage
UPDATE sort SET cout_brut = '4', cout_chakra = 4
WHERE id = 'magies/magie-de-la-foudre#sort:affutage' AND cout_brut = '2' AND cout_chakra = 2 AND cout_secondaire IS NULL;

UPDATE page SET corps_md = replace(corps_md,
  '| 1.0 | Affûtage | Amplification<br>(IC) | 2.0 | 1.0 | 1.0 | / |',
  '| 1.0 | Affûtage | Amplification<br>(IC) | 4.0 | 1.0 | 1.0 | / |')
WHERE id = 'magies/magie-de-la-foudre';

-- 2. « Prends ça … »
UPDATE capacite SET effet = 'Donne +5% à la réussite critique pour la prochaine attaque. C''est un IC.'
WHERE id = 'capacites/moine-prend-ca' AND effet = 'Donne +5% à la réussite critique pour la prochaine attaque.';

UPDATE page SET corps_md = 'Donne +5% à la réussite critique pour la prochaine attaque. C''est un IC.' || char(10),
                resume   = 'Donne +5% à la réussite critique pour la prochaine attaque. C''est un IC.'
WHERE id = 'capacites/moine-prend-ca'
  AND corps_md = 'Donne +5% à la réussite critique pour la prochaine attaque.' || char(10)
  AND resume = 'Donne +5% à la réussite critique pour la prochaine attaque.';

-- 3. Mode Hyper de la Lumière : trois copies, mono et bi (magie_masque intacte)
UPDATE mode_hyper_effet
SET effet = 'Les soins, les protections et les amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5).'
WHERE id IN ('classeur_modes:magies/magie-de-la-lumiere:mono', 'onglet_magie:magies/magie-de-la-lumiere:mono', 'fiche:magies/magie-de-la-lumiere:mono')
  AND effet = 'Les soins et les protections deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5).';

UPDATE mode_hyper_effet
SET effet = 'Chaque tour, un soin, une protection ou une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5).'
WHERE id IN ('classeur_modes:magies/magie-de-la-lumiere:bi', 'onglet_magie:magies/magie-de-la-lumiere:bi', 'fiche:magies/magie-de-la-lumiere:bi')
  AND effet = 'Chaque tour, un soin ou une protection est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5).';

UPDATE page SET corps_md = replace(replace(corps_md,
  '| Mono-Magie | Les soins et les protections deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). |',
  '| Mono-Magie | Les soins, les protections et les amplifications deviennent des IC le temps du mode hyper (sauf les sorts niveau de puissance 5). |'),
  '| Bi-magie | Chaque tour, un soin ou une protection est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |',
  '| Bi-magie | Chaque tour, un soin, une protection ou une amplification est un IC (seulement le premier IC). (sauf les sorts niveau de puissance 5). |')
WHERE id = 'magies/magie-de-la-lumiere';

-- 4. Les nombres du critique (regle_constante, phrases de guide/reussir-une-action)
INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES
  ('critique.base', 5, '%', 'texte', 'La réussite critique : de 1 à 5', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire', NULL),
  ('critique.palier_1_score_min', 96, '%', 'texte', 'de 96 à 102 %, +2 %', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire', NULL),
  ('critique.palier_1_bonus', 2, '%', 'texte', 'de 96 à 102 %, +2 %', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire', NULL),
  ('critique.palier_2_score_min', 103, '%', 'texte', 'à partir de 103 %, +5 % au total', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire',
   'Les deux paliers se cumulent (+2 puis +3, « ça ne se contredit pas ils se cumulent. +2 et +3 reviens à un total de +5. ») ; pas de borne haute.'),
  ('critique.palier_2_bonus', 5, '%', 'texte', 'à partir de 103 %, +5 % au total', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire',
   'Bonus total du palier, pas un ajout au +2 du premier palier.'),
  ('critique.plafond', 15, '%', 'texte', 'ne dépasse jamais 1 à 15, toutes sources ensemble', 'guide/reussir-une-action', 'fiche', 'Décision R180 du propriétaire',
   'Plage totale de la réussite critique, base de 5 comprise (+10 de bonus au plus), toutes sources ensemble (posture, score, dons, sorts, armes, accessoires, tenaille).');

-- 5. Jets où compte le bonus de critique d'une posture
CREATE TABLE posture_critique (
  posture_id    TEXT NOT NULL REFERENCES posture(id),
  bonus         TEXT NOT NULL CHECK (bonus IN ('posture', 'don_de_posture')),
  competence_id TEXT NOT NULL REFERENCES competence(id),
  PRIMARY KEY (posture_id, bonus, competence_id)
) STRICT, WITHOUT ROWID;

INSERT INTO posture_critique (posture_id, bonus, competence_id)
SELECT p.posture_id, p.bonus, c.id
FROM (SELECT 'guide/postures#posture:offensif' AS posture_id, 'posture' AS bonus
      UNION ALL SELECT 'guide/postures#posture:offensif', 'don_de_posture') p
CROSS JOIN competence c
WHERE c.id IN ('arc', 'arbalete', 'arme-legere', 'arme-lourde', 'magie', 'concentration');

INSERT INTO posture_critique (posture_id, bonus, competence_id) VALUES
  ('guide/postures#posture:defensif', 'posture', 'esquive'),
  ('guide/postures#posture:defensif', 'posture', 'parade');
