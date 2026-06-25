# Includes Python, Playwright system dependencies, and preinstalled browsers.
# Keep this tag aligned with the playwright version in requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.58.0-noble

# Build/runtime deps used by lxml and database packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libxml2-dev \
    libxslt-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only Torch first so the generic requirements install does not pull
# CUDA/NVIDIA wheels into the collector image.
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir --index-url "$TORCH_INDEX_URL" "torch>=2.6.0"

# Install project dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy runtime code after dependency installation so source changes reuse cached deps.
COPY analysis ./analysis
COPY backend ./backend
COPY collectors ./collectors

WORKDIR /app/collectors

CMD ["python", "scheduler.py"]
