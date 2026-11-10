# Deltakelsesgrad og historisk heder – V3.2

`js/loyalty.js` er felles beregningsgrunnlag for løperprofil, skrytekort og
«De trofaste». Ingen resultat- eller medaljefiler endres av beregningen.

- Perioden går fra første til siste registrerte individuelle deltakelsesår.
- Nevneren er unike, faktisk arrangerte utgaver fra `yearStats` i perioden.
  Et år uten arrangement gir verken fravær, brudd i rekken eller comeback.
- Telleren er unike deltakelsesår etter kanonisk person-ID og godkjente
  sammenslåinger. DNS utelates, DNF teller. Stafettlag/stafettresultater utelates.
- Heder krever minst fem arrangerte utgaver i perioden: nøyaktig 100 % gir
  «Ubrutt deltakelse», minst 90 % «Svært trofast», og minst 70 %
  «Trofast Morothon-løper». Grenser sammenlignes uten avrunding.
- Bare ved deltakelse i siste arrangerte utgave kan 100 %-nivået kalles
  «Ubrutt siden debut». Historiske utmerkelser merkes alltid med perioden.
- Prosentvisning trunkeres til én desimal, slik at for eksempel 89,99 % ikke
  fremstilles som 90 %. Desimalen utelates ved hele tall.

## Deterministisk historisk opptjening og comeback

Etter hvert registrerte deltakelsesår beregnes et prefiks fra debut til det
året. Vi flytter aldri startpunktet for å finne en gunstig kort periode.
Hver kvalifiserende periode har minst fem arrangerte utgaver. Under ubrutt
deltakelse på samme hedersnivå forlenges prefikset til det siste året.
Et opphold i faktisk arrangerte utgaver, eller et nivåskifte, avslutter dette
prefikset som en dokumentert utmerkelse. Et senere comeback kan gi en ny
utmerkelse, men fjerner eller omskriver ikke de avsluttede periodene.

Alle disse periodene finnes i `awards`. `recognition` prioriterer høyeste
oppnådde nivå, deretter lengste periode. `current` er hedersnivået for hele
første–siste-perioden. De to må ikke forveksles. Lojalitetsprofilen viser de
dokumenterte utmerkelsene med årstall og separat beregningsgrunnlag for dagens
periodeandel. Kalenderens historikkvisning bruker `recognition`, mens
periodevisningen bruker dagens fulle periodeandel.

Eksempel: Ti sammenhengende utgaver i 2000–2009 gir 100 % i denne perioden.
En retur i 2027 endrer fullspennet til 11/28 = 39,2 % hvis alle utgavene er
arrangert. Utmerkelsen fra 2000–2009 beholdes med samme tekst og periode.
På skrytekortet står historisk heder med årstall, ikke «100 %» som om det
gjaldt hele 2000–2027. Årsaken til fravær beskrives aldri.

Kristen Fløgstad har 12/24 = 50 % i 1993–2016 og fem sammenhengende utgaver
i 2005–2009. Kortet fremhever rekken, debutåret og siste registrerte løp.
En retur i 2027 gir 13/35 = 37,1 % i fullspennet, men rekken 2005–2009 består.
Fem på rad etter en tidligere spredt historikk er en dokumentert rekke,
ikke en fritt valgt 100 %-lojalitetsperiode.

## Kalender og deling

«De trofaste» har visninger for alle registrerte perioder, deltakere i siste
utgave og historisk oppnådd heder. Nevner og årsspenn vises alltid. Sortering
bruker eksakt andel, deretter antall deltakelser og mulige utgaver; historisk
heder prioriterer først nivå. Navn avgjør gjenstående likhet deterministisk.

Kort under 70 %, eller med færre enn fem mulige utgaver, fremhever konkret
historikk uten prosent. Historisk heder kan vises med eksplisitt periode.
Lengste rekke har start- og sluttår; ved like lange rekker velges den tidligste.
De samme reglene gjelder PNG i både 4:5 og 1:1 og den ordinære profilen.


## Forsidens separate nøkkeltall (V3.2.1)

Forsidens «Med 100 % deltakelse siden debut» teller alle som har minst tre
unike individuelle deltakelsesår og deltakelse i samtlige arrangerte utgaver
fra debut til siste gjennomførte utgave i historikkfilen. Det er et nøkkeltall,
ikke en særskilt lojalitetsutmerkelse. Forklaringen viser siste år dynamisk.
DNS utelates, DNF teller, og kanoniske ID-er brukes. Gjeldende 2026-historikk
gir 33; verken antall eller årstall er hardkodet. Modellens minstekrav på fem
arrangerte utgaver og hedersnivåene 70/90/100 % er uendret.
