# Felles merke- og bildebibliotek

`data/badges.json` er autoritativt for ID, navn, terskel, farger, aktiv bildefil og kildebundet trykkgodkjenning. `js/badges.js` laster og validerer registeret. Profiler, skrytekort og diplomer bruker samme aktive filer; hederssiden henter sine merker fra samme register. Adelskalender og milepæler bruker de samme navnene og tersklene.

## Filer og godkjenning

- `assets/medals/approved/`: godkjente 5–50-merker og rekordmerket.
- `assets/medals/watermarks/morothon-runner-approved.png`: brukerens godkjente grove løperlogo. Ingen ny glatting.
- `assets/medals/service/`: felles dugnads-/grunnleggerbilder og SVG-kilder. V3.5 har ni aktive typer: seks dugnadsnivåer, Grunnlegger, Morothons æresmerke og For alltid en del av Morothon. Hedersildsjel og det gamle generelle Dugnadshelt-merket er utgått fra aktiv bruk; filene beholdes for historisk kompatibilitet. Grunnleggerens kryssende strek ved 1992 er fjernet fra vektorkilden, og PNG-en er rendret i 2400 × 2400.
- `assets/medals/originals/` og `source-inventory.json`: originale, offentlige motivkilder og proveniens. Disse er bevaringsgrunnlag, ikke alternative aktive merker.
- `assets/medals/review/cutouts/`: permanente maskebeskrivelser, RGB-verifiserte kopier av de godkjente frileggingene og native kvalitetsmålinger. Genererte alfakontrollbilder er ikke versjonert.

Ingen avviste AI-medaljer eller løperutkast er inkludert. Tidligere lokale mapper med dupliserte bilder følger ikke utgivelsesgrenen. Kildearkiver og gjennomgangsmateriale inngår ikke i Pages-pakken.

## Faktisk kvalitet

Ved 55 mm synlig motiv gir 5–30 cirka 168–189 DPI, rekordmerket cirka 298 DPI og 35–50 cirka 323 DPI. Brukeren har godkjent de konkrete filene med dokumenterte avvik. Minimumsmålet er fortsatt 300 DPI; godkjente avvik er bundet til filens SHA-256 og gir informasjon fremfor utskriftssperre. Nye filbytes arver ikke godkjenningen. Ingen oppløsning er oppfunnet ved oppskalering.

Diplommalens bildefelt er 55 mm, mens transparent luft i kilden kan gjøre selve motivet mindre. Dette gir høyere faktisk DPI enn 55 mm-testarket. Se [trykkgodkjenningen](print-approval.md) og [motivmålingene](medal-cutout-review.md). Eldre kontrollrapporter beskriver tilstanden før brukerens godkjenning.

## Kontroll og publiseringspakke

`npm test` kontrollerer blant annet native RGB-bevaring, originalhash, aktiv filidentitet, godkjenningssperrer, statisk A4 og profiler. `npm run build` bygger `_site/` fra en eksplisitt liste over runtime-filer. Ingen tester, skript, originalarkiver eller gjennomgangssider legges i Pages-artifakten.

For lokale bilder/PDF-er:

```sh
node scripts/review-diplomas.cjs /tmp/morothon-diplomas
node scripts/review-medal-cutouts.cjs /tmp/morothon-medals
node scripts/review-release.cjs /tmp/morothon-review
node scripts/review-approved-medals.cjs /tmp/morothon-approved-medals
```

`review-approved-medals.cjs` viser dagens aktive filer, kildebundet brukergodkjenning og faktisk DPI i ett frittstående lys/mørk-galleri og ett A4-ark. Den eldre `review-medal-cutouts.cjs` gjenskaper maskekontrollen før brukergodkjenningen; dens utkaststatus er historisk og erstatter ikke dagens register.

Verktøyene bruker den eksisterende kilden; de pusher eller publiserer ikke noe. Workflowen tester også arbeidsgrener og PR-er. Bare verifisert main kan deployes; arbeidsgrener publiseres ikke. Se [utgivelseskontrollen](release-quality.md).
