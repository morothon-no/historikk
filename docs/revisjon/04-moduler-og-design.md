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
