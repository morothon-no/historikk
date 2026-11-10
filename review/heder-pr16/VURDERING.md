# PR #16 – vurdering før visuell godkjenning

Arbeidet fortsetter på `codex/morothon-aeresmerke-utkast`. Utgangspunktet for denne sluttjusteringen er `861cd132e24e6380b7540cec2f227ac09831a7d1`. Ingen ny PR er opprettet, og ingenting er merget eller publisert.

## Faktiske originaler og forbedringer

[Galleriet](README.md) og [HTML-visningen](index.html) gjengir de ni SVG-filene fra merkeregisteret i Chromium. SHA-256 for hver vektor står i [kontroll.json](kontroll.json). Ingen AI-bilder eller plassholdere er brukt.

- 5 **Ivrig hjelper**: enkel bronse og én stjerne.
- 10 **Dugnadshelt**: sølv og to stjerner.
- 15 **Trofast ildsjel**: gull/grønt og flamme.
- 20 **Bærebjelke**: søyler og burgunder/gull.
- 30 **Fredet inventar**: forsterket dobbel gullramme, laurbær og stjerne.
- 40 **Morothon-legende**: fasettert platinaramme, diamant og glimt.
- **Morothons æresmerke**: egen gullstrålende ordensstjerne, krone og løper, uten automatisk årsterskel. Det skiller seg fra den platinafargede dugnadslegenden.
- Hedersildsjel og Grunnlegger er bevart. Den eldre, generelle Dugnadshelt-filen beholdes kun for kompatibilitet; den er ikke et tiende nivå i det nye galleriet og konverteres ikke automatisk til en ny tildeling.

Symbol og tall er flyttet til separate felt. Den gamle dekorstreken gjennom tallene er fjernet. Lange titler er satt over to linjer, og småteksten på dugnadsmerkene er større. Alle synlige tekstfelt holder seg innenfor bildeflaten, og de lange titlene holder seg innenfor navnebåndet. Kontroll er gjort med standardfonten DejaVu Sans og Arial-kompatibelt miljø (Liberation Sans på Linux). De sju oppdaterte SVG-ene har Arial/sans-serif som reservefont. Dette er ikke en egen fysisk Windows- eller iPhone-kontroll.

## A4 og riktige milepæler

Ti faktiske A4-prøver er vedlagt: seks anonyme dugnadsnivåer, Oscar/Erling ved 30 og deres to æresutkast ved 35. PNG-ene er gjengitt i omtrent 300 DPI (3509 × 2481 px med Chromiums avrunding). PDF-ene har én liggende A4-side hver. Alle heter **UTKAST-IKKE-UTDELT**.

En reell feil er rettet: 30-diplomet viste tidligere dagens 35 utgaver og 35-årstekst, selv om datoen var 2021. Nå viser begge:

- **30 utgaver**, **1992–2021**, **Søgne, 13. november 2021**.
- Den valgte Fredet inventar-teksten om å søke Riksantikvaren om fredning.
- Bare den historiske milepælens merke, uten senere hedersforslag.

Æresutkastene beholder **35 utgaver**, **1992–2026** og **Søgne, 7. november 2026**. De seks anonyme eksemplene har korrekt valgt humoristisk tekst og **blank dato**, uten oppdiktede arrangementsår. Oversikten beskriver nå riktig antall for hvert eksempel, i stedet for å kalle alle seks femårsutkast.

Hovedmerket er 55 mm. Tre sekundærmerker er økt fra 17 til 23 mm og har større bildetekster. De passer innen samme service-grid. Lyse metallfarger er bevart på rammer/medaljer, mens service-tekst på lyst papir er mørknet. Laveste målte kontrast for de kontrollerte tekstfeltene i de ti prøvene er **4,90:1**, over kontrollkravet 4,5:1. Håndskriftstil, datolinje og signaturfelt er bevart.

## Bildekvalitet og gjenstående godkjenning

SVG-medaljene er skalerbare vektorer og har **ingen fast original-DPI**. Deklarert SVG-bredde 2400 er ikke bevis på en 2400px-bitmaporiginal. Kvalitetsvisningen skiller derfor mellom SVG og faktiske PNG-er.

PDF-kontrollen viser at nye SVG-motiver beholdes som vektorer og at skriftene er innebygd. De to eksisterende PNG-merkene er fortsatt 2400 × 2400 px og gir omtrent 2650 DPI ved 23 mm. PDF-utdrag bekrefter at disse PNG-ene er innebygd med 2400 × 2400 piksler. Vannmerket er rasterisert separat ved 300 DPI. Ingen godkjent løperoriginal er erstattet eller oppskalert.

Det er ikke funnet avkuttet motiv eller tekstoverlapp i de kontrollerte visningene. Hovedtitler og store tall er tydelige. Små sekundærmerker skal fortsatt identifiseres også av bildeteksten; all mikrotypografi inne i en liten medalje kan ikke forventes lest som på et stort nærbilde. Fargegjengivelse, materialvalg og den endelige visuelle rangeringen må godkjennes av arrangøren, gjerne med fysisk prøveutskrift i riktig størrelse. Dette er **ikke** en trykkgodkjenning.

Alle merker beholder `design-draft`, `printReady:false` og uendrede godkjenningsvarsler. Ingen nye `awards` eller `issuedDiplomas` er registrert. Alle hedersdiplomer har fortsatt `previewOnly:true`, `imageReady:false` og ingen offentlig PDF-/utskriftsknapp. Hederssiden er uten hoved-/mobilmenylenke og har `noindex, nofollow`.

## Tester og bevaring

**Hele regresjonspakken består: 133/133 tester**, ingen hoppet over. Kjørt med `node --test --test-concurrency=4 tests/*.cjs` (248 sekunder). `npm run build` består med 55 runtime-filer, versjon `52dbc52e295d73c2`. JavaScript-syntaks, `git diff --check` og offisiell actionlint består. De målrettede kontrollene består: 21 eksisterende heders-/datotester og 10 kontroller av SVG-geometri, opptjening, kontrast og kvalitetstekst.

Nye tester dekker alle ni vektorer i to fontmiljøer, symbol/tall-avstand, navnebånd, tekstoverlapp, riktige historiske 30/35-utkast, anonyme datoer, valgte tekster, lesbar kontrast og bevaring av alle historikk-/ID-/tildelingsdata. Ordinær diplomimplementasjon utenfor service-funksjonene er identisk med utgangspunktet. Ekstra CSS er begrenset til `.diploma-service`; ordinære løperdiplomer kontrolleres også med eksisterende rasterregresjoner.

Historikkfilen, person-ID-ene, aliasene, frivilligdataene, merkeregisteret og godkjente løpermerker er uendret. Det er ingen automatisk tildeling. `review/heder-pr16/` inneholder bare gjennomgangsmateriale og inngår ikke i nettstedets eksplisitte runtime-bygg.

Gjenskap materialet med:

```sh
node scripts/review-honor-badges.cjs review/heder-pr16
node --test --test-concurrency=4 tests/*.cjs
npm run build
```

GitHub-kontrollen for den pushede grenen vises i [Actions](https://github.com/morothon-no/historikk/actions?query=branch%3Acodex%2Fmorothon-aeresmerke-utkast). Ingen merge eller publisering skal utføres før arrangørens visuelle godkjenning.
