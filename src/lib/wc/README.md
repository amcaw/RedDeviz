# Bracket radial Coupe du Monde 2026 — comment c'est posé et calculé

La viz de la route `/cdm2026` est un arbre à élimination (16es → finale) dessiné
en cercle. Deux fichiers seulement :

- **`bracket.ts`** — récupère les données ESPN et **reconstruit l'arbre** (qui joue qui, dans quel ordre).
- **`WcBracket.svelte`** — **place et dessine** cet arbre en SVG (angles, rayons, drapeaux, lignes, couleurs, scores, animation).

Le flux : `+page.svelte` appelle `fetchBracket()` à chaque chargement → passe le
`Bracket` au composant → le composant calcule toute la géométrie dans un seul
`$derived` (`geometry`) et la rend.

---

## 1. Reconstruire l'arbre (`bracket.ts`)

ESPN expose un tableau plat de matchs, un par « slug » de tour
(`round-of-32`, `round-of-16`…). On en tire l'arbre :

1. **`normaliseRound`** : on filtre les matchs d'un tour et on les **numérote 1..N**
   dans l'ordre de la réponse. Chaque match a un `home`, un `away` (ou `null`
   si l'équipe n'est pas encore connue).
2. **`assignFeeds`** : pour chaque match d'un tour, on trouve **de quels deux
   matchs du tour précédent** viennent ses participants (`feeds: [numA, numB]`).
   - équipe déjà connue → on suit le **vainqueur** (`findIndex` du match qu'elle a gagné) ;
   - sinon → on lit le **numéro du placeholder** ESPN (« Round of 32 **11** Winner »).
   - **Réparation** : les feeds d'un tour doivent former une *permutation* du tour
     précédent (chaque match précédent alimente exactement un match suivant). Si un
     placeholder périmé crée un doublon ou un trou (ça arrive quand une équipe
     vient d'avancer), on corrige par élimination. *(C'est ce qui évitait que
     l'arbre casse quand l'Espagne s'est qualifiée.)*
3. **`leafOrder`** : un parcours *in-order* depuis la finale jusqu'aux feuilles
   (16es) donne **l'ordre angulaire** des 16 matchs de base. Cet ordre garantit
   qu'aucune ligne ne se croise.
4. **`layout`** : on pose les angles (voir §2).

Les demies/finale n'existent pas encore côté ESPN : si absentes, on les
**synthétise** avec des dates codées en dur.

---

## 2. Les angles et les rayons (`WcBracket.svelte`)

Repère : un carré SVG `1000×1000`, centre `C = (500, 500)`.
`pt(r, a) = (C + r·cos a, C + r·sin a)`.

**Rayons** — un anneau par tour, du plus grand (extérieur) au plus petit (centre) :

| | R32 | R16 | QF | SF | F |
|---|---|---|---|---|---|
| `LVL` | 408 | 336 | 264 | 192 | 120 |

Les **drapeaux des 16es** sont encore plus loin, sur `TEAM_R = 480`.

**Angles** :

- **Feuilles (16es)** : réparties régulièrement sur le cercle, dans `leafOrder` :
  `a = −π/2 + (i + 0.5) · (2π / N)`. Le `−π/2` fait **partir du haut**, et l'angle
  croît dans le **sens horaire**.
- **Tours internes** : l'angle d'un match = **milieu circulaire** des angles de
  ses deux feeders (`circularMid`). Un match se place donc pile entre les deux
  qu'il rassemble.

**Les deux participants d'un match** (`participants`) :

- en **16es**, ce sont les deux équipes, écartées de `±TEAM_OFF` autour de
  l'angle du match (les deux drapeaux ne se superposent pas) ;
- aux **tours suivants**, ce sont les **vainqueurs des deux feeders**, chacun
  laissé à l'angle de son feeder.

---

## 3. Le tracé des liens (les « coudes »)

Chaque participant est relié au match suivant par **deux segments** (deux coudes) :

- **`radial(a, r1, r2)`** : un trait droit **le long d'un rayon** (même angle,
  du rayon extérieur vers le rayon du tour) ;
- **`arc(r, a1, a2)`** : un **arc tangentiel** sur l'anneau du tour, de l'angle du
  participant jusqu'à l'angle du match (robuste au passage par le haut).

Le drapeau se pose au **coin** entre les deux. La branche du **vainqueur** est
tracée dans **sa couleur** ; le reste reste en gris.

---

## 4. Les couleurs (`colorAssign`)

Objectif : chaque pays a **une couleur lisible**, et **deux adversaires n'ont
jamais la même**.

- Candidats par équipe : couleur ESPN, override `FLAG_CANDS` (couleurs de drapeau
  curées, ex. Maroc vert), couleur alternative — on garde la **première lisible**
  selon le thème (clair/sombre). `fix()` éclaircit/assombrit si besoin.
- `FLAG_FORCE` impose une couleur en priorité absolue (ex. **Espagne = jaune**).
- Si deux adversaires sont trop proches, on décale la teinte de l'un
  (seuil `THRESH`).

Tout est recalculé quand le thème clair/sombre change.

---

## 5. Scores et tirs au but

Au **point de fusion** d'un match joué, on affiche le score combiné `A-B`.
L'ordre des deux chiffres suit **l'axe de séparation dominant** des deux
drapeaux :

- séparés surtout **horizontalement** (haut/bas du cercle) → lecture **gauche→droite** ;
- séparés surtout **verticalement** (flancs) → lecture **haut→bas**.

Ainsi chaque chiffre tombe en face de son drapeau. En cas d'égalité, les tirs au
but s'affichent dessous au format **`3–2 t.a.b.`**.

---

## 6. Animation d'apparition

Une valeur `reveal` va de 0 à 1 en ~4,2 s (courbe *smootherstep*). Chaque élément
a un `delay` : les **drapeaux apparaissent** d'abord, puis les **lignes se
dessinent** (via `stroke-dashoffset`), tour après tour et balayées dans le sens
horaire (`sweep`). Respecte `prefers-reduced-motion`.

---

## 7. Live, vidéos, auto-update

- **Scores** : `fetchBracket()` tape l'API ESPN **à chaque chargement** → toujours à jour, sans build.
- **Vidéos** : les résumés RTBF (`wc-videos.json`, clés = paire d'équipes triée)
  posent un badge ▶ sur le score → embed YouTube léger. Ils sont importés au
  build, donc ajoutés par une **GitHub Action quotidienne** (`refresh-data.yml`).
- **Déploiement** : l'étape Pages est retentée jusqu'à 3× (les publications Pages
  échouent parfois de façon transitoire).
