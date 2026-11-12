# 07 – Prioritert forbedringsplan

Oppdatert 13. november 2026 på uendret main `53f8f50`. Dette er en plan til godkjenning, ikke påbegynt implementering. Produksjonskode, personopplysninger, historiske resultater, motiver og design er bevart. Den opprinnelige revisjonen og målingene videreføres; nye arrangørbehov legges til med eget, inkrementelt omfang.

## Fire kategorier og felles budsjett

`pd` betyr persondager. Tabellen er budsjettgrunnlaget; estimater for enkeltfunn i 01–06 er delmengder og skal **ikke summeres i tillegg**.

| Kategori / ID | Leveranse og verdi | Nettoomfang | Avhengighet og vesentlig risiko | Ferdig når |
| --- | --- | ---: | --- | --- |
| **A – kritisk / A1** | Offentlig dataprojeksjon og privat administrativt lager; S-01/S-07 | **3–6 pd** | Eier avklarer publiserbare felt; risiko for utilsiktet republisering eller tap av kilder | Eksplisitt eksportschema, ingen private felter/skjulte Heder-profiler i offentlig pakke; rollback respekterer fjerning. |
| **A – kritisk / A2** | Datavalidering og entydig statuskontrakt; R-01/R-03/S-02 | **3–6 pd** | Arrangør avklarer DQ, untimed og kilder; ingen automatisk historisk omskriving | Korrekt status/distanse for den dokumenterte 2007-feilen etter godkjenning; testet tid/ID/referanser, trygg rendering og separate deltakelses-/fullføringsregler. |
| **B – vedlikehold / B1** | Fire testnivåer, færre overflødige gallerier, nåværende referanser og mindre dobbeltarbeid; S-04/A-06 | **4–8 pd** | Impact-regler må ikke maskere datakritiske eller visuelle endringer | Hurtig-, funksjonell-, visuell- og full kontroll finnes; målt CI-tid og alle kritiske porter beholdt. Mindre modulære uttrekk her; selve motoruttrekket budsjetteres i D1. |
| **C – arrangørverktøy / C1** | Privat diplomadministrasjon og masseutskrift; M-06 | **8–14 pd inkrement** | A1/A2, felles jobb-/identitets-/policykontrakter fra D1/D2, eksisterende maler. Risiko: ugyldig godkjenning, feil historisk nivå, bare første side kontrollert | Søke/filter/utvalg, historisk merkevalg, begge samlingsvalg, forhåndsvisning, statusrapport, samlet A4-PDF og alternativ ZIP; hver side godkjent og kontrollert; driftet og selvdriftet løp. |
| **C – arrangørverktøy / C2** | Startliste → merkeprognose/premieliste → resultatavstemming → faktiske kandidater → diplomjobb; I-06 | **12–20 pd inkrement** | Felles import/admin/identitetsmotor fra D1/D2 og rapport-/jobbstøtte fra C1. Reelle EQ-prøvefiler. Risiko: prognose blir deltakelse, dubletter eller feil personkobling | Versjonert startliste, oppdateringer/strykninger, betingede regler, CSV/XLSX/PDF, avviksrapport og endelig liste; avklarte kandidater overføres uten automatisk tildeling. |
| **D – produktplattform / D1** | Felles beregningsmotor, generell utgave-/sesongmodell og bakoverkompatibel Morothon-adapter; A-02/A-04/R-02/R-04/I-03 | **16–30 pd** | A2/B1; høy migreringsrisiko ved identitet, tidspunkt, telleenhet og policy | Morothons kontrollverdier og design består. Starter, utgaver, år, sesonger og fullføringer skilles. Årlig løp og syntetisk 20-runderssett bruker samme motor. |
| **D – produktplattform / D2** | Felles EQ-resultatimport, journal, rettelser og enkel privat arrangøradministrasjon; I-01/I-02/I-04/P-02 | **15–25 pd** | A1/A2 og relevante D1-kontrakter. Kildeformat, tilgang og samtidighet | Arrangør laster opp, avklarer identitet, ser scope-diff, forhåndsviser og publiserer separat. Omimport, manuelle overstyringer og rollback fungerer. |

**Regnskap:** A = 6–12 pd, B = 4–8 pd, C = 20–34 pd, D = 31–55 pd. Den opprinnelige basen A+B+D er fortsatt **41–75 pd**; de to nye funksjonene gir **20–34 pd** ekstra, totalt **61–109 pd**. Det tilsvarer omtrent **12–22 personuker netto** ved fem arbeidsdager. Med foreløpig buffer 25–40 % blir planleggingsspennet omtrent **15–31 personuker**. Dette er ikke fastpris, kalenderløfte eller omfang for en full flerbruker-SaaS. Juridisk arbeid, omfattende datavask/kildesøk, nye medaljemotiver og ukjente leverandørintegrasjoner er utenfor.

C-estimatene er **tillegg til**, ikke erstatning for, den delte motoren og import-/administrasjonsgrunnlaget. Startlisteadapteren gjenbruker D2s mapping, journal, identitetsavklaring og revisjoner. Prognosen bruker D1s motor. C1 tilfører utvalg, jobber, historisk Heder-scope, sammenslåing og ZIP rundt eksisterende maler. C2 gjenbruker C1s rapport-/jobbstøtte. I-04, P-02 og S-03 er overlappende delarbeid, ikke tre ekstra adminprosjekter.

## Første fem utviklingsoppgaver – anbefalt rekkefølge

1. **A1: Skill offentlig og privat data.** Ingen ny startliste eller diplomjobb skal havne i en offentlig JSON ved et uhell.
2. **A2: Validering og statuspolicy.** Håndter R-01 som en kontrollert, arrangørgodkjent rettelse; ikke vent på hele plattformen, men ikke gjett på DQ-reglene.
3. **B1: Raskere, målrettede tester.** Behold full regresjon og alle relevante trykkporter. Dokumenter og rydd foreldede beskrivelser fra avvikslisten i 02 som separat vedlikehold.
4. **C1: Tidlig Morothon-pilot for masseutskrift.** Trekk frem akkurat nødvendige delkontrakter fra D1/D2, ikke hele plattformen. Privat mottakerutvalg, eksisterende maler og kontrollert PDF først.
5. **C2: Pilot for hele arrangørflyten.** Start med én kjent EQ-startliste og tilhørende resultateksport, historikk/policy og manuell identitetskontroll. Avstem prognose og faktiske resultater før premieliste og diplomjobb.

Tidlig C1-pilot er **4–7 pd av C1**, og C2-pilot **6–10 pd av C2**. C2-piloten kan begrenses til én bekreftet CSV-import og CSV/PDF-rapport; ekte XLSX, flere formater og generelle sesongregler gjenstår da innen full C2. Historiske Heder-merker utover dagens høyeste krever eksplisitt scope-/godkjenningsutvidelse; den første C1-piloten kan starte med historiske løpermerker og Heders gjeldende hovedutmerkelse. Delpilot er ikke godkjenning av alle funksjonskrav.

Omtrent **9–17 pd av det allerede budsjetterte D-arbeidet** kan måtte trekkes frem: 3–5 pd regel-/adapterkontrakter fra D1, 3–5 pd privat lokal administrasjon og 3–7 pd resultatadapter/journal fra D2. Dette kommer **ikke oppå 61–109 pd**. Valgt tilgangsløsning og faktiske eksportfiler avgjør hvor mye som trengs tidlig. Full støtte for ukentlige karuseller og flere telleenheter må vente til D1s generelle modell er kontrollert.

## Trinnvis verifikasjon

**Sikker grunnlinje:** behold dagens referanseverdier, person-ID-er, rettelser og maler. Flytt private data kontrollert; ikke slett originalbevis eller skriv om Git-historikken som en sideeffekt. En godkjent R-01-rettelse skal ha eget spor.

**Avgrenset arrangørpilot:** bruk eksisterende diplommotor og alias-/identitetskontroll, et privat administrasjonsverktøy og en versjonert Morothon-policy. Bekreft at arrangøren kan produsere et kontrollert sett og gjennomføre neste årlige oppdatering uten kodeendring. Pilotens nedskalerte funksjoner må navngis tydelig.

**Generalisering:** gammel og ny motor kjører side om side. Flytt én forbruker om gangen: statistikk, merker, profiler, kort og diplomer. Forskjeller er enten null eller særskilt godkjente korreksjoner. Prøv én annen årlig arrangør og et lite serieeksempel med flere runder samme år; ikke lov støtte for alle EQ-formater.

**Produktleveranse:** konfigurasjon/tema, kontrollerte moduler, data-/assetrettigheter, installasjon og overlevering. Praktiske verktøy skal ikke kreve et komplett produkt før de kan prøves, men «selvbetjent» og «komplett selvdrift» skal først loves når kunden faktisk kan bruke og overta løsningen.

## Akseptansekriterier for arrangørflyten

Dette er krav til senere implementering, **ikke tester som er utført på nye funksjoner nå**.

| Område | Prøve og forventet resultat |
| --- | --- |
| Betinget merke | Ni tidligere + én påmelding gir mulig tiende/Sølv med konkret betingelse; historikk, personens bekreftede total og `awards` er urørt. |
| Identitet | Bekreftet kobling gjenbrukes; nye entydige navn foreslås, tvetydige treff krever kontroll. Usikker identitet vises ikke som bekreftet debutant eller endelig premiekandidat. |
| Omimport og oppdateringer | Samme fil/scope gir null dubletter. Ny påmelding, endret nummer, konkurransebytte og strykning gir diff. Fravær i deltafil sletter ingenting. Manuelle rettelser bevares eller gir konflikt. |
| Flere starter og sesonger | To distanser i én Morothon-utgave gir høyst ett nytt deltakelsesår. Ukentlige runder gir egne utgaver; sesongnullstilling og sesongmerker følger valgt policy. Planlagte/avlyste runder teller ikke som gjennomført. |
| Resultatavstemming | Test DNS, DNF, DQ og fullføringskrav etter godkjent policy. Etteranmeldte uten startlisterad tas med; strykning som motsies av resultat flagges. Avvik og endelig premieliste kan forklares per person. |
| Rapport og premier | Antall/navn per nivå, distanse/startnummersortering, usikre treff og endringsliste stemmer. CSV er formelsikker, XLSX er reell arbeidsbok med bevarte tekstnumre, PDF og valgfri pakkeliste bygger på samme data. Gamle merker bestilles ikke på nytt uten eksplisitt valg. |
| Overføring til diplom | Bare avklarte faktiske kvalifikasjoner gir foreslåtte jobbposter. Ingen automatisk godkjenning, registrering i `awards` eller utstedelse. Dugnadsinnsats utledes aldri av løpsresultater. |
| Utvalg og historikk | Filtre, utvalg og sortering gir forventede mottakere. Historisk løper- og dugnadsmerke viser terskel, opptjeningsperiode og dato på valgt tidspunkt. Samlingen inkluderer ikke senere merker. Begge diplomvalg virker uavhengig av personkortene. |
| Heder-unntak | Historiske Heder-valg krever nytt eksplisitt scope og riktig godkjenning, uten å slå av dagens `canPresent`. Godkjent total uten enkeltår får ingen oppdiktet dato. Einars utdelingsdato 7. november 2026 består. Skjult Heder-profil kan ikke velges, mens ordinær løperprofil er uendret. |
| Hver side | Manglende godkjenning, feil asset/font/DPI eller faktisk avkutting på **siste** side stopper ren produksjon. Korte/lange navn/datoer og begge varianter kontrolleres. Ingen stille utelating av feilende mottakere. |
| Sluttfil | N valgte diplomer gir N liggende A4-sider i riktig rekkefølge, med innebygde fonter, uten blanke sider eller rasterisering av hele diplomet. ZIP har N unike, trygge navn og manifest. |
| Oppdatert grunnlag | Ny historikk, policy, identitet, tilbakekalt godkjenning eller personvernendring gjør berørte uferdige jobber utdaterte. En endret variant arver ikke gammel hashgodkjenning. |
| Tilgang og status | Uvedkommende/annen arrangør får ikke jobb eller nedlasting. Generering/nedlasting/`afterprint` betyr ikke fysisk utskrift eller utdeling. Operatørbekreftelse er separat, omkjøring gir ikke doble vedtak. |
| Leveranse og kapasitet | Samme funksjoner prøves lokalt ved selvdrift og i driftet administrasjon, uten utviklerens kontoer. 25/100 sider måles med begrenset parallellitet, avbryt/gjenoppta og verifisert sluttfil. |

## Øvrige produktspor, bare ved behov

| Arbeid | Grovt omfang og risiko | Binding til grunnplanen |
| --- | --- | --- |
| Driftet flerbrukeradministrasjon med roller | 3–6 personuker; kundeskille og deployrettigheter er kritiske | Utvider/overlapper D2; komplett SaaS er ikke inkludert i 61–109 pd. |
| Selvdriftspakke, restore og oppgraderinger | 2–4 personuker; dokumentasjon og migrering må testes | Samme motor/admin, rettigheter og schemas; enkelte deler inngår i D2. |
| Karusell/sammenlagt, beste N og poeng | 3–6 personuker; regeltvetydighet | Bygger på D1; avansert poengmotor er ekstra utover modell-/prognosestøtten. |
| Flere temaer og fullstendig valgfritt Heder-uttrekk | 3–6 personuker samlet; historisk/visuell kompatibilitet | D1/config og S-01; assetrettigheter og malreferanser. |
| Større volumer, worker eller dataoppdeling | 2–6 pd innledende måling/prototype | Større tiltak kun ved målte terskelbrudd i 05; ikke automatisk database. |

Disse sporene kan overlappe hverandre og D-arbeidet. De skal spesifiseres før tilbud, ikke summeres ukritisk. Lisens-/rettighetskartlegging P-01 og kommersiell pilotkartlegging P-04 må også avklares før eksternt salg; juridisk arbeid er utenfor de tekniske anslagene.

## Bevaringskrav og beslutninger før implementering

Morothons navn, ID-er, redirects, resultater, kategorier, medaljer og design beholdes gjennom adapteren. Profil, rangering, kort og diplomgrunnlag skal bruke samme versjonerte regler; kildeplass og beregnet plass kan fortsatt være ulike og merkes riktig. Fremtidige starter flytter ikke tidligere opptjening. Et utstedt dokument omskrives ikke stille. Heder forblir valgfritt og dugnad adskilt fra løp. Ingen kvalifikasjon blir et automatisk vedtak.

Før implementering trengs beslutninger om offentlige/private felter, kildeavklaring av R-01/R-06, DQ og stafettetapper, faktiske startliste-/resultatfiler, fullsnapshot/delta, tellende enhet og sesongvindu, høyeste nye kontra alle nye premier, samtidige redaktører, godkjenningsmyndighet, kilde-/assetrettigheter og drift/support. Dette blokkerer ikke revisjonsleveransen. Akseptansemålet er at arrangøren kan utføre neste oppdatering og at en annen IT-leverandør kan overta uten våre personlige kontoer.

**Anbefalt start:** A1, A2 og B1, deretter de avgrensede C1/C2-pilotene med nødvendige delkontrakter fra D. Ingen samlet omskriving eller produksjonsendring før planen er gjennomgått.
