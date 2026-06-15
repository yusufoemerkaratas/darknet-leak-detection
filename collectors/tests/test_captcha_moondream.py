# collectors/tests/test_captcha_moondream.py
#
# Unit tests for MoondreamSolver integration and fallback chain.
# Uses mocks to avoid actual model loading / inference in CI.

import io
import re
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dummy_captcha_png(text: str = "ABC123") -> bytes:
    """Create a minimal valid PNG image for tests (1x1 white pixel)."""
    # Smallest valid PNG (1x1 white pixel)
    import struct, zlib
    def _make_png():
        sig = b'\x89PNG\r\n\x1a\n'
        # IHDR
        ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
        ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
        ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
        # IDAT
        raw = zlib.compress(b'\x00\xff\xff\xff')
        idat_crc = zlib.crc32(b'IDAT' + raw) & 0xffffffff
        idat = struct.pack('>I', len(raw)) + b'IDAT' + raw + struct.pack('>I', idat_crc)
        # IEND
        iend_crc = zlib.crc32(b'IEND') & 0xffffffff
        iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
        return sig + ihdr + idat + iend
    return _make_png()


DUMMY_IMG = _dummy_captcha_png()


# ---------------------------------------------------------------------------
# MoondreamSolver — lazy load
# ---------------------------------------------------------------------------

class TestMoondreamSolverLazyLoad:
    """Verify model is only loaded on first call (lazy-load pattern)."""

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_solve_text_calls_load_model(self, mock_load):
        """_load_model should be called when solve_text is invoked."""
        from captcha_solver import MoondreamSolver

        # Reset class state
        MoondreamSolver._model = None
        MoondreamSolver._tokenizer = None
        MoondreamSolver._loaded_model_id = None

        # Mock _load_model to set up a fake model
        def setup_fake_model(model_id, device):
            mock_model = MagicMock()
            mock_model.encode_image.return_value = "fake_enc"
            mock_model.answer_question.return_value = "XY789"
            MoondreamSolver._model = mock_model
            MoondreamSolver._tokenizer = MagicMock()
            MoondreamSolver._loaded_model_id = model_id

        mock_load.side_effect = setup_fake_model

        result = MoondreamSolver.solve_text(DUMMY_IMG, "vikhyatk/moondream2", "cpu")
        mock_load.assert_called_once_with("vikhyatk/moondream2", "cpu")
        assert result == "XY789"

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_solve_text_skips_reload_if_already_loaded(self, mock_load):
        """If model is already loaded, _load_model should NOT re-download."""
        from captcha_solver import MoondreamSolver

        mock_model = MagicMock()
        mock_model.encode_image.return_value = "enc"
        mock_model.answer_question.return_value = "ABC"
        MoondreamSolver._model = mock_model
        MoondreamSolver._tokenizer = MagicMock()
        MoondreamSolver._loaded_model_id = "vikhyatk/moondream2"

        result = MoondreamSolver.solve_text(DUMMY_IMG, "vikhyatk/moondream2", "cpu")
        # _load_model is called but returns early because model is already loaded
        assert result == "ABC"


# ---------------------------------------------------------------------------
# MoondreamSolver.solve_text
# ---------------------------------------------------------------------------

class TestMoondreamSolveText:

    def _setup_moondream(self, answer: str):
        """Set up MoondreamSolver with a mock model returning `answer`."""
        from captcha_solver import MoondreamSolver
        mock_model = MagicMock()
        mock_model.encode_image.return_value = "enc"
        mock_model.answer_question.return_value = answer
        MoondreamSolver._model = mock_model
        MoondreamSolver._tokenizer = MagicMock()
        MoondreamSolver._loaded_model_id = "vikhyatk/moondream2"

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_returns_clean_alphanumeric(self, mock_load):
        self._setup_moondream("  AB-CD 123!  ")
        from captcha_solver import MoondreamSolver
        result = MoondreamSolver.solve_text(DUMMY_IMG, "vikhyatk/moondream2", "cpu")
        assert result == "ABCD123"

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_returns_none_on_empty_answer(self, mock_load):
        self._setup_moondream("   ")
        from captcha_solver import MoondreamSolver
        result = MoondreamSolver.solve_text(DUMMY_IMG, "vikhyatk/moondream2", "cpu")
        assert result is None

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_returns_none_on_exception(self, mock_load):
        from captcha_solver import MoondreamSolver
        mock_load.side_effect = RuntimeError("CUDA OOM")
        MoondreamSolver._model = None
        MoondreamSolver._loaded_model_id = None
        result = MoondreamSolver.solve_text(DUMMY_IMG, "vikhyatk/moondream2", "cpu")
        assert result is None


# ---------------------------------------------------------------------------
# MoondreamSolver.solve_grid
# ---------------------------------------------------------------------------

class TestMoondreamSolveGrid:

    def _setup_moondream(self, answer: str):
        from captcha_solver import MoondreamSolver
        mock_model = MagicMock()
        mock_model.encode_image.return_value = "enc"
        mock_model.answer_question.return_value = answer
        MoondreamSolver._model = mock_model
        MoondreamSolver._tokenizer = MagicMock()
        MoondreamSolver._loaded_model_id = "vikhyatk/moondream2"

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_returns_indices(self, mock_load):
        self._setup_moondream("0, 3, 7")
        from captcha_solver import MoondreamSolver
        result = MoondreamSolver.solve_grid(DUMMY_IMG, "Select cars", "vikhyatk/moondream2", "cpu", 3)
        assert result == [0, 3, 7]

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_returns_empty_on_none_answer(self, mock_load):
        self._setup_moondream("none")
        from captcha_solver import MoondreamSolver
        result = MoondreamSolver.solve_grid(DUMMY_IMG, "Select cars", "vikhyatk/moondream2", "cpu", 3)
        assert result == []

    @patch("captcha_solver.MoondreamSolver._load_model")
    def test_filters_out_of_range_indices(self, mock_load):
        self._setup_moondream("0, 3, 15, 7")  # 15 is out of range for 3x3
        from captcha_solver import MoondreamSolver
        result = MoondreamSolver.solve_grid(DUMMY_IMG, "Select cars", "vikhyatk/moondream2", "cpu", 3)
        assert result == [0, 3, 7]


# ---------------------------------------------------------------------------
# Fallback chain — solve_text
# ---------------------------------------------------------------------------

class TestFallbackChain:
    """Test the full Ollama → Moondream → Tesseract fallback chain."""

    @patch("captcha_solver._tesseract_fallback", return_value=None)
    @patch("captcha_solver.MoondreamSolver.solve_text", return_value=None)
    @patch("captcha_solver._ollama", return_value="GOOD123")
    def test_ollama_succeeds_no_fallback(self, mock_ollama, mock_moon, mock_tess):
        """When Ollama succeeds, Moondream and Tesseract should NOT be called."""
        from captcha_solver import solve_text
        result = solve_text(DUMMY_IMG, "qwen3-vl:32b", 30, moondream_model="vikhyatk/moondream2")
        assert result == "GOOD123"
        mock_moon.assert_not_called()
        mock_tess.assert_not_called()

    @patch("captcha_solver._tesseract_fallback", return_value=None)
    @patch("captcha_solver.MoondreamSolver.solve_text", return_value="MOON456")
    @patch("captcha_solver._ollama", return_value=None)
    def test_ollama_fails_moondream_succeeds(self, mock_ollama, mock_moon, mock_tess):
        """When Ollama fails, Moondream should be tried and succeed."""
        from captcha_solver import solve_text
        result = solve_text(DUMMY_IMG, "qwen3-vl:32b", 30, moondream_model="vikhyatk/moondream2")
        assert result == "MOON456"
        mock_moon.assert_called_once()
        mock_tess.assert_not_called()

    @patch("captcha_solver._tesseract_fallback", return_value="TESS789")
    @patch("captcha_solver.MoondreamSolver.solve_text", return_value=None)
    @patch("captcha_solver._ollama", return_value=None)
    def test_ollama_and_moondream_fail_tesseract_succeeds(self, mock_ollama, mock_moon, mock_tess):
        """When both Ollama and Moondream fail, Tesseract should be the last resort."""
        from captcha_solver import solve_text
        result = solve_text(DUMMY_IMG, "qwen3-vl:32b", 30, moondream_model="vikhyatk/moondream2")
        assert result == "TESS789"

    @patch("captcha_solver._tesseract_fallback", return_value=None)
    @patch("captcha_solver.MoondreamSolver.solve_text", return_value=None)
    @patch("captcha_solver._ollama", return_value=None)
    def test_all_fail_returns_none(self, mock_ollama, mock_moon, mock_tess):
        """When all solvers fail, result should be None."""
        from captcha_solver import solve_text
        result = solve_text(DUMMY_IMG, "qwen3-vl:32b", 30, moondream_model="vikhyatk/moondream2")
        assert result is None

    @patch("captcha_solver._tesseract_fallback", return_value="TESS")
    @patch("captcha_solver.MoondreamSolver.solve_text")
    @patch("captcha_solver._ollama", return_value=None)
    def test_moondream_disabled_skips_to_tesseract(self, mock_ollama, mock_moon, mock_tess):
        """When moondream_model is empty, Moondream should be skipped entirely."""
        from captcha_solver import solve_text
        result = solve_text(DUMMY_IMG, "qwen3-vl:32b", 30, moondream_model="")
        assert result == "TESS"
        mock_moon.assert_not_called()


# ---------------------------------------------------------------------------
# CaptchaSolver class — constructor and forwarding
# ---------------------------------------------------------------------------

class TestCaptchaSolverMoondreamIntegration:
    """Test that CaptchaSolver correctly forwards moondream params."""

    def test_constructor_stores_moondream_params(self):
        from captcha_solver import CaptchaSolver
        solver = CaptchaSolver(
            moondream_model="vikhyatk/moondream2",
            moondream_device="cuda",
        )
        assert solver.moondream_model == "vikhyatk/moondream2"
        assert solver.moondream_device == "cuda"

    def test_constructor_defaults_from_env(self):
        from captcha_solver import CaptchaSolver, MOONDREAM_MODEL_ID, MOONDREAM_DEVICE
        solver = CaptchaSolver()
        assert solver.moondream_model == MOONDREAM_MODEL_ID
        assert solver.moondream_device == MOONDREAM_DEVICE

    def test_disabled_with_empty_model(self):
        from captcha_solver import CaptchaSolver
        solver = CaptchaSolver(moondream_model="")
        assert solver.moondream_model == ""

    @patch("captcha_solver.solve_text")
    def test_solve_forwards_moondream_params(self, mock_solve):
        """CaptchaSolver.solve() should pass moondream params to solve_text()."""
        from captcha_solver import CaptchaSolver, CaptchaType
        mock_solve.return_value = "TEST"
        solver = CaptchaSolver(
            moondream_model="vikhyatk/moondream2",
            moondream_device="cpu",
        )
        solver.solve(DUMMY_IMG, CaptchaType.TEXT)
        mock_solve.assert_called_once_with(
            DUMMY_IMG, solver.model, solver.timeout,
            moondream_model="vikhyatk/moondream2",
            moondream_device="cpu",
        )

    @patch("captcha_solver.solve_grid")
    def test_solve_grid_forwards_moondream_params(self, mock_solve):
        """CaptchaSolver.solve_grid() should pass moondream params to solve_grid()."""
        from captcha_solver import CaptchaSolver
        mock_solve.return_value = [0, 1]
        solver = CaptchaSolver(
            moondream_model="vikhyatk/moondream2",
            moondream_device="cpu",
        )
        solver.solve_grid(DUMMY_IMG, "Select cars", grid_size=3)
        mock_solve.assert_called_once_with(
            DUMMY_IMG, "Select cars", solver.model, solver.timeout, 3,
            moondream_model="vikhyatk/moondream2",
            moondream_device="cpu",
        )
