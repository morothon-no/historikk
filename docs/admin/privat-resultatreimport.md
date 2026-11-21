# Privat lagring og trygg reimport av resultatrettelser

Denne leveransen bygger videre på PR #151. Den kobler resultatavstemmingen under
**Årets arrangement** til samme private lager, kontrollmotor og publiseringsflyt
som manuelle rettelser. Selve CSV-/TSV-filen sendes ikke til tjenesten.

## Bruk

1. Åpne beskyttet admin og velg **Årets arrangement → Endelige resultater**.
2. Les filen, avklar felt og gjennomgå avvikene med eksisterende kontrollregler.
   Uendrede resultater og vanlig DNS krever fortsatt ingen handling. DNF teller
   som startet, uten sluttid. Manglende rader slettes aldri automatisk.
3. Velg **Lagre og kontroller rettelsene privat**. Tjenesten lagrer bare de
   uttrykkelig gjennomgåtte rettingsforslagene, og kjører eksisterende private
   konsekvenskontroll. Lagring, bestått kontroll og publisering er ulike statuser.
4. Åpne **Resultatkontroll** for samlet før/etter og separat godkjenning og
   publisering. Etter ny innlogging brukes **Hent lagret utkast**.

En allerede lagret rettelse beholder sin opprinnelige kilde selv om en ny fil
velges. Identisk reimport oppretter verken nye saker eller ny lagringsrevisjon.
Andre private saker beholdes. Ulagret manuelt arbeid må lagres eller avklares
før importen får erstatte arbeidsvisningen i fanen.
Tidligere avviste eller utsatte forslag krever et uttrykkelig nytt valg, selv om
resultatverdiene er like. De gjenopptas ikke automatisk og hoppes ikke stille over.

Hvis ny fil foreslår en annen verdi for samme resultat, vises lagret forslag og
nytt forslag side om side. **Behold lagrede forslag** skriver ingenting.
**Erstatt … private forslag med ny fil** krever den eksakte serverrevisjonen,
kontrollsummen og det samme gjennomgåtte importgrunnlaget. Endres ett av disse,
må forskjellene vurderes på nytt. Den gamle private rettelsen og hendelsene
bevares i kryptert revisjonshistorikk. Ingen offentlig resultatlinje slettes.

## Grenser og sikkerhet

- Kun eksisterende individuelle resultatregistreringer på gjeldende offentlig
  dataversjon støttes. Nye årganger, nye rader og nye personkoblinger aktiveres
  ikke av denne snarveien. De eksisterende importforhåndsvisningene beholdes.
- Dagens grense på **20 saker samlet** og forespørselsgrensen på **64 KiB** er
  uendret. Ved overskridelse avvises hele lagringen; ingen saker hoppes over.
- `POST /review/import` krever samme eieridentitet, bearer-token, Origin-kontroll,
  køkontroll, kildebinding og krypterte compare-and-swap-lager som `/review/save`.
  Både forventet revisjon og SHA-256 av eksisterende utkast kontrolleres.
- Importerte statuser er ikke godkjenning. Endret grunnlag nullstiller tidligere
  godkjenning og krever ny serverkontroll. Bare eksisterende, separate
  publiseringsløp kan endre offentlige data; backup, etterkontroll og reversering
  er fortsatt obligatoriske der.
- Ingen råfiler, rettingspakker eller økttoken lagres i nettleserens permanente
  lagring. Offentlig forhåndsvisning får ingen privat lagringsknapp.
- Knappen krever at den autentiserte tjenesten annonserer
  `resultImportPersistence`. En eldre Worker beholder eksisterende arbeidsflyt;
  ny nettleserkode alene later ikke som serverfunksjonen er aktiv.

## Aktivering

Ingen Worker, privat workflow, pin, secret eller publiseringsregel endres av
denne PR-en. Ny brokerkode er innenfor eksisterende CORE-sperre. Før aktivering
må Worker/prosessor-kombinasjonen gjennomgås, versjonsbindes og rulles ut etter
[eksisterende utrullingsveiledning](manuell-worker-utrulling.md), med separat
eiergodkjenning og dokumentert rollback. Det er ikke tillatelse til å publisere
en ekte resultatkorrigering.

Ved rollback beholdes private saker og krypteringsnøkler. Forslagene bruker det
eksisterende rettingsformatet og kan åpnes av tidligere manuell resultatkontroll.
En eventuell pågående privat jobb må avklares før utrulling eller tilbakeføring.

## Kontroll

```sh
node --test tests/serverless-admin.cjs tests/serverless-admin-browser.cjs
node --test tests/admin-result-review.cjs tests/public/quick/results-reconciliation.cjs tests/public/quick/results-dns.cjs tests/public/quick/results-flexible.cjs
node --test tests/public/visual/results-reconciliation.cjs
node scripts/testing/run.cjs --scope source --level full
npm run test:public
npm run build
```

Alle nye person-/resultateksempler er syntetiske. Nettlesertesten går gjennom
ekte gateway og øktkontroll, manuell rettelse, CSV-import, gjenbruk, konfliktvalg,
ny innlogging, privat gjenåpning, separat godkjenning, offentlig profilkontroll og
tilbakeføring i et isolert testrepository. GitHub-/OAuth-transporten simuleres;
ingen virkelig publisering inngår. Mobil, nettbrett og PC kontrolleres ved
390, 768 og 1440 px.
