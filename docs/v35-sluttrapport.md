# Morothon V3.5 – sluttkontroll

Utgangspunkt: `main` på `8e28dd6063dda7faf48d37e4baf6e754ba41e1c8`, inkludert PR #17. Arbeidsgren: `codex/morothon-v3-5-hedersregister`. Leveransen skal gjennomgås som én Draft PR, uten merge eller publisering.

## Resultat

- Alle **44 unike personer** er kontrollert. 20 har ett foreslått/foreløpig hovedmerke, 24 vises uten merke. Ingen personkort eller hedersprofil viser flere hovedmerker.
- **Ni aktive merketyper**: seks dugnadsnivåer, Grunnlegger, Morothons æresmerke og det nye minnemerket. Originalene til de to utgåtte merkene beholdes, sammen med historisk kompatibilitet. Endrede gamle forslag er bevart i `previousBadgeProposals`.
- Dag, Håkon, Finn og Kalle har 13 **mulige** utgaver fra 2014 og foreløpig Dugnadshelt (10). Bent har seks mulige utgaver innen 2014–2019; sluttåret er uttrykkelig foreløpig.
- Oscar og Erling Askildsen viser bare Æresmerket som forslag og beholder sine 35 dokumenterte utgaver. De øvrige tre grunnleggerne viser bare Grunnlegger, uten anslåtte 35 dugnadsutgaver.
- Erling Danielsen, Floke og Leif viser samme nye minnemerke. Arrangørens anslag holdes adskilt fra dokumenterte enkeltår. Minneseksjonen er flyttet etter grunnleggerne, med Erling Danielsen fremhevet.
- Håkons hovedrolle er Løpsleder Morothon, uten et udokumentert startår for selve løpslederrollen. Nils Martins styrelederrolle gir ingen dugnadsår.

[Personregisteret](v35-personregister.md) inneholder vurderingen av alle 44, erstattede hovedmerker og navnene på de 25 personene som mangler startår. Joar har kjent startår, men har ikke nådd fem mulige utgaver.

## Tester og faktiske forhåndsvisninger

- `npm test`: **150 bestått, 0 feil, 0 hoppet over**.
- `npm run build`: bestått, 56 produksjonsfiler, innholdsversjon `937ec7fbb20ee29b`.
- Etter siste presisering av grunnleggerseksjonens tilgjengelighetsnavn: `node --test tests/honors-v35.cjs tests/site-build.cjs`, **6 bestått** mot siste kildekode/bygg.
- `git diff --check`, JavaScript-syntakskontroller og `actionlint`: bestått.
- Chromium: faktiske helsidesbilder ved 1440 og 390 px, seksjonsbilder og kontroll av alle 44 kort/profiler. Ingen konsollfeil eller utilsiktet horisontal rulling i kontrollene.
- **14 A4-utkast** er gjengitt fra gjeldende kode som PNG og én-sides liggende A4-PDF. Layoutkontrollen består; datoer, lange navn, hovedmerke og sperret offentlig utstedelse er kontrollert. Oscar og Erlings 30-utgaversmilepæl bruker 2021, æresutkastene 2026. Anonyme og anslåtte milepæler samt minnediplomer får ikke oppdiktede datoer.
- Det nye SVG-merket er kontrollert med både prosjektets font og Arial som fontalternativ. Originale medaljefiler er ikke endret.

Regenerer de faktiske kontrollartefaktene med:

```sh
node scripts/review-honors-v35.cjs /tmp/morothon-v35
```

Åpne deretter `/tmp/morothon-v35/index.html`. `kontroll.json` inneholder målinger og PDF-kontroll. GitHub Actions genererer samme galleri som PR-artefaktet `morothon-v35-forhaandsvisning`, med 14 dagers lagring. Store PNG/PDF-filer følges ikke av Git og inngår ikke i nettsidebygget.

## Bevarte data og sperrer

Regresjonstestene kontrollerer at `data/history.json`, resultat- og person-ID-er, løperkoblinger, offisielle løpermerker og eksisterende bildefiler er bevart. Ordinær diplomkode utenfor hedersdiplomdelene og ordinær diplom-CSS er uendret. Eksisterende roller, historier, tildelinger og utstedelsesregistre bevares. Ingen nye `awards` eller `issuedDiplomas` opprettes.

Hederssiden er fortsatt skjult fra offentlig navigasjon og har `noindex, nofollow`. Alle hedersdiplomer er forhåndsvisninger; offentlig utskrift og PDF-utstedelse er sperret. Det nye merket har `design-draft` og `printReady: false`. Tekniske A4/PDF-prøvefiler er kontrollartefakter, ikke utstedte diplomer.

## Gjenstående usikkerheter

- Bent-Inges sluttår 2019 er foreløpig.
- Erling Danielsens om lag 33 utgaver og Floke/Leifs minst 25 år er arrangøranslag, uten konstruerte årsrekker. Erling Danielsens dødsår/sluttår og Floke/Leifs eksakte startår er ikke fylt inn.
- Ukjente startår og opphold beholdes ukjente; et beregnet intervall bekrefter ikke innsats hvert år.
- Minnemerket trenger visuell godkjenning. Ingen nye hedersmerker er formelt tildelt eller godkjent for fysisk trykk gjennom denne leveransen.

**Klar for gjennomgang som Draft PR. Ingen merge, aktivering av utstedelse eller publisering er utført.**
