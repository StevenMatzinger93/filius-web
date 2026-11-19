# Das Filius-Projektformat (.fls)

Ermittelt an Filius 2.14.0 aus dem Bytecode von `filius.jar` (Klasse `SzenarioVerwaltung`)
und an zwei echten Beispieldateien, die mit den Original-Klassen erzeugt wurden
(`tests/fixtures/fls/min.fls`: ein PC und ein Switch; `full.fls`: alle Gerätetypen,
Anwendungen, Route, DNS-Eintrag, Firewall-Regel, E-Mail-Konto, DHCP, zwei Dokumentationselemente).

Kennzeichnung: **[beob.]** in echter Datei gesehen, **[code]** aus dem Bytecode, **[unsicher]** abgeleitet.

## 1. Container

Eine `.fls`-Datei ist ein normales **ZIP** mit:

| Eintrag                                     | Inhalt                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| `projekt/konfiguration.xml`                 | das Netz, geschrieben mit `java.beans.XMLEncoder`    |
| `projekt/anwendungen/EigeneAnwendungen.txt` | Liste selbst programmierter Anwendungen (meist leer) |
| `projekt/anwendungen/*`                     | ggf. Quelltexte/Klassen eigener Anwendungen          |

- Unter Windows stehen die Pfade mit **Backslash** im ZIP (`projekt\konfiguration.xml`) [beob.].
  Der Import muss `/` und `\` akzeptieren.
- Es gibt keine Verzeichniseinträge, nur Dateien [code].

## 2. Aufbau von konfiguration.xml

Wurzel `<java version="…" class="java.beans.XMLDecoder">` mit vier Kindern in fester Reihenfolge:

1. `<string>Filius version: 2.14.0 (29.08.2026)</string>` – Version (semver zwischen «: » und dem nächsten Leerzeichen). Fehlt der String, stammt die Datei von vor 1.3.0; laden trotzdem.
2. `LinkedList` von `filius.gui.netzwerksicht.GUIKnotenItem` – die Geräte.
3. `LinkedList` von `GUIKabelItem` – die Kabel.
4. `LinkedList` von `GUIDocuItem` – Dokumentationselemente (darf leer sein: `<object class="java.util.LinkedList"/>`).

### Regeln von XMLEncoder, die der Import beachten muss

- **Standardwerte fehlen.** Nur Eigenschaften, die vom frisch erzeugten Objekt abweichen, stehen in der Datei. Der Import muss die Standardwerte kennen (Abschnitt 5).
- **Vom Konstruktor erzeugte Objekte werden verändert, nicht neu erzeugt:**
  `<void property="systemSoftware">…</void>` = Getter aufrufen, dann innere Anweisungen anwenden.
  `<void index="0">…</void>` verändert ein vorhandenes Listenelement, `<void method="add">` hängt an.
- **id / idref:** `id` nur bei mehrfacher Verwendung. `<void id="Port0" property="port"/>` = Getter-Ergebnis als «Port0» merken.
- **Gemeinsam genutzte Werte:** Zahlen/Booleans werden über `idref` wiederverwendet, auch aus fremden Kontexten
  (z. B. `<object class="javax.swing.SwingConstants" field="CENTER"/>` = 0). Der Import braucht eine allgemeine
  id-Tabelle und kennt einige Getter-Werte fest: `isEnabled`=true, `iconTextGap`=4, `verticalTextPosition`=0,
  `maxPriority`=10, WebServer `port`=80, DHCP `port`=67.
- **Öffentliche Felder** (FirewallRule, Rectangle) erscheinen als
  `<void class="X" method="getField"><string>name</string><void method="set"><object idref="self"/>WERT</void></void>`.
- Ältere Versionen schreiben `Rectangle` evtl. als Konstruktor `<int>x</int><int>y</int><int>w</int><int>h</int>` [unsicher] – beide Formen akzeptieren.

## 3. Gespeicherte Eigenschaften

| Klasse                                                           | Eigenschaften                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GUIKnotenItem                                                    | `imageLabel` (JSidebarButton), `knoten` (Knoten)                                                                                                                                                                                           |
| JSidebarButton                                                   | `bounds` (Rectangle: Position/Grösse auf der Zeichenfläche), `text` (Anzeigename), `typ` (lokalisiert, unzuverlässig), `icon` (absolute jar-URL, ignorieren)                                                                               |
| GUIKabelItem                                                     | `dasKabel` (Kabel), `kabelpanel` (`ziel1`, `ziel2` = idrefs auf die GUIKnotenItems)                                                                                                                                                        |
| GUIDocuItem                                                      | `type` (1 Rechteck, 2 Text), `text`, `x`, `y`, `width`, `height`, `color` (Color r,g,b,a), `font` (Name, Stil 0/1/2, Grösse)                                                                                                               |
| Kabel                                                            | `anschluesse` (Port[2] als idrefs), `wireless`                                                                                                                                                                                             |
| NetzwerkInterface                                                | `mac`, `ip`, `subnetzMaske`, `gateway`, `dns`, `port`, `wireless`                                                                                                                                                                          |
| Knoten                                                           | `name`, `systemSoftware`                                                                                                                                                                                                                   |
| InternetKnoten (Rechner, Notebook, Vermittlungsrechner, Gateway) | `netzwerkInterfaces`, `maxLayerOfOperation`                                                                                                                                                                                                |
| Host                                                             | `useIPAsName`, `useMACAsName`                                                                                                                                                                                                              |
| LokalerKnoten (Switch, Modem)                                    | `anschluesse` (LinkedList&lt;Port&gt;, Index = Portnummer)                                                                                                                                                                                 |
| Switch                                                           | `cloud`                                                                                                                                                                                                                                    |
| Betriebssystem-Klassen                                           | `DHCPKonfiguration` (DHCP-Client an), `DHCPServer`, `DNSServer`, `standardGateway`, `dateisystem`, `installierteAnwendungen` (Map Klassenname → Anwendung), `ipForwardingEnabled`, `weiterleitungstabelle`, Router zusätzlich `ripEnabled` |
| Weiterleitungstabelle                                            | `manuelleTabelle`: Liste von String[4] = [Zielnetz, Maske, Gateway, Interface-IP] (Spaltenbedeutung [unsicher])                                                                                                                            |
| GatewayFirmware                                                  | `staticNAT` (Liste von String[], Spalten [unsicher])                                                                                                                                                                                       |
| Dateisystem                                                      | Baum aus `DefaultMutableTreeNode`; `userObject` = Ordnername (String) oder `Datei` (`name`, `dateiTyp`, `dateiInhalt`; Binärdaten Base64)                                                                                                  |
| DHCPServer                                                       | `aktiv`, `untergrenze`, `obergrenze`, `gatewayip`, `dnsserverip`, `ownSettings`, `staticAssignedAddresses` («MAC IP»)                                                                                                                      |
| DNSServer                                                        | `recursiveResolutionEnabled`; **Einträge stehen in der Datei `dns/hosts`** des Dateisystems: `name. TYP TTL daten`                                                                                                                         |
| WebServer                                                        | `useVHost`, `plugins`; Seiten im Ordner `webserver/` des Dateisystems                                                                                                                                                                      |
| EmailServer                                                      | `mailDomain`, `aktiv`, `listeBenutzerkonten` (EmailKonto: `benutzername`, `passwort`, `vorname`, `nachname`, `emailAdresse`, `nachrichten`)                                                                                                |
| EmailAnwendung                                                   | `adressbuch`, empfangene/erstellte/gesendete Nachrichten                                                                                                                                                                                   |
| Firewall / NatGateway                                            | `activated`, `dropICMP`, `filterSYNSegmentsOnly`, `filterUdp`, `defaultPolicy`, `ruleset`                                                                                                                                                  |
| FirewallRule (Felder)                                            | `srcIP`, `srcMask`, `destIP`, `destMask`, `port` (−1 = alle), `protocol` (−1 alle, 1 ICMP, 6 TCP, 17 UDP), `action` (0 DROP, 1 ACCEPT); «gleiches Netz» = `999.999.999.999`                                                                |

Installierte Anwendungen: `installierteAnwendungen` → `<void method="put"><string>filius.software.www.WebServer</string><object class="filius.software.www.WebServer">…`.

## 4. Kabelenden

`Kabel.anschluesse` ist ein Array aus zwei `idref="PortN"`. Die ids entstehen in den Geräten:

- PC/Router/Heimrouter: `<void id="Port0" property="port"/>` in einem NetzwerkInterface.
- Switch/Modem: `<void id="Port1" index="0"/>` in `anschluesse` (Index = Portnummer).

Zuordnung: Port-id → NIC bzw. Switch-Port → Gerät. `kabelpanel.ziel1/ziel2` bestätigt die Geräte.

## 5. Gerätetypen und Standardwerte

Der **`class`-Name** ist der verlässliche Typ (`holeHardwareTyp()` ist übersetzt).

| Klasse                           | Neuer Gerätetyp                          | Standardwerte                                                                         |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `filius.hardware.knoten.Rechner` | `pc`                                     | 1 NIC 192.168.0.10/255.255.255.0, Gateway/DNS leer                                    |
| `…Notebook`                      | `notebook`                               | wie Rechner                                                                           |
| `…Switch`                        | `switch`                                 | 24 Ports, Alterung 300 s                                                              |
| `…Vermittlungsrechner`           | `router`                                 | NICs laut Datei (2–8), Weiterleitung an, RIP aus, Webserver + Firewall vorinstalliert |
| `…Gateway`                       | `gateway` (Internet-Gateway, NAT)        | NIC0 = WAN 42.0.0.10/255.0.0.0, NIC1 = LAN 192.168.0.10/24                            |
| `…Modem`                         | `modem` (nur als Platzhalter importiert) | localhost:12345                                                                       |

## 6. Abbildung beim Import (geplant, Phase 9)

- Geräte → `devices[]` mit Position aus `bounds` (x, y), Name aus `knoten.name`.
- NICs → `interfaces[]`, MAC übernehmen, IP/Maske/Gateway/DNS (Standardwerte ergänzen).
- Kabel → `links[]` über Port-ids.
- Anwendungen → Dienste der neuen App (Webserver, DNS-Server mit `dns/hosts`, DHCP-Server, E-Mail, Firewall, Texteditor-Dateien).
- Dokumentationselemente → Zonen/Notizen auf dem Canvas.
- Nicht übertragbar (wird im Importbericht gemeldet): eigene Anwendungen, Modem-Tunnel, Peer-to-Peer.
