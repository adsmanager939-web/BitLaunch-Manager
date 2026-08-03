"""
wireguard_peer.py — manage WireGuard peers for per-session VPN access.

Part of the virtual-desktop / shift-worker session lifecycle:
  1. generate_keypair()         → create a fresh private/public keypair for this session
  2. register_peer()            → register the public key on the WG server so it can connect
  3. build_client_config()      → produce the .conf to push onto the provisioned RDP machine
  4. revoke_peer()              → remove the peer at shift end / server destroy

Environment variables (set as Replit secrets):
  WG_SERVER_HOST     — base URL of the WireGuard management API, e.g. https://wg.example.com
  WG_SERVER_API_KEY  — bearer token for the WG management API

Prerequisites:
  - wireguard-tools must be installed (`wg` binary available in PATH)
  - Check with: which wg
"""

import subprocess
import requests
import os

WG_SERVER_HOST = os.environ.get("WG_SERVER_HOST")
WG_SERVER_API_KEY = os.environ.get("WG_SERVER_API_KEY")


def generate_keypair() -> tuple[str, str]:
    """Generate a new WireGuard private/public keypair for this session."""
    private_key = subprocess.run(
        ["wg", "genkey"], capture_output=True, text=True
    ).stdout.strip()
    public_key = subprocess.run(
        ["wg", "pubkey"], input=private_key, capture_output=True, text=True
    ).stdout.strip()
    print(f"Generated keypair. Public key: {public_key}")
    return private_key, public_key


def register_peer(public_key: str, user_id: str) -> dict:
    """Register this public key on the WireGuard server so it can connect."""
    print(f"Registering peer for user {user_id}...")
    payload = {"public_key": public_key, "user_id": user_id}
    headers = {"Authorization": f"Bearer {WG_SERVER_API_KEY}"}
    r = requests.post(f"{WG_SERVER_HOST}/peers", json=payload, headers=headers)
    print(r.status_code, r.text)
    return r.json()


def build_client_config(
    private_key: str,
    server_public_key: str,
    server_endpoint: str,
    assigned_ip: str,
) -> str:
    """Build the .conf file to push onto the new RDP machine at boot."""
    config = f"""[Interface]
PrivateKey = {private_key}
Address = {assigned_ip}/32

[Peer]
PublicKey = {server_public_key}
Endpoint = {server_endpoint}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
"""
    print("Generated client config:")
    print(config)
    return config


def revoke_peer(public_key: str) -> bool:
    """Remove this peer from the WireGuard server — call at shift end / server destroy."""
    print(f"Revoking peer {public_key}...")
    headers = {"Authorization": f"Bearer {WG_SERVER_API_KEY}"}
    r = requests.delete(f"{WG_SERVER_HOST}/peers/{public_key}", headers=headers)
    print(r.status_code, r.text)
    return r.status_code in (200, 204)


if __name__ == "__main__":
    print("Uncomment steps below one at a time to test keypair → register → config → revoke.")
    # private_key, public_key = generate_keypair()
    # peer = register_peer(public_key, user_id="test-user-1")
    # config = build_client_config(
    #     private_key,
    #     server_public_key="SERVER_PUBLIC_KEY_HERE",
    #     server_endpoint="SERVER_ENDPOINT_HERE:51820",
    #     assigned_ip="10.0.0.2",
    # )
    # revoke_peer(public_key)
