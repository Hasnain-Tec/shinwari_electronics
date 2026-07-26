import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from tkinter import Tk, messagebox


HOST = "127.0.0.1"
PORT = 8000
APP_URL = f"http://{HOST}:{PORT}"


def server_is_running():
    try:
        with socket.create_connection((HOST, PORT), timeout=1):
            return True
    except OSError:
        return False


def get_app_folder():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent

    return Path(__file__).resolve().parent


def show_error(message):
    root = Tk()
    root.withdraw()

    messagebox.showerror(
        "MedTrade",
        message
    )

    root.destroy()


def main():
    app_folder = get_app_folder()

    backend_exe = app_folder / "MedTrade-Backend.exe"

    # Start backend only if it is not already running
    if not server_is_running():

        if not backend_exe.exists():
            show_error(
                "MedTrade-Backend.exe was not found.\n\n"
                "Please keep MedTrade.exe and "
                "MedTrade-Backend.exe in the same folder."
            )
            return

        try:
            creation_flags = 0

            if sys.platform == "win32":
                creation_flags = subprocess.CREATE_NO_WINDOW

            subprocess.Popen(
                [str(backend_exe)],
                cwd=str(app_folder),
                creationflags=creation_flags
            )

        except Exception as e:
            show_error(
                f"Could not start MedTrade backend.\n\n{e}"
            )
            return

    # Wait for backend to become ready
    for _ in range(30):
        if server_is_running():
            webbrowser.open(APP_URL)
            return

        time.sleep(1)

    show_error(
        "MedTrade backend did not start within 30 seconds."
    )


if __name__ == "__main__":
    main()