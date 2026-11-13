# A2 – Datakvalitet og statusregler

Grunnlag: `main` på `c94edd02c2b0f7197a8c5253f8eaa67481bcd9ee`, systemrevisjonens [beregningsfunn R-01–R-03 og R-06](revisjon/02-beregninger.md), [S-02](revisjon/05-drift-og-sikkerhet.md) og [A2-planen](revisjon/07-forbedringsplan.md). Kontrollert 13. november 2026.

## Avgrensning

Ingen resultatrader, navn, personidentiteter, administrative originalregistre, offentlige datafiler, medaljer, design eller diplomgodkjenninger endres. Backup og migrering er parkert. Dette er en endring i tolkning og validering, ikke datavask eller ny importløsning.

## Felles statuskontrakt

`js/history-data.js` er felles autoritet for nettleseren, Heder, lojalitetsberegningen og den skrivebeskyttede byggekontrollen. Et individuelt deltakelsesår teller én gang per kanonisk person-ID. Flere starter, aliaser og omdirigeringer gir ikke ekstra deltakelsesår.

| Effektiv status | Individuell deltakelse | Fullføring / fullført distanse | Tidsplassering / rekord |
| --- | --- | --- | --- |
| Fullført med gyldig positiv tid | Ja | Ja | Ja, innen konkurransens øvrige regler |
| Fullført uten registrert tid | Ja | Ja, der distansen er kjent | Nei |
| Deltatt | Ja | Nei | Nei |
| DNF | Ja | Nei | Nei |
| DNS | Nei | Nei | Nei |
| Disket / DQ / DSQ som rå status | Ja, eksisterende deltakelsesregel beholdt | Nei | Nei |
| Påmeldt / Registered | Nei | Nei | Nei |
| Ukjent status | Nei; validering stopper innlasting/bygg | Nei | Nei |
| Stafettlag/-resultat | Nei i individuell deltakelsesberegning | Separat fra individuell konkurranse | Ingen individuell rangering eller rekord |

`DNS` og `DNF` i enten status- eller tidsfeltet overstyrer rå `Fullført`, som før. Diskvalifikasjon i rå status normaliseres til `Disket`. En diskvalifikasjonsmarkør bare i tidsfeltet gir kildekonflikt som må gjennomgås, ikke automatisk endring av en fullføring. Motstridende markører som `DNS` og `DNF` på samme rad er valideringsfeil. En registrert tid på et ikke-fullført resultat vises ikke som en sluttid. Historiske råverdier beholdes.

**Arrangørbeslutning under A2:** «tror ikke vi skal fjerne noen deltakelser, la det bare være fullført». Den eksisterende 2007-raden beholdes derfor som `Fullført`, også i beregningene. Ingen deltakelser, fullføringer eller registrert distanse fjernes. Den dokumenterte diskvalifikasjonsmarkøren rapporteres som et kildeavvik, uten automatisk rettelse. Eksisterende deltakelsesregel for rå DQ-status beholdes også: deltakelse teller, men et uttrykkelig diskvalifisert resultat blir ikke en fullføring.

Ingen nye regler for individuelle stafettetapper vedtas her. De holdes utenfor individuelle deltakelsesår, som i eksisterende lojalitetsberegning. Arkivets separate stafettvisning og registrerte etappedistanser beholdes. Dagens fire lag ligger fortsatt i `teamResults`.

## Dokumentert feil i 2007

`MOR-B1AC0FD`, Kortmoro 14 km i 2007: rå status er `Fullført`, mens tid og kildeplassering er `Disket`. Etter arrangørens uttrykkelige beslutning beholdes effektiv status `Fullført`. Markøren synliggjøres bare i datakvalitetsrapporten. Unntaket er bundet til denne eksisterende raden; nye slike konflikter stopper valideringen til kilde/status er avklart.

| Profilens beregning | Før | Etter |
| --- | --- | --- |
| Effektiv status i 2007 | Fullført | Fullført |
| Deltakelsesår | 8 | 8 |
| Fullføringer | 8 | 8 |
| Fullført registrert distanse | 104 km | 104 km |
| Beregnede høydemeter fra fullføringer | 3 600 | 3 600 |

Resultatet var allerede uten tidsplassering og rekord på grunn av manglende numerisk tid. Ingen eksisterende fullføringer endrer status i A2.

## Validering

Kjør `npm run data:check-history`. Standardkilden er den godkjente offentlige `public-data/data/history.json`. En annen fil kan kontrolleres med `node scripts/check-history.cjs /sti/til/history.json`. Verktøyet leser og rapporterer, men skriver ikke i kilden og foretar ingen godkjenning.

Kontrollene avviser blant annet:

- Utrygge/tomme person-ID-er, dupliserte personobjekter og tellende resultater uten kanonisk personobjekt.
- Omdirigeringssykluser, manglende endemål og aliaser uten gyldig personreferanse.
- Ukjente/motstridende statuser, ugyldige resultatfelt, distanser, årstall og årsstatistikk.
- Tider med minutt-/sekundoverskridelser, nulltid, negative verdier eller tvetydig nytt format. `mm:ss`, `hh:mm:ss` og de eksisterende entydige punktformatene støttes; underledd må være under 60. Untimet fullføring kan ha `null` og gir ingen oppdiktet tid.

Eksakt like resultatrader rapporteres som et varsel, uten automatisk sletting eller sammenslåing. Deltakelsesår dedupliseres fortsatt. Ufullstendige persondata skal ikke repareres ved navnegjetting.

### Bevarte historiske avvik

Gjeldende fil har **0 valideringsfeil** og følgende varsler:

| Varsel | Antall | Håndtering |
| --- | --- | --- |
| `normalized-status` | 7 | Eksisterende DNF-markører; rådata og tidligere tolkning bevares |
| `legacy-disqualification-marker` | 1 | Den eksisterende 2007-raden beholdes som fullført etter arrangørens beslutning |
| `ambiguous-legacy-time` | 2 | De dokumenterte strengene `02:09.52` fra 1994 og `01:06.14` fra 1998 tolkes ikke som numerisk tid |
| `legacy-unknown-distance` | 2 | Eksisterende `Deltatt` med ukjent distanse beholdes uten oppdiktet fullført distanse |
| `legacy-dns-without-person` | 79 | DNS-referanser uten personobjekt beholdes; de gir ingen individuelle deltakelser |

De to tvetydige tidene er avgrensede unntak bundet til eksisterende person, år, konkurranse, distanse, rå status og tidsstreng. Nye tvetydige tider er feil. Kildene må gjennomgås før disse to historiske resultatene eventuelt korrigeres. Untimede fullføringer med kjent tekstmarkør forblir untimede.

## Offentlig bygg og sikkerhetskontroll

Bygging og sluttkontroll av Pages-pakken kjører samme semantiske validator etter A1C-kontrollen av skjema, filer og SHA-256. En ny kontrollsum alene gjør ikke en ugyldig tid eller identitet gyldig. Offentlig bygg trenger fortsatt ingen administrative originalregistre.

Resultatmodulen inngår nå også i listen over beskyttede valideringsfiler. De små Actions-endringene legger bare til filene som denne kontrollen trenger i de eksisterende sparse-utsjekkingene og kjører A2-testene i offentlig testjobb. Ingen nye workflows, private tilganger eller publiseringsmekanismer innføres.

**Eksisterende A1C-godkjenningsport gjelder:** Denne PR-en endrer beskyttet bygge-/valideringskode. Maintainer må godkjenne den eksakte endelige PR-headen gjennom `MOROTHON_REVIEWED_POLICY_HEAD` før Actions-porten slipper den gjennom. PR-en endrer ikke godkjent datamanifest og krever ikke et nytt manifestvedtak. Ingen kontroll omgås eller selvgodkjennes.

## Tester og bevaring

`tests/data-quality.cjs` har målrettede status-, tids-, identitets-, publiserings- og nettlesertester med syntetiske data og gjeldende offentlig historikk. De er med i både `npm test` og `npm run test:public`. Feil i testdata avvises selv når datapakkens kontrollsummer er konsistente.

Eldre leveransetester som frøs hele `index.html`, resultatmodulen eller lojalitetsmodulen, er justert til dagens avtalte arbeidsomfang. Historisk HTML/CSS utenom applikasjonsskriptet sammenlignes fortsatt, og data-, asset- og ordinære diplomkontroller beholdes. Lojalitetsresultatene sammenlignes mot tidligere algoritme for samtlige gjeldende personer; terskler og historiske hedersperioder endres ikke.

Målrettet Chromium-kontroll ved 390 og 1 440 px verifiserer uendret status i profil og årsarkiv, plassering, deltakelse, fullføringer, distanse, konsoll og overflyt. Det er ikke laget en ny full visuell regresjonsrunde. Utskrifts-/PDF-regresjonene i eksisterende testpakke og den skrivebeskyttede diplomkontrollen beholdes.

Bevaringsverdier: 2 643 løpere, 6 914 resultatrader, 6 698 tellende starter, 33 løpere med full deltakelse siden debut, 398 deltakere / 195 debutanter / 22 nye merker i 2026, fire uendrede løyperekorder, 43 synlige Heder-profiler og 86 synlige diplomvarianter med uendrede innholdshasher og utskriftsmoduser. Ingen historikk-, Heder-, medalje- eller diplomdata regenereres i denne PR-en.

`npm run diplomer:kontroll` rapporterer fortsatt 44 internt bevarte personer, 60 gyldige presentasjonsvarianter og 28 ventende interne varianter (`written:false`). Det synlige utvalget har 60 gyldige og 26 ventende varianter; to interne varianter tilhører den skjulte profilen. A2 endrer ingen av disse godkjenningsstatusene.

Etter arrangørens presisering er også alle 2 643 løpersammendrag fra `MorothonHistoryData.create(...).stats(...)` og samtlige 6 914 beregnede resultatplasseringer sammenlignet direkte med `origin/main`. Ingen avvik ble funnet. Den berørte profilen er målt på nytt ved 390 og 1 440 px: `Fullført`, 8 deltakelser, 8 fullføringer, 104 km og ingen konsollfeil eller overflyt.

## Endelig lokal sluttkontroll

| Kontroll | Resultat |
| --- | --- |
| `npm test` | 254 av 254 bestått, 0 feil; inkluderer de sju nye A2-testene |
| `npm run test:public` | 16 av 16 bestått; egen CI-inngang, delmengde av full testpakke |
| `npm run build -- /tmp/morothon-a2-approved-site` | Bestått, 59 runtime-filer |
| `npm run public:kontroll -- /tmp/morothon-a2-approved-site` | Gyldig offentlig pakke, dataversjon 1, 43 synlige profiler |
| `npm run data:check-sources` | Originalkilder samsvarer med uendret godkjent offentlig projeksjon |
| `npm run data:check-history` | 0 feil, de 91 dokumenterte varslene ovenfor |
| Direkte sammenligning med `main` | Alle 2 643 løpersammendrag og 6 914 plasseringer uendret |
| Målrettet Chromium-kontroll | Profil og årsarkiv ved 390/1 440 px: uendret fullføring, 104 km, ingen konsollfeil eller overflyt |

GitHub Actions-resultat kan først bekreftes når PR-en er opprettet og eksisterende maintainer-port er godkjent. Lokalt beståtte tester er ikke en påstand om grønn ekstern CI. Ingen merge eller publisering er utført.
