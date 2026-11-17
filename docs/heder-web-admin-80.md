# Heder i nettbasert admin (#80)

Utgangspunkt: `main` etter PR #79 (`fd174fe`). Leveransen bruker den eksisterende
nettportalen på **https://historikk.morothon.no/admin/#heder**, uten installasjon,
lokal server, terminalkommandoer eller filopplasting hos arrangøren. Adressen får
endringene først etter godkjent merge og ordinær Pages-publisering.

## Det som fungerer

- Heder i adminmenyen: 43 gjeldende personer totalt, med de tre minneprofilene i
  egen «Til minne om»-gruppe. Ingen gjeninnføring av den feilregistrerte profilen.
- Søk, lesing av roller, historietitler/-tekster, personlig diplomtekst,
  dugnadsgrunnlag, løperkoblinger og eksisterende hoved-/særmerker.
- **Ny person / Rediger** gir en faktisk fungerende forhåndsvisning av navn,
  omtale, roller, historier, diplomtekst, enkeltutgaver, perioder, fravær og
  aktiv-/sluttstatus. Roller uten telleeffekt skaper ikke dugnadsutgaver.
- Flere gjennomførte utgaver per kalenderår støttes av samme ID-baserte motor
  som i #79. Periodeforslag er ikke dokumenterte enkeltutgaver. En godkjent total
  gir ingen oppdiktet årsrekke eller oppnåelsesdato.
- Eksisterende deltakersøk, aliaser og deltakelsesår. Valgt identitet krever
  separat bekreftelse i forhåndsvisningen; ingen permanent personkobling,
  sammenslåing eller dobbeltelling skjer.
- Merke-/opptjeningsvisning og før/utkast-diff oppdateres i fanen. Grunnlegger,
  særheder og minnemerker bevares separat fra beregnet kvalifisering.

## Hva lagres, og hva blokkerer varig administrasjon?

**Ingenting lagres i personregisteret.** Redigerte felt og forhåndsvisninger
finnes bare i den åpne fanens JavaScript-minne. Ny lasting lukker denne
arbeidsvisningen. De sendes ikke over nettet og legges verken i localStorage,
sessionStorage, IndexedDB, URL, nedlastingsfiler, GitHub eller offentlige artefakter.
Forkast/lukk fjerner forhåndsvisningen. Ikke legg inn private kildemerknader i den
uautentiserte testportalen.

Knappen **«Lagring krever innlogging» er deaktivert**. Et direkte forsøk på
`honors/drafts/keep` gjennom webadapteren avvises også (503), uansett hvilke
klientflagg eller «godkjenninger» som sendes. Ingen endret forhåndsvisning går
inn i den ordinære diplommotoren eller blir et utskriftsgodkjent diplom.

**Én konkret blokkering:** Det finnes ingen etablert, autentisert Heder-webtjeneste
med serververifiserte arrangørrettigheter og privat varig lagring. GitHub Pages
serverer bare statiske filer. Repositoryet har private lagrings-/revisjonsprimitiver,
men de er ikke en driftssatt tjeneste med innlogging, autorisasjon og Heder-API.
En loopback-nøkkel eller nettleserbekreftelse er ikke slik autentisering.

For å fullføre registerlagring og varige modulinnstillinger må en godkjent
backend med disse egenskapene etableres/tilkobles. Den må selv binde endringer
til riktig arrangør og dataversjon, validere diff/identitet, føre revisjonsspor
og beholde separat publiseringskontroll. Ingen tjeneste, kostnad, ny legitimasjon
eller åpent HTTP-skriveendepunkt opprettes i denne PR-en. Dette er derfor en
integrert webleveranse for lesing/redigeringsforhåndsvisning, **ikke ferdig varig
Heder-administrasjon**.

## Aktivering, publikum og nye arrangører

Under Oversikt finnes **«Vis Heder i denne fanen»**. Dette er et eksplisitt,
midlertidig visningsvalg, ikke en lagret arrangørinnstilling eller tilgangskontroll.
Av slår av Heder-meny/visning, fjerner fanens Heder-diplomvalg og avviser alle
Heder-operasjoner i webadapteren (404). På gjør registeret tilgjengelig igjen.
Ny lasting bruker standardinnstillingen. Begge tilstander lar tidligere
publiserte offentlige datafiler være offentlige.

Offentlig Adelskalender-meny påvirkes aldri av dette valget. Heder og admin
forblir skjult fra den offentlige navigasjonen. `noindex, nofollow` beholdes.
Det finnes ingen nye HTTP-API-er på Pages; adapterens ruter er funksjonskall
internt i nettleseren. Dette er ikke en erstatning for serverautorisasjon.

Den eksisterende datapakken er en eksplisitt Morothon-overgangsadapter. En
arrangementsprofil med en annen ID får tomme person-/resultatmodeller, ingen
løperkandidater, ingen nedarvede Heder-merker og ingen Morothon-diplomkatalog.
Dette hindrer utilsiktet dataarv; det gjør ikke offentliggjorte filer private og
utgir seg ikke for ferdig flerarrangørtilgang eller kundeoppretting.

## Gjenbruk og kontroll

#79s modeller for register, tillatt klientvisning, kandidatsøk og øktutkast er
flyttet samlet til den eksisterende portable `portal-data.cjs`-modulen.
`scripts/admin/honor-*.cjs` beholder kompatible innganger. Samme implementasjon
brukes på web og i det tidligere verkstedet; ingen parallell hedersmotor er laget.
SHA-256 bruker native Web Crypto i både Node og nettleseren. Opprettelse av
utkastmotoren og forhåndsvisning er asynkrone; kilde-/revisjonsbinding og vern mot
eldre samtidige forhåndsvisninger beholdes.

Publiseringslisten er fortsatt 74 filer, hvorav de samme 15 adminfilene. Ingen
endring i data/, public-data/, manifest, medaljer, diplommotor/-CSS, offentlig
Adelskalender, workflows, sparseregler eller uavhengig artefaktgate. Ingen nye
avhengigheter. Alle filer bygges og kontrolleres med eksisterende A1C/B1-løp.

Målrettet kontroll før full regresjon: 35 Heder-modelltester, 22 nettlesertester
og 24 målrettede bygg-/sikkerhets-/testplanleggingstester bestått. Isolert offentlig
pakke uten data/ og scripts/admin/: 27 relevante modell-/nettlesertester bestått.
Full regresjon på eksakt slutt-SHA og PR-CI-resultat rapporteres i PR-en; grønn
lokal kontroll regnes ikke som bevis for en utført GitHub-kjøring eller deploy.

Ytelse målt lokalt i Chromium med tre nye nettleserkontekster per versjon:
median til synlig oversikt var 543 ms på main og 681 ms med endringen; median
navigasjon til Heder var 1093 ms. De tre endrede JS-filene øker samlet gzip-størrelse
med omtrent 12,3 KiB. Tallene er en lokal sammenligning, ikke en nettverks-/drifts-SLA.
Den offentlige Adelskalenderen laster ikke disse adminfilene og får ingen nye filer
eller endret kode i denne leveransen.

For utviklere:

```sh
node --test tests/honor-drafts.cjs tests/honor-admin-roster.cjs tests/honor-admin-view.cjs tests/honor-runner-search.cjs tests/public/quick/honor-web-model.cjs
CHROMIUM_PATH=/usr/bin/chromium MOROTHON_C1_REVIEW_DIR=/tmp/morothon-review node --test tests/public/visual/admin-portal.cjs tests/public/visual/web-admin.cjs
npm test
npm run build -- /tmp/morothon-public-build
node scripts/check-public-site.cjs /tmp/morothon-public-build
```

Kontrollbilder `heder-web-oversikt-{1440,768,390}.png` og
`heder-web-editor-{1440,768,390}.png` regenereres i `web-c12/` under valgt
kontrollmappe og følger eksisterende C1-kontrollartefakt i CI. Store
skjermbilder/PDF-er eller redigerte personutkast legges ikke i Git-grenen.
