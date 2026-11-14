# C1.2 – offentlig testportal på GitHub Pages

Utgangspunkt: `main` etter PR #35 (`8128c36`). Den ferdige byggepakken inneholder
`admin/index.html` og kan publiseres direkte til:

**https://morothon-no.github.io/historikk/admin/**

Dette er en statisk nettversjon, ikke en proxy til localhost. Åpning og bruk
krever ingen installasjon, Node-server, konto eller kommandolinjeverktøy hos
besøkeren. Innlogging, kundeseparasjon og administrativ lagring er ikke etablert.
Siden er derfor tydelig merket **offentlig testversjon**, har `noindex, nofollow`
og tilbyr bare godkjente offentlige data og ingen administrative skrivefunksjoner.
En skjult adresse er ikke tilgangsbeskyttelse.

## Hva fungerer i nettversjonen?

| Modul/handling | Status |
| --- | --- |
| Oversikt | Dynamiske nøkkeltall, siste utgaver, nye merker og snarveier |
| Deltakere | Søk/aliaser, sideinndeling, resultatvisning og lenke til riktig løperprofil |
| Merker | Opptjente nivåer/år og antall deltakelser til neste merke; ingen prognose om år/påmelding |
| Diplomverksted | Mottakervalg, historiske løpermerker, tillatte Heder-hovedmerker, begge medaljevisninger, rekkefølge og kontrollrapport |
| Forhåndsvisning | Faktisk, isolert A4-dokument med eksisterende bilde-, font-, innholds- og layoutkontroller |
| Enkeltutskrift/PDF-dialog | Bare kontrollert, valgt enkeltdiplom. Kontrollkopier beholder synlig merking |
| Samlet PDF/produksjonsrapport | **Ikke tilgjengelig på Pages.** Krever den eksisterende lokale C1-serveren |
| Import og Premier | Tydelige plassholdere; ingen opplasting, lagring, tildeling eller bestilling |

Bruk «Vis» ved ønsket diplom og deretter «Skriv ut valgt diplom» eller
«Lagre via nettleserens PDF-dialog». Velg liggende A4, 100 %, bakgrunnsgrafikk
på og ingen topp-/bunntekst. PDF-valget avhenger av nettleser/operativsystem.
Dette er samme type nettleserutskrift som på de eksisterende profilsidene,
**ikke** C1s Chromium-/Poppler-kontrollerte, samlede PDF-produksjon. Ingen ny,
ukontrollert sammenslåingsprosess er innført. Kvalitetsvarsler vises fortsatt.

Inger har fortsatt 10 deltakelser, 2015–2024 og 9. november 2024 på sølvdiplomet.
«Alle merker» kan bare inneholde merker opptjent senest ved den valgte prestasjonen.
Den nye løpersamlingen er fortsatt en kontrollkopi. Heders eksisterende
presentasjonsgodkjenninger, minne-/grunnleggerregler og ukjente datoer bevares.
Einars særskilte dato er 7. november 2026; ingen ukjent opptjeningsdato gjettes.
Erling Danielsen er fortsatt skjult fra Heder. Verken visning eller utskrift
skriver til `awards`, `issuedDiplomas`, godkjenningsregister eller historikk.

## Én motor og to leveringsmåter

Felles HTML/CSS, portalbetjening, lesemodell og diplomadapter gjenbrukes fra C1.1:

```text
tools/diploma-admin/portal-data.cjs   Samme lesemodell i Node og nettleser (UMD)
tools/diploma-admin/engine.js        Samme diplomadapter, med eksplisitt dokumentargument
web-admin/web-transport.js          Statisk lesing/kontroll, ingen HTTP-API eller skriving
web-admin/profile-contract.js       Delt profilvalidering i bygg, uavhengig gate og nettleser
web-admin/event-profile.json        Offentlig, validert Morothon-standardprofil
scripts/lib/runtime-files.cjs       Eksakt kilde→publiseringsliste for 9 adminfiler
```

Byggeren tar kun de eksplisitt valgte nettleserfilene. Node-serveren,
`api.cjs`, `worker.cjs`, private registre, tester og dokumentasjon inngår ikke i
nettsiden. Det lokale verktøyet starter som før med `npm run admin` eller
`npm run diplomer:admin`, og beholder samlet PDF-produksjon. Ingen ekstern port
åpnes og ingen lokal server eksponeres.

På Pages bruker frontend et lese-/forhåndsvisningsadapter i stedet for API-et.
Det leser bare den eksisterende godkjente datapakken, kontrollerer datahashene
mot offentlig manifest og bruker den samme beregningsmodellen. Diplomkonteksten
bruker den eksisterende offentlige motoren i en isolert iframe. Hver forhåndsvisning
kontrolleres på et ekte A4-dokument, og sjekkes på nytt før enkeltutskrift.
Endret dokument, manglende grafikk eller ugyldig godkjenning omgås ikke. Et nytt
build-/datagrunnlag etter innlasting krever omlasting før videre diplomkontroll.

Alle URL-er er relative til publisert `/historikk/`, også data, fonter, bilder,
stilark, skjulte motorkontekster og profillenker. Menyen bruker hash-ruter;
Pages trenger ingen serveromskriving for undermodulene. Manglende nettadapter
feiler tydelig og faller ikke tilbake til localhost-API-et i nettmodus.

## Arrangementsprofil, versjon 1

Profilen kontrollerer navn/logo, primær-/sekundærfarger, bakgrunn/flate/tekst,
godkjente fontreferanser, distansevisningsnavn, overskrifter/standardtekster,
modulsynlighet og referanser til merke-/diplomoppsett. Morothon er standard.

Kontrakten avviser ukjente felt, vilkårlig CSS/HTML, eksterne font-/logo-URL-er,
ukjente maler og endring av deltakelsespolicy. Logoen må finnes i det godkjente
asset-registeret. Navn på distanser er visningstekst; råresultater, eksakt distanse,
kjønn, periode, identitet og merkeberegning endres ikke av dette feltet.

Profilfarger og fonter gjelder **portalens grensesnitt**. De setter ikke nye
farger/tekster i allerede godkjente diplomer. Malreferansen er eksplisitt låst til
nåværende kontrollerte motor. En senere designendring i diplomet må få nye
innholdsspesifikke kontroller og godkjenninger; en UI-profil gir ingen slik rett.
Skjulte moduler er et produktvalg, ikke tilgangskontroll. De godkjente offentlige
dataene er fortsatt offentlig tilgjengelige.

Dette er et modulært utgangspunkt, ikke et løfte om ferdig kundeoppretting eller
en generisk ny beregningsmotor. Flere arrangører kan bruke samme kode med egne,
kontrollerte profiler/data. Kundens redigering uten GitHub kommer i C1.3;
[datakontrakt og konkret plan](c13-designadministrasjon.md).

## Datagrense og sikker publisering

Offentlig datapakke, SHA-256, historikkbinding og dataversjon er uendret.
Den eksisterende godkjenningsreferansen brukes. Byggepakken har **68 filer**:
de tidligere 59 og **9 eksplisitte nettleserfiler under `admin/`**. Ingen generell
kopiering av verktøymappen er tillatt. Ukjente filer, symlenker, råregistre,
private felt, lokal øktnøkkel i HTML eller ugyldig arrangementsprofil stopper bygget.

Dette utvider selve publiseringskontrakten og trenger eiers eksisterende
`MOROTHON_REVIEWED_POLICY_HEAD`-godkjenning av sluttcommiten før CI kan bli grønn.
Ingen verdi settes av Codex. Datamanifestet er uendret; ingen ny data-SHA
foreslås eller godkjennes automatisk.

**Uavhengig artefaktgate beholdes i egen, frisk runner uten npm/PR-tester.**
Normalt brukes validator fra beskyttet base. En slik faktisk kontraktoppgradering
kan først etter ekstern, eksakt head-godkjenning bruke validator fra en **ny
utsjekk av det gjennomgåtte hodet**. Den kjører aldri testjobbens overskrevne
kopier eller kode fra selve artefaktet. Datareferansen hentes fortsatt fra base.
Dette eksplisitte unntaket trengs fordi gammel base ikke godtar den nye
admin-mappen. Uten gjennomgangen stopper den eksisterende policyporten.
Vanlige senere app-/testendringer bruker base og trenger ingen ny SHA-verdi.

## Fra PR til faktisk nettadresse

1. Eier gjennomgår PR-en, godkjenner kontraktoppgraderingen og lar sjekkene kjøre.
2. Eier merger først etter godkjenning. Denne leveransen merger ikke automatisk.
3. Eksisterende main-jobb bygger og validerer den samme komplette Pages-pakken.
4. Normal Pages-deploy inkluderer `admin/index.html`; ingen manuell filkopiering
   eller lokal server er nødvendig etter merge.
5. Et nytt, lite steg **etter deploy** henter faktisk Pages-adresse, adminfiler,
   runtime-filer og offentlige data, og sammenligner SHA-256 mot testet artefakt.
   Feil adresse, 404, foreldede eller endrede bytes gjør produksjonsjobben rød.
   Kort, begrenset ny prøving håndterer Pages/CDN-forsinkelse.

Et feilet etterkontrollsteg betyr ikke at deploy er automatisk rullet tilbake;
nettsiden kan da allerede være aktiv. Undersøk feilen og korriger gjennom en
kontrollert PR/ny kjøring. Ingen automatisk sletting, rollback eller ny merge
utføres. Før merge er nettadressen **ikke** påstått oppdatert: det er etter
normal deploy og bestått etterkontroll den skal være operativ.

## Sluttkontroll, 14. november 2026

- `npm run test:public`: **69/69 bestått**, ingen hoppede tester. Omfatter også
  eksisterende lokal C1/C1.1, historiske beregninger, isolert offentlig bygg,
  mobilgraf, diplomer, uavhengig gate og den nye statiske nettportalen.
- `node --test tests/public-export.cjs`: **6/6 bestått**. Kontrollerer blant annet
  samme 43 synlige personer og alle 86 eksisterende Heder-diplomgrunnlag, skjult
  Erling Danielsen, private felt og de fire eksplisitte CI-artefaktene.
- De **7 C1.2-testene** er inkludert i de 69 og kjørt på nytt etter siste
  tekst-/visningsjustering. De prøver faktisk `/historikk/admin/` på en statisk
  filserver uten adminserver/API, ekte data, søk/historikk/merker, plassholdere,
  begge medaljevalg, kontrollkopier, blokkert manipulert diplom, Einar/Oscar,
  endret utgivelse og produksjonskontrollen mot manglende/foreldede nett-filer.
- Chromium: PC **1440 px**, nettbrett **768 px**, mobil **390 px**. Ingen
  konsoll-/nettverksfeil, API-/skrivekall eller utilsiktet horisontal rulling.
  Én faktisk A4-PDF kontrollert med `pdfinfo` og innebygd Caveat med `pdffonts`.
  Ingen masseproduksjon av historiske PDF-gallerier er nødvendig her.
- `npm run build` og separat `npm run public:kontroll`: **68 godkjente filer,
  43 synlige profiler, dataversjon 1**. `npm run data:check-sources` bekrefter
  samsvar med allerede godkjent offentlig datapakke.
- `data/`, `public-data/`, `assets/`, `js/`, `css/`, `index.html` og `heder.html`
  er uendret fra utgangspunktet. Ingen nye avhengigheter, private data eller
  skjermbilde-/PDF-filer følger Git-endringen.

En eksisterende mobilgraf-test traff Chromium-inertialrulling ved umiddelbar
endring av skjermbredde. Testen venter nå på faktisk `scrollend` før den separate
resize-kontrollen. Alle opprinnelige assertions er beholdt, ingen større timeout
eller endring av grafkode. Tre isolerte kjøringer og hele pakken er bestått.

Kontrollbildene regenereres med:

```sh
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c1-review node --test tests/public/visual/web-admin.cjs
```

De ligger under `web-c12/` i det eksisterende CI-artefaktet
**morothon-c1-diplomverksted**: `oversikt-{1440,768,390}.png`,
`diplomer-{1440,768,390}.png` og `oscar-enkeltvisning-a4.pdf`. Artefaktet opprettes
når PR-jobben får kjøre etter den nødvendige kontraktgodkjenningen. Ingen store
kontrollbilder legges i produksjonsgrenen.

Dette er lokale målinger og gjennomgåtte kontrollbilder. GitHub Actions og
faktisk Pages-adresse kan først bekreftes etter henholdsvis PR-kjøring og merge/
normal produksjonspublisering. Ingen merge eller publisering er utført i oppgaven.
