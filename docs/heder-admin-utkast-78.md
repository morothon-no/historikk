# Heder – øktutkast og utgavevelger (#78)

Grunnlag: main etter merget PR #77, med kravene i #73. Dette er neste lokale,
avgrensede steg; publiserte personregistre, resultater, medaljer, diplommaler,
godkjenninger, offentlig manifest og Pages-ruter endres ikke.

## Prøv løsningen

Start som tidligere:

```sh
npm run admin
```

Åpne adressen på `127.0.0.1` som serveren viser. Velg **Heder**, deretter
**Ny person**, eller åpne en eksisterende profil og velg **Rediger**.

1. Rediger navn, kort omtale, roller, historier med tittel/tekst/kildemerknad og
   personlig diplomtekst. Originale kildereferanser beholdes på serveren.
2. Velg beregningsgrunnlag og faktiske utgaver. Løpende periode foreslår bare
   arrangerte utgaver; enkeltutgaver og fravær kan kontrolleres separat.
3. Se løpende forhåndsvisning av person, kvalifiserte merker, antall utgaver,
   neste nivå og personlig diplomtekst. Denne visningen er ikke et utstedt
   diplom, og kan ikke brukes til ren utskrift/PDF av endret innhold.
4. Gjennomgå **før/utkast-diffen**. Bekreft konkrete utgaver og fravær når
   beregningsgrunnlaget eller utgavevalgene endres, og alltid for periodeforslag.
5. Bruk eventuelt deltakersøket. Velg kandidat og bekreft identiteten separat.
   Like navn gir aldri en automatisk kobling. En løper som allerede er koblet
   til en annen Heder-person kan ikke overtas i utkastet.
6. Velg **Behold utkast i økten**. Utkastet kan åpnes igjen fra listen over
   øktutkast. **Forkast øktutkast** gjenoppretter visningen av gjeldende register.

Den vanlige personlisten viser fortsatt de 43 gjeldende personene. Nye og
endrede øktutkast vises separat og blandes ikke inn i gjeldende data.

## Hva beholdes faktisk?

Utkastene finnes **bare i Node-prosessens RAM**. En nettleseroppdatering kan
hente igjen et beholdt utkast så lenge den samme serverøkten kjører. Avsluttes
serveren, forsvinner utkastene. Ikke-beholdte feltendringer i nettleseren kan
forsvinne når man forlater redigeringen; grensesnittet varsler om dette.

Det brukes ikke localStorage/IndexedDB, personregisterfiler, database, GitHub,
serverbackup eller en varig privat lagringsadapter. Ingen av `awards`,
`issuedDiplomas`, godkjente presentasjonsfingeravtrykk eller personkoblinger
oppdateres i de originale registrene. `persisted:false`,
`productionApplied:false` og `publicationAuthorized:false` følger svarene.

Den lokale øktkapabiliteten er den eksisterende anti-CSRF-modellen, **ikke
flerbrukerautentisering**. Sikker autentisert varig lagring er ikke etablert i
arrangørportalen. Derfor stopper denne leveransen ved testbar utkast/preview
og øktminne. C2.4-lagringsadapterne gir ikke tilgang bare fordi nettleseren
sender et bekreftelsesfelt. Senere lagring/publisering krever verifisert
serveridentitet, arrangørrettigheter, kildebinding, privat lagring, revisjon og
ny kontroll av innhold/godkjenninger. Denne PR-en oppretter ingen slik snarvei.

## Utgaver og evidens

Beregningen går gjennom den eksisterende felles `serviceTenure`-motoren.
Kall med historiske heltallsår beholder tidligere kontrakt/beregning. Motoren
støtter nå også en eksplisitt katalog av utgave-ID-er for utkast:

```js
[
  {editionId: 'lop-var-2026', year: 2026, label: 'Vårutgaven', status: 'held'},
  {editionId: 'lop-host-2026', year: 2026, label: 'Høstutgaven', status: 'held'}
]
```

Hver entydige gjennomførte utgave teller én gang, også om flere foregår samme
kalenderår. `planned` og `cancelled` kan ikke velges. Katalogens rekkefølge
innen samme år må være arrangørens kontrollerte rekkefølge; ingen dato gjettes.
En katalog med flere utgaver samme år kan ikke tolke eldre `confirmedYears`
som entydig dokumentasjon. Slike data krever konkret utgaveavklaring.

- **Dokumenterte valg:** eksplisitt valgte utgave-ID-er i utkastet. De er ikke
  publisert dokumentasjon eller en autentisert kildegodkjenning.
- **Registrert periode:** forslag fra start til eksplisitt slutt, eller siste
  gjennomførte utgave ved fortsatt aktiv. Brukeren kan fjerne forslag uten at
  de automatisk blir bekreftede fravær. Fravær registreres i egen avkryssing.
  Forslag skrives aldri om til `confirmedYears`.
- **Godkjent samlet antall:** beholdes uten å konstruere enkeltutgaver,
  milepælår eller datoer. Valg av annen evidens er en eksplisitt utkastendring.
- **Ukjent:** ingen sikker opptelling. Roller og løpsstarter fyller ikke inn år.
- **Minneprofil:** løpende aktivitet er sperret. Ukjent sluttår forblir ukjent;
  aktiv periode videreføres aldri automatisk. Eksisterende minne-/grunnlegger-
  og særhederstatus bevares. Ny minnemarkering i utkastet tildeler ikke merke.

Morothon-adapteren lager øktkatalog fra faktisk arrangerte år i godkjent
historikk. Dette er en lokal mapping, ikke en publisert omskriving av
historiske resultat-ID-er. Native arrangører kan levere egne utgave-ID-er og
merketerskler; terskler/merker hentes fra arrangørens `awardPolicy` og register,
uten hardkodede Morothon-nivåer i redigeringsmodellen.

## Avgrensning og sikkerhet

- Godkjent offentlig snapshot er fortsatt eneste data-input til lokal HTTP-UI.
  Personutkast er overlays, ikke et nytt konkurrerende produksjonsregister.
- Serveren avviser ukjente felt, private kildefelt, tildelings-/utstedelsesfelt,
  uautoriserte identitetsvalg, dubletter, foreldede revisjoner og kildeversjoner.
- Behold-handlingen bruker serverens siste forhåndsvisning med uforutsigbar ID;
  nettleseren kan ikke erstatte den med et eget personregister eller en approval.
- Originalt register, kilder og spesialheder beholdes tapsfritt. Person-ID-er
  fra eksisterende register endres ikke. Nye øktpersoner får midlertidige ID-er.
- Både eksisterende og nye Heder-ruter krever lokal kapabilitet. Endrende
  økthandlinger krever samme origin, JSON og eksisterende størrelsesgrenser.
  Redigerte/nye historier og roller markeres ikke som kildebekreftede fakta.
- `honorEnabled:false` skjuler editor/meny og gir 404 på alle Heder-utkastruter
  etter eksisterende sesjonskontroll. Heder fjernes også fra lokal diplomliste og
  oversikt; lokale Heder-diplomjobber og `/site/heder.html` avvises. Deaktivering
  sletter ikke registeret. Det allerede godkjente offentlige snapshotet er
  fortsatt uendret; modulbryteren gjør ikke tidligere offentliggjorte data private.
- Ingen Heder-editor, skrive-API eller tilgang til originalregistre legges i
  offentlig Pages-portal. Offentlig API-fravær testes også i sparse checkout.
- En blank arrangørmodell har null personer/merker og arver ikke Morothon-navn,
  historier eller regler. Denne PR-en bygger ikke opprettelsesveiviseren eller
  ferdig flerarrangørisolasjon i #72. Standard lokal oppstart er fortsatt Morothon.

Ingen originaldata flyttes eller slettes. Ingen nye publiseringsvalg gjøres.
Nye utgave-ID-felt finnes bare i utkastkontrakten; den offentlige datapolicyen
avviser dem fortsatt som ukjente publiseringsfelt. En framtidig migrering må
avklares separat og skal ikke eksportere øktutkast direkte til dagens filer.

## Tester

```sh
node --test tests/honor-drafts.cjs tests/honor-admin-roster.cjs tests/honor-runner-search.cjs tests/honor-admin-view.cjs
CHROMIUM_PATH=/usr/bin/chromium node --test tests/public/visual/admin-portal.cjs tests/public/visual/web-admin.cjs
npm test
npm run build -- /tmp/morothon-reviewed-build
```

Fullfør kontroll på eksakt PR-head i komplett betrodd checkout. De nye
modelltestene leser også de 43 godkjente profilene; øvrige nye personer,
identitetskonflikter og utgavekataloger i testene er syntetiske. Offentlig CI
kjører fortsatt med sine eksisterende sparse-grenser og uavhengige artefaktgate.
Grønn offentlig CI alene erstatter ikke kilde-/fullkontrollen.
