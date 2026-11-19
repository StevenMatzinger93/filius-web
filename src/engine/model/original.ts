/**
 * Werte aus dem Original (Filius 2.14.0, filius.jar), gelesen aus dem dekompilierten Bytecode.
 * Quelle jeweils Klasse.Methode @ Bytecode-Offset; Details in MECHANICS.md.
 * Nur Werte, die der Bau tatsächlich verwendet.
 */

/** Standard-Adresse jeder neuen Netzwerkkarte – NetzwerkInterface.<init> @0x0027. */
export const DEFAULT_NIC_IP = '192.168.0.10';
/** Standard-Maske jeder neuen Netzwerkkarte (255.255.255.0) – NetzwerkInterface.<init> @0x002d. */
export const DEFAULT_NIC_PREFIX = 24;

/** WAN-Adresse des Heimrouters – Gateway.<init> @0x0012. */
export const GATEWAY_WAN_IP = '42.0.0.10';
/** WAN-Maske des Heimrouters (255.0.0.0) – Gateway.<init> @0x001b. */
export const GATEWAY_WAN_PREFIX = 8;

/** Anschlüsse eines Switches – Switch.<init> @0x0022 (bipush 24). */
export const SWITCH_PORTS = 24;

/** Schnittstellen eines neuen Routers, wenn die Abfrage abgebrochen wird – GUIContainer.neuerKnoten. */
export const ROUTER_DEFAULT_INTERFACES = 2;
/** Auswahl bei der Abfrage «Anzahl Schnittstellen»: 2 … 8 – GUIContainer.neuerKnoten. */
export const ROUTER_CHOICE_MIN = 2;
/** Höchstzahl Schnittstellen – JConnectionsDialog$2.actionPerformed @0x0009, Text «Maximal 8 Schnittstellen erlaubt!». */
export const ROUTER_MAX_INTERFACES = 8;
/** Ein Vermittlungsrechner wird mit 1 Schnittstelle konstruiert – Vermittlungsrechner.<init> @0x0022. */
export const ROUTER_MIN_INTERFACES = 1;

/** MAC-Oktette sind Random.nextInt(255), also 0 … 254 – Information.holeFreieMACAdresse @0x001c. */
export const MAC_OCTET_MAX = 254;

// ------------------------------------------------------------------ Simulation (Phase 3)

/** Standard-Verzögerungsfaktor – Verbindung.<clinit> @0x0008 (bipush 10). */
export const DELAY_FACTOR = 10;
/** Kabelverzögerung pro Frame = Faktor × 5 ms – Verbindung.holeVerzoegerung @0x0003. */
export const LINK_DELAY_MS = DELAY_FACTOR * 5;
/** Wartezeit (RTT) = 50 × Verzögerung × rttFaktor(1) – Verbindung.holeRTT @0x0000, Verbindung.<clinit> @0x0011. */
export const RTT_MS = 50 * LINK_DELAY_MS * 1;
/** ARP-Anfragen, bevor aufgegeben wird – IP.sendeUnicastLokal (holeARPTabellenEintrag(ip, 2, …)). */
export const ARP_ATTEMPTS = 2;
/** Lebensdauer eines MAC-Tabelleneintrags im Switch – SwitchFirmware.<init> @0x002b (300000L). */
export const MAC_AGING_MS = 300_000;
/** TTL neuer IP-Pakete – ICMP.sendeICMP / TransportProtokoll.run. */
export const DEFAULT_TTL = 64;
/** Anzahl Echo-Anfragen eines Pings – Information.getPingRepeat (Standard 4), Terminal.ping. */
export const PING_COUNT = 4;
/** Takt der Echo-Anfragen – Terminal.ping (1000L − verstrichene Zeit). */
export const PING_INTERVAL_MS = 1000;
/** Traceroute: höchstens 20 Stationen, 3 Proben je Station – Terminal.traceroute. */
export const TRACEROUTE_MAX_HOPS = 20;
export const TRACEROUTE_PROBES = 3;
/** Traceroute bricht nach mehr als 5 Verlusten in Folge ab – Terminal.traceroute. */
export const TRACEROUTE_MAX_LOSSES = 5;
