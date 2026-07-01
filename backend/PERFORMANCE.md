# Backend performance notes

This backend runs CPU-heavy OCR + detection per request. For stability under concurrency:

## Key environment variables
- `MAX_CONCURRENT_JOBS`: caps simultaneous inference inside a single server process. Start with `2` and tune.
- `OCR_DEBUG_DUMP_LINES`: set to `true` only when debugging OCR line extraction (very verbose).
- SQLAlchemy pool knobs:
  - `DB_POOL_SIZE` (default 5)
  - `DB_MAX_OVERFLOW` (default 10)
  - `DB_POOL_RECYCLE_SECONDS` (default 1800)

## Recommended `uvicorn` settings (local)
If you run locally:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

Why `workers=1` by default: OCR models are large and each worker loads its own copy. For higher throughput:
- Prefer scaling **horizontally** (multiple machines/containers) or ensure the machine has enough RAM for multiple workers.
- If you do increase workers, reduce `MAX_CONCURRENT_JOBS` per worker to avoid CPU oversubscription.

## Load smoke test
Run:

```bash
python scripts/load_smoke_test.py --file "path/to/invoice.png" --token "<JWT>" --requests 50 --concurrency 10
```

This does not change any API behavior; it only measures latency and rough throughput.

