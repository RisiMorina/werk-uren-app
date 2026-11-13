# Uren (werkuren-app voor mijn vader)

Installeerbare app (PWA) in het Nederlands waarmee mijn vader de werkuren van zijn mensen bijhoudt.
Gewone HTML, CSS en JavaScript. Geen framework, geen backend, geen build.
Hij gebruikt hem vooral op zijn telefoon, dus alles is groot (tekst min. 18px, knoppen min. 48px) en met weinig tikken.

## Mappen

- `index.html`: de schil: titelbalk, plek voor het scherm, drie tabs onderin, een `<dialog>` voor pop-ups.
- `css/app.css`: alle opmaak, ook de print-opmaak (A4 liggend) onderaan.
- `js/logic.js`: pure rekenregels (datums, weken, uren, totalen, CSV). Geen DOM. Werkt in de browser (`window.Logic`) en in Node.
- `js/scene-model.js`: pure regels van de Werkvloer-scene: isometrische projectie (`iso`), bankplaatsen en werkplekken per beroep (`benchSeat`, `workSpot`, `layout`), lopen via een opening in de muur (`setClocked`, `update`). Geen DOM, getest in Node.
- `js/scene.js`: tekent de scene op een `<canvas>`. Alles is gebouwd met een blokjes-hulpfunctie `kubus()`. Poppetjes zijn blokjes (1,5x groter dan hun tegels). `Scene.mount/setPeople/start/stop`. De animatie loopt alleen terwijl de tab Werkvloer en de pagina zichtbaar zijn. `_step/_hit/_state` zijn testhaakjes.
- `js/app.js`: de schermen, opslag, knoppen en pop-ups. Tekent HTML met strings en luistert met een paar `document`-listeners op `data-action`.
- `sw.js`: service worker. Eerst uit het geheugen, ondertussen verversen. **Verhoog `VERSIE` bij elke wijziging**, anders blijft de oude versie hangen.
- `manifest.webmanifest`, `icons/`: installatie op beginscherm (naam "Uren", blauw met klok).
- `test/test.js`: `node test/test.js` controleert uren, weken (ISO, maandag eerst), totalen, CSV, inklokregels en het upgraden van oude data. `test/scene-model.test.js` controleert de scene-regels. Draai beide.
- `docs/superpowers/`: ontwerp (`specs/`) en bouwplan (`plans/`) van de Werkvloer.
- `dev-server.py`: lokale testserver op http://localhost:8123 zonder cache. `netlify.toml`: instellingen voor Netlify.

## Opslag

Alles staat in `localStorage` onder de sleutel `uren-data-v1`, op het apparaat zelf:

```
{ version, employees: [{id, name, active, trade}],   // trade: elektricien|vloerlegger|schilder|loodgieter|timmerman|overig
  clock: { [empId]: "YYYY-MM-DDTHH:MM" },             // wie nu ingeklokt is (lokale tijd)
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

## Werkvloer (startscherm)

- Eerste tab. Isometrisch beeld van een half af gebouw met een bankje ernaast. Ingeklokte mensen lopen door de opening in de rechtermuur naar hun werkplek en doen hun beroep, de rest zit op de bank. Alleen de vader klokt in en uit, door op een poppetje of een knop in de lijst eronder te tikken.
- Inklokken schrijft alleen `data.clock[empId]`. Uitklokken maakt een gewone invoer (`mode: "times"`, datum en begintijd van het inklokmoment, pauze uit `prefs.breakMin`) en wist de klok, dus week, totalen, CSV en back-up werken ongewijzigd.
- Meer dan 16 uur ingeklokt: gele waarschuwing en een extra bevestiging. 24 uur of meer, of eind voor begin: kan niet opgeslagen worden tot de eindtijd klopt. 0 uur: niets opgeslagen, inklokken wordt gewist na bevestiging. Wie nog ingeklokt is kan niet op "niet meer actief" gezet worden.
- Wie op de bank zit staat in één label links onder het plaatje ("Op de bank: ..."), niet bij elk poppetje. Namen boven werkende poppetjes schuiven omhoog als ze botsen.
- Werkplekken: een vaste pool van 16 plekken (`SPOT_POOL` in `scene-model.js`), minstens 1,2 tegel uit elkaar en niet in een voorwerp (`OBSTACLES`). Iedereen pakt de vrije plek het dichtst bij de eigen hoek van zijn beroep (`HOME`). Verplaats je een voorwerp in `scene.js`, pas dan ook `OBSTACLES` aan, anders vangt de test het niet.
- Een pauze is hele minuten en nooit negatief (`Logic.cleanBreak`).
- `prefers-reduced-motion`: poppetjes staan stil op hun plek en er draait geen animatielus.
- Onder het plaatje staat altijd de lijst met dezelfde knoppen: dat is de zekere weg als het plaatje lastig is.
- Testen in de browser: `Scene._step(seconden)` zet de animatie met de hand vooruit (de lus staat stil als het browservenster verborgen is). Haal in de ontwikkelserver oude service workers weg als de oude versie blijft hangen.

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
- Data staat per apparaat. Twee telefoons hebben dus elk hun eigen lijst, tenzij er een back-up wordt overgezet. Dat geldt ook voor de inklokstatus: de scene toont alleen wat op dit apparaat is ingeklokt.
