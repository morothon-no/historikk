# B1 – testløp, sikkerhet og målinger

Grunnlag: `main` etter A2 / PR #31 (`1c84b4e`). Ingen endringer i nettsidens kode, design, data, medaljer eller diplomgrunnlag. Backup og migrering er ikke utført.

## Faktisk Actions-baseline

Hentet fra offentlige Actions-sider og stegenes `data-started-at` / `data-completed-at`, uten API-token, jobblogger eller private artefakter. [Maskinlesbare målinger](maalinger/b1-actions-before.json) inneholder tidspunkt og resultat per steg.

| Kjøring | Type | Total tid rapportert av GitHub | Viktigste observasjoner |
| --- | --- | ---: | --- |
| [43494802674](https://github.com/morothon-no/historikk/actions/runs/43494802674) | Vellykket PR #31, omkjøring | **2 min 23 sek** | Offentlig teststeg 49 s, Chromium-installasjon 36 s, separat offentlig rapport 15 s |
| [43496896543](https://github.com/morothon-no/historikk/actions/runs/43496896543) | Vellykket main etter A2 | **10 min 32 sek** | Offentlige tester 30 s; full kilde-/offentlig regresjon 331 s; fem historiske rapporter 133 s |
| [43445653717](https://github.com/morothon-no/historikk/actions/runs/43445653717) | Vellykket main etter A1D | **10 min 21 sek** | Full regresjon 349 s; fem historiske rapporter 128 s |

I A2-main-kjøringen spente kildejobbens steg over 501 s. De historiske rapportene brukte henholdsvis **49, 43, 15, 16 og 10 s**. Offentlig jobb installerte Chromium på 31 s og PDF-verktøy/fonter på 17 s. Tidene er avrundet til GitHubs sekundoppløsning. Stegtider skal ikke summeres som fakturering eller forveksles med total kø-/jobbtid.

Dobbeltarbeid før B1: main kjørte offentlige tester i både offentlig jobb og `npm test` i kildejobben. Den isolerte byggetesten startet dessuten hele `site-build`-testen inni en annen test. PR-en rendret et separat offentlig galleri etter browserkontrollene; main genererte fem gamle sammenligningsgallerier på hver kjøring. Python/Pillow og full Git-historikk ble hentet til alle main-kontroller, også dokumentasjonsendringer.

## Fire nivåer, lokalt og i CI

| Nivå / kommando | Innhold | Verktøy |
| --- | --- | --- |
| `npm run test:quick` | SHA-/fil-/skjemakontroller, offentlig datagrense, A2-status/tider/ID-er, rene lojalitetsregler, beskyttet testplan og feilsituasjoner | Node; ingen npm-installasjon, Chromium, Poppler eller Python |
| `npm run test:functional` | Hurtig + beregninger, stafettisolasjon, rekorder, milepæler, Enny-Karin, sammenligning, ranking og tidsutvikling | Node, Playwright og Chromium; ingen PDF-verktøy/Python |
| `npm run test:visual` | Funksjonell + mobilgraf, skrytekort, PNG-eksport, nivåhierarki, profiler, offentlig isolert bygg og gjeldende A4/PDF-kontroll | I tillegg Poppler; åtte faktiske heders-PDF-er i begge medaljevarianter |
| `npm run test:full` | Alle eksisterende og nye tester én gang, originaleksport og løperkoblingskontroll | Full kildecheckout/Git-historikk, Chromium, Poppler, Python/Pillow |

`npm test` er fortsatt den ordinære hele testpakken. `test:full` legger også originaleksportkontrollen foran testene. `npm run test:public` er full **offentlig** kontroll uten administrative originalregistre; det er ikke det samme som full kildekontroll.

Nivåene er kumulative. `scripts/testing/catalog.cjs` er den eksplisitte offentlige testlisten. Full kildekontroll oppdager alle øvrige toppnivå-`.cjs`-tester, også nye. En regresjonstest kontrollerer at offentlig og kildebasert fullkontroll til sammen dekker alle testfiler nøyaktig én gang. Manglende obligatorisk testfil stopper kjøringen. Det lokale oppsettet er verifisert på Linux med Node 24, Git og vanlig POSIX-shell; uavhengighet av GitHub betyr ikke at bare-test-PDF-verktøyene er innebygget i Node.

Originalenes samsvar med offentlig eksport kontrolleres **alltid på main**, også når valgt nivå er hurtig. Kjør dette lokalt med `npm run data:check-sources`, eller `node scripts/testing/run.cjs --scope source --level quick`. Offentlig hurtigkontroll kan kjøres fra en isolert utsjekking uten originaler og uten `node_modules`; dette er testet. Ingen GitHub-tjeneste kreves for de lokale testkommandoene.

## Hva utløser hva?

| Endringstype | Offentlig kontroll | Tillegg på betrodd main |
| --- | --- | --- |
| Bare `README.md` / `.md` og `.json` under `docs/` | Hurtig | Originaleksport + løperkoblingskontroll |
| `js/compare.js`, `js/rankings.js`, `js/progress.js` | Funksjonell | Samme kildekontroll |
| Kort-/Heder-/navigasjonsvisning: `js/brag-card.js`, `js/honors.js`, `js/navigation.js` og deres tre CSS-filer | Visuell/PDF | Kildebaserte tester av medaljesamlinger, skjult profil og kvalitet/tastatur (`honor-card-collections`, `honors-visibility`, `quality-v32`) |
| Historikk, person-/dugnadsregistre, offentlig datapakke, merker/assets/fonter, diplomkode/CSS, felles status/lojalitet/milepæler, `index.html`, `heder.html`, eksport/sikkerhet, pakker, test-/workflow-konfigurasjon | Full offentlig | Alle resterende kildetester |
| Ukjent filtype/sti, ufullstendig endringsgrunnlag, tom differanse eller manuell fullkontroll | Full offentlig | Full kildekontroll |

En dokumentasjonsfil kan aldri senke nivået som en annen endret fil krever. Renaming behandles som sletting og tillegg, slik at kode flyttet inn under `docs/` ikke skjuler den gamle kodestien. Ukjent område gir full kontroll. Manglende PR-differanse krever dessuten ekstern head-godkjenning; det gir ikke lov til å hoppe over testbeskyttelsen.

## Bevaring og mindre dobbeltarbeid

Alle **254 opprinnelige navngitte tester** er beholdt, uten sletting eller `skip`. Nettleseroppsett er skilt fra rene tester i `data-quality`, `public-build` og `loyalty-v32`. Graf-/korteksport er flyttet fra `regression` til visuelle testfiler. De samme testtilfellene og kontrollene brukes videre. Åtte nye tester dekker planvalg/sikkerhet, berørte beregningsmoduler og faktiske gjeldende A4/PDF-er.

Full CI deler testene mellom offentlig jobb og betrodd kildejobb, slik at de offentlige tilfellene ikke kjøres om igjen i kildejobben. De 218 resterende kildebaserte testene beholdes i fullkontrollen. Den tidligere nestede `site-build`-kjøringen er fjernet; selve testen beholdes som selvstendig obligatorisk visuell test.

Den offentlige PDF-testen lager også kontrollgalleriet. Samme galleri lastes opp fra PR-jobben; det rendres ikke en gang til. Det inneholder bare godkjente offentlige data. Ingen kildebaserte personrapporter lastes opp. Planartefakten inneholder bare endrede filstier, nivå og verktøyvalg.

De fem gamle rapportskriptene er bevart uendret og kan kjøres lokalt som før. I Actions velges de eksplisitt gjennom **Run workflow → historical_reports** på main. Dette tvinger full kontroll, men en vanlig full regresjon på grunn av usikre kodeendringer trenger ikke gjenskape alle historiske gallerier. `full_control` tvinger full testpakke. En manuell kjøring uten et sikkert før-SHA faller også tilbake til full kontroll. Ingen periodisk workflow er innført.

## Cache, parallellitet og publiseringsporter

- npm-cache brukes bare i jobber som trenger Playwright. Chromium-nedlastingen caches med OS/Ubuntu-versjon og låsefilhash; systemavhengigheter og nødvendige fonter kontrolleres fortsatt. Cachetreff erstatter aldri tester eller godkjenning.
- Python/Pillow installeres bare i full kildejobb, med pip-cache etter `requirements-dev.txt`. Poppler installeres bare når jobbens tester faktisk inspiserer PDF-er.
- Etter beskyttet planlegging kan offentlig jobb og main-kildekontroll kjøre parallelt. Før tok kildejobben til først etter offentlig bygg og uavhengig artefaktkontroll. Ingen mer aggressiv Chrome-parallellisering er innført uten målegrunnlag.
- `artifact_gate` er fortsatt en fersk runner som henter kandidatpakken og kontrollerer den med kode og godkjenning fra beskyttet base. Den kjører ingen PR-tester og installerer ingen testavhengigheter.
- Deploy krever fortsatt både `artifact_gate` og `source_checks`. Ingen `continue-on-error`, `always()`-deploy, `paths-ignore` eller PR-deploy er innført. Required-check-navnene er beholdt. Datamanifest og publiseringsvalg er uendret.

Den eksisterende påkrevde offentlige testjobben bruker `always()` **bare til å kontrollere at planjobben lyktes før noe PR-kode kjøres**. Feilet, avbrutt eller hoppet over plan gir feil i denne sjekken, slik at en ny planjobb ikke kan gjøre de gamle required checks «grønne» bare ved at de blir hoppet over. Deploy bruker ikke `always()`. Denne kontrollen er testet med alle fire resultattilstandene.

## Nøyaktig godkjenning ved innføring

B1 endrer `.github/workflows/pages.yml`, `package.json`, offentlig sikkerhetskontroll og testplan/-kjører. Før første B1-PR-kjøring må repository-eier gjennomgå den endelige commit-en og sette **`MOROTHON_REVIEWED_POLICY_HEAD` til dens fulle 40-tegns SHA**. Variabelen er den eksisterende A1C-porten; den settes ikke av Codex. `MOROTHON_PUBLIC_DATA_SHA256` og datapakkens godkjenning skal beholdes uendret.

Etter innføring beregnes nivå med planlegger fra beskyttet base før PR-kode kjøres. Den samme basen leverer testkjøreren. Manglende planlegger ved første innføring tillates bare etter den eksakte eksterne head-godkjenningen. Endringer i tester/plan/harness krever også head-godkjenning og full kontroll; de kan ikke velge et lettere nivå for seg selv. Offentlige jobber får fortsatt ingen administrative originalregistre, private repositories, tokens eller nøkler.

## Før/etter – hva som faktisk er målt

GitHub-baselinen ovenfor er målt på ekte nylige kjøringer. **Etter-tid i GitHub Actions kan ikke bekreftes før B1-PR-en er opprettet og den beskyttede headen er godkjent.** GitHub-API-et er blokkert i dette arbeidsmiljøet. Lokale tider skal ikke presenteres som nye Actions-resultater.

Lokalt er offentlig hurtigkontroll målt til omtrent **3,6 s**, funksjonell kontroll til **34,8 s**, visuell/PDF til **70,9 s** og main-kildekontroll uten ekstra tester til **1,2 s**, med installerte avhengigheter på Linux/Node 24.22.1. Det er separate enkeltmålinger, ikke p95 eller kalde CI-kjøringer. Sammenlignet med den faktiske gamle main-flyten fjernes de 133 s historiske rapportene fra ordinære kjøringer; i tillegg fjernes overlappende tester og den serielle ventingen før kildejobben. Kø, checkout, cachetreff og hosted-runner-ytelse må måles etter PR-kjøring.

En ny måling kan hentes uten API-token:

```sh
python scripts/testing/measure-actions.py /tmp/b1-actions-after.json PR_RUN_ID MAIN_RUN_ID
```

Hovedbegrensning: main-etter-måling kan først gjøres etter en godkjent merge, som ikke er utført i B1. Full regresjon er fortsatt kostbar med hensikt ved data-, sikkerhets- og ukjente endringer. Publiserings- og testgodkjenninger må ikke settes automatisk for å få en rask grønn kjøring.

## Endelig sluttkontroll

| Kontroll | Resultat |
| --- | --- |
| Full lokal regresjon | **262/262 bestått**, 0 feil, 0 hoppede; alle 254 opprinnelige tester beholdt |
| Hurtig / funksjonell / visuell | **23/23**, **31/31**, **44/44** bestått i de respektive kjøringene |
| Offentlig isolasjon | Bygg og hurtigkontroll fungerer uten administrative originaler, Git-historikk eller `node_modules` |
| Gjeldende PDF-er | Åtte A4-PDF-er, én liggende side hver, innebygde fonter, korrekt dato og utkastmerking der påkrevd |
| Originaleksport | Samsvarer med uendret godkjent offentlig pakke |
| Produksjonsbygg og offentlig sluttkontroll | 59 runtime-filer, dataversjon 1, 43 synlige Heder-profiler |
| Historikk/design | Ingen endringer i `data/`, `public-data/`, `js/`, `css/`, assets, `index.html` eller `heder.html` |

[Lokale maskinlesbare etter-målinger](maalinger/b1-local-after.json) er tilgjengelige separat fra Actions-baselinen. Den rene fullkjøringen brukte 487.6 s inkludert kilde-/koblingskontroll. Fullkontroll er med hensikt fortsatt kostbar; besparelsen i ordinær CI kommer fra riktig nivå, færre dobbeltkjøringer, behovsstyrte installasjoner og flytting av gamle rapporter til eksplisitt kontroll. Ny Actions-tid skal fylles inn etter eiergodkjent PR-kjøring, ikke utledes fra disse lokale sekundene.
