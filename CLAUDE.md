# werk-uren-app

Twee losse apps voor mijn vader, elk in een eigen map met een eigen `CLAUDE.md`. Lees die van de map waar je in werkt:

- `werkvloer/`: de Uren-app voor zijn medewerkers, met de Werkvloer (isometrisch startscherm met poppetjes die in- en uitgeklokt worden).
- `single-hours-check/`: "Mijn uren", de eigen uren van mijn vader (gewerkt of niet gewerkt, per dag, met maandoverzicht).

Tests vanuit deze map: `node werkvloer/test/test.js`, `node werkvloer/test/scene-model.test.js`, `node single-hours-check/test/test.js`.
Testservers: zie `.claude/launch.json` (`uren` op poort 8123, `mijn-uren` op poort 8124).
