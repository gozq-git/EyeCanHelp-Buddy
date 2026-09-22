FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# The base image ships pip 25.0.1, which Trivy flags for 6 CVEs (malicious-index
# and malicious-wheel handling). Pinned rather than a bare --upgrade so the build
# stays reproducible; bump this when Trivy flags the pinned version.
# --only-binary is needed here too, not just on the install below: pip is itself a
# package, so without it this line can run a setup script (Sonar docker:S8541).
RUN pip install --no-cache-dir --only-binary=:all: --upgrade "pip==26.2.1"

# requirements.lock pins every transitive version *and* its wheel hash, so the image
# is reproducible instead of re-resolving on each build. requirements.txt is kept
# alongside it as the human-edited intent; see the lock file header for how to
# regenerate after changing it.
COPY agents/coordinator/requirements.txt ./requirements.txt
COPY agents/coordinator/requirements.lock ./requirements.lock
# --only-binary: wheels only, so no dependency can run arbitrary code at install
# time (Sonar docker:S8541). --require-hashes: every artifact must match a hash in
# the lock, so a compromised index cannot swap in a different build of a version we
# already pinned (Sonar docker:S8544) — exact pins alone do not cover that, and the
# flag also makes pip reject the install outright if the lock is ever incomplete.
RUN pip install --no-cache-dir --only-binary=:all: --require-hashes -r ./requirements.lock

# Copy only the coordinator sources instead of the whole build context, so
# tests/tooling cannot leak into the image (Sonar docker:S6470)
COPY agents/coordinator/ ./agents/coordinator/

# The CI workflow writes the BACKEND_ENV_FILE secret to backend/.env before
# building; main.py's load_dotenv() needs it or the agent starts unconfigured
# (no knowledge base, no hotline contact). Named explicitly rather than via a
# `.env*` glob, which also matched .env.example and anything else beginning
# ".env" that happened to be in the context (Sonar docker:S6470). A local build
# without backend/.env now fails here instead of silently producing an
# unconfigured image.
COPY .env ./

# Run as a non-root user (Sonar docker:S6471)
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["opentelemetry-instrument", "python", "agents/coordinator/main.py"]
