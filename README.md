# historikk
Adelskalender for terrengløpet Søgne Morothon 

## Lokal utvikling og tester

Start nettsiden fra prosjektmappen med `python3 -m http.server 8000`.
Ingen bygging eller pakkeinstallasjon kreves for selve nettsiden.

Kjør regresjonstestene med `node --test tests/regression.cjs`. Testene krever
Playwright for Node.js og Chromium (`/usr/bin/chromium`, eller angi
`CHROMIUM_PATH`). De starter og stopper sin egen lokale testserver og kontrollerer
mobilgraf, PC-graf, resultatarkiv og at stafettlag ikke påvirker individuell statistikk.

Individuelle historiske data ligger i `people`, `results` og `yearStats` i
`data/history.json`. Lagresultater ligger separat i `teamResults` og skal aldri
legges inn som personer eller individuelle resultatlinjer. `place` og `time` er
`null` ved DNS. `legs` angir antall etapper, ikke en lik distanse per etappe.

Forsidens løyperekorder beregnes ved innlasting fra fullførte individuelle
resultater fra og med 2014, separat for damer og herrer i nøyaktig
`Morothon` / `20 km` og `Kortmoro` / `10 km`. Forsiden, profilens rekordfelt,
rekordmerker og delingskort bruker samme beregnede liste med løper-ID som nøkkel.
Ved delt rekord vises alle rekordholderne; ved gjentatt rekordtid for samme løper
brukes det første året tiden ble satt. Ingen tider eller rekordholdere er hardkodet.

«Årets milepæler» beregnes fra unike deltakelsesår per kanonisk person-ID.
Godkjente ID-omdirigeringer samler eldre resultat-ID-er før opptelling; navnealiaser
brukes til søk, og personer slås ikke sammen bare fordi navnene ligner.
DNS utelates, DNF teller, og separate lagresultater inngår ikke. Årets merke vises
når årets deltakelse når en av tersklene i `PARTICIPATION_BADGES` (5–50, steg 5).
Historiske år beregnes uten å ta med senere deltakelser. Forsiden bruker siste
arrangerte år i historikkfilen; resultatarkivet viser milepælene for valgt år.
Regresjonstestene dekker også kontrolltallene for 2026, alle merketerskler,
sammenslåtte ID-er, DNS/DNF og fremtidige årganger.

## Skrytekort V2

`js/brag-card.js` gir profil og bildeeksport én felles presentasjonsmodell basert
på de eksisterende deltakelsesmerkene, personens deltakelsesstatistikk og den
beregnede rekordlisten. Høyeste oppnådde offisielle medalje vises størst, tidligere
merker i stigende rekkefølge og neste delmål som en mindre fremdriftslinje.
Nivåene har egne metallfarger; minst 35 deltakelser gir en egen æresløperutgave.
Teksten om samtlige utgaver krever deltakelse i hvert faktisk arrangementsår og
er ikke knyttet til et fast antall utgaver. Eksporten er PNG i 1080 × 1350 piksler.
Høydemeter inngår ikke i hovedkortet; aktiv og lengste historiske rekke holdes adskilt.

Enny Dvergsnes er slått sammen med Enny-Karin Vindheim (`MOR-72A949A`). Det
manuelle 1999-resultatet er erstattet av den dokumenterte raden (1:22:22,
20. plass i kildelisten); `MOR-4CB0E52` videresendes til hovedprofilen. Kildelistens
plassering vises eksplisitt ved siden av den separat beregnede kjønnsklasseplasseringen.
Dette gir 2 643 profiler og 6 914 individuelle resultatrader, med uendret 23
individuelle deltakelsesår for Enny. 1999-statistikken er oppdatert til 204
registreringer/unike deltakere, 57 Morothon og 147 Kortmoro. Øvrige historiske
resultater, profiler, årsstatistikker og stafettlag er kontrollert mot godkjent V28.

Kjør fortsatt `node --test tests/regression.cjs`. Testene omfatter også
navnesammenslåingen, bevaring av øvrige historiske data, medaljenivåer på mobil og
PC, eksport, lange navn og dynamisk æresløpertekst.

## Diplomer

Profilknappen **Lag diplom** gir forhåndsvisning av oppnådde merkediplomer,
gjeldende rekorddiplom og debutantdiplom. Datoer fra arrangørens bekreftede
EQ Timing-liste ligger i `data/event-dates.json`; år uten dato vises med årstall.
Utskrift/PDF krever bestått bilde- og layoutkontroll. Master v2 krever bedre
frilagte løperoriginaler for 5–30 og rekordmerket, samt visuell godkjenning av SVG-vannmerket før utskrift kan godkjennes.

Se [diplomdokumentasjonen](docs/diplomas.md) for kvalitet, utskriftsinnstillinger,
tester og generering av lokale bildeeksempler og Gunnar Kåsas A4-PDF.

Felles merkefiler, terskler, titler og paletter ligger i `data/badges.json`, lastet
av `js/badges.js`. Se [merkeregister og v2-kildestatus](docs/badges.md). Den lokale
hederssidevisningen er `heder.html`; Oscar Lohne er kun navneeksempel, uten
tildeling eller bekreftet rolle. Kjør alle tester med
`node --test tests/regression.cjs tests/diplomas.cjs tests/badges.cjs`.

## Offisielt medaljebibliotek

`assets/medals/` samler originaler, godkjente trykkfiler og gjennomgangsvisning.
35/40/45/50 er kontrollerte, uendrede 700px-originaler for 55 mm trykk. Se
[kvalitetsrapporten](docs/medal-quality.md), [fellesregisteret](data/badges.json)
og [lys/mørk-galleriet](assets/medals/review.html).
Kjør også `node --test tests/medals.cjs`. Ingen AI-genererte medaljer er aktivert.

## Kontrollert frilegging og A4-testark

Sju native frileggingsutkast er lagt under `assets/medals/review/cutouts/`.
[Oppdatert kvalitetsvurdering](docs/medal-cutout-review.md) skiller godkjente
originaler fra utkast og regner DPI på faktisk motiv ved 55 mm.
Kjør `node scripts/review-medal-cutouts.cjs /tmp/morothon-cutouts` for galleri,
A4-PDF og rapport. `node --test tests/medal-cutouts.cjs` kontrollerer RGB-bevaring,
DPI og fysisk PDF-størrelse. Utkast er ikke aktivert som godkjente merker.

Hederslisten oppdateres i `data/honors.json`. Se [veiledningen](docs/honors.md)
for flere navn, foreløpig status og bekreftede begrunnelser.

## Senere trykkgodkjenning

Brukeren har godkjent de viste trykkfilene. Gjeldende bruksstatus og hashbundne unntak ligger i fellesregisteret; tidligere utkaststatus i rapportene er historisk. Se [godkjenningsnotatet](docs/print-approval.md). De faktiske DPI-tallene er uendret. Ingen publisering er godkjent.

«Menneskene bak Morothon» finnes i hovednavigasjonen og mobilmenyen. Hedersprofiler
bruker stabile lenker som `heder.html#person/oscar-lohne`, kildebelagte roller og
bekreftede historier fra `data/honors.json`. Se [hedersdokumentasjonen](docs/honors.md).
`tests/final-readiness.cjs` kontrollerer navigasjon, profiler, diplomutkast og 1992-rettelsen.

## Kjøring og kontroll av utgivelsen

Installer utviklingsavhengigheter med `npm ci`. Testene krever Chromium
(`/usr/bin/chromium`, eller `CHROMIUM_PATH`), Python med Pillow og Poppler-verktøyene
`pdfinfo`, `pdftotext` og `pdfimages`. `npm test` kjører alle regresjonstester.
`npm run build` lager en ren `_site/` med kun runtime-filer; tester, kildearkiver
og gjennomgangsmateriale følger ikke med til GitHub Pages.

Den aktive løperlogoen er godkjent PNG, og ingen tidligere avviste logoer er
inkludert i utgivelsesgrenen. Originalmotiver/proveniens er bevart i biblioteket
for kontroll. Se [merkeregister](docs/badges.md), [diplomer](docs/diplomas.md) og
[hedersprofiler](docs/honors.md) for gjeldende oppførsel og kilder.
