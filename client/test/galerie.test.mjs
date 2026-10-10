// Galerie (lib/galerie.mjs) : les images qui défilent sur l'accueil et qu'affiche /galeries/ (demande du propriétaire). En construction : le logo seul.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GALERIE, ancreDImage, galerieEnConstruction, imageVoisine } from '../src/lib/galerie.mjs';

const publicDir = new URL('../public/', import.meta.url);

test('chaque image de la galerie existe dans public/, avec un titre, un texte de remplacement et ses dimensions', () => {
  assert.ok(GALERIE.length > 0);
  for (const image of GALERIE) {
    assert.ok(existsSync(new URL(image.fichier, publicDir)), `fichier absent : public/${image.fichier}`);
    assert.ok(image.titre.trim() && image.alt.trim(), image.fichier);
    assert.ok(Number.isInteger(image.largeur) && image.largeur > 0 && Number.isInteger(image.hauteur) && image.hauteur > 0, image.fichier);
  }
});

test('dimensions déclarées = dimensions du fichier (WebP), pour réserver la place de l’image', () => {
  for (const image of GALERIE.filter((i) => i.fichier.endsWith('.webp'))) {
    const octets = readFileSync(new URL(image.fichier, publicDir));
    assert.equal(octets.toString('ascii', 12, 16), 'VP8X', `${image.fichier} : en-tête WebP étendu attendu`);
    const largeur = 1 + octets.readUIntLE(24, 3);
    const hauteur = 1 + octets.readUIntLE(27, 3);
    assert.deepEqual([image.largeur, image.hauteur], [largeur, hauteur], image.fichier);
  }
});

test('ancres des images : uniques et lisibles', () => {
  assert.equal(ancreDImage({ fichier: 'logo.webp' }), 'image-logo');
  assert.equal(ancreDImage({ fichier: 'galerie/Elfes au combat.JPG' }), 'image-elfes-au-combat');
  const ancres = GALERIE.map(ancreDImage);
  assert.equal(new Set(ancres).size, ancres.length);
});

test('« en construction » tant que la galerie n’a que le logo', () => {
  assert.equal(galerieEnConstruction([{ fichier: 'logo.webp' }]), true);
  assert.equal(galerieEnConstruction([{ fichier: 'logo.webp' }, { fichier: 'galerie/carte.webp' }]), false);
});

test('défilement en boucle : après la dernière image, la première ; avant la première, la dernière', () => {
  assert.equal(imageVoisine(0, 1, 3), 1);
  assert.equal(imageVoisine(2, 1, 3), 0);
  assert.equal(imageVoisine(0, -1, 3), 2);
  assert.equal(imageVoisine(0, 1, 1), 0);
  assert.equal(imageVoisine(0, 1, 0), 0);
});
