# A1 – sikker offentlig dataeksport

Utgangspunkt: `main a447314`, 13. november 2026. Oppfølging av S-01 og S-07 i [systemrevisjonen](revisjon/05-drift-og-sikkerhet.md). **Dette sikrer den nye Pages-byggepakken, ikke allerede publiserte kilder eller Git-historikk.** Arrangøren har uttrykkelig avklart at et privat lager ikke finnes ennå, og at eksisterende kildefiler/historikk skal bevares uendret. Ingen migrering, sletting, nye tildelinger eller arrangørfunksjoner inngår.

## Datagrensen og publiseringsbeslutningen

Eksporten beholder allerede synlig innhold og det minste nødvendige grunnlaget for dagens beregninger og kontroller. Den godkjenner ikke nye personopplysninger for publisering. Felter som bare beskriver administrativ behandling følger ikke med. Nye, ukjente felt er ikke automatisk offentlige.

**Publiseringsvalget til gjennomgang:** Feltlisten nedenfor er den eksplisitte kontrakten foreslått i denne PR-en. Særlig individuelle dugnadsår, fraværsår og bekreftede løperkoblinger beholdes som grunnlag for dagens klientberegninger; at de tidligere lå i en offentlig råfil, er ikke i seg selv bevis på et behandlings-/publiseringsgrunnlag. Arrangøren må godkjenne dette feltomfanget før merge. Dersom bare avledede summer og milepæler skal publiseres, må det avtales en mer begrenset beregningsprojeksjon i stedet; filteret skal ikke på egen hånd gjette samtykke eller omskrive personopplysninger.

| Kilde og felter | Hva offentlig kode trenger | Eksportbeslutning |
| --- | --- | --- |
| `honors.groups`: ID, publisert navn, søkealiaser, bekreftede roller, synlig persontekst og bekreftede historier | Personkort, søk, stabile profillenker og profiler | Behold for synlige personer; ubekreftede historier/roller som ikke vises, utelates. |
| `contribution`: registrert periode, dokumenterte enkeltår, fravær, godkjent total og grunnlagstype | Samme dugnadsberegning, sortering, merker, perioder og historiske diplomer | Behold nødvendige tall og statusflagg; ingen årsrekker eller bekreftelser konstrueres. |
| Merkeforslag, særskilt/minne-/grunnleggerstatus, fremheving og `awardPolicy` | Dagens hovedmerke, hele samlingen og skillet mellom forslag og tildeling | Behold gjeldende visnings-/beregningsfelt. Tidligere merkeforslag og ubrukte regelnotater utelates. Formelle tildelings-/utstedelsesregistre kopieres ikke. |
| `personDetails`: korttekst, bekreftede historier, hederstekst, bekreftet løperkobling og særskilt diplomdato | Profil, «Også på startstreken» og diplomgrunnlag | Behold bare synlige personers gjeldende felter. Einars dato 7. november 2026 beholdes som separat dato, uten oppdiktede opptjeningsår. |
| `internalNotes`, `historicalNotes`, `revisionHistory`, `previousBadgeProposals`, `serviceEstimate`, skjulte profiler og deres aliaser | Trengs ikke for den offentlige visningen | Utelates, også fra detaljer, eksempler, referanser og diplomkontrolloppføringer. `hiddenProfileIds` selv publiseres ikke. |
| `sources`, `source`, `sourceIds` | Eksisterende datalaster kontrollerer om en bekreftelse har kildegrunnlag; kildebeskrivelsene vises ikke i dagens HTML | Behold bare ugjennomsiktige kildehåndtak for faktisk referert grunnlag og den tekniske etiketten «Publiseringsgrunnlag». Administrativ kilde-ID, chatreferanser, fritekst, notater og ubrukte kildeobjekter utelates. Håndtakene erstatter ikke originalkilder eller sikker utstederkontroll. |
| `presentationPrintSet.entries` og særskilte `diplomaApprovals` | Innholdshash, mottaker, variant, grafikk-/CSS-hash og gjeldende godkjenningsstatus | Behold bare nødvendige gjeldende kontroller for synlige personer. Ingen godkjenning fornyes. `pendingReviews`, begrunnelser og gamle `previousEntries` utelates; uten samsvarende gjeldende hash forblir diplomet merket forhåndsvisning. |
| `narrative`, `diplomaTexts`, synlige eksempler, grupper og visningsrekkefølge | Introduksjon, tidslinje, felles historier og diplomer | Behold dagens viste innhold. Administrative usikkerhetslister utelates; historiske revisjoner gjenpubliseres ikke. |
| `retiredProfiles` | Tidligere offentlige lenker har en korrigert profilvisning | Behold ID og navn som allerede vises på denne ruten, med nøytral teknisk melding. Kildehistorikk og gammel begrunnelse utelates. Skjulte personer eksporteres heller ikke som slike oppføringer. |
| `volunteers.json` | Enkel navneliste, profilreferanser, kjent rolle/år, fravær og tellingsgrunnlag | Egen eksplisitt eksport, ikke rå filkopi. Notater og ukjente felt utelates; kildehåndtak finnes i det offentlige kjerneregisteret. |
| `history.json` | Offentlig Adelskalender, identiteter/aliaser, resultater, statistikk, DNS/DNF, stafett og rekorder | Valider dagens kjente format og kopier filen **byte-identisk**. Ukjente felt eller nye uavklarte radtyper stopper bygget til kontrakten er gjennomgått. Ingen løpsresultater fjernes eller omtolkes. |
| `badges.json` og medaljefiler | Merkeidentitet, motiv, farger, størrelser, kvalitetsstatus, kontrollsummer og dokumenterte DPI-unntak | Behold funksjonelle felt og samtlige brukte originalmotiver. Masterpakkenavn, tidligere kildefilstier og utkastmetadata som ikke brukes i visningen utelates fra JSON. Bildefilene endres ikke. |
| `event-dates.json` | Bekreftede arrangementsdatoer og offentlig kildenavn | Behold datoer og kildenavn; administrativ dokumentasjonsmerknad kopieres ikke. Datoen 11. november 2018 beholdes. |
| HTML, CSS, nettlesermoduler, fonter og godkjente runtime-assets | Gjeldende offentlige sider | Eksplisitt filliste; nye filer i `js/` blir ikke offentlige automatisk. Dokumentasjon, råarkiver, tester og administrasjonsskript inngår ikke. |

Gjeldende HTML har ingen aktiv visning av de administrative kildebeskrivelsene. Derfor endres ikke synlige kildetekster/biografier ved å utelate disse objektene. Eventuell fremtidig offentlig kildevisning må få egne, gjennomgåtte publiseringsfelt; den må ikke hente tilbake råregisterets fritekst. En ny opplysning med uklar publiseringsstatus skal holdes utenfor og vurderes av arrangøren, ikke gjøres offentlig fordi et felt tilfeldigvis finnes.

## Implementering og kontrollporter

- [`scripts/lib/public-data.cjs`](../scripts/lib/public-data.cjs) definerer tillatte felt, typer og underobjekter. Eksporten bygger nye objekter; den endrer ikke originalene. Den fjerner skjulte personer og alle strukturerte referanser til dem, og kontrollerer at skjult Heder-ID/navn/alias ikke finnes i Heder-/dugnadseksporten.
- [`build-site.cjs`](../scripts/build-site.cjs) skriver de filtrerte JSON-filene til `_site/data/`, bruker de offentlige byteverdiene i byggeversjonen og kontrollerer sluttpakken. `history.json` og bildefilene kopieres uendret. De eksisterende datalasterne fungerer med samme filnavn og datastruktur; ingen ny privat datakilde lastes i nettleseren.
- `npm run public:kontroll -- <byggepakke>` validerer alle datafiler og byggemanifestet, sammenligner mot den forventede eksporten fra gjeldende kilder og avviser ukjente filer/symlenker. Dette kjøres også rett før opplasting i Actions. En lekkasje eller ugyldig eksport gir feilstatus og stopper jobben.
- CI beholder alle historiske regresjonskontroller, men laster ikke lenger opp rå koblingsrapporter eller gamle før-/etter-gallerier som inneholder historiske registeropplysninger. Nytt kontrollgalleri `morothon-a1-offentlig-kontroll` lages fra den validerte offentlige pakken. Tidligere publiserte artefakter er ikke slettet.

Bygg alltid en tom mappe med dagens godkjente eksportpolicy. Publiser aldri repositoryroten som statisk nettsted. En gammel `_site` eller et gammelt Actions-artefakt kan fortsatt inneholde rådata og skal ikke brukes som rollback uten ny eksport/kontroll. Et gjenkjørt gammelt workflow bruker også gammel kode; denne PR-en kan ikke tilbakevirkende sikre slike kjøringer.

## Bevaring og synlige data

Forventet offentlig utvalg er fortsatt **43 personer**. Kilderegistrene har fortsatt **44 interne registreringer**. Erling Danielsen er utelatt fra hele den offentlige Heder-datamodellen, ikke bare skjult med CSS eller en menyregel. Hans historiske løpsresultater og løperprofil i Adelskalenderen er bevart. En direkte lenke til en ikke-eksportert Heder-ID har ikke lenger et personobjekt å laste; ingen skjult biografi eller diplom kan hentes via Heder-lasteren.

Einar Danielsen, de fem grunnleggerne, minneprofiler som fortsatt skal vises, dugnadsoversikt og øvrige personer beholder navn, merker, beregningsgrunnlag, historier og diplomer. Det tilføyes ingen godkjenninger eller tildelinger. Begge diplomvariantene beholder sine eksisterende innholdshasher og utskriftsmoduser. Rene presentasjoner er fortsatt presentasjoner, ikke formelt utstedte utmerkelser. Manglende godkjenning, bildekvalitetsvarsler, font-, layout- og trykksperrer består.

Testen sammenligner kort på 390/1440 px, alle 43 synlige personers beregninger og **86 diplomvarianters** innholdshash, opptjening, tekst og utskriftsmodus mellom kildevisning og offentlig bygg. Dette dokumenterer uendret offentlig innhold; det er ikke en ny godkjenning for fysisk trykk.

## Eksisterende eksponering – ikke løst av eksportfilteret

| Område | Etterprøvd observasjon | Gjenstående eksponering / begrensning |
| --- | --- | --- |
| Gjeldende Git-kilder | `honors.json` og `volunteers.json` på `main a447314` inneholder fortsatt administrative felt; rå `honors.json` fra GitHubs råfilvert svarte HTTP 200 under kontrollen. | Nåværende repository, filvisning og kildearkiver gjør fortsatt råregistrene tilgjengelige. Dette er **ikke privat lagring**, og filene er med hensikt ikke flyttet eller slettet i A1. |
| Git-historikk nåbar fra main | 31 revisjoner som endret de to datafilene ble undersøkt. Første funn av `internalNotes`: `92b892aa`, 10. november 2026. Av disse snapshotene hadde 28 interne notatfelt, 10 historiske notatfelt, 2 revisjonshistorikk og 1 skjultprofil-liste. | Tallene teller snapshots som har feltet, ikke personer eller antall utsatte meldinger. Eldre commits, kloner, grener og kildearkiver er fortsatt tilgjengelige. Ingen omskriving er utført. Alle eksterne forks/kloner er ikke kartlagt. |
| Pages-pakker | Tidligere bygger kopierte hele heders-/dugnadsfilene; systemrevisjonen bekreftet lokalt HTTP-tilgang til disse i produsert pakke. | Direkte kontroll av den nåværende Pages-verten ble blokkert av nettverkspolicy (403 ved tilkobling). Vi kan ikke bekrefte hvilken eldre pakke som faktisk ligger live eller i CDN-/nettlesercacher nå. Før merge/deploy er også dagens løsning uendret. |
| Actions-artefakter | Forrige workflow lastet opp `morothon-site`, koblingsrapport og fem historiske gallerier; gallerikoden lager blant annet personregister og historiske person-/diplomvisninger. Enkelte gallerier hadde 14 dagers angitt bevaring. | API-kartlegging av faktiske artefakt-ID-er, utløp og nedlastinger ble blokkert med `Forbidden`. Historiske gallerier kan også omfatte en profil som senere ble skjult. Eksakt beholdning og faktisk tilgang må kontrolleres av repo-eier. Default bevaring for nettstedartefaktet kan ikke utledes sikkert av YAML. |
| Offentlig CI-kilde og logger | A1s tester og bygg sjekker fortsatt ut dagens offentlige repository med de eksisterende råregistrene. | Artefaktfilteret gjør ikke checkout eller testlogger private. Eventuelle registerutdrag i eldre feilrapporter/arbeidslogger omfattes også av eierens kartlegging. Privat kildetilgang i fremtidig CI må avgrenses som beskrevet i migreringsplanen. |
| Dokumentasjon, bilder og andre kopier | Dokumenter i `docs/` og tidligere test-/kontrollmateriale finnes fortsatt i repositoryet. De kopieres ikke inn i ny Pages-pakke. | En fil er ikke privat bare fordi den er utenfor `_site` eller har `noindex`. Gamle offentlige personomtaler/kildereferanser kan finnes i dokumentasjon og nedlastede PDF-er. A1 omskriver ikke disse kildene. |

Rapporten gjengir ikke interne notattekster eller kopierer råregistrene til et nytt «privat» område. Lokale test-/kontrollfiler er ikke et godkjent privat langtidsarkiv. GitHub-kildehistorikk, Actions-lagring, Pages, cache og tredjepartskopier må behandles som separate flater. Sletting av et enkelt artefakt kan ikke gjøre en tidligere nedlastet kopi utilgjengelig.

## Forslag til senere privat migrering – krever egen godkjenning

**Ingen av trinnene nedenfor er gjennomført i A1.** Arrangøren ønsker å vurdere et privat repository under `morothon-no`, men har ikke godkjent opprettelse eller flytting.

1. **Avklar eier, innhold og bevaring.** Klassifiser interne registre, originaleksporter, dokumentasjonsvedlegg, revisjonshistorikk og eventuelle personvernforespørsler. Avklar hvilke felter som skal kunne publiseres, hvem som godkjenner det og hvor lenge originalene skal beholdes. Registrer at data allerede har vært offentlige; flytting kan ikke oppheve tidligere eksponering.
2. **Etabler et separat, godkjent privat repository.** Eksempelnavn må avtales. Bruk navngitte organisasjonsteam med minst mulig tilgang, flerfaktorautentisering, beskyttet hovedgren, obligatorisk review og loggføring av tilgang/endringer. Ikke åpne det for alle med tilgang til det offentlige repositoryet. Avklar eksterne medhjelpere og avslutning av tilgang.
3. **Ta og kontroller sikkerhetskopi før kopiering.** Bevar hele kildehistorikken, LFS/vedlegg der det finnes og en hashmanifestert eksport. Lag kryptert backup i en annen, tilgangsstyrt lagringsflate; oppbevar nøkler separat med avtalt stedfortreder. Et offentlig Git-klon eller en ekstra mappe i dette repositoryet er ikke en privat backup.
4. **Prøvekopier og test restore isolert.** Sammenlign ID-er, dokumenterte fakta, vedlegg, kontrollsummer og nødvendige revisjoner. Gjenopprett fra backup på en separat maskin; kontroller integritet og hvem som faktisk har tilgang. Avtal og prøv et mål for tapstid/gjenoppretting, for eksempel daglig backup og restore innen én arbeidsdag, før det loves som driftsnivå.
5. **Skill byggeflytene.** Offentlige PR-er og særlig PR-er fra forks må aldri få en hemmelighet som leser privatregisteret. En godkjent, beskyttet jobb i privat kontekst produserer bare den validerte offentlige eksporten og et ufølsomt manifest. Publiseringsjobben får denne eksporten, ikke de private kildene eller credentials. Foreta review av endret offentlig innhold før levering til det offentlige repositoryet/Pages. Behold en testbar offentlig fixture uten private originaler.
6. **Planlegg overgangen med funksjonskontroll.** Kjør gammel og ny eksport side om side, kontroller alle 43 synlige profiler, løperhistorikk, kontrollsummer og begge diplomvarianter. Registre og originaler flyttes først etter uttrykkelig godkjenning og verifisert restore. Fremtidige offentlige commits må bare inneholde godkjent eksport; dette krever en separat endring fra A1s nåværende råfilbaserte byggekilde.
7. **Vurder eksisterende eksponering separat.** Repo-eier kartlegger Actions-artefakter, utgitte arkiver, branches/tags, forks, Pages/CDN og eventuelle eksterne kopier. Eventuell tilgangsendring, artefaktfjerning, sletting eller Git-historikkomskriving må besluttes eksplisitt etter bevaring/konsekvensvurdering. Ikke lov at historikkomskriving kan hente tilbake andres kopier.
8. **Vedlikehold og tilbakeføring.** Dokumenter tilgangsreview, nøkkelrotasjon, backup-/restoreøvelse og avslutning av leverandørtilgang. Rollback skal respektere gjeldende skjuling og publiseringspolicy; ikke gjeninnfør råfiler eller en tidligere fjernet person ved å publisere en gammel pakke.

**Status etter A1:** eksplisitt og testet grense for nye Pages-pakker og nye CI-kontrollartefakter. **Gjenstår:** godkjent privat lager, tilgangs-/backupmodell, migrering av administrative kilder og eierkontroll av gamle offentlige kopier. A1 alene er ikke en fullstendig personvernløsning.

## Sluttkontroll og reproduksjon

Gjennomført på arbeidsgrenen fra `a447314`:

- `npm test`: **221/221 bestått**, ingen hoppede tester. Første kjøring avdekket to eldre testfixturer som blandet administrative registre og offentlig eksport. Fixturene er rettet uten å fjerne eller svekke kontrollene, og hele pakken er deretter kjørt på nytt.
- Avsluttende `node --test tests/public-export.cjs tests/service-milestones-v362.cjs`: **10/10 bestått**, inkludert negativ testing av lekkede felter, skjulte personer, ukjent skjulings-ID, skjult person omtalt i fritekst, feil hash, ekstra filer og symlenker.
- `npm run build -- <tom kontrollmappe>`: **58 filer**, versjon **`e3c0397f3cc7799f`**. `npm run public:kontroll -- <kontrollmappe>` bestod.
- `review-public-export.cjs`: mobil/PC og åtte PDF-er fra den offentlige pakken, ingen nettleserfeil eller sideveis overflyt. Begge medaljevalg for Oscar Lohne, Erling Askildsen, Einar Danielsen og Jon Fjeld er kontrollert. PDF-verktøy bekreftet én liggende A4-side og innebygde fonter. Chromium avrunder sideformatet til 841,92 × 594,96 punkter; eksisterende diplom-CSS er uendret.
- Alle 43 synlige personers beregninger og 86 diplomvarianters innholdshash/utskriftsmodus er sammenlignet mot eksisterende kildevisning. Einars 33 utgaver og dato 7. november 2026 består. Jon Fjelds 10-merke viser fortsatt 2014–2023 og 11. november 2023.
- Erling Danielsen finnes ikke i offentlig Heder-register, kort eller diplomutvalg. Hans løperprofil ble åpnet i offentlig bygg og viser fortsatt fem individuelle løpsdeltakelser.
- `data/`, `assets/`, `css/` og `js/` er byte-identiske med utgangspunktet. Det gjelder også historikkfil, navnekorrigeringer, medaljeoriginaler, beregningsmoduler og datalastere. Dokumentlenker og `git diff --check` er kontrollert uten feil.

Eksempel med nye, tomme kontrollmapper:

```sh
npm test
npm run build -- /tmp/morothon-a1-site
npm run public:kontroll -- /tmp/morothon-a1-site
node scripts/review-public-export.cjs /tmp/morothon-a1-review /tmp/morothon-a1-site
```

Kontrollbilder/PDF-er kan regenereres og legges i Actions-artefaktet; de lagres ikke permanent i produksjonsgrenen. Ingen privat lagring er etablert, og ingen kilde, Git-historikk eller tidligere publisert artefakt er slettet eller omskrevet. Lokal grønn kontroll er ikke en påstand om at GitHub Actions eller den publiserte nettsiden allerede er oppdatert.
