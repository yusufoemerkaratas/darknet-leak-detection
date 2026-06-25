# Docker Build Optimization

Issue #49 optimizes Docker layer caching for development builds without changing
service commands, ports, or runtime configuration.

## Changes

- Added a root `.dockerignore` so collector builds do not send Git metadata,
  local environments, generated storage, docs, frontend assets, and other
  non-runtime files in the build context.
- Moved the backend dependency installation before copying backend source files.
- Split the collector build into dependency and source layers:
  `requirements.txt` is copied and installed before `analysis/`, `backend/`,
  and `collectors/` are copied.
- Installed CPU-only Torch before the full collector requirements so Docker does
  not download CUDA/NVIDIA wheels for the default `MOONDREAM_DEVICE=cpu`
  configuration.
- Kept the collector Playwright base image aligned with `playwright==1.58.0`.

## Build Time Measurements

Measurements were taken locally on 2026-06-25 with:

```sh
time -p docker compose build
```

| Scenario | Result |
| --- | ---: |
| First optimized build before CPU-only Torch preinstall | 1889.80s |
| First collector build after CPU-only Torch preinstall | 358.02s |
| Collector rebuild with unchanged dependency files and cached Docker layers | 0.38s |
| Full rebuild with unchanged dependency files and cached Docker layers | 0.84s |

The second build reused the dependency layers for backend, frontend, tor, and
collector. In particular, the collector step
`RUN pip install --no-cache-dir -r requirements.txt` returned `Using cache`, so
collector dependencies are not reinstalled when `requirements.txt` is unchanged.cua

The initial 1889.80s build was taken before the CPU-only Torch preinstall was
added. That build spent most of its time downloading CUDA/NVIDIA wheels even
though the Compose default uses `MOONDREAM_DEVICE=cpu`. The CPU-only preinstall
keeps Moondream available for the default CPU runtime while avoiding that
unnecessary download path; the collector first build dropped to 358.02s.

Before this optimization, `backend/Dockerfile` and `collectors/Dockerfile`
copied source files before dependency installation. A source-only change could
therefore invalidate the dependency installation layer; with the measured
collector dependency layer cost, that meant rebuilds could repeat the expensive
Python/ML dependency install path. After the optimization, source-only changes
reuse that layer.

## Verification

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=80 backend collector frontend tor
```

Verification result:

- All Docker images built successfully.
- All Docker Compose services started successfully.
- `docker compose ps` showed `backend`, `collector`, `frontend`, `db`, and `tor`
  running.
- Backend applied migrations and started Uvicorn.
- Frontend started Vite successfully.
- Collector started the scheduler successfully.
