"""
One-step setup script
Runs migrations and seeds the database in sequence
"""

import subprocess
import sys
import os


def run_command(cmd: list, description: str) -> bool:
    """Run a command and return success status"""
    print(f"\n{'='*60}")
    print(f"📌 {description}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed: {description}")
        print(f"Error: {e}")
        return False


def main():
    """Run setup steps"""
    os.chdir(os.path.dirname(__file__) or ".")

    # Get database URL from env or use default
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://geosafe_user:geosafe_pass@localhost:5432/geosafe"
    )

    steps = [
        (
            ["python", "-m", "alembic", "upgrade", "head"],
            "Running Alembic database migrations",
        ),
        (
            ["python", "seed_db.py"],
            "Seeding database with sample data",
        ),
    ]

    print("🚀 GeoSafe Setup - Migrations & Seeding")
    print(f"Database: {db_url}")

    for cmd, desc in steps:
        if not run_command(cmd, desc):
            print("\n❌ Setup failed!")
            sys.exit(1)

    print("\n" + "="*60)
    print("✅ Setup completed successfully!")
    print("="*60)
    print("\nNext steps:")
    print("1. Start backend:  uvicorn app.main:app --reload")
    print("2. Start frontend: cd frontend && npm start")
    print("3. Visit: http://localhost:3000")


if __name__ == "__main__":
    main()
