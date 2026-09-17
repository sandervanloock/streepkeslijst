---
id: TASK-13
title: 'Build the ''Meldingen'' screen: a generic notification feed with call-to-action'
status: Done
assignee:
  - '@sander.vanloock@lab900.com'
created_date: '2026-09-16 20:46'
updated_date: '2026-09-17 07:14'
labels: []
dependencies: []
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Het menu heeft al een Meldingen-item en route.ts al de #/meldingen slug, maar er is geen scherm en geen meldingen-model. Dit bouwt de generieke basis: meldingen leven als documenten in Firestore, elk met een soort, een tekst en optioneel een call-to-action die naar een bestaand scherm springt. De eerste (en in deze task enige) melding is "periode afgesloten": iedereen met een openstaand bedrag krijgt na het afsluiten een melding met knop "Betalen" naar #/betalen.

Waarom generiek: de volgende meldingen (iemand streept voor mij, betaling gemeld, herinnering) mogen daarna puur data zijn, geen nieuw scherm en geen nieuwe render-code. Waarom nu: TASK-8 sluit een periode af en TASK-9 laat iedereen betalen, maar niemand weet dat de periode dicht is tenzij hij toevallig de app opent en het zelf ziet.

Levering blijft in-app (feed + badge). Echte push-notificaties zijn bewust een aparte task, zie de dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Een opgeslagen melding is een document in users/{uid}/notifications/{id} met: kind, text, meta, at en een optionele action (label + bestaand scherm uit route.ts) — de ontvanger zit in het pad, niet in een veld. Veldnamen en collectienamen zijn Engels, de zichtbare copy blijft Nederlands
- [x] #2 Het Meldingen-scherm rendert elke melding vanuit die data: soort-label, tekst, meta-regel, relatieve tijd, en de actieknop als er een action is — er staat geen per-kind if-else in de render
- [x] #3 De feed werkt op een gewoon in-memory meldingstype, niet op een Firestore-snapshot, zodat TASK-15 er afgeleide meldingen in kan mengen zonder de renderer aan te raken
- [x] #4 Op de actieknop tikken navigeert naar het scherm uit de action
- [x] #5 Gelezen-status is één readAt-tijdstempel op users/{uid}: ongelezen = at later dan readAt. Het Meldingen-scherm openen en "alles gelezen" zetten die tijdstempel op nu
- [x] #6 Het menu-item Meldingen toont een badge met het aantal ongelezen meldingen, en geen badge op nul
- [x] #7 Bij het afsluiten van een periode (Afsluiten.tsx) krijgt elk niet-gast-lid een melding van kind "period-closed" met action naar Betalen; die melding wordt pas zichtbaar vanaf de dag na de laatste dag van de periode — precies wanneer Betalen de rekening toont — en niet op het moment van afsluiten
- [x] #8 De melding bevriest geen bedrag of streepjesaantal in zijn tekst: tot de laatste dag voorbij is kan er nog gestreept worden, het bedrag blijft afgeleid op Betalen
- [x] #9 Firestore rules: je leest alleen je eigen notifications (het pad dwingt dat af), aanmaken kan alleen drankleider/beheerder, en niemand kan een bestaande melding wijzigen of verwijderen
- [x] #10 Tests dekken: het afsluiten schrijft de juiste notifications met de juiste zichtbaarheidsdatum, de feed rendert een verzonnen kind met action zonder codewijziging, en de ongelezen-telling volgt readAt
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**Naamgeving:** Firestore-structuren (collecties en velden) zijn Engels, de zichtbare copy en de componentnamen blijven Nederlands — zoals `users`/`periods`/`entries` dat al zijn.

**Twee uitgangspunten die het ontwerp sturen:**

- Een periode sluit *op datum*, niet op de klik. `Afsluiten` zet alleen `eind`/`eindAt`; `Betalen.tsx:193` toont de rekening pas bij `p.eind < vandaag`, `actievePeriode` houdt een periode met een toekomstige `eind` gewoon live, en `binnenPeriode()` laat strepen toe tot `eindAt + 1 dag`. Een melding die meteen bij de klik zichtbaar wordt, liegt dus. Daarom: schrijven bij de klik (atomair), zichtbaar vanaf `dagNa(eind)`.
- De feed moet later afgeleide meldingen kunnen bevatten (TASK-15, "voor jou gezet" uit de entry-ledger). Daarom rendert hij op een gewoon in-memory type, en is gelezen-status één tijdstempel in plaats van een bit per document — een afgeleide melding heeft geen document om een bit op te zetten.

1. **Datamodel** — `users/{uid}/notifications/{autoId}`: `{ kind: string, text: string, meta: string, at: Timestamp, action?: { label: string, screen: string } }`. Een subcollectie, geen top-level collectie met een `for`-veld: het pad *is* de autorisatie, dus geen veldvergelijking in de rules en geen verplichte `where`-filter die je kan vergeten (vergeten = de hele listen faalt). `action.screen` is een label uit route.ts (bv. "Betalen"), zodat aantikken gewoon `setScherm(action.screen)` is. Geen `read`-veld op het document: zie punt 3.
   - **`at` mag in de toekomst liggen.** Voor de meeste kinds is `at` = `serverTimestamp()`; voor `period-closed` is het `dagNa(eind)` — hetzelfde moment waarop Betalen de rekening toont. Geen apart `visibleFrom`-veld: `at` is al het sorteerveld, dus één filter `at <= nu` dekt zichtbaarheid én volgorde, en werkt voor elke latere kind die vooruit gepland wil worden.

2. **data.ts**
   - `export type Melding = { id: string; kind: string; text: string; meta: string; at: Date; action?: { label: string; screen: string } }` — een plat type, geen Firestore-snapshot (AC3). TASK-15 produceert straks dezelfde vorm uit de entries en concat gewoon.
   - `useMeldingen(uid)`: één `onSnapshot` op `collection(db, "users", uid, "notifications")`, gemapt naar `Melding`, gefilterd op `at <= nu` en gesorteerd op `at` aflopend. `ponytail:` filteren/sorteren in JS i.p.v. in de query — het zijn hooguit een paar tientallen docs, en het scheelt een index.
   - `markGelezen(uid)`: `setDoc(users/{uid}, { readAt: serverTimestamp() }, { merge: true })`.
   - `useProfile` breidt uit met `readAt: Date | undefined` (ontbrekend = alles ongelezen, net als `rondje: false` in TASK-12).

3. **Gelezen-status: één `readAt` op `users/{uid}`** — ongelezen = `melding.at > readAt`. Dat is ook precies het model van de design zelf (daar is `gelezen` één boolean en zet `allesGelezen`/het scherm openen hem om, regels 1729-1731). Gevolg: notification-documenten zijn read-only voor de ontvanger, de hele `update`-rule valt weg, en afgeleide meldingen tellen straks vanzelf mee in de badge.

4. **Fanout bij afsluiten** — `sluitPeriode` krijgt er één parameter bij: `ontvangers: string[]` (uids), en zet per ontvanger een `doc(collection(db, "users", uid, "notifications"))` in **dezelfde writeBatch** als `eind`/`eindAt` en de nieuwe periode. Atomair: geen periode zonder meldingen, geen meldingen zonder afsluiting.
   - **Iedereen krijgt er een, niet alleen wie openstaat.** Wie bij de klik EUR 0 heeft, kan er de laatste dagen nog bijstrepen — filteren op bedrag zou juist die persoon de melding onthouden. Betalen zegt zelf al "Niets openstaand" voor wie niets heeft. Gasten krijgen niets (ze loggen niet in; hun rekening loopt via Inningen).
   - **Geen bevroren getallen in de tekst** (AC8): `kind: "period-closed"`, text = `Periode {nr} is afgesloten. Je kan nu overschrijven.`, meta = `Op de rekening van de groep · je bedrag staat klaar op Betalen`, action = `{ label: "Naar je betaling", screen: "Betalen" }`.
   - De copy wordt in data.ts gebouwd — één plek die de vorm van een melding kent. `Afsluiten.tsx` levert alleen `people.filter(p => !p.isGuest).map(p => p.id)`.
   - Batchlimiet 500 is geen risico bij een Chiro-groep; wel een `ponytail:`-comment.

5. **`src/Meldingen.tsx`** — port van de design (`design/Streepkeslijst App.dc.html` regels 737-790). Rendert puur uit `Melding[]`: kind-label, text, meta, relatieve tijd, en de actieknop als `action` bestaat. Eén lookup-tabel `kleurVanKind: Record<string, string>` met fallback op `paper` — een onbekende kind rendert gewoon, geen if-else per kind in de markup. Groeperen op dag uit `at` (VANDAAG / GISTEREN / EERDER) in plaats van de hand-geschreven `meldGroepen`-koppen van de design.
   - Kop met "alles gelezen"-link en de wacht-chip (`n wachten op jou` / `niets wacht op jou`), waarbij "wachtend" = ongelezen mét action.
   - Ongelezen krijgt de getinte achtergrond, gelezen het gewone kaartje.
   - Props: `{ meldingen: Melding[]; readAt?: Date; onGa: (scherm: string) => void; onAllesGelezen: () => void }` — navigatie blijft bij Lijst.tsx, zoals bij elk ander scherm.

6. **`Lijst.tsx`** — `useMeldingen(user.uid)` erbij (`readAt` komt uit de bestaande `useProfile`), `Meldingen` in de scherm-switch (`open === "Meldingen"`), en de badge in het menu: het `alleNav`-item krijgt optioneel een `badge`-getal, gerenderd naast het bestaande rol-chipje. Het scherm openen roept `markGelezen(user.uid)` aan (design regel 1729), net als de actieknop vóór hij navigeert.

7. **`firestore.rules`**
   ```
   match /users/{uid}/notifications/{id} {
     allow read: if request.auth.uid == uid;
     allow create: if isDrankleider();
     allow update, delete: if false;
   }
   ```
   Het pad dwingt de ontvanger af; aanmaken kan enkel drankleider/beheerder; niemand herschrijft een melding achteraf. `readAt` valt onder de bestaande `users/{uid}` update-regel (je eigen doc). De zichtbaarheidsdatum wordt bewust *niet* in de rules afgedwongen: het is geen geheim, alleen ruis — wie devtools opent ziet dat zijn periode afgesloten is, wat op Betalen sowieso al staat (`ponytail:`-comment).

8. **Tests**
   - `data.test.ts`: `sluitPeriode` schrijft één notification per niet-gast-lid op `users/{uid}/notifications`, met `at` = `dagNa(eind)` en zonder bedrag in de text; `markGelezen` merget `readAt`; `useMeldingen` verbergt een melding met `at` in de toekomst en sorteert aflopend.
   - `Meldingen.test.tsx`: een verzonnen kind (`kind: "something-new"`) mét action rendert en navigeert zonder codewijziging (AC2/AC3 hard maken); een melding zonder action toont geen knop; ongelezen/gelezen volgt `readAt`.
   - `Lijst.test.tsx`: badge toont het aantal ongelezen, verdwijnt op nul en na het openen van het scherm.
   - `firestore.rules.test.ts`: andermans notification lezen faalt; een lid dat er een aanmaakt faalt; wijzigen of verwijderen faalt voor iedereen.
   - `npm test` en `npm run build` (die is ook de typecheck).

**Voor TASK-14 (push):** een Cloud Function op `onCreate` zou hier te vroeg pushen — de doc bestaat al bij de klik, de melding geldt pas vanaf `at`. Die task moet op `at` plannen (Cloud Tasks / scheduled function) of dagelijks draaien. En een afgeleide melding (TASK-15) heeft helemaal geen doc om op te triggeren.

**Buiten scope, bewust:** push (TASK-14), afgeleide meldingen (TASK-15), meldingsvoorkeuren ("Instellen wat je wil horen" uit de design), en alle andere kinds (por, nieuw in de groep) — die zijn na deze task pure data.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Geverifieerd met npm test (15 bestanden, 146 tests groen), npm run build (tsc -b + vite build, geen typefouten) en npm run test:rules tegen de Firestore-emulator (20 tests groen, inclusief de twee nieuwe TASK-13-rules-tests).

Bewijs per stuk:
- AC1/AC7/AC8: data.test.ts "sluitPeriode meldt elke ontvanger in dezelfde batch" — controleert de paden users/{uid}/notifications, at = TS:2026-09-01 (dagNa van de laatste dag 2026-08-31, niet de klikdatum) en dat er geen euro of bedrag in de payload voorkomt. Afsluiten.test.tsx controleert dat de ontvangerslijst ["u1","u2"] is: de gast valt eruit.
- AC2/AC4/AC10: Meldingen.test.tsx "een verzonnen kind met actie rendert en navigeert zonder codewijziging" — kind "something-new" rendert als "Something new" en de knop roept onGa("Inningen") aan, zonder dat Meldingen.tsx die kind kent.
- AC3: Meldingen.test.tsx mockt Firestore helemaal niet; het scherm krijgt een plat Melding[] binnen. Dat is de naad waar TASK-15 op inprikt.
- AC5/AC6: Lijst.test.tsx "het menu telt de ongelezen meldingen, en dooft de badge zodra je ze opent" — badge 2, na het openen van Meldingen weg. data.test.ts dekt markGelezen (readAt merge op users/{uid}) en useMeldingen (toekomstige at blijft weg, aflopend gesorteerd).
- AC9: firestore.rules.test.ts, twee tests — andermans feed lezen faalt (ook voor een drankleider), een lid dat voor een ander aanmaakt faalt, en update/delete faalt voor iedereen inclusief de ontvanger, terwijl readAt op het eigen user-doc wel lukt.

Twee afwijkingen van het plan, beide bewust:
1. dagLabel rekent lokaal, niet in UTC zoals het plan suggereerde via dagNa. Voor kale datums (periodegrenzen) is UTC juist, maar "is dit vandaag" gaat over de klok van het toestel: in de zomer loopt België twee uur voor, en alles na 22:00 zou als gisteren lezen. period.test.ts dekt de grens.
2. De tijd op een melding toont het klokuur (design line 1777: "21:38") voor vandaag en gisteren, en dd/mm daarvoor — niet het woord VANDAAG, want dat staat al op de dagkop erboven.

Na handmatige validatie op develop: het afsluiten gaf permission-denied (Afsluiten.tsx:91) omdat de nieuwe rules nog niet gedeployd waren. Oorzaak is structureel de moeite om te onthouden: subcollecties erven niets van hun parent, dus users/{uid}/notifications had zonder het nieuwe match-blok helemaal geen regel, en default-deny gooide de hele writeBatch om — de afsluiting incluis. Opgelost door `firebase deploy --only firestore:rules` (ci.yml deployt alleen hosting).

Daarbij useMeldingen gehard met een onSnapshot-errorcallback: een geweigerde listen liet een onafgehandelde fout in de console achter in plaats van terug te vallen op een lege feed. Meldingen zijn niet het soort data waar de rest van de app op mag blijven hangen. Gedekt door data.test.ts "een geweigerde listen laat de feed leeg in plaats van de app om te trekken".
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @sander.vanloock@lab900.com
created: 2026-09-17 05:26
---
TASK-15 gaat niet meer afleiden: die melding wordt een gewoon opgeslagen document met een niet-exacte tekst en een action naar het nieuwe Logboek-scherm (TASK-16). AC3 hier (de feed rendert op een gewoon in-memory type, niet op een snapshot) blijft gewoon staan — het is nog steeds de juiste vorm — maar de motivatie 'zodat TASK-15 er afgeleide meldingen in kan mengen' is vervallen. Idem voor readAt: dat blijft één tijdstempel, alleen niet meer omdat een afgeleide melding geen document heeft.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Meldingen-scherm gebouwd met een generiek meldingsmodel, en de eerste soort erop: "periode afgesloten".

Opgeslagen meldingen leven in users/{uid}/notifications — een subcollectie, zodat het pad de autorisatie is en er geen vergeetbare where-filter of veldvergelijking aan te pas komt. Velden zijn Engels (kind/text/meta/at/action), de copy blijft Nederlands. De feed rendert op een plat Melding-type, niet op een Firestore-snapshot, met lookup-tabellen met fallback in plaats van een if-else per kind: een kind die het scherm nooit gezien heeft rendert en navigeert gewoon. Dat is de naad waar TASK-15 zijn afgeleide meldingen op inprikt.

Twee dingen die eruitzien als een bug maar het niet zijn. Een melding-at mag in de toekomst liggen: een periode sluit op datum, niet op de klik, dus de period-closed-melding wordt atomair in sluitPeriodes batch geschreven maar krijgt at = dagNa(eind) — hetzelfde moment waarop Betalen de rekening toont — en de feed filtert at <= nu. En iedereen die geen gast is krijgt er een, niet alleen wie op dat moment openstaat: wie bij de klik op nul staat kan de laatste dagen nog bijstrepen. Er staat om diezelfde reden geen bedrag in de tekst.

Gelezen-status is één readAt-tijdstempel op users/{uid} in plaats van een bit per document. Daardoor zijn meldingen read-only voor de ontvanger (update/delete: if false) en tellen de documentloze meldingen van TASK-15 straks vanzelf mee in de badge.

Geverifieerd met npm test (146 tests), npm run build en npm run test:rules tegen de emulator (20 tests). Zie de implementation notes voor het bewijs per acceptatiecriterium.
<!-- SECTION:FINAL_SUMMARY:END -->
