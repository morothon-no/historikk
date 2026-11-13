# A1D – portable backup-, restore- og migreringsverktøy

A1D forbereder sikker behandling av administrative originaler med enkle kommandolinjeverktøy. Kjøringen trenger ikke GitHub Actions, privat GitHub-tilgang, en personlig utviklermaskin eller denne chatten. Grunnlaget er [A1](a1-offentlig-dataeksport.md), [A1B](a1b-privat-migreringsplan.md), [P01–P12](a1b-publiseringsbeslutninger.md) og [A1C](a1c-separat-eksport-og-bygg.md).

**Ingen reell backup eller datamigrering er gjennomført.** `morothon-no/historikk-admin` er opprettet av eier og tilgjengelig som tom lokal checkout. Det er ikke lagt inn filer eller commits der. Andre eksisterende lokale endringer er bevart. Repositoryvalget i miljøet er ikke endret av denne leveransen.

## Avgrensning

- Behold kryptert backup, restore, SHA-256, frosne kilderevisjoner og kontrollert migrering.
- Bruk privat lokal katalog som standard. GitHub er kun en valgfri adapter for senere lagring i det allerede opprettede repositoryet.
- Ingen nye Actions-workflows, servicekontoer, miljøer, tilgangsregler eller automatisk GitHub-publisering inngår. De tidligere forberedte GitHub-malene er tatt ut av A1D.
- Offentlig eksport følger A1C. Den kan valideres og leveres videre, men verktøyene endrer ikke offentlig checkout, pusher ikke data og oppretter ikke publiserings-PR-er automatisk.
- Nettsidekode, historikk, person-ID-er, medaljer, diplomer, P01–P12 og aktiv Pages-publisering er uendret. Offentlige originaler og eldre Git-versjoner er fortsatt tilgjengelige inntil en egen migrering/opprydding er godkjent.

## Hva er ferdig?

| Verktøy | Ansvar |
| --- | --- |
| `scripts/admin/backup.cjs` | Filsnapshot, full lokal Git-bundle/refs/HEAD, tilgjengelige LFS-objekter, SHA-256 per fil, GnuPG-kryptering, nedlastingspakke og faktisk restore-test. |
| `scripts/admin/migration.cjs` | Plan som binder kilde, eksportverktøy, konkret destinasjon og filhash. Idempotent kopiering uten overskriving, med uavhengig restore som krav. |
| `scripts/admin/publication.cjs` | A1C-eksport fra to private originaler og tre offentlige innganger, 43/86-sammenligning og validering av offentlig kandidat mot eksternt godkjent hash. Ingen GitHub-publisering. |
| `scripts/admin/storage.cjs` | Kontroll av privat lokal katalog og separat, valgfri GitHub-adapter. Lokal modus kan ikke brukes som omgåelse for et Git-repository med remote. |
| `scripts/admin/source-audit.cjs` | Lokal Git-integritet uten nettverk. Med eksplisitt `--remote` kan annonserte Git-referanser kontrolleres uten å hente nye originaldata. |
| `scripts/admin/operations.cjs` | Portabel CLI med separate godkjenninger og stopp ved avvik. |
| `scripts/admin/common.cjs` | Sikre filstier, private arbeidsmapper, frosne commits og kontrollsummer. |
| `scripts/admin/repository.cjs` | Valgfri, read-only kontroll av privat GitHub-synlighet/tilgang. Oppretter ikke repo, regler eller brukertilgang. |

Det tilføyes ingen npm- eller Python-avhengigheter. Backup/restore bruker Node.js 24, Git, GnuPG og Python 3s standardbibliotek. rclone er bare nødvendig dersom separat fjernlagring velges. Git-LFS kreves bare ved LFS-kilder. Den bevarte 43/86-kontrollen bruker eksisterende Playwright/Chromium som kvalitetssikring, ikke som backupavhengighet.

Kjøretiden er testet på Linux/POSIX. Kryptert ZIP/OpenPGP kan flyttes mellom systemer; direkte kjøring på andre operativsystemer må verifiseres, særlig katalogrettigheter og systemverktøy. Dette er ikke en påstand om testet Windows-drift.

## Lokal drift og konfigurasjon

Det følger kun to generiske JSON-eksempler under `ops/admin-templates/`: konfigurasjon og en godkjenning med `status:pending`. Ingen nøkler, originalregistre eller reelle godkjenningsjournaler inngår. Konfigurasjonen fylles av ansvarlig forvalter/Codex etter eierens beslutninger; eier trenger ikke skrive skript eller kopiere registre manuelt.

Oppbevar kjøringskonfigurasjon og journaler utenfor offentlig checkout, eksempelvis:

```text
/private-work/
  config/                 konfigurert kjøring og separate godkjenninger
  source/                 frosset kildecheckout
  public-code/            gjennomgått offentlig kode/datapakke
  admin/                  privat lokal originalmappe (0700)
  runtime/run-unique-id/   ny, privat arbeidsmappe utenfor Git
  recovery-gnupg/          separat, godkjent nøkkeltilgang ved restore
```

`storage.type:local-directory` bruker en privat katalog. Den kan versjoneres med lokal Git uten remote; eksport fra denne krever en ren, låst administrativ commit. Runtime-mapper må ha 0700 og være utenfor Git-arbeidstrær. Symlinker og mangelfull Git-metadata avvises. Disse sjekkene erstatter ikke eierens kontroll av vertens tilganger, disk og lagringssted.

Hvis GitHub senere velges, kreves eksplisitt `storage.type:github`, korrekt origin og faktisk API-verifisert privat synlighet/tilgang før persondata kan kopieres dit. Lokal modus nekter å godkjenne en katalog med Git-remote som privat uten hostingkontroll. API-begrensninger blokkerer denne adapteren, men ikke lokal backup/restore.

## Godkjenning før første reelle backup

Følgende må godkjennes konkret før noen administrative originaler brukes til å lage backup:

1. **Kilden:** eksakt commit, ekstra kildemapper og hva som skal bevares av vedlegg, historiske refs, LFS og eksterne kilder. Et Git-bundle dekker ikke automatisk Issues, vedlegg eller gamle Actions-artefakter.
2. **Arbeidsplassen:** konkret privat, midlertidig katalog med tilgangskontroll. Ingen plaintext i offentlig Git, logger eller webrot.
3. **Kryptering/recovery:** kontrollert mottakernøkkel og fingerprint, ansvarlig/stedfortreder og separat organisasjonsforvaltet recoverykopi. Ikke send passord eller privatnøkler i chat og ikke legg dem i repositoryet.
4. **Uavhengig bevaring:** nedlasting til varig PC-/ekstern-disklagring eller et godkjent separat lager, med avtalt bevaring og faktisk restore-test før migrering/fjerning av originaler.

Ingen av disse valgene regnes som godkjent bare fordi A1D-koden godkjennes. Eksempelfilen for godkjenning stopper som den står.

Godkjenningsbindingene i CLI-en er:

| Operasjon | Eksakt binding |
| --- | --- |
| `backup-download` / `backup` | Kildecommit, arbeidsrot, nøkkelfingerprint, ekstra kildemapper, dekningsgodkjenning, valg av remote-kontroll og fjernlagringsrot (`null` ved nedlasting). |
| `restore-download` | Backup-SHA, ny restoremappe og eiergodkjent uavhengig kopi. |
| `restore` | Backup-SHA og restoremappe; kvittering/arkiv hentes fra avtalt fjernlager. |
| `migrate` | Destinasjon, kildecommit og plan-SHA. Planen binder også eksportkode og alle filer. |
| `export` | Destinasjon, administrativ commit, offentlig verktøy-/datacommit og datarevisjon. |

Godkjenninger er sporbare operasjonssperrer, ikke digital signering eller vern mot en administrator som selv kan endre kode og godkjenninger. Eier må godkjenne verts-/lagringstilgang og fysisk uavhengighet. Det registreres ingen medaljetildelinger eller nye diplomgodkjenninger.

## Backup og nedlasting

En backup inneholder alle filer i angitte kildemapper, SHA-256/størrelse/executable-bit, full lokal Git-bundle med refs/HEAD og tilgjengelige LFS-objekter. `.git`-konfigurasjon, credentials, hooks, reflogs og ikke-refererte objekter inngår ikke i bundleløftet. Bevar nødvendige historiske objekter under arkivrefs først. Kjør fra en kontrollert checkout uten innloggingsnøkler eller uvedkommende arbeidsmapper; også ignorerte/usporede filer tas med. Hele kildearbeidstreet og hvert kopiert byte kontrolleres før/etter kopieringen.

GnuPG krypterer snapshot og kvittering med AES-256 til den kontrollerte offentlige mottakernøkkelen. Krypteringsjobben trenger ingen privat dekrypteringsnøkkel. `backup-download` lager én ZIP med bare `backup.gpg`, `receipt.gpg` og generiske restoreinstruksjoner. Ingen plaintextregistre eller recovery-nøkkel følger med ZIP-en.

```sh
node scripts/admin/operations.cjs backup-download /private-work/config/run.json /private-work/config/backup-approval.json
```

Resultatet ligger i `<workRoot>/morothon-backup.zip`. En fil i Codex-miljøet er midlertidig: last den ned før miljøet avsluttes. Først når kopien er lagret uavhengig og restore faktisk er prøvd, kan den brukes som migreringsgrunnlag. Ingen reell backupfil er laget i denne leveransen.

Fjernlagring er et valgfritt alternativ: `backup` bruker rclone med immutable objektnavn, leser den faktiske opplastingen tilbake og kontrollerer SHA. Den krypterte kvitteringen bevares separat på samme godkjente lager. Retensjon, tilgang og eventuell objektlås må godkjennes hos leverandøren; rclone-flagget alene er ikke slettingsbeskyttelse.

## Restore, migrering og videre eksport

```sh
node scripts/admin/source-audit.cjs /private-work/source
# Valgfri, eksplisitt nettverkskontroll av Git-refs:
node scripts/admin/source-audit.cjs /private-work/source --remote
node scripts/admin/operations.cjs plan /private-work/config/run.json
# Først etter de konkrete godkjenningene:
node scripts/admin/operations.cjs restore-download /private-work/config/run.json /private-work/config/restore-approval.json
node scripts/admin/operations.cjs migrate /private-work/config/run.json /private-work/config/migration-approval.json
node scripts/admin/operations.cjs export /private-work/config/run.json /private-work/config/export-approval.json
```

Restore kontrollerer kryptert SHA, dekryptering, sikkert ZIP-inventar/størrelse, alle filhash, refs, Git-bundle, fsck og HEAD. Ekstra kildemapper bevares under restoreområdets `verified/payload/roots/`. Symlinker, spesialfiler, path traversal og avvik stopper. Standard ressursgrense er 20 GiB / 200 000 ZIP-medlemmer. Formatet bevarer filbyte, inventar og executable-bit, ikke tomme mapper, ACL-er eller OS-eierskap.

En vanlig lokal restore gir ikke uavhengig backupbevis. `restore-download` krever en separat eiergodkjent kildeplass for de faktisk nedlastede filene; en ny katalog i samme midlertidige miljø er ikke i seg selv uavhengig. Filstier alene beviser ikke fysisk uavhengighet. `restore` henter fra det godkjente eksterne lageret. Migrering avvises uten bestått uavhengig restore.

Migreringsplanen fryser originalenes filhash, konkrete mål og eksportkode. Kopieringen bevarer originalbyte, historikkbundle og journal privat. Ved omkjøring må eksisterende filer være identiske, ellers stoppes den uten overskriving. Originalene slettes aldri. Før migrering rapporteres ferdig må A1C-eksporten samsvare byte for byte og alle **43 offentlige profiler / 86 diplomvarianter** være uendret, inklusive opptjeningstidspunkter, dokumenthash og utskriftsmodus. Einar/Erling-rettelsene og alle historiske resultater beholdes.

Løpshistorikk, medaljeregister og arrangementsdatoer har fortsatt én offentlig redigeringsautoritet. Eksporten kombinerer de to private originalregistrene med en låst offentlig versjon av disse tre; gamle administrative kopier brukes aldri som fallback. Offentlig kandidat kan kontrolleres med `validate-public` mot en eksternt godkjent manifesthash. Denne kommandoen endrer ikke offentlig checkout, lager ingen Git-gren og pusher ingenting. Eksisterende A1C-validering og Pages-flyt beholdes.

Ved feil etter privat kopiering beholdes kilden og den private kopien til kontroll; ingen offentlig overgang skjer. Tilbakeføring betyr fortsatt bruk av siste gjeldende godkjente offentlige pakke. Ikke publiser gamle råregistre som nødløsning. En senere fjerning av offentlige originaler, endring av Pages eller historikkrensing krever egne godkjenninger og full privat kildekontroll først.

## Leveransekontroll og gjenstående arbeid

Infrastrukturtestene bruker syntetiske administrative registre og midlertidige testnøkler. Offentlige sammenligningsfixturer kommer bare fra den allerede filtrerte A1C-pakken. De dekker faktisk kryptering/restore, skadede arkiver, utrygge stier, kildeendring under kopiering, manglende godkjenning, idempotent migrering, private katalogrettigheter og lokal modus som ikke kan omgå hostingkontroll. Den komplette backup-CLI-en testes med blokkert `gh`/`curl`/`rclone`, uten GitHub-variabler eller tokens.

Gjenstår før reell bruk: eierens godkjenninger ovenfor, recoveryoppsett, virkelig kilde-/vedleggsdekning og en ekte uavhengig backup/restore. GitHub-adapteren er ikke en attest på privat synlighet når API-et er blokkert. `historikk-admin` forblir tomt. Ingen nye tilganger, nøkler eller eksterne lagre er opprettet. Tidligere offentlig eksponering følges opp etter A1B, uten automatisk sletting eller historikkendring.

### Utført leveransekontroll

| Kontroll | Resultat |
| --- | --- |
| `npm test` | **247/247 bestått**, ingen hoppet over. |
| Siste målrettede infrastruktursuite | **18/18 bestått**, med faktisk CLI-kjøring fra en annen arbeidskatalog, uten GitHub-variabler/tokens og med hostingverktøy blokkert. |
| `npm run test:public` | **9/9 bestått**. |
| Bygg, offentlig pakkevalidering og kildekontroll | Bestått. Bygg `21e320e9944d5188`; alle **59 produksjonsfiler byte-identiske** med A1C. |
| Eksport-/migreringsgrunnlag | Alle **43 profiler / 86 diplomvarianter** identiske. Syntetisk eksport utelater private canarynotater, ignorerer gammel privat historikkfallback og avviser endret migreringspakke. |
| Statisk kontroll | Node-syntaks, JSON, interne dokumentlenker og `git diff --check` bestått. Ingen pakke-/lockfil- eller aktive workflowendringer. |

Dette er lokale og syntetiske kontroller, ikke en attest på at ekte kildearkiv, backupdestinasjon, nøkkelforvaltning eller faktisk migrering er godkjent. Privat Git-tilgang fungerer og det tomme repositoryet er kontrollert uten innholdsendringer. GitHub API svarte fortsatt `Forbidden` i tre forsøk med ti sekunders mellomrom; PR-opprettelse via API er derfor en separat tilgangsbegrensning.
