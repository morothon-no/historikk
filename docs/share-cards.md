# Skrytekort – V3.2

`MorothonCard.build(pid)` gir PNG i 1080 × 1350 (4:5). `build(pid, {format:'square'})` gir 1080 × 1080. Formatet velges i delingsdialogen; forhåndsvisning, lagring og systemdeling bruker den samme genererte filen. Ny generering ugyldiggjør eldre, pågående genereringer, og lukking frigir objektadressen. Faste formatmål gjelder også ved lange navn; navn brytes og den samlede innholdsflaten tilpasses ved behov uten å strekke medaljer.

`js/brag-card.js` beregner én felles presentasjonsmodell fra dagens individuelle historikk. `cardStats` velger statistikk som tilfører ny informasjon. Samme aktive/lengste rekke vises bare én gang på kortet; full statistikk finnes i profilen. Alle medaljer kommer fra fellesregisteret. Høyeste merke vises én gang som hovedmedalje, og tidligere merker danner medaljesamlingen.

- Bronse–Titan viser deltakelsestall, debut, relevant rekke/lojalitet, tidligere merker, fremdrift mot neste merke og personlige prestasjoner.
- Legende og høyere har en mer seremoniell komposisjon, større medalje og egne metallfarger/rammer. Fremdrift er tilgjengelig i fullprofilen.
- Æresløper beholder dobbel gullramme og størst hovedmedalje. «Deltatt i samtlige utgaver siden 1992 · 100 % lojalitet» vises bare når alle faktisk arrangerte utgaver finnes blant løperens unike deltakelsesår. Dette vurderes på nytt ved fremtidige årganger. Dersom teksten gjelder, utelates de gjentakende rekkeboksene.

Hovedfeltets geometri måles med CSS Grid. Deltakelsestall sentreres etter synlige bokstavglyfer. Medaljesamlingen tilpasses antallet tidligere merker: ett får 180 px synlig motivkant, to får 150 px, tre–fire får 125 px og fem–ni får 93–105 px etter tilgjengelig bredde. Samlingsraden får tilsvarende høyde; ubrukt vertikal luft omfordeles til medaljene. På mobilprofiler reduseres tomrom og radantall, mens hovedmedaljen får mer tilgjengelig bredde. Tidligere merker blir aldri mindre enn den tidligere profilvisningen. Transparent luft regnes ikke med i dette størrelsesmålet; hele kildefilen tegnes med bevart sideforhold og uendrede bildepiksler. Hovedmedaljen er klart større. Små innskrifter i medaljemotivene krever fortsatt zoom for å leses fullt ut på en smal mobilskjerm; dette er ikke forbedret native bildekvalitet eller nye trykkoriginaler.

Skrytekortet viser dagens historikk. Et historisk merkediplom viser terskelen og perioden frem til opptjeningsåret, jf. [diplomer](diplomas.md). Ingers skrytekort har derfor 12 deltakelser og 12/15 mot Gullmerket, mens sølvdiplomet har 10 deltakelser og perioden 2015–2024.

Lokale sammenligninger, mobilbilder og A4-kontroller genereres med:

```sh
node scripts/review-v2.cjs /tmp/morothon-v2
```

Sammenligningsgrunnlaget for tidligere 4:5 kan angis som tredje argument (commit/ref); standard er HEAD. Skriptet henter bare lokale git-blobs og endrer ingen kilde-, bilde- eller historikkfil. Det pusher eller publiserer ikke.


## Deltakelsesgrad og historisk heder

Profil, delingskort og «De trofaste» bruker `js/loyalty.js`, se [beregningsreglene](loyalty.md). Primærperioden går fra første til siste registrerte deltakelse. Under 70 %, eller før fem arrangerte utgaver, viser ikke kortet en prosent. Kristen Fløgstad får «5 på rad · 2005–2009», siste registrerte løp 2016 og debutår 1993; 12/24 = 50 % finnes nøytralt i detaljene. Ved comeback fremheves en eventuell tidligere heder med årstall, uten å presentere den som nåværende prosent.

Nye lokale før/etter-eksempler kan lages mot hovedleveransen før tilleggene:

```sh
node scripts/review-loyalty-v32.cjs /tmp/morothon-v32-additions 93d4ff3
```

Skriptet viser både reelle løpere og tydelig merkede syntetiske 40–50-terskler/ekstra lange testnavn. Syntetiske personer finnes bare i nettleserminnet. Historikkfiler og medaljefiler endres ikke.
