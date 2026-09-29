import sys
import os

# Tambahkan parent directory ke sys.path agar bisa import main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
