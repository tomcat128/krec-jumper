# KREC Jumper – Browserspiel mit gemeinsamer Bestenliste, ausgeliefert von einem kleinen Node-Server
FROM node:22-alpine
LABEL org.opencontainers.image.title="KREC Jumper" \
      org.opencontainers.image.description="Rollkunstlauf-Jump'n'Run des Konstanzer Roll- und Eissportclubs mit gemeinsamer Bestenliste" \
      org.opencontainers.image.source="https://github.com/tomcat128/krec-jumper"

WORKDIR /app
COPY ["server.js", "index.html", "game.js", "levels.js", "logo.png", "wir-vom-konstanzer-rec-(remastered).mp3", "./"]

# Die Bestenliste liegt in /data (als Volume einhängen, damit sie einen Neubau übersteht)
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
VOLUME /data
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
CMD ["node", "server.js"]
