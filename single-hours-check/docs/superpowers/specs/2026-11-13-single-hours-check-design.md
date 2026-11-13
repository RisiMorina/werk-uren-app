# Single hours check: eigen uren van één persoon

## Waarom

De vader van Eris wil in een eigen, simpele app bijhouden hoeveel uur hij zelf elke dag heeft gewerkt, en welke dagen hij niet heeft gewerkt (en waarom). Het is los van de Uren-app voor zijn medewerkers: één persoon, één lijst, geen namen kiezen.

## Doelen

- Een dag invullen: datum (standaard vandaag), dan **Gewerkt** of **Niet gewerkt**.
  - Gewerkt: aantal uren, of begin en eind met pauze (de schakelaar "Tijden / Alleen uren" zoals in de Uren-app). Notitie mag.
  - Niet gewerkt: reden met een grote knop: Vrij, Ziek, Vakantie of Feestdag. Notitie mag.
- Maandoverzicht: kalender (maandag eerst) met per dag een kleur en de uren of de reden. Bovenaan totaal uren, aantal gewerkte dagen en het aantal vrije dagen per soort. Eronder de uren per week. Tik op een dag om te wijzigen of te verwijderen.
- Download per maand voor Excel (puntkomma, komma als decimaal, UTF-8 met BOM). Back-up maken en terugzetten, met een rustige herinnering na 14 dagen.
- Installeerbare app (PWA), werkt offline, Nederlands, groot (tekst 18px of meer, knoppen 48px of hoger), alles in `localStorage`.

## Geen doelen

- Geen medewerkers, geen inklokken, geen scene. Geen overuren, uurtarief of loon. Geen gedeelde data tussen telefoons.
- Geen standaarduren: er staat niets vooraf ingevuld.

## Wat het nooit mag zijn

- Een app waarin een dag per ongeluk dubbel telt. Eén dag heeft één invoer; opnieuw invullen vervangt hem (na een duidelijke bevestiging).
- Een app die uren laat opslaan die niet kloppen (0 uur, meer dan 24 uur, negatieve pauze).

## Aanpak

Zelfde techniek als de Uren-app (gewone HTML, CSS, JavaScript, geen framework, `localStorage`, service worker). Het is een **eigen map met een eigen kopie** van de paar rekenregels, zodat de map los online gezet kan worden en niets van de Uren-app nodig heeft. Andere aanpakken (de Uren-app uitbreiden met een "alleen ik"-stand, of één gedeelde codebasis) zijn afgewezen: Eris wil een aparte app, en een gedeelde codebasis maakt het online zetten ingewikkelder.

## Beslissingen

Door Eris: een eigen app in de map `single-hours-check`, alleen voor de uren van haar vader; per dag uren invullen of aangeven dat hij niet heeft gewerkt; ontwerp en onderdelen goedgekeurd met "ja".

Mijn keuzes (graag nakijken):

- Reden bij niet gewerkt: Vrij, Ziek, Vakantie, Feestdag (vaste lijst in de code, makkelijk uit te breiden).
- Eén invoer per dag. Dagen in de toekomst mogen (om vakantie vooruit te zetten), met een grijze tint.
- Uren 0 of meer dan 24 worden niet opgeslagen; pauze is hele minuten en nooit negatief. Tijden over middernacht (22:00 tot 06:00) tellen als één dag, op de begindatum.
- Weektotalen volgens ISO (maandag eerst). Aan de randen van de maand telt een week alleen de uren van de dagen in die maand, en de weekregel zegt dat ("week 44, deel").
- Tabs onderin: Invullen, Maand, Bestanden. Kleuren: blauw (zoals Uren) voor gewerkt, geel voor vakantie, rood voor ziek, grijs voor vrij en feestdag.
- Appnaam: "Mijn uren".

## Wat aan de bouwer is

De exacte kleuren en de uitstraling van de kalender, tekst van de meldingen, en het icoon (eigen icoon in dezelfde stijl, andere kleur dan Uren).
