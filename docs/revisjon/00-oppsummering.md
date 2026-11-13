# Morothon – ledelsesoppsummering

**Main `53f8f50`, revidert 12. november og supplert 13. november 2026.** Siste `main` er kontrollert og uendret. Dette er analyse og planlegging; kode, data, navn, ID-er, regler, medaljer og design er bevart. Les [arkitektur](01-arkitektur.md), [beregninger/dokumentasjonsavvik](02-beregninger.md), [modell/import](03-datamodell-og-import.md), [moduler/diplomer](04-moduler-og-design.md), [drift/sikkerhet](05-drift-og-sikkerhet.md), [produkt/salg](06-produkt-og-salg.md) og [forbedringsplan](07-forbedringsplan.md).

## Konklusjon

Morothon er en godt verifisert referanseløsning med et realistisk produktpotensial, men **ikke en ferdig generell arrangørplattform**. Behold den statiske offentlige nettsiden og dagens personlige uttrykk. Trekk ut felles regler og bygg privat arrangøradministrasjon rundt dem. Målingene begrunner ikke full omskriving, lesedatabase eller nytt frontend-rammeverk nå.

Den viktigste nye verdien er én praktisk arbeidsflyt: **startliste → betinget merkeprognose og premiebehov → resultatavstemming og faktiske kandidater → kontrollert diplomproduksjon**. Ingen påmelding teller automatisk som deltakelse, og ingen kvalifikasjon eller PDF betyr formell utdeling.

## Det som bør beholdes

- Historiske rettelser, stabile identiteter, Morothon-presentasjonen og godkjente medaljemotiver.
- Ett merkeregister, faktiske kvalitets-/DPI-opplysninger og innholds-/font-/layoutkontroller.
- Historiske opptjeningstidspunkter og skillet mellom dugnad, løp, kvalifikasjon og utdeling.
- Statisk drift, få produksjonsavhengigheter, deterministisk bygg og regresjonsgrunnlaget.

## Viktigste funn

**Offentlig og privat må skilles.** Byggeren kopierer hele hedersregisteret, også intern historikk og skjulte profiler, til den offentlige pakken. Lokal HTTP-kontroll bekreftet tilgjengeligheten. UI-skjuling og `noindex` gjør ikke JSON privat. Tillatte eksportfelt må avklares; revisjonen sletter eller flytter ingenting.

**Én eksisterende statusfeil er påvist.** En 2007-rad med «Disket» i tidsfeltet og rå status «Fullført» vises som fullført og bidrar med 14 km i fullført distanse. Den får ikke tidsplassering eller rekord. Rettelsen krever arrangøravklaring, særlig om DQ skal telle som deltakelse. Stafett-/tids-/ID-avvik er dessuten gjenskapt i syntetiske data; dette beviser ikke at dagens totalsummer generelt er gale.

**Koblingene hemmer gjenbruk.** `index.html` er omtrent 348 kB, med rundt 101 kB inline-CSS og 111 kB inline-JS. Eksterne moduler bruker globale funksjoner; år fungerer som utgave-ID og Morothon-regler er skrevet flere steder. En generell motor må skille starter, tellende utgaver, år, sesonger og fullføringer. Karusellregler skal ikke gjenbruke årstelling ukritisk.

**Testene gir trygghet, men koster vedlikehold.** Den opprinnelige kontrollen gav **215/215 bestått**, ca. 6 min 50 s lokalt. Fem ekstra PR-gallerier la til ca. 3 min 15 s og 94 PDF-er, før installasjon/opplasting. Dette er ikke målt GitHub-fakturering. Innfør fire testnivåer og færre historiske gallerier uten å svekke kontrollportene.

**Veiledningen henger etter.** `docs/honors.md` har avvik om synlige personer, Erling Danielsen, Anne Lene/Lailas startår og historiske dugnadsdiplomer. Det er 44 interne registreringer, **43 synlige**. Ny skrivebeskyttet diplomkontroll gir **60 rene + 28 ventende varianter internt**, 60 + 26 i synlig utvalg. Ventende varianter trenger fortsatt merking; det betyr ikke at alle forhåndsvisninger er utskriftsblokkert. Avvik og anbefalt opprydding er dokumentert i 02; personopplysninger og godkjenninger er urørt.

## De nye arrangørverktøyene

**Masseutskrift:** privat mottakerutvalg med søk/filter, historisk merkevalg, begge medaljevisninger, sortering, samlet forhåndsvisning/statusrapport og én liggende A4-side per diplom i samlet PDF, alternativt enkeltfiler i ZIP. Gjenbruk maler og beregninger, men kontroller hver side og hver variant. Historiske Heder-valg krever et nytt eksplisitt scope; dagens høyeste-merke-sperre må ikke bare fjernes. Generert, utskrevet og utdelt holdes adskilt.

**Merkeprognose og premieliste:** EQ Timing først, med felles adapter-/identitetsregister og versjonerte startlister. «9 tidligere → mulig 10. deltakelse → Sølv» er betinget. Oppdateringer, strykninger og usikre navn gir diff/kontroll, aldri fiktive resultater. CSV, ekte XLSX, PDF og valgfri pakkeliste bruker samme rapportgrunnlag. Resultatimport avstemmer faktiske oppnåelser før endelig premieliste og foreslått diplomjobb.

En tidlig, avgrenset Morothon-pilot kan gjenbruke dagens motor/maler før hele plattformen er generalisert. Begge verktøyene skal fungere i privat driftet administrasjon og ved komplett selvdrift. De er **ikke implementert** i denne leveransen.

## Prioritering, omfang og produkt

Første fem oppgaver: **1)** offentlig/privat datagrense, **2)** validering/status, **3)** målrettede testnivåer, **4)** Morothon-pilot for masseutskrift, **5)** startliste/prognose/resultatavstemming og diplomflyt. Nødvendige delkontrakter fra felles motor/import trekkes frem til pilotene; full generell plattform bygges trinnvis.

Planen i 07 skiller **A kritisk**, **B vedlikehold**, **C arrangørverktøy** og **D produktplattform**. Opprinnelig A+B+D var **41–75 persondager**. Nye C1/C2 gir **20–34 pd** ekstra, samlet **61–109 pd**, omtrent 12–22 netto personuker eller 15–31 med foreløpig buffer. Felles motor, import, identitet og admin telles bare én gang. Delpilotene er delmengder; juridisk arbeid, omfattende datavask og komplett SaaS er utenfor.

Én kodebase kan tilbys som Adelskalender, Pluss med merker/prognose/diplomer, valgfri Heder og karuselltillegg. Selvdrift er en leveranseform, ikke en kundegren. Rettigheter til kode, data, fonter og grafikk må avklares før salg; betalingsvilje er ikke undersøkt.

De opprinnelige målingene gjenbrukes på identisk runtime: 2 643 personer, 6 914 rader og korrekte 2026-kontrolltall/rekorder. De dokumenterer dagens løsning, ikke de foreslåtte funksjonene. Godkjenn plan og avgrensning før implementering; ingen merge eller publisering inngår.
