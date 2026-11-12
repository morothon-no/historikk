# Morothon V3.6 – standardtekster, personregister og løperkoblinger

Gren: `codex/morothon-v3-6-diplomer-loperkoblinger`.
Grunnlag: V3.5.3 `07081fc`, med main `3e45c8b` bevart som forløper.
V3.5.3 er ennå ikke i main ved siste kontroll; V3.6 bygger videre på og
inkluderer håndskrift-/datoforbedringen. Ingen merge eller publisering er utført.

## Ferdig løsning

- Én felles tekst per dugnadsnivå i `data/honors.json.diplomaTexts.dugnad`.
  De eksisterende kvalitetssikrede tekstene for 5/10/15/20/30/40 er flyttet
  uten ordendringer. Både navngitte diplomer og anonyme eksempler bruker disse;
  personlige profiltekster overstyrer ikke vanlige dugnadsdiplomer.
- Navn, høyeste hovedmerke, tidligere merker og oppnåelsesdato beregnes fortsatt
  dynamisk. «Alle merker» og «Kun siste merke» beholdes. Diplomlayout, font,
  størrelser, medaljeplassering og bildefiler er uendret fra V3.5.3.
- `personDetails` samler korte beskrivelser og hele historier for alle 44 i
  samme JSON-register. Kortet viser kortteksten, detaljprofilen hele teksten
  og kildebelagte, bekreftede historier. Også enkle navneprofiler støtter dette.
  Ukjente navn får ikke generert ros. Gamle kildeposter bevares uendret.
- Æresmerket bruker eget `honorDiplomaText`, med felles standardtekst som
  reserve. De tre eksisterende aktive ærestekstene er bevart ordrett.
  Nye forslag for Oscar, Erling Askildsen og Einar ligger separat i
  [tekstforslagene](v36-tekstforslag.json) og er **ikke aktivert**.
- De fire bekreftede identitetskoblingene ligger med kilde og eksplisitt
  bekreftelse i personregisteret. Detaljprofilen viser «Også på startstreken»,
  riktig statistikk og lenke; kortet viser et kompakt antall løpsdeltakelser.
  Klikk til de fire faktiske profilene i Adelskalenderen er testet.
- Einar har særskilt bekreftet utdelingsdato **7. november 2026**. Diplomet
  viser «UTDELINGSDATO» og håndskrevet «Søgne, 7. november 2026». Dette er et
  eget `presentationDate`-felt; oppnåelsesåret og årlig fordeling av hans
  33 dugnadsutgaver er fortsatt ukjent. Ingen formell utdeling registreres.

| Hedersnavn, bevart | Bekreftet løper | ID | Nåværende løpsdeltakelsesår |
| --- | --- | --- | --- |
| Per Sangvik | Per Tommy Sangvik | MOR-EEA35C7 | 3 |
| Joar Lohne | Joar Nilsen Lohne | MOR-F582406 | 7 |
| Jenny Åmodt | Jenny Aamodt | MOR-D4EBCCF | 8 |
| Ole J.Bueklev | Ole Bueklev | MOR-F1FE757 | 4 |

Tallene kommer dynamisk fra historikken. DNS utelates, DNF telles og samme
år telles én gang. Løpsdeltakelser endrer ikke dugnadsantall eller hedersmerker.
Ingen andre løperkoblinger er utledet eller lagt til, og ingen profiler er
slått sammen. [Redigeringsveiledning](personregister-v36.md).

## Godkjenning og kvalitetssperrer

Alle personidentiteter, gamle historier, kilder, roller og dugnadsår er bevart
som kildegrunnlag. `history.json`, navnerettelser, Enny-Karin- og Jon-rettelsene,
arrangementsdatoer, originale medaljer, ordinære løperdiplomer og Adelskalender
bevares. Hederssiden er fortsatt skjult fra hovedmenyen og har `noindex`.

De 88 presentasjonsvariantene er kontrollert. Bare Einars to innholdssummer
er endret for den bekreftede utdelingsdatoen; øvrige 86 er identiske med V3.5.3.
Formell tildeling, `issuedDiplomas`, `diplomaApprovals`, `printReady` og
bildegodkjenning er uendret. Nye ærestekstforslag finnes bare i dokumentasjon
og tydelig merkede kontroll-PDF-er, ikke i aktive produksjonstekster.

Endret aktiv tekst/dato gir en annen kontrollsum. Den blir forhåndsvisning
inntil gjennomgang og eksplisitt klargjøring, uten å arve den gamle rene
utskriftsgodkjenningen. Ukjent kilde, ubekreftet løperkobling, ugyldig dato,
manglende font, bildefeil, reell overflyt eller overlapp sperres fortsatt.
Klargjøring skjer ikke automatisk i produksjonsbygget.

## Faktiske kontrollfiler

`node scripts/review-honors-v36.cjs /tmp/morothon-v36` genererer:

- 36 gjeldende, ensidige liggende A4-PDF-er, inkludert alle seks felles
  nivåtekster og begge medaljevarianter.
- Seks ekstra PDF-er med de tre personlige tekstforslagene, begge varianter,
  tydelig merket «FORHÅNDSVISNING». Forslagene er ikke utstedt eller aktivert.
- De fire løperkoblede personkortene og profilene ved 390 og 1440 px.
- Innledning, oversikt, medaljesamlinger, minnekort og kontroll av 44 identiteter.
- HTML-galleri, `kontroll.json` og `v36-kontroll.json`, innebygde fontmålinger
  og PDF-info. Ingen konsoll-/layoutfeil i gjengivelsen.

GitHub Actions genererer kontrollpakken `morothon-v36-forhaandsvisning` på PR.
Store bilder/PDF-er lagres utenfor produksjonsgrenen og kan regenereres.

## Tester

- Nye V3.6-regresjoner: 6 av 6 bestått, med alle seks nivåer og begge varianter.
- Direkte navigasjon til alle fire riktige løperprofiler: bestått.
- Oppdaterte historiske layout-/profil-/kildetester: 18 av 18 bestått.
- Tidligere minimalprofiltest: oppdatert for uttrykkelig bekreftede koblinger;
  ukoblede personer beholder små profiler uten oppdiktet løperhistorikk.
- `npm run diplomer:kontroll`: 44 personer, 88 gyldige valg, ingen skriving.
- `npm run build`: 58 filer, versjon `e7a29492f2133e7b`.
- Workflow-YAML, Node-syntaks og `git diff --check`: kontrollert.
- Samlet `npm test`: **193 av 193 bestått**, 0 feil, 0 hoppet over.

Nettleser- og PDF-kontrollene er kjørt med Chromium og Poppler på Linux, med
responsive mobil-/PC-bredder og eksisterende Windows-fontregresjoner.
Fysisk papirtest er ikke utført. GitHub-API-et var blokkert ved siste leveranse;
eventuell PR-opprettelse/Actions-status oppgis separat, uten å likestille
lokale testresultater med en GitHub-kjøring. Ikke merge uten gjennomgang.

## V3.6-filer endret fra V3.5.3

- `.github/workflows/pages.yml`
- `css/honors.css`
- `data/honors.json`
- `docs/diplomas.md`
- `docs/honors.md`
- `docs/personregister-v36.md`
- `docs/v36-sluttrapport.md`
- `docs/v36-tekstforslag.json`
- `js/diplomas.js`
- `js/honors-data.js`
- `js/honors.js`
- `scripts/honor-signoff-cases.cjs`
- `scripts/review-honors-v36.cjs`
- `tests/final-readiness.cjs`
- `tests/honor-badge-review.cjs`
- `tests/honor-signoff-v353.cjs`
- `tests/honors-issue13.cjs`
- `tests/honors-v34.cjs`
- `tests/honors-v36.cjs`
