import requests
import os

API_KEY = os.environ.get("BITLAUNCH_API_KEY")
BASE_URL = "https://api.bitlaunch.io/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def check_account():
    print("Checking account status...")
    r = requests.get(f"{BASE_URL}/account", headers=headers)
    print(r.status_code, r.text)

def list_images():
    print("\nListing available images/snapshots...")
    r = requests.get(f"{BASE_URL}/images", headers=headers)
    print(r.status_code, r.text)

def list_servers():
    print("\nListing current servers (should be empty)...")
    r = requests.get(f"{BASE_URL}/servers", headers=headers)
    print(r.status_code, r.text)

def check_volumes():
    print("\nChecking block storage/volumes support...")
    r = requests.get(f"{BASE_URL}/volumes", headers=headers)
    print(r.status_code, r.text)

if __name__ == "__main__":
    check_account()
    list_images()
    list_servers()
    check_volumes()
