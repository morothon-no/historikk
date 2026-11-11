# Morothon V3.5.1 – leveransekontroll

Hotfix etter V3.5.1: Teksten «33 år med solid tjeneste i en rekke ulike roller»
gjelder Einar Danielsen. Oppføringen til Erling Danielsen har ikke dette tallet.
Kontroll av hotfixen: 171 tester bestått, 56 diplomvalg verifisert uten endrede
kontrollfingeravtrykk, 21 A4-prøver og ingen konsollfeil. Produksjonsbygget
består med 56 filer, versjon `bceb4d6e9e790087`. Historikk og diplominnhold er uendret.

Utgangspunkt: `main` etter merge av PR #18, `41f5e45`.
Gren: `codex/morothon-v3-5-1-heder-diplomer`.

## Resultat

- 44 unike personer, uten nye eller dupliserte identiteter.
- Einar har æresmerket og et eget mellomstort kort. Beslutningen om planlagt
  heder i 2026 har arrangøren som kilde. Ingen dokumentert årsrekke, utdelingsdato eller
  utstedt diplom er lagt til. Einar har 33 år med solid tjeneste
  i en rekke ulike roller. Grunnleggerrollen fra 1992 er bevart.
- Oscar og Erling Askildsen beholder toppkortene og 35 dokumenterte utgaver.
  Arnfinn og Helge har de mindre grunnleggerkortene.
- Erling Danielsen, Floke og Leif har like store minnekort nederst, etter
  grunnleggere, arrangører og dugnadshelter. Erling Danielsen var med på dugnad fra 1992 og bidro gjennom mange år,
  uten fastsatt antall utgaver.
- Hovedpresentasjonen bruker korte, naturlige beskrivelser. Fartstidsforbehold
  og merkestatus finnes i kildedetaljene. Håkons gamle fraværsmerknad er
  korrigert, og originalmerknaden er arkivert. Fullstendige navn og tre
  minneoppføringer er riktig omtalt.

## Diplomer

Et versjonert presentasjonssett med 56 person-/diplomvalg dekker alle 44.
Innhold, navn, historiske år, bildefiler, vannmerke og CSS kontrolleres med
SHA-256. Oppdatering er eksplisitt, ikke en automatisk del av bygg.

34 personer får «Takk for innsatsen» som standard: 24 uten årsmerke og ti med
bare anslått fartstid. Profilenes eksisterende hovedmerker er bevart. Anslag
blir ikke bekreftede dugnadsutgaver eller rene årsmerkediplomer. Særskilt
innholdsgodkjenning er fortsatt mulig gjennom det eldre godkjenningsregisteret.

De fem etterspurte faktiske A4-PDF-ene er generert fra gjeldende kode:

| Mottaker | Innhold | Utkastmerking i PDF |
| --- | --- | --- |
| Einar Danielsen | Æresdiplom, uten oppfunnet antall eller dato | Nei – kontrollert presentasjonskopi |
| Dag Morten Frantzen | 10-utgaversmilepæl, 2014–2023 | Nei – kontrollert presentasjonskopi |
| Håkon Lohne | 10-utgaversmilepæl, 2014–2024 | Nei – kontrollert presentasjonskopi |
| Christan Berthelsen | Takk for innsatsen, uten oppfunnet fartstid | Nei – kontrollert presentasjonskopi |
| Erling Danielsen | Minnediplom, uten oppfunnet dato | Nei – kontrollert presentasjonskopi |

Alle fem er én side liggende A4. Kontrollgalleriet har totalt 21 PDF/PNG-prøver:
13 personlige presentasjonskopier, sju anonyme eksempler og én særskilt godkjent
prøve med bare fiktive testdata. Anonyme eksempler er merket «EKSEMPEL».
Ingen av de 21 bruker «UTKAST – IKKE UTDELT». Et personlig diplom uten gyldig
kontrollfingeravtrykk merkes «FORHÅNDSVISNING», også i PDF.

Dette er presentasjonskopier for gjennomgang, **ikke gjennomført utdeling**.
`awards`, `issuedDiplomas`, `diplomaApprovals` og medaljenes `printReady` er
uendret. Siden har ikke innlogging; alle som kjenner adressen kan skrive ut de
registrerte presentasjonskopiene. Videre tilgangskontroll er utsatt etter
arrangørens avklaring.

## Kvalitetskontroll

- `npm test`: **169 bestått, 0 feil, 0 hoppet over**.
- `npm run build`: bestått, 56 produksjonsfiler, versjon `cd72033b4a880f0c`.
- `npm run diplomer:kontroll`: 44 personer og 56 diplomvalg verifisert, uten endring av filer.
- Produksjonsbygget ved 390/1440 px: 88 profiler og 176 utskrift/PDF-klikk, alle rene, uten konsollfeil eller horisontal rulling.
- 21 faktiske A4-PDF/PNG-prøver, 54 kontrollbilder og fem nye regresjoner: bestått.
- `git diff --check`, JavaScript-syntakskontroll og `actionlint`: bestått.
- Et varsel om utilgjengelig løpshistorikk som tidligere ble slettet ved visningsbytte, er nå bevart. Feilsituasjonen og framtidige utgaver er regresjonstestet.

Layoutkontroll, fonter, synlig numerisk blekkhøyde fra V3.1, faktisk DPI,
transparente kanter, SVG-avhengigheter og bildeintegritet er beholdt. Endret
innhold, manglende grafikk, avkutting og overlapp sperrer fortsatt utskrift.
Normalisering ved innholdskontroll er flyttet til inaktivt HTML-innhold, slik
at kontroll-ID-er ikke forsøkes lastet som bilde-URL-er. Konsollen kontrolleres
nå også når alle 44 persondiplomer åpnes.

Ingen fysisk prøveutskrift er utført. Tidligere design-/trykkvarsler for
medaljene er bevart under «Bildekvalitet»; en ren presentasjonskopi endrer ikke
originalenes godkjenningsstatus. Grunnlegger-PNG-en er 2400 × 2400 px, omtrent
1108 DPI ved 55 mm. SVG-merker er skalerbare vektorer uten fast raster-DPI.

## Bevaring og avgrensning

`history.json`, person-ID-er/aliaser, løpsresultater, Enny-Karin-korrigeringen,
løyperekorder, stafett, milepæler, adelskalender og ordinære løperdiplomer er
bevart. Godkjente medaljeoriginaler, `data/badges.json`, `index.html`,
`data/volunteers.json`, datoregisteret og `css/diplomas.css` er uendret.
Hederssiden er fortsatt skjult fra hoved- og mobilmeny og har `noindex, nofollow`.
Ingen kampanjemodul eller formell utstedertjeneste er lagt til.

Endrede filer (26):

- `css/honors.css`
- `data/honors.json`
- `docs/diplomas.md`
- `docs/honors.md`
- `docs/v35-personregister.md`
- `docs/v35-sluttrapport.md`
- `docs/v351-sluttrapport.md`
- `js/diplomas.js`
- `js/honors-data.js`
- `js/honors.js`
- `package.json`
- `scripts/prepare-honor-print-set.cjs`
- `scripts/review-honors-v35.cjs`
- `tests/badges.cjs`
- `tests/final-readiness.cjs`
- `tests/helpers/honors.cjs`
- `tests/honor-draft-print.cjs`
- `tests/honor-final-approval.cjs`
- `tests/honors-dugnadsmilepaeler.cjs`
- `tests/honors-v34.cjs`
- `tests/honors-v35.cjs`
- `tests/honors-v351.cjs`
- `tests/honors.cjs`
- `tests/pr18-confirmed-years.cjs`
- `tests/release-v2.cjs`
- `tests/volunteer-tenure.cjs`

Store kontrollbilder/PDF-er er ikke Git-sporet.

Regenerering:

```sh
npm run diplomer:kontroll
node scripts/review-honors-v35.cjs /tmp/morothon-v351
npm test
npm run build
```

Kontrollgalleriet åpnes i `/tmp/morothon-v351/index.html`. GitHub Actions
beholder det som `morothon-v35-forhaandsvisning` etter at PR er opprettet.
Ingen merge eller publisering inngår i leveransen.
