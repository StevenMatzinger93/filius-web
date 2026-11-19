# Analyse: Filius 2.14.0 → «Filius Web» (Arbeitstitel)

Stand: Phase 1 (Analyse), 19.11.2026. Dieses Dokument beschreibt, was das Original kann,
wie es intern aufgebaut ist und wie jede Funktion auf die neue Web-Architektur abgebildet wird.
Es endet mit dem Phasenplan zur Freigabe.

> Quelle der Analyse: das Installationsprogramm `Filius-Setup_with-JRE-2.14.0.exe`.
> Es ist ein NSIS-Installer; der eigentliche Programmkern ist `filius.jar`
> (Java 17, 513 Klassen in 28 Paketen, Hauptklasse `filius.Main`) plus eine mitgelieferte
> Java-Laufzeit. Untersucht wurde der Bytecode der JAR (Klassen, Methoden, Konstanten),
> die mitgelieferten Konfigurations-, Hilfe- und Vorlagendateien sowie das Changelog.
> Es wurde **kein Code übernommen**; das Original dient nur als fachliche Referenz.

Ausführliche Teilberichte:
[`analyse/SIMULATIONSREGELN-ORIGINAL.md`](analyse/SIMULATIONSREGELN-ORIGINAL.md) (Zeiten, Protokollregeln, Konstanten),
[`FLS-FORMAT.md`](FLS-FORMAT.md) (Projektdateiformat), [`../MECHANICS.md`](../MECHANICS.md) (übernommene Werte und bewusste Abweichungen).

## 1. Lizenz und Urheber

- Filius: «GNU General Public License Version 2 oder 3» (Readme, Info-Dialog; beide Lizenztexte liegen bei).
  `licenses.html` nennt nur GPLv3 – leichter Widerspruch, für uns ohne Folgen.
- Urheber: «Lernsoftware Filius», entstanden 2006/07 als Projektgruppe an der Universität Siegen
  (Betreuung Stefan Freischlad, Peer Stechert; Wartung Stefan Freischlad; zahlreiche Beitragende).
- Symbole: teils GPL-3 / CC-BY-SA-4.0 (Andreas B. Mundt), Tango/Soft (CC-BY), Nuvola, Human-O2 (GPL).
- **Konsequenz:** Die neue App wird **ohne Code-Übernahme** neu geschrieben. Symbole werden neu gezeichnet
  (eigene SVG-Symbole). Fachliche Werte (Ports, Zeiten, Protokollregeln) sind keine schützbaren Werke;
  ihre Herkunft wird trotzdem in `MECHANICS.md` belegt. In README/Info-Dialog wird Filius als fachliches
  Vorbild genannt. Lizenzwahl: siehe `OFFENE-FRAGEN.md` Nr. 1.

## 2. Aufbau des Originals (Klassenstruktur)

28 Pakete, 513 Klassen. Kernpakete ohne GUI:

| Paket                                 | Inhalt                       | Wichtige Klassen                                                                                                                                                                                                                       |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filius.hardware`                     | Kabel, Ports, Netzwerkkarten | `Kabel`, `Verbindung`, `SimplexVerbindung` (1 Thread je Richtung), `Port`, `NetzwerkInterface`                                                                                                                                         |
| `filius.hardware.knoten`              | Gerätetypen                  | `Knoten` → `LokalerKnoten` (`Switch`, `Modem`) / `InternetKnoten` → `Host` (`Rechner`, `Notebook`), `Vermittlungsrechner`, `Gateway`                                                                                                   |
| `filius.software.system`              | «Betriebssysteme» der Geräte | `Betriebssystem` (Host), `VermittlungsrechnerBetriebssystem`, `GatewayFirmware`, `SwitchFirmware` (+`SatEntry`), `ModemFirmware`, `Dateisystem`/`Datei`                                                                                |
| `filius.software.netzzugangsschicht`  | Schicht 2                    | `Ethernet`, `EthernetFrame`, `EthernetThread`, `SwitchPortBeobachter`                                                                                                                                                                  |
| `filius.software.vermittlungsschicht` | Schicht 3                    | `IP`, `IpPaket`, `ARP`, `ArpPaket`, `ICMP`, `IcmpPaket`, `Weiterleitungstabelle`, `Route`                                                                                                                                              |
| `filius.software.transportschicht`    | Schicht 4                    | `TCP`, `TCPSocket`, `TcpSegment`, `UDP`, `UDPSocket`, `ServerSocket`                                                                                                                                                                   |
| `filius.software.*` (Dienste)         | Schicht 7                    | `dhcp`, `dns`, `www` (WebServer/WebBrowser), `email` (SMTP/POP3), `firewall`, `rip`, `nat`, `dateiaustausch` (Gnutella), `clientserver` (Echo-Server, Einfacher Client), `lokal` (Terminal, TextEditor, FileExplorer, ImageViewer)     |
| `filius.rahmenprogramm`               | Rahmen                       | `SzenarioVerwaltung` (Speichern/Laden .fls), `Information` (Pfade, MAC-Vergabe, ini), `EingabenUeberpruefung`, `nachrichten.Lauscher` (Datenaustausch-Protokoll)                                                                       |
| `filius.gui.*`                        | Swing-Oberfläche             | `netzwerksicht` (Entwurf, Konfigurationsdialoge), `anwendungssicht` (Desktop, App-Fenster), `nachrichtensicht` (Datenaustausch), `schichtensicht` (Schichtenpfad), `quelltextsicht` (Software-Assistent), `documentation` (PDF-Report) |

**Architekturmuster des Originals:** Jede Schicht ist ein `Protokoll` mit eigenem `ProtokollThread`,
der eine Eingangswarteschlange abarbeitet; Kabel sind Threads mit `sleep(Verzögerung)`.
Anwendungen sind ebenfalls Threads. Zeitverhalten und Reihenfolge hängen daher vom
Thread-Scheduling ab → die neue Engine ersetzt dies durch einen deterministischen Event-Loop.

## 3. Gerätetypen des Originals

| Original             | Ports     | Besonderheiten                                                                      | Neu                            |
| -------------------- | --------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| Rechner              | 1 NIC     | Desktop mit installierbaren Anwendungen, DHCP-Client, optional IP-Weiterleitung     | `pc`                           |
| Notebook             | 1 NIC     | wie Rechner, WLAN möglich                                                           | `notebook`                     |
| Switch / WLAN        | 24        | MAC-Lerntabelle (SAT), Alterung einstellbar, optional als «Wolke», zugleich WLAN-AP | `switch` (+ VLANs)             |
| Vermittlungsrechner  | 2–8 NICs  | statische Routen, RIP, Firewall, Web-Konfigurationsseiten, DHCP-Server              | `router` (+ Sub-Interfaces)    |
| Heimrouter (Gateway) | WAN + LAN | NAT/PAT, Portfreigaben, DHCP-Server, Firewall                                       | `gateway` («Internet-Gateway») |
| Modem                | 1         | Tunnel zu einer anderen Filius-Instanz über echtes TCP                              | entfällt (siehe Offene Fragen) |
| Kabel                | –         | kabelgebunden oder drahtlos, Animation grün/rot                                     | `link`                         |

## 4. Protokolle und Anwendungen des Originals

**Protokolle:** Ethernet (ohne VLAN), ARP, IPv4 (ohne Fragmentierung), ICMP (Echo, Unreachable, Time Exceeded),
UDP, TCP (Handshake, Stop-and-Wait, FIN-Abbau), DHCP (ohne Relay), DNS (A, MX, NS, optional rekursiv),
HTTP/1.1 (GET/POST, virtuelle Hosts), SMTP, POP3, RIP v1-ähnlich (Split Horizon), NAT, Gnutella.

**Anwendungen (Desktop):** Befehlszeile, Bildbetrachter, Datei-Explorer, DNS-Server, E-Mail-Programm,
E-Mail-Server, Echo-Server, Einfacher Client, Firewall, Gnutella, Text-Editor, Webserver, Webbrowser;
dazu der Software-Assistent für eigene Java-Anwendungen.

**Befehlszeile:** `ipconfig`, `ping [-b]`, `traceroute`, `route`, `arp [-a|-d]`, `arpsend`, `netstat`,
`host`, `nslookup`, `tcpdump`, Dateibefehle, `help [Befehl]`, `cls`, `exit`.

**Modi:** Entwurfsmodus (Geräte ziehen, verkabeln, konfigurieren), Simulations-/Aktionsmodus
(Desktop öffnen, Switch-Tabelle, NAT-Tabelle, Datenaustausch je NIC, «Pakete verwerfen»,
Geschwindigkeitsregler 1–100 %), Dokumentationsmodus (Textfelder, Flächen, PNG-Export, PDF-Report).

**Datenaustausch:** Tabelle Nr. | Zeit | Quelle | Ziel | Protokoll | Schicht | Bemerkungen; Details
als aufgeklappter Schichtbaum; Schichtfarben Netzzugang #C9C9C9, Vermittlung #8FAADC,
Transport #F4B183, Anwendung #FFD966 (je in drei Abstufungen) – diese Farbcodierung übernehmen wir
als didaktisch bewährtes Muster.

## 5. Funktionsliste und Abbildung auf die neue Architektur

Legende Umfang: **M** = Muss (Auftrag), **S** = Soll, **O** = Option/Rückfrage. Phase = Umsetzungsphase.

| #   | Funktion (Original)                                                                  | Neu: Ort                                                                            | Umfang                 | Phase |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------- | ----- |
| 1   | Entwurfsmodus: Geräte ziehen, verschieben, Mehrfachauswahl, Kontextmenü              | `ui/canvas` (React Flow)                                                            | M                      | 2     |
| 2   | Kabel ziehen, Portwahl, Fehlermeldungen (Ports voll, schon verbunden)                | `ui/canvas`, Validierung in `engine/model`                                          | M                      | 2     |
| 3   | Konfiguration Rechner (Name, IP, Maske, Gateway, DNS, MAC, DHCP-Client, IP als Name) | `ui/panels/HostPanel`                                                               | M                      | 2     |
| 4   | Speichern/Laden (.fls)                                                               | eigenes JSON-Schema v1 + IndexedDB-Autosave + Datei-Export; .fls-Import in `io/fls` | M                      | 2 / 9 |
| 5   | Ethernet, Switch-Lernen, Alterung                                                    | `engine/layers/ethernet`, `engine/devices/switch`                                   | M                      | 3     |
| 6   | ARP inkl. Tabelle, `arp`-Befehl                                                      | `engine/layers/arp`                                                                 | M                      | 3     |
| 7   | IPv4, Routingtabelle (automatisch + manuell), IP-Weiterleitung                       | `engine/layers/ipv4`, `engine/devices/router`                                       | M                      | 3     |
| 8   | ICMP, `ping`, `traceroute`                                                           | `engine/layers/icmp`, `engine/cli/host`                                             | M                      | 3     |
| 9   | Befehlszeile (`ipconfig`, `route`, `arp`, `netstat`, `host`, `nslookup`)             | `engine/cli/host`, `ui/cli`                                                         | M                      | 3 / 5 |
| 10  | — (neu) 802.1Q, Access/Trunk/Native, MAC-Tabelle pro VLAN                            | `engine/layers/dot1q`, `engine/devices/switch`                                      | M                      | 4     |
| 11  | — (neu) L3-Switch mit SVIs, Router-Sub-Interfaces                                    | `engine/devices/l3switch`, `engine/model/VirtualInterface`                          | M                      | 4     |
| 12  | — (neu) Cisco-ähnliche CLI für Switch/Router                                         | `engine/cli/ios`                                                                    | M                      | 4     |
| 13  | — (neu) VLAN-Validierungen                                                           | `engine/validate`                                                                   | M                      | 4     |
| 14  | UDP, TCP mit sichtbarem Handshake                                                    | `engine/layers/udp`, `engine/layers/tcp`                                            | M                      | 5     |
| 15  | DHCP-Server/-Client (+ neu: Relay)                                                   | `engine/services/dhcp`                                                              | M                      | 5     |
| 16  | DNS-Server (A, MX, NS) und Resolver                                                  | `engine/services/dns`                                                               | M                      | 5     |
| 17  | Webserver/Webbrowser (HTTP)                                                          | `engine/services/http`, `ui/apps/Browser`                                           | M                      | 5     |
| 18  | E-Mail-Server/-Programm (SMTP/POP3)                                                  | `engine/services/smtp`                                                              | M                      | 5     |
| 19  | Texteditor, virtuelles Dateisystem                                                   | `engine/model/filesystem`, `ui/apps/Editor`                                         | M                      | 5     |
| 20  | Firewall (Host + Router), Regeln                                                     | `engine/services/firewall`                                                          | M                      | 5     |
| 21  | RIP                                                                                  | `engine/services/rip`                                                               | M                      | 5     |
| 22  | Heimrouter mit NAT, Portfreigaben                                                    | `engine/devices/gateway`                                                            | M («Internet-Gateway») | 5     |
| 23  | Desktop-Ansicht mit installierbaren Anwendungen                                      | `ui/desktop`                                                                        | M                      | 5     |
| 24  | Kabelanimation, Geschwindigkeitsregler                                               | `ui/canvas/PacketLayer`; Zeitachse aus Engine-Ereignissen                           | M                      | 6     |
| 25  | Datenaustausch-Ansicht je NIC, aufklappbar, Schichtfarben                            | `ui/packet-inspector`                                                               | M                      | 6     |
| 26  | Switch-Tabelle (SAT) / NAT-Tabelle anzeigen                                          | `ui/panels` (Laufzeitansichten)                                                     | M                      | 4 / 5 |
| 27  | «Pakete verwerfen»-Schalter                                                          | Simulationsleiste                                                                   | S                      | 6     |
| 28  | Schichtenpfad-Visualisierung                                                         | Schritt-für-Schritt-Modus mit Kommentaren                                           | S                      | 6 / 8 |
| 29  | Dokumentationsmodus (Text, Flächen, PNG-Export)                                      | Zonen/Notizen auf dem Canvas, PNG-Export                                            | S                      | 7     |
| 30  | PDF-Report                                                                           | Druckansicht (Browser-Druck als PDF)                                                | O                      | 9     |
| 31  | WLAN (SSID, drahtlose Verbindungen)                                                  | Kabeltyp «drahtlos» ohne Funkmodell                                                 | O                      | 7     |
| 32  | Bildbetrachter, Datei-Explorer                                                       | `ui/apps`                                                                           | O                      | 5     |
| 33  | Echo-Server, Einfacher Client                                                        | `ui/apps` (TCP-Lernwerkzeug)                                                        | O                      | 5     |
| 34  | Gnutella (Peer-to-Peer)                                                              | –                                                                                   | O (Rückfrage)          | –     |
| 35  | Software-Assistent (eigene Java-Apps)                                                | – (im Browser nicht sinnvoll)                                                       | entfällt               | –     |
| 36  | Modem-Tunnel zwischen Instanzen                                                      | – (kein TCP im Browser)                                                             | entfällt               | –     |
| 37  | Sprachen DE/EN/FR                                                                    | `i18n` de-CH + en                                                                   | M                      | 2     |
| 38  | Alternative Symbolsätze                                                              | eigener SVG-Symbolsatz, Rollenfarben                                                | S                      | 2 / 7 |
| 39  | — (neu) Rechenzentrums-Geräte, Rack-Ansicht, Zonen, Vorlagen                         | `engine/devices/*`, `ui/rack`                                                       | M                      | 7     |
| 40  | — (neu) Aufgabenmodus mit Prüfregeln, Tooltips                                       | `ui/tasks`, `engine/checks`                                                         | S                      | 8     |
| 41  | Undo/Redo, Tastaturkürzel                                                            | Store mit Patch-Stack                                                               | M                      | 2     |

## 6. Neue Architektur

### 6.1 Grundentscheidungen (mit Alternativen)

| Thema               | Entscheidung                                                                                                                                                                                                                                           | Alternativen                                                            | Begründung                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulationsmodell   | **Diskrete Ereignissimulation** mit virtueller Zeit (Millisekunden), ein einziger Event-Loop (`scheduler.ts`), Prioritätswarteschlange nach (Zeit, Sequenznummer)                                                                                      | Threads/Timer wie im Original (ein Thread pro Protokoll und Verbindung) | Deterministisch, testbar ohne Wartezeiten, beliebig schnell/langsam abspielbar, Schritt-für-Schritt trivial. Im Original sind Abläufe von Thread-Timing abhängig. |
| Zufall              | Seed-basierter PRNG (mulberry32) pro Projekt                                                                                                                                                                                                           | `Math.random`                                                           | Reproduzierbare Szenario-Tests (MAC-Adressen, TCP-ISN, Ports).                                                                                                    |
| Engine-Ort          | **Web Worker**, typisiertes Nachrichtenprotokoll (eigene diskriminierte Unions, kein Zusatzpaket)                                                                                                                                                      | Comlink; Engine im Hauptthread                                          | UI bleibt bei 200 Geräten flüssig. Dieselbe Engine läuft in Vitest direkt (ohne Worker).                                                                          |
| Zustand UI          | Zustand-Store mit dem **Projektmodell** (reine Daten, JSON-serialisierbar); Undo/Redo über Patch-Stack (Immer-Patches)                                                                                                                                 | Redux Toolkit; Snapshots                                                | Klein, schnell, vollständiger Undo-Stack ohne Speicherexplosion.                                                                                                  |
| Datenfluss          | Projektmodell ist die **einzige Wahrheit** für Konfiguration. GUI **und** CLI erzeugen dieselben Modell-Mutationen (`Command`-Objekte). Die Engine erhält das Modell und meldet nur Laufzeitzustand (MAC-Tabellen, ARP-Caches, Leases, Frames) zurück. | CLI schreibt direkt in die Engine                                       | GUI und CLI sind garantiert synchron; Undo funktioniert auch für CLI-Befehle.                                                                                     |
| Canvas              | **React Flow (@xyflow/react)** mit eigenen, memoisierten Knoten/Kanten, Minimap, Snap-to-Grid, Gruppen-Knoten für Zonen                                                                                                                                | Konva/Pixi (Canvas-Rendering)                                           | Vorgabe; 200 Knoten sind mit memoisierten Knoten problemlos. Paketanimation als eigene SVG-Ebene über den Kanten.                                                 |
| Validierung Dateien | **zod**-Schemas, daraus TypeScript-Typen                                                                                                                                                                                                               | JSON-Schema + ajv                                                       | Eine Quelle für Typ und Prüfung; JSON-Schema wird zusätzlich aus zod generiert und in `docs/DATENMODELL.md` dokumentiert.                                         |
| Persistenz          | IndexedDB (kleiner eigener Wrapper), Datei-Export/-Import als `.filiusweb.json`                                                                                                                                                                        | localStorage                                                            | Grösse, mehrere Projekte, Autosave.                                                                                                                               |
| .fls-Import         | `fflate` (ZIP) + eigener Mini-Interpreter für das `java.beans.XMLEncoder`-XML                                                                                                                                                                          | Java-Hilfsprogramm                                                      | Läuft im Browser, kein Backend.                                                                                                                                   |
| i18n                | eigenes, typisiertes Wörterbuch (`de-CH` Standard, `en` vorbereitet) mit Hook `useT()`                                                                                                                                                                 | i18next                                                                 | Keine Laufzeitabhängigkeit, Typsicherheit der Schlüssel.                                                                                                          |
| Tests               | Vitest (+ v8-Coverage, Schwelle 80 % für `src/engine`), Playwright                                                                                                                                                                                     | Jest                                                                    | Vorgabe.                                                                                                                                                          |
| Styling             | Tailwind CSS v4 (`@tailwindcss/vite`), Theme-Tokens in `@theme`, Dark/Light über `class="dark"`                                                                                                                                                        | CSS-Module                                                              | Vorgabe.                                                                                                                                                          |

### 6.2 Verzeichnisstruktur

Wie im Auftrag (Abschnitt 6) vorgegeben; alles liegt im Repository-Ordner `app/`.

```
src/engine/model      Device, Interface (Physical/Virtual), Link, Frame, Packet, Adressen
src/engine/layers     ethernet, dot1q, arp, ipv4, icmp, udp, tcp
src/engine/services   dhcp (+relay), dns, http, smtp/pop3, rip, firewall
src/engine/devices    host, switch, l3switch, router, server, loadbalancer, nas, vmhost, modem
src/engine/cli        Tokenizer, Modus-Automat (exec / config / config-if / config-vlan), Befehle
src/engine/scheduler.ts
src/worker            protocol.ts (Nachrichtentypen), engine.worker.ts, client.ts
src/ui/...            canvas, panels, rack, cli, packet-inspector, tasks
src/io                schema (zod), migrate, fls-import, export
tests/engine | tests/scenarios | tests/e2e
docs/                 ARCHITEKTUR.md, DATENMODELL.md, VLAN.md, FLS-FORMAT.md, FORTSCHRITT.md, OFFENE-FRAGEN.md
```

### 6.3 Interface-Modell (Kern für VLANs)

```
interface NetInterface {            // gemeinsame Schnittstelle
  id; name; kind: 'physical' | 'svi' | 'subif'
  mac; ip?: {address, prefix}; adminUp; operUp
  arpCache (Laufzeit)
}
PhysicalInterface  + switchport?: {mode:'access'|'trunk'|'routed', accessVlan, allowed:VlanSet, nativeVlan}
                   + linkId?
VirtualInterface   + svi: {vlan}  |  subif: {parent, vlan (encapsulation dot1q)}
```

- Ein **Switch-Port** ohne IP ist ein Layer-2-Port. Ein **Router-Port** ist `routed`.
- **SVI** `VlanN` ist «up», wenn VLAN N existiert und mindestens ein Port in VLAN N aktiv ist
  (Access-Port in N oder Trunk, der N erlaubt) – wie bei Cisco. Sonst Warnung
  «SVI Vlan20 hat keine aktiven Ports im VLAN 20».
- **Sub-Interface** `eth0.10` empfängt nur Frames mit Tag 10 auf `eth0`; das Native VLAN des
  Elternports wird ungetaggt behandelt (`encapsulation dot1q 99 native`).

### 6.4 Frame-Verarbeitung im Switch (802.1Q)

1. Eingang: Access-Port → Frame muss ungetaggt sein (getaggte Frames werden verworfen, Cisco-üblich),
   VLAN = Access-VLAN. Trunk-Port → ungetaggt ⇒ Native VLAN; getaggt ⇒ VID; VID nicht erlaubt ⇒ verwerfen.
2. MAC-Lernen in Tabelle **(VLAN, MAC) → Port, Alter** (Alterung 300 s, Cisco-Standard).
3. Ziel bekannt in diesem VLAN ⇒ gezielt weiterleiten; sonst / Broadcast ⇒ fluten an alle Ports
   **desselben VLANs** ausser Eingangsport.
4. Ausgang: Access-Port ⇒ ohne Tag; Trunk ⇒ mit Tag, ausser VLAN = Native VLAN ⇒ ohne Tag.
5. L3-Switch: Ziel-MAC = MAC einer SVI ⇒ an IP-Schicht übergeben, Routing zwischen SVIs.

Native-VLAN-Mismatch verhält sich wie echte Hardware: ungetaggte Frames landen auf der
Gegenseite im **anderen** VLAN («VLAN-Hopping»-Effekt); zusätzlich Warnung (Cisco meldet dies via CDP).

### 6.5 Neue Rechenzentrums-Geräte (nicht im Original)

| Gerät                             | Verhalten                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Server (Rack)                     | wie Rechner, mehr NICs, Höhe 1–2 HE, alle Server-Dienste installierbar                       |
| Layer-3-Switch                    | Switch + SVIs + Routing (statisch/RIP) + DHCP-Relay (`ip helper-address`)                    |
| Top-of-Rack-Switch / Spine-Switch | Varianten des L3-Switches mit typischer Portanzahl (48+4 bzw. 32) und Rollen-Symbol          |
| Firewall-Appliance                | Router mit Zonen und zustandsbehafteter Regeltabelle (erste passende Regel, Standard «deny») |
| Load Balancer                     | virtuelle IP (VIP), Pool aus Backends, Round-Robin pro neuer TCP-Verbindung                  |
| Storage (NAS)                     | Host mit Dateifreigabe (einfacher Dateidienst über TCP)                                      |
| VM-Host (optional)                | Host mit internem vSwitch und mehreren VMs (je eigene NIC/IP, VLAN-Tag möglich)              |

## 7. Phasenplan zur Freigabe

Jede Phase endet mit: Tests grün, Eintrag in `docs/FORTSCHRITT.md`, offene Fragen in
`docs/OFFENE-FRAGEN.md`, Git-Commit. Jede Phase liefert ein lauffähiges, statisches Build.

| Phase                  | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                        | Ergebnis / Abnahme                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2 Grundgerüst          | Vite + React 19 + TS strict, Tailwind v4, ESLint/Prettier, Vitest/Playwright-Gerüst, GitHub-Actions-CI, zod-Projektschema v1, Zustand-Store mit Undo/Redo, React-Flow-Canvas (Drag & Drop aus Gerätepalette, Kabel ziehen, Zoom, Minimap, Raster), Eigenschaften-Panel (Name, IP, Maske, Gateway, DNS, MAC), Speichern/Laden JSON + IndexedDB-Autosave, Dark/Light, de-CH/en-Wörterbuch, Worker-Brücke (leer) | Netz zeichnen, speichern, neu laden ist identisch; Undo/Redo-Tests               |
| 3 Engine L2/L3         | Scheduler, PRNG, Ethernet, Switch-Lernen, ARP, IPv4, ICMP, Router (statisch, automatische «connected»-Routen), Befehlszeile auf Rechnern (`ipconfig`, `ping`, `traceroute`, `route`, `arp`), Simulationsmodus-Schalter                                                                                                                                                                                        | Szenario «2 PCs + Switch» und «2 Netze + Router» pingen; ≥ 80 % Engine-Abdeckung |
| 4 VLANs                | 802.1Q, Access/Trunk/Native, MAC-Tabelle pro VLAN, SVIs, L3-Switch, Sub-Interfaces, Inter-VLAN-Routing, Cisco-CLI (`vlan`, `interface`, `switchport …`, `ip address`, `encapsulation dot1q`, `show vlan brief`, `show mac address-table`, `show ip route`, `show running-config`, `show interfaces trunk`), Port-Tabelle grafisch, Validierungen                                                              | Pflicht-Szenarien 1–7 grün                                                       |
| 5 Dienste              | UDP, TCP (Handshake sichtbar, vereinfacht), DHCP (+ Relay/`ip helper-address`), DNS, HTTP (Browser/Webserver), SMTP/POP3 (E-Mail-Server/-Programm), Texteditor, Firewall (Host + Appliance), RIP, Internet-Gateway mit NAT                                                                                                                                                                                    | Pflicht-Szenarien 8 und 10 grün                                                  |
| 6 Simulations-UI       | Paketanimation auf Kanten, Geschwindigkeit, Pause/Schritt, Datenaustausch-Ansicht pro Gerät (Tabelle, aufklappbar nach Schichten inkl. 802.1Q-Feld), VLAN-Einfärbung von Kabeln/Ports, Schritt-für-Schritt-Kommentare                                                                                                                                                                                         | E2E: Ping animieren und im Datenaustausch prüfen                                 |
| 7 Rechenzentrum        | neue Gerätetypen, Rack-Ansicht (HE), Zonen/Gruppen, 4 Vorlagen, Performance-Test mit 200 Geräten                                                                                                                                                                                                                                                                                                              | Pflicht-Szenario 9 grün; 200 Geräte ≥ 50 fps beim Verschieben                    |
| 8 Didaktik             | Aufgabenmodus (Ausgangsnetz, Auftragstext, Prüfregeln reachable / not reachable / dhcp-in-pool …), Erklär-Tooltips                                                                                                                                                                                                                                                                                            | Aufgaben-Tests                                                                   |
| 9 Import & Feinschliff | .fls-Import (Best Effort, Importbericht), Barrierefreiheit (axe-Prüfung), README mit Screenshots und «Erstes VLAN-Netz in 5 Minuten», Deployment-Anleitung                                                                                                                                                                                                                                                    | Beispiel-.fls importiert; `npm run build` ohne Warnungen                         |

**Grössenordnung:** Das ist ein umfangreiches Vorhaben (geschätzt 25–40 k Zeilen inkl. Tests).
Es wird über mehrere Arbeitsrunden entstehen; jede Runde schliesst mindestens eine Phase sauber ab.
