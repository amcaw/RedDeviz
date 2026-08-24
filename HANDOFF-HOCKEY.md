# Hockey WC 2026 (`/hockey2026`) — handoff Codex

Dernière actualisation du handoff : **16 août 2026**.

Le socle hockey et toutes les améliorations interactives sont dans `main` (`62053b5`, `3869995`, puis `6d32e5e`). Seule la création de la vidéo sociale décrite ci-dessous est encore **locale et non committée**. Ne pas l'écraser et ne faire ni commit ni push sans instruction explicite.

État Git local au moment du handoff :

- `M HANDOFF-HOCKEY.md`
- `?? scripts/capture-hockey-social.mjs`
- `?? exports/`

Fichiers du module : `scripts/fetch-hockey.mjs`, `src/data/hockey.json`, `src/lib/hockey/data.ts`,
`src/lib/HockeyFunnel.svelte`, `HockeyMatch.svelte`, `HockeyTeam.svelte`,
`HockeyVideo.svelte`, `scripts/fetch-hockey-videos.mjs`, `src/data/hockey-videos.json`,
`src/routes/hockey2026/+page.svelte`, `static/hockey-logo.png`, `.github/workflows/refresh-hockey.yml`,
`scripts/capture-hockey-social.mjs` et les exports sociaux dans `exports/`.

Dernières vérifications :

- `npx svelte-check --threshold error --tsconfig ./tsconfig.json` : **0 erreur**, 3 warnings préexistants et sans rapport dans `CartoChronologie.svelte`.
- `npm run build` : **OK** avec l'adapter statique.
- `git diff --check` : **OK**.
- Contrôles Chromium : desktop, mobile 390 px et 320 px, changements de genre/jour, drawer, focus clavier et simulation des futures éliminations.
- Aucun serveur de développement n'est laissé actif.

Les changements TDF présents dans le dépôt sont indépendants et n'ont pas été touchés pendant cette reprise.

---

## Reprise rapide : fonctionnement des derniers changements

### Crossfade Hommes/Femmes

- `+page.svelte` conserve temporairement `previousGender`, passe immédiatement sur le nouveau genre et garde les deux jeux de nations pendant **240 ms**.
- `HockeyFunnel.svelte` superpose les anciens et nouveaux calques de nations ; le SVG, les anneaux, les arcs décoratifs et les libellés ne sont pas remontés.
- Le calendrier superpose de la même façon les anciens et nouveaux blocs équipes/drapeaux/scores. L'ancien match est apparié au nouveau par **jour + index dans la journée** ; vérifier ce point si la FIH publie un jour un nombre ou un ordre de matchs différent entre les deux tournois.
- `prefers-reduced-motion` contourne le crossfade et applique le changement immédiatement.

### Crossfade des liaisons au changement de jour

- `HockeyFunnel.svelte` garde `previousDay` et superpose deux groupes `.line-layer` pendant **240 ms**.
- Les anciennes cordes ne sont plus interactives pendant leur disparition ; les nouvelles le sont immédiatement.
- Les pays, les anneaux et les arcs de poule restent fixes. Le même élément `<svg>` reste connecté.
- Une nouvelle navigation est ignorée pendant les 240 ms de transition pour éviter d'empiler plusieurs anciens états.

### Drawer adaptatif

- Desktop : panneau latéral droit historique, largeur `min(430px, 92vw)`.
- Mobile (`≤ 560px`) : bottom sheet pleine largeur, hauteur stable `min(84dvh, 760px)` avec un plafond à `90dvh`, coins supérieurs arrondis et arrivée depuis le bas.
- La hauteur stable empêche le bord supérieur de sauter quand un match est déplié dans le drawer équipe.
- Poignée et bouton de fermeture restent fixes ; seul le contenu interne défile.
- Le scroll de la page arrière est verrouillé, le focus est piégé dans le dialogue puis restauré sur le match ou le pays qui l'a ouvert.
- Le rôle `dialog` est porté par le conteneur de `+page.svelte`. Le rôle redondant a été retiré de la racine de `HockeyMatch.svelte`.

### Nations sorties de la course au titre

- Ne jamais employer visuellement « éliminée du tournoi » : les équipes poursuivent des matchs de classement.
- `outOfTitle()` ne s'appuie pas sur la date. Il attend qu'une phase soit réellement terminée (`phaseFinished()`), puis atténue automatiquement les équipes classées 3es/4es des poules A–F, les perdants des demi-finales et le finaliste battu.
- Une nation hors course au titre reste présente et cliquable : opacité `0.38`, saturation `0.15`, remontée à `0.62` au survol/focus.
- Les quatre graines des demi-finales sont remplacées automatiquement par les drapeaux dès que les matchs `SF` contiennent de vrais codes équipes. Après une demi-finale jouée, seul le perdant est atténué.
- La finale accepte les phases `1/2`, `Final` et `F1`. Le champion apparaît au centre ; le finaliste battu reste visible mais atténué.
- L'accordéon explique explicitement qu'une nation atténuée poursuit son tournoi dans les matchs de classement.
- Avec les données actuelles, aucune poule n'est encore terminée : aucun pays n'est donc atténué en production. Le rendu futur a été testé en mutant uniquement la copie en mémoire dans Chromium : France/Malaisie sorties de la poule B et Inde battue en demi-finale ; les fichiers de données n'ont pas été modifiés.

### Calendrier mobile et appel vers le calendrier

- Sous 560 px, le calendrier passe sur une colonne et autorise le retour à la ligne des noms, graines et phases : aucun texte n'est tronqué à 320/390 px.
- Le bouton « Voir le calendrier » est fixe en bas du viewport en mode standalone, disparaît en descendant et revient en remontant.
- Dans un iframe, le bouton reste dans le flux avec une zone réservée sous la visualisation afin de ne pas provoquer de hauteur Pym démesurée ni de recouvrement.
- Cette zone ne doit pas réduire la visualisation : `.stage` conserve `width: 100%` et la réserve fait 58 px.

---

## ✅ Réalisé
- [x] Rendu hommes/femmes, desktop/mobile et contrôle des interactions.
- [x] Quatre arcs généraux rouges de poule rétablis.
- [x] Arcs de matchs remis dans leur tracé extérieur d'origine (`R.chord = 308`).
- [x] Highlight au survol : corde et deux équipes reliées en accent/gras.
- [x] Cartons verts, jaunes et rouges normalisés via `cardClass()`.
- [x] Abréviations FR et répartition des réservations de super-poule.
- [x] Résumés de la chaîne officielle FIH Hockey dans le calendrier et les drawers match/équipe, avec modale vidéo.
- [x] Libellé des buts sur PC normalisé en `penalty-corner` partout.
- [x] Ouverture des matchs du calendrier et des cordes de la visualisation unifiée via le même composant `HockeyMatch` et le même gestionnaire `openMatch()`.
- [x] Zone cliquable invisible des cordes élargie à 18 px, avec activation clavier, sans modifier leur trait visible.
- [x] Sélecteur Hommes/Femmes et navigation quotidienne alignés sur toute la largeur de la visualisation.
- [x] Accordéon « Comment lire cette visualisation ? » sous l'entonnoir avec le format complet E/F, G/H, résultat conservé, demi-finales et classements.
- [x] Parcours E/F et G/H expliqué uniquement dans l'accordéon ; les deux cadres récapitulatifs sous l'anneau ont été retirés pour alléger la visualisation.
- [x] Demi-finales représentées par quatre cercles, soit deux équipes par match : 1er E–2e F et 1er F–2e E.
- [x] Chaque demi-finale montre ses deux équipes, puis un cercle de vainqueur aligné vers la finale ; les drapeaux apparaîtront automatiquement une fois les finalistes connus.
- [x] Note sous le calendrier indiquant que les matchs joués sont cliquables/tactiles pour afficher leur détail.
- [x] Note équivalente dans le drawer équipe, juste au-dessus des matchs déroulables.
- [x] Chiffres de match ajoutés dans les drawers match et équipe : score par quart-temps, types de buts, cartons et statistiques avancées FIH uniquement lorsqu'elles sont renseignées et cohérentes.
- [x] Noms de pays francisés dans toute l'interface, y compris les cartons et les titres de vidéos.
- [x] Bouton flottant « Voir le calendrier » en bas du viewport, masqué en descendant, réaffiché en remontant et avec une zone réservée entre la visualisation et les matchs pour éviter tout recouvrement.
- [x] Calendrier mobile repensé sur une colonne : noms d'équipes, graines et phases peuvent revenir sur plusieurs lignes sans troncature.
- [x] Crossfade Hommes/Femmes limité aux groupes drapeau, nation et score/points dans l'anneau et le calendrier : l'ancien contenu disparaît pendant que le nouveau apparaît. La structure, les arcs et les libellés restent visibles et les composants ne sont pas remontés.
- [x] Crossfade des liaisons au changement de jour : les traits de l'ancienne date disparaissent pendant que ceux de la nouvelle date apparaissent, sans redessiner l'anneau ni les pays.
- [x] États futurs de qualification prévus : une nation sortie de la course au titre reste visible mais est automatiquement désaturée et atténuée après la fin de sa poule, de sa demi-finale ou de la finale. Les quatre drapeaux réels remplaceront automatiquement les graines dans les demi-finales.
- [x] Drawer adaptatif : panneau latéral sur desktop, bottom sheet pleine largeur et de hauteur stable sur mobile avec poignée, fermeture fixe, défilement interne, verrouillage de l'arrière-plan et gestion du focus. La feuille ne saute pas lorsqu'un détail de match est déplié.
- [x] Scraper FIH étendu de 24 à **50 matchs par tournoi**, phases après poules incluses.
- [x] Adversaires encore inconnus traduits (`1er de la poule A`, `Vainqueur du match 47`, etc.).
- [x] Dates et heures de Bruxelles affichées sur chaque match joué ou à venir.
- [x] Libellés de phase : poule, super-poule, classement, demi-finale, petite finale et finale.
- [x] Workflow automatique étendu aux données et vidéos hockey.
- [x] Vidéo sociale carrée 1080×1080 de 50,76 s avec légendes intégrées, démonstrations desktop/mobile et piste AAC silencieuse pour l'autoplay : `exports/hockey2026-social-square.mp4`. Source WebM et couverture JPG fournies ; capture reproductible via `node scripts/capture-hockey-social.mjs` avec le serveur Vite actif.
- [x] Améliorations de l'interface hockey committées et poussées dans `6d32e5e`.
- [ ] Vidéo sociale, couverture, source WebM, script de capture et présent handoff encore non committés.

---

## 1. ⭐ Résumés vidéo depuis FIH Hockey — terminé
Source unique : https://www.youtube.com/@fihockey/videos (chaîne officielle de la FIH).
Calquer **exactement** sur le système vidéo du foot déjà en place :
- Scraper de référence : `scripts/fetch-wc-videos.mjs` (scrape `ytInitialData` + RSS, cookie consent, retry, `parseTeams` sur le titre).
- UI de référence : `src/lib/WcVideo.svelte` + usage dans `src/routes/cdm2026/+page.svelte` (bouton play + modale).

Implémentation :
1. `scripts/fetch-hockey-videos.mjs` : scrape la chaîne, filtre les résumés du Mondial hockey 2026, matche `titre → match` par noms d'équipes (**titres en anglais**, ex. "Netherlands v New Zealand"). Sortie : dict `"CODE1|CODE2"(triés) → {id, title}` (nouveau `src/data/hockey-videos.json`, ou `videoId` attaché à chaque match joué dans `hockey.json`).
   - Noms EN→code : réutiliser `enName()` / la liste des 20 équipes de `data.ts`. Dico minimal (nations présentes seulement).
2. UI : bouton play direct dans le calendrier, dans le drawer match (`HockeyMatch.svelte`) et dans le détail déplié du drawer équipe (`HockeyTeam.svelte`) quand un `videoId` existe ; les trois accès ouvrent `HockeyVideo.svelte` en modale.
3. Brancher le refresh dans `.github/workflows/refresh-hockey.yml` (ou workflow séparé).
- ⚠️ Scraping YouTube fragile (RSS plafonné à 15, 404 fréquents, fallback `ytInitialData` + cookie `CONSENT`) — voir galères déjà résolues dans `fetch-wc-videos.mjs`.
- ⚠️ Beaucoup de matchs n'auront pas de vidéo → le bouton n'apparaît que si `videoId` présent (comportement voulu).

État vérifié le 16 août : la FIH propose les huit résumés de la première journée. Le scraper accepte les deux variantes de titre utilisées par la chaîne (`FIH Hockey Men's…` et `FIH Men's Hockey…`), conserve les vidéos déjà collectées lorsque le flux RSS tourne et refuse toute entrée provenant d'une autre source.

## 2. Arcs — état retenu après validation utilisateur
Les quatre arcs décoratifs rouges des poules sont présents à `R.arc = 326`.
Les cordes de matchs utilisent de nouveau le tracé extérieur historique à `R.chord = 308`, avec départ au bord extérieur des nœuds et `stroke-linejoin: round`.
Cette version remplace la tentative de déplacement des cordes vers l'intérieur de l'anneau.

## 3. Highlight au survol — test de régression
Au survol d'un cercle relié par une corde → la corde + les deux nœuds connectés passent **en gras/accent** (state `hoverCode` + `linkedCodes` dans `HockeyFunnel.svelte`, classes `.chord.strong` et `.team.hi`). À recontrôler après toute refonte des groupes SVG ou des `.line-layer`.

## 4. Cartons dans les dropdowns — test de régression
La valeur data des cartons est `"G"/"Y"/"R"` (pas "green") → désormais mappée par `cardClass()` dans `data.ts`.
Tester une équipe avec carton : men **GER 5-1 MAS**, **ENG 4-1 PAK**, **BEL 3-2 FRA** (ouvrir le drawer équipe → déplier le match → le carré coloré du carton doit s'afficher).

## 5. Abréviations FR + répartition de la deuxième phase
- Nœuds de l'entonnoir en **abréviations FR** (ALL, P-B, ANG, AFS, ECO, GAL, JAP, MAL…) via `abbr()`.
- Cercles réservés des poules E/F mieux **répartis sur l'arc** (offsets élargis `s*16` / `s*48`).

## 6. Calendrier complet
`fetch-hockey.mjs` parse les 50 panneaux de matchs de chaque compétition, y compris les affiches dont les équipes sont encore exprimées sous forme de graines.
Le calendrier va jusqu'au 30 août chez les hommes et au 29 août chez les femmes. Chaque carte affiche la date, l'heure de Bruxelles et la phase. Les drawers acceptent aussi les affiches à équipes encore indéterminées.

## 7. Statistiques exploitées et disponibles
La visualisation utilise les classements de poule (rang, matchs, victoires, nuls, défaites, différence de buts et points), le score final et les éventuels shoot-outs, les buts avec leur minute, leur auteur, le score courant et leur type, ainsi que les cartons, le lieu, le statut et les résumés vidéo officiels disponibles. Les drawers match et équipe affichent aussi le score par quart-temps, les buts dans le jeu, les buts sur penalty-corner et le nombre de cartons.

Le flux public FIH fournit aussi possession, tirs, entrées dans le cercle et penalty-corner obtenus. Le scraper les conserve uniquement lorsque les valeurs sont renseignées et cohérentes ; les zéros techniques ne sont pas affichés. Restent volontairement hors interface : seconde exacte des événements, durée et points de pénalité des cartons, compositions et temps de jeu, numéros et rôles des joueurs, officiels, face-à-face et éventuelles récompenses du match.

---

## Repères techniques
- Données : **scraping HTML `tms.fih.ch`** (API AltiusRT = 401 sans clé, inutilisable). Compétitions **1866 = H**, **1867 = F**.
  - `/competitions/{id}` = classements (tabs `#poolXXXX`) · `/competitions/{id}/matches` = matchs (`matches/{id}`, score, poule, `UTC:` pour les à venir) · `/matches/{id}` = détail (blob JSON date/lieu/statut + tables `#goals`/`#cards`, fetché seulement pour les matchs joués) · `/rt/matches/{id}?embeds=hometeam,awayteam,statistics` = statistiques par quart-temps et statistiques avancées.
- Drapeaux ronds : `hockey-cdn.altius.live/resources/flags/round/{CODE}.png` (`flagUrl()`).
- Format : poules A-D → deuxième phase avec **E=top2 de A+D**, **F=top2 de B+C**, **G=bottom2 de A+D** et **H=bottom2 de B+C**. Dans chaque nouvelle poule, chaque équipe joue deux nouveaux adversaires et conserve son résultat contre l'autre équipe issue de sa poule initiale. Les deux premiers de E/F vont en demies (pas de quart), les 3es/4es jouent les places 5–8 et G/H déterminent les places 9–16. Finale féminine le 29 août, masculine le 30.
- Dates en timezone **Europe/Brussels** (`todayKey()`).
- Rafraîchir : `node scripts/fetch-hockey.mjs`. Type-check : `npx svelte-check --threshold error --tsconfig ./tsconfig.json`.

## Contraintes à respecter
- **Un seul niveau d'interaction** : pas de tooltip-popup, pas de drawer imbriqué. Drawer latéral sur desktop, bottom sheet sur mobile ; drawer équipe = dropdowns à chevron dépliables inline.
- Sur mobile, le drawer est une bottom sheet stable ; ne pas revenir à un panneau latéral laissant une bande étroite de page visible.
- Noms de pays **en français partout** ; abréviations FR sur les nœuds.
- Employer partout l'expression exacte **`penalty-corner`**.
- Vidéos : utiliser uniquement la chaîne officielle **FIH Hockey** (`https://www.youtube.com/@fihockey/videos`) comme source de confiance.
- Cordes **solides continues** (jamais de pointillé animé).
- Calendrier **2×2 sur desktop, une colonne sur mobile**, drapeaux ronds, **bordure fine** pour aujourd'hui (pas de gros border-left = "IA slop").
- Animation d'apparition au load (façon cdm2026), crossfades ciblés + `prefers-reduced-motion`. Ne pas faire disparaître ou remonter tout le SVG au changement de genre/jour.
- Accent rouge `--hk-accent: #e2231a`. Sélecteur « Hommes » / « Femmes » seulement.
- **Aucun commentaire dans le code.** Svelte 5 runes, SvelteKit static SPA, base path `/RedDeviz`.
- Commit : **uniquement sur instruction**, email `42608053+amcaw@users.noreply.github.com`, **pas** de co-author Claude, **pas** de CLI `gh`.

## Checklist pour la prochaine reprise

1. Commencer par `git status --short` et préserver les fichiers sociaux non committés listés en tête.
2. Après un refresh FIH, vérifier que les nouvelles poules E/F apparaissent dans `src/data/hockey.json` avec `rank`, `gp` et les codes équipes réels.
3. Dès les premières qualifications, contrôler visuellement que les 3es/4es de A–D s'atténuent sans disparaître et que les qualifiés se placent dans E/F.
4. Dès que les affiches `SF` sont résolues, vérifier les quatre drapeaux de demi-finale, puis le gagnant/perdant après le score officiel.
5. Vérifier le crossfade calendrier si hommes et femmes n'ont plus exactement le même nombre de matchs dans une journée ; l'appariement actuel utilise l'index du match dans le jour.
6. Relancer `npx svelte-check --threshold error --tsconfig ./tsconfig.json`, `npm run build` et `git diff --check`.
7. Ne commit/push que sur ordre explicite de l'utilisateur.
