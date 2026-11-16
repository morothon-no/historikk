# C2.4 – Privat lagring og kontrollert godkjenning (første del)

## Status

**Arkitektur og testbar privat modul, ikke en aktiv adminfunksjon.** Denne PR-en
oppretter **ikke** innlogging, nye nettendepunkter, GitHub-skrivetilgang,
automatisk publisering eller datamigrering. Den offentlige siden
`historikk.morothon.no` er fortsatt uten innlogging og skrivefunksjoner.

Målet er at arrangøren senere skal kunne lagre personvalg fortløpende uten å
laste ned og laste opp rettingsfiler, og først etter en egen kontroll publisere
det som er godkjent.

## Avgrensning

Modulen `scripts/admin/review-workspace.cjs` ligger utenfor den
godkjente offentlige Pages-pakken og bruker eksisterende
`morothon-corrections-v1` og dataversjonsbinding fra C2.2.

- `createReviewService({authenticate,getTrustedBinding,store})` har bare
  `load`, `save` og `approve`. Den har **ikke** `publish`, `apply` eller
  funksjon for å endre `history.json`.
- `authenticate` er en **obligatorisk serverbasert** funksjon som i en
  senere leveranse må validere signert innlogging/token hos valgt
  identitetsleverandør. Det er ingen fallback til anonym eller selvoppgitt
  identitet. Den **skal aldri** implementeres som «stol på bruker-ID sendt fra
  nettleseren».
- Tilgang sjekkes per arrangør: `review` for visning/utkast og
  `approve` for eksplisitt godkjenning. Serveren henter pålitelig
  kildebinding selv – klienten får ikke velge eldre historikk.
- Hver lagring krever nøyaktig forrige `revision`. Samtidige skrivninger
  stoppes, ikke overskrives. Endret historikkbinding sperrer nye vurderinger
  fram til manuelt avklart migrering.
- `review-approved` er en **serverjournalført behandlingsbeslutning**, ikke
  en tillatelse til publisering. Feltet `handoff` i en opplastet rettingsfil
  gir ingen automatisk autentisert godkjenning.
- En ny lagring annullerer tidligere godkjenning. Audit-hendelser lagres med
  tidspunkt, bekreftet identitet, revisjon og SHA-256 på rettingspakken.

## Privat filadapter (kun for isolert serverdrift)

`privateFileStore({directory,key})` er et første, avgrenset, varig lagringsvalg:

1. Absolutt, separat katalog med rettigheter 0700; utenfor Git-worktree,
   GitHub Pages, offentlige build-filer eller en synkronisert offentlig mappe.
2. En arrangør per separat, kryptert AES-256-GCM-fil med tilfeldig nonce.
   Filrettigheter 0600, arrangørnavn er også en autentisert del av
   krypteringen (AAD). Hemmelig nøkkel må leveres som 32-byte Buffer fra et
   sikkert nøkkelhvelv **utenfor Git og klienten**.
3. Skriveoperasjoner bruker eksklusiv låsefil, kontroll av forrige revisjon,
   midlertidig fil og atomisk rename. Etter en krasj kan en låsefil kreve
   manuell kontroll/fjerning. Den må **ikke** slettes automatisk bare fordi
   den er gammel.
4. Forfalskede, endrede og korrupte filer avvises. De erstattes aldri
   automatisk med et nytt tomt arbeidsgrunnlag.

Dette er **ikke en ferdig driftssatt skytjeneste**. Før faktisk bruk kreves
administrert server-/databasevalg, TLS, brukerautentisering, sikker sesjons-
håndtering, CSRF-beskyttelse, logger uten private data, backup med
gjenopprettingstest, nøkkelhåndtering/rotasjon, rate limiting, oppfølging av
samtykke/personvern og operativ overvåking. Ved flere applikasjonsinstanser
bør filadapteren erstattes med en transaksjonell database.

## Neste leveranse (etter egen vurdering)

1. Velg hvor privat admin-backend skal driftes og hvem som forvalter
   identitet og nøkler. Et eget arrangørrom skal isoleres per kunde.
2. Koble en autentisert API-server til `load/save/approve`, med strenge
   `Origin`/CSRF-kontroller, CSRF-token, autorisasjon **per forespørsel**,
   størrelsesgrenser og eksterne sikkerhetstester. Ingen hemmeligheter til
   GitHub Pages JavaScript.
3. Implementer en eksplisitt, kildekontrollert overlevering til et PR-utkast
   (fortsatt uten automatisk merge). Bruk `verifyCandidate`, fersk
   kildeversjon, publiseringsgodkjenning og eksisterende CI/manifest-regler.
4. Behold manuell JSON-eksport som reserve til lagring, API og
   gjenoppretting er dokumentert og prøvd.

## Testkriterier for denne PR-en

`tests/c24-review-workspace.cjs` bruker **kun syntetiske data** og tester
tilgang per arrangør, avvisning av usignerte/ukjente sesjoner gjennom en
injisert betrodd verifikator, kryptert lagring, reåpning, konflikt/stale
revisjon, foreldet historikk, adskilt `review`/`approve`, audit og
at verken rettingsfilens status eller godkjenningsresultatet skriver til
den offisielle historikken.

Ingen `history.json`, `public-data`, `scripts/build-site.cjs`,
`scripts/lib/runtime-files.cjs`, GitHub Actions, DNS eller tilgangsnøkler
endres i denne PR-en. De ekstra kildekodetestene kjøres også i
`main`-kontrollen etter merge, og publiseringen må være grønn før neste
utviklingssteg.
