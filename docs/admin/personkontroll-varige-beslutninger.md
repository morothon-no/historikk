# Personkontroll – privat datamodell og lagring (#116 A)

Første del av #116, etter arkitekturen i #115. Dette er serverbibliotek og
syntetiske tester, **ikke en utrulling av Personkontroll i nettportalen**.
Offentlige kilder, manifest, identiteter, resultater og visning endres ikke.

## Hvorfor tidligere avgjørelser ikke ble lagret

| Lag | Dagens ansvar og begrensning |
| --- | --- |
| `tools/diploma-admin/intake-model.js`, `Corrections` | Har allerede sammenslåing, hovedprofil, alias, før-/etterverdier, avvisning, kildebinding og konsekvensanalyse. Lokal `handoff` betyr klargjort, ikke autentisert godkjenning. |
| `tools/diploma-admin/intake.js` og review-klienten | Har lokal arbeidsliste og pakkeoverføring. En lokal personavgjørelse beviser verken privat lagring eller offentlig publisering. |
| `scripts/admin/result-review.cjs` | Privat lagring/godkjenning av **resultatendringer**. Avviser andre endringstyper eksplisitt. |
| `scripts/admin/serverless/broker.cjs` og `driver.cjs` | Den eksisterende beskyttede `/review/save`- og prosessorflyten er også resultatavgrenset. Identitetsendringer skal ikke smugles inn her. |
| `review-workspace.cjs` og eksisterende krypterte adaptere | Har allerede autentisert aktør, revisjonskontroll, kryptering, godkjenning og audit. Gjenbrukes; ingen ny database eller innloggingsløsning. |
| `result-publication.cjs` og offentlig eksport | Eksisterende kontrollerte publiseringsgrense. Utvides ikke i A. Ingen skriving til generert offentlig JSON. |

Derfor kan en lokal «samme person»/«forskjellige personer» være behandlet i
nettleseren uten å finnes i den private, serverlagrede arbeidslisten. Eksisterende
faner eller nedlastede arbeidsgrunnlag må bevares til senere kontrollert import.
Denne leveransen leser ikke ukjent nettleserinnhold og antar ikke at noen tidligere
avgjørelse er lagret.

## Én kontrakt, adskilte modulansvar

`scripts/admin/identity-review.cjs` tilbyr `load`, `preview`, `decide` og `approve`.
Alle krever arrangør-ID og serververifisert sesjon gjennom eksisterende
autentiserings-/autorisasjonsgrense. Interne bruker-ID-er brukes i audit.
Eier/redaktør kan lagre; bare eier kan godkjenne. Leser kan kun hente.

Personkontroll behandler identiteter. Resultatimport, reimport, tid, plassering,
øvelse, distanse og resultatstatus hører til **Årets arrangement** og avvises av
identitetskontrakten. Ingen nye parallelle resultat- eller identitetsregistre.

Den versjonerte kommandoen uttrykker bare hensikt. Eksempel med fiktive ID-er:

```json
{
  "format": "morothon-identity-decision-v1",
  "version": 1,
  "id": "synthetic-decision",
  "base": {
    "dataVersion": 1,
    "manifestSha256": "<64 hextegn>",
    "historySha256": "<64 hextegn>",
    "snapshotSha256": "<64 hextegn>"
  },
  "kind": "same-person",
  "personIds": ["MOR-SYNTHETIC-A", "MOR-SYNTHETIC-B"],
  "mainPersonId": "MOR-SYNTHETIC-B",
  "name": null,
  "source": "Syntetisk kilde",
  "reason": "Syntetisk arrangørbekreftelse."
}
```

Alle feltene kreves; ukjente felter avvises. `base` må være en gyldig, eksakt
kildebinding, ikke plassholderne ovenfor. `expectedRevision`, `session`, `organizer`
og `command` er tjenestekallets omslag. Aktør, førverdier, beslutningsstatus,
konsekvensrapport og godkjenning bestemmes på serveren, ikke av kommandoen.

| `kind` | Betydning og lagring i eksisterende Corrections-pakke |
| --- | --- |
| `same-person` | To kanoniske ID-er. Valgt `mainPersonId` blir målprofil, med sitt eksisterende navn. `merge` bevarer resultatrader, kildenavn, alias og gamle lenker via redirects. |
| `different-people` | To stabile ID-er, `mainPersonId`/`name` er `null`. Avvist identitetsforslag med eksplisitt `identity-different-people`-hendelse. Ingen datamutasjon. |
| `rename` | Én kanonisk ID, nytt `name`, `mainPersonId:null`. `person`-endring; tidligere hovednavn blir alias. Ingen sammenslåing. |
| `alias` | Én kanonisk ID, nytt alias i `name`, `mainPersonId:null`. Eksisterende alias beholdes. |

Ingen metode mottar en importert rettingspakke som autentisert godkjenning.
Konsekvenser beregnes igjen med eksisterende motor; klienten kan ikke levere
troverdige førverdier, `handoff` eller publiseringsflagg. Motstridende identiteter
og kollisjoner i samme år/øvelse/distanse avvises av motoren. Starter samme år i
forskjellige øvelser og berørte Heder-koblinger krever avklaring før godkjenning.

## Privat lagring og gjenoppretting

Den opprinnelige Corrections-pakken er beslutningenes eneste datakilde.
Lagringsomslaget bruker eksisterende `v:1`, revisjon, base, status, pakke,
godkjenning og audit, supplert med `module:person-control-v1` og verifisert
`organizer`. Ingen automatisk utfylling med Morothon-personer. Et nytt lager er tomt.

`identityReviewStore({openNamespace})` krever en **serverkonfigurert, separat
navneplass** i en eksisterende kryptert CAS-adapter. Fabrikken mottar det faste
navnet `person-control-v1`; det kan ikke velges i nettleseren. En feiladressert
resultat-/tenant-konvolutt avvises. Arrangør-ID omskrives ikke til en fiktiv tenant.

- `privateIdentityFileStore({directory,key})` gjenbruker AES-256-GCM-lageret i en
  privat undermappe `person-control-v1/`, med låsing, atomisk skriving og 0600-filer.
- Eksisterende GitHub-adapter kan åpnes av serverfabrikken med eget
  `prefix:identity-reviews`, samme verifiserte private repository og `admin-state`.
  Dette er testet mot en syntetisk API-adapter uten nettverk. **Ingen ekte privat
  lagring eller GitHub-konfigurasjon endres i denne PR-en.**
- PostgreSQL-adapteren erstattes ikke. En senere databaseintegrasjon må åpne en
  separat serverstyrt tabell/schema-navneplass og bevare ekte tenant-ID og
  tenantnøkkelprovider; ikke peke begge moduler mot samme eksisterende arbeidsrad.

Serverintegrasjonen i B må velge **ett** autoritativt privat lager/navnerom og
gjenbruke eksisterende nøkkelhåndtering, tilgangskontroll og backup. Aldri lever
`openNamespace`, filstier eller nøkler fra klienten. Ikke aktiver parallelle skrivere.

Testet restore: En syntetisk kryptert arbeidsfil kopieres til en separat privat
testmappe, åpnes med samme nøkkel og gir identisk beslutningspakke. Feil nøkkel
avvises. Dette er ingen ny backupjobb eller migrering av virkelige registre.

## Kvitteringer, samtidighet og kildeoppdateringer

`persisted:true` returneres først etter bekreftet privat lagring. Feil fra adapteren
gir feil tilbake, ikke en lokal «lagret»-status. Forhåndsvisning skriver ingenting.
SHA-256 av kommandoen og stabil saks-ID gjør gjentatte identiske innsendinger
idempotente, også ved motsatt rekkefølge på personparet. Samme ID med annet innhold
avvises. To samtidige skrivere kan ikke overskrive hverandre.

`load` gir `unprocessed`, `processed` og `rejected` som adskilte tellere. En
klargjort sammenslåing er behandlet, **ikke publisert**. Eiergodkjenning krever
eksakt revisjon og pakkehash. En ny lagring nullstiller tidligere godkjenning.
Audit knytter lagring/godkjenning til serververifisert intern aktør.

Avviste par gjenkjennes med eksisterende identitetsgrunnlag, uavhengig av endrede
tider eller historikkversjon. Det gjelder også eksplisitt avviste par som manglet
automatisk forslag på grunn av forskjellige tider samme år. Andre kandidater
skjules ikke. Nye relevante navn/aliaser kan åpne en ny vurdering av akkurat paret.
Et manuelt vurdert par uten navnesignal får også eksplisitt grunnlagsreferanse,
slik at en senere ny navneindikasjon ikke stilletiende blir avvist.

Ved ny kildeversjon vises gammel beslutning/audit fortsatt, men muterende saker
vises som til ny vurdering. `requiresSourceReview:true` sperrer nye lagringer og
godkjenninger i det foreldede arbeidsgrunnlaget. Ingen automatisk rebasering,
omskriving av førverdier eller videreføring av gammel merge-godkjenning.
Kontrollert kildeoppdatering/import av eksisterende saker kommer i B; gamle saker
skal da arkiveres/bevares, ikke fjernes fra lageret.

`productionApplied:false` og `publicationAuthorized:false` er alltid satt.
`approve` er faglig eiergodkjenning, ikke tillatelse til automatisk produksjonsendring.
Ingen `publish`/`apply`-metode eller ny offentlig skrive-API eksponeres her.

## Tester og videre leveranser

Kjør `node --test tests/admin-identity-review.cjs` i komplett betrodd checkout.
Alle testpersoner, nøkler, sesjoner og API-er er syntetiske. Testen bruker ingen
administrative originalregistre. Eksisterende kilde-/offentlig byggkontroll beholdes.
Det nye serverbiblioteket og testene legges ikke i den offentlige Pages-pakken.

Ny rot-test oppdages av full betrodd `npm test`/source-regresjon, men inngår **ikke**
i dagens fire faste, isolerte PR-source-tester. En grønn PR-CI alene er derfor ikke
bevis på denne testfilen; den må kjøres eksplisitt i betrodd checkout før merge.
Workflow, sikkerhetspolicy og sparse-checkout endres ikke som en del av A.

- **A (denne PR-en):** kontrakt, privat tjeneste, lagringsadaptergrense og tester.
- **B:** koble beskyttet nettportal/API til tjenesten, gjenåpning fra ny sesjon,
  tydelige knapper/status, kontrollert kildeoppdatering og import av lokale saker.
- **C:** utvide eksisterende publiseringsport for identiteter, med faktisk motor,
  kilde-/eksportkontroll, backup, CI, offentlig profilverifikasjon og reversering.

Akseptanseparene og hovednavnet som eier har bekreftet i #116 er føringer for B/C.
De legges ikke som produksjonsseed, offentlig testfixture eller påstått allerede
lagret/publisert avgjørelse. Ekte offentlig endring krever separat eiergodkjenning.
P0s produksjonsverifikasjon fra #115 forblir en separat utrullingsport.
