# morothon-corrections-v1

Formatet er en lokal, portabel saks- og forslagspakke. Det er ikke en offentlig
dataeksport, signatur, skriveautorisasjon eller produksjonsutgivelse.
Normativ kode: [intake-model.js](../../tools/diploma-admin/intake-model.js),
`Corrections` / `window.MorothonCorrections`.

## Kontrakt

```text
format: morothon-corrections-v1
version: 1
base:
  dataVersion: positivt heltall fra godkjent offentlig manifest
  manifestSha256: hash av verifiserte manifestbytes
  historySha256: hash av verifiserte history.json-bytes
  snapshotSha256: SHA-256(JSON.stringify(innlest historikk))
cases[]:
  id, category, personIds[], description, source, createdAt
  status: reported | review | proposed | handoff | rejected
  reason
  registration (valgfritt): null eller {selector, before}
    selector: {index, rowSha256, historySha256}
    before: eksakt originalrad som feilmeldingen gjelder
  change: null eller:
    kind: merge | person | alias | result | add | remove | reverse
    personIds[]
    selector: null eller {index, rowSha256, historySha256}
    before, after
    reverses: null eller opprinnelig saks-ID
  events[]: {at, action, reason}
```

Maksimalt 2 MB UTF-8, 500 saker, 500 hendelser per sak, maksimalt 16 nivåer,
strenge felttyper og eksplisitte nøkler. Ukjente felt/versjoner, duplikate saks-ID-er,
prototypefelter, markup og kontrolltegn avvises. Tidsstempler er lokale opplysninger,
ikke verifiserte aktørsignaturer. URL-/kildetekst blir aldri hentet eller kjørt.

Alle endringer er bundet til pakkens dataversjon, manifest og historikkhash.
Resultatvelgeren inneholder en **eksakt indeks i denne versjonen** og hash av
hele kilderaden. Navn+år er ikke en gyldig velger. Interne opprinnelige indekser
bevares ved simulerte fjerninger, slik at senere handlinger ikke treffer en annen
rad etter et indeksforskyvning. Alle forventede førverdier kontrolleres.

Valgfritt `registration` (C2.2b) bevarer originalregistreringen i en innmeldt
feil også før en retting foreslås. Struktur og historikkreferanse valideres ved
lesing; kandidatkontrollen verifiserer eksakt rad, indeks og SHA-256 mot
originalhistorikken, også for saker uten aktiv retting. Motstridende referanser
kan ikke overskrives ved gjentatt import. Eldre pakker uten feltet virker fortsatt;
eldre klienter som ikke kjenner feltet avviser pakken i stedet for å tape data.

- `merge`: eksakte to kanoniske personposter, alias-/redirectkart og dokumentert
  resultattilhørighet før endring. Etter inneholder bare det forventede redirect-
  og aliaskartet. Personposter eller starter slettes ikke.
- `person`: eksakt personpost og aliasliste før/etter. Bare hovednavn/kjønn kan
  endres. Tidligere hovednavn bevares som alias. ID og andre felt er låst.
- `alias`: eksakt aliasliste før/etter for én eksisterende person.
- `result`: eksakt kilderad før og komplett foreslått rad etter. Begge berørte
  kanoniske ID-er registreres ved endret personkobling.
- `add`: før er null, etter er foreslått komplett resultat. Kilde og begrunnelse
  er påkrevd. Identisk eksisterende rad og ukjent arrangementsår avvises.
- `remove`: eksakt registrert rad før, null etter. Simuleres bare eksplisitt;
  ikke-identisk «duplikat» sperrer trygg overlevering til videre kildekontroll.
- `reverse`: refererer en tidligere inkludert originalhandling. Personreferanser,
  førverdier og resultattilhørighet må stemme. Ingen gjetting eller journalsletting.

## API og tillitsgrenser

`binding`, `empty`, `report`, `updateNotes`, `propose`, `transition`, `serialize`, `parse`,
`importPackage`, `discover`, `resultSelector`, `applyCandidate`, `consequences`.

C2.2b har i tillegg `caseType`, `worklist` og `carryDecisions`.
`carryDecisions` erstatter ikke den strenge versjonssperren i `importPackage`:
den kopierer bare tidligere avvisninger med samme personpar og registrerte
identitetsgrunnlag, som separate arbeidsnotater. Aktive endringer,
resultatvelgere og godkjenninger overføres ikke. Øvrige saker telles som
utelatt fra denne overføringen og må beholdes i originalfilen. UI krever en
særskilt bekreftelse. Se [C2.2b](../c22b-enkel-personkontroll.md).

`parse` validerer bare syntaks/kontrakt; den gjør ingen godkjenning. UI bruker
`importPackage`, som avviser konflikt/foreldet base og nedgraderer importert
`handoff` til `proposed`. Like saker gjenbrukes uten stille overskriving. Import
journalføres som uverifisert arbeidsgrunnlag.

`applyCandidate(history, package, expectedBinding, {preview})` er ren og
deterministisk og endrer ikke input. Hash, versjon, førverdier, operasjonstype,
resultatvelger, tillatte personfelt og eksisterende `History.assertValid`
kontrolleres. Standardmodus inkluderer bare lokale `handoff`-forslag.
`preview:true` inkluderer også `proposed`. Resultatet er `{history, journal,
productionApplied:false}`. Dette er **ikke** en autorisert produksjonsfunksjon;
et importert statusfelt kan aldri brukes som tillatelse til faktisk skriving.

`consequences` bruker et betrodd projeksjonskall, aldri kode fra pakken. I
nettleseren kjører `C2Project` de eksisterende motorene i en separat ramme:
`History.stats/placements/participationYears`, `buildIndexes`, `rank`,
`calculateCourseRecords`, `MorothonLoyalty.calculate`,
`MorothonMilestones.calculate` og `MorothonDiplomas.choices/model`.
Alle berørte profiler tas med, også andre løpere som mister en rekord/plassering.
Heder-/diplomavhengigheter som ikke kan verifiseres fra den offentlige pakken,
markeres uavklart og sperrer overlevering.

Konsekvensrapporten er bundet til base, konkret forslag og alle aktive forslag
og kildereferanser i pakken. Endret forslag/sak gjør tidligere rapport foreldet. Endret aktivt rettingsgrunnlag
nedgraderer tidligere lokale overleveringsbeslutninger og krever ny kontroll.
Overlevering krever en ny, komplett rapport uten uavklarte forhold. Prosessen
påstår ingen autentisert godkjenner, formell tildeling eller publisering.

`published` og vilkårlige «anvendt»-kvitteringer inngår ikke i v1. En framtidig
verifisert kvittering må ha egen autorisert kontrakt og forventet ny dataversjon.
Eldre publiserte handlinger må rekonstrueres mot bevarte kilder/revisjoner før
en ny, kontrollert reverseringspakke kan opprettes.

Se [arbeidsflyt, avgrensninger og tester](../c22-rettelser-og-personkontroll.md).
