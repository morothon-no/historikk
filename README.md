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

Bruk Node.js 24 til testpakkene, Python 3.12 med Pillow, Chromium og Poppler.
Selve byggeren støtter Node.js fra versjon 20.
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

B1 gir fire portable testnivåer: `npm run test:quick` (uten nettleser og npm-
installasjon), `npm run test:functional`, `npm run test:visual` og
`npm run test:full`. Det siste kjører alle testene og kontrollerer originalkildene;
det krever kildecheckout og verktøyene over. Offentlige nivåer bruker bare den
godkjente datapakken. Se [B1: testvalg, målinger og sikkerhetsporter](docs/b1-testlop-og-maalinger.md).

Vanlig kode og tester krever nå bare ordinær PR-gjennomgang og grønne obligatoriske
sjekker, uten manuell SHA-oppdatering. Nye offentlige tester i `tests/public/`
oppdages automatisk. Særskilt head-godkjenning er forbeholdt sikkerhets-,
teststyrings- og publiseringsreglene: [enkel utviklingsflyt](docs/enkel-utviklingsflyt.md).

## Offentlig testportal (C1.2)

Etter merge og godkjent Pages-kjøring ligger den statiske testportalen på
[historikk/admin/](https://morothon-no.github.io/historikk/admin/).
Åpning krever ingen lokal installasjon. Oversikt, deltakere, merker og
kontrollerte diplomforhåndsvisninger bruker bare godkjente offentlige data.
Enkeltutskrift er tilgjengelig via nettleseren; samlet PDF krever fortsatt C1-serveren.
Ingen innlogging eller administrative skrivefunksjoner er aktivert.
Se [funksjonsstatus, datagrense og publisering](docs/c12-webportal.md),
[arrangementsprofilen](web-admin/event-profile.json) og [plan for C1.3](docs/c13-designadministrasjon.md).

## Designstudio (C1.3)

Under **Design og tilpasning** i testportalen kan arrangøren lage en egen profil,
merkeserier og et A4-diplomutkast, velge egne PNG/WebP-bilder og eksportere/importere
hele utkastpakken. Alt skjer i nettleseren, uten serverlagring eller endringer i
Morothons aktive profil. Nye design er stemplede utkast med sperret utskrift/PDF.
Se [bruk, funksjonsstatus og kontroll](docs/c13-designstudio.md) og
[operativ utkastkontrakt v2](docs/contracts/design-draft-v2.md).

## Lokal administrasjonsportal (C1.1)

Start med `npm run admin`. Portalen samler Oversikt, Deltakere, Merker og det
operative diplomverkstedet. Import og Premier er plassholdere for neste fase.
Kun lokal utvikling på `127.0.0.1`, uten innlogging eller offentlig drift.
Se [oppstart, modulstruktur og sikkerhetsavgrensning](docs/c11-adminportal.md).

## Lokalt diplomverksted (C1-pilot)

Start med `npm run diplomer:admin` og åpne den lokale adressen som vises.
Søk og velg mottakere, kontroller diplomene og last ned én samlet liggende
A4-PDF og en JSON-rapport. Knappen **Prøv fem mottakere** gir et enkelt prøveutvalg.
Verktøyet publiseres ikke på Pages og endrer ingen data eller godkjenninger.
Se [oppstart, krav og avgrensninger](docs/c1-diplomverksted.md).

## Bygging, cache og trygg publisering

```sh
npm run build
```

Dette bygger `_site/` fra den godkjente offentlige pakken i `public-data/` og
offentlige kode-/assetfiler. Utmappen må være tom. Bygget leser ikke originale
administrasjonsregistre og trenger ingen private tilganger.

```sh
npm run test:public
npm run public:kontroll -- _site
```

Privat/administrativ eksport er et separat steg som lager en kandidat til
gjennomgang. Originalene er foreløpig bevart på sin gamle plass; filtrering og
selvstendig bygg gjør ikke dagens Git-historikk privat. Publiser aldri
repositoryroten som statisk nettsted. Se [A1C: kommandoer, kontrakt og betrodd
PR-kontroll](docs/a1c-separat-eksport-og-bygg.md), [A1](docs/a1-offentlig-dataeksport.md)
og [A1B-planen](docs/a1b-privat-migreringsplan.md) med [publiseringsvalg](docs/a1b-publiseringsbeslutninger.md).

[A1D: portable administrasjonsverktøy](docs/a1d-privat-klargjoring.md) beskriver
godkjenningsstyrt backup, restore, migrering og offentlig eksport fra kommandolinjen.
Ingen originaler er flyttet, ingen privat tilgang er innført i offentlig CI,
og den aktive Pages-flyten er uendret.

Byggeren beregner én deterministisk innholdshash for hele utgaven. Alle lokale
CSS-/JS-URL-er i begge sider og diplomets isolerte iframe får `?v=<hash>`.
`morothon-version` og `build-info.json` viser samme versjon. Det finnes ingen
manuell versjonsstreng som må oppdateres. `homepage` i `package.json` er kilden
for absolutte delings-/canonical-URL-er i bygget.

Den eneste workflowen er `.github/workflows/pages.yml`. PR-er mot `main` kjører
betrodd pakkekontroll og offentlige tester uten originalregistrene. På `main`
kontrolleres alltid originaleksporten før deploy, med målrettede eller fulle
kildetester etter beskyttet endringsklassifisering. Ukjente/sikkerhetskritiske
endringer og eksplisitt fullkontroll kjører alle bevarte tester. Publisering krever
vellykket offentlig bygg/test, uavhengig artefaktkontroll og kildekontroll;
arbeidsgrener og PR-er deployes ikke. Første A1C-kjøring og sikkerhetsendringer
krever repo-eiers eksterne godkjenning og GitHub-beskyttelse som beskrevet i
A1C-veiledningen. Ikke merge uten arrangørens uttrykkelige godkjenning.

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
