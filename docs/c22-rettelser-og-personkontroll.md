# C2.2 – Rettelser og personkontroll

> Gjeldende arbeidsliste og beslutningsregler er beskrevet i
> [C2.2b – Forenklet personkontroll](c22b-enkel-personkontroll.md).

Utgangspunkt: `main` etter PR #40 (`cf9a05d`). Modulen finnes under
**Rettelser og personkontroll** i administrasjonsportalen, på `admin/#rettelser`.
Den fungerer med godkjent offentlig datapakke både på Pages og i den lokale
C1-portalen. Ingen autentisering, skrivetjeneste eller produksjonsretting er
innført. Alle produksjonsdata skal være uendrede i denne leveransen.

## Hva arrangøren kan gjøre

### Oversikt og mulige feil

Oversikten viser lokale saker etter status. **Mulige feil** viser forklarte
kontrollsignaler med tre nivåer: sterke signaler, moderate signaler og svake
muligheter. Ingen prosentvis «sikkerhet» eller automatisk sammenslåing.

Analysen finner blant annet identiske navn på ulike profiler, små navnevarianter,
initialer, ekstra eller manglende navneledd, navn/alias på flere
kanoniske profiler, like resultatregistreringer, klasse-/kjønnskonflikter og
historiske datakvalitetsforbehold. Godkjente redirects og aliaser respekteres.
Navn alene er aldri identitetsbevis. Ikke alle avvik er feil; en historisk
kildeplassering kan for eksempel gjelde en annen gruppe enn dagens beregning.

[C2.2a](c22a-personmatching.md) strammer inn navnesignalene. Samme fornavn og
nærliggende deltakelsesår gir ikke lenger forslag. **Oppdater – vis ubehandlede**
går tilbake til arbeidslisten; saker til oppfølging og ferdig gjennomgåtte saker
bevares i egne utvalg og under **Behandle saker**.

Søk og filtrering reduserer utvalget. Forslag vises med sideinndeling. **Ta med
årets startlistekontroller** tar med konflikter fra en tilgjengelig C2.1/C2.1a-
analyse i samme fane. Startlistedata blir ikke historiske resultater.

### Behandle saker

1. Velg **Åpne og sammenlign** ved et forslag, eller **Ny sak**.
2. Søk etter løperen og eventuelt en andreprofil. Kortene viser navn, kanonisk
   ID, aliaser, deltakelsesår, historiske merker og alle resultater med klubb.
3. Velg handling. Ved sammenslåing blir hovedpersonens ID en redirect til
   andreprofilen. Begge personpostene, gamle lenker/navn og alle starter bevares.
4. Ved resultatkorreksjon velges én konkret registrering. Dagens rad og det
   foreslåtte innholdet vises separat. Hovednavn/kjønn og historiske aliaser har
   egne valg. Status, tid, eksakt konkurranse/distanse, klasse, kildeplassering,
   klubb og startnummer kan foreslås rettet. Manglende resultat trenger kilde.
5. Skriv hva som er feil, hvor det kan kontrolleres, og begrunnelsen. **Behold
   saksnotatet i fanen** registrerer også saker som ennå ikke har et forslag.
6. **Foreslå retting** prøver endringen på en kopi og avviser ugyldige verdier.
7. **Beregn konsekvenser** sammenligner før/etter med de eksisterende motorene.
   Årssett, merker, personlige rekorder, Adelskalender, løyperekorder,
   klasseplasseringer, lojalitet, milepæler, redirects og løperdiplomer vises.
   Uendrede områder markeres. Endrede områder kan åpnes for detaljer.
8. **Godkjenn for overlevering** er bare tilgjengelig for et aktuelt, beregnet
   forslag uten kjente uavklarte konsekvenser. Det er en lokal beslutning,
   **ikke en autentisert signatur, ny dataversjon, diplomgodkjenning eller
   publisering**. Produksjonsretting må fortsatt gå gjennom autorisert prosess.

Når aktive forslag eller saksgrunnlaget endres, må tidligere lokale
overleveringsbeslutninger konsekvenskontrolleres på nytt.

Saker kan avvises som forskjellige personer, utsettes for mer dokumentasjon,
eller trekkes tilbake fra kandidatbehandling. Hendelser beholdes i historikken.
Ikke erstatt konkrete kilder med navnelikhet eller en antatt prosentvis sikkerhet.

### Bevisst konservative stopp

- Samme år, konkurranse og distanse på to profiler stopper sammenslåingen.
  Det er ikke bevis på en dobbeltregistrering; flere reelle starter bevares.
  Kjønnskonflikt og endrede førverdier stopper også.
- Et gjenbrukt navn/alias på en annen profil, uavklart juniorklasse/kjønn eller
  konsekvenser for koblet Heder-/diplomgrunnlag krever videre kildekontroll.
- Beregnede plasseringer og kildeplasseringer er forskjellige. Hvis andre
  løperes registrerte kildeplasser ikke samsvarer med endret beregning, må de
  kontrolleres og eventuelt få egne kildebaserte rettingsforslag. Ingen automatisk
  omnummerering eller skjult sletting gjøres.
- Fjerning av en rad som ikke er identisk med en annen rad, trenger ytterligere
  kontroll før overlevering. Ingen avvisning eller sletting skjer i originalen.
- Rettelser som motstrider andre forslag i samme pakke stopper. Dette er ikke
  en automatisk konfliktløser for store, gjensidig avhengige datamigreringer.
- Ved endret dataversjon, manifest-/historikkhash eller forventet førverdi må
  saken gjennomgås mot nytt grunnlag. Pakken kan ikke tvinge gjennom en endring.

### Lokal import, eksport og reversering

**Last ned rettingspakke** bevarer hele saksgangen i en lokal JSON-fil. Arrangøren
trenger ikke redigere den. Import skjer med **Åpne lokal rettingspakke**.

Eksakt samme sak gjenbrukes uten duplikat. Samme saks-ID med annet innhold gir
konflikt; ingenting overskrives stille. Importerte overleveringsgodkjenninger
nedgraderes til forslag og krever ny lokal konsekvenskontroll. Importert
hendelseshistorikk presenteres ikke som en verifisert signatur.

**Endringshistorikk → Opprett kontrollert reversering** oppretter en ny sak som
refererer originalhandlingen. Den må også konsekvensberegnes. Reversering krever
at førverdier, identitet og resultattilhørighet kan gjenopprettes uten gjetting.
En sammenslåing sletter ikke personpostene/resultatenes opprinnelige eiere;
proveniens og guards gjør derfor kandidat-reversering etterprøvbar. Ukjent
opprinnelig tilhørighet eller senere motstridende endringer stopper tilbakeføring.

Tilbaketrekking av et ikke anvendt utkast gir ingen endring i kandidatdata,
men beholder referansen og kontrollsporet. Uavhengige sammenslåinger kan ligge
i samme pakke uten å overskrive hverandres aliaser eller redirects.

En allerede publisert retting kan **ikke** angres ved å importere en gammel
pakke mot nyere data. Den trenger autorisert kilde-/revisjonskontroll, et nytt
versjonsbundet forslag og ny godkjent eksport. C2.2 simulerer og dokumenterer;
den anvender ikke endringer i originale filer.

Filer, saker og valg lever i fanens minne. Ingen localStorage eller skjult
permanent database. Nettleseren varsler før lukking når det finnes saker.
**Last ned pakken før omlasting/lukking.** Oppbevar personopplysninger og interne
saksnotater på godkjent, privat lagringssted. De hører ikke hjemme i offentlige
Issues, PR-er, Git, testlogger eller artefakter.

## Teknisk struktur

- `tools/diploma-admin/intake-model.js`: eksisterende importmodul og separat
  `Corrections`-navnerom for det portable saksformatet. Ingen parallelle persondata.
- `tools/diploma-admin/intake.js`: eksisterende startlisteflate og avgrenset
  C2.2-kontroller. Godkjent offentlig grunnlag gjenbrukes; filer sendes ikke ut.
- `tools/diploma-admin/engine.js`: `C2Project` projiserer en kopi gjennom den
  ordinære motoren i en separat, disponibel nettleserramme. C1s diplomramme og
  de offentlige sidene påvirkes ikke. Rangering, rekorder, milepæler, lojalitet,
  deltakelsesår og diplommodeller beregnes av eksisterende funksjoner.
- Portalens HTML/ruting/CSS utvider den eksisterende arbeidsflaten. Ruten er en
  kodeutvidelse på samme måte som Design. Den versjonerte arrangementsprofilens
  seks moduler, publiserte filutvalg og sikkerhetspolicy er uendret.
- Offentlig bygg har fortsatt **74 filer og 15 adminfiler**. Ingen nye ruter,
  tjenester, npm-avhengigheter, Actions-endringer eller private datakilder.

[Korrigeringskontrakten](contracts/corrections-v1.md) beskriver guards og API.
Programmatisk bruk trenger bare den samme JS-modulen og felles historikkregler;
GitHub-hosting er ikke nødvendig. Produksjonsskriving er ikke en del av API-et.

## Kvalitetssikring og kontrollbilder

Nye tester og kontrollbilder bruker utelukkende oppdiktede personer, kildehenvisninger
og resultater. En sammenslåing gir et historisk 5-merke; en tidsrettelse påvirker
både klasseplassering og gjeldende løyperekord. Import/gjenimport, ugyldige pakker,
reversering, versjon/hash, kildeverdier, DNS/DNF/DQ, stafett og Heder-avhengigheter
kontrolleres. Ny syntetisk fixture følger faktisk sparse checkout og videre
isolert pakke uten administrative originaler.

Kontrollbilder på **1440, 768 og 390 px** genereres under eksisterende artefakt
`morothon-c1-diplomverksted`, undermappe `corrections-c22/`:

- `oversikt-{bredde}.png`
- `sammenligning-{bredde}.png`
- `resultatretting-{bredde}.png`

Ingen saks-/rettingspakker fra faktisk drift eller reelle importfiler legges i
artefaktet. Nedlastinger i testene er syntetiske og blir i midlertidig testkatalog.

```sh
node --test tests/public/quick/corrections.cjs
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c22-review node --test tests/public/visual/corrections.cjs
npm test
npm run test:public
npm run build -- /tmp/morothon-c22-site
npm run public:kontroll -- /tmp/morothon-c22-site
npm run data:check-sources
```

Byggutdata må ligge i en ny/tom mappe. Start lokal portal med `npm run admin`.
For utprøving før godkjenning, bruk et syntetisk testgrunnlag eller opprett lokale
saker uten å levere dem til faktisk produksjonsbehandling.

## Hva gjenstår utenfor C2.2?

[A1B](a1b-privat-migreringsplan.md), [A1C](a1c-separat-eksport-og-bygg.md) og
[A1D](a1d-privat-klargjoring.md) videreføres. Eksistensen av `historikk-admin`
er ikke bevis på migrerte originaldata eller en autorisert godkjenningsjournal.
Ingen private commits, flytting, backup eller GitHub-skrivetilgang aktiveres her.

Før faktisk retting trengs avtalt forvalter og autorisasjon, kildekontroll, backup,
ny konsekvenskontroll mot aktuell versjon, kontrollert oppdatering av avledede
hurtigfelt/årsoppsummeringer og ny A1C-eksport med ekstern publiseringsgodkjenning.
Endrede diplomgrunnlag trenger ny innholdsgodkjenning etter gjeldende regler;
C2.2 godkjenner/utsteder ingen diplomer eller merker. Kandidathistorikk er et
beregningsgrunnlag, ikke en ferdig, signert offentlig releasepakke.

Opprettelse av en helt ny løperprofil krever også separat identitetskontroll;
et manglende resultat i C2.2 må knyttes til en eksisterende profil.

C2.3 bør avstemme startlister og faktiske resultater, bruke det samme saksformatet
ved konflikter og merke foreldede prognoser. Autentisert, privat saksarkiv,
verifiserte anvendelses-/publiseringskvitteringer og rekonstruksjon av eldre
rettinger må etableres i en særskilt autorisert fase. Ingen offentlig innsendings-
kanal finnes; ingen melding påstås sendt eller mottatt.

## Sluttkontroll – 15. november 2026

| Kontroll | Resultat |
| --- | --- |
| Komplett `npm test` på låst kode | 335/335 bestått, ingen hoppet over |
| Isolert `npm run test:public` på siste klientversjon | 118/118 bestått, uten administrative originalregistre |
| Ekstra `quality-v32.cjs` og `public-export.cjs` på siste versjon | 13/13 bestått |
| C2.2 nettleserflyter inkl. siste visningsregresjon | 5/5 bestått på 1440/768/390 px |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler, dataversjon 1 |
| Kilde-/eksportsamsvar og eksisterende diplomreferanser | Bevarte originaldata og 86 uendrede Heder-diplomgrunnlag |
| Sikkerhetspolicy mot siste main | Uendret; ingen manuell SHA-godkjenning kreves |
| Dokumentlenker, diff og publiseringsfiler | Kontroller bestått; ingen nye data-, sikkerhets- eller workflow-filer |

Den siste visningsregresjonen ble lagt til etter fullkjøringen: lagrede forslag
må vises med riktige etterverdier også etter ny rendering og gjenåpning. Tid,
plassering, navn, aliaser og personkobling kontrolleres nå både i skjemaet og i
pakken. Deretter er hele den offentlige testpakken kjørt isolert på nytt.
Den samlede dekningen er 336 forskjellige beståtte tester; tabellens kjøringer
overlapper og skal ikke summeres som uavhengige tester.

En mellomliggende kjøring fikk fem C1-stopp fordi klientfiler ble endret mens
C1 holdt en låst kildeversjon. Sperren ble beholdt. En ren kjøring uten endringer
underveis besto med alle 335 tester. Ingen tester, kvalitetskrav eller tidsgrenser
ble fjernet eller svekket. Kommandoforbindelsen falt også kortvarig ut; arbeid
og testlogger var bevart da forbindelsen kom tilbake.

Historikk, personidentiteter, godkjente data, Heder, medaljer, ordinære diplomer,
publiseringsregler og avhengigheter er byte-uendret fra main. Bare portalens
funksjonskode, offentlige/syntetiske tester og dokumentasjon inngår.
Ingen reelle saks-/rettingspakker eller midlertidige kontrollbilder følger PR-en.

GitHub-API-et svarer `Forbidden` i arbeidsmiljøet. Lokale grønne tester er ikke
bekreftelse på grønn GitHub Actions. Ved blokkert PR-opprettelse må direkte
PR-lenke brukes, og Actions samt kontrollartefaktet kontrolleres der før merge.
Ingen merge, formell tildeling, reell datakorreksjon, migrering eller publisering
er utført.
