# collectors/tor_manager.py

import os

from stem import Signal
from stem.control import Controller
import certifi
import requests
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Suppress stem's noisy SocketClosed warnings from the background reader thread
logging.getLogger("stem").setLevel(logging.ERROR)

# Allow overriding Tor host via env var (Docker: TOR_HOST=tor, local: 127.0.0.1)
_DEFAULT_TOR_HOST = os.environ.get("TOR_HOST", "127.0.0.1")


class TorManager:
    """
    Tor network integration for anonymized web requests.
    """

    def __init__(self, socks_host=None, socks_port=9050, control_port=9051, control_password=None, rotate_every=50):
        self.socks_host = socks_host or _DEFAULT_TOR_HOST
        """
        Initialize TorManager

        Args:
            socks_port: SOCKS proxy port (default: 9050)
            control_port: Tor control port (default: 9051)
            control_password: Tor control port password (optional, for HashedControlPassword)
            rotate_every: Auto-rotate circuit after this many requests (default: 50)
        """
        self.socks_port = socks_port
        self.control_port = control_port
        self.control_password = control_password
        self.rotate_every = rotate_every
        self._request_count = 0
        self.controller = None
        self.session = None

        self._connect_to_tor()
        self._setup_session()

    def _connect_to_tor(self):
        """
        Connect to Tor control port. Raises if Tor is not reachable.
        """
        try:
            self.controller = Controller.from_port(address=self.socks_host, port=self.control_port)
            self.controller.authenticate(password=self.control_password)
            logger.info("✓ Connected to Tor Control Port")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Tor: {e}")
            raise

    def _reconnect(self, max_attempts=3):
        """
        Reconnect to Tor control port after a connection drop.

        Returns:
            bool: True if reconnected successfully
        """
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"Reconnecting to Tor (attempt {attempt}/{max_attempts})...")
                if self.controller:
                    try:
                        self.controller.close()
                    except Exception:
                        pass
                self._connect_to_tor()
                if self.session:
                    self.session.close()
                self._setup_session()
                logger.info("✓ Reconnected to Tor")
                return True
            except Exception as e:
                logger.warning(f"Reconnect attempt {attempt} failed: {e}")
                time.sleep(3 * attempt)
        logger.error("✗ Could not reconnect to Tor after all attempts")
        return False

    def _is_connected(self):
        """Check if controller connection is still alive."""
        try:
            return self.controller is not None and self.controller.is_alive()
        except Exception:
            return False

    def _setup_session(self):
        """
        Setup requests session with Tor SOCKS proxy
        """
        self.session = requests.Session()
        proxy_url = f'socks5h://{self.socks_host}:{self.socks_port}'

        self.session.proxies = {
            'http': proxy_url,
            'https': proxy_url
        }

        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0'
        })
        self.session.verify = certifi.where()
    
    def _current_ip(self):
        """
        Return current exit node IP without logging or side-effects.
        """
        try:
            response = self.session.get(
                'https://api.ipify.org?format=json',
                timeout=10
            )
            return response.json().get('ip')
        except Exception:
            return None

    def verify_tor(self):
        """
        Verify Tor connection by checking current IP.

        Returns:
            str: Current IP address (Tor exit node IP)
        """
        ip = self._current_ip()
        if ip:
            logger.info(f"✓ Current IP (via Tor): {ip}")
        else:
            logger.error("✗ Failed to verify Tor")
        return ip

    def _do_newnym(self):
        """Send NEWNYM and rebuild session. Does NOT verify IP change."""
        wait_time = self.controller.get_newnym_wait()
        if wait_time > 0:
            logger.info(f"Waiting {wait_time:.1f}s before requesting new circuit...")
            time.sleep(wait_time)
        self.controller.signal(Signal.NEWNYM)
        if self.session:
            self.session.close()
        self._setup_session()
        time.sleep(2)

    def get_new_circuit(self, max_attempts=3):
        """
        Request a new Tor circuit and verify the exit node IP actually changed.
        Retries up to max_attempts times if the same exit node is selected.

        Args:
            max_attempts: Maximum rotation attempts (default: 3)
        """
        if self.controller is None:
            logger.error("✗ Controller not connected")
            return False

        old_ip = self._current_ip()

        for attempt in range(1, max_attempts + 1):
            try:
                self._do_newnym()
                new_ip = self._current_ip()

                if new_ip and new_ip != old_ip:
                    logger.info(f"✓ Exit node changed: {old_ip} → {new_ip}")
                    return True

                logger.warning(
                    f"Same exit node on attempt {attempt}/{max_attempts} "
                    f"(IP: {new_ip}), retrying..."
                )
            except Exception as e:
                logger.error(f"✗ Circuit rotation attempt {attempt} failed: {e}")

        logger.warning("Could not guarantee exit node change after all attempts")
        return False

    def get_circuit_info(self):
        """
        Get information about current Tor circuit
        """
        if self.controller is None:
            logger.error("✗ Controller not connected")
            return
        try:
            circuits = self.controller.get_circuits()
            for circuit in circuits:
                logger.info(f"Circuit ID: {circuit.id}")
                # circuit.path is a list of (fingerprint, nickname) tuples
                for fingerprint, nickname in circuit.path:
                    logger.info(f"  └─ {nickname} ({fingerprint})")
        except Exception as e:
            logger.error(f"Error getting circuit info: {e}")
    
    def _tick(self):
        """
        Increment request counter and auto-rotate circuit every `rotate_every` requests.
        """
        self._request_count += 1
        if self._request_count % self.rotate_every == 0:
            logger.info(f"Auto-rotating circuit after {self._request_count} requests...")
            self.get_new_circuit()

    def fetch(self, url, timeout=15, max_retries=3):
        """
        Fetch URL content through Tor

        Args:
            url: Target URL
            timeout: Request timeout in seconds (default: 15)
            max_retries: Max retry attempts (default: 3)

        Returns:
            requests.Response: Response object or None if failed
        """
        if not self._is_connected() and not self._reconnect():
            return None

        for attempt in range(max_retries):
            try:
                self._tick()
                response = self.session.get(url, timeout=timeout)
                response.raise_for_status()
                logger.info(f"✓ Fetched {url} (Status: {response.status_code})")
                return response
            except requests.exceptions.Timeout:
                logger.warning(f"⏱ Timeout on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    self.get_new_circuit()
            except requests.exceptions.SSLError as e:
                logger.warning(f"SSL error on attempt {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    self.get_new_circuit()
            except requests.exceptions.ConnectionError as e:
                logger.warning(f"Connection error on attempt {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    if not self._is_connected():
                        if not self._reconnect():
                            return None
                    else:
                        self.get_new_circuit()
            except Exception as e:
                logger.error(f"Error fetching {url}: {e}")
                return None

        logger.error(f"✗ Failed to fetch {url} after {max_retries} attempts")
        return None

    def post(self, url, data=None, timeout=15):
        """
        Send POST request through Tor

        Args:
            url: Target URL
            data: POST data dictionary
            timeout: Request timeout in seconds

        Returns:
            requests.Response: Response object or None if failed
        """
        if not self._is_connected() and not self._reconnect():
            return None

        try:
            self._tick()
            response = self.session.post(url, data=data, timeout=timeout)
            response.raise_for_status()
            return response
        except Exception as e:
            logger.error(f"Error posting to {url}: {e}")
            return None
    
    def close(self):
        """
        Close Tor connection and HTTP session.
        """
        try:
            if self.session:
                self.session.close()
            if self.controller:
                self.controller.close()
            logger.info("✓ Closed Tor connection")
        except Exception as e:
            logger.error(f"Error closing connection: {e}")


# Usage example:
if __name__ == "__main__":
    try:
        tor = TorManager(socks_port=9050, control_port=9051)
        
        # Test 1: Verify Tor
        ip = tor.verify_tor()
        print(f"Connected IP: {ip}")
        
        # Test 2: Fetch website
        response = tor.fetch("https://example.com")
        if response:
            print(f"Status: {response.status_code}")
        
        # Test 3: Get circuit info
        tor.get_circuit_info()
        
        # Test 4: Rotate circuit
        tor.get_new_circuit()
        
        # Test 5: New IP
        new_ip = tor.verify_tor()
        print(f"IP Changed: {ip != new_ip}")
        
        tor.close()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")