# collectors/tor_manager.py

from stem import Signal
from stem.control import Controller
import certifi
import requests
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TorManager:
    """
    Tor network integration for anonymized web requests.
    Tor ağı entegrasyonu - anonim web istekleri için
    """

    def __init__(self, socks_port=9050, control_port=9051, control_password=None):
        """
        Initialize TorManager

        Args:
            socks_port: SOCKS proxy port (default: 9050)
            control_port: Tor control port (default: 9051)
            control_password: Tor control port password (optional, for HashedControlPassword)
        """
        self.socks_port = socks_port
        self.control_port = control_port
        self.control_password = control_password
        self.controller = None
        self.session = None

        self._connect_to_tor()
        self._setup_session()

    def _connect_to_tor(self):
        """
        Connect to Tor control port
        Tor kontrol portuna bağlan
        """
        try:
            self.controller = Controller.from_port(port=self.control_port)
            self.controller.authenticate(password=self.control_password)
            logger.info("✓ Connected to Tor Control Port")
        except Exception as e:
            logger.error(f"✗ Failed to connect to Tor: {e}")
            raise

    def _setup_session(self):
        """
        Setup requests session with Tor SOCKS proxy
        Requests session'ını Tor SOCKS proxy'si ile ayarla
        """
        self.session = requests.Session()
        proxy_url = f'socks5h://127.0.0.1:{self.socks_port}'

        self.session.proxies = {
            'http': proxy_url,
            'https': proxy_url
        }

        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0'
        })
        self.session.verify = certifi.where()
    
    def verify_tor(self):
        """
        Verify Tor connection by checking current IP
        Tor bağlantısını doğrula - mevcut IP'yi kontrol et
        
        Returns:
            str: Current IP address (Tor exit node IP)
        """
        try:
            response = self.session.get(
                'https://api.ipify.org?format=json',
                timeout=10
            )
            data = response.json()
            current_ip = data['ip']
            logger.info(f"✓ Current IP (via Tor): {current_ip}")
            return current_ip
        except Exception as e:
            logger.error(f"✗ Failed to verify Tor: {e}")
            return None
    
    def get_new_circuit(self):
        """
        Request new Tor circuit (change exit node)
        Yeni Tor circuit oluştur (exit node değiştir)
        """
        if self.controller is None:
            logger.error("✗ Controller not connected")
            return
        try:
            # Rate-limit: Tor allows NEWNYM at most once every ~10s
            wait_time = self.controller.get_newnym_wait()
            if wait_time > 0:
                logger.info(f"Waiting {wait_time:.1f}s before requesting new circuit...")
                time.sleep(wait_time)

            self.controller.signal(Signal.NEWNYM)

            # Close existing session to drop all Keep-Alive connections —
            # otherwise requests reuse the old TCP connection to the SOCKS
            # proxy and end up on the same exit node despite the new circuit.
            if self.session:
                self.session.close()
            self._setup_session()

            # Give Tor ~2s to finish building the new circuit
            time.sleep(2)

            logger.info("✓ New Tor circuit established")
        except Exception as e:
            logger.error(f"✗ Failed to rotate circuit: {e}")

    def get_circuit_info(self):
        """
        Get information about current Tor circuit
        Mevcut Tor circuit hakkında bilgi al
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
    
    def fetch(self, url, timeout=15, max_retries=3):
        """
        Fetch URL content through Tor
        Tor üzerinden URL'den veri çek
        
        Args:
            url: Target URL
            timeout: Request timeout in seconds (default: 15)
            max_retries: Max retry attempts (default: 3)
        
        Returns:
            requests.Response: Response object or None if failed
        """
        for attempt in range(max_retries):
            try:
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
                    self.get_new_circuit()
            except Exception as e:
                logger.error(f"Error fetching {url}: {e}")
                return None
        
        logger.error(f"✗ Failed to fetch {url} after {max_retries} attempts")
        return None
    
    def post(self, url, data=None, timeout=15):
        """
        Send POST request through Tor
        Tor üzerinden POST isteği gönder
        
        Args:
            url: Target URL
            data: POST data dictionary
            timeout: Request timeout in seconds
        
        Returns:
            requests.Response: Response object or None if failed
        """
        try:
            response = self.session.post(url, data=data, timeout=timeout)
            response.raise_for_status()
            return response
        except Exception as e:
            logger.error(f"Error posting to {url}: {e}")
            return None
    
    def close(self):
        """
        Close Tor connection
        Tor bağlantısını kapat
        """
        try:
            if self.controller:
                self.controller.close()
                logger.info("✓ Closed Tor connection")
        except Exception as e:
            logger.error(f"Error closing connection: {e}")


# Usage example / Kullanım örneği:
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