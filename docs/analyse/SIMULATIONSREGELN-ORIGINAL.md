# Simulationsregeln Filius 2.14.0 (Referenz)

Aus dem Bytecode von `filius.jar` gelesen und in eigenen Worten beschrieben (kein übernommener Code).
Quellenangaben = Klasse.Methode im Original. «unsicher» = nicht vollständig aus dem Bytecode ableitbar.
RTT bezeichnet `Verbindung.holeRTT()` = 2500 ms bei Standardeinstellungen.

## Konstanten

| Name | Wert | Einheit | Quelle |
|---|---|---|---|
| Verzögerungsfaktor (Standard, Bereich) | 10 (1..100) | – | Verbindung.<clinit>, setzeVerzoegerungsFaktor |
| Geschwindigkeitsregler → Faktor | Faktor = Reglermaximum − Wert + 1 | – | GUIMainMenu.updateLatency |
| Kabelverzögerung pro Frame | Faktor × 5 (Standard 50) | ms | Verbindung.holeVerzoegerung |
| RTT | 50 × Verzögerung × rttFaktor (Standard 2500) | ms | Verbindung.holeRTT |
| rttFaktor (`rtt=` in filius.ini) | 1..5, Standard 1 | – | Verbindung.setRTTfactor |
| Ethernet-Typ IP / ARP | "0x800" / "0x806" | – | EthernetFrame |
| Ethernet-Broadcast | FF:FF:FF:FF:FF:FF | – | Ethernet |
| Switch-Ports | 24 | – | Switch.<init> |
| Lebensdauer MAC-Tabelleneintrag | 300 000 | ms | SwitchFirmware.<init> |
| Prüfintervall MAC-Tabelle | 1000 | ms | SwitchFirmware.starten |
| ARP-Versuche | 2, je 1 RTT warten | – | IP.sendeUnicastLokal |
| ARP-Opcode Request / Reply | 1 / 2 | – | ArpPaket |
| TTL (TCP/UDP/ICMP) | 64 | Hops | TransportProtokoll.run, ICMP.sendeICMP |
| TTL Broadcast | 1 | – | IP.sendBroadcastOverNic |
| Protokollnummern ICMP/TCP/UDP | 1 / 6 / 17 | – | IpPaket |
| ICMP-Typen | 0 Echo Reply, 3 Unreachable (Code 0 Netz, 1 Host), 8 Echo Request, 11 Time Exceeded | – | ICMP |
| Standard-NIC | 192.168.0.10 / 255.255.255.0 | – | NetzwerkInterface.<init> |
| NAT-Gateway WAN Standard | 42.0.0.10 / 255.0.0.0 | – | Gateway.<init> |
| TCP MSS | 1460 | Zeichen | TCPSocket.MSS |
| TCP Sendeversuche / Timeout | 3 / 3 × RTT | – | TCPSocket |
| TCP Start-Sequenznummer | Zähler × 1 000 000 | – | TCPSocket.<init> |
| Ephemere Ports | 49152 + Zufall(0..16382) | – | TransportProtokoll.sucheFreienPort |
| DHCP Server/Client-Port | 67 / 68 | – | DHCPServer, DHCPClient |
| DHCP-Lease | 24 | h | DHCPServer |
| DNS-Port, Timeout | 53, 5 × RTT ohne Wiederholung | – | DNSQueryAgent |
| HTTP / SMTP / POP3 | 80 / 25 / 110 | – | WebServer, EmailServer |
| RIP-Port | 520 (Absender 521) | – | RIPServer, RIPBeacon |
| RIP Unendlich / Intervall / Timeout | 16 / 30 000 / 75 000 | Hops / ms / ms | RIPTable |
| NAT-Eintrag Lebensdauer | 300 000 × Faktor | ms | GatewayFirmware |
| Ping-Anzahl / Takt | 4 / 1000 ms | – | Terminal.ping |
| Traceroute max. Hops / Proben | 20 / 3 | – | Terminal.traceroute |

## Kabel und Zeit
- Pro Kabel zwei Richtungen, je ein Thread; pro Richtung ein Frame nach dem anderen (FIFO), jeder Frame braucht «Kabelverzögerung». Keine Bandbreite, keine Kollision, keine MTU.
- Simulationsgeschwindigkeit ändert nur den Verzögerungsfaktor; RTT-basierte Timeouts skalieren mit.

## MAC / Ethernet
- MAC: 6 Zufalls-Oktette (0..254), eindeutig, Anzeige in Grossbuchstaben. Kein Unicast-/Lokal-Bit erzwungen.
- Frame: Ziel-MAC, Quell-MAC, Typ, Nutzlast. Kein FCS.
- Empfang: nur Broadcast oder eigene MAC; protokolliert wird jeder ankommende Frame.

## Switch
- Lernt Quell-MAC am Eingangsport (überschreibt), leitet an bekannten Port weiter (auch an den Eingangsport, keine Filterung), sonst Flut an alle verbundenen Ports ausser Eingang.
- Alterung 300 s, kein Spanning Tree.

## ARP
- Tabelle IP → MAC, **läuft nie ab** (nur `arp -d`). Vorbelegt mit 255.255.255.255 → Broadcast.
- Anfrage per Broadcast, 2 Versuche je 1 RTT. Antwort Unicast. Gratuitous Replies werden gelernt.
- Keine Antwort ⇒ ICMP Destination Unreachable (Host) an den Absender.

## IPv4 / Routing / ICMP
- Kein Fragmentieren, keine Prüfsumme.
- Lokale Ziele (127/8, eigene IP) gehen nicht aufs Netz.
- 255.255.255.255 auf allen Interfaces, TTL 1.
- Weiterleitung nur auf Routern/Gateways. TTL ≤ 1 ⇒ ICMP 11. Keine Route ⇒ ICMP 3/0.
- Routingtabelle automatisch: Host-Route je eigener IP, Netz-Route je Interface, Loopback, manuelle Einträge, Default-Route über Gateway des ersten Interfaces.
- Auswahl: längstes Präfix; mit RIP: wenigste Hops (≤ 15), dann längstes Präfix.
- Traceroute: TTL 1..20, je 3 Proben à 1 RTT, Abbruch nach > 5 Verlusten in Folge.

## TCP (vereinfacht)
- SYN, ACK, FIN, PSH; kein Fenster, kein RST. Zustände CLOSED … TIME_WAIT.
- Stop-and-Wait: jedes Segment (max. 1460 Zeichen) wartet auf sein ACK (3 × RTT, 3 Versuche).
- Kein RST für geschlossene Ports (stilles Verwerfen).

## Dienste
- **DHCP**: Text-Nachrichten DISCOVER/OFFER/REQUEST/ACK/NAK/DECLINE; Client prüft angebotene Adresse per ARP; nach 5 Fehlern Link-Local 169.254.x; Server mit Pool (Start/Ende), statischen Zuordnungen MAC→IP, Lease 24 h. **Kein Relay im Original.**
- **DNS**: Datensätze A, MX, NS; Rekursion optional; Client folgt Verweisen, kein Cache.
- **HTTP**: GET/POST, Dateien aus `/webserver`, `/` → index.html, 404/501/500, virtuelle Hosts.
- **SMTP/POP3**: HELO/EHLO, MAIL FROM, RCPT TO, DATA, QUIT / USER, PASS, STAT, LIST, RETR, DELE, RSET, QUIT. Weiterleitung an fremde Domänen per MX.
- **RIP**: alle 30 s × (0.84 + Zufall/3), Split Horizon, Hops+1, Unendlich 16, Timeout 75 s.
- **Firewall**: Regeln (Quelle IP/Maske, Ziel IP/Maske, Ziel-Port, Protokoll, Aktion), erste passende Regel gewinnt, Standard DROP, TCP nur SYN geprüft, ICMP nur per Schalter. Prüft eingehende Frames auf allen Interfaces.
- **NAT-Gateway**: WAN = Interface 0, LAN = Interface 1, PAT, statische Portweiterleitungen.

## Befehlszeile
`ipconfig`, `route`, `arp [-a ip | -d [ip]]`, `arpsend`, `netstat`, `ping`, `traceroute`, `host`/`nslookup`, `tcpdump`, Dateibefehle (`dir`/`ls`, `cd`, `pwd`, `mkdir`, `touch`, `cat`/`type`, `cp`/`copy`, `mv`/`move`, `rm`/`del`), `help`, `exit`, `cls`, `reset`.

## Datenaustausch
Spalten: Nr. | Zeit | Quelle | Ziel | Protokoll | Schicht | Bemerkungen.
Schichten: Netzzugang, Vermittlung, Transport, Anwendung. Ein Frame ergibt mehrere Zeilen mit derselben Nr. (eine pro Schicht).

## Eingabeprüfung
IP (4 Oktette 0..255), Netzmaske (zusammenhängende Einsen, 0.0.0.0 ungültig), MAC (6 Hex-Paare mit «:»), Hostname (Labels mit Buchstabe am Anfang, ≤ 63 Zeichen), Port 1..65535, E-Mail «Name <user@domain>» oder «user@domain».
