# Morothon Historikk

Adelskalender, resultatarkiv, skrytekort og diplomer for Søgne Morothon.
Offentlig adresse: https://morothon-no.github.io/historikk/.

## Lokal utvikling

Nettsiden kan kjøres direkte fra kildefilene:

```sh
python3 -m http.server 8000
```

Åpne `http://localhost:8000`. Lokal utvikling krever ikke en publiseringsbygging.
Hederssiden er fortsatt en skjult forhåndsvisning på `heder.html`, med
`noindex, nofollow` og uten lenker fra offentlig navigasjon.

## Installer og test

Bruk Node.js 24 (minimum 20), Python 3.12 med Pillow, Chromium og Poppler.
På Ubuntu trenger testene også Liberation- og URW Base35-fontene.

```sh
npm ci
python -m pip install -r requirements-dev.txt
sudo apt-get install poppler-utils fonts-liberation fonts-urw-base35
npx playwright install --with-deps chromium
export CHROMIUM_PATH="$(node -e 'process.stdout.write(require("playwright").chromium.executablePath())')"
npm test
```

Alternativt kan `CHROMIUM_PATH` peke på installert Chromium, f.eks.
`/usr/bin/chromium`. Testene starter egne lokale servere. Poppler-verktøyene
`pdfinfo`, `pdftotext` og `pdfimages` og Python med Pillow må finnes på PATH.
Noen tester kontrollerer historiske originalfiler i Git; bruk en checkout med
full historikk. Hvis npm-cachen ikke er skrivbar, angi en egen mappe med
`npm ci --cache /tmp/morothon-npm-cache`.

## Bygging, cache og trygg publisering

```sh
npm run build
```

Dette lager `_site/` fra en eksplisitt liste over runtime-filer. Utmappen må være
tom; fjern tidligere generert `_site/` før et nytt lokalt bygg, eller bruk
`node scripts/build-site.cjs /tmp/morothon-site` med en ny mappe.

Bygget eksporterer nå eksplisitte offentlige datafelt fremfor å kopiere hele
administrasjonsregistrene. Kontroller en eksisterende byggepakke før opplasting:

```sh
npm run public:kontroll -- _site
```

Publiser bare den validerte byggepakken, aldri repositoryroten. Originalregistrene
ligger fortsatt i dette repositoryet og Git-historikken; filtrert Pages-eksport
gjør dem ikke private. Se [A1: datafelt, eksponering og migreringsplan](docs/a1-offentlig-dataeksport.md).

Videre privat lagring og skillet mellom privat eksport og offentlig bygg er
beskrevet i [A1B-planen](docs/a1b-privat-migreringsplan.md), med en egen
[beslutningsliste for publisering](docs/a1b-publiseringsbeslutninger.md).
Dette er en plan; ingen originaldata er flyttet eller historikk omskrevet.
Tester, vedlegg, kildearkiver og gjennomgangsbilder publiseres ikke.

Byggeren beregner én deterministisk innholdshash for hele utgaven. Alle lokale
CSS-/JS-URL-er i begge sider og diplomets isolerte iframe får `?v=<hash>`.
`morothon-version` og `build-info.json` viser samme versjon. Det finnes ingen
manuell versjonsstreng som må oppdateres. `homepage` i `package.json` er kilden
for absolutte delings-/canonical-URL-er i bygget.

Den eneste workflowen er `.github/workflows/pages.yml`. Push til `codex/**`,
pull requests mot `main` og oppdateringer av `main` kjører installasjon,
alle regresjonstester og bygg. Bare grønn verifisering på `main` kan sende det
**samme testede artifaktet** til GitHub Pages. PR-er og arbeidsgrener deployes
ikke. En merge til `main` kan dermed publisere etter kontrollen; ikke merge uten
arrangørens uttrykkelige godkjenning.

Se [utgivelseskontrollen](docs/release-quality.md) for kildeklargjøring,
cache-testing, visuell gjennomgang og senere publisering.

## Historikk og identitet

`data/history.json` er eneste datagrunnlag for individuelle resultater.
`teamResults` inneholder stafettlag separat. DNS teller ikke; DNF teller.
Hvert deltakelsesår teller én gang per kanonisk person-ID. Godkjente
ID-omdirigeringer samler eldre ID-er; navnelikhet gir ingen automatisk
sammenslåing. Interne historiske kategorier beholdes; `Morothon` vises som
**Langmoro**.

Løyperekorder beregnes fra fullførte individuelle resultater fra og med 2014,
med eksakt konkurranse, kjønn og distanse. Forside, profiler, merker og
skrytekort bruker samme rekordliste. Årets milepæler beregnes fra unike år og
alle merketerskler 5–50. Stafettlag påvirker ikke individuell statistikk.

Tidligere navnesammenslåinger, Enny-Karin Vindheims dokumenterte 1999-resultat
og Jon Grindlands korrigerte kjønn/klasse/plassering er bevart. Se
[resultatkorrigeringene](docs/result-corrections.md). Arrangøren har bekreftet
128 deltakere i 1992, søndag 11. november 2018 og stavemåten
«Inger Katherin Dahl Frantzen». De første V3.2-korrigeringene videreføres.

## Diplomer, merker og deling

`data/badges.json` kobler terskler, titler, farger og godkjente bildefiler for
profiler, skrytekort og diplomer. Skrytekort bruker 1080 × 1350 som hovedformat,
med 1080 × 1080 som alternativ. Historiske merkediplomer viser opptjeningstidspunktet,
ikke dagens samlede statistikk. Datoer hentes fra `data/event-dates.json`;
ukjente datoer erstattes med årstall.

De konkrete trykkfilene er godkjent med SHA-256-bundne unntak. 5–30 gir omtrent
168–189 DPI ved 55 mm synlig motiv; godkjenningen gjør dem ikke til 300 DPI.
Diplomdialogen viser kort status og lar brukeren åpne **Vis bildekvalitet**.
Endret kilde, manglende godkjenning eller faktisk layoutfeil sperrer fortsatt
utskrift. **Lagre som PDF** åpner nettleserens utskriftsdialog.

Se [diplomer](docs/diplomas.md), [merkeregister](docs/badges.md) og
[gjeldende trykkgodkjenning](docs/print-approval.md). De eldre
[kildekontrollene](docs/medal-quality.md) og [frileggingsrapportene](docs/medal-cutout-review.md)
er historiske rapporter før senere godkjenning; de erstatter ikke dagens register.
Ingen godkjente medaljemotiver er omtegnet eller oppskalert.

Open Graph-bildet og favicon-filene ligger i `assets/social/` og `assets/icons/`.
De er komponert fra den eksisterende godkjente løperlogoen, uten eksterne bilder.
`npm run build:branding` gjenskaper dem; dette endrer ikke noen originalfil.

Hedershistoriene og eksplisitte løperkoblinger vedlikeholdes i
`data/honors.json`; se [hedersdokumentasjonen](docs/honors.md). Roller og
formelle utmerkelser holdes adskilt. Hedersdiplomer er fortsatt bare utkast
uten offentlig utstedelse.

En eventuell senere modulær opprydding av den store `index.html` er en egen
oppgave. V3.2 begrenser endringene til bygging, stabilitet, tilgjengelighet og deling.


Lojalitetsberegningen følger [felles regler for periodeandel og historisk heder](docs/loyalty.md).
Profil, skrytekort og «De trofaste» bruker samme modell. [Skrytekortdokumentasjonen](docs/share-cards.md)
beskriver de adaptive medaljestørrelsene og lokal før/etter-kontroll.
