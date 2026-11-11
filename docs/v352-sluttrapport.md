# Morothon V3.5.2 – leveransekontroll

Arbeidsgren: `codex/morothon-v3-5-2-dugnadsheder`, basert på `main`
`52ead6641bb39b31c889cafec6d4533d81d03d29`. Danielsen-hotfixen
`8300890`, som ikke var flettet inn i main, er tatt inn som `f68f05a`; ingen endringer i nyere main er overskrevet.

## Leveranse

- Én registrert dugnadsberegning for kort, profiler, valg, diplomer, PDF og
  personrapport. Eksplisitte enkeltår går foran godkjent total, som går foran
  registrert periode. Kjente fravær trekkes fra; bare arrangerte utgaver teller.
- Alle opptjente nivåer 5/10/15/20/30/40 er kumulative. Hovedmerket dupliseres
  ikke i samlingen. Personer uten tilstrekkelig grunnlag får takkediplom.
- Einar har godkjent total 33 uten oppfunnet årsrekke eller merkeår. Einar,
  Oscar og Erling Askildsen har æresmerke, separat grunnlegger og fem
  dugnadsmerker. Arnfinn og Helge beholder grunnlegger uten oppfunnet fartstid.
- Liggende A4 med dominerende 55 mm hovedmerke, 24 mm grunnleggermarkør med
  luft til innholdet og en nedre rekke 20,5 mm dugnadsmerker. Minnediplomer
  henvender seg ikke til en nålevende mottaker og får ingen utledet milepælsdato.
- Regenerert, kontrollsumbundet presentasjonssett: 44 personer og 73 valg.
  Alle sekundærbilder er med i innholdskontrollen. Ingen formelle tildelinger,
  utstedelser, grafikkgodkjenninger eller `printReady`-flagg er endret.
- [Full oversikt over alle 44](v352-personregister.md), inkludert ukjente
  start-/sluttår, fravær, summer, merker og standarddiplom.

## Visuell kontroll og faktisk bildekvalitet

`node scripts/review-honors-v352.cjs /tmp/morothon-v352` regenererer:

- Mobil 390 px og PC 1440 px: oversikt, grunnleggerseksjon, like store minnekort
  og de sju prioriterte personprofilene. 44 unike personer, ingen horisontal
  siderulling og ingen konsoll- eller JavaScript-feil.
- 18 faktiske A4-PDF/PNG, inkludert Oscar, Erling Askildsen, Einar, Dag, Håkon,
  Finn og Bent-Inge, samt øvrige grunnleggereksempler, minne- og takkekopi og
  de anonyme nivåeksemplene. Alle én liggende A4-side, ingen layoutfeil.
- Samlet sammenligningsbilde `tre-aeresdiplomer.png`, HTML-galleri,
  `kontroll.json`, `pdfinfo`, `pdffonts` og `pdfimages`-målinger.

De tre æresdiplomene er visuelt gjennomgått i faktisk gjengivelse. Grunnlegger
ligger separat øverst til høyre, med tydelig avstand til navn og tittel.
Æresmerket er størst, og de fem dugnadsmerkene ligger samlet over avslutningen.

Æresmerke og dugnadsnivåer bruker eksisterende SVG-originaler, uten fast
raster-DPI. Grunnleggermarkøren bruker uendret transparent 2400 × 2400 PNG;
ved 24 mm er den geometriske bildeoppløsningen omtrent 2540 DPI. Dette er ikke
ny godkjenning av motiv eller fysisk trykk. Eksisterende kvalitetsvarsler og
filenes godkjenningsstatus beholdes. PDF-ene inneholder innebygde fonter og
består teknisk utskriftskontroll; fysisk papir/printer er ikke testet her.

GitHub Actions genererer kontrollfilene som `morothon-v352-forhaandsvisning`
på PR-oppdateringer. Store PDF/PNG-filer inngår ikke i produksjonsgrenen.

## Bevaring og forbehold

`data/history.json`, navnesammenslåinger, Enny-Karin- og Jon-korrigeringer,
resultater, løpermerker, skrytekort og ordinære løperdiplomer er bevart.
Ordinær diplomkode og CSS kontrolleres mot tidligere versjoner. Hederssiden
har fortsatt `noindex, nofollow` og er ikke lenket fra offentlig navigasjon.

Erling Danielsen har registrert startår 1992 og mangler sluttår. Den nye,
bestilte perioderegelen gir derfor 35 beregnede utgaver og merkene 5–30.
Dette er ikke en ny bekreftelse av aktivitet i 2026. Et faktisk sluttår må
avklares ved neste personrevisjon; det er ikke gjettet her. Han har fortsatt
minnemerke, ikke grunnlegger eller æresmerke, og ingen feilaktig 33-omtale.
Floke og Leifs gamle kildeanslag om år er bevart, men blir ikke automatisk
omgjort til registrerte dugnadsutgaver eller nye årsmerker.

Siden er skjult, ikke tilgangsbeskyttet. Rene presentasjonskopier fra det
avgrensede kontrollsettet er tilgjengelige via direkte lenke, som før.
GitHub-API-tilgang og faktisk Actions-resultat rapporteres separat ved
levering; lokale tester alene er ikke et bevis på grønn GitHub-kjøring.

## Kontroller

- `npm test`: **176 av 176 bestått**, 0 feil, 0 hoppet over.
- Målrettet kontroll etter oppdaterte medaljesamlingsasserts: 14 av 14 bestått.
- `npm run build -- /workspace/review/morothon-v352-build-final`: bestått,
  56 produksjonsfiler, versjon `13132141e66f01c2`.
- `npm run diplomer:kontroll`: bestått, 44 personer / 73 valg, ingen skriving.
- Gjengivelseskontroll: 18 ensidige A4-PDF-er, 0 konsoll-/layoutfeil;
  de tre æresdiplomene, mobilprofiler og minnekort er også visuelt kontrollert.
- `actionlint .github/workflows/pages.yml` og `git diff --check`: bestått.

GitHub Actions må fullføres på PR-en; dette er rapporterte lokale resultater.
Ingen merge eller publisering er utført.

## Endrede filer

31 filer relativt til main, inkludert den innhentede hotfixen:

- `.github/workflows/pages.yml`
- `css/diplomas.css`
- `css/honors.css`
- `data/honors.json`
- `docs/diplomas.md`
- `docs/honors.md`
- `docs/v35-personregister.md`
- `docs/v35-sluttrapport.md`
- `docs/v351-sluttrapport.md`
- `docs/v352-personregister.md`
- `docs/v352-sluttrapport.md`
- `js/diplomas.js`
- `js/honors-data.js`
- `js/honors.js`
- `scripts/prepare-honor-print-set.cjs`
- `scripts/review-honors-v35.cjs`
- `scripts/review-honors-v352.cjs`
- `tests/danielsen-hotfix.cjs`
- `tests/helpers/honors.cjs`
- `tests/honor-badge-review.cjs`
- `tests/honor-draft-print.cjs`
- `tests/honor-final-approval.cjs`
- `tests/honors-dugnadsmilepaeler.cjs`
- `tests/honors-issue13.cjs`
- `tests/honors-v34.cjs`
- `tests/honors-v35.cjs`
- `tests/honors-v351.cjs`
- `tests/honors-v352.cjs`
- `tests/pr16-final.cjs`
- `tests/pr18-confirmed-years.cjs`
- `tests/volunteer-tenure.cjs`
