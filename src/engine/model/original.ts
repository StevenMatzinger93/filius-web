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
