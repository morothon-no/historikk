# Produktgrunnmur – én motor, flere arrangører (første leveranse)

Denne leveransen **forbereder** kommersialisering uten å endre Morothons
publiserte historikk, eksisterende adelskalender, adminskjermbilder eller
publiseringsrutine.

## Hva er implementert?

- `scripts/organizers/profile.cjs`: felles, streng JSON-kontrakt for
  arrangøridentitet, konkurranser/kildenavn, tidssone, historiske regelperioder,
  rangeringsgrupper, deltakelsesregler, løypeperioder, merkeregister og
  importformater. Ukjente eller motstridende regler avvises – aldri stille
  tilpasning eller gjetting.
- `organizers/morothon/profile.json`: **Morothon-adapterprofil** som beskriver
  eksisterende kildekonkurranser og valgt rangering etter år, øvelse, distanse
  og kjønn på tvers av aldersklasser. Løypeperiodene før/etter 2014 beskrives
  separat og blir **ikke** tolket som lik trasé basert på kilometer alene.
  Første utgave av profilkontrakten registrerer dagens deltakelsestelling,
  men endrer **ikke** runtime-beregningen.
- `scripts/admin/release-plan.cjs`: et *server-only*, **rent lesende**
  kontrollgrensesnitt. Det henter profil, historikk, kildebinding og
  regeladapter fra en betrodd serverfunksjon, krever verifisert arrangørtilgang,
  stopper ved fremmed arrangør, foreldet historikk, ukjente konkurranser,
  manglende regelperioder eller adapter som ikke støtter arrangørens regler.
  Kontrollerer samlet rettingspakke og avgir en revisjonsbundet
  kontrollkvittering med profil-/pakkehash, påvirkede beregninger og
  eventuelle sperrer.
- `tests/organizer-profiles.cjs`: syntetiske testpersoner og eksempel på en
  **annen** arrangør som rangerer per aldersklasse i stedet for Morothons
  reglement. Også negative tester for manglende tilganger, profilkonflikter,
  historikkhash, overlappende regelperioder og manglende motorstøtte.

## Sikkerhetsgrenser

`reviewPassed: true` betyr **kun at datakonsekvensene ble kontrollert**.
Kvitteringen har alltid `publicationAuthorized: false`,
`readyForPublication: false` og `productionApplied: false`.
Ingen GitHub-innskriving, auto-merge, automatisk korrigering,
`history.json`-migrering, administrasjonsendepunkt eller klientnøkkel
opprettes her.

Profil og regler **må hentes av autorisert backend**; de skal ikke godtas
bare fordi en nettleser sender dem sammen med en kontrollfil. En signert
administratorsesjon med arrangøravgrenset tilgang er en forutsetning.
Det er **ikke** en ferdig autentiserings- eller API-løsning i denne PR-en.

En annen arrangør kan allerede **beskrive** helt andre regler, men den
eksisterende Morothon-beregningsmotoren skal aldri automatisk brukes på et
annet regelsett. Et eksplisitt kompatibelt og testet motor-/publiseringsadapter
må implementeres før en slik kundes historikk kan kontrolleres for publisering.

## Videre utvikling i riktig rekkefølge

1. Koble versjonert arrangørprofil inn i **én avgrenset ren beregning** via
   Morothon-kompatibilitetsadapter, og sammenlign før/etter mot historiske
   referanseverdier. Ikke migrer kundedata automatisk.
2. Utvid til dynamiske distanser, arrangementutgaver og historiske
   rangeringsregler per kunde. En ny kunde skal kunne velge rangeringsgrunnlag
   før første import, inkludert eventuelle klassevise pallplasser.
3. Fullfør privat autentisert lagring for behandlingsbeslutninger og backup
   (C2.4), med **separate data, nøkler og tillatelser per kunde**.
4. Lag én endelig godkjennings- og publiseringsflyt for personrettelser og
   årsresultater med låst profilversjon, kildehash, simulering, uavhengig
   sikkerhetskopi, verifisert GitHub PR, CI og gjenoppretting. Ingen ny
   bekreftelse av hver løper etter at arrangøren har tatt beslutningen.
5. Lag førstegangsveiviser for ny arrangør når import, løyperegler,
   identitet og sikker publisering fungerer fra ende til ende.

**Målet er én vedlikeholdt kodebase, ikke en Morothon-kopi per kunde.**
Én historisk regelversjon skal aldri endres stilltiende fordi arrangøren
bytter innstillinger for et framtidig år.


## Oppstart for nye arrangører

Oppstarten skal ta arrangøren fra importert historikk til en gjennomgått første publisering. Vis hvilke år og kilder som ble importert, og presenter mulige duplikater med navn og tilgjengelige kilder. Vis mer kontekst når den finnes, som år, klubb og deltaker-ID fra samme tidtakingskilde. Navnelikhet gir et forslag til sammenligning. Arrangøren bekrefter identiteten før sammenslåing.

Arrangøren skal kunne lagre vurderinger privat underveis og fortsette mens en tidligere pulje publiseres. Senere importer skal gjenbruke bekreftede aliaser og avviste par. Eksterne oppslag med bare navn skal være tilgjengelige også i vanlig Personkontroll. AI-oppslag skal hjelpe arrangøren å finne og vurdere kilder.
