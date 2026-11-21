# P1A – årsimport i beskyttet web-admin

Bygger videre på #155 og [årsimportkontrakten](arsimport-kontrakt.md). Dette er
integrasjonen i eksisterende «Årets arrangement → Endelige resultater», ikke en
ny adminside, importmotor eller database. Publisering av årsresultater er sperret.

## Det arrangøren kan gjøre etter godkjent aktivering

1. Laste opp CSV/TSV med eksisterende parser og filoppsett. En entydig årkolonne
   gjenkjennes; ellers velges arrangementsåret. Uklare felt og øvelser avklares i
   dagens importgrensesnitt, uten ny opplasting. Historiske distanser beholdes.
2. Se nye, endrede og uendrede resultater, DNS og konflikter. Søke etter og
   uttrykkelig bekrefte eksisterende løper, eller bekrefte ny profil. Navn alene
   lagrer ingen permanent personkobling. Uavklarte rader kan beholdes i utkastet.
3. Velge **Serverkontroller årsimport**. Privat prosessor beregner planen på nytt
   fra originalbytes og gjeldende godkjente historikk. Et HTTP 202-svar betyr
   bare kølagt jobb, ikke kontrollert eller lagret utkast.
4. Velge **Lagre årsimport privat** etter kontroll. Kilden og valgene lagres
   kryptert med revisjonskontroll og revisjonsspor, uten å endre offentlig historikk.
5. Logge ut/inn og velge **Hent lagret årsimport**. Samme filbytes, arrangementsår,
   feltvalg, personvalg og kontrollplan hentes uten filredigering eller ny opplasting.
6. Reimportere identisk fil uten nye resultater eller ny privat revisjon. En
   korrigert fil viser forskjeller mot privat utkast. Utskifting krever et
   uttrykkelig valg og bevarer forrige kilde/plan kryptert. Manglende rader slettes
   aldri fra historikken; hel erstatning av et offentlig resultatår støttes ikke.

Status skiller mellom ulagrede valg, serverkontrollert, privat lagret og behov for
avklaring. «Klart til videre kontroll» er ingen publiseringsgodkjenning. DNF får
ingen sluttid eller plassering og teller som deltakelse; ordinær DNS oppretter
ingen person eller deltakelse. DNS som motsier dokumentert start krever avklaring.

## Eksisterende serverkjede

`intake.js` gjenbruker dagens parser og personvalg. `web-transport.js` sender
årsimport bare når den autentiserte sesjonen oppgir `annualImportPersistence`.
Tokenet blir i eksisterende transport; filinnhold og personvalg lagres ikke i
localStorage, sessionStorage eller offentlige bygg.

Owner-beskyttede ruter på eksisterende broker:

| Rute | Virkning |
| --- | --- |
| `GET /annual-import` | Privat utkast, kildestatus og siste årsimportjobb. |
| `GET /annual-import?requestId=…` | Eksakt forespørsel og jobb, også etter senere innsendelser. |
| `POST /annual-import/preview` | Kølegger serverberegning, uten å erstatte lagret utkast. |
| `POST /annual-import/save` | Kølegger ny kontroll og CAS-lagring. |

Samme autentisering, eier-ID, Origin-kontroll, ratebegrensning, globale jobbkø,
nonce og pinnede OIDC-/kodeversjoner beholdes. Kun `annual-preview` og
`annual-save` tillates i navnerommet `annual-result-import-v1`. Det finnes ingen
årsimport-rute for godkjenning eller publisering. Disse jobbene får bare lesetilgang
til offentlig repository, med uendret eksisterende tokenpolicy.

To modulavgrensede prefikser bruker eksisterende private GitHub/AES-GCM-adapter:
`annual-imports` for aksepterte utkast og `annual-requests` for forespørsler og
serverkvitteringer. Dette er arbeidsdata i dagens private lager, ikke nye
kanoniske resultat- eller identitetsregistre. Store kildefiler legges ikke i
det eksisterende, mindre kontroll-/jobblageret. Kun de to årsimport-POST-rutene
har inntil 6 MiB HTTP-grense; kildefilen er fortsatt maksimalt 4 MiB. Gamle
rettingsruters 64 KiB-grense og eksisterende krypterte lagringsgrenser beholdes.
Over grensen avvises arbeid uten stille avkorting.

Den private prosessoren bygger og validerer godkjent offentlig snapshot før
kontrollen. Årsimport bruker de godkjente offentlige alias-/Heder-koblingene,
profilen og merkeregisteret; administrative originalregistre leses ikke. En
nettleser-/PDF-prosessor startes ikke for denne rene beregningsjobben. Eksisterende
publiseringsjobbers Chromium-/sandbox-/etterkontroller er uendret.

## Feil og trygg gjenopptakelse

Forespørsels-ID bindes til aktør, handling, eksakt innhold, revisjon og pinnede
kode-/workflowversjoner. Gjentatt innsending gjenbruker samme jobb; annen bruk av
samme ID avvises. Samtidige innsendinger kan ikke overskrive vinnende jobb eller
et nyere utkast. En forespørsel kan ikke påvirke Personkontroll eller gamle
resultatutkast.

HTTP-forespørsler avbrytes etter 20 sekunder. Jobbstatus hentes maksimalt i to
minutter per brukerhandling, med tre sekunders intervall innenfor dagens
API-rategrense. Deretter stopper ventingen med forklaring og **Hent status**.
Ukjent respons innebærer ingen bekreftet ny lagring. En usikker oppstart kan
kontrolleres eller prøves på nytt gjennom dagens task-ruter. Bare ustartede
jobber kan avbrytes; lagret utkast beholdes. Foreldet historikk/revisjon sperrer
ny lagring. Ingen kontroll eller tidsgrense er slått av.

## Aktivering – ikke gjennomført i denne PR-en

Main ved oppstart var `c8ef8db9776c01b4e7bb8b78b2fd0b1cb7ae048a`, som inkluderer
#155. [Pages/source-CI](https://github.com/morothon-no/historikk/actions/runs/44903428591)
og [aktiv Worker-kontroll](https://github.com/morothon-no/historikk/actions/runs/44903428566)
er grønne på denne commiten. Privat main er
`7200efff68d3a5883abdf8610f887da67a0667b7`. Ingen private kilder er hentet eller flyttet.

Eksisterende konfigurasjon peker på prosessorkode
`ff7f99c1e60a951ba5ca6762edb95bff62c0f4d2`, som ikke har årsimport. Kodeleveransen
er derfor ikke en bekreftelse på at funksjonen allerede er aktiv i produksjon.
Etter PR-review og grønn CI kreves separat operatørgodkjenning til å:

1. Velge gjennomgått main-SHA med P1A og oppdatere den private workflowens
   prosessorpin til samme versjon.
2. Kontrollere ny privat workflow-SHA/OIDC-binding og oppdatere Workerens
   `PROCESSOR_CODE_SHA`/`PRIVATE_WORKFLOW_SHA` som ett gjennomgått sett.
3. Bygge nye beskyttede adminressurser og rulle ut Worker manuelt etter
   [eksisterende veiledning](manuell-worker-utrulling.md). De tre eksisterende
   secrets og øvrige rettigheter skal beholdes; ingen nye secrets trengs.
4. Verifisere eierinnlogging og privat utkast mot godkjent testgrunnlag. Avklar
   aktive jobber før pinbytte. Ved feil tilbakeføres gjennomgått kode og assets
   samlet. En tilbakeført privat workflow på main får ny commit-SHA; Workerens
   workflowbinding må samsvare med denne faktiske SHA-en. Bare å gjeninnføre en
   gammel SHA i Worker-konfigurasjonen vil sperre nye leases. Ingen krypterte
   arbeidsdata skal slettes under tilbakeføring.

Ingen DNS, betalt tjeneste, ekte resultat, privat workflow, secret, pin eller
utrulling er endret her. Årsimportpublisering krever fortsatt neste avgrensede
leveranse med gjennomgått før/etter, godkjenning, backup, etterkontroll og reversering.

## Kontroll

Nye syntetiske tester: `tests/serverless-annual-import.cjs` og
`tests/serverless-annual-browser.cjs`. De bruker ekte autentisering, broker,
lease, driver og kryptert lagring mot simulerte eksterne tjenester, inkludert
2027, personvalg, DNS/DNF, reimport, samtidighet, kildeendring, feilsvar,
nettlesertidsavbrudd og ny innlogging. Ingen ekte EQtiming-eksport er brukt i
denne leveransen; formatdekning bygger også på eksisterende parsertester.

`MOROTHON_P1A_REVIEW_DIR=/tmp/morothon-p1a-review node --test tests/serverless-annual-browser.cjs`
regenererer PC-/nettbrett-/mobilbilder på 1440, 768 og 390 px. Bildene er
kontrollert visuelt og holdes utenfor produksjonsgrenen. Ingen egne Heder-tester
eller diplomgallerier trengs for denne endringen.

Offentlig bygg: 59 byteidentiske filer, 43 synlige Heder-profiler, dataversjon 2,
byggversjon `1161be8f67469fef`. Beskyttet admin har samme 15 ressursnavn. Wrangler
4.164.0 dry-run bygger Worker uten utrulling eller lesing/endring av secrets.
Eksakt PR-head, endelig testantall og PR-CI oppgis i leveranserapporten. Main sin
automatiske kildekoderegresjon oppdager de nye testene; dagens avgrensede PR-jobb
kjører bare sin eksisterende allowlist. Lokal betrodd kjøring og faktisk PR-CI
må derfor rapporteres hver for seg. Obligatoriske kontroller er uendret.
