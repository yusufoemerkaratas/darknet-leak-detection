# collectors/captcha_solver.py
#
# CAPTCHA solver — supported types:
#   1. TEXT   : Classic character based CAPTCHA
#               → Ollama Vision (qwen3-vl:32b) → Moondream 2 fallback → Tesseract OCR fallback
#   2. GRID   : Image matching ("Select cars", "click on traffic lights")
#               → Ollama Vision: send grid image + instruction together,
#                 get which cell indices should be selected
#               → Moondream 2 fallback for grid analysis
#   3. MATH   : "3 + 7 = ?" type mathematical CAPTCHA
#               → Regex based solution, Ollama fallback
#   4. SLIDER : Slider CAPTCHA (position estimation)
#               → Estimate target position with Ollama Vision
#
# Fallback chain (Text CAPTCHA example):
#   Ollama qwen3-vl → Moondream 2 (local VLM) → Tesseract OCR → fail
#
# Dependencies:
#   pip install requests pillow transformers torch einops
#   pacman -S tesseract tesseract-data-eng python-pytesseract python-opencv

import base64
import io
import logging
import os
import re
from enum import Enum, auto
from pathlib import Path
from typing import List, Optional, Union

import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

OLLAMA_API_URL = os.environ.get("OLLAMA_URL", "http://localhost:9999") + "/api/generate"


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


def solve_text(
    image_bytes: bytes,
    model: str,
    timeout: int,
    moondream_model: str = "",
    moondream_device: str = "cpu",
) -> Optional[str]:
    """Solve classic character CAPTCHA.

    Fallback chain: Ollama → Moondream 2 → Tesseract OCR.
    """
    # 1. Ollama (primary)
    raw = _ollama(_TEXT_PROMPT, image_bytes, model, timeout)
    if raw:
        solution = re.sub(r"[^A-Za-z0-9]", "", raw)
        if solution:
            logger.info(f"[CAPTCHA/TEXT] solver=ollama model={model} result='{solution}' length={len(solution)}")
            return solution
        logger.warning(f"[CAPTCHA/TEXT] solver=ollama model={model} result=EMPTY (raw response had no alphanumeric chars)")

    # 2. Moondream fallback
    if moondream_model:
        logger.info("[CAPTCHA/TEXT] Trying Moondream fallback...")
        solution = MoondreamSolver.solve_text(image_bytes, moondream_model, moondream_device)
        if solution:
            return solution

    # 3. Tesseract OCR (last resort)
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
    moondream_model: str = "",
    moondream_device: str = "cpu",
) -> Optional[List[int]]:
    """
    Solve image grid CAPTCHA ("Select squares containing cars" etc.)

    Fallback chain: Ollama → Moondream 2.

    Args:
        grid_image_bytes: Bytes of the entire grid image.
        instruction:      Original CAPTCHA instruction ("Select all images with cars").
        model:            Ollama vision model.
        timeout:          Timeout.
        grid_size:        Grid size (default 3x3 = 9 cells).
        moondream_model:  HuggingFace model ID for Moondream fallback (empty = disabled).
        moondream_device: Device for Moondream inference ("cpu" or "cuda").

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
    # 1. Ollama (primary)
    raw = _ollama(prompt, grid_image_bytes, model, timeout)
    if raw:
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
        if indices:
            logger.info(f"[CAPTCHA/GRID] solver=ollama model={model} cells={indices} count={len(indices)}")
            return indices

    # 2. Moondream fallback
    if moondream_model:
        logger.info("[CAPTCHA/GRID] Trying Moondream fallback...")
        result = MoondreamSolver.solve_grid(
            grid_image_bytes, instruction, moondream_model, moondream_device, grid_size
        )
        if result is not None:
            return result

    return None


# ---------------------------------------------------------------------------
# Type 3 — MATH CAPTCHA
# ---------------------------------------------------------------------------

_MATH_PATTERN = re.compile(
    r"(\d+)\s*([+\-×x\*/])\s*(\d+)\s*[=?]"
)


def solve_math(
    expression: str,
    image_bytes: Optional[bytes] = None,
    model: str = "qwen3-vl:32b",
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
# Moondream VLM fallback solver
# ---------------------------------------------------------------------------

MOONDREAM_MODEL_ID = os.environ.get("MOONDREAM_MODEL", "vikhyatk/moondream2")
MOONDREAM_DEVICE = os.environ.get("MOONDREAM_DEVICE", "cpu")


class MoondreamSolver:
    """
    Moondream 2 VLM fallback for CAPTCHA solving.

    Lazy-load: the model (~3.7 GB) is downloaded and loaded only on the first
    call, so it does not slow down normal startup when Ollama is available.

    Usage (standalone — usually called automatically by the fallback chain):
        solution = MoondreamSolver.solve_text(image_bytes, "vikhyatk/moondream2", "cpu")
    """

    _model = None
    _tokenizer = None
    _loaded_model_id: Optional[str] = None

    @classmethod
    def _load_model(cls, model_id: str, device: str) -> None:
        """Download (if needed) and load Moondream model — called once."""
        if cls._model is not None and cls._loaded_model_id == model_id:
            return
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            logger.info(f"[Moondream] Loading model {model_id} on {device}...")
            cls._tokenizer = AutoTokenizer.from_pretrained(
                model_id, trust_remote_code=True,
            )
            dtype = torch.float16 if device == "cuda" else torch.float32
            cls._model = AutoModelForCausalLM.from_pretrained(
                model_id,
                trust_remote_code=True,
                torch_dtype=dtype,
                device_map={"" : device},
            )
            cls._loaded_model_id = model_id
            logger.info(f"[Moondream] Model loaded successfully on {device}")
        except Exception as exc:
            logger.error(f"[Moondream] Failed to load model: {exc}")
            cls._model = None
            raise

    # -- Text CAPTCHA --------------------------------------------------------

    @classmethod
    def solve_text(
        cls,
        image_bytes: bytes,
        model_id: str = MOONDREAM_MODEL_ID,
        device: str = MOONDREAM_DEVICE,
    ) -> Optional[str]:
        """Read characters from a CAPTCHA image using Moondream VLM."""
        try:
            from PIL import Image

            cls._load_model(model_id, device)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            enc_image = cls._model.encode_image(image)
            answer = cls._model.answer_question(enc_image, _TEXT_PROMPT, cls._tokenizer)
            solution = re.sub(r"[^A-Za-z0-9]", "", answer.strip())
            if solution:
                logger.info(f"[CAPTCHA/TEXT] solver=moondream model={model_id} result='{solution}' length={len(solution)}")
                return solution
            logger.warning(f"[CAPTCHA/TEXT] solver=moondream model={model_id} result=EMPTY")
        except Exception as exc:
            logger.warning(f"[CAPTCHA/TEXT] Moondream error: {exc}")
        return None

    # -- Grid CAPTCHA --------------------------------------------------------

    @classmethod
    def solve_grid(
        cls,
        grid_image_bytes: bytes,
        instruction: str,
        model_id: str = MOONDREAM_MODEL_ID,
        device: str = MOONDREAM_DEVICE,
        grid_size: int = 3,
    ) -> Optional[List[int]]:
        """Solve a grid CAPTCHA using Moondream VLM."""
        try:
            from PIL import Image

            cls._load_model(model_id, device)
            image = Image.open(io.BytesIO(grid_image_bytes)).convert("RGB")
            enc_image = cls._model.encode_image(image)

            total = grid_size * grid_size
            prompt = (
                f"This is a {grid_size}x{grid_size} CAPTCHA grid. "
                f"Cells numbered 0-{total - 1}, left-to-right, top-to-bottom. "
                f"Task: {instruction}. "
                f"Reply with ONLY the matching cell numbers, comma-separated. "
                f"If none match, reply: none"
            )
            answer = cls._model.answer_question(enc_image, prompt, cls._tokenizer)
            if answer.strip().lower() == "none":
                logger.info("[CAPTCHA/GRID] Moondream: no matching cells")
                return []

            indices = [
                int(t)
                for t in re.split(r"[,\s]+", answer)
                if t.strip().isdigit() and 0 <= int(t) < total
            ]
            if indices:
                logger.info(f"[CAPTCHA/GRID] solver=moondream model={model_id} cells={indices} count={len(indices)}")
                return indices
        except Exception as exc:
            logger.warning(f"[CAPTCHA/GRID] Moondream error: {exc}")
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

    Fallback chain for TEXT/GRID: Ollama → Moondream 2 → Tesseract OCR.

    Usage:
        solver = CaptchaSolver(
            ollama_model="qwen3-vl:32b",
            moondream_model="vikhyatk/moondream2",
        )
        text = solver.solve(image_bytes, CaptchaType.TEXT)
        cells = solver.solve_grid(grid_img, "Select all cars", grid_size=3)
        answer = solver.solve_math("7 + 4 = ?")
        x_pos = solver.solve_slider(bg_img)
    """

    def __init__(
        self,
        ollama_model: str = "qwen3-vl:32b",
        ollama_timeout: int = 60,
        ollama_url: str = OLLAMA_API_URL,
        # Moondream fallback — set model to "" to disable
        moondream_model: str = MOONDREAM_MODEL_ID,
        moondream_device: str = MOONDREAM_DEVICE,
    ):
        self.model = ollama_model
        self.timeout = ollama_timeout
        self.moondream_model = moondream_model
        self.moondream_device = moondream_device
        global OLLAMA_API_URL
        OLLAMA_API_URL = ollama_url

    # --- Text ---
    def solve(self, image_bytes: bytes, captcha_type: CaptchaType = CaptchaType.TEXT) -> Optional[Union[str, List[int], int]]:
        """General solver; specify type or use default TEXT."""
        if captcha_type == CaptchaType.TEXT:
            return solve_text(
                image_bytes, self.model, self.timeout,
                moondream_model=self.moondream_model,
                moondream_device=self.moondream_device,
            )
        raise ValueError(f"This method is only for TEXT; use specific methods for other types.")

    def solve_grid(
        self,
        grid_image_bytes: bytes,
        instruction: str,
        grid_size: int = 3,
    ) -> Optional[List[int]]:
        """Solve grid CAPTCHA — return which cells to select."""
        return solve_grid(
            grid_image_bytes, instruction, self.model, self.timeout, grid_size,
            moondream_model=self.moondream_model,
            moondream_device=self.moondream_device,
        )

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
