FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# The base image ships pip 25.0.1, which Trivy flags for 6 CVEs (CVE-2026-13346,
# CVE-2026-8643, CVE-2026-6357, CVE-2026-3219, CVE-2026-1703, CVE-2025-8869 —
# malicious-index/wheel handling). Pinned rather than a bare --upgrade so the
# build stays reproducible; bump this when Trivy flags the pinned version.
RUN pip install --no-cache-dir --upgrade "pip==26.2.1"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
