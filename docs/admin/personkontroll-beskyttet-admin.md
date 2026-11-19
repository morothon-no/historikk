# Personkontroll i beskyttet admin – #116 B

Bygger på [del A](personkontroll-varige-beslutninger.md) fra PR #117 og arkitekturen
i #115. Identiteter lagres privat, mens offentlige profiler og resultater forblir
uendret. Ingen automatisk registrering av de bekreftede personparene i #116.

## Brukerflyt

Etter innlogging får eieren **Personkontroll** som eget menyvalg (`#personkontroll`).
Siden henter serverlagrede avgjørelser automatisk, også i en ny nettleserøkt.
Den eksisterende resultatkontrollen beholdes separat, med lenke fra **Årets
arrangement**. Den lokale personforslagsfanen skjules når den private tjenesten
har bekreftet støtte. Arbeidsfiler/import i den gamle kontrollsentralen beholdes;
de er ikke automatisk importert eller godkjent som private identitetsavgjørelser.

1. Søk i ubehandlede forslag, eller finn én/to profiler manuelt med navn/alias.
2. Sammenlign profiler og registrerte deltakelsesår/resultater. Velg hovednavn ved
   sammenslåing, oppgi bekreftelse/kilde og begrunnelse, og bekreft handlingen.
3. **Samme person – lagre privat** eller **Forskjellige personer – lagre privat**
   sender en versjonsbundet kommando til privat kontroll. Navn og alias kan også
   endres uten sammenslåing. Ingen beslutning baseres automatisk på navnetreff.
4. Først etter at prosessoren faktisk har skrevet til det krypterte lageret,
   viser siden **Lagret privat – ikke godkjent eller publisert**. Mislykket
   kontroll gir feil og bevarer tidligere lagrede saker. Ukjent nettverkssvar
   beholdes som uavklart innsending, ikke som «lagret».
5. Behandlede og avviste par fjernes fra **Ubehandlede**, med separate tellere og
   filtre. Forslag som krever avklaring vises separat. Andre personpar skjules ikke.
6. **Vis lagret avgjørelse** viser kilde, begrunnelse, eksakte før-/etterverdier og
   serverberegnede konsekvenser: blant annet deltakelsesår, antall, distanse og
   merker, samt hvilke øvrige beregningsområder som berøres.
7. **Godkjenn lagrede avgjørelser** er en separat eierhandling for eksakt revisjon
   og kontrollsum. Status blir **Godkjent – ikke publisert**. Del B har ingen
   publiseringsknapp eller identitetspublisering. Det kommer i del C.

Visningen bekrefter aldri «publisert» ut fra lokale flagg, en importert pakke eller
en fullført kontrolljobb. Vanlig resultatpublisering beholdes i sin eksisterende
modul. Lagrede identitetsavgjørelser kan leses og godkjennes; endring/tilbakekalling
av en tidligere avgjørelse krever videre kontrollert saksbehandling, ikke en ny
automatisk sammenslåing av samme par.

## Privat lagring og beskyttelse

Samme eierinnlogging, interne bruker-ID, sesjoner, Origin-kontroll, kroppsstørrelse,
rategrenser og private OIDC-jobblease som før. Ingen ny innloggingstjeneste,
hemmelighet eller offentlig skrive-API. Nettleseren har ikke GitHub-skrivetoken,
privat krypteringsnøkkel eller autoritet til å sette godkjenningsstatus.

| API | Kontrakt og effekt |
| --- | --- |
| `GET /identity` | Henter privat revisjon, pakke, audit, eiergodkjenning, arkiv, versjonsbundet konsekvensrapport og egen jobbstatus. |
| `POST /identity/decide` | Kun `expectedRevision`, `command`. Validerer del As kommandoformat; køer `identity-decide`. |
| `POST /identity/check` | Kun `expectedRevision`, `expectedDigest`. Beregner kontrollrapport på nytt, uten å endre beslutninger eller godkjenne dem. |
| `POST /identity/approve` | Samme eksakte revisjon/hash. Krever gjeldende, bestått serverrapport og separat eiergodkjenning. |
| `POST /identity/revalidate` | Samme eksakte revisjon/hash. Eksplisitt eierhandling når offentlig historikk er oppdatert. |

Alle API-ene krever verifisert eier og riktig portal-origin. GET-normalisering uten
Origin er utvidet kun til `/identity`, med samme krav om same-origin Fetch Metadata
og bearer-token. Ingen slik normalisering av POST eller ukjente ruter.

Worker håndterer bare lett kommandovalidering og kølegging. Den rene kontrakten i
`scripts/admin/serverless/identity-command.cjs` deles med identitetstjenesten;
Worker importerer ikke fil-/prosjektormotoren. Filen ligger innenfor det eksisterende
versjonskontrollerte CORE-området, uten endringer i deploy-policyen.

Den eksisterende private prosessoren bruker del As identitetstjeneste med
`githubStore(prefix:identity-reviews)`. Kryptering, privat repository-kontroll,
revisjons-CAS og audit gjenbrukes. Saker blandes ikke med `reviews` for resultater.
Jobbene har `scope:person-control-v1`, og vises kun i riktig modul. Samme globale
kø sperrer mot samtidig kildeendring/resultatpublisering.

Identitetsjobber får kun lesetilgang til offentlig repository gjennom eksisterende
lease-logikk. De oppretter ingen offentlig PR og bruker ikke resultatpublisereren.
Konsekvensrapporten er et avledet, hash-/kildebundet cachefelt i privat `control`,
ikke et nytt identitetsregister. Manglende/feil rapport sperrer godkjenning og kan
gjenopprettes med **Kontroller lagrede avgjørelser**. Den autoritative pakken
forblir i `identity-reviews`.

Ingen personavgjørelser legges i localStorage/sessionStorage. Den eksisterende
engangs-PKCE-flyten er uendret. Uavklart innsending beholdes bare i fanens minne;
jobben og den faktisk lagrede avgjørelsen er på serveren. Ved ny innlogging hentes
disse igjen uten å sende kommandoen en gang til.

## Ny historikkversjon

Foreldede kilder sperrer nye lagringer og godkjenninger. Eieren kan eksplisitt
velge **Kontroller ny historikkversjon**:

- Hele tidligere pakke og godkjenning bevares i det krypterte kildearkivet med
  aktør, dato, førverdier og kildehash. Tidligere audit bevares.
- Bare bekreftede avvisninger med uendret identitetsgrunnlag overføres til aktiv
  pakke. Endrede løpstider alene gjenåpner ikke slike personpar.
- Sammenslåinger og nye relevante navne-/aliasopplysninger må vurderes på nytt.
  Tidligere godkjenning nullstilles; ingen førverdier eller resultatlinjer gjettes.
- Arkivet bevares også ved senere lagring/godkjenning. Eksisterende størrelse- og
  revisjonsgrenser beholdes; overskridelse stopper skriving uten å slette historikk.
- Dersom fanens offentlige datakopi også er gammel, vises **Last inn oppdatert
  historikk**. Klienten kan ikke godkjenne en annen kildeversjon enn den viste.

## Testing

Kjør eksplisitt `node --test tests/admin-identity-review.cjs` og de nye testene:

```sh
node --test tests/serverless-identity.cjs tests/serverless-identity-browser.cjs
```

Nettlesertesten bruker ekte beskyttet HTML-gateway, autentisering, broker, driver,
kryptert lager og eksisterende beregningsmotor. Ekstern GitHub/OAuth-transport og
OIDC-levering er syntetiske. Playwrights fulfilled HTTPS-fixture modellerer Fetch
Metadata fra sin egen frame; produksjonsnormalisering og fiendtlige origins testes
separat. Ingen test gjør nettverkskall til ekte admin, private data eller deploy.

Testen dekker lagring, feilet sammenslåing, etterfølgende avvisning, ny innlogging,
godkjenning, fravær av publiseringskall og bredder 1440/768/390. Valgfrie kontrollbilder
kan regenereres med `MOROTHON_IDENTITY_SCREENSHOT_DIR=/privat/testmappe`; de inneholder
syntetiske personprofiler og inngår ikke i produksjonsbygget eller repositoryet.

Full regresjon kan kjøres i eksisterende, separate fulle nivåer for å unngå det
samlede tolvminutterstaket som del A traff:

```sh
node scripts/testing/run.cjs --level full --scope source
npm run test:public
```

Dette er hele testinventaret, uten endrede tidsgrenser eller hoppede tester.
De nye rottestene oppdages av full betrodd source-regresjon. Dagens fire faste
PR-source-tester inkluderer dem ikke automatisk; grønn PR-CI alene er ikke bevis
på ny identitetsfunksjonalitet. Kjør de eksplisitte testene i betrodd checkout før merge.

## Før manuell aktivering etter gjennomgang

Denne PR-en endrer **ikke** Wrangler-konfigurasjon, eksisterende secrets,
private workflow, DNS, datakilder eller produksjon. Den deployer ingenting.

Den private prosessoren er pinnet til eldre kode. Før funksjonen tas i bruk må en
vedlikeholder gjennom den eksisterende kontrollerte utrullingen:

1. Kontrollere ferdig PR/CI og velge godkjent, merget kodecommit for prosessoren.
2. Oppdatere den private workflowens eksakte kodepin og Workerens `PROCESSOR_CODE_SHA`
   til samme gjennomgåtte kode. Dersom workflow-commiten endres, må også dens nye,
   verifiserte `PRIVATE_WORKFLOW_SHA` brukes. Ikke løsne OIDC-/CORE-kontrollene.
3. Bygge beskyttede admin-assets og rulle ut Worker manuelt med eksisterende
   utrullingsverktøy og særskilt eiergodkjenning. Bevar eksisterende secrets.
4. Verifisere ekte eierinnlogging, én privat lagring, ny innlogging og status.
   Vurderingene i #116 skal bekreftes eksplisitt; de er ikke forhåndsutfylt som lagret.

Dette er ikke tillatelse til å publisere Martin-/Håkon-avgjørelsene eller andre
identitetsendringer offentlig. Del C må først koble inn eksisterende kontrollerte
publiseringsport med E2E, kilde-/eksportkontroll, backup, offentlig profilverifikasjon
og reversering. Ingen automatisk merge eller deploy i del B.
