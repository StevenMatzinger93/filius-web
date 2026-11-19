# Datenmodell und Dateiformat

Projektdateien heissen `*.filiusweb.json`. Das Schema ist versioniert; die Prüfung steht in
`src/io/schema.ts` (zod), die Typen in `src/engine/model/project.ts`. Ein Kompilierzeit-Test stellt
sicher, dass beide übereinstimmen.

## Version 1

```jsonc
{
  "schema": "filius-web/project", // fest
  "version": 1, // Schema-Version; neuere Dateien werden mit Hinweis abgelehnt
  "meta": { "name": "Erstes Netz", "created": "ISO-Zeit", "modified": "ISO-Zeit" },
  "seed": 2026, // Seed für den Zufallsgenerator (MAC-Adressen, später TCP/Ports)
  "nextId": 34, // nächste fortlaufende id
  "devices": [
    {
      "id": "dev1",
      "type": "pc", // pc | notebook | switch | router | gateway | server | l3switch
      // | tor | spine | firewall | loadbalancer | nas | vmhost
      "name": "PC1",
      "position": { "x": 140, "y": 380 },
      "interfaces": [
        {
          "id": "if2",
          "name": "eth0", // Switch: Gi0/1 … Gi0/24, Router: Gi0/0 …, Gateway: WAN/LAN
          "mac": "02:63:76:0F:72:C1",
          "enabled": true,
          "ipv4": { "address": "192.168.0.10", "prefix": 24 }, // oder null
        },
      ],
      "gateway": "192.168.0.1", // "" = keins
      "dns": "", // "" = keiner
      "dhcpClient": false,
      "note": "",
    },
  ],
  "links": [
    {
      "id": "link5",
      "a": { "deviceId": "dev2", "interfaceId": "if3" },
      "b": { "deviceId": "dev1", "interfaceId": "if4" },
    },
  ],
}
```

## Prüfregeln

- IP-Adressen: vier Oktette 0–255 ohne führende Nullen; Präfix 0–32.
- MAC: sechs Hex-Paare mit «:», Grossbuchstaben.
- Name: 1–64 Zeichen.
- Kabel: beide Enden zeigen auf ein vorhandenes Interface des genannten Geräts; jedes Interface trägt
  höchstens ein Kabel.

## Erweiterungen in späteren Phasen

Neue Felder (VLAN-Datenbank, Switchport-Modus, virtuelle Interfaces, Dienste, Racks, Zonen, Aufgaben)
kommen mit einer neuen Schema-Version und einer Migrationsfunktion `v1 → v2` in `src/io/serialize.ts`;
alte Dateien bleiben lesbar.
