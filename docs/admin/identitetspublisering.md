# Kontrollert identitetspublisering – fase 3

## Leveranse og avgrensning

Bygger på PR #148, head `468321f3124031cea5fe0561a151288f25f2bee3`, og main
`2c79691819d4aba05f5213e55ed171837ea6a4d1` etter #151/#152. #148 har grønn
[PR-kjøring 44888013120](https://github.com/morothon-no/historikk/actions/runs/44888013120).
Den er fortsatt Draft; forsøk på å gjøre den klar for gjennomgang avvises av
GitHub-API-et med `Forbidden`. Ingen eiergodkjenning eller merge er utledet fra
grønne tester. Denne grenen bygger videre på rettelsen, uten å omskrive den.
Merge #148 først; fase 3 skal deretter gjennomgås separat mot main.

**Identitetspublisering er deaktivert.** `identity-publication-policy.cjs` har
`ENABLED=false`. Broker, OIDC-lease, prosessor og meny kontrollerer aktivering.
En URL, nettleserverdi, forespørsel eller importert pakke kan ikke aktivere den.
Ingen Worker, versjonspin, workflow, hemmelighet eller virkelig løperavgjørelse
er endret. Ekte innlogging og aktiv drift er ikke verifisert fra dette miljøet.

## Kartlegging før endring

| Eksisterende komponent | Bevares | Nødvendig tillegg |
| --- | --- | --- |
| Gateway og innlogging | PKCE, eier-ID, HttpOnly-cookie, Origin, rategrenser og skjult oppstart fra #148 | Tjenesten oppgir om identitetspublisering er aktivert. |
| Personkontroll | Hurtigvalg, sammenligning, hovednavn, privat batch, avvisninger og oppfølging | Serverberegnet publiseringskontroll og separat godkjenning. |
| Privat lager | Kryptert CAS, egne identitets-/resultatregistre og audit | Identitetsjobber får prefiks i eksisterende publiseringslager, ikke en ny database. |
| Resultatimport og rettelser | Samme motor, kontrakter, reimport, DNS/DNF og privat lagring | Gjensidig sperre mellom uavklarte resultat- og identitetspubliseringer. |
| Publiseringsmotor | Backup, byggekontroll, GitHub-PR, branch protection, CI, etterkontroll og retry | En intern identitetsadapter bruker samme outbox og samme fem tillatte filer. |
| Offentlig Adelskalender | Eksisterende navne-/redirect-støtte, resultater og beregninger | Ingen endret offentlig kode eller data før godkjent aktivering/publisering. |
| Heder, merker og diplomer | Originalfiler, offentlige profiler og utskriftsgodkjenninger | Ingen endring. Ingen egne Heder-tester bestilles lokalt. |

Berørte filer er identitetstjenesten, resultatmotorens interne adaptergrense,
release-journalen, GitHub-publisererens navn, profilkontrollen, eksisterende
broker/driver/Worker, beskyttet adminvisning og målrettede tester. Den gamle
resultatveien er fortsatt standard når ingen identitetsadapter gis.

## Arbeidsflyt etter særskilt godkjent aktivering

1. Velg samme person og hovedprofil, forskjellige personer eller undersøk senere.
   Øktens valg er fortsatt ulagrede til en privat, atomisk innsending er bekreftet.
2. **Kontroller før / etter** beregner en kandidat fra gjeldende kilde, eksisterende
   motor og privat lagrede sammenslåinger. Frittstående navn-/aliasrettinger
   publiseres ikke gjennom denne første identitetsleveransen.
3. Sammenlign navn, alias, resultatår, antall, beste tider, plasseringer, lojalitet,
   rekorder og endrede rangeringer. Avvisninger inngår som negative begrensninger;
   oppfølgingssaker publiseres ikke. Konflikter stopper hele kandidaten.
4. **Godkjenn kontrollerte endringer** binder eieren til kandidatens hash, kilde,
   privat revisjon og innhold. Dette er ikke publisering.
5. **Bekreft og publiser identitet** krever ny eksplisitt bekreftelse. Serveren
   beregner kandidaten igjen, verifiserer samme grunnlag, gjenoppretter backupen
   og bygger den faktiske godkjente offentlige pakken før den reserverer jobben.
6. Den eksisterende beskyttede GitHub-publisereren oppretter en data-PR, krever
   påkrevde tester og etterlever branch protection. Påkrevd menneskelig PR-review
   omgås ikke: avslag blir «trenger avklaring». Ingen write-token når nye
   publiseringshandlinger er deaktivert; vanlige personavgjørelser er lesebundne.
7. Først etter riktig deploy, SHA-256 for hele nettstedet og faktiske åpninger av
   de berørte profillenkene settes **Publisert og etterkontrollert**.

En felles privat jobbkø og separate publiseringslåser hindrer at to moduler skriver
samme historikk samtidig. Revisjon/hash, kildeversjon, arrangør og eier kontrolleres
på nytt i den private prosessoren. Nettleserens egne førverdier godtas ikke.
Gjentatt innsending kan ikke opprette en ekstra publisering av samme plan.
Usikkert nettverkssvar beholder låsen og krever eksplisitt videre kontroll.

## Kompatibilitet, oppbevaring og tilbakeføring

- Identitetskommandoen og den private sakspakken beholder eksisterende format.
  Arkiv og publiseringsreferanse er valgfrie tillegg. Den private roten bruker
  fortsatt `draft`/`review-approved`; «publisert» tilhører verifisert outbox-jobb.
- Bekreftede negative par og utsatte saker flyttes til det nye kildegrunnlaget
  etter verifisert publisering. Hele forrige pakke, godkjenning og audit arkiveres
  kryptert. Berørte par knyttes til godkjent kanonisk ID, uten automatisk ny beslutning.
- Kun `redirects`, offentlige alias og nødvendig hovednavn kan endres. Person-ID-er,
  personrekkefølge, rå resultatlinjer, tider, distanser, år, kjønn, stafetter og
  løypehistorikk må være identiske. Antall og rangeringer beregnes av eksisterende motor.
- Samme fem release-filer brukes: kanonisk/offentlig history, offentlig manifest,
  offentlig godkjenningsreferanse og offentlig regresjonsjournal. Ingen private
  saksbeskrivelser, kilder, bruker-ID-er eller godkjenningstekster eksporteres.
- Gammel journal v1 og gamle resultatoppføringers hasher bevares. Først ved en
  fremtidig faktisk identitetspublisering opprettes journal v2 med strenge, eksakte
  identitetsdifferanser. Blandede v1-resultat-/v2-identitetsoppføringer testes helt
  tilbake til samme originale bytes. Ingen eksisterende journalfil er omskrevet.
- **Forbered tilbakeføring** bruker verifisert privat backup og offentlig journal.
  Nyere relevante identitetsendringer, også endring bort og tilbake, stopper
  automatisk tilbakeføring. Senere uavhengige resultatrettelser beholdes. Nyere
  private avgjørelser på berørte personer krever avklaring. Det gjøres aldri blind
  full overskriving av historikken med en gammel backup.
- Tilbakeføring er et nytt, serverbundet utkast som krever ny før/etter-kontroll,
  ny godkjenning, ny publiseringsbekreftelse og samme etterkontroll. Et ulåst
  tilbakeføringsutkast eller en godkjenning kan avbrytes, også ved foreldet kilde,
  uten å slette privat arbeid. En startet publisering kan ikke forkastes slik.

Kandidatrapporten avvises over 96 KiB, før det eksisterende private kontrollagerets
grense. Ingen konsekvenser trunkeres stille. Svært store sammenslåingsutvalg kan
derfor kreve mindre utvalg/videre saksbehandling. Eksisterende lagergrenser gjelder
også arkiv; overskridelse er en feil, ikke anledning til å fjerne historikk.

## Syntetisk før/etter og regresjon

Det nye eksempelet bruker bare oppdiktede testpersoner:

| Profil | Før | Etter eksplisitt godkjent sammenslåing |
| --- | --- | --- |
| Syntetisk Kari Nord | 3 deltakelser, 2020–2022 | Tidligere lenke viser hovedprofilen. |
| Syntetisk Kari N. Nord | 2 deltakelser, 2023–2024 | 5 deltakelser, 2020–2024; valgt hovednavn beholdes. |
| Et annet avvist par | To forskjellige personer | Fortsatt forskjellige, lagret privat etter ny innlogging. |
| En utsatt sak | Uavklart | Fortsatt privat oppfølging, ingen offentlig sammenslåing. |

Alle rå resultatlinjer og deres opprinnelige ID-er er uendret i eksempelet.
Tilbakeføring gjenoppretter original bytes. En separat test publiserer to
sammenslåinger i samme jobb uten å miste negative begrensninger.

Nye tester: `tests/identity-publication.cjs`, `tests/serverless-identity-publication.cjs`,
`tests/identity-publication-browser.cjs` og `tests/public/quick/identity-publications.cjs`.
Eksisterende GitHub-publiserertest utvides med en faktisk lokal Git-gren og fem
tillatte filer. Ingen nettverkstjeneste eller produksjonsdata brukes i disse testene.

Nettlesertesten bruker faktisk gateway, innlogging, privat kryptert lager, motor,
bygg, filhash-verifikasjon og offentlig profilvisning. Ekstern GitHub/OIDC og
driftsutfall er syntetiske. PC/nettbrett/mobil testes på 1440/768/390 px. Den
oppdaget en reell svakhet i etterkontrollen: hash-only navigasjon gjenbrukte
forrige profils dokument. Hver lenke kontrolleres nå i en fersk side, inkludert
kanonisk ID, navn, antall, år, alle resultatlinjer og faktisk renderet profilnavn.
Feilvisning av navn sperrer selv om JSON-data er riktige.

Kontrollbilder kan regenereres uten å publisere ekte data:

- [Før/etter-kontroll på PC](examples/identitet-for-etter-pc.png).
- [Samme kontroll på mobil](examples/identitet-for-etter-mobil.png).

Bildene er fra de faktiske beskyttede adminressursene i den syntetiske testen,
med tjenesten uttrykkelig aktivert bare i testens serverfabrikk. Produksjonsflagget
er fortsatt av. De inngår ikke i Pages-pakken.

```sh
MOROTHON_IDENTITY_SCREENSHOT_DIR=/tmp/identitetskontroll \
  node --test tests/identity-publication-browser.cjs
```

Den endelige PR-rapporten angir eksakt testet SHA, kommando, antall og CI-status.
Full betrodd source-regresjon oppdager de nye rottestene; dagens fire isolerte
PR-source-tester gjør det ikke. En grønn offentlig PR-kjøring alene er derfor
ikke dokumentasjon på de private nettleser-/publiseringstestene. Ingen workflow,
sikkerhetspolicy, testinventar eller obligatorisk gate svekkes.

## Før aktivering

1. Gjennomgå #148 og denne leveransen, og kontroller CI på eksakt godkjent SHA.
2. Godkjenn aktivering separat; kontroller privat workflow-/prosessorkodepin,
   CORE/OIDC-binding og tilbakeføringsversjon gjennom eksisterende deploykontroll.
   Per kartleggingen er privat main `7200efff68d3a5883abdf8610f887da67a0667b7`
   og prosessorpinnen `ff7f99c1e60a951ba5ca6762edb95bff62c0f4d2` fortsatt gamle.
3. Verifiser virkelig eierinnlogging, private CAS-rettigheter, ledig kø, backup,
   GitHub branch protection og valgt testpar før godkjent drift.
4. Godkjenn første ekte sammenslåing særskilt. Ingen virkelige akseptansepar er
   seedet, sammenslått eller publisert av utviklingsarbeidet.

Rollback av kode følger [manuell Worker-utrulling](manuell-worker-utrulling.md).
Etter en fremtidig v2-publisering må en eventuell eldre prosessor også forstå v2;
blokkér nye skrivejobber under rollback i stedet for å fjerne journal eller saker.
Publiserte data tilbakeføres gjennom en ny kontrollert release, ikke git-reset.

Neste funksjonsprioritet etter godkjent identitetspublisering er kontrakt for nye
resultatår, nye løpere og nye registreringer. Disse er ikke implementert her.
