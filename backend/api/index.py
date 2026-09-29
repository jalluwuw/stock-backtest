import sys
import os

# Add backend root to path so `main` and `ihsg_sync` can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
