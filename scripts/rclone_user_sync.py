"""
rclone_user_sync.py — sync user files to/from remote storage via rclone.

Intended for virtual-desktop / shift-worker workflows:
  - sync_down at session start  → pulls user's files from remote storage
  - sync_up at session end      → pushes changes back to remote storage

Environment variables:
  RCLONE_REMOTE_NAME  — rclone remote name (default: "userstorage")
                        Configure with: rclone config

Notes:
  - rclone must be installed and configured before use.
    Check with: python scripts/rclone_user_sync.py  (runs check_rclone_installed)
  - LOCAL_USER_FOLDER uses a Windows path below; update to a Linux path
    (e.g. /tmp/userdata/<user_id>) when running on Linux/Replit.
  - RCLONE_REMOTE_NAME should be set as a Replit secret if used in this project.
"""

import subprocess
import os

RCLONE_REMOTE = os.environ.get("RCLONE_REMOTE_NAME", "userstorage")
LOCAL_USER_FOLDER = "C:\\UserData"   # NOTE: Windows path — change for Linux


def sync_down(user_id: str) -> bool:
    """Pull user's files down from remote storage at shift start."""
    remote_path = f"{RCLONE_REMOTE}:{user_id}/"
    print(f"Syncing down files for user {user_id} from {remote_path}...")
    result = subprocess.run(
        ["rclone", "sync", remote_path, LOCAL_USER_FOLDER, "--progress"],
        capture_output=True, text=True
    )
    print(result.stdout)
    print(result.stderr)
    return result.returncode == 0


def sync_up(user_id: str) -> bool:
    """Push user's files back to remote storage at shift end."""
    remote_path = f"{RCLONE_REMOTE}:{user_id}/"
    print(f"Syncing up files for user {user_id} to {remote_path}...")
    result = subprocess.run(
        ["rclone", "sync", LOCAL_USER_FOLDER, remote_path, "--progress"],
        capture_output=True, text=True
    )
    print(result.stdout)
    print(result.stderr)
    return result.returncode == 0


def check_rclone_installed() -> bool:
    """Confirm rclone is available before relying on it."""
    result = subprocess.run(["rclone", "version"], capture_output=True, text=True)
    print(result.stdout or result.stderr)
    return result.returncode == 0


if __name__ == "__main__":
    check_rclone_installed()
    # sync_down(user_id="YOUR_TEST_USER_ID_HERE")
    # sync_up(user_id="YOUR_TEST_USER_ID_HERE")
