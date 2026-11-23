#!/bin/sh
# Startet den Spielserver. Ein von außen eingehängter Datenordner gehört oft root – dann könnte der Server
# (Benutzer „node") die Bestenliste nicht speichern. Deshalb: als root kurz den Ordner übergeben, danach
# ohne root-Rechte weiterlaufen.
set -e
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "${DATA_DIR:-/data}" 2>/dev/null || echo "Hinweis: Besitzer von ${DATA_DIR:-/data} ließ sich nicht ändern." >&2
  exec su-exec node "$@"
fi
exec "$@"
