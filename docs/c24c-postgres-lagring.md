# C2.4 – PostgreSQL som valgfritt privat lagringssted

Mål: arrangøren skal etter hvert kunne behandle løper- og resultatrettelser
direkte i admin uten å laste ned/opplaste JSON. GitHub Pages for Morothon blir
stående uendret til autentisert API og publiseringsflyt er klar.

## Faktisk levert

- `scripts/admin/postgres-review-store.cjs` tilbyr `get(org)` og
  `transact(org,expectedRevision,update)` – **samme adapterkontrakt** som
  dagens krypterte filbaserte `privateFileStore`.
- `scripts/admin/sql/001-organizer-review-workspace.sql` oppretter et
  privat, arrangøravgrenset lagringsområde med unik organisasjons-ID,
  monoton revisjon, kryptert innhold og databasens tidsstempel.
- Ingen kundefølsomme felt sendes i SQL-kolonner: selve korrigeringspakken,
  identitetsforslag, vurderingshistorikk og aktørhendelser er **AES-256-GCM**
  kryptert i en `envelope`, med arrangør-ID som kryptografisk AAD.
- `INSERT ... ON CONFLICT DO NOTHING` og
  `UPDATE ... WHERE revision = expected RETURNING` gjør at to samtidige
  administratorer aldri overskriver hverandres arbeidsgrunnlag uten varsel.
- Nøkkel må komme fra et **eksternt, privat nøkkelhvelv per arrangør** via
  `keyProvider(org)`. Adapteren har ingen innebygde nøkler, innlogging,
  publiseringsfunksjoner eller webendepunkter.
- `tests/postgres-review-store.cjs` bruker en simulert SQL-pool til å
  kontrollere revisjoner, kryptert lagring, arrangørisolasjon, manipulering,
  dupliserte skrivninger og eksisterende C2.4-`createReviewService`.

## Bruksmønster i fremtidig backend

```js
const {postgresReviewStore}=require('./scripts/admin/postgres-review-store.cjs');
const {createReviewService}=require('./scripts/admin/review-workspace.cjs');

const service=createReviewService({
  authenticate: verifySignedSessionOnServer, // ikke data fra nettleseren
  getTrustedBinding: loadApprovedHistoryBinding,
  store: postgresReviewStore({
    pool: privatePostgresPool,
    keyProvider: async organizer => read256BitKeyFromVault(organizer)
  })
});
```

`privatePostgresPool`, `verifySignedSessionOnServer`,
`loadApprovedHistoryBinding` og `read256BitKeyFromVault` er
**integrasjonspunkter, ikke implementerte funksjoner**. Adapteren forventer
et PostgreSQL-klientobjekt med `query(sql, parameters)`, eksempelvis en
Node `pg`-pool. Her legges ingen ny npm-avhengighet eller
databaseforbindelse til den offentlige appen.

## Hva vi ikke har ennå

Det finnes fremdeles **ingen aktiv nett-API**, databaseinstans,
påloggingsløsning, sikker økt/cookie/CSRF-beskyttelse, valg av
leverandør, driftshemmeligheter eller automatisk publisering. Derfor
blir ikke «Lagre arbeidsgrunnlag» på `historikk.morothon.no/admin/`
byttet til serverlagring i denne PR-en.

Før virkelig drift må vi:
1. Velge privat hosting, database og separat, begrenset DB-rolle
   (ikke databaseeier/superuser).
2. Implementere signed sessions og arrangørrolle på **hvert** API-kall.
   Sjekke CSRF, origin, TLS, innholdsstørrelse og rate limits.
3. Planlegge lagringsskjema/backup, restore-øvelse, krypteringsnøkkelrotasjon
   og sletting/retensjon per arrangør. **Nøkkelrotasjon er ikke implementert
   i v1** og må utføres kontrollert mens skriverettigheter er stoppet.
4. Koble admin til sikker `load/save/approve` med lokale utkast som
   fremdeles kan eksporteres som nødløsning.
5. Lage en egen uavhengig kontrollert publiseringsadapter: GitHub først,
   senere statisk webhosting eller kundens egen server.

Det betyr at **hvor arbeidsdata lagres** (privat fil, PostgreSQL, eventuell
annen godkjent adapter) er uavhengig av **hvor Adelskalenderen publiseres**.
Morothon kan fortsatt publiseres på GitHub mens all administrativ lagring
flyttes til en sikker backend – når vi er klare.

## Sikkerhetsgrenser

Dette er en servermodul. Ikke eksponer `postgresReviewStore` direkte i
en nettleser. Databaseadministratoren og driftseier har ansvar for
nettverkstilgang, begrenset databasekonto, kryptert backup, sikker
nøkkelforvaltning og revisjonskontroll. AES-GCM-kryptering beskytter
ikke mot kompromitterte serverprosesser med tilgang til de aktive nøklene.

SQL-migreringen er ikke automatisk aktivert; den må kontrolleres,
godkjennes og kjøres separat i en privat database. GitHub Pages
forblir helt uten skrivekanal.
