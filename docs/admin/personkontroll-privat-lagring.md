# Privat personkontroll og offentlig publisering

## Påvist stoppunkt

Privat kjøring `45070640724` etter Worker-utrulling #26 stoppet med:

```text
Privat prosessorkontroll: GITHUB_HTTP_404
Privat prosessorfase: public-snapshot/main-protection
```

Dette gjelder `GET /repos/morothon-no/historikk/branches/main/protection`.
HTTP 404 alene avgjør ikke om klassisk grenbeskyttelse mangler, om regler
håndteres med rulesets eller om tilgangen avvises. Ingen av disse forholdene
endres eller antas av denne rettelsen.

Feilen i lagringsflyten er at `processor.cjs` alltid opprettet et fullstendig
publiseringssnapshot før noen privat avgjørelse kunne lagres. Dermed kunne en
kontroll som er nødvendig før offentlig skriving også blokkere en privat,
kryptert avvisning av et personpar. Lagringen var ikke bekreftet.

## Avgrenset endring

Kun de fem eksisterende private identitetshandlingene bruker nå en separat
lesemetode i den eksisterende GitHub-adapteren:

- `identity-decide`
- `identity-batch`
- `identity-check`
- `identity-revalidate`
- `identity-approve`

Valget krever både eksakt handling og modulen `person-control-v1`. Det kan ikke
velges med en nettleserparameter eller ved å tolke et HTTP-avslag som tillatelse.
Ukjente handlinger, andre moduler, resultatimport og publiseringshandlinger får
ikke denne flyten. Eksisterende driverkontroll av eier, modul og kodeversjon
beholdes.

`readApprovedSource()` krever eksakt kildebinding og siste grønne push-kjøring
på main. Den leser bare de fem godkjente offentlige JSON-filene, manifestet og
godkjenningsfilen fra samme immutable commit. Byggerens eksisterende validering
kontrollerer felter, kontrollsummer og datapakke før identitetsmotoren brukes.
Metoden har ingen mulighet til å skru av kravet om grønn main.

Disse jobbene får offentlig token med bare `contents: read` og `actions: read`.
De får ingen rettighet til offentlig filskriving, PR-opprettelse, sjekker,
administrasjon eller godkjenningsvariabler. Privat token beholder avgrenset
Contents write i det kontrollerte private repoet. Ingen apprettigheter eller
secrets endres.

Et kontrollgrunnlag med bare avvisninger og utsettelser starter ikke Chromium.
Når konsekvensmotoren trenger en projeksjon for en positiv identitetsendring,
opprettes den eksisterende nettleseren ved behov. Sandbox må fortsatt bekreftes
før første projeksjon. Et sandbox-avslag kan ikke godkjenne eller lagre en ny
positiv avgjørelse. Eksisterende publiseringsflyter beholder sine kontroller.

## Bevarte sperrer

Autentisering, owner-rolle, OIDC, eksakt privat workflow-/kodepinne, engangsnonce,
arrangørbinding, kildehash, kommandoformat, idempotens, revisjoner, kryptering,
revisjonsspor og publiseringslås beholdes. Ingen eksisterende avgjørelser flyttes,
nullstilles eller sendes inn på nytt automatisk.

Publiseringsadapterens `snapshot()`, `submit()` og `advance()` beholder kontroll
av grenbeskyttelse. Det er ingen HTTP 404-fallback eller generell «skip policy».
Strict/up-to-date, håndheving for administratorer, PR-review, alle obligatoriske
kontroller og fravær av app-bypass kreves fortsatt før offentlig skriving og
merge. Backup, godkjenning, CI, etterkontroll og tilbakeføring beholdes.

**Offentlig publisering forblir blokkert når grenbeskyttelsen ikke kan
verifiseres. Denne leveransen gjelder privat Personkontroll, ikke aktivering av
publisering eller støtte for rulesets.** Identitets- og årspublisering er fortsatt
deaktivert i gjeldende produksjonspolicy.

## Regresjonsbevis og utrulling

En test kjører den faktiske private prosessoren med syntetiske data gjennom
godkjent kildepakke, kryptografisk CAS-lagring, ferdig jobb, ny innlogging og
gjenåpning av samme avviste par. GitHub-fixturen gir fortsatt HTTP 404 for
grenbeskyttelse. Gammel kode stopper med samme 404 som produksjon; ny kode lagrer
den private avgjørelsen uten å kontakte publiseringsendepunktene eller skrive
offentlig. Testen kontrollerer også positiv identitetsberegning med både
godkjent og avvist nettlesersandbox.

Separate tester viser at det samme 404-avslaget fortsatt stopper alle tre
publiseringsmetodene, og at endret kildekode eller rød main stopper også privat
lagring. Tokenrettigheter og eksakt handling/modul testes gjennom faktisk Worker.

Offentlig nettside, data, Heder, diplomer og design endres ikke. Ingen ny
infrastruktur eller lagringsmotor innføres. Etter gjennomgang kreves vanlig
samordnet prosessor-/workflow-/Worker-aktivering med et ferskt tilbakeføringspunkt.
Ingen ekte avgjørelse sendes fra utviklingsmiljøet. Først serverkvittering med
høyere privat revisjon og gjenåpning etter ny innlogging verifiserer driften.
