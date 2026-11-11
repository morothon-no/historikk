# Morothon V3.5 – historisk sluttkontroll

Denne rapporten beskriver V3.5 ved PR #18. Gjeldende løsning og nyere endringer er dokumentert i [V3.5.1-rapporten](v351-sluttrapport.md).

Utgangspunkt: `main` på `8e28dd6063dda7faf48d37e4baf6e754ba41e1c8`, inkludert PR #17. Arbeidsgren: `codex/morothon-v3-5-hedersregister`. Leveransen skal gjennomgås som én Draft PR, uten merge eller publisering.

## Resultat

- Alle **44 unike personer** er kontrollert. 20 har ett foreslått/foreløpig hovedmerke, 24 vises uten merke. Ingen personkort eller hedersprofil viser flere hovedmerker.
- **Ni aktive merketyper**: seks dugnadsnivåer, Grunnlegger, Morothons æresmerke og det nye minnemerket. Originalene til de to utgåtte merkene beholdes, sammen med historisk kompatibilitet. Endrede gamle forslag er bevart i `previousBadgeProposals`.
- Dag har 13 **dokumenterte** utgaver i 2014–2026. Håkon har 12 **dokumenterte** utgaver i 2014, 2015 og 2017–2026, med bekreftet fravær i 2016. Finn og Kalle har fortsatt 13 **mulige** utgaver fra 2014. Alle fire beholder foreløpig Dugnadshelt (10). Bent har seks mulige utgaver innen 2014–2019; sluttåret er uttrykkelig foreløpig.
- Oscar og Erling Askildsen viser bare Æresmerket som forslag og beholder sine 35 dokumenterte utgaver. De øvrige tre grunnleggerne viser bare Grunnlegger, uten anslåtte 35 dugnadsutgaver.
- Erling Danielsen, Floke og Leif viser samme nye minnemerke. Arrangørens anslag holdes adskilt fra dokumenterte enkeltår. Minneseksjonen er flyttet etter grunnleggerne, med Erling Danielsen fremhevet.
- Håkons hovedrolle er Løpsleder Morothon, uten et udokumentert startår for selve løpslederrollen. Nils Martins styrelederrolle gir ingen dugnadsår. Dag og Erling Askildsen har tilleggsrollen «Tidligere styreleder i Søgne Skiklubb», uten oppdiktet periode og uten påvirkning på dugnadsberegningen.

[Personregisteret](v35-personregister.md) inneholder vurderingen av alle 44, erstattede hovedmerker og navnene på de 25 personene som mangler startår. Joar har kjent startår, men har ikke nådd fem mulige utgaver.

## Tillegget: personlige diplomer og utskrivbare utkast

Alle 44 har nå minst ett personlig diplomvalg. De 24 uten hovedmerke får
«Takk for innsatsen», uten oppdiktet fartstid eller medalje. Ni aktive merketyper
beholdes; takkediplomet er ingen ny utmerkelse. Fremtidige navneoppføringer får
samme løsning automatisk.

Begge knapper finnes på personlige og anonyme utkast. `checkServiceDraft()`
skiller teknisk brukbare utkast fra trykkgodkjente/endelig utstedte diplomer.
Eksisterende A4-/Windows-layoutkontroller er beholdt, og reelle feil sperrer
fortsatt. Designgodkjenning er et synlig forbehold, ikke et krav om formell
utdeling for å kunne prøvetrykke. Ingen godkjenningsflagg er endret.

## Profesjonell sidevisning og endelige diplomer

Generell side, personkort og galleri har fått vanlig, verdig språk uten repeterte
utkast- og utviklingsadvarsler. «Vis diplom» brukes gjennomgående. Usikre
fartstidsanslag og forslag til æres-/minnemerker er fortsatt tydelig identifisert.
Når et ikke-godkjent diplom åpnes, vises én forklaring og utkastmerking i
selve dokumentet. Godkjente endelige diplomer kan skrives ut uten merkingen.

`diplomaApprovals` er et nytt separat register over særskilte godkjenninger,
fortsatt **tomt** i produksjonsdataene. Godkjenningen dekker mottaker, tekst,
år/dato, forbehold, bilder, vannmerke og CSS. Endret innhold eller manglende
bildegodkjenning gir et merket utkast; reelle tekniske feil sperrer utskrift.
Ved klikk kontrolleres den faktisk viste versjonen på nytt. Ingen tildeling
eller utstedelse opprettes automatisk.

Seks nye regresjoner kontrollerer profesjonelt språk, særskilt godkjente
PDF-er uten utkasttekst, manglende/utdaterte godkjenninger, faktisk grafikk,
endrede tekster/CSS, kildekrav og foreløpige årsgrunnlag. Samme godkjenning er
også testet på nytt servernavn og med produksjonsbyggets versjonerte adresser.
Det rene PDF-eksemplet heter «Kontrollperson – bare testdata» og innebærer
**ingen faktisk godkjenning** av en registrert person eller et hedersmerke.

## Tester og faktiske forhåndsvisninger

- `npm test`: **164 bestått, 0 feil, 0 hoppet over**.
- `npm run build`: bestått, 56 produksjonsfiler, innholdsversjon `c383e2a39f6b3338`.
- Sluttkorrigeringen i PR #18 har to nye regresjoner for eksakte dokumenterte årsrekker, bekreftet fravær, udaterte styrelederroller, uendret fartstid/sortering, framtidige utgaver og synlig tilleggsrolle på mobil/PC. Historiske 10-utgaversdiplomer bruker Dags tiende dokumenterte utgave i 2023 og Håkons i 2024; dagens 13/12 utgaver overføres ikke til disse historiske diplomene.
- Seks nye utskriftsregresjoner dekker alle 44 profiler, alle 11 gallerieksempler, faktisk PDF-tekst/A4, reelle feil, rasteroppløsning og Windows-lignende fontmåling ved 100–200 % pikseltetthet.
- `git diff --check`, JavaScript-syntakskontroller og `actionlint`: bestått.
- Chromium: faktiske helsidesbilder ved 1440 og 390 px, seksjonsbilder og kontroll av alle 44 kort/profiler. Ingen konsollfeil eller utilsiktet horisontal rulling i kontrollene.
- **17 personlige/anonyme A4-prøver fra produksjonsdataene**, pluss én særskilt godkjent prøve med fiktive testdata, er gjengitt som PNG og én-sides liggende A4-PDF. Layoutkontrollen består; datoer, lange navn, hovedmerke og korrekt utkastmerking for ikke-godkjente diplomer i både skjermvisning og PDF er kontrollert. Begge knapper er kontrollert for alle 44 personlige diplomvalg og alle 11 gallerieksempler. Oscar og Erlings 30-utgaversmilepæl bruker 2021, æresutkastene 2026. Anonyme og anslåtte milepæler samt minnediplomer får ikke oppdiktede datoer.
- Det nye SVG-merket er kontrollert med både prosjektets font og Arial som fontalternativ. Originale medaljefiler er ikke endret.

PDF-rapporten inneholder også `pdffonts` og `pdfimages -list`. Fontene er innebygd.
Grunnlegger-PNG-en er 2400 × 2400 px og gir omtrent 1108 DPI ved 55 mm.
Takkediplomets eksisterende logo er 299 × 299 px og gir omtrent 315 DPI ved 24 mm.
SVG-motiver omtales som vektorer, ikke som oppskalerte 300 DPI-originaler.

Regenerer de faktiske kontrollartefaktene med:

```sh
node scripts/review-honors-v35.cjs /tmp/morothon-v35
```

Åpne deretter `/tmp/morothon-v35/index.html`. `kontroll.json` inneholder målinger og PDF-kontroll. GitHub Actions genererer samme galleri som PR-artefaktet `morothon-v35-forhaandsvisning`, med 14 dagers lagring. Store PNG/PDF-filer spores ikke av Git og inngår ikke i nettsidebygget.

## Bevarte data og sperrer

Regresjonstestene kontrollerer at `data/history.json`, resultat- og person-ID-er, løperkoblinger, offisielle løpermerker og eksisterende bildefiler er bevart. Ordinær diplomkode utenfor hedersdiplomdelene og alle eksisterende CSS-regler er uendret; nye CSS-regler er avgrenset til `.diploma-service`. Eksisterende roller, historier, tildelinger og utstedelsesregistre bevares. Ingen nye `awards` eller `issuedDiplomas` opprettes.

Hederssiden er fortsatt skjult fra offentlig navigasjon og har `noindex, nofollow`. Alle hedersdiplomer er forhåndsvisninger. Teknisk kontrollerte utkast kan skrives ut og lagres via nettleserens PDF-skriver, med «UTKAST – IKKE UTDELT» i selve dokumentet. Endelige diplomer uten utkastmerking krever en særskilt godkjenning av nøyaktig mottaker/innhold og godkjent grafikk. Ingen slike faktiske godkjenninger er registrert av denne endringen. Det nye merket har `design-draft` og `printReady: false`. Tekniske A4/PDF-prøvefiler er kontrollartefakter, ikke utstedte diplomer.

## Gjenstående usikkerheter

- Bent-Inges sluttår 2019 er foreløpig.
- Einar Danielsen har 33 år med solid tjeneste i en rekke ulike roller. Floke/Leifs minst 25 år er arrangøranslag, uten konstruerte årsrekker. Erling Danielsen har ikke noe fastsatt antall dugnadsutgaver. Erling Danielsens dødsår/sluttår og Floke/Leifs eksakte startår er ikke fylt inn.
- Windows-fiksen er kontrollert med regresjonsfonten som gjenskaper brukerens målte Windows-avvik; en ny fysisk Windows-maskin er ikke brukt i denne økten. Fysisk prøvetrykk på aktuell skriver gjenstår.
- Ukjente startår og opphold beholdes ukjente; et beregnet intervall bekrefter ikke innsats hvert år.
- Minnemerket og den nye takkediplomvisningen trenger visuell godkjenning. Ingen nye hedersmerker er formelt tildelt eller godkjent for fysisk trykk gjennom denne leveransen.

**Klar for gjennomgang som Draft PR. Ingen merge, formell tildeling, utstedelse av endelige diplomer eller publisering er utført.**

## Endrede filer mot main

39 filer i den samlede V3.5-leveransen. Store kontrollbilder og PDF-er ligger utenfor repositoryet.

```text
.github/workflows/pages.yml
assets/medals/service/memorial.svg
css/diplomas.css
css/honors.css
data/badges.json
data/honors.json
data/volunteers.json
docs/badges.md
docs/diplomas.md
docs/dugnadsmerker-fartstid.md
docs/honors.md
docs/v35-personregister.md
docs/v35-sluttrapport.md
heder.html
js/diplomas.js
js/honors-data.js
js/honors.js
scripts/review-honor-badges.cjs
scripts/review-honors-v35.cjs
tests/badges.cjs
tests/diploma-layout.cjs
tests/final-polish.cjs
tests/final-readiness.cjs
tests/helpers/honor-approval.cjs
tests/helpers/honors.cjs
tests/honor-badge-review.cjs
tests/honor-draft-print.cjs
tests/honor-final-approval.cjs
tests/honors-aeresmerke.cjs
tests/honors-dugnadsmilepaeler.cjs
tests/honors-issue13.cjs
tests/honors-v3.cjs
tests/honors-v34.cjs
tests/honors-v35.cjs
tests/pr16-final.cjs
tests/quality-v32.cjs
tests/release-v2.cjs
tests/volunteer-tenure.cjs
tests/volunteers.cjs
```
