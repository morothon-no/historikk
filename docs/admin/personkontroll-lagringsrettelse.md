# Personkontroll: privat jobbautorisasjon og tydelige ulagrede valg

Utgangspunkt: main `41697f5f73d30e0dfbc1e0574cb133567f86e2ee`, etter #160.
Dette er en avgrenset rettelse av eksisterende Personkontroll. Ingen nye registre,
rettigheter, lagringsformater eller publiseringsfunksjoner innføres.

## Feilen ved privat lagring

Den aktive private jobben rapporterte `lease HTTP 403` i fasen `worker-lease`.
En slik feil bekrefter ikke lagring. En vellykket Worker-deploy eller anonym
helsekontroll tester ikke at den private prosessoren faktisk kan få en lease.

Workerens OIDC-verifikator manglet den eksisterende Cloudflare-fetch-adapteren.
Henting av offentlige JWKS-signaturnøkler forsøkte dermed `redirect: "error"`.
Cloudflares runtime støtter bare `follow` og `manual`, og kastet før nettverkskallet.
OIDC-kontrollen avviste da korrekt autorisasjonen med HTTP 403. Vanlig Node-fetch
og nettlesertester med simulert OIDC fanget ikke denne runtime-forskjellen.
Begrensningen er også kontrollert separat i lokal workerd fra låst Wrangler
4.164.0, med syntetisk nøkkelkilde og uten nettverkskall til produksjon: `error`
gir TypeError, mens `manual` gir HTTP 200.

En ny test bruker faktisk Worker, RSA-signert syntetisk OIDC, kryptert syntetisk
jobbtilstand og en nettverkssimulator som gjenskaper Cloudflare-begrensningen.
Den gjenskaper HTTP 403 før rettelsen. Etter rettelse av JWKS-kallet avdekket
testen samme problem i de to forbindelsene som utsteder prosessorens GitHub-tokens.
Alle tre kall bruker nå eksisterende `cloudflareGithubFetch`.

Adapteren bruker `manual`; omdirigeringer følges ikke. JWKS-svar med 3xx avvises.
Signatur, issuer, audience, privat repository-ID, workflow-SHA, actor, ref,
runner, jobb-ID, nonce, eier og øvrige kildebindinger kontrolleres som før.
Tokenenes eksisterende rettigheter beholdes. Den nye testen krever reell
lease-kvittering og kryptert jobbrevisjon, og avviser feil claims, signatur,
nonce og omdirigert nøkkelkilde uten videre skriving.

## Arbeidslisten og lagreknappen

Tidligere skjulte bare «Undersøk senere» et lokalt valgt par fra Ubehandlede.
Nå skjules også lokale valg om samme/forskjellige personer, og telleren reduseres.
Valgene finnes fortsatt under «Valg i denne økten» og «Alle saker». Angre fører
paret tilbake til Ubehandlede. Behandlede og Avviste par teller fortsatt bare
serverlagrede avgjørelser; ingen lokale valg omtales som lagret.

Knappen heter **Lagre avgjørelser privat**. Den sender én samlet batch gjennom
eksisterende serverkontroll. HTTP 202 er fortsatt bare en køkvittering.
**Hent lagrede avgjørelser** viser at henting pågår og bekrefter deretter hvilken
privat status som er hentet og hvor mange lokale valg som fortsatt er ulagret.
Henting sender aldri avgjørelser på nytt og bevarer lokale valg og feilhåndtering.

## Regresjon og aktivering

Testene bruker bare syntetiske personer, nøkler og eksterne tjenester.
Nettlesertesten dekker 1440, 768 og 390 px, skjuling av begge avgjørelsestyper,
angre, valgt hovednavn, lesekvittering og fravær av skriving ved henting.
Eksisterende tester av privat lagring, gjenåpning, feilsvar, batchkvitteringer,
resultatimport, publisering og tilbakeføring beholdes. Resultater og eksakt
head-SHA rapporteres i PR-en.

Under den samlede nettleserkontrollen ble også en eksisterende testrace funnet:
testen startet den syntetiske prosessoren etter optimistisk «Lagring pågår», før
POST var mottatt. Testen venter nå på HTTP 202 fra akkurat den innsendingen før
den behandler jobben. Ingen tidsavbrudd økes og ingen sikkerhetskrav fjernes.

Dette endrer ikke den offentlige Pages-pakken, persondata, Heder, diplomer,
medaljer eller policyfiler. Identitets- og årspublisering forblir deaktivert.
Den separate HTTP 503-feilen på gamle offentlige adminruter er ikke løst eller
akseptert her; kravet om 404/410 beholdes.

Rettelsen er ikke aktiv før godkjent merge og samordnet utrulling etter
[aktiveringsveiledningen](koordinert-personkontroll-aktivering.md).
Oppdateringen krever et nytt gjennomgått C/W-sett og ny avlesning av aktiv
Cloudflare-versjon for rollback. Ikke gjenbruk R0 fra før siste deploy som om
den fortsatt var den aktive versjonen. Ingen automatisk merge, pinendring,
deploy, kønullstilling eller ny innsending av ekte avgjørelser inngår.

Etter godkjent aktivering: les privat status først. En tidligere feilet jobb
skal ikke antas lagret eller kjøres på nytt automatisk. Bare eierens uttrykkelige
nye innsending skal starte ny kontroll. Bekreft eksakt privat lagringskvittering,
oppdaterte tellere og samme avgjørelse etter utlogging og ny innlogging.
