# Privat administrasjonslagring og leverandørbytte

Dette beskriver applikasjonens private driftsdata, ikke migrering av de eksisterende
administrative originalregistrene. Ingen virkelige filer eksporteres, flyttes eller
slettes av #90. Kontoer og hosting er ikke aktivert.

## Skilte grensesnitt

| Ansvar | Grensesnitt / adapter | Tilknytning |
| --- | --- | --- |
| Forretning / konsekvenser | Eksisterende `Corrections` og `C2Project` | Ingen driftsleverandør eller innloggingsnøkler |
| Innlogging | `github-auth` → `session-auth` | GitHub først; eksternt `(provider, subject)` peker til stabil intern UUID |
| Autorisasjon / audit | `account-directory`, `access-control` | Intern UUID + arrangør + rolle, aldri vertsnavn eller GitHub-brukernavn |
| Privat utkast-/utbokslagring | `privateFileStore({directory, key})` | Standard Node-filsystem, ingen leverandør-SDK |
| Resultatpublisering | Adapter med `snapshot()`, `submit(job)`, `advance(job)` | GitHub-implementasjon fra #89; ikke blandet inn i resultatmotoren |
| Driftsmiljø | OCI / Node + miljøvariabler | Valgfri ekstern HTTPS-proxy, privat disk og secret-leveranse |

Lagringsadapteren tilbyr bare:

- `get(organizerKey) → record | null`, med integritetskontroll og klonet returverdi.
- `transact(organizerKey, expectedRevision, update) → nextRecord`, atomisk compare-
  and-swap. Kun én oppdatering får forventet revisjon. Konflikt feiler; ingen siste-
  skriver-vinner. Oppdateringsfunksjonen kan ikke leveres som kode av nettleseren.

Et lagret record har formatversjon, revisjon, kildebinding, rettelsespakke, status
og intern audit. Publiseringsutboksen bruker samme adapter, egen undermappe og
stabile jobb-/peker-ID-er. AES-256-GCM bruker en separat 32-byte lagringsnøkkel,
tilfeldig IV og arrangør-/nøkkelbundet AAD (`morothon-c24-v1:<organizerKey>`).
Filnavn og nøkkel-ID-er må bevares. Fysisk katalog/vertsnavn inngår ikke i AAD og
kan endres. Feil key eller tenant avvises, ikke tolkes som tomme data.

Filadapteren krever ekte privat katalog (`0700`), filer (`0600`), ingen symlenker,
atomisk rename, eksklusiv opprettelse for låser og fungerende fsync. Katalogen må
ligge utenfor kode/Git/offentlig bygg. For administrert OCI kreves også faktisk
montert, ikke-RAM-basert lagringsvolum. Linux kan vise et varig bind-volum som
`overlay`; filsystemnavnet alene beviser ikke levetid. Oppstart kontrollerer eget
monteringspunkt, private rettigheter og kryptert skriv/restore. At leverandøren
faktisk bevarer volumet ved omstart/deploy/maskinbytte må i tillegg verifiseres
mot plattformkonfigurasjon og en restore-test. Image-standard er `/data/morothon` under et volum på
`/data`; annen drift kan sette absolutte miljøstier og bruke samme Node-kode.
Kjør én skrivende prosess. Ikke sett filstore på et objektlager eller et filsystem
uten disse garantiene og anta at CAS fortsatt virker.

Eksisterende PostgreSQL-adapter har samme private lagringskontrakt og kan inngå i
en senere kontrollert overgang. En framtidig flerarrangørtjeneste skal løse
brukere/medlemskap og en arrangørspesifikk lagringsadapter ved hvert serverkall.
Frontend får aldri velge tenant eller gi seg selv rolle. Ikke kopier Morothon-data
inn i nye arrangører eller bruk vertsnavnet som person-/arrangør-ID.

## Tre adskilte ting som må bevares

1. **Data:** hele private runtime-katalogen, inkludert krypterte review-filer,
   publiseringsutboks, original-/etterbytes, godkjenninger, kildedigester og audit.
   Ikke bare siste synlige utkast. Ikke ta med appens midlertidige PEM-/browserfiler.
2. **Hemmeligheter:** den nøyaktige lagringsnøkkelen i et separat godkjent
   hemmelighets-/gjenopprettingslager. OAuth-secret og publiserings-App-nøkkel
   konfigureres separat og kan roteres ved flytting. En lagringsnøkkel kan ikke
   roteres ved å generere en ny tilfeldig verdi; gamle krypterte records ville da
   være uleselige. Aldri legg nøkkel og datakopi i samme offentlige pakke/PR/logg.
3. **Konfigurasjon og kode:** stabil intern bruker-UUID, numerisk ekstern identitet,
   arrangør-ID, medlemskap/roller, kode-/bundle-SHA og offentlig godkjenning. Origin,
   callback, proxy, monteringssti og App-installasjon er driftsinnstillinger. Ta vare
   på disse uten å blande hemmeligheter inn i offentlig konfigurasjon.

Leverandørens disk-snapshots er ikke uavhengig backup. Velg og godkjenn separat
backupsted, tilgang, retensjon og separat nøkkeloppbevaring før ekte drift.
Ingen ny backuptjeneste eller historisk datamigrering aktiveres her. Filene er
allerede kryptert, men arkiv og manifest skal likevel håndteres privat; ekstra
arkivkryptering kan benyttes av godkjent backupverktøy.

## Kontrollert eksport og gjenoppretting

Utføres først etter eierens godkjenning av kilde, destinasjon og nøkkelhåndtering:

1. Sett publisering av, vent på pågående kontrollert jobb/drain og stopp skriveren.
   Bekreft at ingen prosess skriver. Ikke kopier aktive låser som om de var data;
   eventuelle låser etter krasj krever kontroll før restore, ikke automatisk sletting.
2. Ta en konsistent privat kopi/arkiv av hele runtime-katalogen. Lag et manifest med
   relative filnavn, SHA-256 og størrelser; kontroller kopien mot alle originalbytes.
   Publiser aldri manifest eller filnavn som offentlige CI-artefakter.
3. Bevar lagringsnøkkel separat og bekreft tilgang til den. Registrer kodeversjon,
   konfigurasjon, interne ID-er og tilhørende offentlige dataversjon.
4. Opprett ny privat disk/katalog hos valgt kompatibel leverandør. Gjenopprett
   nøyaktige krypterte bytes og filnavn, kontroller alle SHA-256 og gjeldende private
   rettigheter/eierskap. Ikke overskriv nyere data hos mottakeren.
5. Lever samme lagringsnøkkel gjennom det nye hemmelighetslageret. Behold interne
   UUID-er, medlemskap og eksterne identitetskoblinger. Oppdater HTTPS-origin og
   registrert OAuth-callback; roter øvrige transport-/driftsnøkler om nødvendig.
6. Start med publisering **av**. Bekreft lesbarhet, revisjoner, kildebinding,
   godkjenninger, audit og utboks. Bekreft gjenåpning etter restart. Aktive nettleser-
   økter overføres ikke; innlogging på nytt er tilsiktet.
7. Hvis offentlig main har nyere kode/data, behold gamle utkast/audit, men gjennomgå
   dem mot ny kilde; ikke marker dem automatisk gyldige. Ikke klon aktive utbokser
   til to skrivende miljøer. Avklar delvis utførte publiseringer før ny aktivering.
8. Godkjenn eventuell ny publiseringsaktivering og kontrollert live-test. Behold
   gammel datakopi og separat nøkkel til restore og eventuell tilbakeføring er
   verifisert. Sletting er en egen godkjent handling.

Regresjonstesten i `tests/admin-managed-deployment.cjs` flytter faktisk krypterte
**syntetiske** records til en annen katalog, åpner dem med samme separat holdte key,
kontrollerer eksakte bytes/audit og avviser feil key. Dette beviser stiuavhengighet,
men erstatter ikke godkjent faktisk restore-test hos ny driftsleverandør.
