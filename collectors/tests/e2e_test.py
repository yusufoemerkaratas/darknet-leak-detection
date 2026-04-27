import sys
import os
import logging
from pathlib import Path

# --- PATH SETTINGS (Based on the folder structure) ---
# Current file: .../collectors/tests/e2e_test.py
# Target root: .../collectors/
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent # Go up from 'tests' folder to 'collectors'

if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# --- MODULE IMPORTS ---
try:
    from tor_manager import TorManager
    from captcha_solver import CaptchaSolver
    from js_collector import SPALeakCollector
    import requests
    logger_init = "✅ Modules connected successfully."
except ImportError as e:
    print(f"❌ Module Error: {e}")
    print(f"Searched path: {project_root}")
    sys.exit(1)

# --- LOG SETTINGS ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s]: %(message)s")
logger = logging.getLogger("E2E_Test")

def start_test():
    logger.info("=== ALL SYSTEM CHECK STARTING ===")
    logger.info(logger_init)

    # 1. Tor Connection Test
    logger.info("1/3 - Testing Tor Layer...")
    try:
        tor = TorManager()
        # Check Tor IP
        test_proxies = {
            'http': 'socks5h://127.0.0.1:9050',
            'https': 'socks5h://127.0.0.1:9050'
        }
        res = requests.get("https://check.torproject.org/api/ip", proxies=test_proxies, timeout=10)
        logger.info(f"✅ Tor Active! Your IP Address: {res.json().get('IP')}")
    except Exception as e:
        logger.error(f"❌ Tor Error (Is service open?): {e}")
        return

    # 2. Ollama & AI Layer
    logger.info("2/3 - Checking Ollama (LLaVA) API...")
    try:
        # Port check
        requests.get("http://localhost:11434", timeout=3)
        logger.info("✅ Ollama API ready.")
    except:
        logger.warning("⚠️ Could not connect to Ollama. AI features will not be tested.")

    # 3. Playwright & JS Rendering
    logger.info("3/3 - Testing Playwright and Data Logging...")
    test_site = {
        "id": "e2e_test_job",
        "base_url": "https://check.torproject.org/",
        "type": "spa"
    }
    
    collector = SPALeakCollector(test_site, {})
    try:
        collector.collect()
        
        # Check if file was written
        storage = project_root / "raw_storage" / "e2e_test_job"
        output = list(storage.glob("*.json"))
        
        if output:
            logger.info(f"✅ Success! Data saved: {output[0].name}")
            logger.info("=== SYSTEM CHECK PASSED ===")
        else:
            logger.error("❌ Error: Data fetched but could not be written to raw_storage folder.")
            
    except Exception as e:
        logger.error(f"❌ Playwright Error: {e}")

if __name__ == "__main__":
    start_test()