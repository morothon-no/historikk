# Enkel utviklingsflyt for Morothon

Denne regelen erstatter det brede SHA-kravet fra B1. Ingen nye GitHub-tjenester,
workflows, tokens, team eller tilgangsroller er innført.

## Vanlig utvikling

1. Lag arbeidsgren fra oppdatert main. Endre kode og relevante tester.
2. Kjør passende testnivå lokalt. Opprett/oppdater PR.
3. CI velger nivå fra beskyttet base. Tester og ukjente endringer utløser full
   kontroll; manglende endringsgrunnlag gir også full kontroll, uten SHA-forespørsel.
4. Eier gjennomgår PR-en. Påkrevde sjekker må være grønne før en manuell merge.

**Ingen oppdatering av `MOROTHON_REVIEWED_POLICY_HEAD` trengs for vanlig kode,
testinnhold, testhjelpere, avhengigheter/låsefil eller vanlige npm-testkommandoer.**
Et grønt resultat fra en endret `npm test`-kommando er ikke tilstrekkelig:
CI bruker den beskyttede kjøreren og dens obligatoriske tester direkte.

Nye offentlige tester legges i `tests/public/quick/`, `functional/`, `visual/`
eller `full/`. De blir automatisk funnet uten endring i workflow eller testkatalog.
Se [testkonvensjonen](../tests/public/README.md). Bruk syntetiske/godkjente data;
originalregistre gis fortsatt ikke til offentlige PR-jobber. Kildetester som
trenger originalene forblir i lokal/full kontroll og betrodd main-jobb.

## Sjeldne endringer som fortsatt krever særskilt godkjenning

| Endring | Kontroll |
| --- | --- |
| `.github/workflows/`, `.github/CODEOWNERS` | Eksakt gjennomgått head-SHA |
| Offentlig godkjenningsreferanse, felt-/filgrenser, eksportregler, bygge- og artefaktkontroll | Eksakt gjennomgått head-SHA |
| `scripts/testing/catalog.cjs`, `plan.cjs`, `run.cjs` | Eksakt gjennomgått head-SHA; dette bestemmer hvilke tester som er obligatoriske |
| Npm-kommandoene `build`, `public:kontroll`, `data:export`, `data:check-sources`, inkludert deres pre/post-livssykluser | Eksakt gjennomgått head-SHA; andre npm-felt utløser ikke dette |
| Ny godkjent offentlig datapakke | Fortsatt eksplisitt manifest-SHA og høyere dataversjon; PR-en godkjenner ikke sin egen pakke |

Den konkrete listen håndheves i `scripts/check-public-policy.cjs`. Kontroll av
ekskluderte eksportskript bruker bare Git-tre-ID-er; originalfiler materialiseres
ikke i offentlige jobber. CLI-kontrollen krever Git-metadata og riktig PR-head.

For disse sjeldne regelendringene setter eier fortsatt
`MOROTHON_REVIEWED_POLICY_HEAD` til siste gjennomgåtte commit og kjører sjekkene
på nytt. En foreldet verdi gjelder ikke ny kode. Denne overgangs-PR-en endrer
selve reglene og trenger derfor én slik godkjenning etter dagens gamle regler.
Etter merge slipper vanlige kode-/test-PR-er dette steget.

Som standard kjører planlegger og testkjører fra beskyttet base. Ved en eksplisitt
head-godkjent sikkerhetsoppgradering kan de nye kontrollene prøves i PR-en.
Den uavhengige artefaktkontrollen henter alltid kontrollkode og godkjent referanse
på nytt fra base i en egen runner; den bruker aldri testjobbens redigerte kopier.
Feilet, avbrutt eller hoppet over plan feiler den eksisterende påkrevde testjobben.

## GitHub-beskyttelse og kompromisser

Den offentlige [regelsiden for main](https://github.com/morothon-no/historikk/rules?ref=refs%2Fheads%2Fmain) er kontrollert skrivebeskyttet. Aktivt regelsett **«Morothon – beskytt main»** krever PR og sjekkene **Public package, policy and site build** og **Independent trusted artifact gate**, og sperrer sletting/force-push. Ingen innstillinger er endret. [Kontrollutdrag](maalinger/utviklingsflyt-branchregler.json) dokumenterer observasjonen; bypass-aktører kunne ikke verifiseres i denne visningen.

**Påkrevd antall review-godkjenninger er nå 0.** Menneskelig gjennomgang er derfor en eierstyrt arbeidsrutine før manuell merge, ikke serverhåndhevet uavhengig godkjenning. Dette er den eksisterende enkle PR-flyten vi bruker videre; en ny konto eller rolle opprettes ikke. Hvis flere har skrivetilgang, er minst én uavhengig godkjenning og avvisning av foreldede reviews en anbefalt engangsinnstramming. GitHub lar ikke en forfatter godkjenne sin egen PR.

Main publiseres dessuten bare etter betrodd kildekontroll. Ingen automatisk merge eller ny bypass er innført. Som i A1C må eier gjennomgå endringer i selve workflowen; et repository kan ikke alene gjøre sin egen redigerbare workflow kryptografisk uforanderlig.

Kompromisset er bevisst: vanlige kode-/testendringer får ikke et eget kryptografisk
head-stempel. Meningsfulle assertions og god kode krever faktisk PR-gjennomgang;
CI kan ikke bevise at en omskrevet test fortsatt er god. Sikkerhetsgrenser og
reglene som bestemmer obligatorisk testing har fortsatt særskilt kontroll.
Avhengighetsendringer krever også normal diff-/låsefilgjennomgang og fulle tester.

Publiseringsgarantiene er uendret: eksplisitt offentlig feltskjema, godkjent
manifest, SHA-256, historikk-/dataversjon, avvisning av ukjente/private felt og
ekstrafiler, uavhengig artefaktkontroll og main-gating. Ingen private originaler,
nøkler eller tokens introduseres i PR-jobber. Tidligere offentlig Git-historikk
blir ikke privat av denne prosessendringen; backup og migrering er fortsatt parkert.

## Kontroll av denne endringen

Lokalt kontrollert 13. november 2026, fra `main` etter PR #32 (`5992888`):

- `npm run test:quick`: 27/27 bestått.
- `npm run test:public`: 48/48 bestått, inkludert isolert bygg uten
  administrative originalfiler, 43 profiler og 86 diplomvarianter.
- `node --test tests/quality-v32.cjs`: 7/7 bestått.
- `npm test`: 266/266 bestått, ingen feil eller hoppede tester (458 sekunder).
- `npm run build` og separat `npm run public:kontroll`: 59 godkjente filer,
  43 synlige profiler, dataversjon 1.
- Dokumentlenker, workflow-YAML og diff-kontroll bestått.

Fire nye regresjonstester dekker vanlig utvikling uten SHA-krav, fortsatt vern av
publiseringskommandoer og livssyklushooks, kontroll av ekskludert eksportkode via
Git-tre-ID-er og automatisk opptak av nye offentlige tester. Tidligere tester er
bevart. `data/`, `public-data/`, medaljer, nettsidekode og design er byte-identiske
med utgangspunktet. Dette er lokale resultater; Actions-status for PR-en må
kontrolleres etter opprettelse og den nødvendige overgangsgodkjenningen.
