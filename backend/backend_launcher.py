import os
import sqlite3
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------
# 1. Create permanent MedTrade data folder
# ---------------------------------------------------------
local_app_data = os.environ.get("LOCALAPPDATA")

if local_app_data:
    data_dir = Path(local_app_data) / "MedTrade"
else:
    data_dir = Path.home() / "MedTrade"

data_dir.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------
# 2. Define permanent database and backup locations
# ---------------------------------------------------------
database_file = data_dir / "db.sqlite3"

backup_dir = data_dir / "Backups"
backup_dir.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------
# 3. Tell Django where permanent data is stored
# ---------------------------------------------------------
os.environ["MEDTRADE_DATA_DIR"] = str(data_dir)

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "medtrade.settings"
)


# ---------------------------------------------------------
# 4. Create automatic SQLite backup
# ---------------------------------------------------------
def create_database_backup():
    """
    Creates a safe SQLite backup whenever MedTrade starts.

    Backup location:
    %LOCALAPPDATA%\\MedTrade\\Backups

    Keeps only the latest 30 successful backups.
    """

    # First launch: database may not exist yet
    if not database_file.exists():
        return

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    backup_file = (
        backup_dir /
        f"MedTrade_{timestamp}.sqlite3"
    )

    source_connection = None
    backup_connection = None

    try:
        # Open the real MedTrade database
        source_connection = sqlite3.connect(
            str(database_file)
        )

        # Create the backup database
        backup_connection = sqlite3.connect(
            str(backup_file)
        )

        # SQLite-safe backup operation
        source_connection.backup(
            backup_connection
        )

        backup_connection.commit()

        # Verify that the new backup is healthy
        result = backup_connection.execute(
            "PRAGMA integrity_check;"
        ).fetchone()

        if not result or result[0].lower() != "ok":
            raise RuntimeError(
                "Backup integrity check failed."
            )

        # Keep only newest 30 backups
        backups = sorted(
            backup_dir.glob("MedTrade_*.sqlite3"),
            key=lambda path: path.stat().st_mtime,
            reverse=True
        )

        for old_backup in backups[30:]:
            try:
                old_backup.unlink()
            except OSError:
                pass

    except Exception:
        # Remove incomplete/broken backup
        try:
            if backup_file.exists():
                backup_file.unlink()
        except OSError:
            pass

        # Important:
        # Backup failure must not stop MedTrade from opening
        pass

    finally:
        if backup_connection is not None:
            backup_connection.close()

        if source_connection is not None:
            source_connection.close()


# ---------------------------------------------------------
# 5. Create backup BEFORE Django starts changing data
# ---------------------------------------------------------
create_database_backup()


# ---------------------------------------------------------
# 6. Start Django
# ---------------------------------------------------------
import django

django.setup()


# ---------------------------------------------------------
# 7. Prepare database automatically
# ---------------------------------------------------------
from django.core.management import call_command

call_command(
    "migrate",
    interactive=False,
    verbosity=0
)


# ---------------------------------------------------------
# 8. Create default admin account if missing
# ---------------------------------------------------------
from django.contrib.auth import get_user_model

User = get_user_model()

if not User.objects.filter(
    username="admin"
).exists():
    call_command(
        "seed_demo",
        verbosity=0
    )


# ---------------------------------------------------------
# 9. Start MedTrade through Waitress
# ---------------------------------------------------------
from waitress import serve
from medtrade.wsgi import application

serve(
    application,
    host="127.0.0.1",
    port=8000,
    threads=8
)