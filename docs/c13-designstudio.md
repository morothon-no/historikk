# C1.3 – Design og tilpasning

Utgangspunkt: `main` etter PR #37 (`9284955`). Etter gjennomgang, merge og
normal Pages-publisering finnes studioet direkte under:

**https://morothon-no.github.io/historikk/admin/#design**

Det kreves ingen installasjon eller Node-server hos brukeren. Dette er et
fungerende utkastverktøy, ikke en publiserings-/utstedelsestjeneste. Aktiv
Morothon-profil, historiske data, merker, Heder og godkjente diplomer endres ikke.

## Slik prøver arrangøren det

1. Velg **Design og tilpasning** i hovedmenyen.
2. Velg **Nytt utkast**. Det åpner det isolerte Fjordløpet-eksemplet med andre
   farger og tersklene 3/6/9/12. Endre navn, tekst, logo, farger og distanser.
   Morothon-standard med 5/10/15/20/30/40 er et annet, separat utgangspunkt.
3. Under **Mine merker**: åpne et merke, velg eget PNG/WebP-motiv, navn,
   beskrivelse, terskel og status. Legg til, kopier, flytt eller fjern merker.
   Hele serien vises ved siden av. Eksempelmotiver fra Morothon er tydelig
   merket og er ikke offisielle motiver for et nytt arrangement.
4. Under **Diplomdesigner**: velg Klassisk, Moderne, Høytidelig eller Sportslig.
   Tilpass tekst, farger, bakgrunn, ramme, font, medaljestørrelse, samlingsvalg,
   sted, datoformål og navnesignatur. A4-forhåndsvisningen oppdateres automatisk.
5. Last ned **Eksporter komplett utkast**. Åpne filen senere med **Importer
   utkastpakke**. Konfigurasjon og egne bilder følger samme fil.

Ingen JSON-redigering eller GitHub er nødvendig i denne arbeidsflyten.
**Angre** går tilbake gjennom endringer; **Tilbakestill til lagret utkast** går
til siste eksport/import eller åpningsgrunnlaget. **Gjenopprett Morothon-standard**
lager standarden i utkastet, uten å overskrive publisert konfigurasjon.

## Hva fungerer – og hva er fortsatt sperret?

| Område | C1.3 |
| --- | --- |
| Profil | Navn, beskrivelse, slagord, topptekst, logo, fire farger, fontvalg, distansevisning og modulvalg med levende illustrasjon |
| Ferdige fargeprofiler | Morothon, Fjordblå og Kveldsløp |
| Merkeserier | Flere serier; navn/ID, grunnlag, tellenhet, eksplisitt regel, terskler, beskrivelser, hierarki, motiver og visningsstatus |
| Bildevalg | Ekte PNG/WebP, størrelse/header/dekoding/dimensjoner/SHA-256; ingen serveropplasting |
| Diplomdesigner | Fire faste maler på eksisterende A4-struktur, tekst-/designvalg og begge medaljevisninger |
| Registrerte designprøver | Ingers historiske sølvdiplom og Oscar/Einars særskilte æresdiplomer; fakta og medaljer beholdes |
| Lagre/hente | Innebygd, komplett utkastpakke som vanlig nedlastbar fil; validert ny import |
| Aktive opptjeningsberegninger for egne serier | **Ikke aktivert.** Deltakelse, fullføring, dugnad, starter og manuell heder holdes adskilt; ikke-støttede regler merkes |
| Nye trykkgodkjenninger, formell utdeling, publisering | **Sperret.** Ingen tidligere godkjenning arves av endret design |
| Skylagring, kontoer, kundeseparasjon, AI | Ikke implementert |

Modulvalg illustrerer hva en kommende offentlig løsning kan vise. Det skjuler
ikke tilganger og skrur ikke om på Morothons fungerende moduler. Designstudioet
er et eget administrativt arbeidsområde, ikke en sjuende offentlig modul.

## Utkast og lagring

Utkastet holdes bare i minnet i denne nettleserfanen og overlever navigasjon
innen portalen. Det brukes **ikke localStorage, database eller offentlig
skriverute**. Nettleseren varsler ved lukking av et endret, ikke eksportert
utkast. Nedlastingsfilen er brukerens varige kopi; den bør oppbevares trygt.

Nye/endrede motiver har alltid `unreviewed` og `printReady: false`. UI viser
faktiske piksler og DPI ved fysisk størrelse. Høy DPI alene er ingen garanti
for god frilegging, lesbar medaljetekst eller faktisk trykkvalitet.

Pakken inneholder egne bilder, metadata, konfigurasjon og kontrollsum. Originale
Morothon-bilder refereres med ID i det eksisterende godkjente biblioteket.
Import validerer alle felt, versjoner, referanser, stigende terskler, faktisk
bildefil og kontrollsummer før den tas i bruk. Feilet import bevarer gjeldende
utkast. Kontrollsummer er integritetssjekker, ikke signering/godkjenning.
[Operativ kontrakt v2 og eksakte grenser](contracts/design-draft-v2.md).

## Diplomgrenser

Studioet bruker `MorothonDiplomas.documentHtml` og `checkLayout` i en isolert
motorkontekst. CSS-/tekstendringer legges bare i den nye utkastforhåndsvisningen,
aldri i originalene. De samme faktiske A4-, font-, bilde- og kollisjonsmålingene
kjøres; en lang overskrift eller for stor medalje gir fortsatt layoutfeil.

Hovedmerket velges uavhengig av «Kun siste merke / Alle opptjente merker».
En illustrasjon viser bare lavere, aktive diplommerker i den valgte serien.
En registrert prestasjon får bare merker som var opptjent på dette tidspunktet,
gjennom eksisterende C1-adapter. Ukjent oppnåelsesdato forblir tom, uten en tom
datostrek. Einars 7. november 2026 forblir **utdelingsdato**, uten et gjettet
oppnåelsesår. Grunnlegger-/æresmerker beholdes i registrerte designprøver.

Alle utkast har synlig stempel også ved teknisk A4/PDF-kontroll. Studioets
utskrifts-/PDF-knapp er sperret. En grønn layoutmelding betyr bare at innholdet
passer på siden, ikke at designet eller motivet er godkjent. Eksisterende
godkjente enkeltdiplomer og C1s kontrollerte produksjonsmotor fungerer som før.

## Struktur og publiseringskontroll

```text
tools/diploma-admin/design-model.js    Portabel kontrakt, semantikk, bilder, pakker
tools/diploma-admin/design-studio.js   Editor, minne/angre, preview og filbetjening
tools/diploma-admin/design-studio.css  Avgrenset, responsivt arbeidsområde
```

Disse tre klientfilene legges eksplisitt til `ADMIN_SOURCES`. Byggepakken går
fra 68 til **71 filer**, derav **12 eksakte adminfiler**. Ingen verktøymappe
kopieres generelt; server, worker, API, tester, dokumentasjon og private
originalregistre er fortsatt utelukket. Aktiv profilkontrakt v1 beholdes;
den nye adminruten håndteres separat fra dens seks offentlige modulvalg.

**Ingen GitHub Actions eller repository-innstillinger endres.** Nødvendige
endringer i byggemapping, URL-versjonering og reservert adminrute ligger fortsatt
bak eksisterende policykontroll. Denne faktiske filkontraktutvidelsen krever
eiers `MOROTHON_REVIEWED_POLICY_HEAD` for den gjennomgåtte sluttcommiten før
grønn CI. Verken godkjenningsvariabel eller godkjent datamanifest endres av Codex.
Uavhengig artefaktkontroll og eksisterende main-only deploy/HTTP-etterkontroll
beholdes. Det er ikke opprettet ny server, offentlig port eller lagringstjeneste.

## Visuell og teknisk kontroll

Nye kontrakttester ligger i `tests/public/quick/design-draft.cjs`, og faktiske
browser-/A4-tester i `tests/public/visual/design-studio.cjs`. De bruker bare
godkjente offentlige eller syntetiske data. Kontrollbildene går inn i eksisterende
CI-artefakt **morothon-c1-diplomverksted**, undermappe `studio-c13/`:

- `profil-{1440,768,390}.png`
- `merker-{1440,768,390}.png`
- `diplomdesigner-{1440,768,390}.png`
- `designutkast-a4.pdf` – tydelig merket QA-utkast, ikke en utstedelse

Gjenskaping uten GitHub-hosting:

```sh
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c13-review node --test tests/public/visual/design-studio.cjs
node --test tests/public/quick/design-draft.cjs
npm run test:public
node --test tests/quality-v32.cjs tests/public-export.cjs
```

Ingen historiske PDF-gallerier regenereres for dette arbeidet. Det eksisterende
publiseringsartefaktet er fortsatt adskilt fra kontrollbilder og testutkast.

### Sluttkontroll 14. november 2026

- `npm run test:public`: **77/77 bestått**, ingen hoppede tester. Omfatter 8 nye
  C1.3-tester, eksisterende C1/C1.1/C1.2, data-/publiseringsgrenser og isolert
  bygg uten administrative originalregistre.
- `node --test tests/quality-v32.cjs tests/public-export.cjs`: **13/13 bestått**.
  Kildekartleggingen fra PR #37 er beholdt og utvidet til de tre nye klientfilene.
  Kontrollen av 43 synlige profiler og 86 uendrede Heder-diplomgrunnlag består.
- C1.3-browserkontrollen er kjørt på nytt etter siste betjeningsjustering, med
  faktisk PNG- og WebP-dekoding, komplett eksport/import, ugyldige/store bilder,
  fire maler, langt navn, begge medaljevalg og alle tre registrerte designprøvene.
- Ekte liggende A4 kontrollert med eksisterende layoutmotor og `pdfinfo`;
  Caveat innebygd med `pdffonts`, utkaststempelet bevart i PDF-tekst. En med vilje
  for lang overskrift gir fortsatt layoutfeil og ingen utskriftsmulighet.
- PC 1440 px, nettbrett 768 px og mobil 390 px er kontrollert med faktiske
  skjermbilder. Ingen utilsiktet horisontal rulling eller browserfeil i testene.
- `npm run build`, separat `npm run public:kontroll` og
  `npm run data:check-sources`: **bestått**, 71 tillatte filer, 43 profiler,
  uendret godkjent dataversjon 1.
- `.github/`, `data/`, `public-data/`, `assets/`, `js/`, `css/`, offentlig
  `index.html`/`heder.html`, npm-pakker og låsefil er uendret fra siste main.

Dette er lokale resultater. PR-/Actions-status og publisert adresse må verifiseres
etter opprettelse, nødvendig kontraktgodkjenning og senere eiers merge. Ingen
merge eller produksjonspublisering er utført som del av leveransen.

## Videre arbeid

Før arrangøren kan **aktivere** egne regler eller publisere en profil, trengs
implementering av de aktuelle regelmodellene, autentisering/arrangørtilgang,
autorisert lagringsadapter, versjonering, backup og eksplisitt godkjenning av
nye motiver, tekster og maler. En framtidig EQ Timing-årsarbeidsflyt kan bruke
de samme serie-/regel-/diplomdataene, men bygges ikke i C1.3. Verken en importert
pakke eller en senere AI-assistent skal kunne omgå godkjenningsgrensene.
