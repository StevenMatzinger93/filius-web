"""Desktop-Starter für Filius Web.

Die App selbst ist ein rein statisches Web-Bundle (dist/). Dieser Starter liefert dist/ lokal
(nur 127.0.0.1) aus und öffnet es in einem eigenen App-Fenster von Chrome oder Edge – ohne Installation,
ohne Internet. Nur Python-Standardbibliothek.

    python main.py                       # App-Fenster öffnen
    python main.py --screenshot bild.png # Bild der App speichern und beenden (für Prüfungen)

Mit --screenshot läuft der Browser ohne Fenster (headless), stiehlt also keinen Fokus und zeichnet
auch im Hintergrund weiter; nach dem Laden (virtuelle Zeit 6 s, entspricht weit über 120 Bildern)
wird das Bild gespeichert und das Programm beendet.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
WIDTH, HEIGHT = 1440, 900

# Module-Worker brauchen den richtigen MIME-Typ; die Windows-Registry liefert für .js manchmal text/plain.
MIME = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".html": "text/html",
    ".png": "image/png",
    ".wasm": "application/wasm",
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **MIME}

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - Signatur der Basisklasse
        pass

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def start_server() -> tuple[http.server.ThreadingHTTPServer, str]:
    if not (DIST / "index.html").is_file():
        sys.exit("dist/ fehlt – bitte zuerst «npm install» und «npm run build» ausführen.")
    port = free_port()
    handler = functools.partial(QuietHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{port}/"


def find_browser() -> str | None:
    candidates = [
        os.environ.get("FILIUS_WEB_BROWSER", ""),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for name in ("google-chrome", "chromium", "chromium-browser", "microsoft-edge", "chrome", "msedge"):
        found = shutil.which(name)
        if found:
            candidates.append(found)
    for path in candidates:
        if path and Path(path).is_file():
            return path
    return None


def take_screenshot(output: Path) -> int:
    browser = find_browser()
    if browser is None:
        print("Kein Chrome/Edge gefunden – Bild kann nicht erstellt werden.", file=sys.stderr)
        return 2
    server, url = start_server()
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    profile = tempfile.mkdtemp(prefix="filius-web-shot-")
    try:
        args = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            f"--user-data-dir={profile}",
            f"--window-size={WIDTH},{HEIGHT}",
            "--virtual-time-budget=6000",
            f"--screenshot={output}",
            url,
        ]
        subprocess.run(args, check=False, timeout=120, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not output.is_file() or output.stat().st_size == 0:
            print("Das Bild wurde nicht erstellt.", file=sys.stderr)
            return 1
        print(f"Bild gespeichert: {output}")
        return 0
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)


def open_app() -> int:
    server, url = start_server()
    browser = find_browser()
    print(f"Filius Web läuft auf {url} (nur auf diesem Rechner). Beenden mit Strg+C.")
    try:
        if browser:
            # Eigenes Profil, damit das App-Fenster ein eigener Prozess ist und das Schliessen erkannt wird.
            profile = Path(tempfile.gettempdir()) / "filius-web-profile"
            proc = subprocess.Popen(
                [
                    browser,
                    f"--app={url}",
                    f"--user-data-dir={profile}",
                    f"--window-size={WIDTH},{HEIGHT}",
                    "--no-first-run",
                    "--no-default-browser-check",
                ]
            )
            proc.wait()
        else:
            webbrowser.open(url)
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Filius Web starten")
    parser.add_argument("--screenshot", type=Path, metavar="DATEI.png", help="Bild speichern und beenden")
    args = parser.parse_args()
    if args.screenshot:
        return take_screenshot(args.screenshot)
    return open_app()


if __name__ == "__main__":
    sys.exit(main())
