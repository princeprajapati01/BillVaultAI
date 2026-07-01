import argparse
import asyncio
import os
import time
from typing import List

import httpx


async def _one_upload(client: httpx.AsyncClient, url: str, token: str, file_path: str) -> float:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    t0 = time.perf_counter()
    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f, "image/png")}
        r = await client.post(url, headers=headers, files=files, timeout=None)
        r.raise_for_status()
    return time.perf_counter() - t0


async def main_async(args: argparse.Namespace) -> None:
    url = args.url.rstrip("/")
    endpoint = f"{url}/process/document"
    token = args.token
    file_path = args.file

    if not os.path.exists(file_path):
        raise SystemExit(f"File not found: {file_path}")

    async with httpx.AsyncClient() as client:
        latencies: List[float] = []
        sem = asyncio.Semaphore(args.concurrency)

        async def worker() -> None:
            async with sem:
                lat = await _one_upload(client, endpoint, token, file_path)
                latencies.append(lat)

        t0 = time.perf_counter()
        await asyncio.gather(*[worker() for _ in range(args.requests)])
        elapsed = time.perf_counter() - t0

    if not latencies:
        print("No requests completed.")
        return

    latencies.sort()
    p50 = latencies[int(0.50 * (len(latencies) - 1))]
    p90 = latencies[int(0.90 * (len(latencies) - 1))]
    p99 = latencies[int(0.99 * (len(latencies) - 1))]
    rps = len(latencies) / max(1e-9, elapsed)

    print(f"requests={len(latencies)} concurrency={args.concurrency} elapsed_s={elapsed:.2f} rps={rps:.2f}")
    print(f"latency_s p50={p50:.2f} p90={p90:.2f} p99={p99:.2f} max={latencies[-1]:.2f}")


def main() -> None:
    p = argparse.ArgumentParser(description="Load smoke test for /process/document")
    p.add_argument("--url", default="http://localhost:8000", help="Base URL, e.g. http://localhost:8000")
    p.add_argument("--token", default="", help="Bearer token (from /api/auth/login). If empty, request will likely 401.")
    p.add_argument("--file", required=True, help="Path to an invoice image file")
    p.add_argument("--requests", type=int, default=20, help="Total requests to send")
    p.add_argument("--concurrency", type=int, default=5, help="Max concurrent in-flight requests")
    args = p.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()

