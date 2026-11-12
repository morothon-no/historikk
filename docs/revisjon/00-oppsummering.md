# Morothon – ledelsesoppsummering

**Revisjon av main `53f8f50`, 12. november 2026.** Dette er analyse og planlegging. Resultater, navn, identiteter, regler, grafikk og design er ikke endret. Les detaljene i [arkitektur](01-arkitektur.md), [beregninger](02-beregninger.md), [modell/import](03-datamodell-og-import.md), [moduler/design](04-moduler-og-design.md), [drift/sikkerhet](05-drift-og-sikkerhet.md), [produkt/salg](06-produkt-og-salg.md) og [forbedringsplan](07-forbedringsplan.md).

## Konklusjon

Morothon har en funksjonsrik og godt verifisert referanseløsning. Den kan realistisk utvikles til et kommersielt produkt, men er **ikke en ferdig generell arrangørplattform i dag**. Den enkleste veien er å beholde den statiske offentlige nettsiden, trekke ut en felles beregningsmotor og bygge en kontrollert import-/administrasjonsflyt rundt den. Målingene begrunner ikke en full omskriving, en database på lesesiden eller et nytt frontend-rammeverk nå.

## Det som bør beholdes

- Den personlige Morothon-presentasjonen, historiske rettelser og de kontrollerte identitetene.
- Ett merkeregister, faktiske kvalitets-/DPI-opplysninger og dokumentkontroll som oppdager endret innhold, manglende grafikk og reell avkutting.
- Historiske opptjeningsår, lojalitetsperioder og skillet mellom dugnad, løp, kvalifisering og formell tildeling.
- Statisk drift, få produksjonsavhengigheter, deterministisk bygg og publisering av samme verifiserte artefakt.
- Regresjonsgrunnlaget som sikrer at tidligere rettelser ikke forsvinner.

## Viktigste funn

**1. Intern informasjon følger med den offentlige pakken.** Byggeren kopierer hele hedersregisteret, også revisjonshistorikk, interne notater og skjulte profiler. En lokal HTTP-kontroll bekreftet dette. UI-skjuling og `noindex` gjør ikke JSON privat. Før ekstern kommersiell bruk bør offentlig eksport skilles fra privat administrativ sannhet. Dette krever en beslutning om hvilke opplysninger som faktisk skal publiseres; revisjonen sletter eller flytter ingen data.

**2. Én konkret statusfeil er påvist.** En eksisterende 2007-rad med «Disket» i tidsfeltet og «Fullført» i statusfeltet tolkes og vises som fullført. Den får ikke tidsplassering eller rekord fordi tiden er ugyldig, men statusvisningen er feil og raden bidrar i summert fullført distanse. Dette bør håndteres separat med arrangøravklaring. I tillegg er ulike stafett-tellinger, svake tidsgrenser og ugyldige ID-er gjenskapt i syntetiske data. Disse er import-/produktkontraktsrisikoer, ikke bevis for at dagens totalsummer generelt er gale.

**3. Den største tekniske gjelden er koblingene.** `index.html` er omtrent 348 kB, med rundt 101 kB inline-CSS og 111 kB inline-JS. Flere eksterne moduler er avhengige av globale funksjoner fra denne siden. År er i praksis utgave-ID; 2014, løpsnavn, distanser, norske tekster og kundespesifikke diplomvalg er skrevet inn flere steder. Det hindrer trygg gjenbruk mer enn det hindrer dagens drift. Gjelden er håndterbar for ett arrangement, men betydelig ved generalisering. Omfanget i planen er ikke bare «opprydding»: import og administrasjon er også ny produktfunksjonalitet.

**4. Testene er verdifulle, men dyrere og mer kundebundne enn nødvendig.** 215 av 215 tester bestod. Testpakken tok ca. 6 min 50 s lokalt; fem ekstra PR-gallerier la til ca. 3 min 15 s og 94 PDF-filer. Dette er før installasjon/opplasting og er ikke målt GitHub-fakturering. En tidligere endring som skjulte én person berørte 24 filer, mye på grunn av faste personantall og gamle kontrollgallerier. Innfør hurtig-, funksjonell-, visuell- og full kontroll uten å svekke data- eller trykksikkerheten.

**5. Import, enkel administrasjon og overtakelse må bli hovedproduktet.** Det finnes ingen generell EQ Timing-import, innlogget redigering eller ferdig kundeadministrasjon. Kunden kan teknisk selvdrifte den statiske løsningen allerede, men må bruke utviklerverktøy for vanlige oppdateringer. En lokal eller driftet liten administrasjonsløsning kan dekke dette uten å erstatte den offentlige nettsiden.

## Målingene setter størrelsen på problemet

Dagens fil har 2 643 personer og 6 914 resultatrader. Kontrollene gav fortsatt 398 deltakere, 195 debutanter og 22 nye merker i 2026, korrekt rekordsett og riktig historisk sølvdiplom. De nåværende personenes deltakelsesår hadde ingen avvik mot profilens beregnede total.

Lokal bildeberedskap var omkring 0,7 s. En syntetisk volumtest med 110 624 rader brukte ca. 4,3 s og omtrent 47 MiB V8-heap; søk og milepæler begynte da å gi lengre hovedtrådarbeid. Med strupet nettverk ble all bildeberedskap langt tregere. Dette er laboratorietester, ikke produksjons-LCP eller måling på en fysisk telefon. Optimaliser bilder, indekser og beregning før backend innføres av ytelsesgrunner.

## Produkt og leveranse

Tilby én kodebase med Adelskalender som kjerne, Pluss med merker/diplomer/deling, valgfri Heder og eget karusell-/sammenlagttillegg. Selvdrift er en leveranseform med kode, verktøy, dokumentasjon og eksport – ikke en separat kundegren. Behold eierskap til fellesproduktet som utgangspunkt; kildekodelevering innebærer ikke automatisk eksklusiv overdragelse. Rettigheter til kode, resultater, logoer, medaljer og tredjepartsressurser må avklares før salg. Ingen pris eller full juridisk godkjenning kan utledes av repositoryet.

## Anbefalt prioritering av de første fem utviklingsoppgavene

1. **Skill offentlig dataprojeksjon fra privat historikk og administrasjon.**
2. **Etabler validering og entydige statusregler**, inkludert kontrollert håndtering av den dokumenterte diskvalifikasjonsfeilen.
3. **Del testene i fire nivåer**, med små generiske kontraktssett og færre gjentatte historiske gallerier.
4. **Trekk ut felles motor og generell utgavemodell**, med Morothon-adapter som bevarer dagens oppførsel.
5. **Lever EQ-import og enkel administrasjon som pilot**, med diff, manuelle korreksjoner, identitetsgodkjenning og separat publisering.

Grovt nettoomfang for disse fem er 41–75 persondager, med betydelig usikkerhet; juridisk arbeid og omfattende datavask kommer utenom. Godkjenn retning og avgrensning før implementering. Ingen merge eller publisering inngår i revisjonsleveransen.
