# Automatisk kontroll av løperkoblinger

Dette er arrangørens kontrollverktøy for registrering og oppdatering av
personer. Det finnes ingen registreringsdialog på den statiske nettsiden;
navn og personopplysninger redigeres fortsatt i de eksisterende JSON-filene.
Verktøyet søker automatisk før `npm test` og `npm run build`. For løpende
kontroll mens registerfilene redigeres finnes en overvåkingsmodus.

Overvåkingen registreres før første skann. Ved automatisering skal klienten
vente på JSON-signalet `watch-ready`, ikke bare på at rapportfilen finnes.
Signalet sendes etter at overvåkingen er aktiv og første skann er avsluttet.
Katalogovervåking fanger også opp lagring som bytter JSON-filen med `rename`.
Feil gir et strukturert `watch-error`-signal; siste gyldige rapport beholdes
til registeret igjen kan leses og valideres.

```sh
npm run personer:kontroller
npm run personer:kontroller -- --watch
```

Rapportene er `.review/runner-links/koblingsforslag.md` og
`.review/runner-links/koblingsforslag.json`. Mappen er ignorert av git, og
rapportene inngår ikke i nettstedets produksjonspakke. GitHub Actions beholder
begge filer som `morothon-v36-loperkoblinger` etter bestått test-/byggfase.
Bare disse to rapportfilene tas med i artefaktet.

## Hva kontrollen gjør

- Søker i registrerte løpernavn, `history.json.aliases`, navn på videresendte
  person-ID-er og kjente navnealiaser på hedersprofilen.
- Følger ID-videresendinger og samler alle treff på samme kanoniske person.
  Flere aliaser for samme person gir derfor ett forslag, ikke falsk tvetydighet.
- Et entydig, fullstendig navne-/aliastreff merkes som et forslag som krever
  bekreftelse. «Entydig» betyr bare én kandidat i historikkfilen; det beviser
  ikke at dugnadspersonen og løperen er samme person.
- Flere kandidater gir manuell kontroll. Initialer, delvise navn, forskjeller
  som Å/Aa, tegnsetting og mulige skrivefeil gir bare usikre forslag, selv
  når det bare finnes én kandidat. Ingen kandidat velges etter flest starter,
  nyeste resultat, kjønn eller antatt alder.
- Kandidater som allerede er koblet til en annen hedersperson, flagges for
  kontroll av mulig dobbeltoppføring eller navnelikhet.
- Eksisterende arrangørbekreftede koblinger beholdes. Ugyldig bekreftelse,
  manglende kanonisk løper eller samme løper koblet til flere hederspersoner
  rapporteres som feil og gir ikke-null returkode. Test-/byggeflyten stopper.
- Bruker eksisterende historikkregler for kandidaters registrerte individuelle
  deltakelsesår: DNS utelates, DNF telles, samme år telles én gang og
  stafettresultater holdes utenfor. Historikkfilen endres aldri.

Normalisering av bokstavstørrelse og ekstra mellomrom gjør ikke et treff til
en bekreftet identitet. Rapporten bruker egne `candidateId`-felt; den er ingen
fil som nettsiden leser som permanente koblinger.

## Registrering og bekreftelse

1. Legg til eller oppdater personen i det vanlige registeret. Kjør kontrollen,
   eller la overvåkingsmodus reagere på lagringen.
2. Se kandidatnavn, kanonisk person-ID, deltakelsesår, kildealias og usikkerhet
   i rapporten. Kontroller identiteten med arrangøren, også ved entydig treff.
3. Først etter bekreftelse: legg inn `runnerLink` under den aktuelle personens
   oppslag i `data/honors.json.personDetails`, med `runnerId`, `confirmed: true`
   og en reell kilde i `sourceIds`. Se [personregisterveiledningen](personregister-v36.md).
4. Kjør kontroll og tester igjen. Profilen viser nå «Også på startstreken»,
   dynamisk løpsstatistikk og lenke; kortet viser et kompakt deltakelsesantall.

Det finnes ingen `--apply`- eller automatisk godkjenningsmodus. Verktøyet
skriver bare rapporter, aldri `runnerId`, `runnerLink`, navnesammenslåinger,
resultater, dugnadsår, hedersmerker eller tildelinger. Rapporter kan legges
utenfor prosjektet eller under `.review`, ikke i prosjektets kildemapper.
Rapportfiler oppdateres atomisk. En ufullstendig JSON-lagring i overvåkingsmodus
beholder siste gyldige rapport og viser feilen til neste gyldige lagring.

## Nye og endrede forslag ved senere oppdateringer

Bevar forrige gjennomgåtte JSON-rapport som et eget sammenligningsgrunnlag:

```sh
npm run personer:kontroller -- --previous /sti/forrige-koblingsforslag.json
# Egen rapportmappe, for eksempel ved gjennomgang av en ny årgang:
npm run personer:kontroller -- --output /tmp/morothon-koblinger
```

Med `--previous` merkes nye personer/forslag som «Ny», endrede kandidater eller
navnegrunnlag som «Endret», og øvrige som «Uendret». Uten forrige rapport er
alle ubekreftede forslag nye. Nytt løpsresultat eller deltakelsesantall endrer
ikke i seg selv forslagets identitetsstatus, men de ferske tallene vises.
Det gis aldri en bekreftelse bare fordi rapporten har vært kjørt tidligere.

## Oppdatering av løpsstatistikk

Etter en godkjent kobling leser hederssiden fortsatt løpsstatistikk direkte
fra `history.json` ved sidelasting/oppfriskning, med eksisterende kanoniske
ID-regler. Ingen antall eller tider kopieres inn i hedersregisteret. Nye
resultater og videreførte ID-er oppdaterer derfor antall, år og profillenke
uten manuell endring av koblingen. Dette er ikke en løpende polling av en
allerede åpen nettleserfane; oppfriskning laster ny historikk.

Dugnad beregnes separat fra løpsresultatene. Dokumenterte dugnadsår oppdateres
ikke fordi personen har løpt. Registrerte dugnadsperioder følger fortsatt
sin eksisterende beregning av arrangerte utgaver; løpsstarter brukes aldri
som dokumentasjon på at personen var frivillig.

## Første rapport for V3.6

Dagens 44 personer gir 12 allerede bekreftede koblinger, 13 entydige forslag,
ett usikkert forslag og 18 uten treff. Ingen nye koblinger er lagret.
Rapporten har ingen feil i de eksisterende koblingene. Tallene over er et
øyeblikksbilde; kommandoen beregner rapporten fra den til enhver tid gjeldende
historikk- og registerfilen.

## V3.6.1 – uttrykkelig bekreftelse av de 14 forslagene

Arrangøren har bekreftet samtlige 14 forslag i den første rapporten, også
Bent-Inge Bakke → Bent Inge Bakke (`MOR-046CD37`). De er nå registrert i
`personDetails.runnerLink`, med kilde `organizer-v361-confirmed-links`.
Dette endrer ingen navn, aliaser, resultater, dugnadsår eller tildelinger.
Gjeldende rapport har 26 bekreftede koblinger, 18 uten treff og ingen
ubekreftede forslag eller koblingsfeil. Fremtidige forslag krever fortsatt
uttrykkelig identitetsbekreftelse.

| Hedersnavn | Bekreftet løper-ID |
| --- | --- |
| Arvid Borø | `MOR-5F10796` |
| Astrid Lohne | `MOR-3CBFFC3` |
| Bent-Inge Bakke | `MOR-046CD37` |
| Erling Danielsen | `MOR-B82F8A3` |
| Johannes Aamodt | `MOR-FB68447` |
| Jon Fjeld | `MOR-EFAFF95` |
| Jøran Eriksen | `MOR-5F72D06` |
| Lars Vassbotn Aamodt | `MOR-D4F55FF` |
| Leif Wiig | `MOR-88334F0` |
| Lene Holmen Berg | `MOR-830D9E6` |
| Mari Melsom Kristensen | `MOR-B42530E` |
| Nils Henning Pedersen | `MOR-000B270` |
| Rune Bergjord | `MOR-45DF0B4` |
| Tom Lohne | `MOR-BE568A1` |
