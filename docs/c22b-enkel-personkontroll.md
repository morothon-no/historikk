# C2.2b – Forenklet personkontroll

Utgangspunkt: `main` etter PR #46 (`b34af72`). Saksmodell, personregister,
konsekvensmotor og sikkerhetssperrer videreføres.

## Arbeidslisten

To hovedkategorier erstatter den brede kontrolloversikten:

- **Mulige duplikater:** tydelige navnevarianter eller felles registrert
  navn/godkjent alias på forskjellige kanoniske profiler.
- **Innmeldte feil:** mottatte henvendelser, eksisterende lagrede saker og
  uttrykkelig overførte resultatavvik fra C2.3.

Standardvisningen viser ubehandlede saker, med antall per kategori.
Til oppfølging, Ferdig gjennomgått og Alle saker velges ved behov.
Oppdatering beholder vurderingene. Tidligere opprettede saker slettes ikke.

Ved mulig duplikat vises navn side om side, deltakelsesår, aliaser og konkret
begrunnelse. Resultater og merker kan åpnes ved behov. Velg **Samme person**,
**Forskjellige personer** eller **Undersøk senere**. Samme person lager bare
et forslag; kilde, begrunnelse, identitets-/overlappskontroll, konsekvensanalyse
og separat klargjøring kreves fortsatt. Ingen produksjonsendring utføres.

En innmeldt feil kan registreres uten navnetreff eller valgt person.
Beskrivelse, kilde og vurdering bevares. Løper og eksakt originalregistrering
kan knyttes til saken før en retting finnes. Arrangøren kan deretter rette,
avvise eller utsette. Originalregistreringen bindes til indeks, før-rad,
radens SHA-256 og godkjent historikk. Manipulerte referanser avvises.

Tekniske kildereferanser, saks-ID, filimport og endringshistorikk ligger under
Andre valg / Arbeidsfiler og tidligere behandling. Signalstyrker og interne
kontrollkategorier vises ikke i normal arbeidsliste.

## Avgrensning og motsignaler

`Corrections.discover()` gjenbruker C2.2as navnesammenligning, aliaser og
redirects, men tar ikke med svake signaler. Samme fornavn med ulike etternavn,
like sluttider og nærliggende deltakelsesår er ikke identitetsbevis.
Like resultatverdier, historisk fullføring uten tid og generelle kildeforbehold
blir ikke automatisk saker. Startlisteavklaringer blir i C2.1; de kan meldes
inn eksplisitt med kilde/radreferanse. Vurderte C2.3-avvik går fortsatt til
Innmeldte feil → Til oppfølging.

**Ulike fullførte sluttider samme år, øvelse og distanse** er et uavhengig
motsignal og tar personparet ut av den automatiske duplikatlisten, også ved
identiske navn. Tid sammenlignes som sekunder. Forskjellige øvelser/distanser
kan være reelle dobbelstarter; DNS, DNF og manglende tid er heller ikke et
tilsvarende motsignal. Ingen registreres automatisk som forskjellige personer.
Tidligere åpnede saker beholdes for manuell behandling.

Ordinær datavalidering beholdes. Ugyldige tider, statuser, identiteter,
foreldede kilder og feilaktige kandidatendringer avvises som før.
Kjønn/klasse, plasseringer og Heder-koblinger kontrolleres i konsekvensanalysen.
Sammenslåinger bevarer starter og tidligere person-ID-er; ingen automatisk
sammenslåing, sletting, diplomgodkjenning eller tildeling innføres.

## Beslutninger og nytt grunnlag

Arbeidet ligger i fanens minne. **Lagre arbeidsgrunnlag** / **Åpne lagret
arbeidsgrunnlag** bevarer saker, kilder, originalregistreringer, statuser og
hendelser i `morothon-corrections-v1`. Filen inneholder saksnotater og må
oppbevares privat. Ingen nettleserdatabase eller skytjeneste innføres.
Ved sideinnlasting må lagret arbeidsgrunnlag åpnes igjen.

Identitetsvurderinger har en ugjennomsiktig referanse til personparet og
relevant navne-/aliasgrunnlag. Endrede tider eller et uvedkommende alias gjør
ikke et avvist par nytt. Endret navn, kjønn eller nytt støttende alias kan gi
ny vurdering; tidligere avvisning beholdes. Eldre pakker uten grunnlagsreferanse
knyttes fortsatt til samme par innen samme dataversjon.

Vanlig import avviser fortsatt andre dataversjoner. Ved oppdatert historikk
kan arrangøren særskilt bekrefte å hente **bare tidligere avvisninger** der
personparet og registrert identitetsgrunnlag fremdeles stemmer. Aktive rettinger,
godkjenninger, resultatvelgere og øvrige saker overføres aldri gjennom dette.
Antall øvrige saker oppgis; originalfilen må beholdes og gjennomgås separat.
Avvisninger uten etterprøvbart grunnlag krever manuell kontroll ved versjonsskifte.
Dette er arbeidsnotater, ingen autentisert identitetsgodkjenning.

## Mottak fra publikum

Den offentlige siden har e-postlenker til `info@morothon.no`, blant annet i
løperprofilen. Koden har ingen offentlig mottaks-API, database eller sikker
innsendingstjeneste. E-postlenken åpner bare e-postprogrammet; levering og
postkassens tilgangsstyring er ikke verifisert her. Ingen ny offentlig
send-/lagreknapp opprettes. Arrangøren registrerer mottatte henvendelser manuelt.

En senere mottaksintegrasjon må ha faktisk lagring, tilgangsstyrt behandling,
dataminimering, begrenset oppbevaring, vern mot misbruk og sannferdig kvittering.
Den skal opprette en innmeldt sak, aldri en automatisk historikkretting.

## Måling på samme godkjente historikk

Dataversjon 2, historikk SHA-256
`9c62621abeb3eb05a186b3618b8ba74c86b3d67b6a83539ccc2c1b1df33c4a9e`.
Bare aggregerte antall er dokumentert, uten navn eller saksopplysninger.

| Automatisk forslag | Før | Etter |
| --- | ---: | ---: |
| Identiske navn | 2 | 1 |
| Tydelige mellom-/etternavnsvarianter | 42 | 41 |
| Tydelige små skrivevarianter | 5 | 5 |
| Svake navnesignaler | 9 | 0 |
| Like resultatverdier | 32 | 0 |
| Fullført uten entydig tid | 688 | 0 |
| Generelle kildeforbehold | 87 | 0 |
| **Totalt** | **865** | **47** |

818 færre forslag er en reduksjon på 94,6 %. Motsignalet med ulike tider
fjerner to av de ellers 49 klare navneparene. De 47 gjenværende er mulige
duplikater, ikke bekreftede feil. Avviste par reduserer den ubehandlede listen
når et arbeidsgrunnlag er åpnet. Antall beregnes, ikke hardkodes.

## Tester og kontrollbilder

Syntetiske tester dekker identiske navn, mellomnavn, stavevarianter, ulike
personer med samme fornavn/sluttid, fullføring uten tid, aliaser, avviste par,
ulike sluttider i samme år/øvelse, reelle dobbelstarter, nytt relevant grunnlag,
eldre beslutninger og innmeldte feil uten navnematch. Originalregistreringer
testes gjennom lagring, import, utsettelse, avvisning og manipuleringsforsøk.
Ny historikk kan ikke overta aktive rettinger eller godkjenninger fra eldre pakker.

Tidligere tester av sammenslåing, resultatvalg, statuser, kildehash,
konsekvenser, Heder, reversering og atomisk import beholdes. Assertions som
tidligere krevde automatisk startliste-/svaksignalsaker er tilpasset bestilt
avgrensning; eksplisitt registrering og sporbarhet testes fortsatt.
Den syntetiske overlappsfixturen bruker like tider for navneparet slik at
overlapp fortsatt testes også når det nye motsignalet ikke sorterer paret ut.

Kontrollbilder med syntetiske opplysninger genereres i eksisterende
`morothon-c1-diplomverksted`-artefakt, undermappe `corrections-c22/`:
`arbeidsliste-c22b-{1440,768,390}.png`, `sammenligning-{1440,768,390}.png`
og `matching-c22a-{1440,768,390}.png`.

### Utført sluttkontroll

| Kontroll | Resultat |
| --- | --- |
| Hele offentlige hurtignivået i isolert kopi | 103/103 bestått |
| C2.1/a, C2.2/a/b, C2.3a/b og C1 nettleser-/PDF-regresjon i isolert kopi | 29/29 bestått |
| Offentlige funksjonsregresjoner: datakvalitet, rekorder, stafett, milepæler og tidligere navneretting | 9/9 bestått |
| Ny dekning | Sju modelltester og to nettleserflyter; eksisterende assertions tilpasset bestilt avgrensning |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer / 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Originalkilder mot godkjent eksport | `matches-approved` |
| Interne lenker i endret dokumentasjon | 10/10 funnet |
| Mobil/nettbrett/PC | 390/768/1440 px, kontrollbilder gjennomgått, ingen nye konsollfeil eller horisontal overflow i de nye flytene |
| Eksisterende diplommotor | Samlet PDF med seks A4-sider for fem syntetiske mottakere, begge medaljevisninger, innebygde fonter og stopp ved feil på siste side |

Det er **141 forskjellige tester**; gjentatte delkjøringer er ikke lagt til.
De 103 hurtigtestene og 29 admin-/PDF-testene ble kjørt på nytt etter
presiseringen om ulike sluttider. De ni offentlige funksjonstestene bruker
uendrede offentlige moduler/data og ble kjørt før den siste avgrensningen av
personforslag. Den siste ekstra assertionen for like tider alene ble kontrollert
med ny kjøring av de sju målrettede modelltestene.

Ingen administrative originalregistre finnes i de isolerte testkopiene.
Historikk, person-ID-er, offentlige datapakker, medaljer, Heder, diplomdesign,
workflows og sikkerhetspolicyer er uendret. Full lokal `npm test` og historiske
diplomgallerier er ikke kjørt på nytt. Obligatorisk ekstern CI må fortsatt
bestå før merge; lokale grønne tester bekrefter ikke GitHub Actions-status.
