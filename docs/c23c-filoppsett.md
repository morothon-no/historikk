# C2.3c – Gjenbruk av filoppsett og avklaringer uten ny opplasting

Normalflyten er **velg resultatfil → automatisk analyse → gjennomgå avvik**.
Dette viderefører [C2.3b](c23b-fleksibel-resultatimport.md), uten endring av
historikk, personkoblinger, startlisteflyt eller C2.2s godkjenningskontroller.

## Bruk av importen

1. Velg år og CSV-/TSV-resultatfil under **Årets arrangement → Endelige resultater**.
2. Et kjent oppsett gjenbrukes. Ellers undersøkes kolonnenavn, innhold og
   dokumenterte øvelser. Bare entydige felt kobles automatisk.
3. Manglende eller tvetydige felt gir et spørsmål i hovedvisningen, med
   aktuelle kolonner og korte innholdseksempler. Velg fullt navn eller separate
   for-/etternavn, øvelse og sluttresultat etter behov. Sikre felt spørres ikke om.
4. Ved manglende øvelsesfelt kan én dokumentert øvelse velges for hele filen.
   Ukjente øvelseskoder kan kobles til dokumenterte øvelser. Enhet og
   årsspesifikk løypelengde avklares når det er nødvendig.
5. Valget starter analysen igjen automatisk. En liten forhåndsvisning viser
   tolkningen. Gyldige rader sammenlignes selv om enkelte andre er uavklarte.
6. **Analyser på nytt**, **Endre feltvalg** og **Bruk automatisk gjenkjenning**
   er tilgjengelige uten ny opplasting. Samme fil kan velges igjen, også etter
   ufullstendig analyse. Uendret tolkning beholder lokale vurderinger; endret
   tolkningsgrunnlag krever ny gjennomgang.
7. Velg **Husk dette filoppsettet** etter kontroll. Neste fil med samme struktur
   kan bruke valgene igjen. Fortsett deretter med eksisterende avviksbehandling,
   konsekvensvisning og manuell klargjøring av rettingsforslag.

Starttid, passering og plassering godtas ikke som sluttresultat bare fordi
cellene inneholder tall. En startliste uten resultatopplysninger kan ikke
gjøres til en resultatliste ved å velge et felt. Uleselige eller ikke-støttede
formater forklares med CSV/TSV som alternativ; forrige gyldige analyse beholdes.
Manglende identitet eller ekstern ID utløser ingen automatisk sammenslåing.

## Lagring og godkjenning av filoppsett

`MorothonIntake.Results.layouts` er et versjonert register i eksisterende
`intake-model.js`. Ingen nye runtime-filer, avhengigheter eller API-er innføres.
Registeret støtter leverandørene `generic` og `eqtiming`, avgrenset til
arrangementsprofilens ID. Den medfølgende generelle malen beskriver eksisterende
`csv-results-v1`. Det finnes ingen forhåndsgodkjent, reell EQtiming-eksportmal.

Et lokalt bekreftet oppsett lagres først etter uttrykkelig valg, under
`morothon-import-layouts-v1:<arrangementsprofil>` i nettleserens `localStorage`.
Det er **konfigurasjon på denne enheten**, ikke en felles arrangørgodkjenning,
resultatgodkjenning eller permanent bekreftelse av identitet. Nettleseren sender
ikke filen til en server. Kildedata og vurderinger fra importen ligger fortsatt
bare i den åpne fanen, med eksisterende manuelle rapport-/pakkeeksporter.

Oppsett kan lastes ned som `morothon-filoppsett-v1.json` og åpnes på en annen
enhet. Import krever eksplisitt bekreftelse etter validering. Ved sperret eller
uleselig nettleserlagring vises en forklaring; nedlastbar konfigurasjon fungerer
fortsatt. Uleselige tidligere lagrede oppsett overskrives ikke automatisk.

| Felt | Tillatt innhold |
| --- | --- |
| Versjon og format | Fast kontrakt `morothon-import-layouts-v1`, versjon 1 |
| Arrangør og leverandør | Profil-ID og en av de to tillatte leverandørene |
| Kolonner | SHA-256 av normaliserte overskrifter, ikke overskriftsteksten |
| Feltvalg | Validerte kolonneindekser for eksisterende resultatfelt |
| Tolkningsregler | Eksisterende tids-/statusmotor, km/m, dokumenterte øvelseskoblinger per år |
| Ukjente øvelseskoder | Digest av koden og offentlig dokumentert måløvelse, aldri rå kildeverdi |
| Kontrollsum | SHA-256 av kanonisk konfigurasjon; integritetskontroll, ingen digital signatur |

Ingen navn, tider, resultatrader, startnummer, filnavn, kildefilhash eller frie
etiketter inngår i lagringskontrakten. Kjent person-/resultatinnhold i et feilvalgt
øvelsesfelt avvises ved lagring. Ukjente felter, versjoner og kjørbare regler
avvises. Grensene er 32 maler, 80 kolonner, 30 øvelsesregler per mal og 128 KB.
Registrering av felles maler skal fortsatt skje gjennom vanlig kodegjennomgang;
en importert lokal JSON-fil kan ikke registrere seg selv som sentralt godkjent.

## Sikker gjenkjenning og historiske lengder

- Et eksakt normalisert skjema kan gjenbrukes. Ved entydige overskrifter kan
  kolonnene også flyttes uten å miste koblingen. Like overskrifter krever samme
  rekkefølge. Nye/endret overskrifter utløser ny gjenkjenning.
- Flere forskjellige, passende lokale tolkninger krever et valg. Resultat- og
  navneinnhold kontrolleres også før lagrede feltvalg foreslås.
- Lokal konfigurasjon går foran den medfølgende generelle malen. Leverandørvalg
  endrer ikke kildeområdet eller tilliten til eksterne person-ID-er.
- Årsspesifikke regler gjelder bare det aktuelle året og må fortsatt finnes i
  den godkjente historikken. Historisk 9 km blir aldri erstattet av moderne
  10 km. Samme skjema kan bevare separate regler for flere år.
- En ny årgang uten dokumentert løypelengde får ingen oppdiktet profil.
  Eksplisitt løypelengde i kilden bevares; motstridende opplysninger sperres.

CSV/TSV-leseren leverer fortsatt tabell, overskrifter og kilde-linjenummer til
feltgjenkjenning og `inspect()`. Nye XLSX-/XML-adaptere kan senere levere denne
grensen uten å omskrive sammenligningsmotoren. De må ha egne format- og
sikkerhetskontroller; de er ikke implementert i denne leveransen.

## Kontroll og begrensninger

Testene bruker utelukkende syntetiske filer. De dekker blant annet 454 rader,
ukjente felt, delte navn, manglende sluttid, delvis ugyldige rader, flere filer,
ny analyse av samme fil, endret kolonnerekkefølge, lokal og portabel mal,
ugyldig konfigurasjon, sperret lagring og historiske øvelsesregler.
Den offentlige, isolerte testpakken kontrolleres også uten private originaler.

**Faktiske EQtiming-eksporter er ikke formatverifisert.** 454-eksemplene bruker
de tidligere dokumenterte overskriftsposisjonene og syntetiske verdier.
En reell eksport må prøves separat, uten persondata i Git, logger eller bilder.

Nettleserbildene genereres i eksisterende kontrollartefakt
`morothon-c1-diplomverksted`, under `results-c23a/`:

- `c23c-lagret-oppsett-{1440,768,390}.png`
- `c23c-avklaring-{1440,768,390}.png`

Bildene viser ekte nettleserrendering med syntetiske testdata. Store binærfiler
legges ikke permanent i produksjonsgrenen. Eksisterende C2.1, C2.2, C2.3a/b
og C1/PDF-regresjoner beholdes. Workflows, sikkerhetsregler, private kilder,
offentlig godkjent datapakke, medaljer, Heder og diplomdesign endres ikke.

### Utført leveransekontroll

Kontrollene nedenfor ble kjørt etter integrasjon av siste `main`, inkludert
C2.2b / PR #47. Testkopien inneholdt godkjent offentlig datapakke og syntetiske
testdata, uten administrative originalregistre.

| Kontroll | Resultat |
| --- | --- |
| Hele offentlige hurtignivået, `npm run test:quick` | 115/115 bestått |
| C2.1/a, C2.2/a/b, C2.3a/b/c og C1 nettleser-/PDF-regresjon | 34/34 bestått |
| Offentlige funksjonsregresjoner: datakvalitet, rekorder, stafett, milepæler og tidligere navneretting | 9/9 bestått |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Administrative kilder mot godkjent eksport | `matches-approved`, uendret |
| PC, nettbrett og mobil | 1440/768/390 px, kontrollbilder generert og gjennomgått; ingen nye JavaScript-feil eller horisontal overflow |
| Eksisterende diplommotor | Seks A4-sider for fem mottakere, begge merkevisninger, innebygde fonter og sperring ved feil på siste side |

Totalt **158 forskjellige tester**; gjentatte delkjøringer er ikke lagt til.
Ny dekning omfatter 12 modelltester og fem nettleserflyter. Full historisk
diplomgalleriproduksjon ble ikke kjørt lokalt for denne importendringen.
Eksisterende CI-testplan og påkrevde kontroller er uendret.
