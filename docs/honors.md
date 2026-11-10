# Menneskene bak Morothon – V3

Hederssiden er en skjult forhåndsvisning på `heder.html`, med `noindex, nofollow`. Den er ikke tilgangsbeskyttet: side og data kan leses av alle som kjenner adressen. Det finnes ingen inngående lenke fra hoved- eller mobilmeny og ingen offentlig administrasjon. `HONORS_NAVIGATION_ENABLED` i `js/navigation.js` skal fortsatt være `false`.

## Personer, roller og merker

`data/honors.json` beholder schemaVersion 1 og de eksisterende `groups`/`members`-feltene. Hedersidentiteter har egne stabile nøkler og ruter, f.eks. `heder.html#person/oscar-lohne`. Nye felt er valgfrie, slik at eldre oppføringer uten historier eller løper-ID fortsatt kan vises.

- Grunnleggere: Erling Askildsen, Oscar Lohne, Arnfinn Håverstad, Helge Reisvoll og Einar Danielsen. Erling har rollen idéskaper og grunnlegger. Einar er særskilt bekreftet av arrangøren.
- Bekreftede dugnadshelter: Kalle Kimestad og Finn Lohne, minst siden 2014. Et tidligere startår er ikke fastsatt. Finn er knyttet til drikkestasjonen på Freden.
- Arrangørgruppen fra 2014: Dag Morten Frantzen, Håkon Lohne og Bent Bakke. Dag Morten og Håkon har bekreftede roller, men beholder `status: "provisional"` for det foreløpige merkeforslaget. Bent har ingen registrert hedersmedalje.
- Helge Andersen er fjernet fra grunnleggerlisten. Den tidligere hedersruten gir en korrigeringsmelding uten grunnleggermerke eller en gjettet løperkobling. Alle hans ordinære løpsresultater er bevart.

`status` beskriver hedersoppføringen/merkeforslaget. De separate `roles`-postene beskriver historiske roller med `confirmed`, `sourceIds` og eventuelt `fromYear` og en presiserende `note`. En bekreftet arrangørrolle endrer aldri medaljetildelingen automatisk.

`memberRefs` lar arrangørdelen vise Dag Morten og Håkon uten å opprette dupliserte personer eller profiler. Referanser må peke til en eksisterende person. De ordinære personpostene har fortsatt én eiergruppe. Roller, historier og valgfrie diplomtekster redigeres i datafilen, ikke i JavaScript.

## Eksplisitte løperkoblinger

Kun følgende kontrollerte `runnerId`-koblinger brukes:

| Hedersprofil | Løper-ID |
|---|---|
| erling-askildsen | MOR-5ACFAA4 |
| oscar-lohne | MOR-87AA561 |
| arnfinn-haverstad | MOR-A4F1F02 |
| helge-reisvoll | MOR-AD182FF |
| einar-danielsen | MOR-D48A84B |
| kalle-kimestad | MOR-C65968C |
| finn-lohne | MOR-3FAED73 |
| hakon-lohne | MOR-AA6C983 |

Dag Morten og Bent har ingen bekreftet løper-ID i denne bestillingen. De får hedersprofil uten løpsstatistikk. Navnelikhet brukes ikke til å etablere en kobling. Ukjent eller utilgjengelig eksplisitt ID gir heller ingen oppdiktet statistikk.

`js/history-data.js` er det delte, lesende datalaget for DNS/DNF, unike deltakelsesår, godkjente ID-omdirigeringer og beregnet klasseplassering. Den ordinære siden bruker de samme reglene som før via dette laget. Hederssiden beregner registrerte starter, første/siste år og beste tidsregistrerte resultat i grupper av **konkurranse + eksakt distanse + løypeperiode før/fra 2014**. Forskjellige traseer innen en periode kan også ha variert; teksten hevder ikke at alle løp med samme distanse var identiske.

Seire og pallplasser på hedersprofilen gjengis fra resultatets registrerte **kildeplassering**. De er tydelig merket som kildeopplysninger, separat fra beregnede kjønn-/aldersklasseplasseringer. Det gis ikke en ny historisk pallplass bare fordi én registrert tid er raskest i et ufullstendig datagrunnlag. Arnfinns Kortmoro-seier i 1993 er registrert med kildeplass 1 og tid 49:59.

«Flest løpsdeltakelser blant grunnleggerne» og «Raskeste grunnlegger – historisk 21 km» er beregnede fakta som fremheves i tekst. De er ikke nye formelle medaljetildelinger. Deltakelsesår brukes aldri som antall frivillig-/arrangørår.

## Historiske kilder og åpne spørsmål

`data/honors.json` har et kilde-register og referanser på roller, fortellinger og tidslinjen. Avislenkene er Fædrelandsvennen 21. oktober 2016 (Dag Morten Frantzen) og N247 10. oktober 2014 (Nicolai Prebensen). De ble forsøkt åpnet, men nettverkspolicyen ga 403 i arbeidsmiljøet. Tekstene bruker derfor bare opplysningene i arrangørens V3-bestilling og dens gjengivelse av artiklene. Ingen supplerende artikkelinnhold er oppfunnet, og det er ikke kopiert lange tekstpassasjer.

Arrangøren bekreftet 10. november 2026 at riktig deltakertall i 1992 er **128**, slik resultatarkivet viser. Fædrelandsvennens historiske artikkel fra 2016 oppga 129; forskjellen er bevart her som kildeopplysning, men tallet er ikke lenger uavklart. Ingen resultatrader er endret. Den dokumenterte arrangementsdatoen for 2018 er **søndag 11. november** (`data/event-dates.json`). Navnet «Inger Katherin Dahl Frantzen» er bekreftet korrekt og skal ikke rettes.

Følgende punkter står fortsatt åpne:
- Håkons ene Svalbard-opphold er ikke årfestet. Det utledes ikke av manglende løpsstarter.
- Bent Bakkes avslutningsår er ikke fastsatt.
- Kalle og Finns innsats før 2014 er ikke bekreftet.
- Floke Bredland omtales bare i en kildebasert banketthistorie. Ulike opplysninger om startåret er ikke avgjort. Han er ikke lagt til som grunnlegger eller mottaker av et nytt hedersmerke. Ingen minneside er laget.

## Diplomer og bildefiler

Fellesregisteret `data/badges.json` og alle medaljefiler er uendret. Grunnleggerens korrigerte «1992», de tre servicebildene og den godkjente løperlogoen gjenbrukes. Ingen portretter eller nye medaljer er generert.

`diplomaTribute` er en kort, personlig, kildebasert tekst. Den bruker det eksisterende A4-hovedfeltet og sitatfeltet uten å endre malens rammer, vannmerke, signaturfelt eller merkediplomene. Hedersdiplomer er fortsatt kun forhåndsvisninger: `imageReady: false`, `previewOnly: true`, ingen utskrifts-/PDF-knapper og iframe uten `allow-modals`. Utkaststatus står utenfor arket. En rolle uten hedersmerke får ikke et automatisk diplomvalg.

## Kontroll og lokale utkast

```sh
node --test tests/honors-v3.cjs
npm test
node scripts/review-honors-v3.cjs /tmp/morothon-honors-v3
```

Gjennomgangsbilder, lokale QA-PDF-er og rapporter inngår ikke i nettsidepakken. Skriptet pusher, utsteder eller publiserer ingenting. En senere offentlig lansering krever uttrykkelig godkjenning; navigasjon og indeksering aktiveres ikke av denne oppdateringen.
