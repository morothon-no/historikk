# #90 – faktisk admin uten egen server: klargjort administrert applikasjon

## Valg etter eierens avklaring

Eieren har ingen Linux-server og ønsker ikke å bestille eller drifte en.
Løsningen er derfor **standard Node.js i en portabel Linux/OCI-container, privat
varig lagring og en HTTPS-origin valgt av eieren**. Ingen leverandør er valgt i
kjernelogikken. Fly.io er kun ett separat, valgfritt og prisbelyst eksempel.
GitHub Pages og `historikk.morothon.no` beholdes urørt. Et leverandørtildelt HTTPS-
vertsnavn kan brukes uten DNS-endring. Hele portalen, GitHub-innloggingen og den
kontrollerte publiseringen fra #86/#89 gjenbrukes.

Dette er ikke aktivert. Ingen Fly-konto, betalingsavtale, app, disk, OAuth-app,
GitHub App, DNS-post eller ekte rettelse er opprettet/endret av denne PR-en.
Det endelige akseptansekriteriet – innlogging og eiergodkjent reell publisering –
kan **ikke** erklæres bestått før godkjent drift og live-test.

| Alternativ | Vurdering for denne leveransen |
| --- | --- |
| GitHub Pages alene | Statisk vert. Kan ikke oppbevare serverhemmeligheter, kjøre eksisterende Node/Chromium eller tilby privat varig lagring. |
| Pages + bare Actions | Egnet til eksisterende kontroll/publisering, men ingen innlogget redigeringsøkt, OAuth-callback eller privat utkast-API. Å erstatte dette krever en ny sikker formidlings-/lagringsflyt. Browser-token med repository-skriving erstatter ikke serverautorisasjon. |
| Serverless funksjon + database + nettlesertjeneste/Actions | Mulig senere, men krever nye adaptere for sessions, kryptert CAS-lagring, bakgrunnsjobber og Chromium. Mer ombygging enn en direkte driftsleveranse. |
| Administrert Node-app med disk | Gjenbruker dagens kode, filstore og nettleserkontroller. Ingen egen database eller ny diplommotor. Fly.io er et mulig eksempel; annen kompatibel plattform kan brukes. |
| Egen Linux-server | Ikke valgt; strider mot eierens premiss. Ingen systemd-/Ubuntu-oppskrift innført. |

#86/#89 inneholder mer enn en enkel statisk redigeringsside fordi publisering må
kunne skilles fra utkast og autentiseres uavhengig av klienten. For én eier kan vi
likevel beholde **én prosess og ett kryptert filvolum**, uten database, innbydelser,
ny rettighetsmodell eller flere workflow-systemer. Den tyngste delen er Chromium:
vi beholder den fordi eksisterende beregninger og kvalitetskontroller faktisk
brukes der. Vi slår ikke av sandbox for å passe en billigere hostingmodell.

## Valgfritt plattformeksempel og dokumentert pris

Leverandørens offisielle dokumentasjonskilde er undersøkt på commit
[`3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8`](https://github.com/superfly/docs/tree/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8).
Direkte docs-domener var sperret fra dette Codex-miljøet; publisert kilde ble lest
fra leverandørens GitHub-repository, ikke fra reklame eller et antatt gratisnivå.

- [Priser](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/about/pricing.mdx) og
  [regional priskalkulator](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/snippets/RegionPricingSelector.jsx):
  2 delte vCPU / 2 GB RAM i Frankfurt er ca. **15,45 USD / 30 dager** ved kontinuerlig
  drift; 1 GB volum **0,15 USD / måned**. Omtrent **15,60 USD** før trafikk/avgifter,
  med mer ved 31 dager. Utgående EU-trafikk oppgis til 0,02 USD/GB. Endelig gjeldende
  tilbud/billing må bekreftes ved godkjenning, ikke tas som et fast pristak.
- Ingen ordinær gratisplan for nye organisasjoner. Dokumentert kort prøveperiode
  er ikke en varig gratis løsning. Ingen database, betalt support, dedikert IPv4
  eller statisk utgående IP er nødvendig her. Første 10 enkeltnavnsertifikater og
  delt IPv4 er oppgitt gratis.
- [Volumer](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/volumes/overview.mdx)
  varer over restart/deploy og krypteres normalt også hos leverandøren. De er lokale,
  ikke automatisk replikerte. Én maskin er et bevisst enkeltoppsett med nedetids- og
  tapsrisiko; daglige leverandørsnapshots er et tillegg, ikke uavhengig backup.
- [TLS](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/security/tls-termination.mdx)
  håndteres av Fly Proxy; trafikk til appen går over leverandørens private nett.
  Bare HTTPS eksponeres for eierens nettleser; HTTP tvinges til HTTPS.
- [VM-egenskaper](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/app-guides/multiple-processes.mdx)
  beskriver egen kjerne for applikasjonsbildet. Det gir et relevant grunnlag for
  vanlig Chromium-sandbox, men **en virkelig Fly-instans er ikke testet/opprettet**.
  Oppstart krever faktisk positiv namespace-/seccomp-kontroll, ikke bare antakelsen.
- [Ansvarsdeling](https://github.com/superfly/docs/blob/3d1319e97b93ed87ecf5629f12a7fb8536b7e3e8/security/shared-responsibility.mdx):
  leverandøren vedlikeholder fysisk vert, virtualisering og TLS. Vi må fortsatt
  oppdatere applikasjonsbildets Node, Chromium og biblioteker via kontrollerte
  kode-/imagebygg. Dette er ikke en vedlikeholdsfri tjeneste, men krever ikke egen
  SSH-, apt- eller Linux-serveradministrasjon fra arrangøren.

Minstekonfigurasjonen er ett bilde, én disk, én prosess og én eier. Autoskalering
og automatisk stopp er avslått: en publiseringsjobb skal ikke stoppes mens CI/deploy
arbeider etter at nettleseren lukkes. Ikke kjør flere uavhengige filstore-kopier.

## Implementert kode

`node scripts/admin/managed-deployment.cjs` har følgende operatørkommandoer:

- `bundle <ny mappe>`: krever rent checkout på eksakt commit; kopierer **kun**
  eksplisitt offentlig godkjente data, godkjente bilder, eksisterende kildekode
  som trengs i drift og driftsmaler. Bygger faktisk nettsted fra kopierte kilder.
  Original `data/`, interne dokumenter, `tests/`, `.git`, nøkler og utkast tas ikke med.
- `check [pakke]`: avviser uvedkommende/manglende filer, endrede SHA-256, symlenker
  og feil offentlig manifest. Avhengigheter installeres fra låsefilen i bildet.
  Hashmanifestet er en integritetskontroll, ikke digital signatur; det må overføres
  fra en kontrollert commit gjennom en betrodd driftskanal.
- `setup <privat mappe> <https-origin> <GitHub-navn>`: slår opp det eksplisitt valgte
  brukernavnets numeriske GitHub-ID, genererer intern UUID og lagringsnøkkel én gang,
  og skriver en `0600`-fil utenfor Git. Skriver aldri nøkkelverdier til logger eller
  returverdi. Nekter å erstatte en tidligere nøkkel eller identitet.
- `serve`: validerer pakke og separat HTTPS-origin, krever reelt montert ikke-RAM-
  volum, kontrollerer namespace-/seccomp-sandbox og prøver kryptert skriv/restore før
  oppstart. Ved aktivert publisering sjekkes også App-tilgang, grønn main, branch
  protection og samsvar med det godkjente datagrunnlaget, **uten** data-/Git-skriving.
- `smoke <https-origin>`: kontrollerer minimal helsesjekk, anonym redirect til
  innlogging og 401 på de private API-ene. Dette er ikke en påstand om bestått
  innlogging, varig rettelse eller virkelig publisering.

Standard nettverksbinding er fortsatt `127.0.0.1`. Bare eksplisitt
`MOROTHON_ADMIN_MANAGED_HTTPS=true` åpner internt app-grensesnitt for en konfigurert
HTTPS-proxy. Sikker innlogging, Host/Origin/CSRF, `Secure`/`HttpOnly`-cookie,
rolle-/kildekontroller og noindex beholdes. Helsesjekken gir bare `ok/unavailable`,
ikke navn, nøkler, diskstier eller dataversjoner. Kontrollert avslutning venter på
pågående publiseringsskriving før nettlesermotoren lukkes.

Docker-oppskriften bruker Debian-basert Node 24, vanlig Chromium med sandbox og
uprivilegert prosess. Ingen `--no-sandbox`, privilegert container eller usikker
reserve. Ny privat undermappe får `0700`; eksisterende eierskap endres ikke stille.
Valgt plattform må montere den private disken før oppstart. Monteringen sjekkes
også ved private operasjoner, publiseringsautorisasjon og helsesjekk; tapt volum
gir stopp, ingen midlertidig reserve. Appens PEM-nøkkel leses fra hemmelighetslager,
materialiseres kun i en privat midlertidig `0600`-fil og fjernes ved kontrollert stopp.
Den sendes ikke til Chromium. `.dockerignore` i repositoryet avviser hele checkout
som byggekontekst. Den genererte pakken har egen filbasert allowlist, slik at et
uhell ikke sender administrative originaler eller en senere tilføyd secret til
fjernbyggeren.

## Få handlinger fra eieren

1. **Godkjenn driftsvalg og kostnad**, opprett/logg inn på en organisasjonseid
   konto hos valgt leverandør og håndter eventuell betalingsbekreftelse. Ingen slik konto eller
   kostnad aktiveres av denne PR-en. Bekreft GitHub-brukernavnet som skal være eier.
2. **Godkjenn GitHub-oppsettet i nettleseren:** én OAuth-app med callback
   `<VALGT-ADMIN-ORIGIN>/auth/github/callback`, og én separat GitHub App
   installert **kun** i `morothon-no/historikk`. Eksisterende kompatible apper kan
   gjenbrukes. OAuth bruker kun `read:user`. Appen trenger Contents, Pull requests,
   Variables og Actions **write**, Checks og Administration **read**, Metadata read.
   Ingen webhook, tilgang til `historikk-admin` eller unntak fra branch protection.
   Behold påkrevde reviews; appen godkjenner ikke sin egen PR.
3. **Legg hemmelighetene direkte i godkjent hemmelighetslager**, eller gi
   driftsansvarlig en avgrenset driftsforbindelse gjennom miljøets secret-mekanisme.
   Ikke send dem i chat, GitHub-issue eller PR. OAuth-secret og Appens PEM-nøkkel
   kommer fra GitHub. Intern UUID og lagringsnøkkel genereres av verktøyet; behold
   separat sikker nøkkelkopi. Ingen terminal eller JSON-redigering kreves av eieren.
4. Når staging, innlogging og gjenåpnet utkast er kontrollert: **godkjenn eksplisitt
   publiseringsaktivering og én konkret dokumentert live-rettelse**. Før det skal
   `MOROTHON_PUBLISH_ENABLED=false` beholdes. Eksisterende riktige resultater skal
   ikke endres bare for å demonstrere funksjonen.

Driftsansvarlig/Codex kan etter godkjenning utføre opprettelse, pakking, overføring,
secret-konfigurasjon, smoke og kontroller. Eieren skal ikke drifte en server eller
installere lokale utviklingsverktøy. Nå mangler godkjent konto/tilgang/legitimasjon
og godkjenning av reell drift; disse kan ikke erstattes av kode eller et PR-flagg.

## Generisk operatøroppskrift etter godkjenning

Kommandoene nedenfor er **ikke kjørt mot en leverandør**. Bruk kontrollert grønn
main etter merge. Arbeidsmappene må være private og utenfor alle Git-arbeidstrær.

```sh
node scripts/admin/managed-deployment.cjs bundle /private/morothon-bundle
node scripts/admin/managed-deployment.cjs setup /private/morothon-config https://ADMIN-HOST BEKREFTET-GITHUB-NAVN
```

Erstatt store plassholdere med valgt HTTPS-vertsnavn og bekreftet brukernavn.
Installer eksisterende låste npm-avhengigheter ved lokale tester. Docker-bygget
installerer dem selv; aldri sett secrets som build args. Oppbevar deploykonfigurasjon
og `owner-secrets.env` utenfor pakken. Ingen privat repositorytilgang kreves.

### Kun dersom Fly.io-eksemplet velges

`scripts/admin/examples/fly-config.cjs <privat mappe> <appnavn>` lager konfigurasjon
fra `deploy/admin-managed/examples/fly/fly.toml.example`. Verktøyet kaller ingen
API-er og inngår ikke i runtime eller containerpakken. Andre leverandører bruker
egen konfigurasjon mot samme bilde, miljøvariabler og lagringsgrensesnitt.

Godkjent operatør oppretter app og 1 GB kryptert volum i Frankfurt, delt IPv4/IPv6,
konfigurerer secret-verdiene fra `secrets.env.example` i leverandørens private
secret-grensesnitt og deployer med `--ha=false --strategy immediate` og den separate
konfigurasjonsfilen. Eksempel på selve deploykallet etter at ressurser og secrets er
kontrollert: `fly deploy /private/morothon-bundle --config /private/morothon-config/fly.toml --ha=false --strategy immediate`.
Ikke deploy hele Git-checkout. Ikke logg secret-filen eller gi token i CLI-argumenter.
Begrens et eventuelt operatør-token til denne appen; ingen hemmeligheter i offentlig CI.

### Kontroll ved alle leverandører

Start med publisering avslått. Kjør `smoke` mot den nye HTTPS-origin. Eieren logger
inn, en annen GitHub-konto skal avvises, og et kildeverifisert utkast skal overleve
utlogging, ny nettleser og kontrollert app-restart med samme volum/nøkler. Kontroller
at HTTP går til HTTPS og at ugyldig Origin/CSRF avvises.

Før publisering aktiveres: bekreft faktisk Chromium-sandbox på valgt plattform,
branch protection / eksisterende fire PR-gates, grønn main, App-rettigheter,
privat volum og separat nøkkel-/backupgjenoppretting. Publiseringsnøkkelen gir
betydelig repository-/godkjenningsmakt og skal behandles som en administratornøkkel.
Ingen data eller nye mottakere skal gis tilgang automatisk. Volum-snapshot alene
er ikke uavhengig backup. Ingen ny backuptjeneste er bestilt eller tidligere
parkerte originalregistre flyttet.

Etter separat eiergodkjenning av aktivering: deploy samme kontrollerte kode med
`MOROTHON_PUBLISH_ENABLED=true`, behold key/UUID, kontroller før/etter, godkjenn og
publiser den eksplisitt avtalte rettelsen. Verifiser data-PR, alle CI-gates, Pages,
offentlig profil, rangeringer/statistikk og audit/tilbakeføringsutkast. **Identitets-
sammenslåing støttes ikke av denne adapteren**, kun eksisterende resultatlinjer.

Den gamle `/admin/`-adressen på GitHub Pages er fortsatt offentlig testvisning.
Den innloggede portalen brukes på den nye, separate lenken. Ingen uautorisert
redirect eller aktivering legges på den offentlige siden.

## Tester, grenser og flytting senere

`node --test tests/admin-managed-deployment.cjs` tester pakken med syntetiske
private sentineler, filallowlist/hash, symlenker, stabil nøkkel/UUID, varig disk,
sandbox-/restore-stopp, secret-opprydding, privat konfigurasjon og HTTPS-smoke.
Eksisterende #86/#89-nettlesertester kjører hele isolerte rettelsesflyten med
allerede bekreftet Morothon-rettelse og simulert OAuth/GitHub-transport.
Komplett betrodd `npm test`, offentlig bygg og artefaktvalidering skal bestå.
Testantall, eksakt head og faktiske containerkontroller rapporteres i PR-en.
[Valgfri lokal Docker-kontroll](../deploy/admin-managed/examples/docker/README.md)
beskriver ytre namespace-profil; Chromium-sandbox forblir påslått.
En mock er ikke dokumentasjon på reell plattformlagring eller GitHub-innlogging.

Etter plattformvalg kreves fortsatt virkelig staging-akseptanse og eiergodkjent
live-test; ingen automatisk sikkerhetsomgåelse ved manglende sandbox. Ved feil
holdes appen utilgjengelig. Root-/disksnapshots kan ikke erstatte denne testen.

Kjernelogikken har ingen Fly-SDK, Fly-vertsnavn eller leverandør-ID i brukere/resultater.
[Det private lagringsgrensesnittet og flyttbar backup/restore](admin-storage-contract.md)
beskriver hvordan data, nøkler og konfigurasjon bevares separat. OCI-bildet,
kryptert filstore, stabil UUID, separat key og standard HTTPS/OAuth kan flyttes til
annen kompatibel administrert plattform. Ny callback/origin og verifisert privat
volum kreves da; persondata eller eksterne identiteter skal ikke migreres til nye
brukere. Ta og test kontrollert backup før flytting, ikke slett originaler.
