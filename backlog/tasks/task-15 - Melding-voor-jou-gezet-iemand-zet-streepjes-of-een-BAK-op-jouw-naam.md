---
id: TASK-15
title: 'Melding ''voor jou gestreept'': iemand zet streepjes of een BAK op jouw naam'
status: To Do
assignee: []
created_date: '2026-09-16 21:03'
updated_date: '2026-09-17 16:39'
labels: []
dependencies:
  - TASK-13
  - TASK-16
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Iedereen mag strepen voor iemand anders, en dat moet controleerbaar blijven — dat is de kern van de streepjeslijst. Vandaag ziet de ontvanger alleen een snackbar als hij toevallig de app open heeft; wie later kijkt, ziet nooit dat er voor hem gestreept is. Deze task zet dat in de Meldingen-feed van TASK-13, met een knop naar het Logboek van TASK-16.

**De melding is opgeslagen, niet afgeleid, en haar tekst noemt geen aantallen.** Dat is één beslissing met twee helften:

- Geen afgeleide melding. Een melding die bij elke render uit de entry-ledger herberekend wordt, betekent dat elk scherm dat de feed toont de hele ledger moet streamen, en dat de badge-telling van een gewone melding anders werkt dan die van deze. De feed van TASK-13 blijft wat hij is: documenten.
- Geen exacte tekst. Precies omdat ze opgeslagen is, mag de tekst niet bevriezen wat nog kan veranderen. '3 streepjes' wordt een leugen zodra er een vierde bijkomt of er eentje geschrapt wordt. Dus: 'Fien zette streepjes op jouw naam' — waar op het moment van schrijven, en waar gebleven na elke tik en elke undo. Wie het exacte aantal wil, tikt de knop en staat één klik later in het Logboek, waar het klopt omdat het daar wél live afgeleid is. Zelfde reden waarom de period-closed-melding van TASK-13 geen bedrag noemt.

**Eén melding per dag per streper per ontvanger.** De streper schrijft ze zelf, met een voorspelbare document-id die de dag en zijn uid bevat. De tweede tik van dezelfde persoon op dezelfde avond botst dus op een bestaand document, faalt, en die fout wordt genegeerd — geen tweede melding, geen extra write die de feed volspamt, geen aggregatie-code. De daggrens ligt op 06:00 lokale tijd, dezelfde grens als het Logboek: streepjes van 23:50 en 00:10 tijdens dezelfde fuif horen bij dezelfde avond.

**Rules.** Dit is de enige melding die een gewoon lid mag aanmaken, en dat is een misbruikkanaal dat dichtgetimmerd moet worden: de rules staan een create alleen toe voor deze ene kind, met een tekst die de app bouwt en de rules nakijken, met de schrijver in het document, en met een document-id die bij die schrijver en die dag hoort. Een lid kan dus hoogstens iemand een melding sturen die zegt dat hij voor hem gestreept heeft — wat hij net zo goed echt kan doen, en wat dan sowieso in het logboek staat. Willekeurige tekst naar willekeurige mensen sturen kan niet.

Als dat bij het implementeren toch niet strak genoeg te maken blijkt, is het alternatief een Cloud Function op entry-create die de melding schrijft en de create-rule voor leden dicht laat. Dat is zwaarder, maar het maakt deze soort meteen ook pushbaar in TASK-14 — wat met een client-write niet lukt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Wie streepjes of een BAK op de naam van iemand anders zet, veroorzaakt een melding in de feed van die persoon
- [ ] #2 De meldingstekst noemt geen aantal en geen bedrag: ze zegt wie er streepte en dat het op jouw naam staat, en blijft daardoor waar na een extra tik of een undo
- [ ] #3 De melding heeft een actieknop naar Mijn logboek, waar het exacte aantal en het tijdstip wel staan
- [ ] #4 Meerdere tikken van dezelfde persoon op dezelfde avond geven één melding; twee verschillende strepers op dezelfde avond geven twee aparte meldingen
- [ ] #5 Wat je zelf op je eigen naam zet geeft geen melding
- [ ] #6 De daggrens ligt op 06:00 lokale tijd: 05:59 hoort nog bij de vorige avond, 06:00 begint een nieuwe, en beide randen zijn getest
- [ ] #7 De melding gebruikt het bestaande meldingstype en de bestaande renderer van TASK-13: geen nieuw scherm, geen per-kind if-else in de render, en ze telt mee in de ongelezen-badge
- [ ] #8 Firestore rules: een lid kan enkel deze ene kind aanmaken, enkel met zichzelf als schrijver en enkel met de tekst die bij die schrijver hoort; willekeurige tekst of een andere kind aanmaken faalt, en wijzigen of verwijderen faalt voor iedereen
- [ ] #9 Strepen kost hoogstens één extra write per streper per ontvanger per avond, niet één per tik
- [ ] #10 Tests dekken: de eerste tik schrijft een melding, de tweede niet, eigen streepjes schrijven er geen, de daggrens op 05:59/06:00, en de rules-regels hierboven
<!-- AC:END -->
