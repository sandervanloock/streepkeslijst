---
id: TASK-16
title: >-
  Build the 'Logboek' screen: jouw boekingen van de periode, per dag, met wie ze
  zette
status: Done
assignee:
  - '@sander.vanloock@lab900.com'
created_date: '2026-09-17 05:26'
updated_date: '2026-09-17 17:00'
labels: []
dependencies: []
documentation:
  - design/Streepkeslijst App.dc.html
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Strepen voor iemand anders mag, maar alleen als het controleerbaar blijft — dat is de kern van de streepjeslijst. Vandaag is de entry-ledger (periods/{id}/entries) er wel, maar niemand kan hem zien: de lijst toont enkel het totaal per persoon. Wie wil weten waar zijn 23 streepjes vandaan komen, kan dat nergens nakijken.

Dit bouwt het Logboek-scherm uit de design (design/'Streepkeslijst App.dc.html': markup regel 131-187, afleiding regel 1336-1391, menu-item regel 1766). Het is een read-only scherm bovenop useEntries — geen nieuw datamodel, geen extra writes, geen rules-wijziging.

**Enkel je eigen logboek.** De design heeft ook een heel-de-lijst-modus; die valt hier weg. Het scherm bestaat om één vraag te beantwoorden — waar komen mijn streepjes vandaan, en wie zette ze — en daar heb je andermans boekingen niet voor nodig. Dat scheelt de modus-schakelaar, de kolom 'voor wie', en de vraag of het wel gezond is om elkaars gedrag te kunnen doorbladeren.

Per dag een kop met het netto saldo, daaronder per uur samengevoegde regels: tijdstip, +n of -n, en wie het zette. Zelf gezet is grijs, door iemand anders is paars — het hele punt van het scherm is dat je in één oogopslag ziet wat er voor jou gezet is.

Let op het verschil met de design: wij hebben geen aparte 'schrapStreep'-soort, een schrapping is een entry met negatieve delta, en een undo verwijdert het document. Een undo hoort dus gewoon uit het logboek te verdwijnen; een schrapping blijft staan als -1.

Dit scherm is ook de bestemming van meldingen: TASK-15 stuurt 'er is voor jou gestreept' hierheen in plaats van het exacte aantal in de meldingstekst te zetten.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Het scherm toont enkel de boekingen op jouw eigen naam: geen modus-schakelaar, geen kolom 'voor wie', en geen weg naar andermans logboek
- [x] #2 Boekingen staan gegroepeerd per dag, nieuwste dag eerst, met per dag een kop en een meta-regel met het netto aantal streepjes en het aantal BAKKEN van die dag
- [x] #3 Binnen een dag worden boekingen van dezelfde streper en dezelfde soort in hetzelfde uur tot één regel samengevoegd, met 'n keer dit uur' in de meta zodra het er meer dan één is
- [x] #4 Elke regel toont het uur, +n of -n, de soort (BAK-label, GESCHRAPT-label bij een negatieve delta) en wie het zette: 'zelf gezet' of 'door X', waarbij een boeking door iemand anders visueel opvalt
- [x] #5 Er staan geen tellers of samenvattingen bovenaan het scherm: enkel de kop en daaronder het logboek per dag
- [x] #6 Een periode zonder boekingen op jouw naam toont de lege staat in plaats van een lege lijst
- [x] #7 Het scherm schrijft niets: geen extra Firestore-writes en geen wijziging aan firestore.rules
- [x] #8 De groepering en samenvoeging zitten in een pure functie met tests: groeperen per dag, samenvoegen per uur/streper/soort, en het netto saldo per dag inclusief negatieve deltas
- [x] #9 De daggrens ligt op 06:00 lokale tijd, niet op middernacht: boekingen van 23:50 en 00:10 tijdens dezelfde fuif vallen onder dezelfde dagkop, getest op 05:59 en 06:00
- [x] #10 Het Logboek is een eigen scherm met een eigen hash-slug in route.ts, bereikbaar via het menu-item 'Mijn logboek'; dat menu-item krijgt geen subregel — het menu blijft enkel labels
- [x] #11 Een geschrapte BAK toont twee labels naast elkaar, BAK en GESCHRAPT, niet enkel GESCHRAPT
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**Naamgeving:** Firestore blijft Engels (`entries`, `at`, `by`, `byNick`), de zichtbare copy en de componentnaam Nederlands — zoals de rest van de app.

**Twee dingen uit de design vallen weg, bewust:** de heel-de-lijst-modus (je ziet enkel je eigen boekingen, zie de beschrijving) en de tellerstrook bovenaan (design regel 144-148). Wat overblijft is één lijst per dag. De LOGBOEK-link op een opengeklapte rij (design regel 109) vervalt daarmee ook: wij hebben geen opengeklapte rij, en er is nu niets meer om naartoe te linken.

1. **`period.ts` — de data die er al is, maar niet getypeerd** — de entry-documenten hebben al `at`, `by` en `byNick` (data.ts's `writeEntry`), alleen kent het `Entry`-type ze niet: `totals()` had ze nooit nodig. Voeg ze toe aan `Entry` en laat `useEntries` `at` mappen naar een `Date` (`d.data().at?.toDate() ?? new Date()`) — een `serverTimestamp()` is lokaal nog `null` tot de server bevestigt, en dan is 'nu' precies goed. Geen rules-wijziging: wie de ledger al mag lezen, leest deze velden al mee.

2. **`period.ts` — `logboek(entries, personRef)`, de pure functie (AC9)**
   - `fuifDag(at)`: de dag waar een moment bij hoort, met de grens op 06:00 lokale tijd — `at` zes uur terugschuiven en dan de lokale datum nemen. Lokale tijd zoals `dagLabel`, niet UTC zoals `dagNa`: 'welke fuif was dit' is een vraag over de klok van de telefoon in je hand.
   - Filteren op `personRef` (verplicht, altijd jezelf), dan groeperen op `fuifDag`, aflopend. Binnen een dag samenvoegen op `uur|by|kind|teken van delta` (AC4) — het teken erbij, anders vallen een streep en een schrapping in hetzelfde uur tegen elkaar weg tot één regel die niets zegt. `n` = som van de deltas, `keer` = aantal entries.
   - Per dag `netto` (som van de streep-deltas, negatieve incluis) en `bakken` voor de meta-regel (AC3).
   - Geen kleuren, geen labels en geen copy in deze functie: die blijven in het scherm, de functie levert enkel cijfers en sleutels.

3. **`src/Logboek.tsx`** — port van de design (`design/Streepkeslijst App.dc.html` regel 131-187), zonder de tellerstrook en zonder de kolom 'voor wie'. Per regel: uur, +n/−n, en 'zelf gezet' of 'door X' plus '· n keer dit uur'. Zelf gezet grijs, iemand anders paars (design regel 1379-1385) — dat contrast is het hele punt van het scherm. 'Zelf gezet' = `myRef === 'user:' + entry.by`.
   - Props: `{ entries, myRef }` — meer heeft het niet nodig: de nick van de streper staat al in de entry (`byNick`), dus zelfs `people` hoeft er niet bij. Geen eigen Firestore-hook: `Lijst.tsx` streamt de ledger toch al voor de totalen, dus dit scherm leest nul extra documenten (AC8).

4. **`route.ts`** — `logboek: 'Mijn logboek'`. Eén slug, geen persoon erin, want er valt niemand anders te bekijken.

5. **`Lijst.tsx`** — het nav-item `{ label: 'Mijn logboek' }` (geen rol: iedereen ziet zijn eigen logboek) en `Logboek` in de scherm-switch. Verder geen state: het scherm kent maar één persoon.

6. **Tests**
   - `period.test.ts`: groeperen per dag; samenvoegen per uur/streper/soort; een streep en een schrapping in hetzelfde uur blijven twee regels; netto saldo met negatieve deltas; andermans boekingen komen er niet in; en de daggrens op 05:59 en 06:00 (AC10).
   - `Logboek.test.tsx`: een boeking door iemand anders toont 'door X' en niet 'zelf gezet'; lege staat bij nul boekingen.
   - `npm test` en `npm run build` (die is ook de typecheck).

**Geen paginatie, en dat is een bewuste grens.** `useEntries` streamt de hele ledger van de lopende periode al — de lijst heeft elke entry nodig om de totalen te kunnen optellen, dus die reads gebeuren sowieso. Het Logboek hangt daar bovenop en leest nul documenten extra; paginatie zou de kost dus niet verlagen, alleen code toevoegen. Orde van grootte: een vijftiental leiders, een paar honderd boekingen per periode (de design rekent met 312), en een periode start telkens leeg.

`ponytail:` de hele periode in het geheugen. Dat begint pas te knellen bij duizenden boekingen per periode, en dan is het Logboek niet het probleem: `totals()` heeft dezelfde entries nodig voor de lijst zelf. De upgrade is dan een opgetelde teller per persoon op het periode-document (of een `limit` + 'meer laden' in dit scherm), niet paginatie hier alleen.

**Twee correcties na het uitproberen (17/09):**
- Een geschrapte BAK toonde enkel GESCHRAPT, zoals de design het doet (regel 1377) — dan lees je niet meer terug wát er weg is. De labels zijn nu een lijstje in plaats van één waarde: soort eerst, correctie erachter.
- De subregel onder 'Mijn logboek' in het menu ('37 boekingen in periode 3') is eruit. Het menu toont enkel labels; het aantal staat toch in het logboek zelf. Daarmee vervalt ook de `sub`-prop op het nav-item — geen enkel item gebruikt ze nog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per the recorded plan, one deviation worth flagging: Entry's new at/by/byNick are optional (at?: Date, by?: string, byNick?: string), not required — period.test.ts and Afsluiten.test.tsx already build bare {personRef,kind,delta} Entry literals, and making the fields required would have forced touching those unrelated tests. logboek() defensively falls back (at ?? new Date(), by ?? '', byNick ?? '?').

data.ts: added a shared naarEntry() mapper for useEntries/useOwnEntries so `at` (a Firestore Timestamp) becomes a Date once, not duplicated per hook. Two pre-existing data.test.ts assertions needed updating for the new `at` field (expect.any(Date)) — not a behaviour change, just the new field appearing.

Nav: Lijst.tsx's alleNav gained an optional `sub` field, rendered under the label only when present. Today only 'Mijn logboek' sets one; the design has a sub per nav item but porting the rest is outside this task's scope (flagged as a candidate follow-up, not done).

Files: src/period.ts (Entry fields, fuifDag, logboek), src/period.test.ts, src/data.ts (naarEntry), src/data.test.ts, src/Logboek.tsx (new), src/Logboek.test.tsx (new), src/route.ts, src/route.test.ts, src/Lijst.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mijn logboek toont je eigen boekingen van de lopende periode, per dag en per uur samengevoegd, met wie ze zette.

Wat er kwam: `fuifDag()` en de pure `logboek()` in period.ts (daggrens op 06:00 lokale tijd), `src/Logboek.tsx` als props-only scherm, de `logboek`-slug in route.ts en het menu-item in Lijst.tsx. `Entry` kreeg de velden `at`/`by`/`byNick` die data.ts al schreef maar nooit typeerde, en `useEntries` mapt `at` naar een Date. Geen extra reads (het scherm hangt op de ledger die de lijst toch al streamt), geen writes, geen rules-wijziging.

Twee dingen die tijdens het uitproberen zijn bijgesteld: een geschrapte BAK toont nu twee labels (BAK én GESCHRAPT) in plaats van enkel GESCHRAPT zoals de design het doet, en de subregel met het aantal boekingen onder het menu-item is er weer uit — het menu blijft enkel labels.

Geverifieerd: npm run build (tevens de typecheck) en npm test, 157 tests groen, plus een handmatige ronde in de app tegen develop — strepen, een BAK, een schrapping, en daarna het logboek nagerekend: de dagtotalen (+2, +7, +8, +1) tellen op tot de 18 streepjes op de lijst.
<!-- SECTION:FINAL_SUMMARY:END -->
