# C1.3 – operativ utkastkontrakt v2

Normativ validering: [design-model.js](../../tools/diploma-admin/design-model.js).
Dette erstatter ikke den aktive, publiserte arrangementsprofilen v1. Det eldre
[JSON Schema v1](design-draft-v1.schema.json) var et planforslag; det er ikke
importformatet til C1.3. Ukjente versjoner/felt avvises, ingen implisitt migrering.

## Utkast og komplett pakke

Et utkast har nøyaktig disse toppfeltene:

| Felt | Innhold |
| --- | --- |
| `schemaVersion`, `kind`, `status` | `2`, `morothon-design-draft`, `draft` |
| `id` | Portabel ID: liten bokstav først, deretter bokstaver/tall/bindestrek |
| `base` | SHA-256 av opprinnelig profil, godkjent merkeregister og historikk |
| `profile` | Navn, beskrivelse, slagord, topptekst, logo, farger, fonttoken, modulvalg og distansevisning |
| `series` | Uavhengige merkeserier med eksplisitt opptjeningsgrunnlag, tellenhet, regel og ordnede merker |
| `diploma` | Fast mal, tekst, eksempelnavn, farger/font/ramme, bakgrunn, medaljestørrelse, samlingsvalg, sted og datoformål/signatur |
| `assets` | Egne, innbakte rasterbilder med metadata og uforanderlig `unreviewed`, `printReady: false` |

Nedlastingsfilen er én vanlig JSON-fil med endelsen `.morothon-design.json`:
`{schemaVersion: 1, kind: "morothon-design-package", draft, sha256}`.
Kontrollsummen er SHA-256 av UTF-8 `JSON.stringify(draft)`, inkludert bildedata.
Hvert bilde verifiseres også separat mot sine dekodede bytes, format og dimensjoner.
Ingen ZIP-bibliotek, filutpakking eller nye avhengigheter er nødvendig.

Kontrollsummen oppdager ødelagte/endret filer. Den er **ikke** en signatur,
trykkgodkjenning, identitetskontroll eller tillatelse til publisering. En angriper
kan lage nye gyldige utkast, men ikke et godkjenningsobjekt i dette formatet.
`awards`, `issuedDiplomas`, godkjenninger, kode og vilkårlige stilark er ikke tillatte felt.

Egne bilder inngår fullt i pakken. `builtin:<id>` refererer til eksisterende,
godkjent bildebibliotek i denne produktversjonen; de offisielle originalene
dupliseres ikke i hver utkastfil. Ukjente referanser avvises ved import. `base`
bevarer versjonsgrunnlaget, men gir ingen rett til å skrive over en nyere profil.

## Regler og grenser

- Serier: maksimalt 8, 1–20 merker i hver. Unike serie-ID-er og globalt unike
  merke-ID-er; strengt stigende heltallsterskler 1–10000 innen samme serie.
- Merker har navn, beskrivelse, terskel, farge, bildereferanse, aktivstatus og
  tillatelse til visning i **utkastdiplomet**. Rekkefølgen er hierarkiet. Flytting
  bytter terskelplass eksplisitt; ulogiske terskler avvises, ikke sorteres i stillhet.
- `participation` / `participated-year`, `completion` / `finished-year`,
  `service` / `service-year` og `special` / `manual-approval` er separate grunnlag.
  Telleenheten er `editions`, `starts` eller `manual`. Kombinasjoner valideres.
  Årsmodellen for deltakelse er kjent fra eksisterende motor, men egne regler
  er **ikke aktivert**. Fullføring, dugnad, enkeltstarter og særutmerkelser i nye
  serier krever egen implementering/kontroll før operative beregninger.
- Raster: bare faktisk PNG/WebP, maks. 4 MB per fil, 4096 px per kant og
  16 millioner piksler. Headergrenser sjekkes før dekoding. Nettleseren må kunne
  dekode filen, og faktiske dimensjoner må stemme med header/metadata.
- Maks. 12 egne bilder, samlet 12 MB bildefiler, maks. 24 MB importpakke.
  Bilde-ID, rolle, format, dimensjoner, byteantall og SHA-256 verifiseres.
- Ingen bilde-URL fra import, SVG, HTML, JavaScript, CSS eller vilkårlige fonter.
  Farger er seks heksadesimale sifre; fonter/maler/rammer er lukkede tokenvalg.
- Hovedmedalje 35–62 mm. Oppgitt DPI beregnes ved valgt fysisk størrelse;
  det dokumenterer ikke frilegging, motiv eller tekstkvalitet. Layout kan fortsatt
  avvise en størrelse i en trang, registrert Heder-komposisjon.
- Valgt illustrasjonsmerke må være aktivt og tillatt på diplom. Bare lavere,
  aktive diplommerker i samme serie kan vises som tidligere merker. Ingen
  fremtidige merker legges på historiske, registrerte diplomer.

## Dato og godkjenning

`achievement` bruker bare den registrerte prestasjonens dato. Eksempelpersonen
har ingen slik dato. En eksisterende, særskilt utdelingsdato (Einar) bevarer
sin status som **utdelingsdato**, uten å bli et antatt oppnåelsestidspunkt.
`presentation` krever en eksplisitt, gyldig kalenderdato; `none` skjuler feltet.
Sted kan tilpasses. Ingen dato konstrueres fra et merkeantall.

Kildeprestasjon velges bare for en lokal designprøve og følger ikke med som en
ny tildeling i pakken. Hver endring gir et tydelig stemplet designutkast.
Utskrift/PDF-utstedelse er sperret i studioet, uansett opprinnelig godkjenning.
Den godkjente originalmalen og enkeltdiplomfunksjonen er separate og uendret.

## Neste lag

Fremtidig autorisert lagring kan ta imot samme validerte pakke via et eget
lagringsadapter, med autentisering, arrangørtilgang, versjoner og eksplisitt
publisering. Nye regelmotorer og eventuell AI-assistent må produsere utkast
gjennom samme kontrakt. Ingen av disse får automatisk godkjenningsrett.
