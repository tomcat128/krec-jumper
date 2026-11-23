# KREC Jumper – Browserspiel mit gemeinsamer Bestenliste, ausgeliefert von einem kleinen Node-Server
FROM node:22-alpine
LABEL org.opencontainers.image.title="KREC Jumper" \
      org.opencontainers.image.description="Rollkunstlauf-Jump'n'Run des Konstanzer Roll- und Eissportclubs mit gemeinsamer Bestenliste" \
      org.opencontainers.image.source="https://github.com/tomcat128/krec-jumper"

WORKDIR /app
COPY ["server.js", "start.sh", "index.html", "game.js", "levels.js", "logo.png", "wir-vom-konstanzer-rec-(remastered).mp3", "./"]

# Die Bestenliste liegt in /data (als Volume einhängen, damit sie einen Neubau übersteht).
# Der Container startet als root, start.sh übergibt /data an den Benutzer „node" und läuft dann als dieser weiter –
# so klappt das Speichern auch, wenn ein Ordner des Hosts eingehängt wird, der root gehört.
RUN apk add --no-cache su-exec && mkdir -p /data && chown node:node /data && chmod +x /app/start.sh
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
VOLUME /data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
ENTRYPOINT ["/app/start.sh"]
CMD ["node", "server.js"]
