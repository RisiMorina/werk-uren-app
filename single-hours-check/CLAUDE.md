# Mijn uren (eigen uren van mijn vader)

Kleine installeerbare app (PWA) in het Nederlands waarmee mijn vader zijn **eigen** werkuren bijhoudt: per dag hoeveel uur hij heeft gewerkt, of dat hij niet heeft gewerkt (vrij, ziek, vakantie, feestdag). Los van de Uren-app voor zijn medewerkers (die staat in de map hierboven). Gewone HTML, CSS en JavaScript, geen framework, geen backend, geen build. Alles is groot (tekst min. 18px, knoppen min. 48px).

Deze map staat op zichzelf: er is niets nodig uit andere mappen, dus hij kan los online gezet worden.

## Mappen

- `index.html`: de schil: titelbalk, plek voor het scherm, drie tabs (Invullen, Maand, Bestanden), een `<dialog>` voor pop-ups.
- `css/app.css`: alle opmaak.
- `js/logic.js`: pure rekenregels (datums, weken, uren, controle van een dag, maandkalender, totalen, CSV, upgraden van data). Geen DOM. Werkt in de browser (`window.Logic`) en in Node.
- `js/app.js`: de schermen, opslag, knoppen en pop-ups.
- `sw.js`: service worker (offline). **Verhoog `VERSIE` bij elke wijziging**, anders blijft de oude versie hangen. Alle bestanden die meegaan staan in `BESTANDEN`.
- `manifest.webmanifest`, `icons/`: installatie op het beginscherm (naam "Mijn uren", groen met een vinkje).
- `test/test.js`: `node test/test.js` (vanuit deze map) of `node single-hours-check/test/test.js` (vanuit de hoofdmap).
- `dev-server.py`: lokale testserver op http://localhost:8124 zonder cache. `netlify.toml`: instellingen voor Netlify.

## Opslag

Alles staat in `localStorage` onder de sleutel `mijn-uren-v1`, op het apparaat zelf:

```
{ version, days: { "YYYY-MM-DD": record }, lastBackup, firstUse, prefs: {start, end, breakMin} }
record: { date, kind: "gewerkt"|"vrij"|"ziek"|"vakantie"|"feestdag", note,
          mode: "times"|"hours", start, end, breakMin, hours }   // mode en uren alleen bij "gewerkt"
```

- **Eén record per datum.** Opnieuw invullen vervangt hem, na een bevestiging. `setDay` bewaart alleen wat bij de soort hoort, dus er blijven nooit oude uren of tijden hangen als je van gewerkt naar een reden wisselt.
- Data inlezen kan nooit de app kapot maken: `upgradeData` herstelt of laat weg wat niet leesbaar is (een dag met verkeerde velden valt weg, een hoofdletter in de soort wordt hersteld, uren als tekst met komma worden gelezen, kapotte voorkeuren worden de standaard). Is de hele opgeslagen tekst onleesbaar, dan blijft hij bewaard onder `mijn-uren-v1-onleesbaar` en start de app leeg, zodat het volgende opslaan hem niet wist.
- Bij het terugzetten van een back-up wordt de oude data eerst bewaard onder `mijn-uren-v1-voor-terugzetten`. Een bestand dat geen back-up is wordt geweigerd en verandert niets.
- Back-up herinnering: banner als de laatste back-up (of eerste gebruik) meer dan 14 dagen geleden is en er dagen zijn ingevuld.

## Regels in de code

- Niet opgeslagen: 0 uur (ook als het door afronden 0 wordt, bijvoorbeeld 0,001), meer dan 24 uur, begin of eind ontbreekt, geen reden gekozen, een negatieve pauze (met de melding "De pauze kan niet negatief zijn."). Een pauze is hele minuten (`cleanBreak`; in oude of handgemaakte data telt een negatieve pauze als geen pauze). Over middernacht (22:00 tot 06:00) telt op de begindatum.
- Weken volgens ISO, maandag eerst. Datums zijn altijd lokale `YYYY-MM-DD`, nooit UTC.
- Aan de randen van een maand telt een week alleen de uren van de dagen in die maand en staat er "(deel van de week)". Week 53 komt in december en in januari voor.
- Dagen in de toekomst mogen (vakantie vooruit zetten); ze zijn lichter getekend. Alleen dagen met uren tellen als gewerkt.
- Een nieuwe dag begint zonder gekozen reden of uren (zodat je nooit per ongeluk iets oudsts opslaat); de keuze Gewerkt/Niet gewerkt, de invulwijze en de tijden blijven staan.
- CSV voor Excel: puntkomma, decimaal komma, UTF-8 met BOM (de app zet de BOM erbij), CRLF. Op een telefoon gaat het bestand via het deelmenu.
- Alle teksten in het Nederlands, geen em-dashes.

## Online zetten (Netlify)

Alleen deze map publiceren (map slepen naar Netlify Drop, of de repo koppelen met `single-hours-check` als publicatiemap). Geen build-opdracht. Op iPhone: Safari, Deel, Zet op beginscherm. Op Android: menu, Installeer app.

## Open punten

- Geen echte App Store of Play Store app: dit is een geinstalleerde web-app.
- De uren staan per apparaat. Een tweede telefoon heeft een eigen lijst, tenzij er een back-up wordt overgezet.
- Niet gebouwd (bewust): overuren, uurtarief of loon.
