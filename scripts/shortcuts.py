#!/usr/bin/env python3
"""Apply Ubuntu Shell's per-user GNOME shortcuts and restore prior values safely."""

import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


WM = "/org/gnome/desktop/wm/keybindings/"
SHELL = "/org/gnome/shell/keybindings/"
MUTTER = "/org/gnome/mutter/keybindings/"
MEDIA = "/org/gnome/settings-daemon/plugins/media-keys/"

CHANGES = {
    MUTTER + "toggle-tiled-left": "@as []",
    MUTTER + "toggle-tiled-right": "@as []",
    "/org/gnome/mutter/wayland/keybindings/restore-shortcuts": "@as []",
    WM + "minimize": "@as ['<Super>comma']",
    WM + "maximize": "@as []",
    WM + "unmaximize": "@as []",
    WM + "toggle-maximized": "@as ['<Super>m']",
    WM + "close": "@as ['<Super>q', '<Alt>F4']",
    SHELL + "toggle-message-tray": "@as ['<Super>v']",
    SHELL + "toggle-overview": "@as []",
    **{WM + f"{action}-{direction}": "@as []"
       for action in ("switch-to-workspace", "move-to-monitor", "move-to-workspace")
       for direction in ("left", "right", "up", "down")},
    WM + "switch-to-workspace-down": "@as ['<Primary><Super>Down','<Primary><Super>j']",
    WM + "switch-to-workspace-up": "@as ['<Primary><Super>Up','<Primary><Super>k']",
    MEDIA + "screensaver": "@as ['<Super>Escape']",
    MEDIA + "home": "@as ['<Super>f']",
    MEDIA + "email": "@as ['<Super>e']",
    MEDIA + "www": "@as ['<Super>b']",
    MEDIA + "terminal": "@as ['<Super>t']",
    MEDIA + "rotate-video-lock-static": "@as []",
    "/org/gnome/shell/disable-user-extensions": "false",
    "/org/gnome/mutter/workspaces-only-on-primary": "false",
}

BACKUP = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "ubuntu-shell" / "shortcut-backup.json"
UUID = "ubuntu-shell@babasaheb-bhalekar.github.io"
LEGACY_UUID = "pop-shell@system76.com"
SCHEMA_PATH = "/org/gnome/shell/extensions/ubuntu-shell/"
LEGACY_SCHEMA_PATH = "/org/gnome/shell/extensions/pop-shell/"


def dconf(*args):
    return subprocess.run(("dconf", *args), check=True, capture_output=True, text=True).stdout.strip()


def migrate():
    """Copy existing preferences and the original shortcut backup once."""
    for old_key in dconf("list", LEGACY_SCHEMA_PATH).splitlines():
        if old_key.endswith("/"):
            continue
        new_key = old_key.replace("pop-workspace", "ubuntu-workspace").replace("pop-monitor", "ubuntu-monitor")
        old_value = dconf("read", LEGACY_SCHEMA_PATH + old_key)
        if old_value and not dconf("read", SCHEMA_PATH + new_key):
            dconf("write", SCHEMA_PATH + new_key, old_value)

    legacy_dir = BACKUP.parent.parent / "pop-shell"
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    old_backup = legacy_dir / BACKUP.name
    if old_backup.exists() and not BACKUP.exists():
        shutil.copy2(old_backup, BACKUP)
        BACKUP.chmod(0o600)
    old_config = legacy_dir / "config.json"
    new_config = BACKUP.parent / old_config.name
    if old_config.exists() and not new_config.exists():
        shutil.copy2(old_config, new_config)
    print("Migrated available Ubuntu Shell settings")


def apply():
    if BACKUP.exists():
        print(f"Ubuntu Shell shortcut backup already exists: {BACKUP}")
        return
    previous = {}
    for key, value in CHANGES.items():
        old = dconf("read", key)
        if old != value:
            previous[key] = {"before": old, "applied": value}
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(BACKUP, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(previous, stream, indent=2)
    try:
        for key, values in previous.items():
            dconf("write", key, values["applied"])
    except Exception:
        restore()
        raise
    print(f"Applied {len(previous)} Ubuntu Shell shortcut and desktop settings")


def restore():
    if not BACKUP.exists():
        return
    previous = json.loads(BACKUP.read_text())
    for key, values in previous.items():
        if dconf("read", key) == values["applied"]:
            if values["before"]:
                dconf("write", key, values["before"])
            else:
                dconf("reset", key)
    BACKUP.unlink()
    print("Restored previous GNOME shortcuts where unchanged by the user")


def enable():
    """Queue a new extension for the next GNOME Shell login."""
    current = subprocess.run(
        ("gsettings", "get", "org.gnome.shell", "enabled-extensions"),
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    enabled = ast.literal_eval(current.removeprefix("@as "))
    if not isinstance(enabled, list) or not all(isinstance(item, str) for item in enabled):
        raise ValueError("Unexpected GNOME enabled-extensions value")
    before = enabled.copy()
    if LEGACY_UUID in enabled:
        enabled.remove(LEGACY_UUID)
    if UUID not in enabled:
        enabled.append(UUID)
    if enabled != before:
        subprocess.run(
            ("gsettings", "set", "org.gnome.shell", "enabled-extensions", repr(enabled)),
            check=True,
        )


def disable():
    current = subprocess.run(
        ("gsettings", "get", "org.gnome.shell", "enabled-extensions"),
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    enabled = ast.literal_eval(current.removeprefix("@as "))
    if UUID in enabled:
        enabled.remove(UUID)
        subprocess.run(
            ("gsettings", "set", "org.gnome.shell", "enabled-extensions", repr(enabled)),
            check=True,
        )


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("apply", "restore", "enable", "disable", "migrate"):
        raise SystemExit("usage: shortcuts.py apply|restore|enable|disable|migrate")
    globals()[sys.argv[1]]()
