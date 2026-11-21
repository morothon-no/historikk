# P1B – pålitelig Personkontroll (#116 / #122)

## Avgrensning og utgangspunkt

Bygger på main `0f4abe84c4090cc83faef55d6f498a2e4bf6c4be`, etter #157.
#147 gir atomisk batch med inntil 50 avgjørelser. Hurtigvalg, hovednavn,
detaljsammenligning og varig oppfølging fra #151 samt tellerrettelsen fra #148
finnes allerede. #148 og identitetspubliseringen er integrert gjennom #153.
Ingen av disse komponentene bygges på nytt. #155–157s årsimport bevares.

## Bekreftede svakheter i kode

- Identitetskall manglet tidsavbrudd. En hengende HTTP-respons kunne holde
  handlingsknapper deaktivert ubegrenset. Pollingen ventet dessuten opptil ti
  minutter og behandlet enhver ukjent jobbstatus som fortsatt pågående.
- Moduloppstart ventet på hele kontrolljobben før den autentiserte adminsiden
  ble vist. En allerede kølagt jobb kunne derfor forsinke en ny innlogging.
- Søk/filtrering erstattet feil med forrige revisjons generelle status. Valgene
  i økten manglet en tydelig ulagret-status på kortene og i hovedstatusen.
- Innsending brukte ikke jobb-ID fra 202-kvitteringen. En vilkårlig feilet
  `identity-batch` i gjeldende kø kunne frigjøre en annen, uavklart innsending.
- Felles transport forsøkte å lese JSON før kontroll av HTTP 401. Et tomt svar
  eller HTML fra et mellomledd kunne dermed hindre utløpt sesjon i å bli ryddet.

Dette forklarer mulige fastlåste tilstander, men dokumenterer **ikke** hva som
skjedde med den virkelige avgjørelsen i #122. Ingen ekte avgjørelse er antatt
lagret, gjenskapt eller sendt inn igjen. Dagens main bruker hurtigvalg uten den
eldre bekreftelsesdialogen som brukeren rapporterte. Aktiv frontend/Worker og
privat jobbstatus må derfor sammenlignes ved separat driftsverifikasjon.

## Rettelse og kvitteringsregler

Alle Personkontroll-kall bruker nå AbortController med 20 sekunders frist,
inkludert lesing av responsen. Polling varer høyst omtrent to minutter, med
maksimalt ett ekstra HTTP-tidsavbrudd. Deretter frigjøres statusknapp og utlogging;
visningen forklarer om valgene fortsatt er låst mens serverutfallet er uavklart.
Dette avbryter ikke en allerede kølagt privat jobb.

Oppstart leser privat status én gang, uten å vente på at en kølagt jobb fullføres.
Sikker sesjonskontroll og den kritiske stilen som skjuler uinitialisert admin,
beholdes. En ukjent/sperret jobbstatus sperrer ny innsending med forklaring.

- **Ulagret avgjørelse:** synlig på kort, i øktliste og egen teller. Valgt hovednavn
  bevares ved opptegning. Angre/endring gjør ingen nettverksinnsending.
- **Lagring pågår:** én uforanderlig batch, samme kommando-ID-er og forventet
  revisjon. HTTP 202 betyr bare at jobben er kølagt.
- **Lagret privat:** krever nyere serverrevisjon og eksakt hashbasert
  `request-…`-hendelse for **hver** innsendte kommando. En fullført jobb eller
  økt revisjon alene bekrefter ikke lagring.
- Bare en feilet jobb med riktig jobb-ID (når mottatt), handling og eksakte
  kommando-ID-er kan avvise øktens innsending. De lokale valgene beholdes.
- **Hent status / fortsett lagring** leser status; den sender aldri POST på nytt.
  En mistet HTTP-respons kan avklares med de samme serverlagrede kvitteringene.
- Et bestemt avslag, inkludert manglende batchrute (404) og revisjonskonflikt
  (409), beholder valgene som redigerbare. Ved 404 forklares versjonsavviket.
- Nettverksfeil, timeout eller ufullstendig kvittering beholder en uavklart
  innsending. Ingen automatisk dublering, ingen falsk lagringsbekreftelse.
- Søk/filtrering bevarer feilmeldingen. En vellykket uttrykkelig statuskontroll
  eller eksakt lagringskvittering kan erstatte den.

Bare PKCE-innloggingens eksisterende engangsdata ligger i nettleserlageret.
Ulagrede valg og uavklart innsending lever fortsatt bare i fanens minne. Etter
utlogging/ny innlogging leses det som faktisk finnes privat på serveren; lokale
valg som aldri ble sendt, gjenopprettes ikke og omtales ikke som lagret.

Godkjenning, publisering og etterkontroll beholder separate serverstatuser.
Identitetspublisering forblir deaktivert som standard. Ingen lagringsstruktur,
API-kontrakt, prosessor, utstedelse eller offentlig fil endres av rettelsen.

## Regresjonskontroll

Målrettet grunnlinje før endring: **40/40** tester i:

```sh
node --test tests/admin-identity-review.cjs tests/serverless-identity.cjs tests/serverless-identity-browser.cjs
```

Den utvidede nettlesertesten bruker ekte beskyttet HTML, gateway, autentisering,
broker, driver, kryptert CAS-lager og eksisterende beregningsmotor. Eksterne
GitHub-kall og persondata er syntetiske. Den dekker:

- hurtigvalg, hovednavn, angre, flere avgjørelser i én batch og eksakte tellere;
- HTTP 202 før faktisk lagring, delvis kvittering, 404, 409, 502 og HTML-401;
- mistet POST-svar, ukjent jobbstatus og feil fra en annen jobb;
- 20-sekunders nettverksfrist og avgrenset polling med Playwrights testklokke;
- ny innlogging mens en jobb fortsatt står i kø, samt gjenåpning av lagrede saker;
- bevarte avvisninger, ingen ny innsending ved statuskontroll og skjult publisering;
- 1440, 768 og 390 px, sammenligning i synsfeltet og ingen horisontal overflyt.

En tjenestetest legger til et syntetisk 2027-resultat med DNF, åpner privat lager
på nytt og kontrollerer at samme avviste par forblir behandlet også etter
uttrykkelig kildevalidering. Resultatimportens implementasjon endres ikke.

Samlet relevant regresjon, byggsammenligning og eksakt head-SHA rapporteres i
PR-en. Egne Heder-/diplomgallerier kjøres ikke lokalt for denne klientrettelsen;
alle obligatoriske CI-kontroller beholdes.

## Aktivering og arrangørtest

Privat workflow på `7200efff68d3a5883abdf8610f887da67a0667b7` og sjekket
Wrangler-konfigurasjon peker på prosessor `ff7f99c1e60a951ba5ca6762edb95bff62c0f4d2`,
fra før batch-/adminforbedringene. Dette er filbasert versjonskontroll, ikke en
avlesning av aktive Cloudflare-bindinger. Ingen produksjonspins er endret.

Etter godkjent merge kreves separat godkjent, samordnet Worker-/asset-/
prosessorutrulling etter [eksisterende veiledning](manuell-worker-utrulling.md).
Kontroller gjeldende grønne CI, versjonspins, aktive jobber og rollback før dette.
Gamle røde Pages-/Worker-kjøringer som er erstattet av grønne, repareres ikke her.

Etter godkjent utrulling:

1. Logg inn direkte i beskyttet admin og åpne Personkontroll. Kontroller versjon.
2. Hent lagrede avgjørelser først. Søk etter det tidligere behandlede paret i
   **Avviste par / Behandlede**; ikke anta at #122-avgjørelsen finnes.
3. Velg bare avgjørelser arrangøren faktisk har bekreftet. Kontroller **Ulagret**,
   hovednavn, angre og samlet antall før én uttrykkelig innsending.
4. Vent på **Lagret privat** og oppdaterte tellere. Ved uavklart svar: hent status,
   ikke gjenta innsendingen. Noter jobbstatus uten å kopiere persondata til logger.
5. Logg ut og inn. Kontroller at samme private saker fortsatt finnes og ikke er
   ubehandlede. Ingen offentlig profil eller publiseringsstatus skal ha endret seg.

Virkelig avgjørelse, deploy, secrets-endring og produksjonspublisering er ikke
utført eller godkjent som del av denne utviklingsleveransen.
