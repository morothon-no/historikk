# 06 – Produktstrategi, lisensiering og salg

## Vurdering

Løsningen kan realistisk bli et gjenbrukbart produkt, men er i dag en sterk referanseinstallasjon – ikke en ferdig flerarrangørtjeneste. Den viktigste verdien er at historiske prestasjoner oppleves personlige og troverdige: søkbart arkiv, konsistent identitet, rekorder, historiske milepæler og dokumenter som faktisk passer på A4.

Den største kommersielle mangelen er daglig vedlikehold uten programmering. Flere medaljer eller et nytt frontend-rammeverk løser ikke import, navnekonflikter, kildekorreksjoner og trygg publisering. Prioriter derfor import-/godkjenningsflyt og enkel administrasjon før flere dekorative moduler. Betalingsvilje, salgsvolum og faktisk supportbelastning er **ikke undersøkt**; produktpakkene under er hypoteser som må prøves med pilotkunder.

Tillegget 13. november knytter to nye behov til samme produktløfte: **startliste → betinget merkeprognose og premiebehov → godkjente resultater og endelig premieliste → kontrollert diplomjobb**. En mulig kundes ønske er et nyttig pilotsignal, ikke dokumentasjon på betalende etterspørsel. Morothon kan teste arbeidsflyten før hele flerarrangørplattformen er ferdig.

## Funn

| ID / type / alvorlighet | Fil/modul og faktisk observasjon | Anbefalt løsning og forventet effekt | Gjennomføringsrisiko | Omfang | Avhengigheter |
| --- | --- | --- | --- | --- | --- |
| P-01 · rettighetsavklaring · høy før eksternt salg | Ingen generell `LICENSE`/rettighetsoverdragelse ble funnet i repositoryroten. `private: true` i `package.json` er ikke en lisens. Fontlisens og avhengighetslisenser finnes, men er ikke en samlet kommersiell rettighetskjede. | Avklar eierskap/bidragsrettigheter, resultatdatabruk, merkevare og asset-rettigheter før lisensiering. Skill fellesprodukt fra kundens data. | Høy hvis avtaler antas å finnes eller produktet selges med andres motiver | 2–5 tekniske pd for oversikt; juridisk arbeid utenfor estimatet | Eiere/bidragsytere og juridisk rådgiver |
| P-02 · produktgap · høy | README og scripts krever filredigering, Git og teknisk oppsett. Ingen kundestyrt import-/publiseringsflate finnes. | Pilotér selvbetjent oppdatering, med opplasting, avstemming, forhåndsvisning og separat publisering. Reduser avhengighet til utvikleren. | Middels–høy: supportbehov kan bli større enn antatt | 15–25 pd for første avgrensede import/adminpilot | I-01–I-04, S-01/S-03 |
| P-03 · strategisk risiko · høy ved kundespredning | Navn/regler/design er tett knyttet til Morothon; en enkel kopi skaper fort en kodegren per kunde. | Én versjonert motor med data/config/modulmanifest per arrangør. Selg konfigurasjon, innføring og drift, ikke kodeforker som standard. | Middels: for bredt generisk produkt før pilot er også kostbart | 16–30 pd for motor/modell, samme arbeid som D1 i 07; ikke et tillegg | To ulike pilotbehov og kompatibilitetsregler |
| P-04 · økonomisk usikkerhet · middels | Ingen dokumenterte volum-, SLA-, support- eller salgsforutsetninger foreligger. | Mål innføringsarbeid, årlig support, datarydding og trafikk per pilot før prissetting. | Lav teknisk, høy kommersiell hvis bindinger loves for tidlig | 2–4 pd teknisk kartlegging + pilot-/salgsarbeid | Pilotavtaler, driftsleverandør og valgt lisens |

## Foreslåtte pakker

| Pakke | Kundeverdi | Avgrensning |
| --- | --- | --- |
| 1 – Adelskalender | Historisk arkiv, søk, profiler, statistikk, rangering og løyperekorder | Trygg oppdatering med felles import-/identitetsadministrasjon; grunnleggende startliste-/resultatmapping er infrastruktur, ikke en separat kodebase. Ingen avhengighet av Codex for hvert år. |
| 2 – Adelskalender Pluss | Merker, lojalitet, milepæler, diplomer, skrytekort, sammenligning, **Merkeprognose og premieliste** og masseutskrift av løperdiplomer | Samme motor og admin; betinget prognose skilles fra faktisk kvalifikasjon, dokumentkontroll fra utdeling. |
| 3 – Komplett | Pluss + valgfri Heder med dugnadsgrunnlag og Heder-masseutskrift | Egne datarettigheter, historiske prestasjonsscope og publiseringsvalg; formelle vedtak krever egen handling. |
| Tillegg – Karusell og sammenlagt | Flere runder, sesong, beste N, poeng og sammenlagtplass | Skal kunne brukes uten Heder og uten at et årlig løp må konfigurere en poengmotor. |
| Leveransevalg – Selvdrift | Kildekode, verktøy, dokumentasjon, dataflytting og drift hos kunden | Dette er en leveranseform for valgte moduler, ikke en annen kodebase. |

Temaer, eksport og tilgjengelighet bør være gode i alle pakker. Korrekte identiteter, dataportabilitet, sikkerhet og backup er ikke premiumfunksjoner. Unngå å gjøre et lite årlig løp avhengig av komplisert sesongoppsett.

Begrens første pilot til én årlig arrangør i tillegg til Morothon, og ett lite serieeksempel med flere runder samme år. Det tester om koden faktisk er generell. Markedsnavnene på mulige pilotarrangementer er eksempler, ikke dokumenterte kunder eller bekreftede avtaler.

En årlig arrangør skal kunne bruke startlisteprognose uten poengmotor eller Heder. En bedriftskarusell bruker de samme verktøyene med utgave-/sesongpolicy, ikke Morothons årstelling. Et Heder-diplom kommer fra separat dokumentert dugnadsinnsats; det blir ikke generert av at en person står på startlisten. PDF-masseproduksjon må fungere både i den driftede administrasjonen og lokalt ved selvdrift, uten nødvendig ekstern utskriftstjeneste.

### Tidlig pilot og salgbar avgrensning

Tilby først en avgrenset prøve med eksisterende Morothon-maler og privat lokal administrasjon: kontrollert mottakerutvalg og samlet PDF, deretter én kjent EQ-startliste med betingede merker, CSV/PDF-premierapport og avstemming mot godkjente resultater. Dette kan gi praktisk verdi før hele modellen generaliseres. Fullt produkt inkluderer også historiske Heder-valg, ekte XLSX, ZIP og generelle telleenheter; delpiloten skal ikke markedsføres som om disse er ferdige.

Mål tidsbruk på identitetsavklaring, endringer før start, feil/overskudd i premieplan, resultatrekonsiliering og diplomproduksjon, samt om arrangøren klarer dette uten kodehjelp. Kontroller endelig utlevert antall separat fra forventet premiebehov. En publikumsside med synlig utskriftsknapp er ikke i seg selv en privat arrangøradministrasjon.

## Driftet tjeneste og komplett overtakelse

**Driftet:** offentlig frontend som statiske, versjonerte pakker; et lite privat kontrollplan håndterer opplasting, godkjenning, brukere og publisering. Isoler arrangørenes lagring og releases fra starten. Multitenancy betyr også serverkontroll av hvilket `organizerId` brukeren har tilgang til, ikke bare et nedtrekksvalg.

**Selvdrift:** samme kildekode og schemas, offentlig statisk vert etter kundens valg, og valgfri lokal eller kundedriftet administrasjon. Lever en installert/testet referansepakke med verktøyversjoner, eksempeldata, migreringer, backup/restore og en full eksport. Ingen nødvendig lisensserver, personlig GitHub-konto, API-nøkkel hos utvikleren eller binding til ChatGPT/Codex for å administrere egne data.

For én lokal redaktør kan versjonerte filer og atomiske snapshots være nok. En liten administrativ SQLite-database kan være begrunnet ved transaksjonelle godkjenninger, brukere og samtidige redigeringer. Dette er et **administrativt** lagringsvalg, ikke et behov for offentlig resultatoppslag. Postgres eller flere tjenester bør vente til samtidighet/drift faktisk krever det. Beslutningen tas etter pilotens brukerflyt og dokumenteres i en arkitekturbeslutning.

## Lisensmodeller

| Modell | Hva kunden får | Hva avtalen må avklare |
| --- | --- | --- |
| Abonnement | Drift og avtalte oppdateringer/support | Dataeierskap, eksport, SLA, oppsigelse, migreringshjelp og håndtering av private opplysninger |
| Engangskjøp, varig bruksrett og kildekode | Avtalt versjon, dokumentert selvdrift og rett til intern tilpasning | Antall organisasjoner/installasjoner, tredjepartsrettigheter, videredistribusjon og avgrenset garanti/support |
| Engangskjøp + vedlikehold | Samme selvdriftsrett samt frivillige framtidige oppdateringer | Sikkerhetsstøtte, støttede versjoner, migreringer og at eget datauttak ikke stopper ved oppsigelse |
| Eksklusiv overdragelse | Særskilt rettighetskjøp | Må prises og avtales separat; ikke automatisk konsekvens av å levere kildekoden |

Anbefalt utgangspunkt: behold eierskap til fellesproduktet; kunden eier/kontrollerer egne data og sin konfigurasjon og får avtalte bruks-/tilpasningsrettigheter. Levering av kode er ikke det samme som eksklusivt eierskap. En kunde som gjør egne endringer kan måtte betale for migrerings-/supportarbeid; grensen må være tydelig før salg. Dette er kontraktsforslag som krever juridisk kvalitetssikring.

## Rettigheter: tekniske fakta og juridiske spørsmål

| Tema | Teknisk observert | Må avklares før kommersiell levering |
| --- | --- | --- |
| Kildekode | Ingen generell rotlisens; Git-historikk med bidrag | Hvem kan lisensiere felleskoden, og er nødvendige rettigheter fra alle bidragsytere sikret? |
| Resultatdata | Historiske resultater og EQ Timing-dokumentasjon i data/docs | Arrangørens publiserings-/behandlingsgrunnlag, leverandørvilkår, eventuell database-/uttrekksrett og informasjonsplikt; ikke anta tillatelse til scraping. |
| Heder og historier | Navn, roller, interne notater, koblinger, minneopplysninger og revisjoner | Hva kan publiseres, hva skal være privat, og hvordan håndteres bilder, innspill, korreksjoner og sletting? |
| Barn/junior | Klasse- og navnopplysninger i resultatgrunnlaget | Dataminimering, alder/klassevisning, behandlingsgrunnlag og eventuelle foresatt-/informasjonshensyn |
| Morothon-grafikk | Offisielle medaljer/logoer og godkjente filer | Rett til kommersiell gjenbruk/viderelisensiering; Morothons merkevare skal ikke automatisk leveres som en annen arrangørs identitet. |
| Avhengigheter/fonter | Playwright/Chromium, Pillow og fonter; lockfile viser bl.a. Apache-2.0/MIT; installert Pillow oppgir MIT-CMU; Caveat leveres med SIL OFL | Lag SBOM/NOTICE, verifiser distribusjon og embedding av alle faktiske fonter/grafiske komponenter; medsend lovpålagte tekster. |

Tekniske kontroller kan vise at en JSON er offentlig eller at en fontfil har en lisens. De kan ikke alene fastslå at alle personopplysninger er lovlig publisert eller at en kommersiell rettighetskjede er komplett. Kundeavtale, eventuell databehandleravtale og personvernerklæring må beskrive hvem som bestemmer formål, hvem som drifter, eksport og slettingsansvar. Ingen påstand om konkret lovbrudd eller komplett juridisk godkjenning gis her.

## Kostnader og forutsetninger

Ingen salgspriser fastsettes i revisjonen. Bruk følgende kostnadsmodell før tilbud:

`årlig totalkost = drift + lagring/backup + distribusjon + sikkerhetsvedlikehold + support + dataarbeid + avtalt videreutvikling`.

Båndbredde kan estimeres som besøk × faktisk overførte byte, med målte cache-/komprimeringsforhold; lokal ukomprimert trafikk er ikke en produksjonsfaktura. Offentlig statisk drift kan være rimelig, men administrasjon, private kilder, restore, kontosikkerhet og support er fortsatt arbeid. Selvdrift fjerner ikke kostnaden ved installasjon, opplæring og videre vedlikehold – den flytter deler av den til kunden.

Arbeidsanslagene i [07](07-forbedringsplan.md) forutsetter utviklere som kjenner JavaScript og databehandling, pilotfiler med brukstillatelse og gjenbruk av dagens design. Juridisk arbeid, omfattende historisk datavask, nye medaljemotiver, leverandørintegrasjoner uten kjente filformater og markedsføring er ikke inkludert. Ikke gi fastpris for «alle EQ Timing-filer» før representative filer er sett.

Masseutskrift C1 er anslått til **8–14 pd** og startliste/prognose/avstemming C2 til **12–20 pd**, inkrementelt rundt det delte grunnlaget. Samlet plan øker fra **41–75 til 61–109 pd**, ikke med en ny komplett import- og adminløsning for hver modul. Tidlige delpiloter er 4–7 og 6–10 pd **innenfor** C1/C2, med nødvendig arbeid trukket frem fra D1/D2. Tilgangs-/import-/motoranslag fra I-04, S-03 og P-02 legges ikke på nytt oppå dette. Se regnskap, avhengigheter og buffer i 07; avansert SaaS, selvdriftspakking og poengmotor må avgrenses separat.

Mål pilotene på tid fra fil til kontrollert release, antall manuelle konflikter, supporttimer, om arrangøren klarer neste oppdatering selv, og om en annen IT-leverandør kan installere/gjenopprette uten oss. Disse er bedre kommersielle beslutningspunkter enn antall funksjonsknapper.
