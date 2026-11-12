# 05 – Drift, sikkerhet, personvern, CI og selvdrift

Grunnlag: main `53f8f50`, lokal produksjonsbygging, gjennomført testpakke, nettleserprober og de fem aktive PR-kontrollgalleriene. Ingen publisering eller endring av produksjonsdata er utført. Sluttbygget etter dokumentasjonsarbeidet har samme manifest og innholdshash `a58062f7c89c96df` som før revisjonen, og inneholder ingen revisjonsdokumenter. Juridiske vurderinger er skilt fra tekniske observasjoner i [06](06-produkt-og-salg.md).

## Funn

| ID / type / alvorlighet | Fil/modul og faktisk observasjon | Anbefalt løsning og effekt | Gjennomføringsrisiko | Omfang | Avhengigheter |
| --- | --- | --- | --- | --- | --- |
| S-01 · **bekreftet offentlig dataeksponering** · høy | [`build-site.cjs:9`](../../scripts/build-site.cjs#L9) kopierer hele `honors.json` og `volunteers.json`. HTTP-probe mot bygget pakke gav 200 med `revisionHistory`, `personDetails`, `internalNotes` og skjult person-ID. `noindex` og `hiddenProfileIds` beskytter ikke JSON. | Del privat administrativ sannhet fra en eksplisitt offentlig projeksjon. Avklar felter/personer før endring; ny publiseringsvalidator avviser private felter. | Høy: feil filtrering kan miste legitim offentlig historikk eller republisere skjulte data ved rollback | 3–6 pd for første eksportgrense, pluss eier-/personvernavklaring | Publiseringspolicy; I-01; juridisk avklaring ved behov |
| S-02 · **syntetisk gjenskapt inputrisiko** · høy ved åpnet import | `index.html:878` og andre HTML-strenger bruker person-ID direkte i inline-`onclick`. En isolert, manipulert JSON-ID ble akseptert; klikk utførte en ufarlig lokal kontrollmarkør. Navneescaping alene dekker ikke denne konteksten. | Valider ID-er/referanser ved import og publisering; bruk hendelsesbinding med datafelter fremfor inline-JS. Strammere CSP blir mulig etterpå. | Middels: ikke bytt ID-er i eksisterende data. Det finnes **ingen påvist offentlig skrivekanal** til dagens JSON. | 2–4 pd | I-01/R-03; kontrakttester med ugyldig input |
| S-03 · produktgrense · høy dersom kontrollert utstedelse loves | `diplomas.js:250–270/277` kontrollerer innholdshash og kvalitet i nettleseren. Dette er nyttige kontrollporter, men gir ikke serverautorisering eller bevis på utsteder. Ingen innlogging/adminserver finnes. | Behold offentlig dokumentforhåndsvisning. Hvis kunden trenger formell utstedelse/publisering med roller, bruk en liten autentisert administrativ tjeneste med revisjonslogg og eventuelt signert dokumentmanifest. | Høy: frontend-godkjenning må ikke markedsføres som sikker tilgangskontroll | 5–10 pd for første sikrede kontrollplan, ikke full SaaS | I-04; valgt drifts-/rollemodell |
| S-04 · målt vedlikeholdskostnad · middels | [Aktiv workflow](../../.github/workflows/pages.yml) kjører alle 215 tester og fem historiske renderløp også på dokument-/personendringer. Målt delkjede var ca. 606 s, før installasjon/opplasting. | Fire testnivåer og målrettede nåværende visuelle referanser. Behold kritiske identitets-, data-, hash- og layoutkontroller der de gjelder. | Middels: dårlig impact-regel kan gi falskt grønt | 4–8 pd | Modulkart; generiske fixturer; tydelig full-regresjonsknapp |
| S-05 · styrke med ekstern avklaring · middels | Workflow tester PR/main, publiserer bare verifisert main og bruker samme byggeartefakt. `pull_request_target` og deling av deploy-hemmeligheter med PR-er er ikke observert. Repo-/miljøbeskyttelse kan ikke utledes av YAML. | Behold deploy-skillet. Kontroller branch protection, miljøgodkjenning, kontotilganger og gjenoppretting hos eier. Vurder SHA-pinning av Actions og oppdateringsrutine. | Lav–middels: endret trigger kan gi dobbeltkjøring eller utilsiktet deploy | 1–3 pd | Repository-/driftseier; eksterne innstillinger |
| S-06 · leveransegap · middels/høy for selvdrift | README dekker utvikling/test/bygg; en kunde må fortsatt kunne redigere filer, ha full Git-historikk for flere tester og håndtere komplett testverktøykjede. Ingen ferdig administrativ installasjon/overleveringspakke. | Versjonert installasjons-, backup-, oppgraderings- og overleveringspakke uten personlige kontoer. | Middels: «kildekode levert» er ikke en fungerende selvdriftsleveranse | 5–10 pd etter stabil modell/admin | I-04, P-01, migrering og lisensoversikt |
| S-07 · drifts-/personvernrisiko · middels | Git og tidligere artefakter gir historikk, men det er ingen dokumentert komplett gjenopprettingstest eller privat/offentlig slettingsflyt. | Avtal bevaring, offentlig fjerning, private kilder, backup og rollback. Test gjenoppretting i isolert miljø. | Høy ved personopplysninger og delvis rollback | 2–5 pd for prosedyre/test | Databehandler-/eierbeslutninger; S-01 |

S-01 betyr at dataene er tilgjengelige i **den genererte offentlige pakken**. Tilgangsregler på en eventuell annen ekstern vert er ikke testet. Dagens GitHub Pages-arkitektur har ingen applikasjonsautentisering. Rapporten kopierer ikke interne fritekstnotater til nye vedlegg.

S-02 er en test med konstruert input i en lokal testkontekst, ikke en påstand om at uvedkommende kan redigere dagens resultatfil. Den er vesentlig før et produkt begynner å ta imot mindre betrodde importfiler. Kontrollmarkøren gjorde ingen nettverkskall og endret ingen fil.

## Offentlig og privat datagrense

Det private lageret kan inneholde originaleksporter, kildevurderinger, identitetsforslag, interne notater, dokumentasjon på godkjenning, følsomme vedlegg og utstedelsesjournal. Den offentlige eksporten tillater bare besluttede felter, eksempelvis publisert navn, nødvendige resultat-/klasseopplysninger, publiserte historier og vedtatt synlig heder.

Eksport skal være en whitelist, ikke «kopier alt og skjul noen felter». En deaktivert Heder-modul skal ikke sende med hedersregisteret. Skjulte profiler, intern revisjon og foreslåtte koblinger må ikke følge med bare fordi UI ignorerer dem. Dette er et forslag til en **egen godkjent endring**, ikke utført opprydding i denne revisjonen.

En ny offentlig projeksjon gjør ikke tidligere publiserte Git-commits, kopier, CI-artefakter eller søkemotorcacher private. Disse må kartlegges ved behov. Ikke skriv om historikken eller slett kilder uten en separat beslutning. Barn/juniorklasser, bilder, minneomtaler og navn som ønskes fjernet må vurderes særskilt; teknisk skjuling er ikke det samme som rettslig sletting.

Å fjerne navnet er heller ikke nødvendigvis anonymisering når ID, klubb, klasse og tid kan identifisere personen igjen. Skill mellom UI-skjuling, pseudonymisering, offentlig fjerning og eventuell lovlig privat bevaring. Planlegg behandling av henvendelser, cache/eldre releases og backup som én prosess med arrangøren, ikke som et enkelt `hidden`-flagg.

## Målinger og avgrensning

Målt 12. november 2026 fra `53f8f50`, med Node 24.22.1, npm 11.9.0, Python 3.12.14 og Chromium 156.0.8078.79 på Linux. Vertsinstansen viste fem CPU-er, cgroup-kvote på fire kjerner og minnegrense 32 GiB. Avhengigheter var allerede installert. Nettleserprober ble kjørt etter testpakken; renderløpene ble kjørt sekvensielt etter nettleserbenchmarken.

Vegg- og CPU-tid ble tatt med Python `time`/`resource` rundt de faktiske kommandoene. Rapportert maksimal underprosess-RSS er **ikke samlet fysisk minnebruk** for alle samtidige Chrome-prosesser. JS-heap i nettlesertabellen er V8-heap etter GC, ikke total nettleser-RSS. Ingen av tallene er faktiske GitHub-hostede runner- eller faktureringsmålinger.

| Kommando / aktivt PR-steg | Lokal veggtid | Utfall / leveranse |
| --- | ---: | --- |
| `npm test` | 410,14 s | 215/215 bestått, 0 feil/avbrutte/hoppede; CPU ca. 349,64 s bruker + 109,64 s system; maks rapportert underprosess-RSS 418 400 KiB |
| `npm run build -- <tom mappe>` | 0,76 s | 58 filer, versjon `a58062f7c89c96df`; samme runtime som main |
| `review-honors-v36.cjs` (inkl. V3.5.2-basiskontroll) | 68,65 s | 40 PDF-er: 34 gjeldende varianter og 6 merkede tekstforslag |
| `review-honors-v361.cjs` | 62,21 s | 28 PDF-er med før/etter-layout |
| `review-honors-final-v361.cjs` | 22,76 s | 6 PDF-er og 12 profilvisninger |
| `review-honor-signoff-v353.cjs` | 26,76 s | 12 PDF-filer i utmappen, med før/etter-varianter |
| `review-service-milestones-v362.cjs` | 14,53 s | 8 PDF-er |

De fem siste stegene gir **194,92 s ekstra og 94 PDF-filer** samt 253 PNG-filer, omtrent 193 MiB genererte kontrollfiler før artefaktkomprimering, i tillegg til PDF-/bildearbeidet som allerede er inne i testene. Test + bygg + disse stegene var ca. **605,82 s**, omtrent 10 min 6 s. Installasjon, font-/nettlesernedlasting, arkivforberedelse, artefaktopplasting og eventuell deploy er ikke med; dette er ikke et løfte om CI-tid. Alle fem steg bestod lokalt. GitHub Actions-status er ikke verifisert via API i dette nettverksmiljøet.

En av de tyngste enkelttestene, V3.6.1-profil-/A4-sammenligningen, brukte 84,57 s. Testen for alle løperdiplomnivåer brukte 48,96 s; en annen mobil-/PC-diplomvarianttest brukte 41,78 s. Enkelttesttidene overlapper i runneren og skal ikke summeres som total veggtid. Det er 42 testfiler på toppnivå; flere tester inneholder mange bredder, personer og PDF-er.

### Nettleserytelse

Lokal statisk server uten komprimering. «Bilder klare» måles fra navigasjon til innlasting, applikasjonsvisning, fontklar og dekoding av alle daværende `<img>`. Dette er en konservativ **full bildeberedskap**, ikke LCP eller felttid. Ny nettleserkontekst per prøve, varm vertsinstans. Oppgitt median for n > 1; ingen p95 kan estimeres pålitelig her.

| Scenario | Prøver | Bilder klare | Fuzzy navnesøk / søk uten treff | V8-heap etter GC | Resultatrader |
| --- | ---: | ---: | ---: | ---: | ---: |
| PC 1440 px | 3 | 703 ms | 10,0 / 10,4 ms | ca. 4,6 MiB | 6 914 |
| Mobilvisning 390 px, uten struping | 3 | 642 ms | 10,3 / 12,2 ms | ca. 4,6 MiB | 6 914 |
| Nettbrett 768 px | 1 | 686 ms | 8,6 / 11,0 ms | ca. 4,6 MiB | 6 914 |
| 390 px, 4× CPU, 80 ms nettverksforsinkelse, 1,6 Mbit/s ned | 2 | 20,62 s | 57,7 / 44,4 ms | ca. 4,6 MiB | 6 914 |
| Syntetisk 4× datasett, PC | 1 | 1,43 s | 34,8 / 42,5 ms | ca. 13,2 MiB | 27 656 |
| Syntetisk 16× datasett, PC | 1 | 4,35 s | 129,9 / 172,4 ms | ca. 47,2 MiB | 110 624 |

De syntetiske settene kopierer årsstrukturen med nye person-ID-er og små tidsforskyvninger for å unngå kunstige rekorddelinger. De er volumtester av dagens årsmodell, **ikke bevis på støtte for en karusell** eller prediksjoner av virkelige kundedata. Siden med én åpnet profil hadde omtrent 1 500 DOM-noder og ingen horisontal side-overflyt. Dagens side hentet historikkfilen én gang i disse prøvene. Heder rendret 43 kort, gjorde 55 løperstatistikkoppslag og hentet historikken én gang.

Ved målepunktet i normalprøven utgjorde registrerte ressurskropper ca. 3,44 MB, uten hoveddokumentets kropp i denne summen. Med rask lokal server er lastetiden kort; simulert smal forbindelse gjør særlig bildeberedskapen dyr. Produksjons-CDN, komprimering og ekte mobil-FCP/LCP er ikke kartlagt av disse tallene. Testene gir ikke grunnlag for å si at nettstedets faktiske LCP er 20 sekunder.

Før backend vurderes av ytelsesgrunner: cache normaliserte søkenavn/indekser per revisjon, flytt arbeid fra kritisk rendersti, vurder lazy loading/registrerte webvarianter av bilder og mål ved større datasett. Ved 110k rader passerte søk og milepælberegning en vanlig 50 ms langt-arbeid-grense; det begrunner frontend-arbeid eller worker, ikke automatisk en database.

Foreslåtte framtidige akseptansemål: feltmålt p75 LCP ≤ 2,5 s, INP ≤ 200 ms og CLS ≤ 0,1; søkeoperasjon p95 < 100 ms ved avtalt standarddatasett; ingen utilsiktet sideveis scrolling ved 320/390/768/1280/1440 px. Test også lavytelsesenhet, tastatur, 200 % zoom, VoiceOver/NVDA, Safari/Firefox og tre størrelsesklasser. Dette er **mål**, ikke dokumentert samsvar i dag. Eksisterende fokus-/navne-/Windows-fonttester og A4-kontroller er verdifulle, men er ingen full WCAG- eller Windows/Safari-sertifisering.

## Fire testnivåer

| Nivå | Når | Innhold og kritiske sperrer | Mål etter omlegging, ikke målt garanti |
| --- | --- | --- | --- |
| A – hurtigkontroll | Person, tekst, tema/config, dokumentasjon | Schema/ID/kildereferanser, synlighet, ingen private eksportfelter, relevante oppnåelses-/hashkontrakter, bygg og liten UI-smoke ved UI-data. Dokument-only: lenker og bekreftet uendret runtime. | Under 30–60 s i varm CI |
| B – funksjonell | Import, motor, modell, policy | Små generiske matriser, omimport, rollback, manuelle overstyringer, alle identitets-/status-/periodekontrakter og Morothon-referanseverdier | Under ca. 2 min når browserarbeid er flyttet ut |
| C – visuell | CSS, canvas, maler, assets, font | Berørte bredder og alle relevante layout-/trykkporter; lange navn/datoer; begge medaljevalg. Referanser fra **gjeldende** kode | Eget behovsstyrt løp, ikke fem historiske gallerier hver gang |
| D – full regresjon | Stor utgivelse, migrering, sikkerhetskritisk fellesendring; periodisk | Alle B/C-kontrakter, alle representative maltyper, bakoverkompatibilitet og gjenoppretting. Bevar en tilgjengelig manuell fullkjøring. | Måles etter første omlegging |

Ikke velg nivå bare ut fra filendelsen: en JSON-endring i status eller godkjenning kan være datakritisk. Delt motor, importmapping eller publiseringsschema skal kunne tvinge B/D. Nye/ukjente endringsflater faller tilbake til full kontroll. Papir-/PDF-sikkerhet skal ikke erstattes av at en gammel filhash fortsatt ser riktig ut.

En persontekst som brukes på et diplom kan for eksempel utløse C selv om endringen bare ligger i JSON. Endringer i `printReady`, godkjenning, private/public-felter eller identitetskoblinger må alltid få relevante kritiske kontroller. Et dokumentasjonsfilter må ikke kunne maskere slike endringer.

Mulig forenkling: skill rene motortester fra nettlesere; behold få nåværende visuelle referanser per mal/bredde; arkiver eldre før/etter-rapporter som historikk, ikke obligatoriske nye renderinger. Gjenbruk en kontrollert browser-fixture der isolasjon kan dokumenteres. Cache npm, pip og nettleser med låste versjoner/OS-nøkler. Ikke cache testresultat som «bestått» over nye data/policy, og ikke gjenbruk et godkjent PDF-grunnlag etter innholdsendring. Parallelliser uavhengige jobber med begrenset minnebruk etter måling, ikke med ubegrenset Chrome-forking.

## Administrasjon, backup og selvdrift

Den offentlige nettsiden kan fortsatt driftes på valgfri HTTPS-statisk vert. Et lokalt enkeltbrukerverktøy kan ha redigering/import i nettleser med en loopback-tjeneste og eksport av en releasepakke. Dette krever ikke en offentlig administrasjonsserver. Hvis flere redaktører skal samarbeide og publisere over nett, trengs reell autentisering, serverkontroll av arrangørtilgang, konfliktsjekk og privat lagring. Det er et **funksjonskrav**, ikke en datamengdeantakelse.

Start med administrator, redaktør og publiserer/leser bare der behovet finnes. Redigering lager et utkast; publisering er en separat handling mot en låst revisjon. Ingen deploynøkler i frontend. Driftet og selvdriftet variant bruker samme motor, schemas og releaseformat. En lokal enkel variant kan gi én eierrolle fremfor et stort IAM-system.

### Daglige oppgaver uten programmering

| Oppgave i administrasjonen | Kontroll og lagring |
| --- | --- |
| Importere resultater og rette en kildeopplysning | Staging/diff og kildebundet korreksjon; ingen direkte overskriving av offentlig JSON |
| Endre arrangementsdato eller legge til konkurranse | Katalogskjema med datoens presisjon, status og stabile ID-er; vis hvilke prestasjoner/diplomer som påvirkes |
| Godkjenne personkobling | Kandidater og kilder side om side; bekreftet lenke logges separat fra navneforslaget |
| Logo, farger, sponsor, standardtekst og merke | Validerte felt/assetregister, rettighetsfelt og forhåndsvisning; dokument-/trykkgodkjenning fornyes ved relevant endring |
| Heder, roller, historier og minneomtaler | Egne skjemaer med separat privat kilde og offentlig tekst; ingen utmerkelse tildeles automatisk |
| Forhåndsvise, publisere eller angre | Eget publiseringssteg mot forventet revisjon, låste releasepakker og gjenoppretting som respekterer skjuling/personvern |

Dette er ønsket administrativt omfang, ikke funksjoner som allerede finnes. Felles import/admin ligger i D2 i 07; C1/C2 prøver avgrensede arrangørverktøy på dette grunnlaget. I en flerbrukervariant kan administrator styre tilganger, redaktør lage forslag, publiserer godkjenne release og en valgfri intern leser se kontrollgrunnlag. Offentlig lesetilgang gir ingen slik privat leserrettighet.

Komplett overlevering må inkludere kildekode og versjon, avhengighets-/lisensoversikt, installasjonsoppskrift, test- og backupkommandoer, eksempelkonfigurasjon uten hemmeligheter, importadaptere/mappinger, migreringer, administratoroppretting, offentlig og privat dataeksport, assets/fonter, godkjennings-/utstedelseshistorikk og driftsrunbook. En statisk `_site` alene er ikke nok til å oppdatere eller gjenopprette hele løsningen.

Referansetester bør leveres med godkjente, versjonerte fixturer, slik at kunden ikke må hente bestemte gamle Morothon-commits for å teste sin egen installasjon. Privat transport/lagring og backup må sikres med nødvendige tilganger, HTTPS og passende kryptering; nøkler og gjenopprettingsansvar må kunne overtas av kundens IT-leverandør.

Backup bør følge en avtalt RPO/RTO, eksempelvis daglig privat backup og dokumentert gjenoppretting innen én arbeidsdag for en liten arrangør; dette er et forslag, ikke dagens SLA. Ta også kopi før import/release. Test restore til et isolert miljø, med samme pinned verktøykjede og innholdsmanifest. Git er nyttig versjonshistorikk, men erstatter ikke private kilder, driftshemmeligheter og testet restore. Ved flytting skal kunden kunne bytte domene, lagring og kontoer uten personlige Codex-/ChatGPT-/leverandørnøkler.

### Nye arrangørverktøy – samme sikkerhetsgrense

Startlister, identitetsforslag, interne premie-/pakkelister og PDF-jobber lagres privat med arrangør- og jobbavgrensning. Importfiler minimeres og har avtalt bevaring; eventuelle fødselsdatoer/kontaktdata som finnes i en leverandøreksport skal ikke automatisk følge med prognose, offentlig profil eller PDF. Offentlig resultatpublisering er en separat kontrollert eksport. Tilgangen må kontrolleres også ved jobbstatus, gjenoppta, PDF-/ZIP-nedlasting og gamle lenker, ikke bare ved åpning av administrasjonssiden.

En lokal pilot kan bruke én operatør under OS-kontoen og en loopback-tjeneste med privat sesjon, kontrollert origin/CSRF og avgrenset filtilgang. Ikke bind en testserver med rå prosjektfiler til et offentlig grensesnitt. Driftet flerbrukerutgave trenger autentisering og serverkontroll av arrangør/rolle på hver operasjon. Samme kontrakter og kontrollporter gjelder i begge leveranseformer; frontend-flagg, `noindex` og hemmelig URL er utilstrekkelig.

Filopplasting trenger størrelses-/formatgrenser og trygg parsing; CSV/XLSX-eksport må håndtere formelinjisering, og ZIP-filnavn må være unike og uten stitraversering. Rendering bruker kontrollerte maler, lokale/registrerte assets og fonter fremfor kundelevert JavaScript eller vilkårlige nettressurser. Låste avhengigheter og lisensoversikt omfatter også eventuell PDF-sammenslåing og regnearkeksport. Nye biblioteker er ikke valgt eller installert i denne revisjonen.

Prognosen har ingen skriveadgang til resultat- eller tildelingsregisteret. Endelig premieliste krever godkjent faktisk resultatgrunnlag; overføring til diplomjobb gir ingen utstedelsesrett. Hver side må bestå gjeldende innholds-, bilde-, font- og layoutporter. Reell feil på én side skal ikke skjules av at resten ser riktige ut. Separate merkede kontrollsett kan ikke blandes inn i en ren produksjonsfil uten at operatøren ser statusen.

Jobbens snapshot og godkjenninger må sjekkes før produksjonsnedlasting, også etter endret historikk, tilbakekalling eller offentlig fjerning. Logg generering og operatørens bekreftelse av utskrift separat; nettleserhendelsen `afterprint` beviser ikke utskrevet papir eller utdeling. Fastsett oppbevaring/tilgang for ferdige PDF-er og gamle startlister, med kontrollert sletting og backup. Dette utvider S-01/S-03/S-07; det er ikke et ekstra uavhengig sikkerhetsbudsjett.

Nye funksjoner er ikke implementert eller ytelsestestet. Tidligere 215 tester, nettleser-/A4-målinger og 94 PDF-er ovenfor gjelder eksisterende main, ikke en fremtidig masseutskrifts- eller startlistemodul. Dokumentasjonstilleggets nye kontroller og avvik er beskrevet i [02](02-beregninger.md#dokumentasjon-mot-siste-main--tillegg-13-november-2026).

Sluttkontroll av tillegget: nytt `npm run build -- <tom kontrollmappe>` bestod med **58 filer og `a58062f7c89c96df`**; alle byggefiler er sammenlignet byte for byte med det opprinnelige sluttbygget. Alle sporede filer utenfor `docs/revisjon/` er identiske med hentet `origin/main`. Lokale dokumentlenker/overskriftsankre, JSON-eksempler, kodeblokker og `git diff --check` er kontrollert uten feil. Ingen nye godkjenninger, publisering eller implementerte arrangørfunksjoner inngår.

## Målevedlegg og reproduksjon

[Maskinlesbare måledata](vedlegg/maalinger.json) inneholder rå prøver, kommandotider, ressursmål, utfall, artefaktstørrelser og avgrensede regelprober, uten interne fritekstnotater. [Nettleserproben](vedlegg/maal-nettleser.cjs) ligger under dokumentasjonen og er ikke del av produksjonspakken. Den bruker bevisst ugyldige data **bare i isolert nettleserminne** for å etterprøve R-02/R-03/S-02. Ikke bruk disse fixture-resultatene som importgrunnlag.

Etter verktøyinstallasjonen i README, bruk en ny kontrollmappe utenfor repositoryet:

```sh
npm test
node scripts/build-site.cjs /tmp/morothon-audit/site
node docs/revisjon/vedlegg/maal-nettleser.cjs /tmp/morothon-audit
```

Kommandoene for de fem galleriene finnes uendret i `.github/workflows/pages.yml`; V3.5.3-steget bygger også en arkivert før-versjon. Tidsmålingen brukte en Python-wrapper med `time.time()` rundt `subprocess.call(...)` og `resource.getrusage(resource.RUSAGE_CHILDREN)` før/etter. For hver kommando ble stdout/stderr lagret, exitkode kontrollert og utmappens PDF/PNG-filer telt. Ikke kjør benchmark samtidig med tunge renderløp dersom tidene skal sammenlignes. Ny måling kan gi andre tall; miljø, versjon, nettverksprofil og måledefinisjon skal følge resultatet.
