# Menneskene bak Morothon – V3.4

`heder.html` er fortsatt en skjult, direkte tilgjengelig forhåndsvisning med
`noindex, nofollow`. Det er ikke tilgangsbeskyttelse. Ingen lenke er lagt til i
hovednavigasjon, mobilmeny eller ordinære løperprofiler. Kampanjeideen i issue #7
inngår ikke. Offentlig lansering og aktivering av diplomer krever egen godkjenning.

## Kilder og personer

Hele GitHub issue #11 og alle seks kommentarer er lest sammen med arrangørens
V3.4-bestilling. `organizer-v34` i `data/honors.json` viser til dette grunnlaget.
Artikkelopplysninger fra Fædrelandsvennen og N247 beholder sine opprinnelige
kildehenvisninger og forbehold; ingen nye artikkelopplysninger er lagt til.

44 kanoniske personer vises én gang hver i oversikten. Alle fem grunnleggerne
er samlet i én seksjon: Oscar Lohne, Erling Askildsen, Arnfinn Håverstad,
Helge Reisvoll og Einar Danielsen. Oscar og Erling har de to fremhevede kortene
inne i samme seksjon. Grunnleggerkohorten og løpsberegningene er bevart.
Dag Morten Frantzen, Håkon Lohne og Bent-Inge Bakke vises under arrangørhistorien.
Øvrige dugnadsnavn vises kompakt. Erling Danielsen, Floke Bredland og Leif Wiig
har en diskret «Til minne om»-omtale. Leif døde i 2023 og omtales for tidtaking
og organisering.

- Karl Kimestad er et eksplisitt navnealias for Kalle Kimestad. Én oppføring,
  ett søketreff og én kanonisk profil. `#person/karl-kimestad` peker videre til
  den stabile profilen `#person/kalle-kimestad`. Løpernavn/-ID-er er ikke endret.
- Nils Henning Pedersen og Nils Martin Otterdal Nilsen er separate personer.
  Jenny Åmodt og Johannes Aamodt er separate oppføringer. Arnfinn G er ikke
  koblet til grunnlegger Arnfinn Håverstad.
- Aud Ovesen, Arnfinn Grimestad, Magne Lia og Lars Vassbotn Aamodt har fått
  fullstendige navn etter arrangørens opplysninger 11. november 2026. Tidligere
  profil-ID-er beholdes. Bent-Inge Bakke har aliaset Bent Bakke; hans foreløpige
  periode 2014–2019 brukes ikke som bekreftede enkeltår eller merketerskel.
  Ole J.Bueklev beholdes slik navnet er oppgitt. Ukjente år og oppgaver utelates.
- Birgitte Aamodt har startår 2022. Johannes Aamodt og Atle Aamodt har startår
  2021, men Atle deltok ikke på dugnad i 2026. Ingen mellomliggende årsrekke,
  deltakelsesantall eller merker utledes fra disse startårene.
- Lars Vassbotn Aamodt er en egen person uten oppgitt startår/oppgave. Laila Endresen
  Skjulestad har bidratt på drikkestasjon sammen med Anne Lene Førland-Hansen.
  Begge har ukjent startår etter arrangørens siste avklaring. De begynte samtidig,
  men mulig 2016 er ikke bekreftet og brukes ikke som startår. Den tidligere
  2014-opplysningen for Anne Lene er trukket tilbake.
  De to nye oppføringene har ingen automatisk medalje eller diplom.
- Håkons Svalbard-opphold er årfestet til 2016. Det utledes ikke konkrete
  oppgaver eller fravær fra løpet dette året.
- Erling Danielsen bidro fra 1992 til han gikk bort; dødsåret er ikke oppgitt.
  Floke gikk bort i 2024. Mulig sluttår 2017 og sprikende opplysninger om
  startåret beholdes som kildeforbehold, ikke som sikre offentlige datoer.
- 128 deltakere i 1992, datoen 11. november 2018 og alle historiske
  navnekorrigeringer er bevart. Ingen endring i `data/history.json`.

## Bakoverkompatibel modell og merkeforslag

`schemaVersion: 1`, `groups`, `members`, `memberRefs` og eksisterende profil-ID-er
beholdes. `volunteerList: "data/volunteers.json"` viser til den separate, enkle
dugnadslisten. Ved innlasting utvides den samme personmodellen fra begge filene.
`contentVersion: "3.4"` aktiverer eksplisitte planer i stedet for å
arve gruppens dekorasjon som et personlig merkeforslag. Eldre navnelister uten
`contentVersion` kan fortsatt forhåndsvises fra `group.badgeId`.

Personpostene holder følgende opplysninger adskilt:

1. `roles` og `stories`: kildebelagte historiske opplysninger, med `confirmed`
   og `sourceIds`. `status` beholdes som legacy-status for oppføringen, ikke
   som bevis på at en formell medalje er utdelt.
2. `contribution`: bare eksplisitte, dokumenterte dugnadsår i `confirmedYears`.
   Et `fromYear` er ikke bevis på alle mellomliggende år. Oscar og Erling har
   eksplisitt innsats i de 35 utgavene 1992–2026; deres løpsstarter er et annet mål.
3. `badgeProposal`: `status: "proposed"`, liste over `badgeIds`, ett
   `primaryBadgeId` og kilder. Et tomt forslag gir verken medalje eller diplom.
4. `awards`: separate, formelle beslutninger med dato, kilde og godkjenning.
5. `issuedDiplomas`: egen utstedelsespost knyttet til en formell tildeling.

Alle `awards` og `issuedDiplomas` er tomme i denne leveransen. Ingen nye formelle
utmerkelser er tildelt. Modellen validerer kilder, aliaser, unike person-ID-er og
koblingen mellom tildeling og utstedt diplom. Fem dokumenterte dugnadsutgaver
kan gi et kvalifikasjonsgrunnlag; det oppretter aldri tildeling/diplom automatisk.
En særskilt beslutning kan gi unntak, men må ha egen bekreftelse og kilde.

De fem grunnleggerne har forslag om Grunnlegger og Dugnadshelt. Oscar/Erling har **Morothons æresmerke** som foreslått hovedmerke, med
Hedersildsjel, Grunnlegger og Dugnadshelt som mindre sekundære merker.
Kalle, Finn, Dag Morten og Håkon beholder tidligere merkeforslag. De nyere
navnene og Bent får ingen automatisk utmerkelse fra medlemskap eller startår.
Alle nevnes og takkes uavhengig av antall dugnadsår.

## Løpshistorikk og stabile lenker

Eksisterende eksplisitte `runnerId`-koblinger er uendret. Ingen nye koblinger
utledes fra navn, slekt eller liknende stavemåte. Uten sikker kobling skjules
hele løpsseksjonen. Bekreftede koblinger bruker samme lesende modell som før:
DNS/DNF, unike år, godkjente ID-omdirigeringer og separate grupper for
konkurranse, eksakt distanse og løypeperiode. Kildeplasseringer skilles fra
beregnede kjønn-/aldersklasseplasseringer. Løpsstarter er aldri dugnadsår.

De eksisterende åtte koblingene er Erling, Oscar, Arnfinn Håverstad, Helge
Reisvoll, Einar Danielsen, Kalle Kimestad, Finn Lohne og Håkon Lohne. Den gamle
ruten `helge-andersen` gir fortsatt en korrigeringsforklaring, uten automatisk
ny identitetskobling eller grunnleggermerke.

## Diplomutkast og trykksperre

`MorothonDiplomas.serviceDraft(personId, optionalBadgeId)` henter personens
merkeforslag og bruker ett hovedmerke og eventuelle mindre sekundærmerker.
`serviceExample(exampleId)` lager seks anonyme milepælsutkast, et
grunnleggerutkast og æresutkastene for Oscar/Erling fra `diplomaExamples`.
De anonyme utkastene bruker de seks valgte titlene og humoristiske tekstene.

Femårseksemplet har ingen person-ID og er tydelig illustrativt. Det finnes ikke
et dokumentert nøyaktig femårsgrunnlag for en navngitt mottaker i bestillingen.
Ingen virkelig person er derfor gitt fem dugnadsår ved gjetting.

Alle service-modeller beholder `previewOnly: true` og `imageReady: false`, også
ved en formell tildelingspost i en testfixture. Ingen utskrifts-/PDF-knapper
finnes. Iframes har bare `allow-same-origin`, uten `allow-modals`; forhåndsvisningene
skjules ved vanlig sideutskrift. Datofeltet bruker bekreftet løpsdato for
oppnådd dugnadsmilepæl, eller 35. utgave for æresutkastet. Formell
utstedelsesdato er en separat, foreløpig uregistrert beslutning. Håkon Lohnes navn er typografisk satt og skal
ikke omtales som en ekte håndskrevet signatur.

Den eksisterende liggende A4-malen, originalmedaljene, rammene, vannmerket og
signaturprinsippet beholdes. Bare service-malen får tilpassede rader og mindre
sekundærmerker. Vanlige merke-, rekord- og debutdiplomer er uendret, kontrollert
med eksisterende regresjonstester og identisk raster av Ingers sølvdiplom.
Layout- og kilde-/DPI-kontroller er beholdt; bestått A4-layout er ikke en
trykkgodkjenning av service-merkene, som fortsatt har registerstatus `design-draft`.

## Vedlikehold og kontroll

Vanlige dugnadsnavn vedlikeholdes i **`data/volunteers.json`**, uten at arrangøren
må redigere roller, tildelinger og diplommodeller i den omfattende hedersfilen.
Listen har 31 enkle personposter og to referanser til Kalle/Finns eksisterende
profiler. Grunnleggere, arrangører, minneprofiler og personer med egne
merkeforslag/historikk blir liggende i `honors.json`.

En vanlig post trenger bare `id` og `name`, i tillegg til en dekkende kilde.
Valgfrie visningsfelt er `role` og `fromYear`. `sourceIds`, `nameStatus` og
`internalNotes` gir kilde-/vedlikeholdsopplysninger. Utelat `fromYear` når året er ukjent. En registrert start er
aldri en automatisk beregning av antall dugnadsår.

```json
{"id":"ny-dugnadsperson","name":"Fornavn Etternavn","sourceIds":["navneliste-2027"]}
```

Nye kilder kan legges i `volunteers.json` under en valgfri `sources`-nøkkel, med
samme format som hedersfilen. Eksempel (erstatt med faktisk kildegrunnlag):

```json
"sources": {
  "navneliste-2027": {
    "title":"Arrangørens navneliste for 2027",
    "publisher":"Søgne Morothon",
    "basis":"Oppgi hvem som har kontrollert navnet og innsatsen."
  }
}
```

Filens `sourceIds` er standard bare for navn som faktisk omfattes av den kilden;
nye navn må få riktig kilde. En ny kilde kan ikke overskrive en eksisterende.
Ved referanse til en person som allerede har en hedersprofil, bruk **bare**:

```json
{"profileId":"kalle-kimestad"}
```

Dette gjenbruker profilen og viser personen bare én gang. Ikke kopier navn,
roller eller merker inn på nytt. Kollisjoner i ID-er og aliaser eller gjentatte
listeoppføringer avvises, uten stille sammenslåing av personer. Løse navnelikheter
brukes aldri til å avgjøre identitet.

Ved senere oppgradering til en mer omfattende hedersprofil flyttes personposten
til `honors.json`, **med samme ID**, og listeposten erstattes av `profileId`.
Dermed bevares direkte lenker. Dugnadslisteposter kan ikke tildele merker,
opprette løperkoblinger eller utstede diplomer. Bruk den eksisterende, separate
modellen for eksplisitt godkjente merkeforslag og tildelinger. Bruk `memberRefs`
ved flere roller, og bare eksplisitte `aliases`/`aliasIds` ved bekreftet identitet.
Utelat ukjente år/oppgaver; ikke bruk løpsresultater som bevis.

```sh
node --test tests/honors-v34.cjs
npm test
node scripts/review-honors-v34.cjs /tmp/morothon-v34 a7d03f7
```

QA-bilder og PDF-er er lokale, merket som ikke utdelt, og ligger utenfor den
publiserbare runtime-pakken. Reelle tildelinger, mottaker for femårsutkastet,
navneavklaringer og eventuelle senere utstedelsesdatoer må godkjennes særskilt.

## Issue #13 – kort dugnadsliste og personlige arrangørprofiler

Hele issue #13 og alle fire kommentarer er lest. Siste presisering om minimal
navneliste går foran tidligere forslag til lange historier for Jon og andre
vanlige dugnadsnavn. Christan Berthelsen er lagt til med oppgitt stavemåte, uten
oppgave, år, løperkobling eller merkeforslag. Med senere kildebelagte tillegg
har oversikten nå 44 unike personer.

Vanlige `people`-poster fra `volunteers.json` blir `listingOnly` ved innlasting.
Bare navn og eksplisitt kjent oppgave/startår vises; ingen «Dugnad»-rolle eller
standardros fylles inn. Kjente startår er bevart, men brukes ikke til å beregne
dugnadsår eller utmerkelser. Ved helt ukjente detaljer vises bare navnet.
Eldre `text`/`stories`-felt aksepteres av hensyn til filkompatibilitet, men gir
ingen synlig historie og bør ikke brukes for vanlige dugnadsnavn.

De kompakte navneoppføringene har ingen lenke til en automatisk full
hedersprofil. Eksisterende direkte `#person/<id>`-lenker fungerer fortsatt, med
kun navn og kjente detaljer i en kort visning. Tilbake/Escape returnerer fokus
til navneoppføringen. `profileId`-referanser til Kalle/Finn eller andre egne
hederprofiler beholder den rike profilen og vises fortsatt bare én gang.

Jon vises som «Barneløp og startpistol · fra 2014». 2014 gjelder Morothon,
ikke hans langt eldre engasjement i friidretten. Forsovelseshistorien brukes
ikke. Anne Lene/Laila har «Drikkestasjon» uten år og uten gjentatt historie.
Kildegrunnlaget om samtidig start er bevart under «Bakgrunn og kilder».

Dag Mortens og Håkons personlige arrangørhistorier har eksplisitte kilder fra
issue #13. Dag Morten omtales som tidtaker og kreativ ildsjel; Langmoro i
porsjoner står uttrykkelig som arrangørgjengens humor, ikke som et registrert
resultat. Håkons løypemerking, klargjøring, løping og nedrigging omtales varmt;
Svalbard forblir 2016 uten slutninger om dette årets løpsstarter.

En kort felles takk er synlig før navnelisten. Den gir plass til frivilligheten
som helhet uten å tilskrive usikre prestasjoner til enkeltpersoner.

QA-generatoren tar faktiske før/etter-bilder fra en eksplisitt Git-referanse,
inkludert den daværende dugnadsfilen. A4-PNG-prøvene rendres ved 300 DPI, og
PDF-prøvene forblir lokale og merket «IKKE-UTDELT». Ingen kvalitetsflagg,
medaljeoriginaler, ordinære diplomer eller historiske løpsdata endres.

## Morothons æresmerke – øverste hedersnivå (forslag)

- `service-aeresmerke` er **øverste særskilte heder**, over dugnadsstigen og Hedersildsjel.
  Grunnlegger er en selvstendig historisk heder, ikke en dugnadsterskel.
- Den nummererte dugnadsstigen er **5 Ivrig hjelper, 10 Dugnadshelt, 15 Trofast
  ildsjel, 20 Bærebjelke, 30 Fredet inventar og 40 Morothon-legende**.
  Hedersildsjel er en særskilt utmerkelse, uten automatisk årsgrense.
- **Morothons æresmerke** er for helt ekstraordinært eller livslangt engasjement.
  Det har **ingen automatisk årsgrense** og krever særskilt vedtak.
- Oscar Lohne og Erling Askildsen er foreslått som de første mottakerne basert
  på deres oppgitte dugnadsinnsats gjennom alle 35 utgaver 1992–2026. Dette er
  fortsatt bare forslag i `badgeProposal`; deres `awards` og `issuedDiplomas` er tomme.
- Motivet `assets/medals/service/aeresmerke.svg` er et egenlaget, skalerbart
  **designutkast**, med platina- og gulltoner, laurbær, løper og tolinjet
  «MOROTHONS ÆRESMERKE». Tallet 35 står **ikke** på selve medaljen.
  Status i registeret er `design-draft`, `printReady: false`, og ingen trykk-
  eller tildelingsgodkjenning er gitt.
- Den skjulte forhåndsvisningen har særskilt æresdiplom for Oscar/Erling med
  ett stort hovedmerke og tre små sekundærmerker. Hedersdiplomer er fortsatt
  låst for utskrift/PDF, mens vanlige løperdiplomer er uendret.
- Endringen skal gjennomgås visuelt og merket tegnes eventuelt videre før
  fysisk produksjon. Ingen offentlig menylenke eller endring av `noindex`.

## Dugnadsmilepæler – utvidelse av PR #16 (ikke godkjent)

- **Egen dugnadsserie:** seks titler ved **5 / 10 / 15 / 20 / 30 / 40 utgaver**.
  Seks merker med felles skjoldmotiv og individuelle metalluttrykk. Alle er
  `design-draft`, `printReady:false` og ingen er formelt tildelt.
- Beregning: `MorothonHonorsData.tenureMilestones(data, person)` teller **kun**
  kildebelagte `contribution.confirmedYears`. Et startår, en løpsstart eller et
  opphold blir ikke automatisk til dugnadsår. Beregningen viser kandidater,
  høyeste kvalifiserende nivå og neste milepæl – aldri faktisk tildeling.
- Oscar og Erling har 35 dokumenterte utgaver og derfor **30** som høyeste
  dugnadsmilepæl foreløpig. **40** er ikke oppnådd. Æresmerket er fremdeles
  deres foreslåtte primære heder; Hedersildsjel og Grunnlegger er særegne
  utmerkelser ved siden av dugnadsstigen. Ingen formelle tildelinger.
- Hedersildsjel krever individuell vurdering av særlig innsats; ti utgaver kan
  være et utgangspunkt, men er ingen automatisk terskel. Grunnlegger er
  historisk heder. Æresmerket er høyeste nivå, uten bestemt årsgrense.
- Eldre `service-dugnadshelt` beholdes kun for kompatibilitet med gamle,
  fortsatt ikke godkjente merkeforslag og skjules fra galleriet. Disse blir
  ikke automatisk oppgradert til et femårsmerke uten bekreftede innsatsår.
- Seks anonyme A4-eksempler viser hele serien. Utskrift/PDF for hedersdiplomer
  forblir sperret. Hederssiden er fortsatt skjult i meny og `noindex`.


### Datofelt på dugnads- og hedersdiplomer

Det synlige feltet viser **året for dokumentert milepæl**, ikke utskriftsår
eller en formell tildelingsdato. Beregningen bruker bare bekreftede dugnadsutgaver.
Eksakt løpsdato beholdes i modellen fra `data/event-dates.json` når den er kjent.

- Oscar og Erling: `service-dugnad-30` viser **MILEPÆL OPPNÅDD I 2021**;
  modellens løpsdato er **13. november 2021**.
- Æresdiplomutkastene viser **35 DUGNADSUTGAVER I 2026**;
  modellens løpsdato er **7. november 2026**. Æresmerket er ikke formelt tildelt.
- Anonyme typeeksempler og tilfeller uten dokumentert år har ingen datotekst,
  plassholder eller datostrek. Signaturfeltet til høyre beholdes.
- Ordinære deltakerdiplomer viser fortsatt korrekt arrangementsdato uendret.
- En senere **formell tildelingsdato** hører hjemme i `awards` og
  `issuedDiplomas`, aldri som automatisk erstatning for oppnådd milepæl.

## Vedtatt navnevalg til visuell gjennomgang – Morothon-humor (forslag 3)

De seks milepælene har fått unike navn (ID-er og årsgrenser beholdes):

| Utgaver | Navn | Motivretning |
| ---: | --- | --- |
| 5 | Ivrig hjelper | Enkel bronse, minimalt ornament |
| 10 | Dugnadshelt | Sølv og to stjerner |
| 15 | Trofast ildsjel | Gull/grønt og en flamme |
| 20 | Bærebjelke | Gull/burgunder og søyler |
| 30 | Fredet inventar | Høytidelig gull, laurbær og stjerne |
| 40 | Morothon-legende | Platina, diamant og glimt |

Merkene er designutkast og krever fortsatt visuell gjennomgang. Diplomutkastene har kort humor med respekt. Hedersildsjel og Grunnlegger forblir særskilte utmerkelser. Morothons æresmerke er høyeste heder, uavhengig av dugnadsår. Ingen automatisk tildeling, utskrift eller publisering.

## Visuell sluttkontroll i PR #16

De seks SVG-utkastene har nå separate områder for nivåsymbol, stort tall og
tittel. Lange titler er fordelt på to linjer. 20 har søylemotiv/burgunder,
30 har ekstra gullramme og kraftigere laurbær, og 40 har fasettert platinaramme.
Æresmerket har en egen gullstrålende ordensstjerne og krone/løper. Hedersildsjel
og Grunnlegger er bevart. Ingen godkjente løperoriginaler er endret.

Faktiske SVG-gjengivelser, mobil-/PC-visning og ti A4-prøver regenereres utenfor
repositoryet. Store PNG/PDF-er og utdaterte målinger er fjernet fra PR-en.
Se [sluttkontrollen](pr16-sluttkontroll.md). Reproduser med:

```sh
node scripts/review-honor-badges.cjs /tmp/morothon-heder-pr16
```

En valgt, historisk dugnadsmilepæl viser N bekreftede utgaver og perioden frem
til N-te utgave, ikke dagens samlede antall. Oscar/Erling får dermed 30,
1992–2021 og oppnåelsesåret 2021 på Fredet inventar-utkastet, med den valgte
Riksantikvaren-teksten. Senere forslag til særskilt heder tas ikke inn på dette
historiske milepælsdiplomet. Deres æresutkast beholder 35 og 1992–2026.
Eksakte løpsdatoer beholdes i modellen. Kildedata, person-ID-er, merkeforslag
og tildelinger er bevart.

SVG-er er skalerbare vektorer, ikke 2400px-bitmaporiginaler med en fast DPI.
Kvalitetspanelet skiller nå SVG fra PNG. Hovedmerket er 55 mm; ved tre
sekundærmerker er bildene økt til 23 mm med lesbare bildetekster. Bare
hedersdiplomets lyse metalltekst har fått mørkere trykksverte; rammene og
medaljenes farger er bevart. Alle merker er fortsatt designutkast.
