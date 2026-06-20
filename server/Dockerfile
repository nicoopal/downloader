FROM python:3.12-slim

# ffmpeg es necesario para unir video+audio y para extraer mp3.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Deno: runtime de JavaScript que yt-dlp necesita para resolver el desafío
# de firma de YouTube (EJS). Sin esto YouTube solo ofrece storyboards.
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# yt-dlp nightly: extractores al día (TikTok/YouTube/etc. cambian seguido).
RUN pip install --no-cache-dir -U --pre "yt-dlp[default]"

COPY . .

# Cloud Run inyecta el puerto en $PORT (8080 por defecto).
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
