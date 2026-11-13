# A1D – privat administrasjon, backup og kontrollert migrering

Utgangspunkt: `main 907420e`, merge av A1C/PR #29. Denne leveransen klargjør verktøy og inaktive private driftsmaler. **Ingen reelle personregistre er kopiert til ny lagring, ingen backup av dem er laget, og ingen migrering, tilgangsendring, historikkendring eller Pages-endring er utført.**

Gjeldende rammer: [A1](a1-offentlig-dataeksport.md), [A1B](a1b-privat-migreringsplan.md), [P01–P12](a1b-publiseringsbeslutninger.md) og [A1C](a1c-separat-eksport-og-bygg.md). A1D gjør ingen nye publiseringsvalg. Det tidligere publiserte materialet er fortsatt tilgjengelig gjennom dagens offentlige repository/historikk; et nytt privat repository vil ikke tilbakekalle eksterne kopier.

## Faktisk status og eierens nødvendige valg

| Område | Kontrollert/klargjort | Gjenstår før bruk |
| --- | --- | --- |
| Privat repository | Opprettelse/verifikasjon er automatisert i `repository.cjs`, men forsøket mot GitHub gir **API Forbidden**. Det er ikke bekreftet at repositoryet finnes, er privat eller gir nødvendige rettigheter. | Opprett/verifiser `morothon-no/historikk-admin` som **Private**, uten data. API-tilgang må fungere før verktøyet kan godta destinasjonen. Ingen antakelse om manglende org-rettigheter utledes fra nettverksfeilen. |
| Git-arkivgrunnlag | Read-only-kontroll av kildecheckouten: ikke shallow, `git fsck` bestått, alle **48 annonserte heads/tags/PR-heads** finnes som objekter tilgjengelige fra lokale refs. | Gjenta ved godkjent, frosset migrering. En senere gren/PR kan endre opptellingen. |
| Eksterne kilder | Arbeidsflyten krever godkjent dekningskontroll og støtter egne kilde-/vedleggsmapper i backup. | GitHub Issues, kommentarvedlegg, gamle artefakter, eventuelle LFS-objekter, masterfiler og eksterne kilder må kartlegges/bevares med lovlig tilgang. Git-bundle alene dekker ikke disse. API-blokkeringen gjør at full dekning ikke er verifisert. |
| Kryptert backup | GnuPG, filmanifest, Git-bundle, read-back fra separat lagring og restore er implementert og testet med syntetisk innhold. | Eier må godkjenne uavhengig lagringssted, forvaltere, krypteringsnøkkel/recovery og bevaring. Ingen reell backupdestinasjon er valgt eller kontaktet. |
| Tilganger/regler | Read-only API-inspektør og anbefalte private miljøer/servicekontoavgrensninger er klargjort. | Repo/org-/gren-/miljøregler og faktisk ACL må verifiseres. Ingen andre personer eller kontoer har fått tilgang. |
| Offentlig publisering | Separat privat eksport og ren offentlig forslagsjobb er forberedt. Den offentlige aktive workflowen er uendret. | Installasjon/aktivering i verifisert privat repo og godkjenning av servicekonto/miljøer kreves. Dagens A1C-policy gjelder fortsatt. |

Hvis Codex fortsatt ikke kan opprette repositoryet, er den konkrete GitHub-handlingen: **Opprett et tomt repository `historikk-admin` under `morothon-no`, velg Private, og ikke legg inn data eller gi nye personer tilgang.** Codex kan gjøre resten som tilgangene tillater etterpå; eier skal ikke måtte kopiere registre, kjøre Git-/backupkommandoer eller redigere eksportfiler manuelt.

For å unngå unødvendige manuelle GitHub-steg er det også lagret et **nettverksutkast** for Codex-miljøet: legg til `api.github.com`, med øvrige tillatte domener bevart. Verktøyet bekreftet lagring, men krever gjennomgang/lagring og publisering av **miljøkonfigurasjonen** før aktivering. Dette er ikke en Pages-publisering eller en ny repositorytilgang. API-et må testes på nytt etter aktivering; utkastet i seg selv beviser ikke org-rettigheter eller privat synlighet.

For backup anbefales et organisasjonseid objektlager hos en separat leverandør, med versjonering og avtalt uforanderlig bevaring. Dette er **et forslag**, ingen godkjent destinasjon. Eier må først oppgi/godkjenne leverandør, konto/bucket/prefiks, lagringsregion, ansvarlig/stedfortreder og bevaring. Deretter kan Codex konfigurere og teste med avgrensede rettigheter. Ikke send nøkler eller passord i chat.

Eier har også spurt om lokal lagring for senere nedlasting. **Dette støttes:** en kryptert `morothon-backup.zip` kan klargjøres på et godkjent privat arbeidsområde og lastes ned senere til PC/ekstern disk. Ingen reell fil er opprettet nå. Midlertidig arbeidsmiljø eller GitHub-artefakt regnes ikke som uavhengig backup; filen må lagres varig utenfor disse miljøene, og restore må faktisk prøves fra den nedlastede kopien. Se nedlastingsvarianten nedenfor.

## Verktøy og oppdeling

Alle filer under `scripts/admin/` er generisk infrastruktur uten originalregistre eller innbakte personopplysninger. De inngår ikke i A1Cs runtime-filliste eller offentlige PR-jobbs sparse checkout.

| Fil | Ansvar |
| --- | --- |
| `common.cjs` | Sikre relative stier, separate arbeidsmapper, SHA-256, eksakt commit, godkjenningsbinding og ingen overskriving. |
| `repository.cjs` | Forsøk opprettelse kun ved reell 404; kontroller deretter identitet, `private:true`, `visibility:private` og push-rettighet. 403/nettverksfeil gir stopp, aldri antatt privat synlighet. Tilgangsrapporten viser kontrollstatus/antall, ikke personlister. |
| `source-audit.cjs` | Sammenlign annonserte Git-refs med arkiverbare lokale objekter. Ingen automatisk fetch eller historikkendring. |
| `backup.cjs` | Komplett filsnapshot av angitte kildemapper, Git-bundle med alle lokale refs/HEAD, tilgjengelige LFS-objekter, SHA-256-manifest, OpenPGP-kryptering og faktisk restore-test. |
| `migration.cjs` | Plan med låst kilde-/verktøycommit og filhash; kopier uendrede originalbyte etter verifisert restore, bevar historikkbundle/journal privat, og avvis avvik. Idempotent gjentakelse, aldri automatisk sletting. |
| `publication.cjs` | Kombiner to private originalregistre med tre låste offentlige innganger, kjør A1C-eksport, sammenlign migreringens 43/86, og klargjør bare offentlig pakke/referanse til en data-PR. |
| `operations.cjs` | Utfør operasjoner med separat, eksplisitt eiergodkjenning. Publisering lager en Draft PR; ingen merge/deploykommando finnes. |
| `workflow-config.cjs` | Lag runtimekonfigurasjon i privat runner fra beskyttet konfigurasjon/godkjenning; nekt offentlig repo og featurebranch. |
| `scaffold.cjs` | Generer tom administrativ struktur og avslåtte workflowmaler uten personregistre. |

Det tilføyes ingen npm-avhengigheter. Driftsverktøy krever Node 24, Git, Python 3 og GnuPG. Ekstern backup bruker rclone; LFS krever git-lfs og tilgjengelige, hashvaliderte objekter. Chromium/Playwright brukes ved 43/86-sammenligning fra gjennomgått offentlig kode. Private maler installerer standard backupverktøy automatisk.

## Administrativ struktur

```text
historikk-admin/                  skal verifiseres PRIVATE før dataimport
  data/honors.json                uendrede administrative originaler
  data/volunteers.json
  sources/                       klassifiserte originalvedlegg og kilder
  internal-docs/                 intern dokumentasjon, ikke offentlig eksport
  archive/<source-commit>/history.bundle
  release-journal/               importplan, backupkvittering og bevaringskontroll
  config/                        privat policy og konfigurasjon
  tests/                         private kildekontroller
  toolchain-lock.json            gjennomgått offentlig kodecommit, enabled:false først
  .github/workflows/             bare private, beskyttede driftsløp
```

Tom struktur genereres med `node scripts/admin/scaffold.cjs <ny-tom-mappe> <gjennomgått-40-tegns-commit>`. Det er trygt å forhåndsvise denne lokalt; den inneholder kun mapper, generiske tekster og avslåtte maler. Installasjon/push av ren infrastruktur kan utføres av Codex når repositorytilgang og privat synlighet er verifisert. Ingen persondata skal følge med dette første steget.

Originalene har én privat redigeringsautoritet etter en senere godkjent overgang. Den offentlige løpshistorikken, medaljeregisteret og datoregisteret har fortsatt én **offentlig** redigeringsautoritet. Privat eksport leser nøyaktige, gjennomgåtte versjoner av disse tre; den bruker ikke gamle kopier fra administrative mapper og reeksporterer ikke offentlige Heder-data som originaler.

## Godkjenninger og sikkerhetsgrenser

Runtimekonfigurasjon og godkjenninger lagres **utenfor offentlig checkout**, på privat arbeidsområde. Eksemplene i `ops/admin-templates/` er generiske, ufullstendige og `pending`. De kan ikke brukes til datakopiering slik de står.

Hver operasjon krever `schemaVersion:1`, `status:approved`, navngitt godkjenner, gyldig tidspunkt, riktig operasjon og en eksakt binding:

| Operasjon | Godkjenningen binder |
| --- | --- |
| `backup` | Privat repository, frosset kildecommit, uavhengig lagringsrot, mottakernøkkelens fingerprint, arbeidsrot, ekstra kildemapper og godkjent dekningskontroll. |
| `backup-download` | Samme kilde/nøkkel/dekning, konkret privat arbeidsrot og `remoteRoot:null`. Gir bare en ventende nedlastingskopi, ingen uavhengig backupgodkjenning. |
| `restore` | Repository, konkret kryptert backup-SHA og ny privat restoremappe. Hentes fra backupens godkjente eksterne objekt, ikke bare lokal kopi. |
| `restore-download` | Samme backup-SHA/restoremappe, samt eiergodkjent plassering av den faktisk nedlastede uavhengige kopien. |
| `migrate` | Repository, kildecommit og plan-SHA; planen binder også eksportverktøyets commit og alle importfiler. |
| `export` | Privat kildecommit, offentlig verktøy-/datacommit og datarevisjon. |
| `publish` | Offentlig basecommit, eksternt godkjent manifest-SHA og bestemt forslaggren. Ingen mergefullmakt. |

Godkjenningsfilen er **en sporbar operasjonssperre, ikke digital signering eller tilgangskontroll mot en aktør som kan endre kode og godkjenninger**. Reell sikkerhet krever beskyttet privat main, review, riktige GitHub-miljøregler og begrensede kontoer. En offentlig PR får aldri skrive sin egen private godkjenning. Ingen mal aktiveres før disse serverreglene er verifisert.

Visningsgodkjenning, backup/migreringsgodkjenning og eventuell formell medaljeutdeling er ulike ting. Ingen `awards`, diplomgodkjenninger eller `issuedDiplomas` endres av verktøyene.

## Backup og restore

En godkjent kjøring lager et privat midlertidig snapshot med SHA-256 og størrelse for **hver fil**, samt executable-bit. Hele kildearbeidstreet inkluderes, også usporede/ignorerte filer; `.git` erstattes av full lokal bundle/ref-/HEAD-informasjon og tilgjengelige LFS-objekter. Derfor skal kilden være en kontrollert administrativ checkout, uten innloggingsnøkler eller fremmede arbeidsmapper. Hemmeligheter forvaltes/gjenopprettes separat fra godkjent nøkkellager.

Git-konfigurasjon, hooks, credentials, reflogs og ikke-refererte/danglende objekter er ikke en del av bundleløftet. Bevar nødvendige historiske objekter under godkjente arkivrefs før backup. LFS, branches/PR-heads og eksterne vedlegg må være fullstendig tilgjengelige; manglende Git-dekning, shallow clone, manglende LFS-verktøy/objekt, symlink eller spesialfil stopper i stedet for å utelate innhold stille. Eksterne kildemapper tas med gjennom godkjent `extraRoots`.

GnuPG krypterer ZIP64-snapshotet med AES-256 til en fingerprint-kontrollert offentlig mottakernøkkel. Krypteringsjobben trenger **ikke privat dekrypteringsnøkkel**. Backup lastes opp under sin SHA med rclone `--immutable`, lastes ned igjen og må ha identisk SHA. Kvitteringen krypteres også og lagres som `<backup-SHA>.receipt.gpg` på samme uavhengige lager, med egen read-back. Den forsvinner dermed ikke når en midlertidig GitHub-runner avsluttes. Restore laster ned/dekrypterer kvitteringen og backupen fra lageret og krever den eksternt godkjente `backupSha256` i konfigurasjonen. Separat backupkonto med versjonering/uforanderlighet og begrenset append/read-tilgang må godkjennes; `--immutable` alene hindrer ikke en kontoeier fra å slette objekter.

Restore krever verifisert kryptert SHA, GnuPG-dekryptering, grenser for størrelse/antall ZIP-medlemmer og sikre filstier. Deretter kontrolleres filmanifest, Git-bundle, `fsck`, HEAD, alle refs, LFS og identiske arbeidsfiler. Ekstra kildemapper bevares under `verified/payload/roots/`. Det skrives først et `restore-tested`-bevis når alt består. Korrupte/malformede gjenopprettinger fjernes fra **den nyopprettede restore-mappen**, aldri fra originalkilden.

Standardgrensen ved restore er 20 GiB / 200 000 medlemmer; større arkiver krever gjennomgått ressursgrense. Symlinker/spesialfiler avvises, ikke omskrives. Tomme mapper, ACL-er og OS-eierskap er ikke dataformatets bevaringsgaranti; filbyte, filinventar, executable-bit, Git-objekter/refs og de oppgitte ekstrakildene er det. Dette må kontrolleres mot den virkelige kilden før migrering.

Backupkvittering, manifest og restorebevis skal journalføres privat og sikres sammen med organisasjonens recoveryprosess. En kvittering i et GitHub-workspace er ikke uavhengig backup. Den krypterte filen må finnes på separat godkjent lagring, og gjenoppretting må være praktisk prøvd fra den. Forslag: daglig og før import, versjonert bevaring og kvartalsvis restoreøvelse. Tider/bevaring er ikke vedtatt eller aktivert nå.

### Kryptert nedlasting til PC eller ekstern disk

`backup-download` bruker samme komplette snapshot, Git-bundle, filhash og GnuPG-kryptering, men trenger ikke et rclone-lager. Resultatet er én ZIP med **kun** `backup.gpg`, `receipt.gpg` og generiske gjenopprettingsinstruksjoner. Både registre og kvittering er kryptert; dekrypteringsnøkkel eller plaintextregistre er ikke med i ZIP-en.

I en godkjent lokal/privat kjøring ligger filen i `<workRoot>/morothon-backup.zip`. Den private workflowmalen har også valget `download` og kan beholde akkurat denne ZIP-en som `morothon-encrypted-backup-download` i **14 dager**, bare i det private repositoryet. Last den ned før artefaktet utløper eller arbeidsmiljøet avsluttes. Den faktiske lagringsplassen og separat nøkkelforvaltning må godkjennes før originalregistrene brukes til å lage filen.

```sh
node scripts/admin/operations.cjs backup-download /private-work/config/run.json /private-work/approvals/download.json
# Når den nedlastede ZIP-en er bevart varig og pakket ut på godkjent sted:
node scripts/admin/operations.cjs restore-download /private-work/config/run.json /private-work/approvals/restore-download.json
```

`independentCopyRoot` peker på de utpakkede krypterte filene fra den nedlastede kopien. Kildeplassen må være separat fra originalens arbeidsrot og være godkjent som fysisk/administrativt uavhengig; en annen katalog i samme skymiljø er ikke tilstrekkelig. Filstier alene beviser ikke fysisk uavhengighet. Codex kan kontrollere hash, dekryptere og teste restore når kopien er tilgjengelig med godkjent tilgang, men kan ikke attestere at en nedlasting til eierens PC har skjedd uten faktisk tilgang/bekreftelse.

En vanlig lokal restore får `independentReadBackVerified:false`. Migrering nekter å fortsette med et slikt bevis, selv om filhashene stemmer. Først en vellykket restore fra godkjent ekstern/nedlastet kopi gir uavhengig restorebevis. Originalene beholdes hele tiden. Nøkkelen må ha en separat, organisasjonsforvaltet recoverykopi; den skal ikke være eneste fil i det midlertidige miljøet eller sendes i chat.

## Kontrollert gjennomføring etter nødvendige godkjenninger

Codex eller en senere arrangør kjører samme verktøy fra låst kode; det krever ingen personlig utviklermaskin eller denne chatten:

```sh
node scripts/admin/repository.cjs --create
node scripts/admin/source-audit.cjs /private-work/frozen-source
node scripts/admin/operations.cjs plan /private-work/config/run.json
# Etter separate, konkrete eiergodkjenninger:
node scripts/admin/operations.cjs backup /private-work/config/run.json /private-work/approvals/backup.json
node scripts/admin/operations.cjs restore /private-work/config/run.json /private-work/approvals/restore.json
node scripts/admin/operations.cjs migrate /private-work/config/run.json /private-work/approvals/migrate.json
```

Planen og SHA-er av råregistre skrives bare privat. Migrering krever samme kildecommit og faktisk restore som backupen; hvert importert originalbyte kontrolleres mot både kilde og restore. Eksisterende målinnhold må være identisk, ellers stoppes kjøringen. Historikkbundle, plan og restorebevis bevares i privat arkiv/journal.

Etter kopieringen kjører migreringsoperasjonen også A1C-eksport og bevaringskontroll: alle fem offentlige filer må være byte-identiske, alle **43 profiler og 86 diplomvarianter** må samsvare med A1C-referansen, inkludert dokumenthash, periode, historisk dato og utskriftsmodus. Feil etter privat kopiering lar originalene og den private kopien stå for undersøkelse; det skjer ingen offentlig overgang/publisering. Idempotent omkjøring krever fortsatt samme plan/godkjenning.

Det er bevisst at denne fasen lar alle offentlige originalfiler og Pages-kontroller stå. Privat commit/push av det kontrollerte importsettet kan deretter utføres av Codex etter konkret migreringsgodkjenning og ny privatkontroll. Ordinær publisering bruker bare sanitert pakke. Full bevaring gjelder blant annet Adelskalenderen, Einar med 33 og utdelingsdato 7. november 2026, skjult Erling Danielsen, begge diplomvalg og gjeldende layout-/DPI-/godkjenningssperrer.

Tilbakeføring betyr stopp før offentlig overgang og fortsatt bruk av siste **gjeldende policyvaliderte offentlige pakke**. Kilden er aldri fjernet eller omskrevet. Ikke gjør privat repository offentlig eller legg gamle råregistre i Pages som nødløsning. Eventuell senere offentlig rollback må få en ny, gjennomgått datarevisjon og beholde dagens skjuling.

## Privat automatisering og offentlig data-PR

Malene under `ops/admin-templates/` er **ikke aktive workflows i dette offentlige repositoryet**. De er begrenset til `historikk-admin`, main, `ADMIN_INFRA_ENABLED=true` og beskyttede miljøer. `toolchain-lock.json` må i tillegg være eksplisitt aktivert og låst til en gjennomgått 40-tegns commit. Ingen flyttbar PR-ref, dispatch fra offentlig CI eller offentlig kontrollert kode får privat tilgang.

`private-export.yml` har to separate runners:

1. Privat eksport leser private registre, henter låste offentlige innganger, lager A1C-kandidat og laster bare opp de seks validerte offentlige pakkefilene som et kortlivet **privat** mellomartefakt. Ingen private kilder eller rårapporter følger med.
2. Ren forslagsjobb har `permissions:{}`, sjekker ikke ut privat repo og bruker kun servicecredential avgrenset til det **offentlige** repositoryet. Den laster ned payloaden, krever eksternt godkjent manifest-SHA, validerer på nytt og endrer kun `public-data/` og godkjenningsreferansen. Den pusher en dataarbeidsgren og oppretter Draft PR. Utdatert offentlig main stopper i stedet for å overskrive nyere arbeid.

`private-backup.yml` har valg mellom kryptert nedlasting og godkjent rclone-lager med faktisk read-back. Privatnøkkelen for recovery hører ikke hjemme i denne jobben. Kun det krypterte nedlastingsarkivet kan beholdes som kortlivet privat artefakt; ingen plaintextarkiver, rårapporter eller nøkler lastes opp. Malen har ingen aktivert tidsplan; planlagt drift kan aktiveres etter at første backup og restore er godkjent. Konfigurasjon/godkjenning legges i runnerens private tempmappe, ikke i offentlig Git.

Serviceidentitet anbefales som en organisasjonseid GitHub App eller en avgrenset organisasjonsforvaltet konto/token, med Contents/PR write **kun** til offentlig `historikk`, ingen private repo-rettigheter, ingen Actions-/Variables-/administrasjonsrettigheter og ingen mergefullmakt. Nøkkel/token lagres kun i privat beskyttet miljø. Installasjon/tilgang krever eiergodkjenning og er ikke utført. Malen har et tomt secret-navn; ingen credential er opprettet eller delt.

Dagens A1C-sikkerhet beholdes: offentlig data-PR kan ikke sette sin egen betrodde manifest-/head-godkjenning eller endre publiseringsregler. Den private forslagsjobben får ikke rett til å endre disse GitHub-innstillingene. Etter gjennomgang må eksisterende A1C-godkjenning og påkrevde sjekker oppfylles før eier eventuelt merger. En godkjent eksport er ikke en automatisk merge eller Pages-endring.

## Tilganger, innstillinger og overtakelse

Før privat dataimport må eier/Codex med godkjent tilgang kontrollere:

- Faktisk privat synlighet, riktig organisasjon, orgens standardtilgang, arvede team/eksterne samarbeidspartnere og tilgang fra en uautorisert konto. Private betyr ikke automatisk «bare eier».
- Beskyttet privat main: review uten selv-godkjenning, kontroll av workflows/lock/godkjenninger, ingen forcepush/sletting og riktig begrensning av bypass.
- Miljøene `admin-export`, `admin-backup` og `public-data-proposal`: riktige godkjennere, main-begrensning og separat minimumstilgang til secrets. Begrens repo-forking/Actions og krev MFA der organisasjonen støtter dette.
- Gjenopprettingsansvarlig og stedfortreder, separat key recovery, nøkkelrotasjon, lagringskontoens retensjon/objektlås og regelmessig tilgangsreview.
- SHA-pinning av tredjeparts Actions ved aktivering etter vanlig kode-/leverandørkontroll. Malene bruker kjente versjonsreferanser; de er ikke ferdig produksjonsgodkjent eller slått på.

API-inspektøren forsøker read-only-kontroll av både repo-regler, branch protection, Actions og organisasjon. Utilgjengelige felt rapporteres som **ikke verifisert**, aldri som trygg standard. Ingen foreslåtte rettigheter, personer eller innstillinger er anvendt automatisk.

`ops/admin-templates/settings-plan.example.json` samler det foreslåtte innstillingsgrunnlaget med `apply:false`. Det er en plan, ikke en REST-payload som skal kjøres blindt. Faktiske godkjennere, eventuelle bypasskontoer og org-arvet tilgang må først verifiseres og godkjennes. Codex kan deretter klargjøre/applicere konkrete regler med tilgjengelig API-tilgang etter eierens uttrykkelige godkjenning; eier trenger ikke selv skrive JSON eller konfigurere hver enkelt regel.

Ved overtakelse trenger neste arrangør bare organisasjonens repo-/miljø-/lagringstilgang og denne versjonerte driftsbeskrivelsen. Låste verktøy, genererte planer, backupkvitteringer, restorebevis og eksportjournal skal følge organisasjonen. Ingen hemmeligheter eller driftsavhengigheter skal ligge i chat, personlig laptop eller en utviklers private konto.

## Tester og resterende arbeid

`tests/admin-infrastructure.cjs` bruker kun syntetiske **administrative** registre, eget Git-repository og en midlertidig testnøkkel. Den faktiske GnuPG-rundturen tester SHA, refs, Unicode-stier og executable-bit. Negative tester dekker feil fingerprint, skadet backup, usikre arkivstier/symlink/duplikater/størrelse, manglende refs, uautorisert operasjon, endret mål og gjentatt migrering. Testen for offentlig forslag bruker bare allerede filtrert offentlig pakke, aldri administrative originaler.

Utført lokalt 13. november 2026:

| Kontroll | Resultat |
| --- | --- |
| `npm test` | **247/247 bestått**, ingen hoppet over. |
| Ny infrastruktursuite, også etter siste nedlastingsjustering | **18/18 bestått**. Kryptert payload/kvittering, faktisk syntetisk restore og sperre mot å bruke lokal kopi som uavhengig backup. |
| `npm run test:public` | **9/9 bestått**, uten private registre i offentlig byggekontekst. |
| `npm run build`, `public:kontroll`, `data:check-sources` | Bestått; samme bygg `21e320e9944d5188`, 59 filer, 43 profiler. **Alle 59 produksjonsfiler er byte-identiske** med A1C-kontrollen. |
| Ny eksport-/migreringskontroll | Offentlig fixture uten administrative originaler: alle 43/86 og dokumenthashene stemmer. Syntetiske private originaler eksporteres uten canarynotat, gammel privat historikkfallback brukes ikke, og endret migreringspakke avvises. |
| Statisk kontroll | YAML, shellsyntaks i workflowmalene, JSON, interne dokumentlenker og `git diff --check` bestått. |

Disse resultatene gjelder lokal/syntetisk kontroll og den allerede godkjente offentlige pakken. GitHub Actions i det nye private repositoryet, ekte ekstern backup og faktisk migrering er **ikke kjørt eller attestert**.

Aktive Pages-workflows, offentlig datapakke, originalregistre, medaljer, design, resultater, person-ID-er, P01–P12, A1C-policy og eksisterende tester er uendret. Hele eksisterende regresjonspakke beholdes. Ingen test flyttes/fjernes ved å installere de nye malene.

Før **faktisk** migrering gjenstår privat verifikasjon/ACL, konkret backup-/nøkkelgodkjenning, eksternt kildearkiv, virkelig backup/restore fra uavhengig lager, eiergodkjent importplan og parallell 43/86-kontroll på de bevarte originalene. Før offentlige originalfiler eventuelt fjernes må den eksisterende fulle kildekontrollen dessuten etableres og bestå i privat kontekst. Dette er et eget godkjent overgangssteg; A1Cs main-jobb er ikke fjernet eller erstattet nå.

Tidligere offentlige grener, Git-historikk, Actions-artefakter, Issues og eksterne kopier følges fortsatt opp etter A1B. Ingen sletting eller historikkrensing inngår i A1D-forberedelsene.
