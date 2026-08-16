# Hockey WC 2026 (`/hockey2026`) — état du module

Tout est en local, **rien n'est commité**. `npx svelte-check --threshold error --tsconfig ./tsconfig.json` = 0 erreur.
Fichiers du module : `scripts/fetch-hockey.mjs`, `src/data/hockey.json`, `src/lib/hockey/data.ts`,
`src/lib/HockeyFunnel.svelte`, `HockeyMatch.svelte`, `HockeyTeam.svelte`,
`HockeyVideo.svelte`, `scripts/fetch-hockey-videos.mjs`, `src/data/hockey-videos.json`,
`src/routes/hockey2026/+page.svelte`, `static/hockey-logo.png`, `.github/workflows/refresh-hockey.yml`.

Le module a été rendu et contrôlé avec Chromium en desktop et mobile. Le build statique avec
`BASE_PATH=/RedDeviz` passe. Les changements TDF présents dans le dépôt sont indépendants et n'ont pas été touchés.

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
- [x] Scraper FIH étendu de 24 à **50 matchs par tournoi**, phases après poules incluses.
- [x] Adversaires encore inconnus traduits (`1er de la poule A`, `Vainqueur du match 47`, etc.).
- [x] Dates et heures de Bruxelles affichées sur chaque match joué ou à venir.
- [x] Libellés de phase : poule, super-poule, classement, demi-finale, petite finale et finale.
- [x] Workflow automatique étendu aux données et vidéos hockey.
- [ ] Commit hockey, uniquement sur instruction explicite.

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

## 3. Highlight au survol (à vérifier)
Au survol d'un cercle relié par une corde → la corde + les deux nœuds connectés doivent passer **en gras/accent** (state `hoverCode` + `linkedCodes` dans `HockeyFunnel.svelte`, classes `.chord.strong` et `.team.hi`). Vérifier que ça marche visuellement.

## 4. Logo carton dans les dropdowns (à vérifier)
La valeur data des cartons est `"G"/"Y"/"R"` (pas "green") → désormais mappée par `cardClass()` dans `data.ts`.
Tester une équipe avec carton : men **GER 5-1 MAS**, **ENG 4-1 PAK**, **BEL 3-2 FRA** (ouvrir le drawer équipe → déplier le match → le carré coloré du carton doit s'afficher).

## 5. Abréviations FR + répartition de la deuxième phase (à vérifier)
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
- **Un seul niveau d'interaction** : pas de tooltip-popup, pas de drawer imbriqué. Drawer coulissant droite ; drawer équipe = dropdowns à chevron dépliables inline.
- Noms de pays **en français partout** ; abréviations FR sur les nœuds.
- Cordes **solides continues** (jamais de pointillé animé).
- Calendrier **2×2**, drapeaux ronds, **bordure fine** pour aujourd'hui (pas de gros border-left = "IA slop").
- Animation d'apparition au load (façon cdm2026) + `prefers-reduced-motion`.
- Accent rouge `--hk-accent: #e2231a`. Sélecteur « Hommes » / « Femmes » seulement.
- **Aucun commentaire dans le code.** Svelte 5 runes, SvelteKit static SPA, base path `/RedDeviz`.
- Commit : **uniquement sur instruction**, email `42608053+amcaw@users.noreply.github.com`, **pas** de co-author Claude, **pas** de CLI `gh`.
