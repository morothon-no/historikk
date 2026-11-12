# 07 – Prioritert forbedringsplan

Dette er en gjennomføringsplan til godkjenning, ikke en bestilling som er satt i verk. Produksjonskode, data, design og regler er bevart. Første produkt bør gjenbruke Morothons styrker og dokumentere ekvivalens, ikke flytte alt til en ny stack på én gang.

## Første fem utviklingsoppgaver – anbefalt rekkefølge

| Prioritet | Konkret leveranse | Funn / verdi | Estimat | Avhengighet og risiko | Ferdig når |
| --- | --- | --- | --- | --- | --- |
| **1** | **Offentlig dataprojeksjon og privat administrativt lager** | S-01/S-07: intern historikk og skjulte profiler skal ikke automatisk følge med offentlig bygg | **3–6 pd** teknisk, pluss publiseringsavklaringer | Eier bestemmer tillatte felt; risiko for tap av legitim historikk eller utilsiktet republisering | Offentlig pakke har eksplisitt schema; private felter/avslåtte profiler stoppes ved eksport; rollback respekterer skjuling. Godkjente offentlige resultater er uendret. |
| **2** | **Datavalidering og entydig statuskontrakt** | R-01/R-03/S-02: behandle den dokumenterte diskvalifikasjonsraden korrekt etter avklaring; avvis ugyldige tider/ID-er og sykluser | **3–6 pd**, med kilde-/regelavklaring utenom | Ingen automatisk endring av DNS/DNF/DQ-telling. Historisk untimed/ukjent må kunne representeres. | Publiseringsvalidator og små tester dekker dagens unntak, DQ-visning, feil tid/ID, orphans og aliaser. Nye importverdier kan ikke havne som kjørbar inline-kode. |
| **3** | **Fire testnivåer og gjenbrukbare, nåværende referanser** | S-04/A-06: mindre venting og mindre kobling til bestemte personer/Git-commits | **4–8 pd** | Avklar hvilke endringer som alltid krever datakritiske og visuelle porter; ikke fjern printkontroll for å spare tid. | A/B/C/D kan kjøres eksplisitt; docs-only og enkle endringer unngår fem gamle gallerier; full regresjon finnes og referanseverdier består. Mål ny faktisk CI-tid. |
| **4** | **Felles beregningsmotor, generell utgavemodell og Morothon-adapter** | A-02/A-04/R-02/R-04/I-03/M-02: én sannhet og flere utgaver per år uten kundespesifikke kodegrener | **16–30 pd** samlet | Kontrakt fra oppgave 2 og raske tester fra 3. Høy risiko ved identitet, perioder og telleenhet; ingen stille regelendring. | Gamle/nye Morothon-utdata er like; alle fire rekorder, milepæler og historiske diplomer består. Ett syntetisk 20-runderssett har separate starter, utgaver, sesonger og år. Grunnpakken fungerer uten Heder. |
| **5** | **EQ-import med avstemming og enkel arrangøradministrasjon** | I-01/I-02/I-04/P-02: arrangøren oppdaterer uten GitHub/Codex | **15–25 pd** for avgrenset pilot | Oppgave 1, 2 og 4; representative eksportfiler og rettigheter. Risiko ved uklar mapping, samtidighet og manuelle rettelser. | Arrangør laster opp, avklarer identiteter, ser diff, forhåndsviser og publiserer separat. Omimport gir ingen dubletter; konflikter og rollback fungerer. |

Anslag: **41–75 persondager**, omtrent **8–15 personuker** netto ved fem arbeidsdager per uke. Med en foreløpig usikkerhetsbuffer på 25–40 % er et grovt planleggingsspenn **10–21 personuker**. Dette er ikke kalenderløfte eller fastpris. Dagene overlapper estimatene i de andre dokumentene; de skal ikke legges oppå dem. Juridisk arbeid, kildesøk/datavask og nye grafiske motiver er utenfor. Kalender og bemanning må avtales etter pilotavklaringen.

R-01 kan håndteres som en liten separat rettelse etter arrangørens avklaring, uten å vente på hele produktløpet. Revisjonen gir ikke tillatelse til å endre kildedata automatisk. Oppgave 1–3 kan delvis gå parallelt; motor/modell må stabiliseres før den nye importflyten blir produksjonsautoritet.

## Trinnvis uttrekk og verifikasjon

**Fase A – dokumentert sikker grunnlinje:** godkjenn rapporten, datagrensen og statuskontrakten. Registrer dagens offentlige utdata som Morothon-referanse. Flytt private opplysninger kontrollert; ikke slett originale bevis eller skriv om offentlig Git-historikk som en sideeffekt.

**Fase B – motor før ny presentasjon:** trekk ut funksjoner uten ny design. Adapteren leser dagens komprimerte arrays og gir den nye modellen. Kjør gammel og ny motor side om side, med forskjellsrapport. Bytt deretter én forbruker om gangen: statistikk, milepæler, profiler, kort og diplomer. En forskjell må være enten null eller en særskilt godkjent korreksjon.

**Fase C – importpilot:** ett årlig arrangement i tillegg til Morothon og ett kontrollert serieeksempel. Ikke lov støtte for alle leverandørformater. Aksepter forskjellige EQ Timing-eksporter gjennom versjonerte mappinger. Behold manuell redaksjonell behandling der kildene er tvetydige.

**Fase D – produktleveranse:** grunnleggende tema/config-skjemaer, kontrollerte moduler, installasjons-/overleveringspakke og dokumentert drift. Først da er «selvbetjent» og «komplett selvdrift» dokumenterbare leveranser.

## Senere arbeid, bare ved behov

| Arbeid | Forventet effekt | Grovt omfang og risiko | Avhengigheter |
| --- | --- | --- | --- |
| Driftet flerbrukeradministrasjon med roller | Redigering og publisering uten lokal teknisk hjelp | 3–6 personuker; høy risiko ved kundeskille og deployrettigheter | Privat datagrense, stabile revisjoner, valgt driftsavtale |
| Selvdriftspakke, restore og oppgraderingsløp | Kunden/IT-leverandøren overtar uten utviklerkontoer | 2–4 personuker; middels migrerings-/dokumentasjonsrisiko | Samme motor/admin, schema-migreringer, lisensavklaring |
| Karusell/sammenlagt med avtalte poengregler | Beste N, sesongpoeng og flere runder per år | 3–6 personuker; høy regeltvetydighet | Edition-/seasonmodell og eksplisitt scorepolicy |
| Flere godkjente temaer og komplett Heder-uttrekk | Kundetilpasning uten forking, valgfri dugnadshistorie | 3–6 personuker samlet; visuell og historisk kompatibilitet må kontrolleres | Tokens, modulmanifest, rettigheter til assets og tekster |
| Større volumer, workers eller dataoppdeling | Kortere hovedtrådarbeid ved voksende arkiv | 2–6 pd først for måling/prototype; større tiltak kun etter terskelbrudd | Representative kundedata og mål i 05 |

Disse anslagene er alternativer/arbeidsstrømmer som kan overlappe oppgave 5; de er ikke en automatisk ekstra bestilling. Database, SSR, et nytt frontend-rammeverk og mange tjenester er ikke mål i seg selv.

## Kritiske akseptansekriterier

1. **Bevaring:** Morothons navn, ID-er, redirects, resultater, kategorier, grafikk og design beholdes gjennom adapteren. Besluttede korreksjoner har separat spor.
2. **Sannhet:** profil, rangering, kort, merker og diplomgrunnlag bruker samme versjonerte regler. Kildeplass og beregnet klasseplass kan fortsatt være forskjellige, men merkes korrekt.
3. **Historikk:** framtidige starter flytter ikke tidligere opptjening. Ukjent dato/innsatsår fylles ikke med gjetning. Et gammelt utstedt dokument omskrives ikke stille.
4. **Import:** samme scope/fil gir ingen dubletter; manuelle rettelser bevares eller varsles som konflikt; andre konkurranser er urørt; ingen automatisk identitetskobling ved tvil.
5. **Moduler:** Heder er valgfritt både i kode og offentlig data. Hedersinnsats blir aldri løpsdeltakelse, og kvalifikasjon blir aldri automatisk et vedtak.
6. **Godkjenning:** redigering, publisering og eventuell formell utstedelse er ulike handlinger med nødvendige rettigheter. DPI-, asset-, font- og layoutporter beholdes.
7. **Overtakelse:** en annen IT-leverandør kan installere, importere en ny utgave, ta backup, gjenopprette og oppgradere uten våre personlige kontoer.

## Beslutninger som trengs før implementering

Disse er ikke hindringer for å levere revisjonen, men premisser for neste oppdrag: tillatte offentlige/private felter, kildeavklaring av R-01/R-06, policy for DQ og individuelle stafettetapper, hvilke to importvarianter pilotene faktisk bruker, forventede sesong-/volumgrenser, behov for samtidige redaktører og formell diplomutstedelse, rettigheter til kode/data/grafikk og ansvar for drift/support.

Første produktbeslutning bør være om en årlig arrangør kan gjennomføre neste oppdatering selv. En pilot som fortsatt krever manuell kodeendring for hver filvariant har ikke nådd målet, selv om nettsiden ser ferdig ut.

**Anbefalt start:** godkjenn først de fem oppgavene over som separate, målbare leveranser – offentlig datagrense, validering/status, testnivåer, felles motor/modell og til slutt import/adminpilot. Ikke gjennomfør en samlet omskriving før dette er gjennomgått.
