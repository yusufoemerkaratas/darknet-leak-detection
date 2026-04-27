# collectors/captcha_solver.py
#
# CAPTCHA solver — supported types:
#   1. TEXT   : Classic character based CAPTCHA
#               → Ollama Vision (llava) → Tesseract OCR fallback
#   2. GRID   : Image matching ("Select cars", "click on traffic lights")
#               → Ollama Vision: send grid image + instruction together,
#                 get which cell indices should be selected
#   3. MATH   : "3 + 7 = ?" type mathematical CAPTCHA
#               → Regex based solution, Ollama fallback
#   4. SLIDER : Slider CAPTCHA (position estimation)
#               → Estimate target position with Ollama Vision
#
# Dependencies:
#   pip install requests pillow
#   pacman -S tesseract tesseract-data-eng python-pytesseract python-opencv

import base64
import io
import logging
import os
import re
from enum import Enum, auto
from typing import List, Optional, Union

import requests

logger = logging.getLogger(__name__)

OLLAMA_API_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434") + "/api/generate"


# ---------------------------------------------------------------------------
# CAPTCHA types
# ---------------------------------------------------------------------------

class CaptchaType(Enum):
    TEXT   = auto()   # Classic character CAPTCHA
    GRID   = auto()   # Image grid matching (reCAPTCHA style)
    MATH   = auto()   # "3 + 7 = ?" type
    SLIDER = auto()   # Slider verification


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _ollama(
    prompt: str,
    image_bytes: Optional[bytes],
    model: str,
    timeout: int,
) -> Optional[str]:
    """Make request to Ollama API; return response as raw string."""
    try:
        payload: dict = {"model": model, "prompt": prompt, "stream": False}
        if image_bytes:
            payload["images"] = [_b64(image_bytes)]
        resp = requests.post(OLLAMA_API_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        logger.warning(f"[CAPTCHA] Ollama error: {e}")
        return None


# ---------------------------------------------------------------------------
# Type 1 — TEXT CAPTCHA
# ---------------------------------------------------------------------------

_TEXT_PROMPT = (
    "This is a CAPTCHA image. "
    "Reply with ONLY the alphanumeric characters visible. "
    "No spaces, no explanation — just the characters."
)


def _tesseract_fallback(image_bytes: bytes) -> Optional[str]:
    """Extract text with Tesseract OCR + OpenCV preprocessing."""
    try:
        import cv2
        import numpy as np
        from PIL import Image

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        pil_img = Image.fromarray(binary)
    except ImportError:
        logger.debug("[CAPTCHA] No OpenCV, using raw image")
        from PIL import Image
        pil_img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        logger.warning(f"[CAPTCHA] OpenCV preprocessing error: {e}")
        from PIL import Image
        pil_img = Image.open(io.BytesIO(image_bytes))

    try:
        import pytesseract
        raw = pytesseract.image_to_string(
            pil_img,
            config=(
                "--psm 8 "
                "-c tessedit_char_whitelist="
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
            ),
        )
        solution = re.sub(r"[^A-Za-z0-9]", "", raw.strip())
        if solution:
            logger.info(f"[CAPTCHA/TEXT] Tesseract: '{solution}'")
            return solution
    except ImportError:
        logger.error("[CAPTCHA] pytesseract not installed — 'pip install pytesseract'")
    except Exception as e:
        logger.error(f"[CAPTCHA] Tesseract error: {e}")
    return None


def solve_text(image_bytes: bytes, model: str, timeout: int) -> Optional[str]:
    """Solve classic character CAPTCHA."""
    raw = _ollama(_TEXT_PROMPT, image_bytes, model, timeout)
    if raw:
        solution = re.sub(r"[^A-Za-z0-9]", "", raw)
        if solution:
            logger.info(f"[CAPTCHA/TEXT] Ollama: '{solution}'")
            return solution
        logger.warning("[CAPTCHA/TEXT] Ollama answered but no characters found")

    logger.info("[CAPTCHA/TEXT] Trying Tesseract fallback...")
    return _tesseract_fallback(image_bytes)


# ---------------------------------------------------------------------------
# Type 2 — GRID / Image Matching CAPTCHA
# ---------------------------------------------------------------------------

def solve_grid(
    grid_image_bytes: bytes,
    instruction: str,
    model: str,
    timeout: int,
    grid_size: int = 3,
) -> Optional[List[int]]:
    """
    Solve image grid CAPTCHA ("Select squares containing cars" etc.)

    Args:
        grid_image_bytes: Bytes of the entire grid image.
        instruction:      Original CAPTCHA instruction ("Select all images with cars").
        model:            Ollama vision model.
        timeout:          Timeout.
        grid_size:        Grid size (default 3x3 = 9 cells).

    Returns:
        List of cell indices to select (0-based, left→right, top→bottom).
        E.g. [0, 3, 7]  → Returns None on error.
    """
    total = grid_size * grid_size
    prompt = (
        f"This is a {grid_size}x{grid_size} CAPTCHA grid (cells numbered 0–{total-1}, "
        f"left-to-right, top-to-bottom).\n"
        f"Task: {instruction}\n"
        f"Reply with ONLY the cell numbers that match the task, separated by commas. "
        f"Example: 0,3,7\n"
        f"If none match, reply: none"
    )
    raw = _ollama(prompt, grid_image_bytes, model, timeout)
    if not raw:
        return None

    if raw.strip().lower() == "none":
        logger.info("[CAPTCHA/GRID] No matching cells found")
        return []

    indices = []
    for token in re.split(r"[,\s]+", raw):
        token = token.strip()
        if token.isdigit():
            idx = int(token)
            if 0 <= idx < total:
                indices.append(idx)
    logger.info(f"[CAPTCHA/GRID] Selected cells: {indices}")
    return indices if indices else None


# ---------------------------------------------------------------------------
# Type 3 — MATH CAPTCHA
# ---------------------------------------------------------------------------

_MATH_PATTERN = re.compile(
    r"(\d+)\s*([+\-×x\*/])\s*(\d+)\s*[=?]"
)


def solve_math(
    expression: str,
    image_bytes: Optional[bytes] = None,
    model: str = "llava",
    timeout: int = 30,
) -> Optional[str]:
    """
    Solve math CAPTCHA.

    Args:
        expression:   Text like "3 + 7 = ?" (extracted from page).
        image_bytes:  Optional image if expression comes from image.

    Returns:
        Result string (e.g. "10") or None.
    """
    # First try regex
    m = _MATH_PATTERN.search(expression)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ops = {'+': a + b, '-': a - b, '*': a * b, 'x': a * b, '×': a * b, '/': a // b}
        result = ops.get(op)
        if result is not None:
            logger.info(f"[CAPTCHA/MATH] Regex: {a} {op} {b} = {result}")
            return str(result)

    # If regex fails, ask Ollama
    prompt = (
        f"Solve this CAPTCHA math expression and reply with ONLY the number: {expression}"
    )
    raw = _ollama(prompt, image_bytes, model, timeout)
    if raw:
        nums = re.findall(r"\d+", raw)
        if nums:
            logger.info(f"[CAPTCHA/MATH] Ollama: {nums[0]}")
            return nums[0]
    return None


# ---------------------------------------------------------------------------
# Type 4 — SLIDER CAPTCHA
# ---------------------------------------------------------------------------

def solve_slider(
    background_bytes: bytes,
    slider_piece_bytes: Optional[bytes],
    model: str,
    timeout: int,
) -> Optional[int]:
    """
    Estimate target X coordinate (pixel) in slider CAPTCHA.

    Args:
        background_bytes:   Bytes of background image (gap is visible).
        slider_piece_bytes: Bytes of the slider piece (optional).

    Returns:
        Estimated X coordinate (int) or None.
    """
    prompt = (
        "This is a slider CAPTCHA background image. "
        "There is a notch/gap where the slider piece should be placed. "
        "Reply with ONLY the X coordinate (horizontal pixel position) of the center of the gap. "
        "Example: 217"
    )
    # If there is a slider piece, send background first
    raw = _ollama(prompt, background_bytes, model, timeout)
    if raw:
        nums = re.findall(r"\d+", raw)
        if nums:
            x = int(nums[0])
            logger.info(f"[CAPTCHA/SLIDER] Estimated X: {x}")
            return x
    return None


# ---------------------------------------------------------------------------
# Main CaptchaSolver class
# ---------------------------------------------------------------------------

class CaptchaSolver:
    """
    Single interface, four CAPTCHA types:
      - TEXT   : solve(image_bytes)
      - GRID   : solve_grid(grid_image_bytes, instruction, grid_size=3)
      - MATH   : solve_math(expression, image_bytes=None)
      - SLIDER : solve_slider(background_bytes, slider_piece_bytes=None)

    Usage:
        solver = CaptchaSolver(ollama_model="llava:34b")
        # Text CAPTCHA
        text = solver.solve(image_bytes, CaptchaType.TEXT)
        # Grid CAPTCHA
        cells = solver.solve_grid(grid_img, "Select all cars", grid_size=3)
        # Math CAPTCHA
        answer = solver.solve_math("7 + 4 = ?")
        # Slider CAPTCHA
        x_pos = solver.solve_slider(bg_img)
    """

    def __init__(
        self,
        ollama_model: str = "llava",
        ollama_timeout: int = 60,
        ollama_url: str = OLLAMA_API_URL,
    ):
        self.model = ollama_model
        self.timeout = ollama_timeout
        global OLLAMA_API_URL
        OLLAMA_API_URL = ollama_url

    # --- Text ---
    def solve(self, image_bytes: bytes, captcha_type: CaptchaType = CaptchaType.TEXT) -> Optional[Union[str, List[int], int]]:
        """General solver; specify type or use default TEXT."""
        if captcha_type == CaptchaType.TEXT:
            return solve_text(image_bytes, self.model, self.timeout)
        raise ValueError(f"This method is only for TEXT; use specific methods for other types.")

    def solve_grid(
        self,
        grid_image_bytes: bytes,
        instruction: str,
        grid_size: int = 3,
    ) -> Optional[List[int]]:
        """Solve grid CAPTCHA — return which cells to select."""
        return solve_grid(grid_image_bytes, instruction, self.model, self.timeout, grid_size)

    def solve_math(
        self,
        expression: str,
        image_bytes: Optional[bytes] = None,
    ) -> Optional[str]:
        """Solve math CAPTCHA."""
        return solve_math(expression, image_bytes, self.model, self.timeout)

    def solve_slider(
        self,
        background_bytes: bytes,
        slider_piece_bytes: Optional[bytes] = None,
    ) -> Optional[int]:
        """Return target X coordinate for Slider CAPTCHA."""
        return solve_slider(background_bytes, slider_piece_bytes, self.model, self.timeout)
