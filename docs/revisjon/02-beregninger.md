# 02 – Beregninger, datakvalitet og historisk stabilitet

Grunnlag: main `53f8f50`, 215 beståtte regresjonstester og isolerte nettleserprober. **Ingen regler, navn eller resultatrader er rettet i revisjonen.** Tabellene skiller en påvist feil i eksisterende dataflyt fra risikoer som bare er gjenskapt med syntetiske data.

## Kontrollerte tall

| Kontroll | Målt resultat | Tolkning |
| --- | --- | --- |
| Personer / resultatrader | 2 643 / 6 914 | 216 rå DNS-rader; personlisten inneholder ingen DNS-only-personer. |
| Tellende starter / unike person-år | 6 698 / 6 695 | Tre ekstra starter i allerede registrerte person-år; ikke tre ekstra deltakelsesår. |
| Sum årsstatistikkens deltakere | 6 695 | Stemmer med unike person-år. |
| Omdirigeringer / aliasoppføringer | 37 / 40 | Ingen omdirigeringssykluser eller manglende endemål i gjeldende fil. |
| Resultatreferanser uten personobjekt | 79, **alle DNS** | Ingen tellende resultater manglet personobjekt. Ikke rapportert som 79 feilaktige deltakere. |
| Eksakt like komplette rader | 0 | Det utelukker ikke alle mulige semantiske dubletter; kilde-ID-er mangler. |
| `p.c` mot `startedYears(p).length` | 0 avvik for dagens personer | Beviser konsistens for dagens individuelle data, ikke for alle framtidige formater. |
| Forsidens 100 %-tall | 33 | Minst tre deltakelser gjennom siste arrangerte år; annen terskel enn lojalitetsheder. |
| 2026 | 398 deltakere, 195 debutanter, 22 nye merker | Kontrollverdiene består. Regresjonen dekker 17 bronse, 2 sølv, 1 titan og 2 æresløpere. |
| Ingers historiske sølvdiplom | 10, 2015–2024, oppnådd 2024 | Ikke dagens total; bekreftet dato finnes i datoregisteret. |
| Heder | 44 bevarte registreringer / 43 synlige | Ingen formelle tildelinger i `awards`; skjuling endrer ikke identiteten. |

Gjeldende rekordberegning gav Lars Aasheim Svaland **1:31:24 (2026)**, Ingrid Ukkelberg **1:54:00 (2023)**, Simen Koland **47:20 (2024)** og Marianne Andersen **56:37 (2025)**. Finn Gerhard Olsens 31 deltakelser og Gunnar Kåsas/Morten Borøs 35 inngår i regresjonsgrunnlaget.

## Regelkart

| Område | Eksisterende autoritet og kontroll | Viktig avgrensning |
| --- | --- | --- |
| Identitet | `history-data.js:resolveId`; `aliases`, `redirects`; `runner-link-review.cjs` | Navnelikhet er forslag, ikke automatisk sammenslåing. Hederskoblinger krever bekreftelse. |
| Deltakelse | `countsAsParticipation`, `participationYears`, `loyalty.calculate` | DNS teller ikke; DNF teller; ett år teller én gang. Se R-02 om individuell stafett-rad. |
| Fullføring og tid | `effectiveStatus`, `isCompletedResult`, `timeSeconds` | Untimede fullføringer finnes og skal ikke bli oppdiktede tider. Se R-01/R-03. |
| Plassering | `placements` og `sourcePlace` | Beregnet plass grupperes per år, løp, eksakt distanse, kjønn og juniorklasse; like tider får delt plass med hopp. Kildeplassering er et separat felt. For voksne brukes kjønn som beregningsklasse; rå aldersklassefelt grupperes ikke som juniorklassene. Det må avklares hva en ny arrangør mener med «klasseseier». |
| Hedersprofilens prestasjoner | `history-data.js:stats` | Siterer kildepallplasser; Adelskalenderens prestasjonsmerker bruker beregnet klasseplass. Dette er en tilsiktet forskjell, ikke automatisk en feil. |
| Rekorder | `index.html:calculateCourseRecords` | Fullført, positiv tid, riktig kjønn, eksakt løp/distanse og år ≥ 2014; alle samtidige rekordholdere beholdes. Ingen dokumentert lik trasé bare fordi distansen er lik. |
| Milepæler | `milestones.js:calculate` | Teller kanoniske årssett avgrenset til valgt år. Framtidige resultater flytter ikke et tidligere merke. |
| Lojalitet | `loyalty.js` | 70/90/100 %, minst fem mulige utgaver; periode slutter ved siste deltakelse. Historiske debutforankrede hedersperioder og comeback beholdes. |
| Rekker | `loyalty.js` | Arrangerte utgaver, ikke alle kalenderår. Aktiv rekke slutter ved siste arrangerte utgave; lengste historiske rekke beholdes. |
| Løperdiplomer | `diplomas.js:choices/model` | Merkediplom bruker de første N deltakelsesårene. Rekordvalg viser **gjeldende** rekord, ikke et register over alle tidligere rekorder. |
| Dugnad | `honors-data.js:serviceTenure` | Dokumenterte enkeltår, godkjent total og registrert periode er ulike grunnlag. Ukjent sluttår på minneprofil utvides ikke automatisk. |
| Hedersdiplomer | `diplomas.js:serviceContent` | Ordinær milepæl fryses til nivå/opptjeningsår. Godkjent total uten årsrekke gir ingen oppdiktet oppnåelsesdato. Einars avtalte utdelingsdato er et separat felt. |
| Formell utdeling | `awards`, `issuedDiplomas`, `diplomaApprovals`, `presentationPrintSet` | Kvalifisering, forslag, kontrollert presentasjon, endelig godkjenning og utstedelse må ikke blandes. Ingen automatisk tildeling observert. |
| Sammenlagtserie | Ingen generell motor funnet | Dagens rangering av enkelttider er ikke et sesongpoengsystem. |

Normaliseringen håndterer allerede sju rader med `DNF` i tidsfeltet selv om rå status sier fullført. Det er tilsvarende håndtering av `Disket` som mangler i R-01; dette er ikke grunn til å omskrive andre historiske resultater.

## Dokumenterte feil og avgrensede risikoer

| ID / type / alvorlighet | Fil/modul og faktisk observasjon | Anbefalt løsning og forventet effekt | Gjennomføringsrisiko | Omfang | Avhengigheter |
| --- | --- | --- | --- | --- | --- |
| R-01 · **bekreftet feil** · middels | [`history-data.js:5`](../../js/history-data.js#L5): raden fra 2007 for `MOR-B1AC0FD`, Kortmoro 14 km, har rå status `Fullført` og tidsfelt `Disket`. `effectiveStatus` returnerer `Fullført`, `isCompletedResult` er sann, og resultatvisningen viser fullført. Raden bidrar også med 14 km og én fullføring i `runnerTotals`. | Avklar korrigert status med arrangøren; normaliser diskvalifikasjonsmarkører på samme kontrollerte måte som DNS/DNF. Vis riktig status og skill fullført fra deltakelse. | Middels: avklar om diskvalifiserte skal telle som deltakelse; ikke endre denne regelen implisitt. Ugyldig tid gjør at raden allerede holdes utenfor tidsrank/rekord. | 0,5–2 pd pluss kildeavklaring | Arrangørbeslutning om status; ny regresjon |
| R-02 · reprodusert kontraktsavvik · middels, ingen berørte stafett-rader i dagens `results` | [`history-data.js:12/29`](../../js/history-data.js#L12) teller alle ikke-DNS-år; [`loyalty.js:18`](../../js/loyalty.js#L18) utelater stafett. Syntetisk person med individuelt løp i 2024 og stafett-rad i 2025 får henholdsvis 2 og 1. | Én eksplisitt deltakelsespolicy brukt av alle motorfunksjoner. Skill lag, individuelle etapper og individuell hovedkonkurranse. | Høy hvis man «retter» ved å endre hvem som teller uten fagbeslutning. Dagens fire lag ligger separat og gir ikke dette avviket. | 1–3 pd for kontrakt og tester; inngår i motoruttrekk | A-02; arrangørens etapperegel |
| R-03 · reprodusert valideringsrisiko · høy ved ny import | `timeSeconds` godtar `1:99:99` som 9 639 sekunder og `00:60` som 60. `create` godtar en fullført rad uten personobjekt. En syntetisk ID-syklus avvises ikke av `resolveId`. Gjeldende numeriske tider har ingen slike komponentoverskridelser. | Import-/publiseringsvalidator med tidsgrenser, statusenum, felt-/ID-kontroll og syklusdeteksjon. Tillat eksplisitt `elapsed: null` for untimede fullføringer. | Middels: historiske mangler må klassifiseres, ikke slettes av en ny streng validator. | 2–4 pd | I-01/I-02; historisk unntaksmodell |
| R-04 · modellrisiko · høy for karusell | `participationYears`, `yearStats`, `periodFor` og sammenligningsnøkler bruker kalenderåret som enhet; år 2014 er et globalt løypeskille. | Edition-/sesong-/løype-ID-er og eksplisitt `held/cancelled/planned`. Morothon-policy beholder år som deltakelsesenhet. | Høy: feil migrering kan doble merker og rekker. | 5–10 pd av generell modell, ikke tillegg til I-03 | I-03; kompatibilitetstester |
| R-05 · kravavklaring · middels for produkt | `diplomas.js:choices` tilbyr bare nåværende rekordholdere. Et senere bedre resultat kan fjerne et gammelt rekordvalg, selv om et diplom tidligere ble skrevet ut. | Skill «gjeldende rekordvisning» fra lagret historisk rekordprestasjon og faktisk utstedt dokument med versjonert grunnlag. | Middels: ikke endre dagens «regjerende rekordholder»-betydning. | 2–5 pd for historisk register etter modell | Formell utstedelsespolicy; I-03 |
| R-06 · datakvalitetsavklaring · lav/middels | To historiske tidsstrenger, `02:09.52` (1994) og `01:06.14` (1998), er ikke tolket av dagens parser. 687 rå «fullført»-rader har tekstlig fullføring uten numerisk tid. | Skill bevisst untimede resultater fra tvetydig tidsformat. Kontroller de to kildene manuelt; ikke gjett tid eller desimalsekunder. | Lav dersom kun rapportering; høy ved automatisk antakelse | 0,5–2 pd + kildesøk | Kildemateriale og I-02 |

R-01 er den eneste her beskrevne **bekreftede statusfeilen på en eksisterende rad**. R-02/R-03 er gjenskapt i isolerte minnedata; de skal ikke omtales som påviste feil i hele Morothon-historikken. R-06 er et behov for kildeavklaring, ikke godkjenning til å endre resultatene.

## Felles beregningskontrakt

Foreslå rene innganger: `canonicalIdentity`, `participationSummary(policy, asOfEdition)`, `placements(rule)`, `courseRecords(courseVersion)`, `milestones(asOfEdition)`, `loyalty(policy)`, `serviceSummary(evidence)` og `diplomaSnapshot(achievementId)`. Datakilden er uforanderlig per revisjon. Visningskode skal ikke mutere personobjekter for å etablere sannhet.

Bevar fem separate nivåer:

1. **Registrert resultat:** kilde, råverdier, status og eventuell godkjent korreksjon.
2. **Beregnet prestasjon:** eksempelvis fullføringer eller rekord innen bestemt løypeversjon og beregningsversjon.
3. **Kvalifisert utmerkelse:** terskel nådd med eksplisitt grunnlag, også mulig foreløpig grunnlag.
4. **Formelt tildelt utmerkelse:** eget vedtak, myndighet, dato og revisjon.
5. **Utstedt/publisert diplom:** et bestemt dokument, med mal-/grafikk-/dataversjon og utstedelsesstatus.

Et nytt løp kan endre dagens totalsum og gjeldende rekord. Det skal ikke flytte opptjeningsåret for femte deltakelse eller stille omskrive et utstedt dokument. En dokumentert historisk korreksjon kan derimot kreve ny vurdering: gammelt grunnlag beholdes i kontrollert historikk, og ny versjon må godkjennes. Dette er forskjellig fra å fryse feil for alltid.

## Testmatrise videre

Behold dagens Morothon-kontroller som referansesett. Legg til små generiske matriser for DNS/DNF/DQ/untimed, ID-sykluser, like tider, flere starter samme edition, flere editions samme år, avlyst runde, stafettlag/etappe, løypeversjon, endret kildeplass og manuell korreksjon. Test egenskaper: rekkefølge i importfil påvirker ikke totalsum, omimport er idempotent, ingen utmerkelse utstedes automatisk, og en 2027-import endrer ikke en korrekt 2024-milepæl. Alle dokumentoverflater skal bruke samme snapshot som profilens beregninger.
