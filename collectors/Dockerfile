FROM python:3.10-slim

# System deps for Playwright, lxml, psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libxml2-dev \
    libxslt-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy entire project (collector imports from backend/ and analysis/)
COPY . /app

# Install collector dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install backend dependencies needed by ingestion_pipeline
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    alembic \
    pydantic \
    python-multipart

# Install Playwright browsers (needed for SPA/darknet forum collection)
RUN pip install --no-cache-dir playwright && playwright install --with-deps chromium

WORKDIR /app/collectors

CMD ["python", "scheduler.py"]
