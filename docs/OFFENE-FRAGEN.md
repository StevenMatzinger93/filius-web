# Offene Fragen

Gesammelt während der Arbeit; werden am Ende jeder Phase vorgelegt.
Bis zur Antwort gilt jeweils der genannte **Vorschlag**.

## Nach Phase 2 (Grundgerüst)

- **Lizenz:** vorläufig GPL-3.0-or-later gesetzt (Vorschlag aus Frage 1 unten). Bitte bestätigen oder ändern.
- **Startinhalt:** Beim ersten Öffnen erscheint ein kleines Beispielnetz (2 Rechner + Switch). Soll die App
  stattdessen leer starten?
- **Adressvorschlag:** Neue Endgeräte erhalten fortlaufend 192.168.0.10, .11, … (Filius: alle .10).
  Passt das didaktisch, oder sollen Lernende bewusst selbst Adressen vergeben (Feld leer)?

## Nach Phase 1 (Analyse)

1. **Lizenz der neuen App.** Filius steht unter «GPLv2 oder GPLv3». Die neue App wird ohne
   Code-Übernahme neu geschrieben, die Lizenz ist also frei wählbar.
   _Vorschlag:_ **GPL-3.0-or-later** – im Geist des Originals, und falls später doch Texte,
   Vorlagen (z. B. Webseiten-Vorlagen des Routers) oder Symbole übernommen werden, ist man
   damit auf der sicheren Seite. Alternative: MIT (freier, aber dann keine Übernahmen möglich).
2. **Hosting-Ziel.** Cloudflare Pages oder GitHub Pages? _Vorschlag:_ GitHub Pages
   (Workflow liegt bei), Cloudflare-Anleitung zusätzlich in der README.
3. **Software-Assistent** (eigene Java-Anwendungen programmieren, im Original vorhanden):
   im Browser nicht sinnvoll umsetzbar. _Vorschlag:_ weglassen; eigene Anwendungen aus
   .fls-Dateien werden beim Import gemeldet und übersprungen.
4. **Peer-to-Peer-Dateitausch, Bildbetrachter, Dateiexplorer** sind im Original vorhanden,
   aber nicht im Muss-Umfang des Auftrags. _Vorschlag:_ Dateiexplorer und Bildbetrachter
   einfach mitliefern (Phase 5), Peer-to-Peer erst nach Rückfrage.
5. **NAT-Gateway / Heimrouter** gibt es im Original (in 2.14 standardmässig ausgeblendet).
   Im Auftrag steht «Modem/Internet-Gateway». _Vorschlag:_ «Internet-Gateway» mit NAT
   (PAT) und Portweiterleitung umsetzen, Modem-Tunnel (zwei Filius-Instanzen über TCP
   verbinden) entfällt, da es im Browser keine direkten TCP-Verbindungen gibt.
6. **WLAN** (SSID, drahtlose Verbindungen; im Original seit 2.4). Nicht im Auftrag.
   _Vorschlag:_ nur als Kabeltyp «drahtlos» (gestrichelt) ohne Funkmodell, Phase 7.
7. **Dokumentationsmodus und PDF-Report.** _Vorschlag:_ Zonen und Notizen auf dem Canvas
   ersetzen den Dokumentationsmodus; PNG-Export; PDF über die Druckfunktion des Browsers.
8. **Testdateien.** Die zwei Beispiel-.fls-Dateien (`tests/fixtures/fls/`) wurden mit den
   Original-Klassen erzeugt und enthalten die Filius-Standard-Webseite (GPL). Bei Lizenzwahl
   GPL-3.0 unproblematisch; bei MIT würden sie durch selbst erstellte Dateien ersetzt.
9. **Zeitmodell.** Das Original arbeitet mit echten Threads und Wartezeiten. Die neue Engine
   nutzt virtuelle Zeit (deterministisch). Ping-Zeiten in der Befehlszeile sind daher
   simulierte Millisekunden. _Vorschlag:_ so umsetzen und in ARCHITEKTUR.md dokumentieren.
