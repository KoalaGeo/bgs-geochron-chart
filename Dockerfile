# ---------------------------------------------------------------------------
# Stage 1: Base environment with Node 24, pnpm, and Python 3 (rdflib)
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install --global pnpm@10.28.2

WORKDIR /app

# Install Python dependencies for bgs/build_bgs_chart.py
COPY bgs/requirements.txt ./bgs/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r bgs/requirements.txt

# Install locked Node dependencies for chart-ui
COPY chart-ui/package.json chart-ui/pnpm-lock.yaml ./chart-ui/
COPY chart-ui/patches ./chart-ui/patches
RUN cd chart-ui && pnpm install --frozen-lockfile

# Copy repository source
COPY chart.ttl ./chart.ttl
COPY bgs ./bgs
COPY chart-ui ./chart-ui

# ---------------------------------------------------------------------------
# Stage 2: Development server target (used by `docker compose --profile dev up`)
# ---------------------------------------------------------------------------
FROM base AS dev
WORKDIR /app/chart-ui
ENV CHART_SOURCE=bgs
ENV NUXT_APP_BASE_URL=/
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]

# ---------------------------------------------------------------------------
# Stage 3: Static site builder
# ---------------------------------------------------------------------------
FROM base AS build
WORKDIR /app/chart-ui

ARG CHART_SOURCE=bgs
ARG BASE_URL=/
ARG FETCH_VOCABS=true
ARG VOCAB_BASE_URL=https://raw.githubusercontent.com/BritishGeologicalSurvey/vocabularies/main/prez/vocabs/
ARG SOURCE_LABEL=BritishGeologicalSurvey/vocabularies@main
ARG MIN_UNITS=1000
ARG MIN_RCS=500
ARG CACHE_BUST=0

ENV CHART_SOURCE=${CHART_SOURCE}
ENV NUXT_APP_BASE_URL=${BASE_URL}

RUN echo "cache bust: ${CACHE_BUST}" \
 && node --test scripts/test-bgs-vocabs.mjs \
 && if [ "${CHART_SOURCE}" = "bgs" ] && [ "${FETCH_VOCABS}" = "true" ]; then \
      echo "Fetching BGS vocabularies from ${VOCAB_BASE_URL} ..." && \
      VOCAB_BASE_URL="${VOCAB_BASE_URL}" SOURCE_LABEL="${SOURCE_LABEL}" MIN_UNITS="${MIN_UNITS}" MIN_RCS="${MIN_RCS}" \
        node scripts/build-bgs-vocabs.mjs && \
      python3 ../bgs/build_bgs_chart.py \
        --ttl ../bgs/build/.cache/vocabs/Geochronology.ttl \
        --source-label "${SOURCE_LABEL} Geochronology.ttl"; \
    fi \
 && node scripts/check-chart-data.mjs \
 && pnpm generate

# ---------------------------------------------------------------------------
# Stage 4: Production static runtime with nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/chart-ui/.output/public /usr/share/nginx/html

EXPOSE 80
