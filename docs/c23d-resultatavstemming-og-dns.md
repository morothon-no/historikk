# C2.3d – Resultatavstemming og DNS

Utgangspunkt: `main` etter PR #49 (`41fa8eb`). Resultatimporten bruker fortsatt
C2.3s parser, skjemamaler og kildebinding, og C2.2/C2.4as eksisterende sakspakke,
konsekvensmotor og kontrollerte endringskandidat. Ingen historikkdata endres.

## Regler for DNS og DNF

- **DNS: ikke startet.** En gyldig DNS uten motstridende dokumentert start er
  informasjon, ikke forslag til ny profil, nytt resultat eller tellende år.
  Den vises under **Ikke startet (DNS)**, uten godkjenningsknapper, og tas ikke
  med i den vanlige arbeidslisten eller nye rettingssaker.
- DNS mot en eksisterende fullføring, DNF eller annen dokumentert start i samme
  registreringsscope er fortsatt en sperret kildekonflikt. Støttende startnummer
  kan avdekke konflikt også når øvelsen er endret. DNS i en annen øvelse er ikke
  i seg selv et bevis mot at personen startet et annet løp samme år.
- Motstridende ID/startnummer, ugyldige felt eller DNS med positiv sluttid
  skjules ikke. Et uttrykkelig DNS med nullplassholder `0:00`/`00:00:00` kan
  derimot leses som ikke-start; null blir aldri en fullføring eller gyldig sluttid.
- **DNF: startet, ikke fullført.** Året teller som deltakelse, men uten sluttid
  eller fullførte kilometer. Et positivt tidsfelt sammen med uttrykkelig DNF
  behandles ikke som sluttid: den normaliserte importvisningen bruker DNF,
  mens råtiden bevares som `sourceTime` i den lokale kontrollrapporten og
  kilde-/tolkningsbindingen. Ugyldige tidsfelt skjules ikke.
- Eksisterende historiske DNS/DNF-rader beholdes. Likeverdige status-/tidsformer
  omskrives ikke automatisk. En allerede uendret historisk DNS kan fortsatt inngå
  i gruppen Uendrede; den krever heller ingen handling.

Den offentlige profilkoden var allerede riktig og er uendret: DNS filtreres
ut av resultatlisten og deltakelsesårene; DNF vises som DNF uten numerisk
sluttid og teller året med. Et DNS-år mellom første og siste deltakelse vises
som **ingen registrert start** i årstidslinjen. Ny nettlesertest kontrollerer
dette på PC, nettbrett og mobil, også når en syntetisk DNF-kilde inneholder tid.

## Hvorfor arbeidslisten ble for stor

Den tidligere `Results.review()` skilte ikke et nytt DNS fra et nytt tellende
resultat. Manglende historisk treff falt gjennom til «Ny registrering» eller
personavklaring, selv om resultatstatusen allerede fortalte at personen ikke
startet. DNS ble dermed en unødvendig manuell kontrollsak.

Tidligere kunne også én uavklart resultat-/personkobling gi både en kontrollsak
for importlinjen og «Mangler i ny kilde» for den mulige historiske motparten.
Nå bevares forbindelsen til aktuelle historikkrader:

- Usikker personidentitet vises fortsatt som personkontroll.
- Valg mellom resultater for en støttet personreferanse vises som
  **Resultat til avklaring**, uten å påstå personkonflikt.
- Mulige historiske motparter vises som **Tilknyttet historikk – informasjon**,
  med kilde-linjen som skal avklares. De teller ikke som ekstra kontrollsaker.
  Dette hevder verken at radene er riktig koblet eller faktisk mangler.
- En historikkrad uten slik tilknytning vises fremdeles som manglende kobling.
  Filtrert eksport og fravær fra en fil gir aldri automatisk sletting.
- Når personen/registreringen avklares, beregnes både koblinger og mangler på
  nytt. Flere reelle starter beholdes; usikre navn gir ingen permanent kobling.

Et nytt tellende resultat skiller dessuten mellom forslag til eksisterende
løper og behov for ny identitetskontroll. Bare et uttrykkelig bekreftet tillegg
for en eksisterende kanonisk profil kan bli en `add`-sak. Nye personer opprettes
ikke automatisk. Moderate navnelikheter uten annen støtte forblir uavklart.

## De to oppgitte resultatkorrigeringene

De to refererte historiske registreringene ble kontrollert lokalt mot gjeldende
godkjente historikk: begge hadde én entydig registrering ved oppgitt år og
startnummer, med de oppgitte eksisterende verdiene. Ingen verdi ble endret.

Syntetiske tester bruker tilsvarende to korreksjoner: én endrer øvelse,
20/10 km og tid, den andre tid. Støttende navn og startnummer finner de eksakte
eksisterende radene, uavhengig av endret øvelse. Dette var allerede støttet og
er bevart. En dokumentert personreferanse, kompatibelt navn og nøyaktig én
historisk start kan nå også støtte et slikt resultatpar uten startnummer.
Det er ingen automatisk personkobling eller produksjonsretting.

Uten startnummer eller dokumentert ID blir en tvetydig retting kontra ekstra
start et valg av registrering; endret øvelse alene merkes ikke som identitetsbevis.
Motstridende ID-er, navn og gjenbrukte startnumre overstyres ikke.

## Hva som faktisk er undersøkt fra 2026

Den godkjente historikken har **398 individuelle 2026-rader**, hvorav
**393 fullføringer og 5 DNF**. Årsoppsummeringen oppgir i tillegg **52 DNS**.
Dette støtter hypotesen om DNS-støy, men beviser ikke at alle de 52 nye radene
i den aktuelle CSV-en var DNS.

**Den ekte CSV-filen fulgte ikke vedlegget og ble ikke funnet blant tilgjengelige
CSV-/TSV-filer.** Derfor er verken den konkrete personkonflikten, den konkrete
manglende koblingen eller innholdet i alle de 52 radene identifisert her.
Ingen reelle personopplysninger er lagt i nye tester, logger eller dokumentasjon.
Den faktiske eksporten må prøves privat for å avgjøre disse tre spørsmålene.
De syntetiske scenariene nedenfor er ikke en påstand om årsaken i den ekte filen.

## Måling før og etter

Begge versjoner av `Results.review()` ble kjørt mot de samme syntetiske filene.
«Før» er koden på `41fa8eb`; resultatene er ikke ekstrapolert fra antall linjer.

| Scenario med 454 kilderader | Før | Etter |
| --- | --- | --- |
| Gjenskaper rapportert oppsummering: 395 uendrede, 2 endrede, 1 navneavklaring, 52 nye, 1 ukoblet historikkrad og 4 stafett | 56 kontrollsaker | 3: to rettelser og én beholdt navneavklaring |
| Alle historiske resultatpar har tilstrekkelig støtte; 396 uendrede, 2 rettelser, 52 DNS og 4 stafett | 54 kontrollsaker | 2 rettelser |

I første scenario vises 52 DNS og én tilknyttet historikkrad separat som
informasjon. Navneavklaringen skjules ikke. I et blandet testtilfelle erstattes
én av DNS-radene med en ekte ny fullføring: 51 blir DNS-informasjon, og den nye
fullføringen forblir en kontrollsak. Koden antar aldri at «52 nye» betyr DNS.

## Enkel visning og direkte klargjøring

Oppsummeringen skiller uendrede, endrede resultater, nye tellende resultater,
person-/kildekonflikter, DNS, stafett og øvrige uavklarte data. Et eget antall
viser **saker som trenger vurdering**. Standardlisten bruker én felles
`needsAttention()`-regel; DNS og tilknyttet historikk kan fortsatt åpnes separat
og er med i kontrollrapporten.

Et konkret avvik kan nå godkjennes med **Godkjenn og klargjør** direkte på
resultatkortet, etter kildebegrunnelse og eventuell nødvendig avklaring.
Samme sak sendes til C2.4a; `prepareCase()` beregner konsekvensene og klargjør
kandidaten uten en ny manuell beregnings-/godkjenningsrunde.

Tidligere lokalt klargjorte, uendrede saker i den åpne arbeidsflaten blir
konsekvenskontrollert på nytt når en ny sak tilføyes. Bare den aktuelle brukerens
nye bekreftelse og allerede klargjorte saker i fanen omfattes. Importerte
godkjenninger blir fortsatt nedgradert; andre importerte forslag får ingen
automatisk godkjenning. Endret kilde/arbeidsgrunnlag under beregning stopper
overføringen. Reelle konsekvensforbehold krever fortsatt avklaring.

Kontrollert før-/etterkandidat, tilbakeføring, kilde-/versjonssperrer og alle
publiseringskrav er de samme som i [C2.4a](c24a-enkel-rettingsflyt.md).
Ingen parallell saksmodell, ny server, skrivetilgang eller publisering innføres.

## Tester og kontrollbilder

Nye tester bruker kun syntetiske personer og kildeopplysninger. De dekker DNS,
DNF uten sluttid, positive/ugyldige tidsfelt, eksisterende og nye løpere,
øvelses-/distanse-/tidsretting, med/uten startnummer, flere starter, aliases/ID-er,
delvis eksport, uavklart kobling, gjenimport og direkte C2.4a-klargjøring.
En samlet kandidat med to direkte godkjente rettelser testes med eksakt
tilbakeføring. Historikkfilen og offentlig dataeksport er uendret.

Chromium-bilder fra PC/nettbrett/mobil genereres i eksisterende artefakt
`morothon-c1-diplomverksted`, under
`results-c23a/c23d-to-oppgaver-{1440,768,390}.png`. Bildene bruker syntetiske data.
Store bildefiler eller faktiske saks-/resultatfiler sjekkes ikke inn i Git.

### Utført leveransekontroll

| Kontroll | Resultat |
| --- | --- |
| Hele offentlige hurtignivået, `npm run test:quick` | 129/129 bestått |
| Nettleser-/PDF-regresjoner: C2.1/a, C2.2/a/b, C2.3a/b/c/d, C2.4a og C1 | 43/43 bestått |
| Offentlige funksjonsregresjoner: datakvalitet, rekorder, stafett, milepæler og tidligere navneretting | 9/9 bestått |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Administrative kilder mot godkjent eksport | `matches-approved`, uendret |
| PC/nettbrett/mobil | 1440/768/390 px, kontrollbilder gjennomgått; ingen horisontal overflow eller nye JavaScript-feil i den nye importflyten |
| Eksisterende C1/PDF | Seks A4-sider for fem mottakere, begge merkevisninger, innebygde fonter og sperring ved siste-sidefeil |

Totalt **181 forskjellige tester**, inkludert sju nye modelltester og fem nye
nettleserflyter. Gjentatte delkjøringer er ikke telt flere ganger. De offentlige
testene er kjørt i isolert kopi uten administrative originalregistre.
Full historisk diplomgalleriproduksjon er ikke kjørt lokalt for denne endringen.
GitHub Actions, sikkerhetsregler og den påkrevde CI-testplanen er uendret.
