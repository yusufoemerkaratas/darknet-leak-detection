"""Pytest configuration for repository-level imports."""

from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parent
ROOT_PATH = str(ROOT_DIR)

if ROOT_PATH not in sys.path:
    sys.path.insert(0, ROOT_PATH)
