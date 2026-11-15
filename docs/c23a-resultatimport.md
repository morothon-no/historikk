# C2.3a – Resultatimport og automatisk avstemming

Utgangspunkt er `main` etter PR #43 (`93ad1b1`). De historiske rettelsene og
offentlig datarevisjon 2 beholdes. Dette er en lokal kontrollfunksjon i den
eksisterende adminportalen, ikke en produksjonsimport eller ny Adelskalender.

## Slik prøver arrangøren funksjonen

1. Åpne **Årets arrangement** og velg **Endelige resultater – sammenlign historikk**.
2. Velg arrangementsår. Resultatflyten foreslår siste registrerte år, mens den
   eksisterende startlisteflyten fortsatt foreslår neste år.
3. Last opp CSV/TSV med endelige resultater. Antall leste linjer og filnavn vises.
4. Åpne **Kontroller eller korriger kolonnekoblinger** ved behov. Velg hvilke
   kolonner som inneholder navn, øvelse, eksakt distanse, sluttid osv.
5. Marker komplett utvalg bare dersom eksporten faktisk omfatter alle
   individuelle øvelser. Velg **Start sammenligning**.
6. Se oppsummeringen. Uendrede registreringer krever ingen behandling.
   Filtrer avvik, sammenlign gammel/ny verdi og skriv kort vurderingsgrunnlag.
7. **Bekreft resultatkoblingen**, velg eventuelt en annen eksisterende person
   og registrering, **Marker som ny person**, **Avvis forslaget** eller **Utsett saken**.
   Behandlede saker finnes fortsatt i filteret. Manglende rader kan beholdes eller
   utsettes; de får ingen slettingsknapp.
8. **Forhåndsvis konsekvenser** bruker den eksisterende motoren. Kontroller
   deltakelser, fullføringer, kilometer, beste tider, distansefordeling,
   plasseringer, rekorder, merker og berørte diplomgrunnlag.
9. **Åpne forslag i kontrollsentralen** viderefører valgte saker til C2.2 uten
   å overskrive andre saker. Der finnes full konsekvensanalyse og kontrollert
   lokal overlevering. Ingen opplysninger er sendt eller publisert.
10. Last ned **rettingspakke** for senere import med C2.2s eksisterende knapp,
    og eventuelt **kontrollrapport** med hele avstemmingen. Oppbevar dem privat.

Filer, kolonnekoblinger og beslutninger er bare i fanens minne. Ingen database,
localStorage eller sessionStorage innføres. Nedlasting er et uttrykkelig valg.
Ny sideinnlasting starter en ny arbeidsøkt. Vanlig navigasjon mellom portalens
moduler beholder arbeidet. Samme filhash ved gjenvalg beholder vurderingene.

Under gjennomgang kan grenen startes med eksisterende `npm run admin` eller
bygges og åpnes med en vanlig statisk testserver. Funksjonen er også testet på
`/historikk/admin/` uten Node-API. Den publiserte portalen får funksjonen først
etter separat merge og vellykket Pages-publisering; denne PR-en deployer ikke.

## Faktisk støttet filformat

**Ekte EQtiming-eksport fra 2026 er ikke tilgjengelig og er ikke formatverifisert.**
Ingen bestemt, faktisk EQ-eksportvariant påstås støttet. C2.3a støtter det
dokumenterte minimumet `csv-results-v1`, med syntetiske tester.

- CSV/TSV med kolonneoverskrift, semikolon, komma eller tabulator, vanlige
  siteringsregler og eventuell `sep=`-linje.
- Eksisterende dekoder for UTF-8, UTF-16 med BOM og Windows-1252-fallback.
- Maksimalt 4 MB, 5 000 rader og 80 kolonner. Overlange/ugyldige felter og
  ødelagt CSV avvises. Resultatfelter har maksimalt 200 tegn.
- Navn, eller separate fornavn/etternavn; øvelse og eksakt distanse i hver sin
  kolonne. Valgfritt startnummer, ekstern ID, MOR-ID, år/dato, klasse, kjønn,
  klubb og kildeplassering. Ingen permanent ID behøver være kjent av brukeren.
- Minst sluttid eller resultatstatus må finnes. `Starttid` er ikke sluttid.
  Manglende sluttgrunnlag og bare `Påmeldt` kan ikke bli endelige resultater.
- Gjeldende tidsparser brukes: blant annet `mm:ss`, `hh:mm:ss` og entydige
  punktformater. Sekund-/minuttoverskridelser og blandede skilletegn avvises.
- Fullført uten tid kan beholdes uten en konstruert tid. DNS/DNF i tidsfeltet
  tolkes av eksisterende statusregler. Gyldig DNF og DNS rapporteres ikke som
  ugyldige resultater. DQ-regler endres ikke.
- Blank eller utelatt kildeplassering gir ingen beregnet «kildeplass».
  Manglende kolonner bevarer eksisterende felt. Likeverdige tids-/statusformater
  omskrives ikke når annet innhold korrigeres.
- Entydige øvelsesnavn fra arrangementsprofilen gjenbrukes. Ukjente rånavn
  vises med forbehold og må kontrolleres. Kombinerte øvelse-/distansekolonner,
  millisekundspesialformater, XLSX og resultat-XML er ikke generelt støttet.
  Startliste-XML går fortsatt gjennom den separate, uendrede C2.1a-flyten.

Eksempel med utelukkende oppdiktede personer:

```csv
Navn;Startnummer;År;Øvelse;Distanse;Klasse;Kjønn;Klubb;Status;Tid;Plassering
Syntetisk Eksempelløper Nord;901;2026;Kortmoro;10 km;Herrer;Herre;Syntetisk klubb;Fullført;58:20;4
Syntetisk Eksempelløper Sør;902;2026;Morothon;20 km;Damer;Dame;Syntetisk klubb;DNF;DNF;
```

En komplett, ny eksport må hentes fra EQtimings ordinære eksportfunksjon og
testes privat før en bestemt EQ-variant kan erklæres støttet. Ingen scraping
eller udokumenterte API-kall er innført. Råeksporten skal ikke legges i Issues,
offentlig Git, testlogger eller kontrollartefakter.

## Sammenligning og identitet

| Gruppe | Betydning |
| --- | --- |
| Uendret | Koblet registrering med like relevante verdier; ingen retting |
| Endret resultat | Et sannsynlig resultatpar med konkrete før-/etter-felt |
| Ny person eller registrering | Kilden mangler koblet historisk resultat; krever vurdering |
| Mangler i ny eksport | Historisk registrering uten kildepar; ingen automatisk sletting |
| Usikker identitet | Flere eller utilstrekkelige navnesignaler; manuelt valg |
| Konflikt | Motstridende ID/navn/kjønn, startnummer eller overlappende resultatvalg |
| Stafett – separat | Lagoppføring i kontrollrapporten, ingen individuell person-/resultatendring |

C2.2as `compareNames()` gir de konservative navnesignalene. Fullt navn,
godkjente aliaser og redirects respekteres; samme fornavn og nærliggende år er
ikke identitetsgrunnlag. Startnummer brukes bare innen valgt arrangementsår
med støttende navn for å foreslå et **resultatpar**. Et endret øvelsesnavn eller
en endret distanse kan derfor fortsatt kobles til samme registrering.

Entydig fullt navn sammen med samme år/øvelse/distanse kan støtte et resultatpar
uten startnummer. Tvetydige, like navn krever derimot manuelt valg. Brukeren kan
søke etter annen person og velge nøyaktig tidligere registrering eller et tillegg.
Dokumenterte eksterne identitetskoblinger brukes bare i sitt eksakte kildeområde;
en ukjent ekstern ID blir ikke en bekreftet kobling. Ingen identiteter slås sammen.
Navn og kjønn på selve personposten endres ikke av resultatimporten; slike
rettelser behandles i den eksisterende personkontrollen.

Motstridende kilder kan ikke overstyres med et automatisk ID-valg. De må avklares
i kilden/kolonnekoblingen eller eksisterende personkontroll. Flere importerte
rader som peker på samme resultat stopper klargjøring av disse rettingene.
Flere faktiske starter i ett år beholdes, mens års-/merketall kommer fra den
samme, eksisterende motorens dedupliserte deltakelsesår.

Fullstendighet beregnes forsiktig: manglende registreringer gir «delvis/uavstemt»;
uavklarte personer, konflikter eller ubekreftet utvalg gir «usikkert». Bare et
bekreftet, avstemt utvalg fremstår komplett. Lik linjetelling alene er ingen
garanti. En rettingspakke er et utvalg uttrykkelige beslutninger, ikke en
godkjenning av alle ubehandlede kilderader.

## Rettingskontrakt og sikre stopp

Resultatmodellen er et separat `Results`-navnerom i eksisterende `intake-model.js`.
UI og stiler ligger i samme eksisterende adminfiler. Ingen ny runtime-fil,
serveravhengighet eller offentlig datapakke er nødvendig.

Rettelser bruker fortsatt **`morothon-corrections-v1`** og C2.2s `result`/`add`.
Hver aktiv retting krever et uttrykkelig person-/resultatvalg og begrunnelse.
Den bindes til importfilens SHA-256, kildeområde, år og tolkning, den godkjente
dataversjonen, manifest-/historikkhash, hele historikksnapshotet og eksakt
før-rad med SHA-256. Lokal beslutningstid bevares ved gjentatt eksport. Ingen
importert beslutning presenteres som en autentisert signatur.

Endret fil, kolonnekobling, år eller annet tolkningsgrunnlag krever ny vurdering.
Tidligere overførte, aktive forslag fra den berørte kilden settes til vurdering
i C2.2; historikk, notater og andre saker bevares. Motstridende pakker overskrives
ikke ved import. Hvis samme saks-ID allerede har et annet beslutningsgrunnlag,
må den eksisterende saken gjennomgås i kontrollsentralen.

**Kontrollrapporten** har format `morothon-results-review-v1`, versjon 1. Den
inneholder det lokale kildegrunnlaget, kolonnekoblinger, alle grupper, beslutninger, ubehandlede
avvik og tilhørende C2.2-pakke. Den er en privat arbeidsrapport, ikke en signert
dataversjon. Maksimal størrelse er 8 MB; ingen rader utelates stille. C2.2s
eksisterende grense på 500 saker / 2 MB per rettingspakke beholdes.

Gjeldende rettingskontrakt oppretter ikke nye personer, årsregistre eller
lagresultater. Ny person, separat stafettbehandling og helt ny årgang uten
godkjent arrangementsgrunnlag blir kontrollgrunnlag, uten aktiv retting.
For et eksisterende år kan et uttrykkelig bekreftet tillegg til en eksisterende
person bruke `add`. Manglende historiske rader blir aldri `remove`.

Konsekvensvisningen kjører C2.2s analyse gjennom samme `C2Project`-adapter og
eksisterende resultat-, års-, rekord-, merke- og diplommotor. Adapteren inkluderer
nå eksisterende `runnerTotals()` og distansefordeling. Ingen beregningsregel er
endret. Endringer for andre løperes plasseringer vises; kildeplassering og
beregnet plass holdes separat. Usikkerhet og endrede diplomgrunnlag beholder
eksisterende stopp før overlevering/ren utskrift.

Det er ingen produksjonsskriving, automatisk godkjenning, tildeling, merge eller
publisering. Offentlig bygg har fortsatt 74 filer / 15 adminfiler, samme
godkjente data, 43 synlige Heder-profiler og eksisterende diplomkontroller.
Administrative originalregistre, sikkerhetspolicy og workflows er uendret.
Denne kode-PR-en trenger ingen ny datapakke eller ny manuell policy-SHA-verdi.

## Test og videre arbeid

Syntetiske fixtures ligger under `tests/public/quick/fixtures/`, som inngår i
faktisk offentlig sparse checkout og isolert testpakke. Det forvekslede
2026-scenariet er gjenskapt med oppdiktede navn/ID-er, to byttede tider og én
endret øvelse/distanse. Det gir to eksisterende resultatpar og fire endrede felt.
Ingen faktiske 2026-resultater er korrigert i denne PR-en.

Modelltestene dekker CSV, manuell mapping, startliste/resultatskille, blank tid,
DNS/DNF/DQ, eksakt gjenimport, aliaser/redirects, like navn, kildeområder,
startnummerkonflikter, manglende rader, nye registreringer/personer, stafett,
flere starter, ny årgang, kildebinding og endret grunnlag. Nettlesertestene
dekker filopplasting, beslutninger, nedlasting, C2.2-overføring, ny kilde,
faktiske konsekvenser og 1440/768/390 px. Bare GET mot samme testorigin er
tillatt; originalfiler og nettleserlagring kontrolleres uendret.

Kontrollbilder genereres i eksisterende artefakt `morothon-c1-diplomverksted`,
undermappe `results-c23a/`: `sammenligning-{1440,768,390}.png` og
`konsekvenser-{1440,390}.png`. De inneholder bare syntetiske data. Ingen PNG,
råeksport eller lokal kontroll-/rettingspakke sjekkes inn.

Full obligatorisk regresjon kjøres av eksisterende Actions-oppsett. Lokalt
prioriteres målrettede tester og et offentlig bygg. C2.3b må håndtere verifisert
ekte eksportformat, autorisert ny person-/årgangsoppretting og eventuell
kontrollert anvendelse. Dette krever egne kontrakter/godkjenninger og innføres
ikke gjennom en snarvei her.

### Utført sluttkontroll

| Kontroll | Resultat |
| --- | --- |
| Målrettet modell-/funksjonspakke i isolert offentlig kopi | 62/62 bestått |
| Nettleserregresjoner for C2.1/a, C2.2/a, C2.3a og C1-diplomverksted i samme isolerte kopi | 25/25 bestått |
| Nye tester | 12 modelltester og 3 nettleserflyter med bare syntetiske data |
| Siste justering av stafettfilter | 12 modelltester og 3 C2.3a-nettlesertester kjørt på nytt, bestått |
| Rapportens tolkningshash | Kan gjenskapes fra rapportens kilde, mapping, rader og godkjente base |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Original-/eksportsamsvar og bevaring mot main | Uendrede historikk-, Heder-, dugnads-, merke-, dato-, manifest- og godkjenningsfiler |
| Mobil/nettbrett/PC | 390/768/1440 px, ingen konsollfeil eller horisontal overflow i de nye flytene |

De to isolerte testpakkene dekker **87 ulike tester** uten administrative
originalregistre. Tidligere og senere delkjøringer overlapper dette tallet.
Full lokal `npm test`, alle historiske diplomgallerier og regenerering av 86
Heder-varianter er bevisst ikke kjørt; eksisterende obligatorisk full kontroll
beholdes i Actions. C1-regresjonen inkluderer ekte samlet A4/PDF for fem
syntetiske mottakere og stopp ved feil på siste side.

En eksisterende C2.1a-visningstest er avgrenset til startlistepanelets banner
etter at resultatpanelet fikk sitt eget banner. Samme innholdskrav beholdes.
Testfixturene følger den offentlige datakontrakten, og den eksisterende
sparse-/kopieringstesten kontrollerer også det nye syntetiske resultatgrunnlaget.
Ingen test, assertion, publiseringskontroll eller godkjenningsregel er fjernet.

Faktisk EQtiming-fil for 2026, reell kilde-/konsekvensgodkjenning og ekstern
Actions-status gjenstår. GitHub-API-et har svart `Forbidden` fra dette miljøet;
grenen pushes, og direkte lenke for manuell PR-opprettelse leveres dersom
automatisk opprettelse fortsatt blokkeres. Lokale grønne tester er ikke en
bekreftelse på grønn ekstern CI. Ingen merge eller publisering er utført.
