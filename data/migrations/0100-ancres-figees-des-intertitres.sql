-- 0100-ancres-figees-des-intertitres : pose les ancres figées (lib/ancres-figees.mjs, docs/content-guide.md, « Ancres figées des intertitres ») sur les
-- intertitres que le code ou un lien vise (lot « Défauts du code », points 6 et 7). Migration de DONNÉES seules (la version du schéma monte d'un cran) ;
-- rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   - guide/liste-des-alterations-d-etat : les 20 intertitres « ## <état> » reçoivent ` {#<ancre>}`, l'ancre étant le segment de l'id de l'état après
--     « #etat: » (lib/magies-db.mjs#ancreDeLEtat ; identifiants figés, fautes comprises : `aggripe` pour « Agrippé », `folle-de-guerre` pour « Folie de
--     Guerre », choix tranché du lot).
--   - guide/l-equipement : « ## La ceinture » → ` {#la-ceinture}` ; guide/fiche-accessoires-et-ceinture : « ## Ceinture » → ` {#ceinture}`
--     (lib/ceinture-db.mjs : ANCRE_DES_REGLES, ANCRE_DE_LA_REFERENCE ; l'ancre est le slug que l'intertitre avait déjà : les liens d'avant tiennent).
-- Garde de chaque ligne : seule la LIGNE ENTIÈRE exacte (entre deux sauts de ligne, ou en début ou fin du corps) est complétée, et seulement si elle est
-- présente une fois et que l'ancre n'est pas déjà dans la page. Un intertitre que le site de dev a renommé, ou qui porte déjà une ancre, n'est pas
-- touché ; une migration rejouée ne pose rien deux fois (la ligne complétée n'est plus la ligne exacte). Le corps est bordé d'un saut de ligne de
-- chaque côté le temps du remplacement, puis rendu à sa longueur d'origine plus celle de la marque.

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Aveuglement' || char(10), char(10) || '## Aveuglement {#aveuglement}' || char(10)), 2, length(corps_md) + 15)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#aveuglement}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Aveuglement' || char(10), '')) = length(char(10) || '## Aveuglement' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Brûlure' || char(10), char(10) || '## Brûlure {#brulure}' || char(10)), 2, length(corps_md) + 11)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#brulure}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Brûlure' || char(10), '')) = length(char(10) || '## Brûlure' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Confusion' || char(10), char(10) || '## Confusion {#confusion}' || char(10)), 2, length(corps_md) + 13)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#confusion}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Confusion' || char(10), '')) = length(char(10) || '## Confusion' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Enragé' || char(10), char(10) || '## Enragé {#enrage}' || char(10)), 2, length(corps_md) + 10)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#enrage}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Enragé' || char(10), '')) = length(char(10) || '## Enragé' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Fatigue' || char(10), char(10) || '## Fatigue {#fatigue}' || char(10)), 2, length(corps_md) + 11)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#fatigue}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Fatigue' || char(10), '')) = length(char(10) || '## Fatigue' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Gel' || char(10), char(10) || '## Gel {#gel}' || char(10)), 2, length(corps_md) + 7)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#gel}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Gel' || char(10), '')) = length(char(10) || '## Gel' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Paralysie' || char(10), char(10) || '## Paralysie {#paralysie}' || char(10)), 2, length(corps_md) + 13)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#paralysie}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Paralysie' || char(10), '')) = length(char(10) || '## Paralysie' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Peur' || char(10), char(10) || '## Peur {#peur}' || char(10)), 2, length(corps_md) + 8)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#peur}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Peur' || char(10), '')) = length(char(10) || '## Peur' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Pétrifié' || char(10), char(10) || '## Pétrifié {#petrifie}' || char(10)), 2, length(corps_md) + 12)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#petrifie}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Pétrifié' || char(10), '')) = length(char(10) || '## Pétrifié' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Poison' || char(10), char(10) || '## Poison {#poison}' || char(10)), 2, length(corps_md) + 10)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#poison}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Poison' || char(10), '')) = length(char(10) || '## Poison' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Saignement' || char(10), char(10) || '## Saignement {#saignement}' || char(10)), 2, length(corps_md) + 14)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#saignement}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Saignement' || char(10), '')) = length(char(10) || '## Saignement' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Surcharge Magique' || char(10), char(10) || '## Surcharge Magique {#surcharge-magique}' || char(10)), 2, length(corps_md) + 21)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#surcharge-magique}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Surcharge Magique' || char(10), '')) = length(char(10) || '## Surcharge Magique' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Surdité' || char(10), char(10) || '## Surdité {#surdite}' || char(10)), 2, length(corps_md) + 11)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#surdite}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Surdité' || char(10), '')) = length(char(10) || '## Surdité' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Agrippé' || char(10), char(10) || '## Agrippé {#aggripe}' || char(10)), 2, length(corps_md) + 11)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#aggripe}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Agrippé' || char(10), '')) = length(char(10) || '## Agrippé' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Coma' || char(10), char(10) || '## Coma {#coma}' || char(10)), 2, length(corps_md) + 8)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#coma}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Coma' || char(10), '')) = length(char(10) || '## Coma' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Couardise' || char(10), char(10) || '## Couardise {#couardise}' || char(10)), 2, length(corps_md) + 13)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#couardise}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Couardise' || char(10), '')) = length(char(10) || '## Couardise' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Enchevêtré' || char(10), char(10) || '## Enchevêtré {#enchevetre}' || char(10)), 2, length(corps_md) + 14)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#enchevetre}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Enchevêtré' || char(10), '')) = length(char(10) || '## Enchevêtré' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Étourdi' || char(10), char(10) || '## Étourdi {#etourdi}' || char(10)), 2, length(corps_md) + 11)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#etourdi}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Étourdi' || char(10), '')) = length(char(10) || '## Étourdi' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Folie de Guerre' || char(10), char(10) || '## Folie de Guerre {#folle-de-guerre}' || char(10)), 2, length(corps_md) + 19)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#folle-de-guerre}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Folie de Guerre' || char(10), '')) = length(char(10) || '## Folie de Guerre' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Sans Défense' || char(10), char(10) || '## Sans Défense {#sans-defense}' || char(10)), 2, length(corps_md) + 16)
WHERE id = 'guide/liste-des-alterations-d-etat' AND instr(corps_md, '{#sans-defense}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Sans Défense' || char(10), '')) = length(char(10) || '## Sans Défense' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## La ceinture' || char(10), char(10) || '## La ceinture {#la-ceinture}' || char(10)), 2, length(corps_md) + 15)
WHERE id = 'guide/l-equipement' AND instr(corps_md, '{#la-ceinture}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## La ceinture' || char(10), '')) = length(char(10) || '## La ceinture' || char(10));

UPDATE page SET corps_md = substr(replace(char(10) || corps_md || char(10), char(10) || '## Ceinture' || char(10), char(10) || '## Ceinture {#ceinture}' || char(10)), 2, length(corps_md) + 12)
WHERE id = 'guide/fiche-accessoires-et-ceinture' AND instr(corps_md, '{#ceinture}') = 0
  AND length(char(10) || corps_md || char(10)) - length(replace(char(10) || corps_md || char(10), char(10) || '## Ceinture' || char(10), '')) = length(char(10) || '## Ceinture' || char(10));
