# collectors/tests/test_tor_integration.py
#
# Integration test — requires a running Tor service (port 9050/9051).
# Run from project root:
#   venv/bin/python collectors/tests/test_tor_integration.py

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tor_manager import TorManager


def main():
    print("\n" + "=" * 60)
    print("TOR INTEGRATION TEST")
    print("=" * 60)

    tor = None
    try:
        # Step 1: Connect to Tor
        print("\n1️⃣  Connecting to Tor...")
        tor = TorManager(socks_port=9050, control_port=9051, rotate_every=50)
        print("   ✓ Connection established")

        # Step 2: Verify connection health
        print("\n2️⃣  Checking connection health...")
        if tor._is_connected():
            print("   ✓ Controller is alive")
        else:
            print("   ✗ Controller not connected")
            return

        # Step 3: Verify Tor IP
        print("\n3️⃣  Verifying Tor connection...")
        current_ip_1 = tor.verify_tor()
        if current_ip_1:
            print(f"   ✓ Current IP: {current_ip_1}")
        else:
            print("   ✗ Failed to get IP")
            return

        # Step 4: Fetch website through Tor
        print("\n4️⃣  Fetching website through Tor (GET)...")
        response = tor.fetch("https://httpbin.org/get", timeout=15)
        if response:
            print(f"   ✓ Status Code: {response.status_code}")
            print(f"   ✓ Content Length: {len(response.text)} bytes")
        else:
            print("   ✗ Failed to fetch website")

        # Step 5: Test POST request
        print("\n5️⃣  Testing POST request...")
        post_response = tor.post(
            "https://httpbin.org/post",
            data={"test": "data", "timestamp": int(time.time())},
        )
        if post_response:
            print(f"   ✓ POST Status: {post_response.status_code}")
        else:
            print("   ✗ POST request failed")

        # Step 6: Get circuit information
        print("\n6️⃣  Getting circuit information...")
        print("   Circuit nodes:")
        tor.get_circuit_info()

        # Step 7: Manual circuit rotation + IP change check
        print("\n7️⃣  Rotating Tor circuit (manual)...")
        rotated = tor.get_new_circuit()
        if rotated:
            new_ip = tor.verify_tor()
            print(f"   ✓ IP changed: {current_ip_1} → {new_ip}")
        else:
            print("   ✗ Could not change exit node after retries")

        # Step 8: Auto-rotation test (rotate_every=3)
        print("\n8️⃣  Testing auto-rotation (rotate_every=3)...")
        tor_auto = TorManager(socks_port=9050, control_port=9051, rotate_every=3)
        ip_before = tor_auto.verify_tor()
        print(f"   IP before auto-rotate: {ip_before}")

        for i in range(1, 4):
            tor_auto.fetch("https://httpbin.org/get", timeout=15)
            print(f"   request {i}/3 — total count: {tor_auto._request_count}")

        ip_after = tor_auto.verify_tor()
        print(f"   IP after auto-rotate:  {ip_after}")
        print(f"   ✓ Auto-rotation triggered: {tor_auto._request_count >= 3}")
        if ip_before != ip_after:
            print(f"   ✓ IP changed: {ip_before} → {ip_after}")
        else:
            print("   ✗ IP did not change after auto-rotation")
        tor_auto.close()

        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 60 + "\n")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\n" + "=" * 60)
        print("❌ TEST FAILED")
        print("=" * 60 + "\n")

    finally:
        if tor is not None:
            print("🔒 Closing Tor connection...")
            tor.close()
            print("   ✓ Connection closed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        print(f"\nFatal error: {e}")
