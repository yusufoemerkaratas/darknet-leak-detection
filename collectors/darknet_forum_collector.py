# collectors/darknet_forum_collector.py

from .tor_manager import TorManager
from bs4 import BeautifulSoup
from datetime import datetime
import logging
import time
from typing import List, Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DarknetForumCollector:
    """
    Collector for darknet forum leak announcements
    Darknet forum'unda leak announcement'larını topla
    """
    
    def __init__(self, forum_url: str, socks_port: int = 9050):
        """
        Initialize darknet forum collector
        
        Args:
            forum_url: Forum's onion address (e.g., http://forum.onion)
            socks_port: SOCKS proxy port (default: 9050)
        """
        self.forum_url = forum_url
        self.socks_port = socks_port
        self.tor = TorManager(socks_port=socks_port)
        self.is_authenticated = False
        logger.info(f"Initialized collector for {forum_url}")
    
    def login(self, username: str, password: str) -> bool:
        """
        Authenticate to darknet forum
        Forum'a giriş yap (authenticate)
        
        Args:
            username: Forum username
            password: Forum password
        
        Returns:
            bool: True if authentication successful, False otherwise
        """
        try:
            login_url = f"{self.forum_url}/login"
            login_data = {
                'username': username,
                'password': password,
            }
            
            logger.info(f"Attempting login to {self.forum_url}...")
            response = self.tor.post(login_url, data=login_data, timeout=30)
            
            if response is None:
                logger.error("Failed to connect to login page")
                return False
            
            # Check if authentication successful
            # (Look for logout button or user dashboard in response)
            if 'logout' in response.text.lower() or 'dashboard' in response.text.lower():
                self.is_authenticated = True
                logger.info(f"✓ Successfully authenticated to {self.forum_url}")
                return True
            
            logger.error("Authentication failed - invalid credentials or page structure changed")
            return False
            
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False
    
    def scrape_leaks(self, section_url: str) -> List[Dict]:
        """
        Scrape leak announcements from forum section
        Forum bölümünden leak announcement'larını scrape et
        
        Args:
            section_url: Full URL of forum section (e.g., http://forum.onion/breaches/)
        
        Returns:
            List of leak records (dicts)
        """
        leaks = []
        
        try:
            logger.info(f"Scraping leaks from {section_url}...")
            response = self.tor.fetch(section_url, timeout=30)
            
            if response is None:
                logger.error(f"Failed to fetch {section_url}")
                return leaks
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract leak announcements
            # Selector'ları her forum'a özel ayarlaman gerekebilir
            post_elements = soup.find_all('div', class_='forum-post')
            logger.info(f"Found {len(post_elements)} posts on page")
            
            for post in post_elements:
                try:
                    leak_record = self._extract_leak_info(post)
                    if leak_record:
                        leaks.append(leak_record)
                except Exception as e:
                    logger.warning(f"Error extracting leak info: {e}")
                    continue
            
            logger.info(f"✓ Scraped {len(leaks)} leaks from this page")
            
            # Rotate circuit for anti-detection purposes
            # Anti-detection: circuit'i rotate et
            self.tor.get_new_circuit()
            
            return leaks
            
        except Exception as e:
            logger.error(f"Scraping error: {e}")
            return leaks
    
    def _extract_leak_info(self, post_element) -> Optional[Dict]:
        """
        Extract leak information from HTML post element
        HTML post element'inden leak bilgisini çıkart
        
        Args:
            post_element: BeautifulSoup element
        
        Returns:
            Dict with leak info or None if extraction fails
        """
        
        # Define CSS selectors to try (forum-specific)
        # CSS selector'larını dene (forum'a özel)
        selectors = {
            'title': [
                ('h2.post-title', lambda x: x.text),
                ('h3.thread-title', lambda x: x.text),
                ('a.leak-link', lambda x: x.text),
                ('span.leak-title', lambda x: x.text),
            ],
            'author': [
                ('span.author', lambda x: x.text),
                ('span.vendor', lambda x: x.text),
                ('a.user-link', lambda x: x.text),
                ('span.username', lambda x: x.text),
            ],
            'date': [
                ('span.date', lambda x: x.text),
                ('span.posted-date', lambda x: x.text),
                ('time', lambda x: x.get('datetime')),
                ('span.timestamp', lambda x: x.text),
            ],
            'content': [
                ('div.post-content', lambda x: x.text[:500]),
                ('div.leak-description', lambda x: x.text[:500]),
                ('p.summary', lambda x: x.text[:500]),
                ('div.message', lambda x: x.text[:500]),
            ],
            'record_count': [
                ('span.records', lambda x: x.text),
                ('span.size', lambda x: x.text),
                ('span.record-count', lambda x: x.text),
                ('span.victims', lambda x: x.text),
            ]
        }
        
        leak_info = {}
        
        # Try each selector until one works
        # Her selector'u dene, biri işe yarayıncaya kadar
        for field_name, selector_list in selectors.items():
            for css_selector, extractor in selector_list:
                try:
                    element = post_element.select_one(css_selector)
                    if element:
                        leak_info[field_name] = extractor(element).strip()
                        break
                except Exception:
                    continue
        
        # Only return if we found title (minimum required)
        # Sadece title varsa return et (zorunlu)
        if leak_info.get('title'):
            return {
                'title': leak_info.get('title', 'Unknown'),
                'author': leak_info.get('author', 'Unknown'),
                'date': leak_info.get('date'),
                'content_summary': leak_info.get('content', ''),
                'record_count': leak_info.get('record_count'),
                'source_url': self.forum_url,
                'source_type': 'darknet_forum',
                'collected_at': datetime.utcnow().isoformat()
            }
        
        return None
    
    def scrape_multiple_pages(self, base_section_url: str, page_count: int = 5) -> List[Dict]:
        """
        Scrape leaks from multiple pages
        Birden fazla sayfa'dan leak'leri scrape et
        
        Args:
            base_section_url: Base URL of section (without page number)
            page_count: Number of pages to scrape (default: 5)
        
        Returns:
            Combined list of all leaks
        """
        all_leaks = []
        
        for page_num in range(1, page_count + 1):
            try:
                # Construct page URL (adjust based on forum's URL structure)
                # URL'yi oluştur (forum'un URL yapısına göre ayarla)
                if "?" in base_section_url:
                    page_url = f"{base_section_url}&page={page_num}"
                else:
                    page_url = f"{base_section_url}?page={page_num}"
                
                logger.info(f"Scraping page {page_num}...")
                leaks = self.scrape_leaks(page_url)
                all_leaks.extend(leaks)
                
                # Be respectful to server - add delay between requests
                # Server'a saygılı ol - istekler arasına gecikme ekle
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"Error scraping page {page_num}: {e}")
                continue
        
        logger.info(f"✓ Total leaks scraped: {len(all_leaks)}")
        return all_leaks
    
    def close(self):
        """
        Close Tor connection
        Tor bağlantısını kapat
        """
        try:
            self.tor.close()
            logger.info("Collector closed")
        except Exception as e:
            logger.error(f"Error closing collector: {e}")


# Usage example / Kullanım örneği:
if __name__ == "__main__":
    try:
        # Initialize collector
        collector = DarknetForumCollector(
            forum_url="http://forum.onion",
            socks_port=9050
        )
        
        # Login to forum
        # Forum'a giriş yap
        if collector.login(username="your_username", password="your_password"):
            
            # Scrape single page
            # Tek sayfayı scrape et
            leaks = collector.scrape_leaks("http://forum.onion/breaches/")
            
            # Display results
            # Sonuçları göster
            for leak in leaks:
                print(f"\nTitle: {leak['title']}")
                print(f"Author: {leak['author']}")
                print(f"Date: {leak['date']}")
                print(f"Summary: {leak['content_summary'][:100]}...")
            
            # Save to database (in real project)
            # Veritabanına kaydet (gerçek projede)
            # db.save_leaks(leaks)
        
        else:
            print("Failed to authenticate")
        
        # Close connection
        collector.close()
        
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Error: {e}")