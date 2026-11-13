# 04 – Moduler, arrangørkonfigurasjon og design

Målbildet konkretiserer A-01–A-04 og I-03. Én kodebase skal produsere forskjellige arrangørpakker; ingen kundegren med egne beregningsfunksjoner. Morothon beholder sitt design, sine motiver og sine historiske kategorier gjennom en egen konfigurasjon.

## Funn

| ID / type / alvorlighet | Fil/modul og faktisk observasjon | Anbefalt løsning og effekt | Gjennomføringsrisiko | Omfang | Avhengigheter |
| --- | --- | --- | --- | --- | --- |
| M-01 · produktbegrensning · høy | `index.html`, `rankings.js`, `progress.js`, `brag-card.js` og `diplomas.js` inneholder løpsnavn, 1992, 2014, 20/10 km, norske standardtekster og merkegrenser i kode. `honors.js` har bestemte grunnleggerseksjoner og 35-utgaverstekst. | Et validert arrangørmanifest med regler, tema, tekster, konkurranse-/løypekatalog og modulvalg. Gjenbruk uten kopiering av kode. | Høy hvis konfigurasjon endrer historiske beregninger uten policyversjon | 5–10 pd, overlapper A-04/I-03 | Eksplisitt motor og Morothon-adapter |
| M-02 · arkitekturrisiko · middels nå, høy for produkt | `index.html:798–799` laster Heder-datalaget og en blandet diplommodul selv om navigasjonen er av. `build-site.cjs` kopierer Heder-data uansett modulvalg. | Modulmanifest styrer både kode, navigasjon, dataeksport og nødvendige assets. Adelskalender bygges og testes uten Heder. | Middels: ordinære diplomer må ikke miste delte hjelpefunksjoner | 3–6 pd | A-01/A-02; S-01 |
| M-03 · forbedring · middels | Farger/typografi ligger i inline-CSS, fire CSS-filer og canvas-tegning. SVG/PDF har også egne fargefelt. Ett fargebytte er ikke én innstilling. | Semantiske designtokens som deles med DOM, canvas og dokumentmaler; få godkjente temaer. Arrangøren trenger ikke redigere CSS. | Middels: Morothons godkjente utskriftsuttrykk må fryses som referanse | 5–10 pd for første temaoppsett | M-01; visuelle referanser |
| M-04 · styrke med utvidelsesbehov · lav nå | `badges.js`/`data/badges.json` samler 23 oppføringer: ti løpermerker, ett rekordmerke, ett debutmotiv og elleve serviceoppføringer, hvorav to er utgått. Kildehash og kvalitetsstatus er konkrete. | Behold ett register; skill identitet, kvalifikasjonspolicy, offentlig webvariant og kontrollert trykkoriginal. Bevar historiske motiver og gamle dokumentreferanser. | Høy ved automatisk bildebytte eller tap av kvalitet/alpha | 2–4 pd for generell kontrakt, ikke redesign | Rettigheter, S-01, mal-/assetversjoner |
| M-05 · produktbehov · middels | Dagens data kan redigeres uten HTML for flere hederstekster, men ikke alle navigasjons-, profil-, rekord- og diplomvalg. | Enkle skjemaer over konfigurasjonen, med validering og forhåndsvisning. Ikke et fritt CMS eller opplastbar kundekode. | Middels: dårlig schema kan gjøre editoren kompleks | 4–8 pd for grunnleggende profil/tema, del av adminpilot | I-04; avklart produktomfang |
| M-06 · nytt arrangørbehov · høy verdi | `diplomas.js` åpner én mottaker om gangen. Kontrollskriptene kan generere mange enkeltfiler, men er ikke en privat diplomadministrasjon eller en samlet utskriftsjobb. | Gjenbruk modell/maler i en kontrollert jobb med mottakerutvalg, historiske prestasjoner, forhåndsvisning, samlet A4-PDF og alternativ ZIP. | Høy ved ugyldige godkjenninger, feil historisk nivå eller kontroll av bare første side | 8–14 pd inkrement, C1 i 07; felles admin/motor telles i D1/D2 | Privat administrasjon, prestasjonssnapshot, per-variant kontrollporter; I-06 for automatisk kandidatforslag |

## Modulkontrakter

| Modul | Bruker | Eget ansvar / avgrensning |
| --- | --- | --- |
| Kjerne: Adelskalender | Offentlig datasett, identitet, konkurranser og motor | Arkiv, søk, profiler, grunnstatistikk, rangering og rekordvisning |
| Merker | Kvalifikasjoner + merkeregister | Opptjente nivåer og historiske milepæler; oppretter ikke formelle vedtak |
| Lojalitet | Holdte utgaver, deltakelsespolicy | Periodeandel, rekker, comeback og år/utgave-spesifikke regler |
| Diplomer | Prestasjonssnapshot, mal, assets, kontrollstatus | Forhåndsvisning/rendering. Formell utstedelse er en separat autorisert handling |
| Skrytekort | Samme profil-/prestasjonsmodell som nettsiden | Bildeeksport og deling, ikke egne beregninger |
| Sammenligning | Sammenlignbare resultater i motoren | Riktig distanse, konkurranse og løypeversjon; ingen sammenblanding av ulike løp |
| Karusell/sammenlagt | Sesong og sammenlagtpolicy | Poeng, beste N, minimumskrav og forklaring av tellende runder |
| Heder | Egne dugnadsdata + valgfri bekreftet løperkobling | Roller, innsats, historier/minne, merkeforslag, vedtak og egne diplomer |

Heder skal kunne aktiveres senere uten ny grunninstallasjon. Løpsdeltakelse og dugnad er fortsatt to beregninger. Hvis Heder er deaktivert, skal ikke `honors.json`, interne dugnadsdata, hedersruter eller servicegrafikk publiseres bare fordi de finnes i prosjektet. Ordinære løperdiplomer skal fungere uten Heder-register. Motsatt skal en hedersperson uten løperkobling fungere uten påfunnet løpsstatistikk.

«Av» betyr ikke bare `display:none` eller en manglende menylenke. Publiseringsmanifestet avgjør hvilke filer som faktisk leveres. En aktiv modul skal dessuten kontrollere at dens nødvendige data og maler er til stede. En betalt funksjonsrettighet er en kommersiell avtale; frontend-flagg alene er ikke tilgangssikkerhet.

## Eksempel på konfigurasjon

```json
{
  "schemaVersion": 1,
  "organizerId": "org-morothon",
  "display": {
    "name": "Søgne Morothon",
    "locale": "nb-NO",
    "timeZone": "Europe/Oslo",
    "themeId": "forest-honour",
    "logoAssetId": "brand-logo"
  },
  "theme": {
    "colors": {"brand": "#123b45", "accent": "#b38a38", "paper": "#f8f5ec"},
    "headingFontAssetId": "font-heading",
    "bodyFontAssetId": "font-body",
    "handwritingFontAssetId": "font-signoff"
  },
  "modules": {"badges": true, "loyalty": true, "diplomas": true,
    "sharing": true, "compare": true, "series": false, "honors": false},
  "policies": {
    "participationPolicyId": "morothon-annual-v1",
    "recordPolicyId": "morothon-courses-v1"
  },
  "templates": {"participantDiploma": "landscape-honour-v1"}
}
```

Dette er et forslag, ikke en ny konfigurasjon som dagens kode allerede kan lese. Sponsorvisning, navigasjon, banner, profilvariant, bakgrunn, standardtekster og medaljeutvalg får egne deklarative felt når pilotbehovet er bekreftet. Datoformat bør være et validert valg over `Intl.DateTimeFormat`, ikke kundekode. Sponsoroppføringer kan ha asset-ID, tekst og kontrollert HTTPS-lenke; profil- og navigasjonslayout bør være navngitte varianter.

Hemmeligheter, opprinnelige importfiler og private personopplysninger hører aldri hjemme i dette offentlige manifestet.

## Temaer og diplomer

Start med to eller tre temaer, eksempelvis «klassisk historikk», «terreng og heder» og «kompakt karusell». Temaene endrer presentasjon, ikke regler. Oversettelser bruker nøkler og plassholdere, ikke rå HTML eller vilkårlige scripts. Merke- og konkurransenavn er egne data; et endret visningsnavn skal ikke endre den historiske kategorien.

Bruk semantiske tokens som `surface`, `text`, `brand`, `accent`, `border`, `focus` og typografiskala. CSS kan konsumere custom properties, mens canvas og PDF får de samme validerte verdiene gjennom en modell. Kunden kan velge sikre profilvarianter og godkjente maler; en fri dra-og-slipp-designer er ikke nødvendig i første produkt.

Morothons liggende A4-mal blir en versjonert mal med egne referansebilder. Navn, nivå, historie, dato og eventuelle tidligere merker er data. Dato for oppnådd milepæl og faktisk utdeling holdes adskilt. Et annet arrangement kan velge en annen signaturrolle eller la feltet være tomt. Ukjent dato må ikke erstattes med en kunstig dato for å fylle en linje.

Kontrollerte trykkfiler må beholde hash, transparens, kanter, størrelsesgrunnlag og dokumentert DPI-unntak. Et lite webforhåndsvisningsbilde kan ikke snike seg inn som trykkoriginal. Registrer eventuelle webvarianter som avledede filer fra den kontrollerte originalen; godkjente Morothon-motiver endres ikke i dette oppdraget.

## Produktakseptanse

En ny arrangør opprettes med data, manifest og assets, uten endring i motorfiler. Grunnpakken kan bygges uten Heder og uten tilgang til hedersregisteret. En fargeendring slår gjennom i profil, skrytekort og forhåndsvisning via tokens, men krever ny kontroll av berørte dokumentmaler. En feil modulkonfigurasjon gir en forståelig valideringsfeil før publisering. Løperens opptjeningsinformasjon er identisk mellom profil, kort og diplomgrunnlag selv om layoutene er ulike.

## Masseutskrift av diplomer

Dette er et løsningsforslag, ikke en funksjon som er lagt til. Arrangøren får en egen **privat diplomadministrasjon**. Den offentlige nettsiden trenger ingen ny adminlenke eller åpen PDF-utsteder. Dagens skjulte Heder-side og `noindex` er ikke tilgangsbeskyttelse; heller ikke kontrollskriptenes testserver er et ferdig administrasjonssystem.

### Utvalg og samlet kontroll

Søk på navn og filtrer på merke, oppnåelsesår, konkurranse og utskriftsstatus. Konkurransefilteret gjelder løpsprestasjoner; dugnadsinnsats får et eget scope, ikke en oppdiktet løpsdistanse. Velg enkeltpersoner eller alle kvalifiserte innen et nivå. Tilby navn, nivå, år og startnummer som sorteringsnøkler, med norsk navnesortering og naturlig startnummersortering der mulig. Startnummer er tekst og hentes fra valgt utgave; personer uten nummer sorteres forutsigbart uten å få et konstruert nummer.

Velg først **prestasjonen**: høyeste oppnådde merke eller et bestemt historisk merke. Velg deretter **medaljevisning**: «Kun siste merke» eller «Alle merker». Dette er ulike valg. Et historisk 10-merke viser 10, riktig opptjeningsperiode og dato, selv om personen nå har 13 utgaver. Samlingen kan bare inneholde tidligere merker opptjent senest ved den valgte prestasjonen, ikke fremtidige merker. Utvalget påvirker ikke personkort og profiler.

Jobben får ett element per mottaker, prestasjon og variant. Like elementer dedupliseres; to bevisst valgte, forskjellige historiske merker for én person kan gi to sider. En samlet forhåndsvisning viser sidene i valgt rekkefølge og en separat statusrapport: grunnlag, dato/presisjon, hoved-/sekundærmerker, godkjenningsstatus, asset-/font-/layoutkontroll og eventuelle feil. Sortering og filter må gjenspeiles i PDF/ZIP-manifestet.

### Gjenbruk og nødvendige utvidelser

| Eksisterende kode/regel | Gjenbruk | Nødvendig ny funksjon |
| --- | --- | --- |
| `diplomas.js:choices/model/prepare` | Løperens historiske merkevalg, navn, opptjening, dato, mal og bildekontroll | Mottakerutvalg og én frosset jobbmodell over samme funksjoner |
| `serviceDraft`, `honorProfile`, `serviceTenure` | Heder-grunnlag, særutmerkelser, faktiske perioder, medaljevalg og V3.6.2s historiske nivåinformasjon | Eksplisitt historisk Heder-prestasjon når arrangøren velger et tidligere dugnadsmerke |
| `canPresent` og godkjenningsregisteret | Nåværende krav om profilens høyeste hovedutmerkelse og innholdsspesifikke godkjenninger | Eget kontrollert historisk scope med kvalifikasjonsbevis og ny godkjenning per variant; dagens sperre må ikke bare fjernes |
| `checkLayout` og kvalitetskontroller | Faktiske font-/asset-/DPI-/sidekontroller | Isolert kontroll av **hver side**, også siste side; dagens `querySelector('.diploma-sheet')` er ikke kontroll av en hel samling |
| Playwright-/Chromium-kontrollskript | Låst nettleser, fontinnbygging og A4-rendering | Avgrenset produksjonsarbeider, sammenslåing/ZIP, jobblogg, fremdrift og feilrapport |

Æresmerker, grunnleggermerker og minneprofiler beholder særreglene. Einars særskilte utdelingsdato 7. november 2026 må ikke forveksles med et ukjent historisk opptjeningsår. En godkjent total uten enkeltår gir ikke lov til å gjette dato for et valgt historisk merke; elementet krever avklaring eller en godkjent variant uten ukjent dato. Erling Danielsen skal ikke kunne velges fra det skjulte Heder-registeret i vanlig produksjon; dette hindrer ikke et ordinært løperdiplom fra den uendrede Adelskalenderen.

### Rendering, PDF og ZIP

Anbefalt første løsning: en lokal eller kundedriftet, privat arbeider bruker samme diplommotor i Chromium. Den rendrer én isolert dokumentkontekst per element, venter på bilder/fonter og kjører alle kontrollene før én liggende A4-side produseres. Slå deretter de verifiserte enkeltsidene sammen til én PDF med bevart vektorgrafikk og innebygde fonter. Vurder et PDF-bibliotek eller et tilgjengelig verktøy som `pdfunite` med lisens-/distribusjonskontroll før valg; dette oppdraget legger ikke til avhengigheter.

Kontroller sluttfilen: N valgte diplomer gir N sider i riktig rekkefølge, alle 297 × 210 mm, ingen blanke ekstra sider, avkutting eller feil font. Statusrapporten er en egen fil, ikke en forside som bryter «én side per diplom». Alternativ ZIP inneholder de samme enkelt-PDF-ene og et manifest, med unike, rensede filnavn basert på jobb-ID/element-ID; navn alene kan kollidere eller gi utrygge filstier. Én stor DOM med kopiert HTML er mindre egnet som første løsning på grunn av ID-kollisjoner, CSS-lekkasje og risiko for å kontrollere bare første side.

Bruk begrenset parallellitet, eksempelvis én–to Chromium-kontekster, med fremdrift, avbryt og gjenoppta på samme snapshot. Mål 25 og 100 sider før lovet kapasitet; dagens testgallerier dokumenterer ikke ytelsen til en ny samlet PDF-funksjon. Ingen ubegrenset nettleserforking. Samme jobbmodell og rendering skal virke lokalt ved selvdrift og bak autentisering i en driftet tjeneste, uten nødvendig ekstern PDF-tjeneste.

### Godkjenning og produksjonsstatus

Hvert element bindes til person, prestasjon/scope, variant, data-/policy-/mal-/assetversjon og innholdshash. Ren produksjon krever en **fortsatt gyldig godkjenning for akkurat dette innholdet** og beståtte kvalitets-/layoutporter. En godkjenning av én side eller av «Alle merker» godkjenner ikke resten eller «Kun siste merke». Manglende godkjenning vises eksplisitt; en separat, tydelig merket kontroll-PDF kan tilbys dersom de øvrige sikkerhetsportene består. Ingen generell masseknapp som godkjenner alle dokumenter.

En feil stopper produksjonsjobben som standard. Operatøren kan eksplisitt velge bort feilende elementer og lage en ny, rapportert jobb; ingen stille hopping over sider. Datakorreksjon, tilbakekalt godkjenning eller endrede personvernvalg gjør berørte, uferdige jobber utdaterte. Ny produksjonsnedlasting krever oppdatert kontroll. Allerede utstedte dokumenter bevares som egne historiske poster, ikke overskrives stille.

Skill mellom generert, lastet ned og **operatørbekreftet utskrevet**, med tidspunkt og eventuell grunn til ny utskrift. `afterprint` kan ikke bevise at papir faktisk kom ut. Utdelt premie, vedtatt utmerkelse og formelt utstedt diplom er separate hendelser med egne fullmakter. En vellykket PDF-jobb skal aldri automatisk skrive til `awards` eller `issuedDiplomas`.

### Tidlig Morothon-pilot

Et avgrenset første steg kan bygges før hele plattformen er generalisert: privat lokal mottakerliste, eksisterende historiske løpermerker og Heders nåværende hovedutmerkelser, begge medaljevalg, statusrapport og samlet kontrollert PDF. Dette delsteget anslås til **4–7 pd av C1s 8–14 pd**, forutsatt de felles sikkerhets-/jobbkontraktene i D1/D2. Spesifikke historiske Heder-merker krever den nye scope-/godkjenningsmodellen før de tilbys. Full C1 inkluderer dette, ZIP og alle utvalgs-/sorteringskrav. Se [akseptansekriteriene](07-forbedringsplan.md#akseptansekriterier-for-arrangørflyten); piloten er ikke hele leveransen.
