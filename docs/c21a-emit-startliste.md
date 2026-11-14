# C2.1a – Emit-startliste og manuelle distanser

Utgangspunkt: `main` etter PR #39 (`e4f1a57`). Ingen endringer i Actions,
publiseringsregler, godkjente data, medaljer eller diplomer. Eksisterende tre
importfiler videreutvikles; filkontrakten er fortsatt 74 filer / 15 adminfiler.

## Støttet format

Den dokumenterte Morothon-eksporten `Startlist-79664-20261106232038.xml` har
rot `startliste`, `provider company="Emit as" versjon="Ver 1.0"`, valgfri
`changed date="YYYY-MM-DD HH:MM:SS"` og direkte `start`-rader med attributter.
Dette kalles **Emit XML**, ikke et generisk EQ Timing-format. Den ekte filen er
ikke brukt i kode, tester eller kontrollbilder. Alle testopplysninger er fiktive.

Feltene `fornavn`, `etternavn`, `team`, `startno`, `klasse`, `starttid` og
`nasjon` normaliseres til navn, klubb/lag, startnummer, klasse, starttid og
nasjon. Startnummer beholdes som tekst, inkludert innledende nuller. Verken
startnummer eller brikkenummer brukes som varig person-ID. `ecard`/`ecard2`
trengs ikke i analysen og sendes ikke til rapportene.

Leverandør, formatversjon og endringstidspunkt bevares som kildemetadata.
Endringstidspunktet angir **ikke** løpsdato eller arrangementsår. Velg riktig
år i portalen. XML-namespace, leverandør/versjon, grunnstruktur, dato/tid,
radantall og feltlengder kontrolleres. Ukjente varianter får konkret feilmelding.
DTD, entitetsdeklarasjoner og ugyldig XML avvises. Importert tekst settes med
`textContent`; den blir ikke HTML, kode, lenker eller eksterne forespørsler.

CSV/TSV (nå også `.tsv` i filvelgeren), IOF 3.0 PersonStart og Participant-XML
beholdes. XLSX og IOF TeamStart er fortsatt utenfor delsettet. Grensene er
fortsatt 4 MB, 5000 rader og 1000 tegn per felt. Ingen nye avhengigheter.

## Praktisk test med arrangørfilen

Etter gjennomgang, merge og vellykket Pages-kjøring åpnes
[Årets arrangement](https://morothon-no.github.io/historikk/admin/#import).
PR-en publiserer ikke funksjonen automatisk.

1. Sett **Arrangementsår til 2026** for den dokumenterte 2026-filen. Forslaget
   i portalen er neste år etter siste historikkår; filens `changed` erstatter
   aldri dette valget.
2. Velg XML-filen. Kontroller 449 rader, navn med norske tegn, startnummer,
   klubb, klasse og starttid. Eksportens faktiske stafettmerking må kontrolleres:
   bare en eksplisitt klasse med «stafett»/«relay» markeres separat automatisk.
   Ved den beskrevne fordelingen forventes 15 stafettoppføringer.
3. Under **Velg distanser** vises manglende distanse først. Søk på navn,
   startnummer, klasse eller klubb og trykk **Søk i listen** / Enter. Søk er
   bare et utvalg: det velger aldri en distanse.
4. Marker enkeltrader, eller **Marker alle treff** på tvers av sider. Velg en
   godkjent øvelse, trykk **Forhåndsvis distansevalg**, kontroller antall/navn og
   trykk **Bruk distansevalget**. Avbryt endrer ingenting. **Angre siste
   distansevalg** gjenoppretter forrige utvalg; flere valg kan angres i rekkefølge.
5. Gjenta for øvrige distanser. Bruk «Individuelle oppføringer» / «Alle
   oppføringer» for å rette tidligere valg. Stafett står separat, og eksplisitte
   stafettoppføringer kan ikke massekonverteres til individuelle løpere. En
   umerket oppføring kan manuelt klassifiseres som stafett.
6. Åpne **Personkontroll**, se kandidatens historikk og bekreft eller avvis
   forslag. Navn/alias alene bekrefter ingen identitet. Alle valg er midlertidige.
7. Kontroller **Merkeprognoser** og **Bestillingsoversikt**. Manglende distanse
   gir ingen merkemottaker, heller ikke for bekreftet identitet. Uavklart
   identitet gir usikre muligheter. DNS/DNF, ett år per person, aktive terskler
   og stafettunntaket følger fortsatt den felles motoren.
   Historikken inneholder allerede 2026-resultater. En person som allerede har
   tellende deltakelse i 2026, får derfor ikke et ekstra år eller samme merke
   foreslått på nytt ved test av denne gamle startlisten.
8. Last ned CSV-rapportene lokalt. Importoversikten skiller mellom distanse i
   kilden og arrangørens distansevalg og inkluderer starttid/nasjon. Alle fire
   rapporter har format, leverandør, versjon, kildeendringstid og eksisterende
   hash-/FORELØPIG-metadata. Rapportene inneholder personopplysninger og skal
   oppbevares forsvarlig, uten å lastes opp som offentlige kontrollfiler.
9. Last inn en nyere eksport i samme fane. Nye/endrede/uendrede/manglende rader
   vises. For Emit uten stabile person-ID-er videreføres person- og distansevalg
   bare for entydige, helt uendrede kilderader, også ved endret rekkefølge. Et
   gjenbrukt startnummer alene er ikke tilstrekkelig. Endringer i navn, klubb,
   klasse, starttid, nasjon eller annen radinformasjon åpner kontrollen igjen.
   Manglende rad betyr aldri DNS, avmelding eller sletting.

Filer, valg og angrehistorikk lever bare i fanens minne. Omlasting/lukking
mister arbeidsøkten. Ingen serverlagring, ekstern API, resultatimport, tildeling
eller permanente identitetskoblinger er innført.

## Kontroll og bilder

Målrettede tester dekker 449 syntetiske Emit-rader med 15 stafettoppføringer,
norske tegn/escaping, tekstbaserte startnummer, starttid/nasjon, metadata,
manglende distanse, massevalg, avbryt/angre, separate distanser, duplikater,
ugyldig XML/versjon/DTD, reimport og trygge/usikre personvalg. Eksisterende
CSV/TSV-, IOF-/Participant-, identitets-, status- og rapporttester beholdes.

`tests/public/quick/fixtures/emit-data.js` ligger innenfor eksisterende sparse
checkout. Regresjonstesten materialiserer **workflowens faktiske filutvalg**,
verifiserer fixturefilene og kjører C2.1a-testene både der og i en videre isolert
pakke. Administrative originalregistre er utilgjengelige i begge miljøene.

Kontrollbilder genereres av Chromium på 1440, 768 og 390 px. Bare syntetiske
startlister og syntetisk løpshistorikk brukes. I PR-kjøringens eksisterende
artefakt **morothon-c1-diplomverksted**, se `intake-c21/`:

- `emit-startliste-{1440,768,390}.png`: komplett arbeidsflate.
- `emit-distansevalg-{1440,768,390}.png`: nærmere kontroll av distanseverktøyet.
- C2.1s tidligere startliste/personkontroll/bestilling-bilder regenereres også.

Lokal regenerering (velg en ny/tom katalog til bygg):

```sh
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c21a-review node --test tests/public/visual/intake.cjs
node --test tests/public/quick/intake.cjs tests/public/quick/public-fixtures.cjs
npm run test:public
node --test tests/quality-v32.cjs tests/public-export.cjs
npm run build -- /tmp/morothon-c21a-site
npm run public:kontroll -- /tmp/morothon-c21a-site
npm run data:check-sources
```

Se [stagingkontrakten](contracts/startlist-v1.md) og
[eksisterende C2.1](c21-startliste-import.md). Faktisk produsentfil må fortsatt
prøves av arrangøren før godkjenning; syntetisk formatstøtte er ikke dokumentasjon
på at alle eksisterende Emit/EQ-varianter fungerer.

## Sluttresultat – 14. november 2026

- 19/19 målrettede import-/nettleser-/fixturetester består.
- `npm run test:public`: 96/96 består, ingen hoppede tester.
- Samme komplette offentlige pakke er kjørt igjen i en isolert kopi uten
  `data/` eller eksportverktøy: 96/96 består.
- De ekstra kilderegresjonene `quality-v32.cjs` og `public-export.cjs`: 13/13.
  Dette gir 109 ulike beståtte tester totalt; de 19 målrettede inngår i de 96.
- Produksjonsbygg og separat offentlig pakkekontroll består: 74 tillatte filer,
  43 synlige Heder-profiler, uendret godkjent dataversjon 1.
- `data:check-sources` bekrefter at kildene fortsatt samsvarer med godkjent eksport.
  Eksisterende tester bekrefter også 86 uendrede Heder-diplomgrunnlag.
- Chromium er kontrollert på 1440/768/390 px: ingen konsollfeil, ingen
  utilsiktet horisontal siderulling, ingen opplasting/API/eksterne kall eller
  lagring av importdata i localStorage. CSV-rapporter lastes bare ned lokalt.
- Ingen endringer i `.github/`, bygg-/sikkerhetsskript, npm-avhengigheter,
  offentlige originalfiler eller godkjente data/medaljer/diplomer. Relative
  dokumentlenker og `git diff --check` består.

GitHub-API-et avviser lesing av Actions med `Forbidden` i dette arbeidsmiljøet.
Resultatene over er lokale målinger, ikke bekreftelse på grønn GitHub-kjøring.
PR/Actions og kontrollartefakt må kontrolleres i GitHub når PR-en er opprettet.
Ingen merge eller publisering er utført.
