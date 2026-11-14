# C1 – lokalt diplomverksted

**Oppdatert i C1.1:** Verkstedet finnes under **Diplomer** i den lokale
[administrasjonsportalen](c11-adminportal.md). Begge startkommandoene virker.
Mottakervalg, PDF-motor og godkjenningsregler er bevart.

Fungerende første arrangørpilot fra `main` etter PR #33. Den leser den godkjente
A1C-datapakken, gjenbruker diplommotoren og lager én samlet, kontrollert PDF.
Ingen originalregistre, personopplysninger, godkjenninger eller offentlige sider
endres. Dette er ikke full C1-plattform, formell utstedelse eller et register over
fysisk utdelte diplomer.

## Start og prøv

Fra repositoryets rot, etter `npm ci`:

```sh
npm run diplomer:admin
```

Åpne adressen `http://127.0.0.1:…` som vises. Porten velges automatisk.

1. Velg **Prøv fem mottakere**, eller søk og filtrer. Standardutvalget er høyeste
   løpermerke / Heders gjeldende hovedutmerkelse. Debut og rekord kan velges separat.
2. Velg prestasjon og deretter **Kun siste merke** eller **Alle merker**. Du kan
   legge til to forskjellige historiske prestasjoner for samme person.
3. Kontroller utvalget. Fjern eller flytt mottakere med knappene i jobblisten.
   **Vis** åpner et skalert, faktisk A4-diplom.
4. **Godkjent** bygger på gjeldende kontrollgrunnlag. **Kontrollkopi** trenger
   særskilt valg for å tas med, og merkes på hver berørt PDF-side. **Sperret**
   stanser eksport; rett feilen eller fjern mottakeren og kontroller på nytt.
5. Lag samlet PDF, last den ned og lagre produksjonsrapporten. Skriv deretter ut
   PDF-en med liggende A4, faktisk størrelse/100 %, uten ekstra skrivermarger.
6. Avslutt med Ctrl+C når filene er lagret. Jobblisten er i nettleserminnet;
   serverens midlertidige filer fjernes ved normal avslutning.

Kjør på arrangørens egen maskin. En loopback-adresse i et fjernt Codex-miljø er
ikke en nedlastingslenke til din PC. Piloten eksponerer ikke noen ekstern tjeneste
eller port som del av oppstarten. Ikke bruk offentlig proxy/portdeling.

### Verktøy som må finnes

Node 20+, prosjektets låste Playwright, Chromium og Poppler-kommandolinjeverktøyene
`pdfunite`, `pdfinfo`, `pdffonts`, `pdftotext`. Ingen nye npm-avhengigheter.
På Debian/Ubuntu/WSL kan systemverktøyene installeres med:

```sh
sudo apt-get install chromium poppler-utils fonts-liberation fonts-urw-base35
```

På andre plattformer brukes tilsvarende pakker og `npx playwright install chromium`.
`CHROMIUM_PATH` kan peke på en bestemt Chromium. PDF-kontrollen avviser manglende
innebygd håndskriftfont; sørg for Z003/URW Chancery for ordinære løperdiplomer.
Heder bruker sin eksisterende, innbygde Caveat-fil. Maskinen må ha verktøyene
installert, men produksjon trenger verken GitHub Actions, GitHub-tilgang eller
nettilgang. Poppler kjøres som et separat installert program; det vendoreres ikke.
Poppler distribueres under GPL, og må beholde sine lisenser ved eventuell senere
pakking av en installatør. Ingen ekstern PDF-tjeneste brukes.

## Hva piloten støtter

- Søk på navn og registrerte aliaser; type, oppnåelsesår og løperprestasjon.
- Høyeste løpermerke eller et valgt historisk merke; også debut og gjeldende rekord.
- Personens opptjente valg vises i en egen valgliste. Norske navn sorteres norsk.
- Enkeltvalg, hele avgrensede utvalg, fjerning og manuell siderekkefølge.
- Inntil 100 sider per jobb, med én Chromium-kontekst om gangen. Dette er en
  ressursgrense, ikke en målt kapasitetsgaranti for 100 sider.
- Løpermerker fryses ved riktig deltakelse. Samlingen inneholder bare merker
  opptjent ved den valgte prestasjonen; hovedmerket dupliseres ikke.
- Heder bruker bare `diplomaChoices/canPresent` og dagens hovedutmerkelser.
  Grunnleggermarkør, æresmerke, minnelogikk og ukjente datoer gjenbrukes uendret.
- En JSON-kontrollrapport før produksjon og en JSON-produksjonsrapport til PDF-en:
  side, mottaker/ID, prestasjon, variant, år/periode/dato, status, feil, varsler,
  godkjenningsbevis, dataversjon, innholdshash og SHA-256 for samlet PDF.

### Godkjenning er ingen sideeffekt

Eksisterende løperdiplom med **Kun siste merke** bruker originaldokumentet og
hashbundne trykkgodkjente bilder. En ny løpersamling krever en lokal utvidelse
av oppsettet; den er derfor foreløpig **alltid kontrollkopi** når tidligere
medaljer vises. Det er ikke innført en skjult godkjenningsknapp for denne varianten.
Uten tidligere merker er dokumentet uendret. Heder beholder sine allerede
kontrollerte presentasjons- og endelige varianter og sine uendrede kontrollsummer.

Manglende Heder-innholdsgodkjenning, blant annet et endret ordinært dugnadsdiplom,
gir **Kontrollkopi** hvis eksisterende tekniske porter består. Einars nåværende
grunnlag har ingen samsvarende godkjenningspost: det beholder 33 og den særskilte
utdelingsdatoen **7. november 2026**, og merkes som kontrollkopi. Et ukjent
opptjeningsår/periode fylles aldri ut av utdelingsdatoen. Ingen nye kontrollsummer
skrives til registeret. Erling Danielsen er ikke et Heder-valg; ordinære
løperdiplomer er fortsatt uavhengige av denne skjulingen.

Feil i bilder, fonter, innhold, format eller layout sperrer hele jobben også når
kontrollkopier er valgt. Samlingen merkes med **KONTROLLKOPI** på de berørte
sidene, i tillegg til eksisterende forhåndsvisningsmerking. Godkjente sider
får ingen ny merking. Dette tildeler ikke merker og skriver aldri til `awards`,
`issuedDiplomas`, `diplomaApprovals` eller `presentationPrintSet`.

## Teknisk avgrensning og sikkerhet

`npm run diplomer:admin` bygger først en validert A1C-sidekopi i en privat
midlertidig mappe. Kun en eksplisitt liste over filene i dette bygget kan serveres
under `/site/`. Originalmappen `data/`, Git, kildearkiver og vilkårlige lokale
filer er ikke tilgjengelige. Verktøyet trenger ikke originalregistrene.

Serveren binder bare `127.0.0.1`, kontrollerer Host/Origin, avviser cross-site,
og bruker en tilfeldig, kortlivet øktnøkkel for alle API-er og nedlastinger.
Ingen CORS-tilgang gis. Nøkkelen leveres til det lokale grensesnittet, ikke i
URL, logger, rapport eller kontrollartefakt. Nettleserarbeideren blokkerer eksterne
forespørsler. Bare kjente ID-er/prestasjoner og validerte varianter tas imot;
ingen opplastbar HTML, kode, shellkommando eller filsti. Duplikater fjernes uten
å endre rekkefølgen. Annen lokal programvare under samme bruker er ikke isolert
av dette verktøyet; det er en lokal pilot, ikke flerbrukerautentisering.

Kilde-/bygge-/godkjenningsfiler får et innholdssnapshot. Endringer før eller
under kontroll, eksport eller nedlasting avviser videre bruk og krever omstart.
Hver mottaker rendres isolert, og eksisterende bilde-, font-, innholds- og
A4-layoutkontroller kjøres før én native Chromium-PDF-side lages.

`pdfunite` slår sammen godkjente enkeltsider uten rasterisering. Sluttfilen
kontrolleres på **samtlige sider**: antall, liggende A4, innebygde fonter,
mottaker/dato/signatur, kontrollkopimerking og identisk tekst/rekkefølge mot
kontrollerte enkeltsider. Siste side behandles likt. Feil sletter bare den nye,
ufullstendige jobbens midlertidige filer; ingen delvis PDF tilbys. Eksporten er
synkron og begrenset til én jobb om gangen, uten database eller køsystem.

Offentlige filer, Pages-bygget og de ordinære enkeltdiplomene er uendret.
Testjobben får bare de nye lokale verktøyfilene, ikke private registre. CI
laster kontrollfiler fra godkjente offentlige data i artefaktet
`morothon-c1-diplomverksted`; disse er ikke del av Pages-pakken.

Workflowens eksplisitte CI-checkout utvides for å teste verktøyet. Dette endrer
selve test-/publiseringsreglene og krever etter gjeldende A1C-port en eksakt
`MOROTHON_REVIEWED_POLICY_HEAD`-godkjenning av sluttcommiten. Dette gjelder denne
workflow-endringen, ikke vanlige senere endringer i verktøyet eller testinnholdet.
Ingen repo-variabler eller sikkerhetsinnstillinger er endret av Codex.

## Kontroll og det som gjenstår

Målrettet kontroll kjøres med:

```sh
node --test tests/public/visual/diploma-batch.cjs
# Behold kontrollfiler utenfor repositoryet:
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c1-review node --test tests/public/visual/diploma-batch.cjs
```

Testen lager en seks siders PDF for fem forskjellige mottakere, begge visninger
for Inger og et eget kontrollkopidiplom for Jon. Den kontrollerer historiske år,
lange navn, Heder-varianter, skjuling, lokale tilgangssperrer og mobil/PC.
En reell forskyvning av navnet utenfor arket på **siste side** må stoppe hele
jobben og etterlate ingen delvis jobb. Endret snapshot avvises.

ZIP, jobbhistorikk/gjenopptak, historiske Heder-hovedmerker, godkjenningseditor,
formell utstedelse og driftet innlogging inngår ikke. Ingen 25-/100-siders
kapasitetsmåling eller fysisk prøvetrykk er lovet. Den nye løpersamlingen må
vurderes visuelt før en senere eksplisitt godkjenningsmodell kan tillate ren
utskrift av den. Eksisterende åpne godkjenningssaker i personregisteret er ikke
lukket av denne piloten.

### Utført sluttkontroll

13. november 2026, mot `main` etter PR #33 (`5c44ed5`):

- C1: **9/9** målrettede tester bestått, uten hoppede tester. Den utvidede
  rekordprøven (Ingrid, 2023, bare 5-/10-merker) er også kjørt separat og bestått.
- Hurtignivå: **27/27** bestått.
- Offentlige modul-/nettleserregresjoner: **2/2** bestått. Dette inkluderer
  referansesammenligning av de 86 diplomgrunnlagene, ikke rendering av et nytt
  86-PDF-galleri.
- Eksisterende workflow-/tilgjengelighetskontroll: **7/7** bestått.
- Totalt **45 forskjellige testtilfeller** bestått. Full historisk
  kilde-/galleriregresjon er bevisst ikke kjørt for denne avgrensede piloten.
- Produksjonsbygg og separat offentlig validering: **59 filer, 43 profiler**.
- Originaleksporten samsvarer fortsatt med godkjent pakke, dataversjon 1.
- Isolert C1-oppstart og faktisk PDF-produksjon bestått uten `data/`, eksportør,
  Git-metadata eller credentials. Bare de vanlige verktøyavhengighetene deles.
- Prøve-PDF: seks liggende A4-sider for fem ulike personer, fire godkjente sider
  og to kontrollkopier. Rekkefølge, alle sider og innebygde fonter kontrollert.
- Faktiske Chromium-bilder kontrollert på 390 og 1440 px, og side 5/6 i
  prøve-PDF-en kontrollert visuelt. Ingen konsollfeil i arrangørgrensesnittet.
- `data/`, `public-data/`, medaljer, `js/`, `css/`, `index.html` og `heder.html`
  er uendret. Dokumentlenker, workflow-YAML og diff-kontroll bestått.

Kontrollfiler ligger utenfor produksjonskoden og regenereres av testen/CI.
Lokal prøve: `fem-mottakere-seks-diplomer.pdf`, `produksjonsrapport.json`,
`diplomverksted-pc.png`, `diplomverksted-mobil.png` og
`historisk-solv-med-samling.png`. Dette er lokale resultater, ikke en påstand om
at GitHub Actions allerede er grønn. PR-en må opprettes og workflow-endringen
må få sin eksisterende A1C-head-godkjenning før CI kan fullføres.
