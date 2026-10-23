import os
import sys

# Ensure root directory is in sys.path so 'backend.app' can be imported anywhere
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Import the configured FastAPI app
from backend.app.main import app

# Vercel Serverless Function entry point
# '@vercel/python' automatically looks for an ASGI/WSGI app named 'app'
