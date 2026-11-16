# C2.4a – Én arbeidsflyt for kontrollerte rettelser

**Godkjenn og klargjør** foreslår rettelsen, kontrollerer den med eksisterende
C2.2-motor, beregner konsekvensene og klargjør én nedlastbar endringskandidat.
Det er fortsatt ingen produksjonsskriving, autentisering eller publisering.

## For arrangøren

1. Åpne **Rettelser og personkontroll**. Velg et mulig duplikat eller en innmeldt
   feil. Eksisterende arbeidsliste, avvisninger og utsatte saker er bevart.
2. Ved sammenslåing vises profilene side om side. Velg **Hovednavn etter
   sammenslåing**. Profilen med dette navnet beholder sin kanoniske ID; den andre
   ID-en og eldre lenker videresendes. Begge personpostene og alle starter bevares.
3. Ved annen retting velges person, aktuell registrering og ønsket verdi.
   Hovednavn, tid, eksakt distanse, status og resultatets personkobling bruker
   samme klargjøringshandling. Kilde og vurdering er fortsatt påkrevd.
4. Velg **Bekreft samme person og klargjør** eller **Godkjenn og klargjør**.
   Systemet utfører de tekniske kontrollene. Ingen separat beregningsknapp
   kreves i normalflyten.
5. Se viktige konsekvenser: unike deltakelsesår, fullføringer, kilometer og
   hvilke beregninger som endres. Alle detaljer kan åpnes ved behov.
6. Velg **Last ned komplett endringskandidat**. Kandidaten kontrolleres på nytt
   før nedlasting. Oppbevar filen privat; den kan inneholde egne saksnotater.

Ved uklarhet forklares problemet. Overlappende starter i samme år, konkurranse
og distanse, motstridende identitet/førverdier, kildeplasseringer, juniorklasse
og kjønn eller uavklarte Heder-avhengigheter omgås ikke. Flere forskjellige
starter samme år bevares, mens året telles én gang i deltakelsesstatistikken.

En sak med slike konsekvensforbehold beholdes som forslag. En ugyldig retting
eller konflikt som avvises av kildekontrollen lagres ikke som godkjent endring.
Filen kan ikke lastes ned som komplett kandidat før alle aktive rettingsforslag
er kontrollert hver for seg. En uendret bekreftelse gjør ikke tidligere
vurderinger foreldet; en faktisk endring bruker fortsatt eksisterende regel for
ny konsekvenskontroll av pakken.

**Andre valg → Trinnvis kontroll og tilbakeføring** beholder den tidligere
arbeidsflyten, blant annet eksisterende kontrollert reversering. Dette bruker
de samme sakene og kontraktene. Det er ikke opprettet et parallelt register.

Kilde, beskrivelse og begrunnelse bevares i fanen når rettingstype eller berørt
profil byttes. Endringer under en pågående beregning forkaster det foreldede
svaret. Endring av skjemaet etter klargjøring fjerner den nedlastbare kandidaten
til ny kontroll er utført. Ingen saksdata lagres i nettleserens varige lagring.

## Motorer og beregninger

`Corrections.prepareCase()` samordner eksisterende `propose()`,
`consequences()`, `transition()` og `applyCandidate()`. Kildedata endres ikke.
Den samme `C2Project`-adapteren kjører deltakelseshistorikk, unike år,
fullføringer/km, personlige rekorder, klasseplasseringer, Adelskalender,
løyperekorder, lojalitet, milepæler, merker og løperdiplomgrunnlag.

Like historikksnapshots beregnes bare én gang innen hver klargjøring. Det er
ingen varig beregningscache; en ny kontroll bruker aktuelle data og motorer.
Kandidaten inkluderer endringer for andre berørte løpere, ikke bare sakens
primærpersoner. Historiske kildeplasseringer omnummereres ikke automatisk.

## Én kandidat, eksisterende saker

Formatet `morothon-correction-candidate-v1` omslutter uendret
[`morothon-corrections-v1`](contracts/corrections-v1.md). Det er en eksport av
arbeidsgrunnlag, ingen ny autoritativ datakilde.

| Del | Innhold |
| --- | --- |
| `base` | Dataversjon, manifesthash, historikkbytes-hash og snapshot-hash |
| `corrections` | Samme sakspakke, eksakte endringer, kilder og alle sakshendelser |
| `result` | Kandidathistorikk og SHA-256 av denne |
| `delta` | Eksakte før-/etterverdier og feltets tilstedeværelse for endrede historikkfelt |
| `effects` | Endrede beregningsverdier, fordelt på de ni eksisterende konsekvensområdene |
| `audit` | Handlingsjournal med saker, kilder, begrunnelser og reverseringsreferanser |
| `rollback` | Forventet kandidat-/originalhash og instruks om å reversere eksakt delta |
| `requirements` | Påkrevde framtidige kontroller; **ikke bevis på at de er utført** |
| `checksum` | SHA-256 av hele konvolutten uten kontrollsumfeltet |

`publicationAuthorized` og `productionApplied` må begge være `false`.
Kontrollsummen er integritetskontroll, **ikke en digital signatur**.

`createCandidate()` kontrollerer samtlige aktive saker på nytt og krever lokal
klargjøring av hver av dem. `parseCandidate()` kontrollerer struktur, størrelse
og hashes. `verifyCandidate()` gjenskaper kandidaten fra originalgrunnlaget og
de betrodde motorene og sammenligner hele innholdet, også konsekvenser og delta.
Maksimal filstørrelse er 16 MB; den innkapslede sakspakken beholder grensen på
2 MB / 500 saker. Ukjente felt, feil innhold, feil versjon og foreldet grunnlag
avvises. Pakken blir ikke automatisk delt, forkortet eller publisert.

Den komplette kandidaten kan åpnes med eksisterende **Åpne lagret
arbeidsgrunnlag**. Den verifiseres først; deretter brukes vanlig `importPackage()`.
Importerte `handoff`-statuser nedgraderes til `proposed`, og kandidaten må
bekreftes og konsekvenskontrolleres på nytt. En importert JSON-fil gir aldri
autentisert godkjenning eller publiseringsrett.

`restoreCandidate()` beviser tilbakeføring på en kopi: bare det nøyaktige
kandidatsnapshotet kan reverseres. Den krever riktig hash, eksakte etterverdier
og at resultatet blir identisk med originalhashen. Senere endringer stopper
tilbakeføringen. Dette skriver ikke til produksjon; en senere virkelig
tilbakeføring krever autorisert prosess mot gjeldende dataversjon.

## Grense mot framtidig publisering

En framtidig tjeneste skal selv hente aktuell, autoritativ base og kjøre
`verifyCandidate()` med egne betrodde motorer. Den må **ikke** bruke klientens
base, kontrollsum, status eller prosjektkode som autorisasjon.

Før faktisk skriving kreves autentisert og autorisert godkjenner, kontroll av
private kilder og berørte Heder-/diplomgodkjenninger, verifisert backup og ny
konsekvenskontroll. Deretter må avledede lagringsfelt og en ny offentlig
dataversjon/manifest klargjøres gjennom eksisterende eksport- og
publiseringssperrer. Kandidaten inneholder nødvendig rettings-/beregningsgrunnlag,
men er **ikke en ferdig A1C-publiseringspakke**. Ingen token, skrivetjeneste,
GitHub-snarvei, automatisk tildeling eller diplomgodkjenning er innført.

A1/A1C/A1D, offentlige filgrenser, uavhengig artefaktkontroll og backupkrav
beholdes. Ingen originalregistre flyttes, eksponeres eller endres. Programmet
kan brukes uten GitHub-hosting, med samme eksisterende nettleser-/Node-motorer.

## Kontrollbilder og tester

Alle nye testpersoner, resultater og kildehenvisninger er syntetiske.
Modelltestene dekker alle rettingstypene, begge hovednavnvalg, flere starter,
versjons-/kildekonflikter, Heder-forbehold, manipulerte kandidater, flere
forslag, import og eksakt tilbakeføring.

Nettlesertestene kjører de ekte motorene, komplett nedlasting/gjenåpning,
klargjøring, avvisning av reelle konflikter, skjemaendring under beregning og
responsiv visning. Eksisterende trinnvise tester beholdes, med hjelpere som
åpner de nå sammenfoldede avanserte kontrollene før de brukes.

Kontrollbilder på 1440/768/390 px genereres fra ekte Chromium-visning i
eksisterende `morothon-c1-diplomverksted`-artefakt:

- `corrections-c22/c24a-klargjort-{1440,768,390}.png`
- `corrections-c22/c24a-avklaring-{1440,768,390}.png`

Ingen faktiske saks-/kandidatfiler fra drift legges i Git eller kontrollartefakter.

### Utført leveransekontroll

| Kontroll | Resultat |
| --- | --- |
| Hele offentlige hurtignivået, `npm run test:quick` | 122/122 bestått |
| Nettleser-/PDF-regresjon: C2.1/a, C2.2/a/b, C2.3a/b/c, C2.4a og C1 | 38/38 bestått |
| Offentlige funksjonsregresjoner: datakvalitet, rekorder, stafett, milepæler og tidligere navneretting | 9/9 bestått |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Administrative kilder mot godkjent eksport | `matches-approved`, uendret |
| Responsiv visning og konsoll | 1440/768/390 px, ekte Chromium-bilder gjennomgått; ingen horisontal overflow eller nye JavaScript-feil i den nye flyten |
| Eksisterende C1/PDF-motor | Seks A4-sider for fem mottakere, begge merkevisninger, fontkontroll og sperring ved siste-sidefeil |

Totalt **169 forskjellige tester**. Ny dekning består av sju modelltester og
fire nettleserflyter. Gjentatte delkjøringer er ikke telt flere ganger.
Testene er kjørt i isolert offentlig kopi uten administrative originalregistre.
Full historisk diplomgalleriproduksjon er ikke kjørt lokalt for denne endringen;
eksisterende CI-testplan og påkrevde kontroller er bevart uendret.
