---
id: TASK-17
title: 'Lijst: geen misstreepjes meer en vlot kunnen scrollen'
status: Done
assignee: []
created_date: '2026-09-19 07:13'
updated_date: '2026-09-19 07:16'
labels: []
dependencies: []
type: bug
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Op de lijst is elke rij over de volle breedte het tikgebied, en elke rij zet touch-action: none. Twee gevolgen op een volle lijst:

1. Je tikt geregeld per ongeluk op de naam van je buurman en moet dat corrigeren.
2. Scrollen kan niet zonder iemand aan te raken: touch-action: none blokkeert de native verticale pan, dus er is nergens op de lijst een veilige plek om te slepen.

Doel: tikken blijft snel en eenhandig, maar raakt alleen wie je bedoelt, en de lijst scrollt overal zoals een gewone lijst.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verticaal scrollen over de lijst werkt overal, ook met de vinger op een rij, zonder dat er een streepje of BAK geboekt wordt
- [x] #2 Het tikgebied van een rij is een duidelijk afgebakende knop, niet de volle rij; de naamzone doet niets
- [x] #3 Een sleep/scroll die op de tikknop begint annuleert de tik en de vasthoud-timer
- [x] #4 TIK = +1 en VASTHOUDEN = BAK (en hun gomstand-varianten) blijven ongewijzigd werken, incl. de voortgangsbalk
- [x] #5 Het Welkomstrondje toont hetzelfde gebaar als de echte lijst
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Oorzaak 1 (scrollen): elke rij zette touch-action: none, dus de browser kreeg de verticale pan nergens op de lijst. Nu staat alleen de tikknop op pan-y; de rij zelf laat touch-action ongemoeid.
Oorzaak 2 (misstreepjes): de volle rij was het tikgebied, met 1px tussen de rijen. Het tikgebied is nu een afgebakende knop rechts in de rij (het streepjes-blok, met een + / – ring erbij); de naamzone ernaast doet niets meer en dient als sleepgreep.
Extra: een pointermove van meer dan SLEEP_PX (10px, gedeeld via tally.tsx) annuleert tik en vasthoud-timer, voor muis/pen en de trage aanzet waar de browser nog geen pointercancel gestuurd heeft.
Rondje.tsx kreeg dezelfde knop zodat het Welkomstrondje hetzelfde gebaar aanleert; de demo-hint zegt nu 'tik op de knop hierboven'.
Tests: Lijst.test.tsx mikt op [data-tap] i.p.v. de rij, plus een nieuwe TASK-17-test (naamzone boekt niets, touch-action pan-y/leeg, sleep annuleert tik en BAK-lade, echte tik boekt wel). De '+' van de BAK-lade werd scoped met within() nu de knop ook een '+' toont.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tikgebied op de lijst verkleind van de volle rij naar een afgebakende knop rechts (data-tap) en touch-action: none vervangen door pan-y op die knop, met een 10px-sleepdrempel die de tik annuleert. Daarmee boekt een duim die naast de bedoelde rij landt niets meer en kan er overal op de lijst gescrold worden. Welkomstrondje mee aangepast. Geverifieerd met npm test (167 tests, 16 files groen, incl. nieuwe TASK-17-test) en npm run build.
<!-- SECTION:FINAL_SUMMARY:END -->
