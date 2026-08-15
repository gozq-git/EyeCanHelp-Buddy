FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY agents/coordinator/requirements.txt ./requirements.txt
# Wheels only, so no dependency can run arbitrary code at install time (Sonar docker:S8541)
RUN pip install --no-cache-dir --only-binary=:all: -r ./requirements.txt

# Copy only the coordinator sources instead of the whole build context, so
# secrets/tests/tooling can never leak into the image (Sonar docker:S6470)
COPY agents/coordinator/ ./agents/coordinator/

# Run as a non-root user (Sonar docker:S6471)
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["opentelemetry-instrument", "python", "agents/coordinator/main.py"]
