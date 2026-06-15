import io
import logging
import os
import sys
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont

# Add current directory to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from captcha_solver import CaptchaSolver, CaptchaType

# Configure logging to show the fallback chain
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def create_sample_captcha() -> bytes:
    """Create a sample CAPTCHA image with some text."""
    img = Image.new('RGB', (200, 80), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    
    # Try to load a default font, otherwise fallback to basic
    try:
        font = ImageFont.truetype("arial.ttf", 36)
    except IOError:
        font = ImageFont.load_default()
        
    d.text((40, 20), "DEMO7", fill=(0, 0, 0), font=font)
    
    # Add some noise lines
    d.line([(10, 10), (190, 70)], fill=(100, 100, 100), width=2)
    d.line([(10, 70), (190, 10)], fill=(100, 100, 100), width=2)
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

def run_demo():
    logger.info("Starting CAPTCHA Fallback Demo Environment...")
    
    # 1. Generate a test CAPTCHA image
    captcha_bytes = create_sample_captcha()
    logger.info("Generated sample CAPTCHA image (Text: 'DEMO7')")
    
    # 2. Initialize the solver with Moondream fallback enabled
    solver = CaptchaSolver(
        ollama_model="qwen3-vl:32b",
        moondream_model="vikhyatk/moondream2",  # Enable fallback
        moondream_device="cpu"
    )
    
    # 3. We simulate Ollama being offline/failing to force the fallback
    logger.info("Simulating Ollama failure to trigger Moondream fallback...")
    
    with patch("captcha_solver._ollama", return_value=None):
        logger.info("Processing CAPTCHA...")
        # This will fail Ollama -> try Moondream -> succeed
        result = solver.solve(captcha_bytes, CaptchaType.TEXT)
        
    logger.info(f"Demo completed. Final Result: '{result}'")

if __name__ == "__main__":
    run_demo()
