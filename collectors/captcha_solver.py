# collectors/captcha_solver.py
#
# CAPTCHA çözücü — desteklenen tipler:
#   1. TEXT   : Klasik karakter tabanlı CAPTCHA
#               → Ollama Vision (llava) → Tesseract OCR fallback
#   2. GRID   : Resimli eşleştirme ("Arabaları seç", "trafik ışıklarına tıkla")
#               → Ollama Vision: grid görselini + talimatı birlikte gönder,
#                 hangi hücre indekslerinin seçilmesi gerektiğini al
#   3. MATH   : "3 + 7 = ?" tipi matematiksel CAPTCHA
#               → Regex tabanlı çözüm, Ollama fallback
#   4. SLIDER : Kaydırmalı CAPTCHA (konum tahmini)
#               → Ollama Vision ile hedef konumu tahmin et
#
# Bağımlılıklar:
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
# CAPTCHA türleri
# ---------------------------------------------------------------------------

class CaptchaType(Enum):
    TEXT   = auto()   # Klasik karakter CAPTCHA
    GRID   = auto()   # Resimli grid eşleştirme (reCAPTCHA tarzı)
    MATH   = auto()   # "3 + 7 = ?" tipi
    SLIDER = auto()   # Kaydırmalı doğrulama


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------

def _b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _ollama(
    prompt: str,
    image_bytes: Optional[bytes],
    model: str,
    timeout: int,
) -> Optional[str]:
    """Ollama API'ye istek at; cevabı ham string olarak döndür."""
    try:
        payload: dict = {"model": model, "prompt": prompt, "stream": False}
        if image_bytes:
            payload["images"] = [_b64(image_bytes)]
        resp = requests.post(OLLAMA_API_URL, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        logger.warning(f"[CAPTCHA] Ollama hatası: {e}")
        return None


# ---------------------------------------------------------------------------
# Tip 1 — TEXT CAPTCHA
# ---------------------------------------------------------------------------

_TEXT_PROMPT = (
    "This is a CAPTCHA image. "
    "Reply with ONLY the alphanumeric characters visible. "
    "No spaces, no explanation — just the characters."
)


def _tesseract_fallback(image_bytes: bytes) -> Optional[str]:
    """Tesseract OCR + OpenCV ön-işleme ile metin çıkar."""
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
        logger.debug("[CAPTCHA] OpenCV yok, ham görüntü kullanılıyor")
        from PIL import Image
        pil_img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        logger.warning(f"[CAPTCHA] OpenCV ön-işleme hatası: {e}")
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
        logger.error("[CAPTCHA] pytesseract yüklü değil — 'pip install pytesseract'")
    except Exception as e:
        logger.error(f"[CAPTCHA] Tesseract hatası: {e}")
    return None


def solve_text(image_bytes: bytes, model: str, timeout: int) -> Optional[str]:
    """Klasik karakter CAPTCHA'yı çöz."""
    raw = _ollama(_TEXT_PROMPT, image_bytes, model, timeout)
    if raw:
        solution = re.sub(r"[^A-Za-z0-9]", "", raw)
        if solution:
            logger.info(f"[CAPTCHA/TEXT] Ollama: '{solution}'")
            return solution
        logger.warning("[CAPTCHA/TEXT] Ollama cevapladı ama karakter bulunamadı")

    logger.info("[CAPTCHA/TEXT] Tesseract fallback deneniyor…")
    return _tesseract_fallback(image_bytes)


# ---------------------------------------------------------------------------
# Tip 2 — GRID / Resimli Eşleştirme CAPTCHA
# ---------------------------------------------------------------------------

def solve_grid(
    grid_image_bytes: bytes,
    instruction: str,
    model: str,
    timeout: int,
    grid_size: int = 3,
) -> Optional[List[int]]:
    """
    Resimli grid CAPTCHA'yı çöz ("Arabaları içeren kareleri seç" vb.)

    Args:
        grid_image_bytes: Tüm grid görselinin baytları.
        instruction:      Orijinal CAPTCHA talimatı ("Select all images with cars").
        model:            Ollama vision modeli.
        timeout:          Zaman aşımı.
        grid_size:        Grid boyutu (varsayılan 3×3 = 9 hücre).

    Returns:
        Seçilmesi gereken hücre indeksleri listesi (0-tabanlı, sol→sağ, üst→alt).
        Örn. [0, 3, 7]  → None döner hata durumunda.
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
        logger.info("[CAPTCHA/GRID] Hiç eşleşen hücre yok")
        return []

    indices = []
    for token in re.split(r"[,\s]+", raw):
        token = token.strip()
        if token.isdigit():
            idx = int(token)
            if 0 <= idx < total:
                indices.append(idx)
    logger.info(f"[CAPTCHA/GRID] Seçilen hücreler: {indices}")
    return indices if indices else None


# ---------------------------------------------------------------------------
# Tip 3 — MATH CAPTCHA
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
    Matematik CAPTCHA'yı çöz.

    Args:
        expression:   "3 + 7 = ?" gibi metin (sayfadan çekilmiş).
        image_bytes:  İfade görselden geliyorsa opsiyonel görsel.

    Returns:
        Sonuç string'i (örn. "10") veya None.
    """
    # Önce regex ile dene
    m = _MATH_PATTERN.search(expression)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ops = {'+': a + b, '-': a - b, '*': a * b, 'x': a * b, '×': a * b, '/': a // b}
        result = ops.get(op)
        if result is not None:
            logger.info(f"[CAPTCHA/MATH] Regex: {a} {op} {b} = {result}")
            return str(result)

    # Regex başarısız ise Ollama'ya sor
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
# Tip 4 — SLIDER CAPTCHA
# ---------------------------------------------------------------------------

def solve_slider(
    background_bytes: bytes,
    slider_piece_bytes: Optional[bytes],
    model: str,
    timeout: int,
) -> Optional[int]:
    """
    Kaydırmalı CAPTCHA'da hedef X koordinatını (piksel) tahmin et.

    Args:
        background_bytes:   Arka plan görselinin baytları (boşluk görünür).
        slider_piece_bytes: Kaydırılacak parçanın baytları (opsiyonel).

    Returns:
        Tahmini X koordinatı (int) veya None.
    """
    prompt = (
        "This is a slider CAPTCHA background image. "
        "There is a notch/gap where the slider piece should be placed. "
        "Reply with ONLY the X coordinate (horizontal pixel position) of the center of the gap. "
        "Example: 217"
    )
    # Eğer slider parçası da varsa, arka planı önce gönder
    raw = _ollama(prompt, background_bytes, model, timeout)
    if raw:
        nums = re.findall(r"\d+", raw)
        if nums:
            x = int(nums[0])
            logger.info(f"[CAPTCHA/SLIDER] Tahmini X: {x}")
            return x
    return None


# ---------------------------------------------------------------------------
# Ana CaptchaSolver sınıfı
# ---------------------------------------------------------------------------

class CaptchaSolver:
    """
    Tek arayüz, dört CAPTCHA tipi:
      - TEXT   : solve(image_bytes)
      - GRID   : solve_grid(grid_image_bytes, instruction, grid_size=3)
      - MATH   : solve_math(expression, image_bytes=None)
      - SLIDER : solve_slider(background_bytes, slider_piece_bytes=None)

    Kullanım:
        solver = CaptchaSolver(ollama_model="llava:34b")
        # Metin CAPTCHA
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
        """Genel çözücü; tipi belirt veya varsayılan TEXT kullan."""
        if captcha_type == CaptchaType.TEXT:
            return solve_text(image_bytes, self.model, self.timeout)
        raise ValueError(f"Bu metod sadece TEXT için; diğer tipler için özel metodları kullan.")

    def solve_grid(
        self,
        grid_image_bytes: bytes,
        instruction: str,
        grid_size: int = 3,
    ) -> Optional[List[int]]:
        """Grid CAPTCHA çöz — hangi hücrelerin seçileceğini döndür."""
        return solve_grid(grid_image_bytes, instruction, self.model, self.timeout, grid_size)

    def solve_math(
        self,
        expression: str,
        image_bytes: Optional[bytes] = None,
    ) -> Optional[str]:
        """Math CAPTCHA çöz."""
        return solve_math(expression, image_bytes, self.model, self.timeout)

    def solve_slider(
        self,
        background_bytes: bytes,
        slider_piece_bytes: Optional[bytes] = None,
    ) -> Optional[int]:
        """Slider CAPTCHA için hedef X koordinatını döndür."""
        return solve_slider(background_bytes, slider_piece_bytes, self.model, self.timeout)
