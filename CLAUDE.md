# Uren (werkuren-app voor mijn vader)

Installeerbare app (PWA) in het Nederlands waarmee mijn vader de werkuren van zijn mensen bijhoudt.
Gewone HTML, CSS en JavaScript. Geen framework, geen backend, geen build.
Hij gebruikt hem vooral op zijn telefoon, dus alles is groot (tekst min. 18px, knoppen min. 48px) en met weinig tikken.

## Mappen

- `index.html`: de schil: titelbalk, plek voor het scherm, drie tabs onderin, een `<dialog>` voor pop-ups.
- `css/app.css`: alle opmaak, ook de print-opmaak (A4 liggend) onderaan.
- `js/logic.js`: pure rekenregels (datums, weken, uren, totalen, CSV). Geen DOM. Werkt in de browser (`window.Logic`) en in Node.
- `js/app.js`: de schermen, opslag, knoppen en pop-ups. Tekent HTML met strings en luistert met een paar `document`-listeners op `data-action`.
- `sw.js`: service worker. Eerst uit het geheugen, ondertussen verversen. **Verhoog `VERSIE` bij elke wijziging**, anders blijft de oude versie hangen.
- `manifest.webmanifest`, `icons/`: installatie op beginscherm (naam "Uren", blauw met klok).
- `test/test.js`: `node test/test.js` controleert uren, weken (ISO, maandag eerst), totalen en CSV.
- `dev-server.py`: lokale testserver op http://localhost:8123 zonder cache. `netlify.toml`: instellingen voor Netlify.

## Opslag

Alles staat in `localStorage` onder de sleutel `uren-data-v1`, op het apparaat zelf:

```
{ version, employees: [{id, name, active}],
  entries: [{id, empId, date: "YYYY-MM-DD", mode: "times"|"hours",
             start, end, breakMin,   // bij mode times
             hours,                  // bij mode hours
             note}],
  lastBackup: "YYYY-MM-DD"|null, firstUse, prefs: {start, end, breakMin} }
```

- Meerdere invoeren per persoon per dag mogen (de cel in het weekoverzicht toont de som).
- Bij het terugzetten van een back-up wordt de oude data eerst bewaard onder `uren-data-v1-voor-terugzetten`.
- Medewerkers worden nooit echt verwijderd, alleen `active: false`, zodat oude uren bewaard blijven.
- Back-up herinnering: banner als de laatste back-up (of eerste gebruik) meer dan 14 dagen geleden is en er invoeren zijn.

## Regels in de code

- Uren = (eind min begin min pauze), werkt over middernacht, nooit negatief. Getoond met komma: `7,5`.
- Weken volgens ISO, maandag eerste dag. Datums zijn altijd lokale `YYYY-MM-DD`, nooit UTC.
- CSV voor Excel: puntkomma, decimaal komma, UTF-8 met BOM, CRLF. Op een telefoon gaat het bestand via het deelmenu.
- Alle teksten in het Nederlands, geen em-dashes.
- `dialog()` in `app.js` regelt alle pop-ups. Het `close`-signaal van een vorige pop-up komt soms laat aan; daarom negeert `onClose` het zolang er een pop-up open staat.

## Online zetten (Netlify)

Zie de stappen in de chat: map slepen naar Netlify Drop of de GitHub-repo koppelen. Geen build-opdracht, publiceer de hoofdmap.
Op iPhone: Safari, Deel, Zet op beginscherm. Op Android: menu, Installeer app.

## Open punten

- Geen echte App Store of Play Store app. Dit is een geinstalleerde web-app (beginscherm-icoon, volledig scherm, werkt offline).
- Data staat per apparaat. Twee telefoons hebben dus elk hun eigen lijst, tenzij er een back-up wordt overgezet.
