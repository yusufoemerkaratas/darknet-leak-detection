# collectors/__init__.py

from .tor_manager import TorManager
from .darknet_forum_collector import DarknetForumCollector

__all__ = ['TorManager', 'DarknetForumCollector']