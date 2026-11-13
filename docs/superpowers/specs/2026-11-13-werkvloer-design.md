# Werkvloer: de startscherm-scene

## Waarom

De vader van Eris houdt met de app Uren de werkuren van zijn mensen bij. Hij wil dat het eerste dat hij ziet geen lijst is maar een levend beeld van zijn bedrijf: een bouwplaats van boven en schuin, met kleine poppetjes die doen waar ze voor zijn. Wie niet werkt, zit op een bankje ernaast. Het moet leuk zijn om naar te kijken en tegelijk het inklokken en uitklokken makkelijker maken.

## Doelen

- Nieuw eerste tabblad **Werkvloer** met een isometrische (schuine bovenaanzicht) scene: een half af gebouw en een bankje ernaast.
- Elke medewerker is een poppetje. Ingeklokt: loopt rond op de werkvloer en doet zijn beroep. Niet ingeklokt: zit op het bankje.
- Alleen de vader klokt in en uit. Tik op een poppetje: sheet met naam, beroep, sinds wanneer ingeklokt, en knoppen **Inklokken** of **Uitklokken** en **Tijd aanpassen**.
- Inklokken: het poppetje staat op van het bankje en loopt naar zijn werkplek. Uitklokken: loopt terug naar het bankje.
- Uitklokken bewaart de uren als gewone invoer, zodat weekoverzicht, totalen, CSV en back-up blijven werken.
- Soepel (60 fps op een gewone telefoon), werkt offline, past in de bestaande app zonder framework.

## Geen doelen

- Geen zelf inklokken door medewerkers, geen gedeelde data tussen telefoons.
- Geen echte 3D, geen draaibare camera, geen geluid, geen score of spelregels. Het is een weergave, geen spel.
- Het bestaande invullen, week, mensen, export en back-up veranderen niet.

## Wat het nooit mag zijn

- Een mooi plaatje dat het inklokken lastiger maakt dan een knop in een lijst. Ook zonder de scene te snappen moet je elke persoon kunnen vinden en inklokken (zie "Toegankelijk alternatief").
- Een scene die schokt, de batterij leegtrekt of blijft draaien als je op een ander tabblad zit.
- Een poppetje dat een beroep doet dat niet bij zijn beroep past.

## Aanpakken die ik heb overwogen

1. **Canvas 2D, getekend met code, isometrisch (gekozen).** Licht (geen extra bestanden), werkt offline, loopt soepel op oude telefoons, volledige controle over de stijl, past bij de bestaande opzet.
2. **Three.js, echte 3D.** Rijker, maar een bibliotheek van ca. 600 KB, zwaarder voor batterij en oude telefoons, en elke beroepsanimatie kost veel meer werk. Te veel voor een scherm dat vaak wordt geopend.
3. **DOM en CSS-animatie.** Makkelijkste bouw, maar schokkerig met veel bewegende poppetjes en lastig voor isometrie.

Eris vroeg welke het mooist, schoonst en soepelst is. Antwoord en keuze: aanpak 1.

## Beslissingen

Deze heeft Eris zelf genomen:

- Alleen de vader klokt in en uit.
- Als hij inklokt, zie je de mensen rondlopen. Wie er niet is, zit op het bankje.
- Tik op een poppetje om te zien wanneer iemand is ingeklokt en dat te beheren.
- Beeld: schuin van boven, zoals bij League of Legends (isometrisch).

Deze heb ik gekozen (mijn keuze, graag nakijken):

- **Beroep** is een nieuw veld per medewerker in het tabblad Mensen, te kiezen uit: Elektricien, Vloerlegger, Schilder, Loodgieter, Timmerman, Overig. Overig is een gewone bouwvakker die planken draagt. De lijst staat op één plek in de code en is makkelijk uit te breiden.
- Bestaande medewerkers hebben nog geen beroep en worden Overig tot de vader er een kiest.
- **Inklokstatus** staat in dezelfde opslag: `clock: { [empId]: "YYYY-MM-DDTHH:MM" }` (lokale tijd). Een medewerker staat in `clock` zolang hij ingeklokt is.
- **Uitklokken** maakt een invoer: `mode: "times"`, datum en begintijd van het inklokmoment, eindtijd is nu, pauze is de laatst gebruikte pauze (`prefs.breakMin`, standaard 30), aanpasbaar in de sheet voor het opslaan. Over middernacht werkt al in `logic.js`.
- **Vergeten uit te klokken:** is iemand langer dan 16 uur ingeklokt, dan toont de sheet een gele waarschuwing en moet de vader eerst de eindtijd controleren voor het opslaan. Zo komt er geen invoer van 20 uur per ongeluk in de totalen. Zijn de uren 0, dan wordt er niets opgeslagen en wordt het inklokken gewoon gewist, met een bevestiging.
- **Tijd aanpassen:** de begintijd van het inklokken (ook voor vergeten inklokken: kies de tijd, dan geldt die). Het moment van uitklokken kan hij in dezelfde sheet aanpassen voor het opslaan.
- **Werkplekken:** elk beroep heeft een vaste plek in het gebouw (elektricien bij de muurkast, vloerlegger op de halve vloer, schilder bij de witte muur, loodgieter bij de leidingen, timmerman bij het skelet, overig loopt heen en weer met planken). Twee mensen met hetzelfde beroep krijgen naast elkaar een eigen plek.
- Poppetje: klein, gekleurde helm per persoon (vaste kleur uit zijn id), eigen kleding per beroep, naam in kleine letters boven het hoofd.
- Maximaal 16 poppetjes goed leesbaar. Bij meer: bankje en gebouw worden groter geschaald of de scene schuift (de bouwer kiest de simpelste manier).
- Kleuren: het blauw en geel van de app, aangevuld met warme bouwkleuren (baksteenrood, beton, hout). Geen zwarte achtergrond met neon, geen crèmekleurig sjabloon.
- Het eerste scherm is de demo: de scene vult de hele eerste schermhoogte (met de tabs onderaan), niet een kleine kaart boven een lijst. Boven in een dun label: "Op de werkvloer: 3 van 5".

## Toegankelijk alternatief

Onder de scene (of via een knop "Lijst") staat een gewone lijst met dezelfde mensen en dezelfde knoppen Inklokken en Uitklokken. De scene is de mooie weg, de lijst de zekere weg. Een screenreader en wie bewegingen uit heeft staan, gebruikt de lijst.

## Beweging

- `prefers-reduced-motion`: poppetjes staan stil op hun plek (op het bankje of bij hun werkplek), geen lopen en geen bewegende gereedschappen.
- De animatie loopt alleen als de tab Werkvloer zichtbaar is én de pagina zichtbaar is (`visibilitychange`). Anders `cancelAnimationFrame`.
- Lopen is langzaam en vloeiend (geen teleporteren), met een korte wachttijd voor ze opstaan.
- Geen losse effecten overal: alleen de beroepsbewegingen zelf. Het gebouw is rustig.

## Techniek

- Nieuwe bestanden: `js/scene.js` (tekenen, bewegen, tikken), `js/clock.js` of uitbreiding van `logic.js` met pure inklokregels (testbaar in Node), `css/scene.css` of een blok in `app.css`.
- Tekenen op één `<canvas>`, schaal met `devicePixelRatio`, `touch-action: manipulation`. Tikken: eerst de dichtstbijzijnde poppetje binnen een ruime tikzone (minimaal 48 px), anders niets.
- Poppetjes zijn code-getekende vormen (ellips, rechthoeken, lijnen), geen afbeeldingen, zodat alles klein en scherp blijft.
- Service worker: nieuwe bestanden toevoegen aan `BESTANDEN` en `VERSIE` verhogen.
- Tests: pure regels voor inklokken, uitklokken, middernacht, 16-uurs-controle en bewaren van `clock` in `node test/test.js`. De scene zelf controleren met schermafbeeldingen bij 375px, 768px en breed, en tikken via canvas-coördinaten.

## Wat aan de bouwer is

De precieze tekenstijl en kleuren, de exacte plek van de werkplekken, hoe de poppetjes lopen (rechte lijnen tussen punten is genoeg), schalen bij veel mensen, en de tekst van de sheet.
