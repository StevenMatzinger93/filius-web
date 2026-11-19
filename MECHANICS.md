# Mechanik-Blatt

Werte und Regeln, die die neue Engine vom Original Filius 2.14.0 übernimmt.
Quelle ist jeweils die Klasse/Methode in `filius.jar` (Java-Bytecode; das Windows-Programm
selbst ist nur ein NSIS-Installer ohne Simulationslogik, daher gibt es keine nativen
Funktionsadressen). Die ausführliche Beschreibung steht in
`docs/analyse/SIMULATIONSREGELN-ORIGINAL.md`; die maschinenlesbare Fassung in `mechanics.json`.

Werte ohne Gegenstück im Original (VLAN-ID-Bereich 1–4094, TPID 0x8100, PCP/DEI) stammen aus
IEEE 802.1Q und sind in `mechanics.json` als `estimated` markiert, weil das Original sie nicht kennt.

## Abweichungen, die die neue Engine bewusst macht (echtes Verhalten statt Filius)

| Thema | Filius | Neue Engine | Grund |
|---|---|---|---|
| Zeit | echte Threads, Kabelverzögerung 50 ms | virtuelle Zeit, gleiche Standardverzögerung 50 ms pro Hop | deterministisch, testbar |
| Switch sendet an Eingangsport zurück | ja | nein (Filterung wie IEEE 802.1D) | echtes Verhalten |
| ARP-Cache | läuft nie ab | Alterung 4 h (Cisco-Standard), `arp -d` bleibt | echtes Verhalten |
| TCP-Port geschlossen | stilles Verwerfen | RST | echtes Verhalten, sichtbarer Lerneffekt |
| Hosts leiten ICMP weiter | möglich (unsicher) | nein | echtes Verhalten |
| DHCP-Relay | nicht vorhanden | `ip helper-address` (giaddr) | Auftrag |
| Firewall und ICMP | ICMP nur per Schalter | ICMP als Protokoll in Regeln | Auftrag (Szenario 10) |
