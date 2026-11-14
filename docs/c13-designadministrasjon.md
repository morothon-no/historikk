# C1.3 – konkret plan for design- og diplomadministrasjon

**Status:** Dette er planforslaget fra C1.2. Den fungerende C1.3-leveransen er
beskrevet i [Designstudio – bruk og avgrensning](c13-designstudio.md), med
[operativ utkastkontrakt v2](contracts/design-draft-v2.md). Schema v1 nedenfor
beholdes som historisk plan, ikke som et støttet importformat.

C1.2 leverer den offentlige, strengt validerte
[arrangementsprofilen](../web-admin/event-profile.json) og én felles motor.
C1.3 skal gi redigering i nettleseren, ikke en kodekopi per kunde.

## Datakontrakter

- **Aktiv profil v1:** `web-admin/profile-contract.js`. Bare støttede presentasjonsfelt,
  kjente font-/asset-/malreferanser og moduler. Ukjente felt avvises.
- **Designutkast v1:** [JSON Schema](contracts/design-draft-v1.schema.json).
  Inneholder base-hasher, utkaststatus, nye asset-metadata, farger/fonter/bakgrunn,
  navngitt diplommal, tekster, sted, datoformål, typografisk signaturnavn/-rolle,
  medaljevisning og egne merke-/terskeloppsett. Dette er en **kontrakt for neste
  fase**, ikke en aktiv skriverute eller en ny policy for Morothon.
- **Asset-referanse:** ID, rolle, medietype, SHA-256, byteantall, native mål og
  eksplisitt kontrollstatus. Binærfilene legges ikke inn som fri HTML/base64 i
  konfigurasjonen. C1.3 trenger også semantisk kontroll av unike ID-er,
  stigende/unike terskler og at referanser finnes; JSON Schema alene er ikke nok.
- **Godkjenningsgrunnlag:** godkjenning knyttes til nøyaktig profil-/mal-/tekst-/
  asset-/policyversjon og faktisk diplominnhold. Publiserte diplomer og
  formell utdeling er egne historiske objekter, ikke en «lagre»-sideeffekt.

## Foreslått gjennomføringsrekkefølge

1. **Lokal utkasteditor i nettleseren.** Skjema for navn, logo, farger og fontvalg,
   med umiddelbar forhåndsvisning. Utkast holdes i minnet eller eksporteres som
   en tydelig utkastfil. Ingen åpen, uautentisert lagrings-/opplastingsserver.
2. **Kontrollert asset-innlasting.** Arrangøren velger PNG/WebP eller en renset SVG.
   Kontroller filsignatur, type, dimensjoner, størrelse, alfa/ytterkanter, SHA-256,
   DPI ved faktisk diplomstørrelse, font-/eksternreferanser og SVG-sikkerhet.
   Godkjente originaler bevares; en ny fil arver aldri gammel trykkstatus.
3. **Navngitte diplommaler og tekster.** Fast A4-mal med skjemaer for tekst,
   sted, datotype, signaturfelt og «Kun siste / Alle merker». Ingen fri
   JavaScript/CSS/layout-editor. Historiske opptjeningsår og særskilte
   utdelingsdatoer holdes adskilt. En person med ukjent oppnåelsesår får ingen
   konstruert dato fra malen.
4. **Egne merketerskler i separat arrangementsprofil.** Eksempelvis 5/10/15
   eller 3/6/9 deltakelsesår. Telle-enhet og individuelt/dugnad-scope er eksplisitt.
   Morothons eksisterende terskler, aliaser, DNS/DNF-regler og historikk røres ikke.
   Andre telle-enheter enn dagens støttede årsmodell krever egen implementering
   og prøving; schemaets fremtidige «starts» gjør ikke dette operativt i C1.2.
5. **Forhåndsvisning og godkjenning.** Korte/lange navn, lys/mørk bakgrunn,
   kontrast, alle mal-/medaljevalg, fonteinnbygging og reell A4/PDF kontrolleres.
   Endringer ugyldiggjør berørte innholdsgodkjenninger og gir merkede
   kontrollkopier frem til ny godkjenning. Ingen automatisk tildeling.
6. **Sikker lagring/publisering.** Før nettbasert skriving må innlogging,
   arrangørtilgang, privat lagring, versjoner, backup og autorisert publisering
   etableres i en separat beslutning. Et API-lag håndhever dette på serveren.
   Kundens skjema skal senere kunne lagre/foreslå publisering uten GitHub eller
   programmering; utkast, aktiv profil og publisert versjon er ulike tilstander.

## Akseptanse for neste fase

En arrangør kan lage et utkast med egen logo, profil og terskler, se et sannferdig
forhåndsvisningsdiplom og forstå hva som mangler før lagring/publisering.
Feil/ukjente felt, utrygge bilder, dårlig trykkvalitet, avkutting eller manglende
godkjenning stoppes. En annen arrangørs data eller Morothons historiske dokumenter
endres ikke. Den offentlige C1.2-testportalen skal aldri bli en åpen
administrativ skriver ved at en knapp aktiveres i frontend.
