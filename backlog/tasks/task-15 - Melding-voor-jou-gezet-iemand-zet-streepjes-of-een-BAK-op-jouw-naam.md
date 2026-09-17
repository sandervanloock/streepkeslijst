---
id: TASK-15
title: 'Melding ''voor jou gestreept'': iemand zet streepjes of een BAK op jouw naam'
status: Done
assignee:
  - '@sander.vanloock'
created_date: '2026-09-16 21:03'
updated_date: '2026-09-17 18:20'
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
- [x] #1 Wie streepjes of een BAK op de naam van iemand anders zet, veroorzaakt een melding in de feed van die persoon
- [x] #2 De meldingstekst noemt geen aantal en geen bedrag: ze zegt wie er streepte en dat het op jouw naam staat, en blijft daardoor waar na een extra tik of een undo
- [x] #3 De melding heeft een actieknop naar Mijn logboek, waar het exacte aantal en het tijdstip wel staan
- [x] #4 Meerdere tikken van dezelfde persoon op dezelfde avond geven één melding; twee verschillende strepers op dezelfde avond geven twee aparte meldingen
- [x] #5 Wat je zelf op je eigen naam zet geeft geen melding
- [x] #6 De daggrens ligt op 06:00 lokale tijd: 05:59 hoort nog bij de vorige avond, 06:00 begint een nieuwe, en beide randen zijn getest
- [x] #7 De melding gebruikt het bestaande meldingstype en de bestaande renderer van TASK-13: geen nieuw scherm, geen per-kind if-else in de render, en ze telt mee in de ongelezen-badge
- [x] #8 Firestore rules: een lid kan enkel deze ene kind aanmaken, enkel met zichzelf als schrijver en enkel met de tekst die bij die schrijver hoort; willekeurige tekst of een andere kind aanmaken faalt, en wijzigen of verwijderen faalt voor iedereen
- [x] #9 Strepen kost hoogstens één extra write per streper per ontvanger per avond, niet één per tik
- [x] #10 Tests dekken: de eerste tik schrijft een melding, de tweede niet, eigen streepjes schrijven er geen, de daggrens op 05:59/06:00, en de rules-regels hierboven
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. period.ts — geen nieuwe daggrens-code: fuifDag() bestaat al (TASK-16) en is al getest op 23:50/00:10/05:59/06:00. Voeg alleen `meldingId(byUid, at)` toe: `'voor-jou-' + fuifDag(at) + '-' + byUid`. Puur, dus de 05:59/06:00-rand van AC6 wordt op de id zelf getest, niet op een render.

2. data.ts — schrijven zit in writeEntry(), niet op de call-sites. addStreep/addBak/removeOne lopen er alle drie door, dus één plek dekt streepjes, BAK en schrappen, en Lijst.tsx verandert niet. Na de entry-write, fire-and-forget:
   - skip als personRef === 'user:' + byUid (AC5) of als het geen 'user:'-ref is (een gast heeft geen feed).
   - `setDoc(doc(db,'users',uid,'notifications', meldingId(byUid, new Date())), {kind:'voor-jou', text: `${byNick} zette streepjes op jouw naam`, meta:<vaste zin>, at: serverTimestamp(), action:{label:'Naar mijn logboek', screen:'Mijn logboek'}}).catch(() => {})`.
   - De tweede tik is een update op een bestaand document en `allow update: if false` laat die falen — dát is de dedup (AC4), geen aggregatie-code, geen read-before-write. De catch slikt de denial.
   - AC9: een in-memory Set van al geschreven ids in data.ts, zodat een herhaalde tik binnen dezelfde sessie niet eens een mislukte write stuurt. Nieuwe tab = hoogstens één extra mislukte write.
   - Tekst noemt geen aantal (AC2), ook niet voor een BAK of een schrapping: het logboek heeft de details, de melding niet. Eén vaste zin = één string die de rules kunnen nakijken.

3. Meldingen.tsx — alleen twee lookup-tabel-regels erbij: `kleurVanKind['voor-jou']` en `labelVanKind['voor-jou'] = 'Voor jou gestreept'`. Geen if-else, geen nieuw scherm, geen nieuw type (AC7). De ongelezen-badge en de actieknop werken al generiek; 'Mijn logboek' is een bestaande route-key (route.ts).

4. firestore.rules — users/{uid}/notifications/{id} krijgt een tweede create-arm naast isDrankleider():
   `isMember() && request.resource.data.kind == 'voor-jou' && request.resource.data.text == get(/users/$(request.auth.uid)).data.nick + ' zette streepjes op jouw naam' && request.resource.data.meta == <vaste zin> && request.resource.data.at == request.time && id.matches('^voor-jou-[0-9]{4}-[0-9]{2}-[0-9]{2}-' + request.auth.uid + '$')`
   update/delete blijven false voor iedereen, dus de dedup uit stap 2 blijft afgedwongen. Willekeurige tekst, een andere kind, of een id met andermans uid faalt (AC8).
   ponytail: het datumdeel van de id wordt op vorm gecontroleerd, niet tegen request.time — de lokale 06:00-grens is in rules niet na te rekenen. Plafond: een lid met devtools kan één melding per verzonnen datum schrijven, altijd met zijn eigen naam erin. Als dat te los blijkt, is de upgrade de Cloud Function uit de beschrijving (die maakt deze soort meteen ook pushbaar voor TASK-14).

5. Tests:
   - period.test.ts: meldingId op 05:59 en 06:00 van dezelfde nacht geeft dezelfde id, 06:00 een nieuwe (AC6); twee uids geven twee ids (AC4).
   - data.test.ts: addStreep voor iemand anders schrijft één notification-doc op het juiste pad; addStreep op je eigen ref schrijft er geen (AC5); tweede tik stuurt geen tweede write (AC9); een falende write laat de entry-write intact.
   - firestore.rules.test.ts: lid schrijft de eigen melding met eigen nick (succes); zelfde met verzonnen tekst, met kind 'period-closed', met andermans uid in de id (allemaal falen); tweede setDoc op dezelfde id faalt; update/delete falen (AC8, AC10).
   - Rules-tests draaien op de emulator (`npm run test:rules`), unit-tests op `npm test`, build = typecheck.

6. Geen migratie: bestaande meldingen hebben een andere kind en worden niet aangeraakt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan: period.ts's meldingId(byUid, at); data.ts's writeEntry fires setDoc on users/{uid}/notifications after the entry write (skips own-ref and non-'user:' refs), with an in-memory Set keyed by RECIPIENT+meldingId (a bug in an earlier draft keyed by meldingId alone, which would drop a second recipient's melding the same evening — caught in course-correction, fixed, and covered by a dedicated test); Meldingen.tsx got two lookup-table lines for kind 'voor-jou'; firestore.rules added a second create arm on notifications for isMember() with the fixed text/meta, at==request.time, and an id-shape regex pinning the writer's own uid. Tests: period.test.ts (meldingId dedup across the 05:59/06:00 boundary, two strepers = two ids), data.test.ts (one melding per streep-for-someone-else, none for own ref, none for a guest, no second write same evening, a second recipient DOES get a melding, a denied write leaves the entry write intact), firestore.rules.test.ts (own melding succeeds, forged text/meta/kind/id fail, a second setDoc on the same id fails, update/delete fail for writer and recipient). npm test: 165 passed. npm run build: clean. npm run test:rules: 24 passed on the real emulator (sandbox disabled to bind the emulator ports, per repo convention).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Melding 'voor jou gestreept' is a stored document (kind 'voor-jou'), written by data.ts's writeEntry right after the entry write (addStreep/addBak/removeOne all route through it, Lijst.tsx unchanged). period.ts's meldingId(byUid, at) = 'voor-jou-' + fuifDag(at) + '-' + byUid gives the predictable per-streper-per-avond id; a second tap the same evening collides on that id and firestore.rules' allow update: if false denies the overwrite — that denial is the whole dedup, no aggregation code. The text is one fixed sentence per streper's own nick, no counts, so it never goes stale after a further tap or an undo; the action button points at the existing 'Mijn logboek' route. Meldingen.tsx got two lookup-table lines (colour, label) for the new kind, no new if-else, no new screen — the unread badge and action rendering are already kind-agnostic (proven by the pre-existing AC10 generic-kind test). firestore.rules adds one create arm to users/{uid}/notifications for isMember(), locked to the caller's own nick-derived text, the fixed meta, at==request.time, and an id-shape regex pinning the caller's own uid — a member can create only their own truthful 'I struck for you' claim, nothing else. Known accepted ceiling (documented with a ponytail comment in firestore.rules): the id's date segment is shape-checked, not verified against request.time, since rules cannot recompute the local 06:00 fuif-day boundary. Verified: npm test - 166/166 unit tests pass, incl. period.test.ts's meldingId dedup at the 05:59/06:00 boundary and cross-streper uniqueness, data.test.ts's notification-write behaviour (one melding for a streep-on-someone-else, none for own ref, none for a guest, no second write the same evening, a second recipient still gets one, a denied write leaves the entry write intact), and Meldingen.test.tsx's kind-specific render. npm run build passes clean (tsc -b && vite build). npm run test:rules passes 24/24 against the real Firestore emulator (sandbox disabled to bind the emulator ports — network binding is blocked inside the sandbox by design), including the new member-create success/failure matrix and the same-id second-setDoc denial. Course correction mid-task: an earlier draft keyed the in-memory anti-spam Set by meldingId alone (streper+day only), which would have silently dropped a second recipient's melding the same evening; fixed to key by recipient+meldingId, with a dedicated test guarding the fix.
<!-- SECTION:FINAL_SUMMARY:END -->
