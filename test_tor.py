# test_tor_english.py

from collectors.tor_manager import TorManager
import time


def main():
    """
    Test Tor integration
    Tor entegrasyonunu test et
    """
    
    print("\n" + "=" * 60)
    print("TOR INTEGRATION TEST")
    print("=" * 60)
    
    tor = None
    try:
        # Step 1: Connect to Tor
        print("\n1️⃣ Connecting to Tor...")
        tor = TorManager(socks_port=9050, control_port=9051)
        print("   ✓ Connection established")
        
        # Step 2: Verify Tor connection
        print("\n2️⃣ Verifying Tor connection...")
        current_ip_1 = tor.verify_tor()
        if current_ip_1:
            print(f"   ✓ Current IP: {current_ip_1}")
        else:
            print("   ✗ Failed to get IP")
            return
        
        # Step 3: Fetch website through Tor
        print("\n3️⃣ Fetching website through Tor...")
        response = tor.fetch("https://httpbin.org/get", timeout=15)
        if response:
            print(f"   ✓ Status Code: {response.status_code}")
            print(f"   ✓ Content Length: {len(response.text)} bytes")
        else:
            print("   ✗ Failed to fetch website")
        
        # Step 4: Get circuit information
        print("\n4️⃣ Getting circuit information...")
        print("   Circuit nodes:")
        tor.get_circuit_info()
        
        # Step 5: Rotate Tor circuit
        print("\n5️⃣ Rotating Tor circuit (getting new exit node)...")
        tor.get_new_circuit()
        print("   ✓ Circuit rotation requested")

        print("\n6️⃣ Verifying new IP...")
        current_ip_2 = tor.verify_tor()
        if current_ip_2:
            print(f"   ✓ New IP: {current_ip_2}")
            ip_changed = current_ip_1 != current_ip_2
            print(f"   ✓ IP Changed: {ip_changed}")
            if not ip_changed:
                print("   ⚠ Warning: IP didn't change (sometimes happens)")
        else:
            print("   ✗ Failed to get new IP")
        
        # Step 7: Test POST request
        print("\n8️⃣ Testing POST request...")
        post_data = {
            'test': 'data',
            'timestamp': int(time.time())
        }
        post_response = tor.post("https://httpbin.org/post", data=post_data)
        if post_response:
            print(f"   ✓ POST Status: {post_response.status_code}")
        else:
            print("   ✗ POST request failed")
        
        # Summary
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
            print("\n🔒 Closing Tor connection...")
            tor.close()
            print("   ✓ Connection closed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        print(f"\nFatal error: {e}")