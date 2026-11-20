# Videreutvikling av Morothon-admin

## Kontrollert utgangspunkt

Gjennomgangen starter på main `c29d1acad0b1ff7dc1088a8e891b2f901a359493`.
Den offentlige Adelskalenderen, Heder, historikk, medaljer og diplomer skal bevares.
Eksisterende lokale utsjekkinger med upushet arbeid er ikke endret.

| Område | Faktisk status ved oppstart | Neste arbeid |
| --- | --- | --- |
| Innlogging | #139 og #149 skjuler ubekreftet admin før første maling; #146 tillater nytt oppstartsforsøk. | Test treg oppstart, gammel lenke, utløpt sesjon og innlogging mot riktig beskyttet side. Live-effekt krever separat godkjent Worker-utrulling. |
| Personkontroll | #141 gir atomisk privat batch, #147 hurtigvalg, sammenligning og 50-valgsgrense. | Lagre også «Undersøk senere» privat, og gjenoppta samme sak etter ny innlogging. |
| Tellere | #148 er åpen på `38934742df4a8ec0c80f91198cafaaa99f711878`. Den retter telling av valg som bare finnes i økten. | Behold den separate PR-en; test at privat oppfølging virker sammen med den. Ingen dobbeltimplementering. |
| Oversikt | #150 er merget og setter seks eksisterende oppgavekort først. | Gjenbruk oppgavene og rutene; ikke lag en ny adminflate. |
| Startliste og resultater | Parser, feltvalg, prognoser, differanser og trygg reimport finnes. Den private resultatlagringen tillater bare rettelser av eksisterende rader. | Koble komplett/delvis eksport og nye årganger til eksisterende kontroll- og publiseringsport; ingen blind sletting av manglende rader. |
| Publisering | Resultatpublisering, etterkontroll og reversering finnes. Identitetskontroll rapporterer fortsatt `productionApplied:false` og `publicationAuthorized:false`. | Egen kontrollert identitetspublisering med serverberegnet før/etter, backup og reversering. Ikke vis en operativ knapp før hele kjeden er testet. |

Relatert: #115, #116, #122, #123 og siste avklaringer i #129. Senere krav om én
samlet innsending erstatter de eldre forslagene om ekstra godkjenning per person.

## Baseline og leveranseporter

På samme main-SHA er [Worker-beskyttelseskontrollen](https://github.com/morothon-no/historikk/actions/runs/44826333756)
grønn, men [Pages-kjøringen](https://github.com/morothon-no/historikk/actions/runs/44826333769)
er rød i **Transitional trusted source regression**. Pages-publisering er hoppet
over. Dette er ulike kontroller; en grønn Worker-kontroll beviser ikke fungerende
eierinnlogging, ny adminversjon eller en fullført privat lagring.

PR #148 og alle nyere PR-er (#149 og #150) er gjennomgått før denne endringen.
GitHub-API-et avviser tilgang i dette arbeidsmiljøet. Offentlige PR-/Actions-sider
kan leses, men detaljerte logger og faktiske private jobber er ikke fjernverifisert.
En lokal, komplett baseline-kjøring brukes til å finne eventuelle eksisterende
testfeil; de skal skilles fra nye regresjoner. Ingen rød test skal overstyres.

## Første leveranse: varig «Undersøk senere»

Dette gjenbruker den eksisterende kommandoen, det krypterte Personkontroll-lageret,
revisjonskontroll og den private prosessorjobben. Ingen parallell saksdatabase,
ny autentisering, ny tjeneste eller nettleserlagring av personopplysninger innføres.

- `kind: "defer"` gjelder nøyaktig to kanoniske profiler, uten hovedprofil eller
  navn. Kilde, begrunnelse og eksakt historikkversjon er påkrevd.
- Et klikk velger bare en handling i økten. **Send endringer samlet** er fortsatt
  eneste innsending. Utsettelse teller med i den eksisterende grensen på 50 valg.
- Serveren lagrer saken som `review`, uten resultat-/identitetsendring. Den vises
  som privat oppfølging etter ny innlogging, med egen teller og eksisterende filter.
- Saken kan senere avgjøres som samme eller forskjellige personer, fra hurtigvalg
  eller detaljsammenligning. Saks-ID, opprinnelige hendelser og tidligere kilde
  bevares. Ny kommando-ID og kontrollsum gjør omforsøk idempotente.
- Klienten kvitterer først når en høyere serverrevisjon inneholder den eksakte
  kommandoens hash i saksloggen. En gammel sak med samme ID er ikke tilstrekkelig.
- Batchen er fortsatt atomisk. Manglende rettighet, kildekonflikt, overlappende
  starter eller én ugyldig beslutning stopper hele lagringen.
- Ved ny historikk kan uendret navne-/aliasgrunnlag bevare oppfølgingen. Endret
  identitetsgrunnlag krever ny vurdering; tidligere sak bevares i kildearkivet.
- Utsettelse er ingen godkjenning, avvisning, sammenslåing eller publisering.
  Uavklarte saker kan ikke passere eksisterende godkjenningskontroll.

## Tester og gjennomgang

```sh
node --test tests/admin-identity-review.cjs tests/serverless-identity.cjs tests/serverless-identity-browser.cjs
node scripts/testing/run.cjs --scope source --level full
npm run test:public
npm run build
```

Testdata for nye flyter er syntetiske. Nettlesertesten bruker ekte gateway,
autentisering, broker, prosessor, konsekvensmotor og kryptert lager, med syntetisk
OAuth/GitHub-transport. Den tester ny innlogging, utsettelse og senere avgjørelse,
angre/endre valg, navnevalg og 390/768/1440 px. Ingen ekte personbeslutning eller
produksjonspublisering er en del av testen.

Kode og tester skal også kontrolleres sammen med PR #148 i et isolert
integrasjonsutkast. Ikke ta inn eller merge #148 automatisk.

## Aktivering og tilbakeføring – krever eierens separate godkjenning

Denne leveransen deployer ikke, endrer ingen secrets og gir ingen tillatelse til
ekte identitets-/resultatendringer. En kode-merge er ikke en Worker-utrulling.

Før aktivering må ferdig gjennomgått kode og CI kontrolleres på eksakt SHA. Den
private workflowens prosessorpin og Workerens kode-/workflowbinding må oppdateres
samlet gjennom eksisterende beskyttede prosess. Les
[manuell utrulling](manuell-worker-utrulling.md); ikke løsne CORE-/OIDC-kontrollene.
Ny Worker med gammel prosessor kan ikke behandle den nye `defer`-kommandoen.

Før en godkjent deploy: registrer aktiv Worker-versjon, gjennomgått rollbackversjon
og eksisterende bindings, avklar aktive jobber og behold gjeldende krypteringsnøkkel.
Ved rollback gjeninnføres sist godkjente Worker-/prosessorkombinasjon, uten å slette
private saker eller revisjonslogger. Sakene bruker eksisterende pakkeformat og
`review`-status og kan fortsatt leses; eldre klient kan mangle gjenopptaksknapp.
Aktive nye kommandoer må avklares før koden rulles tilbake.

Etter separat godkjenning må ekte eierinnlogging, én særskilt godkjent privat test,
serverrevisjon og ny innlogging verifiseres. Dette gir fortsatt ingen tillatelse
til å publisere Martin-/Håkon-avgjørelser eller andre ekte løperdata.
