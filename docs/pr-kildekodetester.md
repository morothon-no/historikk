# Kildekodetester før merge

## Utgangspunkt og funn

Kontrollen gjelder `main` på `e0633ffc1ebf01cb497c240b38ad4242234333b4`
(etter PR #71). Produksjonskjøring [43941972689](https://github.com/morothon-no/historikk/actions/runs/43941972689)
var **Success**, inkludert Transitional trusted source regression og Pages,
med samlet kjøretid 6 min 49 sek.

`pages.yml` kjørte bare det eksplisitte offentlige testutvalget på PR-er.
`plan.cjs` velger kumulative nivåer quick/functional/visual/full; ukjente
endringer, tester, kildekodemoduler og manglende Git-grunnlag gir full kontroll.
Men «full» betyr full **innenfor jobbens scope**, ikke alle kildekodetester.
`run.cjs --scope source` krever administrative originalregistre og kjører
kildeeksport- og personkoblingskontroll før testene. Derfor er denne jobben
med hensikt begrenset til betrodd `main` og er fortsatt en publiseringssperre.
Å flytte hele jobben til PR ville brutt datagrensen.

Ved dette utgangspunktet lå **46 testfiler** utenfor offentlig PR-dekning.
Fire er nå særskilt avhengighetskontrollert for offentlig/syntetisk kjøring:

| Testfil | Faktiske avhengigheter og data |
| --- | --- |
| `tests/organizer-domain.cjs` | Domenemodell, arrangementsprofil, godkjent offentlig historikk; syntetiske konflikt- og manipulasjonstilfeller. |
| `tests/organizer-profiles.cjs` | Profilkontrakt, ren endringsplanlegger, import-/rettelsesmodell og syntetiske rettelsesfixtures; offentlig historikk. |
| `tests/postgres-review-store.cjs` | Simulert PostgreSQL-klient i minnet; tilfeldige testnøkler. Ingen DB-driver, database eller driftsnøkler. |
| `tests/c24-review-workspace.cjs` | Kryptert midlertidig testlager utenfor Git; syntetiske personer og tilfeldige testnøkler. |

Disse fire filene inneholder **19 tester**. Feilene fra #67/#68 ville dermed
gitt rød PR-jobb før merge: begge de feilende testfilene inngår hver gang,
uavhengig av endringsklassifisering.

## Ny separat jobb og tillitsgrense

Jobben **Public-safe source regression** kjører på alle PR-oppdateringer.
Den krever først vellykket Trusted policy and test plan, også når planjobben
feiler, avbrytes eller hoppes over. Ingen path-filter, valgfritt testnivå eller
`continue-on-error` kan hoppe over de fire påkrevde filene.

- Egen fersk GitHub-hosted runner, `permissions: {}`. Anonym Git-fetch fra
  offentlig repository med eksakte SHA-er, sparse-checkout og `blob:none`;
  ingen checkout-token, secrets, miljøgodkjenninger eller skriverettigheter.
- Eksisterende offentlige jobbers sparse-grenser er uendret. Den nye jobben
  henter i tillegg bare navngitte domenemoduler, fem rene servermoduler,
  offentlig arrangementsprofil og de fire testfilene. Ingen bred
  `/scripts/admin/`, administrative originalregistre eller migreringsverktøy.
- Beskyttet base-kode kontrollerer offentlig datapakke, kontrollsummer,
  manifestgodkjenning og policy **før** PR-kode kjøres, med samme A1C-sperrer
  som resten av PR-løpet. Nye regler/allowlist er selv beskyttet.
- Betrodd runner kopierer bare et fast avhengighetsutvalg til en midlertidig
  kjørerot. Der finnes ikke `.git`, `data/`, `node_modules`, kildearkiv,
  brukerens Git-konfigurasjon eller produksjonsnøkler. Historikkens SHA-256
  kontrolleres også mot godkjenningen fra den betrodde policykontrollen.
- Testprosessen får et eksplisitt minimalt miljø, eget HOME og midlertidig
  område. Ingen GitHub-command-filer, `NODE_OPTIONS`, `NODE_PATH`, tokens eller
  øvrige arvede miljøvariabler. Ingen npm-installering, cache eller DB-tjeneste.
- Manglende avhengighet, symlink, endret offentlig historikk, feil, timeout
  eller avbrutt testprosess gir feilstatus. Ingen test hoppes stille over.
- Jobben lager ingen publiseringsartefakter. Den uavhengige artifact-gaten
  kjører fortsatt på separat runner med fersk betrodd kontrollkode.
  `deploy` krever fremdeles både artifact-gate og betrodd kildekoderegresjon.

PR-kode behandles som **ubetrodd testkode**, ikke som godkjenning eller
publiseringstillatelse. Kopiert kjørerot og filtrert miljø er ikke en OS-sandbox.
Sikkerhetsgrensen er en separat, rettighetsløs engangsjobb uten private kilder
eller nøkler. Nettverk er ikke generelt blokkert; tidligere offentliggjorte
originaler/Git-historikk blir ikke private gjennom denne endringen. Eksisterende
A1B/A1C-oppfølging gjelder fortsatt. Ingen persondata legges i testrapporten.

## Ikke verifisert før merge

De øvrige **42 kildekodetestfilene** er listet i vedlegget. De er **ikke bestått
på PR** bare fordi offentlige tester og den nye jobben er grønne. Noen trenger
originalregistre, eldre Git-proveniens eller kildespesifikke diplom-/PDF-verktøy;
andre er ennå ikke gjennomgått for en offentlig avhengighetsgrense. Det er
ikke dokumentasjon på at alle 42 er iboende utrygge; ingen flyttes ukritisk.

Jobboppsummeringen lister disse som **NOT VERIFIED before merge**, også nye
rotfiler i `tests/` som ikke tilhører det offentlige utvalget. Rapporten setter
bare `verifiedBeforeMerge` etter vellykket kjøring av alle fire påkrevde filer.
Manglende rapport vises eksplisitt som ikke verifisert.

Før merge kreves en eksplisitt gjennomgang av gjenstående kildekontroller:

1. Vedlikeholder gjennomgår nøyaktig PR-head før kode gis tilgang til originale
   administrative kilder i et betrodd miljø. Offentlige PR-jobber får dem aldri.
2. Kjør `npm test` i dette betrodde miljøet og legg resultat/commit i PR-en.
   Ved ukontrollerte originalkilder eller manglende verktøy skal kontrollen
   rapporteres som **ikke verifisert**, og merge avventes.
3. Etter merge beholder main sin automatiske kildekodejobb og Pages-sperre.
   En grønn PR erstatter aldri denne produksjonskontrollen.

Den manuelle gjennomgangen av private kildekontroller er ikke teknisk
håndhevet av en grønn offentlig teststatus. Den må inngå i obligatorisk
PR-godkjenning. Å kjøre de 42 automatisk før merge uten privat datatilgang
krever senere målrettet portering til offentlige/syntetiske fixtures.

## Lokal bruk

Vanlig kontroll av de fire filene, uten npm-installasjon eller originale registre:

```sh
node scripts/testing/run.cjs --scope pr-source \
  --approval .github/public-data-approval.json \
  --report /tmp/morothon-pr-source-report.json
```

I CI kommer godkjenningsfilen fra beskyttet base-kontroll, aldri fra et
ubehandlet PR-valg. Lokalt må filen hentes fra et betrodd, godkjent grunnlag.
`--scope public`, `--scope source`, `npm test` og eksisterende nivåer beholdes.

## Nødvendige GitHub-innstillinger

Ingen repository-innstillinger er endret. GitHub-API-et er blokkert, men den
[offentlige regelvisningen for main](https://github.com/morothon-no/historikk/rules?ref=refs%2Fheads%2Fmain)
ble kontrollert 16. november 2026. Aktivt regelsett **Morothon – beskytt main**
(ID `26984942`) krever bare **Public package, policy and site build** og
**Independent trusted artifact gate**. Antall obligatoriske godkjenninger er
**0**, avvisning av gamle godkjenninger er deaktivert, og oppdatert gren er
ikke påkrevd. Bypass-rettigheter var ikke synlige i den offentlige visningen.
Den nye sjekken og uavhengig gjennomgang er dermed **ikke bekreftet påkrevd**.

Utfør følgende én gang før denne PR-en merges:

1. Åpne [regelsettet](https://github.com/morothon-no/historikk/settings/rules/26984942)
   under **Settings → Rules → Rulesets**, for `main`.
2. Behold **Require a pull request before merging** og eksisterende
   godkjenningskrav. Krev minst én uavhengig godkjenning og avvis foreldede
   godkjenninger etter nye commits, dersom dette ikke allerede er satt.
3. Under **Require status checks to pass before merging**, behold eksisterende
   kontroller og legg til **Public-safe source regression**, fra GitHub Actions.
   Behold **Trusted policy and test plan**, **Public package, policy and site
   build** og **Independent trusted artifact gate**. Navnene kan vises med
   workflow-prefikset `Test and deploy GitHub Pages /`.
4. Behold/aktiver kravet om oppdatert gren mot `main`. Lagre aktiv regel og
   kontroller PR-ens merge-boks. Ikke anta at en rød sjekk blokkerer administrator
   med bypass-rettigheter. Den main-eksklusive kildekodejobben erstattes ikke av
   en PR-sjekk som alltid hoppes over.

Denne PR-en endrer **selve sikkerhetsreglene**. Eksisterende, eksterne
SHA-godkjenning må derfor beholdes: etter gjennomgang av den endelige head-SHA,
sett repository-variabelen `MOROTHON_REVIEWED_POLICY_HEAD` til akkurat denne
SHA-en under **Settings → Secrets and variables → Actions → Variables** og
kjør feilede kontroller på nytt. Nye commits krever ny gjennomgang. Vanlige
framtidige kode-/testendringer trenger fortsatt ikke en slik SHA-oppdatering.
Ingen policygodkjenning settes automatisk fra PR-en.

## Kontroller i denne leveransen

- Den firefilers kildekodegruppen: 19/19 bestått.
- Syntetisk feil gir exit 1 og `not-verified`; korrigert test gir exit 0 og
  `passed`. Egne tester dekker manglende filer, symlinker, kontrollsumavvik,
  filtrert miljø og fravær av originalregistre/Git i testroten.
- Hurtig offentlig regresjon: 144/144 bestått.
- Reell anonym sparse-fetch av begge SHA-bundne checkout-sett: bestått.
  Ingen originale registre materialisert. Deretter samme godkjenningskontroll
  og 19 tester i isolert offentlig checkout: bestått.
- Lokal simulering av sikkerhetspolicy uten ekstern head-godkjenning: avvist.
  Med eksplisitt simulert head-godkjenning: bestått. Ingen GitHub-variabler endret.
- A1D-testen av PR-grensen er presisert til det eksakte femfilers modulutvalget;
  backup/migrering, private repositoryreferanser og produksjonsruntime er fortsatt
  sperret. Separat A1D-regresjon: 18/18 bestått.
- Offentlig bygg og uavhengig artefaktkontroll: bestått, 74 filer, 43 synlige
  Heder-profiler. Alle eksisterende workflow-jobber er byte-identiske; bare den
  nye isolerte jobben er lagt til. YAML, Bash- og Node-syntaks er kontrollert.
- Første `npm test`: 469/470 bestått. Den ene feilen var A1D-testens gamle
  totalforbud mot servermoduler i PR-checkout. Testen er rettet til det eksakte
  isolerte filutvalget og består ved målrettet omkjøring (18/18). De øvrige
  469 testene var grønne. Hele den tunge renderingspakken ble ikke kjørt om
  bare for denne testassertjonen. Siste målrettede samletest av A1D, de fire
  kildekodetestfilene, planleggeren og sikkerhetssperrene: **58/58 bestått**.
  Aktuell PR-status rapporteres i PR-leveransen.

Ingen endringer i nettsidens funksjonskode, resultatdata, medaljer, diplomer,
arrangørregistre eller offentlig design. Ingen arbeid fra issue #72 er inkludert.

## Vedlegg: kildekodetester uten automatisk PR-verifikasjon

Alle disse ble utelatt på PR allerede før endringen fordi de lå utenfor
`publicFiles('full')`, mens `source_checks` var main-eksklusiv. Full main-kjøring
beholder alle. Ved visual-nivå kjører main bare `honor-card-collections`,
`honors-visibility` og `quality-v32`; ved quick/functional kjører main
kildeeksport-/koblingskontroller, men ingen av disse testfilene.

- `tests/admin-infrastructure.cjs`

- `tests/badges.cjs`

- `tests/danielsen-hotfix.cjs`

- `tests/diploma-layout.cjs`

- `tests/diploma-windows.cjs`

- `tests/diplomas.cjs`

- `tests/final-polish.cjs`

- `tests/final-readiness.cjs`

- `tests/honor-badge-review.cjs`

- `tests/honor-card-collections.cjs`

- `tests/honor-diploma-variants.cjs`

- `tests/honor-draft-print.cjs`

- `tests/honor-final-approval.cjs`

- `tests/honor-signoff-v353.cjs`

- `tests/honors-aeresmerke.cjs`

- `tests/honors-dugnadsmilepaeler.cjs`

- `tests/honors-final-v361.cjs`

- `tests/honors-issue13.cjs`

- `tests/honors-v3.cjs`

- `tests/honors-v34.cjs`

- `tests/honors-v35.cjs`

- `tests/honors-v351.cjs`

- `tests/honors-v352.cjs`

- `tests/honors-v36.cjs`

- `tests/honors-v361.cjs`

- `tests/honors-visibility.cjs`

- `tests/honors.cjs`

- `tests/jon-grindland.cjs`

- `tests/medal-cutouts.cjs`

- `tests/medals.cjs`

- `tests/pr16-final.cjs`

- `tests/pr18-confirmed-years.cjs`

- `tests/print-approval.cjs`

- `tests/profile-v321.cjs`

- `tests/public-export.cjs`

- `tests/quality-v32.cjs`

- `tests/release-v2.cjs`

- `tests/runner-link-review.cjs`

- `tests/service-milestones-v362.cjs`

- `tests/source-history-preservation.cjs`

- `tests/volunteer-tenure.cjs`

- `tests/volunteers.cjs`
