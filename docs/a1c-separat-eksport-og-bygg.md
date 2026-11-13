# A1C – separat administrativ eksport og offentlig bygg

Utgangspunkt: `main 69d71d2`, etter merge av PR #28. A1Cs oppgave er å forberede to uavhengige prosesser; ingen originalregistre flyttes eller slettes. [A1-kontrakten](a1-offentlig-dataeksport.md), [migreringsplanen](a1b-privat-migreringsplan.md), [P01–P12](a1b-publiseringsbeslutninger.md) og [prioriteringen](revisjon/07-forbedringsplan.md) videreføres. Ingen nye publiseringsvalg, personidentiteter, beregningsregler, motiver eller diplomgodkjenninger inngår.

## Hva som er skilt

| Del | Modul/kommando | Inndata og ansvar |
| --- | --- | --- |
| Administrativ kildebehandling | `scripts/lib/public-data.cjs` | Uendret A1-projeksjon og kontroll mot originalene; ikke importert av offentlig bygg. |
| Kandidat til offentlig eksport | `scripts/export-public-data.cjs` / `npm run data:export` | Eksplisitt originalmappe og offentlig asset-rot. Skriver filtrerte data og manifest til en ny, tom mappe. **Gir ikke publiseringsgodkjenning.** |
| Offentlig feltkontrakt | `scripts/lib/public-schema.cjs` | Samme tillatte felter/typer som A1, uten filtilgang eller administrativ kildebehandling. |
| Offentlig pakkevalidering | `scripts/lib/public-package.cjs` | Godkjenningsreferanse, versjon, fil-/asset-hasher, historikkbinding, tillatt filliste og symlink-kontroll. Leser ingen originaler. |
| Offentlig runtime | `scripts/build-site.cjs` / `npm run build` | Godkjent offentlig datapakke + offentlige kode-/assetfiler. Ingen privat filsti, token eller nettverksfallback. |
| Sluttkontroll | `npm run public:kontroll` | Kontrollerer ferdig nettsted mot offentlig manifest og separat betrodd referanse, uten originaler. |
| Overgangens kildekontroll | `npm run data:check-sources` | Kontrollerer at dagens beholdte originaler fortsatt gir den godkjente datapakken. Kjøres i betrodd kildemiljø, ikke i offentlig PR-jobb. |

`prebuild` starter ikke lenger råregisterbasert koblingskontroll. Den eksisterende kontrollen i `pretest` og alle gamle tester er beholdt for betrodd kildekjøring. Offentlig CI bruker `test:public`, som ikke utløser dette livssyklussteget.

## Offentlig pakke og versjonert manifest

`public-data/` er et **offentlig snapshot**, ikke en ny plassering for private originaler. De fem JSON-filene er byte-identiske med A1s godkjente byggepakke `e3c0397f3cc7799f`. De inneholder akkurat A1s publiseringsfelt, inkludert fortsatt gjeldende års-/koblingsgrunnlag. Administrative originaler ligger uendret i `data/` inntil en separat migrering godkjennes.

```text
public-data/
  manifest.json
  data/history.json
  data/honors.json
  data/volunteers.json
  data/badges.json
  data/event-dates.json

.github/public-data-approval.json   separat referanse, utenfor datapakken
```

Manifestkontrakt v1 har kun disse feltene:

| Felt | Betydning |
| --- | --- |
| `schemaVersion: 1` | Kjent manifestformat; ukjente versjoner/felt avvises. |
| `policyVersion: "morothon-public-v1"` | Uendret A1-publiseringskontrakt. En senere P-beslutning må innføres kontrollert, ikke skjules som reeksport. |
| `dataVersion` | Positiv heltallsrevisjon. En ny, godkjent pakke får høyere versjon; rollback gjøres som en ny gjennomgått revisjon. |
| `historySha256` | SHA-256 av nøyaktige offentlige historikkbyte; skal samsvare med filen og godkjenningsreferansen. |
| `files` | Eksakt de fem datafilene, med SHA-256 og bytelengde. Ingen frie vedlegg eller kildearkiver. |
| `assets` | Eksakt de offentlige runtime-assetene fra register/filliste, med SHA-256 og bytelengde. Filene ligger i den offentlige kode-/assetleveransen. |

Godkjenningsreferansen binder manifestets SHA-256, historikkhash og data-/policyversjon. Pakken kan ikke godkjenne seg selv ved å legge ved en ny hash eller `approved:true`. Ukjent fil, manglende fil, endret byte, feil asset, rå administrativt felt, symlink eller uventet versjon gir feilstatus. Manifester/kontrollsummer gir integritet, **ikke digital identitet eller signatur**. Digital signering er ikke innført.

Datamanifestet godkjenner ikke vilkårlig programkode: HTML/JS/CSS følger fortsatt kodegjennomgang, tester og GitHub-beskyttelse. Det er bevisst at en vanlig kodeendring ikke krever tilgang til administrative originaler. Sluttkontrollen validerer også byggemanifestets tillatte runtime-URL-er; uventede metadatafelt eller omdirigerte kode-URL-er avvises.

Det ferdige nettstedet inneholder `public-manifest.json` i tillegg til de tidligere 58 filene, totalt 59. Nettleserdesignet bruker ikke denne metadatafilen. `build-info.json` og cacheversjonen følger fortsatt hele runtime-bygget. Kode-/assetpakken og datapakken er begge offentlige; bare datapakken er utilstrekkelig uten selve nettsidekoden og assetene.

## Eksport, gjennomgang og overføring

I dagens betrodde arbeidsmiljø, eller senere et godkjent privat miljø med samme låste eksportkode:

```sh
npm run data:export -- data /tmp/morothon-kandidat . 1
```

Argumentene er originalmappe, ny tom utmappe, offentlig asset-rot og datarevisjon. I et privat miljø kan originalmappen ligge utenfor den offentlige utsjekken; asset-roten skal være et kontrollert offentlig snapshot. Eksportøren krever disse eksplisitte inngangene og skriver aldri over originalene eller godkjenningsfilen. En eksisterende/ikke-tom utmappe avvises. Den oppgitte revisjonen er ikke et bevis på godkjenning.

Eksportørens nåværende kildeformat har fem JSON-filer. Den fremtidige private jobben må derfor kombinere de to administrative originalregistrene med gjennomgåtte offentlige `history.json`, `badges.json` og `event-dates.json` i et privat, midlertidig inndataområde, eller beholde samme kontrollerte format privat. De offentlige inngangene låses til en kjent revisjon; de skal ikke få en ny, uavhengig redigeringsautoritet. Inndataområdet publiseres aldri. Dette klargjør en senere privat kjøring, men oppretter ikke lagringen eller flytter filer nå.

Arrangøren gjennomgår kandidatens offentlige diff og kontrollrapport, og vedtar en bestemt manifesthash. Bare de seks offentlige pakkefilene overføres til det offentlige repositoryet sammen med den foreslåtte godkjenningsreferansen. Ikke kopier originalmapper, kildehistorikk, ufiltrert stdout eller interne rapporter. Den fremtidige private byggeprosessen må fortsatt bruke låst, gjennomgått kode; den skal ikke kjøre vilkårlig offentlig PR-kode med privat tilgang.

Nye resultater eller synlige personendringer krever ny eksport. `data:check-sources` stopper hovedgrenens overgangsflyt dersom originalene og det godkjente snapshotet har sklidd fra hverandre. Endringer i private felt som A1 ikke publiserer lager ikke nye offentlige opplysninger. En ny pakke, endrede assets eller endret historikk kan ikke tas i bruk ved bare å bytte fil mens den gamle referansen beholdes.

## Kjør offentlig bygg uten originaler

Fra offentlig kode-/assetutsjekk med godkjent pakke og betrodd referanse:

```sh
npm run build -- /tmp/morothon-nettside /path/til/offentlig-pakke /path/til/betrodd-referanse.json
npm run public:kontroll -- /tmp/morothon-nettside /path/til/betrodd-referanse.json
```

Standard `npm run build` bruker repositoryets `public-data/` og `.github/public-data-approval.json`. Dette er egnet fra et betrodd snapshot. PR-kontrollen bruker **ikke PR-ens egen fil som autorisasjon**; se neste avsnitt. Det offentlige bygget trenger verken `data/honors.json`, `data/volunteers.json`, eksportøren, Git-historikk, privat repository eller private credentials. Det reeksporterer heller ikke allerede filtrerte data.

## Betrodd PR-kontroll og GitHub-innstillinger

PR-jobben bruker sparsom, blob-filtrert checkout med dybde 1 og eksplisitt liste over offentlige filer. Originalmappen `data/`, administrativ eksportkode og kilde-/arkivtester er ikke med. En separat utsjekk av PR-ens **base-commit** gir kontrollkode og godkjenningsreferanse. Kontrollen kjøres før npm-installasjon og annen PR-kode.

`scripts/check-public-policy.cjs` fra betrodd base sammenligner sikkerhetsfiler direkte, uten en endringsliste levert av PR-en. En PR kan ikke få grønt fra denne kontrollen ved å redigere eget manifest, egen godkjenningsfil eller egen validator. Normale, uendrede datapakker bruker base-referansen. Vanlig kode, tester, testhjelpere og avhengighetsoppdateringer følger nå [enkel utviklingsflyt](enkel-utviklingsflyt.md) uten SHA-oppdatering. Bare faktiske sikkerhets-/teststyrings-/publiseringsregler og nye datapakker krever særskilt godkjenning utenfor PR-innholdet:

- `MOROTHON_PUBLIC_DATA_SHA256`: repo-variabel med godkjent manifesthash for en ny pakke/første oppstart.
- `MOROTHON_REVIEWED_POLICY_HEAD`: repo-variabel med nøyaktig gjennomgått PR-head-SHA når sikkerhetsfiler endres, også ved første oppstart.

Dette er offentlige kontrollverdier, **ikke private tokens**. De settes av repo-eier etter gjennomgang, ikke av eksportøren eller en PR-jobb. Første A1C-PR har ingen tilsvarende kontrollkode i gammel main, og kan derfor bare starte kandidaten som kontrollkode etter eksplisitt ekstern head-godkjenning. Uten kontrollverdiene stopper den tidlig og lukket; ingen stilltiende bootstrap. Vanlige kode-/test-PR-er trenger ikke en ny head-godkjenning. Nye offentlige datapakker trenger fortsatt eksplisitt manifestgodkjenning. Foreldet head-godkjenning gjelder ikke en ny commit.

Verdiene legges under repositoryets **Settings → Secrets and variables → Actions → Variables** etter at endringen er gjennomgått. Head-verdien er siste commit i PR-en, ikke en simulert merge-commit. Endringer i selve kontraktversjonen må innføres som en gjennomgått oppgradering av betrodd kontrollkode; en PR kan ikke gjøre en ukjent kontrakt gyldig bare ved å endre sin egen validator.

Den innledende A1-pakken har manifest-SHA:

```text
fc2072bac8df8663b3351743b68d444ec5a404b7c854861da95fad2034972006
```

**Før merge må repo-eier verifisere GitHub-beskyttelsen:** beskyttet main, påkrevde statussjekker og gjennomgang av workflows, kontrollkode og tillitsreferanser. Bruk påkrevd betrodd workflow/ruleset der dette er tilgjengelig, eller håndhev riktig sikkerhets-/CODEOWNERS-review uten uautorisert bypass. Team og rettigheter må være faktiske og godkjente; A1C legger ikke inn et oppdiktet team.

Påkrevde PR-sjekker i denne flyten er `Public package, policy and site build` og `Independent trusted artifact gate`. Dersom branch protection fortsatt krever det tidligere jobbnavnet `Regression tests and site build`, må repo-eier oppdatere kravet før merge; et omdøpt jobbnavn erstatter ikke automatisk GitHubs regel. `Transitional trusted source regression` kjøres bare på main og er et ekstra deploykrav, ikke en privat jobb som PR-er skal få tilgang til.

En fil i repositoryet kan ikke alene tvinge GitHub til å avvise en ondsinnet workflow som har fjernet sin egen kontrolljobb. Derfor er denne serverstyrte beskyttelsen en nødvendig avhengighet, og den er ikke konfigurert/verifisert via API her. Ikke omgå manglende bootstrap-/sikkerhetsgodkjenning med en «alltid grønn» kontroll. Etter behov kan repo-eier fjerne engangsverdiene etter bootstrap; senere endringer trenger ny konkret godkjenning.

Sluttkontrollen `artifact_gate` kjører i en **egen, ren runner**, etter byggejobben. Den henter base-kode og godkjenningsreferanse på nytt, gjentar den betrodde pakkekontrollen og validerer det nedlastede artefaktet. Den installerer ingen npm-pakker og kjører ikke PR-ens tester eller byggekommando. Dermed kan testkode som endrer validatoren eller referansen i byggejobbens arbeidsmappe ikke godkjenne sitt eget artefakt. En regresjonstest demonstrerer at en manipulert lokal kontroll kan gi grønt, mens den uavhengige kontrollen av samme endrede artefakt avviser det. Begge jobber trenger fortsatt serverstyrt workflow-beskyttelse som beskrevet over.

## Bevarte kildekontroller og produksjonsovergang

Den fungerende nettsiden bygges fra det kontrollerte A1-snapshotet; det innføres ingen uferdig avhengighet til privat lagring. Full `npm test`, kontroll mot originaler og de fem historiske renderløpene er beholdt i `source_checks` på betrodd main/manuell hovedgrenkjøring. Denne overgangsjobben bruker de **allerede eksisterende offentlige kildene**, ikke en ny privat datakilde. Den kjøres ikke på PR-er eller forks og laster ikke opp rå rapporter.

Deploy av main krever uavhengig artefaktkontroll og disse kildekontrollene, etter vellykket offentlig bygg/test. Nye offentlige PR-tester bruker A1s offentlige referanse og syntetiske identitets-/årsdata; gamle tester er ikke fjernet. Ved senere privat migrering må `source_checks` flyttes til godkjent privat kontekst med samme kontrollomfang. Det er ikke gjort i A1C.

Ved feil: stopp eksport/publisering, behold kandidat og godkjent referanse separat, rett kilden i det betrodde miljøet og gjennomgå ny kandidat. Ikke bruk en utdatert pakke med nyere historikk, forny alle diplomgodkjenninger eller publiser en råfil som nødløsning. Rollback skal respektere gjeldende skjuling og gis en ny, eksplisitt godkjent datarevisjon hvis pakkens hash endres.

## Testgrunnlag og bevaring

Den nye offentlige testen bygger fra en separat mappe uten originalregistre, administrativ eksportør eller Git. Byggeprosessen kjører med Nodes filtilgang begrenset til denne offentlige mappen; et eksplisitt forsøk på å lese den ekte originalen avvises med `ERR_ACCESS_DENIED`. Prosessen får ingen private credentials. Eksisterende nettstedtest kjøres også fra samme isolerte kopi.

Deretter kontrolleres 43 profiler og 86 diplomvarianter mot en referanse laget fra A1s **filtrerte** byggepakke. Den inneholder ikke interne bevis eller skjulte profiler. Einar beholder 33 utgaver og 7. november 2026; skjult Heder-person er ikke gjeninnført, og løpshistorikken med 2 643 personer, 6 914 resultatrader og fire stafettlag består. Begge medaljevalg, opptjeningstidspunkt, innholdshash og utskriftsmodus skal være identiske. Ingen tildeling/godkjenning aktiveres ved datapakkegodkjenning.

Negative tester dekker blant annet manglende/endrede/ekstra filer, ukjente felter, feil historikkhash, uventet kontrakt, endret asset, PR-egen godkjenning, sikkerhetsendring uten head-review og forsøk på rollback. Syntetiske data kontrollerer DNS/DNF, flere starter samme år, kanoniske ID-er og nye år uten å flytte gamle milepæler. De gamle kilde- og layoutkontrollene beholdes i fullpakken.

### Utført sluttkontroll 13. november 2026

Lokalt i Linux/Chromium med Node.js 24.22.1:

| Kontroll | Resultat |
| --- | --- |
| `npm test` | **229/229 bestått**, ingen avbrutt, hoppet over eller fjernet. |
| `npm run test:public` | **9/9 bestått**, inkludert isolert bygg og manipulert byggejobbs validator. |
| `npm run build` og `npm run public:kontroll` | 59 gyldige filer, 43 synlige personer, datarevisjon 1, bygg `21e320e9944d5188`. |
| `npm run data:check-sources` | Originalene gir nøyaktig samme godkjente offentlige pakke. |
| A1-sammenligning | Alle fem JSON-filer byte-identiske med tidligere godkjent eksport; alle 86 diplomgrunnlag/utskriftsmoduser like. |
| Visuell kontroll | 390/1440 px: ingen horisontal overløp eller konsollfeil. Hedersoversikt, minneseksjon og detaljer kontrollerte. |
| A4/PDF | Åtte gjengivelser: begge valg for Oscar, Erling Askildsen, Einar og Jon Fjeld. Én liggende A4-side per fil, innebygde fonter, godkjent faktisk layout. |
| Bevaring og dokumentasjon | Ingen diff i `data/`, `assets/`, `js/` eller `css/`; YAML, interne dokumentlenker og `git diff --check` kontrollert. |

Kontrollgalleriet genereres av `scripts/review-public-export.cjs` fra den ferdige offentlige byggepakken, og publiseres som PR-artefaktet `morothon-a1-offentlig-kontroll` når CI er autorisert. Midlertidige PNG-/PDF-filer er ikke lagt i Git. Dette er lokale testresultater; GitHub-kjøring og serverbeskyttelse må verifiseres etter bootstrap-godkjenningen beskrevet over.

## Hva gjenstår før privat lagring?

A1C etablerer ingen privat destinasjon og rydder ikke gamle offentlige kopier. Originalene, tidligere commits/grener, dokumenter, Issues, gamle artefakter og eksterne kloner må fortsatt følges opp etter A1B-planen. Sparsom checkout er ikke sletting eller beskyttelse av tidligere offentliggjort historikk.

Før faktisk migrering kreves godkjent privat repository, tilgangs-/nøkkelmodell, verifisert backup og restore, beslutninger om eventuelt mer begrenset publisering og testet privat eksport. Flytt deretter de bevarte kildekontrollene og originalene etter uttrykkelig godkjenning. Den offentlige siden kan allerede bygges selvstendig, men privat infrastruktur, digital signering og historisk opprydding er **ikke gjennomført**.
