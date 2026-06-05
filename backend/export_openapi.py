"""
GS-091 — Export FastAPI OpenAPI schema to JSON without starting the server.

Usage:
    python backend/export_openapi.py              # writes docs/openapi.json
    python backend/export_openapi.py --stdout     # prints to stdout

Run from the repo root so relative imports resolve correctly.
"""
import json
import os
import sys
from pathlib import Path

# Allow imports from backend/
sys.path.insert(0, str(Path(__file__).parent))

# Minimal env so app imports don't crash on missing variables
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://placeholder/placeholder")
os.environ.setdefault("JWT_SECRET", "placeholder-secret-for-schema-export-only-not-used")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

from app.main import app  # noqa: E402  (must be after sys.path + env setup)

schema = app.openapi()

if "--stdout" in sys.argv:
    print(json.dumps(schema, ensure_ascii=False, indent=2))
else:
    out_path = Path(__file__).parent.parent / "docs" / "openapi.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] Schema written to {out_path}  ({len(schema.get('paths', {}))} paths)")
