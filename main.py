"""Shim so `uvicorn main:app` still works from the repo root."""

import importlib.util
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

spec = importlib.util.spec_from_file_location("sightglass_backend", BACKEND / "main.py")
if spec is None or spec.loader is None:
    raise ImportError("Unable to load backend/main.py")
module = importlib.util.module_from_spec(spec)
sys.modules["sightglass_backend"] = module
spec.loader.exec_module(module)

app = module.app
event_generator = module.event_generator

__all__ = ["app", "event_generator"]
