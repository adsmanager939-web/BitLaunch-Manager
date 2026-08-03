"""
server_lifecycle.py — manual smoke-test for the BitLaunch API.

BITLAUNCH_API_KEY is read from the environment (set as a Replit secret).

Usage:
  1. Open this file, uncomment one step at a time in __main__.
  2. Run:  python scripts/server_lifecycle.py
  3. Copy IDs from the output into the next step.

Steps:
  A. create_server(snapshot_id, server_name)  → note the returned server ID
  B. poll_until_ready(server_id)              → waits up to 10 min for "active"
  C. destroy_server(server_id)                → permanent, returns True on 200/204
"""

import requests
import os
import time

API_KEY = os.environ.get("BITLAUNCH_API_KEY")
BASE_URL = "https://api.bitlaunch.io/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}


def create_server(snapshot_id: str, server_name: str, region: str = "nyc1", size: str = "s-2vcpu-4gb") -> dict:
    """Provision a new server from a snapshot image."""
    print(f"Creating server '{server_name}' from snapshot {snapshot_id}...")
    payload = {
        "name": server_name,
        "image": snapshot_id,
        "region": region,
        "size": size
    }
    r = requests.post(f"{BASE_URL}/servers", headers=headers, json=payload)
    print(r.status_code, r.text)
    return r.json()


def poll_until_ready(server_id: str, timeout_seconds: int = 600, interval: int = 10) -> dict | None:
    """Poll the server until status reaches active/ready/running or timeout expires."""
    print(f"\nPolling server {server_id} until ready...")
    elapsed = 0
    while elapsed < timeout_seconds:
        r = requests.get(f"{BASE_URL}/servers/{server_id}", headers=headers)
        data = r.json()
        status = data.get("status", "unknown")
        print(f"[{elapsed}s] Status: {status}")

        if status in ("active", "ready", "running"):
            print("Server is ready!")
            return data

        time.sleep(interval)
        elapsed += interval

    print("Timed out waiting for server to become ready.")
    return None


def destroy_server(server_id: str) -> bool:
    """Permanently destroy a server. Returns True on 200 or 204."""
    print(f"\nDestroying server {server_id}...")
    r = requests.delete(f"{BASE_URL}/servers/{server_id}", headers=headers)
    print(r.status_code, r.text)
    return r.status_code in (200, 204)


if __name__ == "__main__":
    # ── Step A: create a server ───────────────────────────────────────────────
    # server = create_server(snapshot_id="YOUR_SNAPSHOT_ID_HERE", server_name="test-user-1")
    # server_id = server.get("id")
    # print("Server ID:", server_id)

    # ── Step B: poll until active ─────────────────────────────────────────────
    # ready = poll_until_ready(server_id="YOUR_SERVER_ID_HERE")
    # print("Ready server:", ready)

    # ── Step C: destroy ───────────────────────────────────────────────────────
    # ok = destroy_server(server_id="YOUR_SERVER_ID_HERE")
    # print("Destroyed:", ok)

    print("Uncomment the steps above one at a time to test create → poll → destroy.")
    print(f"API key present: {bool(API_KEY)}")
