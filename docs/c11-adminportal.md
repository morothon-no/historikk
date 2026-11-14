# C1.1 – Morothons lokale administrasjonsportal

Bygger videre fra `main` etter C1 / PR #34 (`5a71cef`). Dette er en
utviklingsversjon uten innlogging, ikke en sikker produksjonsløsning.

## Lokal oppstart

```sh
npm ci
npm run admin
```

Åpne `http://127.0.0.1:…` som skrives i terminalen. Den tidligere kommandoen
`npm run diplomer:admin` starter samme app og beholdes. Node, Chromium, Poppler og
fontkrav er som i [C1-veiledningen](c1-diplomverksted.md). Ingen nye avhengigheter.
Avslutt med Ctrl+C etter at PDF og rapport er lastet ned.

Portalen tilbyr:

| Meny | Tilgjengelig nå |
| --- | --- |
| Oversikt | Dynamiske nøkkeltall, siste fem utgaver, årets nye merker og snarveier |
| Deltakere | Søk i kanoniske navn og registrerte aliaser, sideinndeling, full resultatvisning og overgang til diplomvalg |
| Merker | Opptjente løpermerker med historiske opptjeningsår, nivåfilter og antall deltakelser til neste merke |
| Diplomer | Hele C1-verkstedet: prestasjon/medaljevalg, rekkefølge, kontroll, forhåndsvisning, samlet PDF og JSON-rapport |
| Import | Plassholder; ingen opplasting, import eller skriving |
| Premier | Plassholder; ingen prognose, bestilling eller registrering av utdeling |

Mottakerutvalg og kontrollresultater beholdes i samme nettleserøkt når man
navigerer mellom menyene. En omlasting nullstiller jobblisten som før. Antall
valgte diplomer vises i menyen. Deltakerprofilens «Velg diplom» søker opp riktig
kanonisk person i C1; den velger eller godkjenner ikke et diplom automatisk.

## Data og beregninger

Kun A1C-godkjente offentlige data brukes. `MorothonHistoryData.create()` gir
identitetsoppløsning, unike deltakelsesår, DNS-/DNF-regler og resultatstatuser.
Merkenivåer og originalbilder kommer fra det eksisterende merkeregisteret.

Oversikten bruker siste registrerte arrangementsår, ikke en hardkodet 2026.
Samme person telles én gang per år, DNS teller ikke, DNF teller og stafettlag
holdes adskilt. Deltakersøket kan også vise en registrert person uten tellende
deltakelser; denne får ikke oppdiktet debutår eller diplomkvalifikasjon.

Opptjente merker vises med året for den N-te deltakelsen. «Kommende milepæler»
er bare avstanden i antall deltakelser til neste nivå, ikke en prognose om
påmelding eller fremtidige år. Formell tildeling er fortsatt en egen handling
som portalen ikke har.

Resultatvisningen bevarer alle registrerte starter, tider, distanser, statuser og
kildeplasseringer. Historikk, person-ID-er og offentlige sider endres ikke.
De 43 synlige Heder-profilene og C1s eksisterende presentasjonsvalg er bevart.
Kontrollkopier, ukjente opptjeningsdatoer, minne-/grunnleggerlogikk og Einars
7. november 2026 følger den uendrede diplommotoren. Ingen nye godkjenninger.

## Struktur for videre arbeid

```text
scripts/diploma-admin.cjs            Oppstart, loopback-server, offentlig sidekopi
                                    og eksplisitt liste over serverbare filer
 tools/diploma-admin/
   api.cjs                          Felles serverinngang for ALLE /api-ruter
   portal-data.cjs                   Lesemodell fra godkjent offentlig historikk
   portal.js                        Meny, oversikt, deltaker-/merkevisning
   index.html / admin.css            Appskall og responsiv Morothon-identitet
   admin.js                         Eksisterende C1-jobbliste og diplombetjening
   worker.cjs / engine.js            Eksisterende Chromium-/diplomproduksjon
```

Frontend vises ved hjelp av hash-ruter (`#oversikt`, `#deltakere`, `#merker`,
`#diplomer`, `#import`, `#premier`). Navn, resultater og feilmeldinger settes med
DOM/textContent. API-et gjør sin egen validering; frontend-ruten er ingen
sikkerhetsbeslutning.

Serverens API-er er samlet i `api.cjs`:

- `GET /api/overview`, `/api/participants`, `/api/participants/:id`, `/api/badges`:
  kun lesing, validerte søk og begrenset sideinndeling.
- C1s uendrede `/api/catalog`, `/api/check`, `/api/preview`, `/api/export` og
  `/api/jobs/:id/...`: mottakervalg, kvalitetskontroll, PDF og rapport.

Når autentisering og autorisasjon innføres, skal en serverkontroll legges
**foran hele denne handleren**, også lesing og nedlasting. Mottaker-/jobbtilgang
må da kontrolleres per innlogget arrangør. Ingen rollevelger, skjult menylenke
eller JavaScript-variabel i nettleseren skal gi rettigheter. Dette er en
avklart plassering for senere arbeid, ikke en implementert innloggingsløsning.

C2 kan senere få egne importer-/premiemoduler bak samme API-grense og nye
validere/jobber. Ingen av disse rutene eller skriveoperasjonene finnes nå.
Deltakerlesemodellen skal ikke brukes til å utlede dugnadsår eller slå sammen
usikre identiteter. Eksisterende diplommotor og kontroller skal fortsatt brukes.

## Lokal sikkerhetsgrense og publisering

Serveren er fortsatt hardt bundet til `127.0.0.1`. Host/Origin/cross-site-kontroll,
øktnøkkel mot lokale kryssopprinnelsesforespørsler og alle C1-sperrer beholdes.
Øktnøkkelen er **ikke innlogging eller brukerautorisering**. Appen skal ikke
portdeles, legges bak en offentlig proxy eller distribueres som en ubeskyttet
tjeneste. Produksjonsdrift, transportbeskyttelse, bruker-/rollemodell og ekstern
tilgang må avklares og testes separat før slik drift.

Alle API-ruter går gjennom samme lokale kontroll. Datagrunnlagets snapshot
valideres før API-bruk, og C1 fortsetter å kontrollere hver side og samlet PDF.
Originalregistre og vilkårlige lokale filer er utilgjengelige via serveren.

Portalens filer finnes bare under det lokale verktøyet. Det offentlige byggets
filkontrakt er uendret og inneholder ingen portal, lokal server eller nye
administrative data. GitHub Actions er **ikke endret**: eksisterende B1-oppsett
oppdager de nye offentlige/syntetiske testene og sjekker ut verktøymappen som før.
Den isolerte testkopien inkluderer de nye verktøymodulene, ikke originalregistre.
Skjermbilder leveres under `portal-c11/` i eksisterende C1-kontrollartefakt.

## Tester og kontrollbilder

```sh
node --test tests/public/visual/admin-portal.cjs tests/public/visual/diploma-batch.cjs
# Behold PC-/nettbrettbilder og C1s PDF-prøve utenfor repositoryet:
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c11-review node --test tests/public/visual/admin-portal.cjs tests/public/visual/diploma-batch.cjs
npm run test:quick
npm run build
npm run public:kontroll
```

Ingen full historisk diplomgallerigenerering er nødvendig. C1s eksisterende
målrettede PDF-prøve kontrollerer begge medaljevarianter og alle sider, også
siste side, uten å generere 86 Heder-PDF-er. Fysisk prøvetrykk og et nytt
produksjons-/autentiseringsmiljø inngår ikke i denne leveransen.

### Utført kontroll – 14. november 2026

- **14/14** målrettede portal-/C1-tester bestått, uten hoppede tester.
  Feilhåndtering ved sen respons etter sidebytte er utvidet og kontrollert separat.
- **27/27** hurtigtester og **2/2** offentlige modul-/nettleserregresjoner bestått:
  **43 forskjellige testtilfeller** totalt. Full historisk galleriregresjon er
  ikke kjørt; eksisterende 86 diplomgrunnlag sammenlignes som referansedata,
  uten å generere et nytt 86-PDF-galleri.
- Reell seks siders C1-PDF for fem personer, begge medaljevisninger,
  innbygde fonter, A4, rekkefølge, kontrollkopier og siste-side-feil består.
- Oversikt og Diplomer kontrollert og avbildet ved **1440 × 1050** og
  **768 × 1050** i Chromium. Deltakere og Merker har egne nettbrettbilder.
  Ingen horisontal siderulling eller konsollfeil i portalprøven.
- Portaltester dekker navn/aliaser, kanoniske ID-er, historiske merkeår,
  DNS/DNF, flere starter per år, syntetiske 2027-resultater, API-validering,
  status/feil/retry, tilbakeknapp og bevaring av diplomutvalg gjennom navigasjon.
- Produksjonsbygg og uavhengig offentlig datakontroll består: **59 filer,
  43 Heder-profiler**, dataversjon 1. Originaleksport samsvarer med godkjent pakke.
- Offentlige HTML-/JS-/CSS-filer, `data/`, `public-data/`, medaljer, diplommotor,
  PDF-arbeider og GitHub Actions er uendret. Publiseringskommandoer og
  sikkerhetsregler er også uendret; denne ordinære app-/testendringen utløser
  ikke et nytt SHA-godkjenningskrav etter PR #33s regler.

Kontrollbilder ligger utenfor produksjonskoden under `portal-c11/`:
`oversikt-1440.png`, `oversikt-768.png`, `diplomer-1440.png`,
`diplomer-768.png`, `deltakere-768.png` og `merker-768.png`.
Eksisterende B1/C1-artefaktopplasting tar disse med når PR-kontrollen kjører.
Dette er lokalt verifiserte resultater, ikke en påstand om at GitHub Actions
allerede har kjørt for PR-en. Ingen ny innlogging, ekstern tilgang eller
produksjonsdrift er etablert. Fysisk nettbrett/Safari og fysisk prøvetrykk er
ikke testet; nettbrettkontrollen er Chromium ved angitt skjermbredde.
