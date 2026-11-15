# C2.2a – Mer presise identitetsforslag

Utgangspunkt: `main` etter PR #41, commit `753dd8a`. Endringen gjelder
identitetsforslag og arbeidslisten i «Rettelser og personkontroll».

## Navn som kontrollgrunnlag

Navn sammenlignes som hele navneledd: fornavn, mellomnavn og etternavn.
Mellomrom, store/små bokstaver og bindestreker normaliseres. Norske bokstaver
beholdes; eksplisitte varianter som å/aa, æ/ae og ø/oe er kontrollsignaler.
Ingen substring-matching eller samlet bokstavscore brukes.

- **Sterkt:** Identisk normalisert fullt navn på forskjellige kanoniske profiler,
  også når et godkjent alias eller et navn fra en tidligere ID-kobling støtter
  samsvaret. Samme kanoniske profil foreslås aldri mot seg selv.
- **Moderat:** Samme for- og etternavn med ekstra/manglende mellomnavn,
  samsvarende mellomnavnsinitial, ett lite staveavvik eller et ekstra fullt
  etternavnsledd etter et ellers identisk navn.
- **Svakt:** Fortsatt betydelig likhet i begge ender av navnet, men mer
  usikkerhet, for eksempel fornavnsinitial og samme fulle etternavn.

Små skrivefeil begrenses til ett innskudd, bortfall, bytte eller nabobokstavbytte
i navneledd med minst fem tegn. Kortnavn og etternavnspartikler behandles
konservativt. Begrunnelsen vises ved hvert forslag. Ett kanonisk personpar gir
høyst ett identitetsforslag.

Deltakelsesår oppretter eller fjerner ingen navneforslag. Overlappende starter
er fortsatt kontrollgrunnlag ved konkret saksbehandling. Helt nytt etternavn
uten registrert navnestøtte må undersøkes manuelt. Ingen navnelikhet bekrefter
identitet, og konservativ filtrering kan utelate reelle varianter.

## Oppdatering og behandlede saker

**Oppdater – vis ubehandlede** beregner listen på nytt og nullstiller søk,
side og grunnlagsfilter. Eventuelle valgte startlistekontroller beholdes.

- **Ubehandlede:** Nye forslag og åpnede saker uten videre behandling.
- **Til oppfølging:** Utsatte saker, lagrede notater og foreslåtte rettinger.
- **Ferdig gjennomgått:** Avviste saker og saker godkjent for overlevering.

Oppdateringen endrer ingen saksstatus. **Alle forslag** og **Behandle saker**
gir fortsatt tilgang til sakene. Gjenåpning gjenbruker saken. Eldre pakker
respekteres også når kategorien for et personpar har endret seg. Stabile,
hashbaserte forslagsreferanser bevares i eksisterende v1-hendelser; pakkeformatet
endres ikke. Saker fra en annen startliste eller andre resultatrader skjules
ikke fordi samme person er behandlet tidligere.

Arbeidet er fortsatt lokalt i fanen. Last ned rettingspakken før omlasting
eller lukking. «Ferdig gjennomgått» betyr ikke at en retting er publisert.

## Måling på godkjent offentlig historikk

Begge analyser brukte samme, uendrede `public-data/data/history.json` med SHA-256
`dcf4518e6e20f5f2919cb501cd7ef02123329ce418be228eba8b36170c57fce7`.
Bare aggregerte tall rapporteres; ingen personnavn eller person-ID-er.

| Identitetskategori | Før | Etter |
| --- | ---: | ---: |
| Mulig navneendring | 1 654 | 0 |
| Mulig navnevariant | 54 | 14 |
| Mulige duplikater | 2 | 2 |
| Navn eller alias | 2 | 0 |
| Navnevariant | 19 | 42 |
| **Sum forslag** | **1 731** | **58** |
| Unike personpar | 1 729 | 58 |

Etter: 2 sterke, 47 moderate og 9 svake signaler. Navn/alias-kategorien er
fortsatt støttet og testet; de to tidligere signalene gjaldt allerede foreslåtte
identiske personpar og dupliseres nå ikke. Nye navneleddsregler omklassifiserer
en del forslag. Tallreduksjonen er ikke en fasit over hvilke personer som er like.

Andre kategorier er uendret: datakvalitet 91, mulige dobbeltresultater 32 og
tider til kontroll 690. Historiske resultater, person-ID-er, aliaser, redirects,
Heder, medaljer, diplomer og offentlige dataversjoner endres ikke.

## Tester og kontrollbilder

Tester bruker utelukkende syntetiske navn og data. De dekker positive og
negative navnepar, årsvariasjoner, godkjente aliaser/redirects, eldre saker,
notater, avvisning/utsettelse, gjenåpning, eksport/import og samtidige klikk.
Nettleserkontroll på 1440, 768 og 390 px sjekker også konsoll og overflow.

```sh
node --test tests/public/quick/identity-suggestions.cjs tests/public/quick/corrections.cjs
MOROTHON_C1_REVIEW_DIR=/tmp/morothon-c22a-review node --test tests/public/visual/corrections.cjs
npm run test:public
npm run build -- /tmp/morothon-c22a-site
npm run public:kontroll -- /tmp/morothon-c22a-site
npm run data:check-sources
```

Kontrollbilder `corrections-c22/matching-c22a-{1440,768,390}.png` inngår i
eksisterende kontrollartefakt `morothon-c1-diplomverksted` når PR-jobben kjører.
Ingen reelle rettingspakker eller midlertidige bilder sjekkes inn. Eksisterende
Actions, testutvalg, publiseringsregler, filgrenser og avhengigheter er uendret.

### Sluttkontroll 15. november 2026

| Kontroll | Resultat |
| --- | --- |
| Komplett offentlig testpakke i isolert kopi uten administrative originaler | 127/127 bestått, ingen hoppet over |
| Ekstra `tests/quality-v32.cjs` og `tests/public-export.cjs` | 13/13 bestått |
| Nye navne- og arbeidslistetester | Inkludert i offentlig fullkjøring; 7 modelltester og 2 nye nettleserflyter |
| Produksjonsbygg og uavhengig offentlig pakkekontroll | 74 filer, 15 adminfiler, 43 synlige Heder-profiler |
| Kilde-/eksportsamsvar | Godkjent dataversjon 1, originaldata og eksport samsvarer |
| Visuell kontroll | Faktiske Chromium-bilder ved 1440/768/390 px, ingen konsollfeil eller horisontal overflow |
| Dokumentlenker og `git diff --check` | Bestått |

Disse to komplette testkjøringene dekker 140 tester. Tidligere målrettede
kjøringer overlapper og summeres ikke inn i dette tallet. Hele den private
kildetestpakken og historiske diplomgallerier er ikke regenerert for denne
avgrensede endringen. Eksisterende produksjons-/datakontroller er beholdt.

GitHub-API-et svarer `Forbidden` fra arbeidsmiljøet. Dette hindrer automatisk
PR-opprettelse og fjernkontroll av Actions; lokale grønne tester er ikke en
bekreftelse på grønn Actions. Grenen pushes, og direkte PR-lenke leveres dersom
opprettelsen blokkeres. Actions og kontrollartefaktet må kontrolleres i PR-en
før merge. Ingen merge eller publisering gjennomføres her.
