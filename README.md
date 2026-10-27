# Ubuntu Shell

Ubuntu Shell is a GNOME Shell 50 extension for Ubuntu 26.04 on Wayland. It provides automatic window tiling, stacking, keyboard navigation, a launcher, and a panel indicator for tiling settings. It is a continuation of the earlier Pop Shell extension, with the familiar window management shortcuts preserved.

The extension runs in GNOME Shell through GJS. The launcher is built in and does not require a separate launcher package. It searches installed applications, settings, and open windows; enter `t:` for a terminal command, `:` for a shell command, `=` for arithmetic, or `?` for the shortcut guide.

## Install on Ubuntu 26.04

Install the build tools and GNOME dependencies:

```sh
sudo apt update
sudo apt install gnome-shell dconf-cli xdg-terminal-exec python3 make node-typescript
```

Clone this repository and install for the current user:

```sh
git clone https://github.com/Babasaheb-Bhalekar/Ubuntu-shell.git
cd Ubuntu-shell
make local-install
```

**Log out and back in** after installation or updating. GNOME Shell on Wayland loads a newly installed extension at login. The installer queues Ubuntu Shell for the next login, removes an older user-local Pop Shell installation, and migrates any existing tiling preferences, floating exceptions, and shortcut backup. It removes the old extension from GNOME's enabled list. Settings already present under the new name take priority.

Use `gnome-extensions list --enabled` after logging in to confirm that `ubuntu-shell@babasaheb-bhalekar.github.io` is enabled. The panel indicator lets you turn tiling on or off and change the same window management settings. `make uninstall` removes the current user's extension and restores previous GNOME shortcuts where they have not since been changed by the user.

The local installer stores shortcut restoration data at `~/.config/ubuntu-shell/shortcut-backup.json` and floating window exceptions at `~/.config/ubuntu-shell/config.json`. It updates GNOME shortcuts for the current user only. If you change one after installation, uninstall will preserve your newer value.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Super+Y` | Toggle automatic tiling |
| `Super+/` | Open the launcher |
| `Super+H/J/K/L` or arrow keys | Focus a window in that direction |
| `Super+G` | Toggle the focused window between floating and tiled |
| `Super+S` | Toggle stacking |
| `Super+Enter` | Enter tile adjustment mode |
| `Super+O` | Change tiling orientation |
| `Super+Q` | Close the focused window |
| `Super+M` | Maximize or restore the focused window |

Press `?` in the launcher for the full shortcut guide. The defaults remain configurable through GNOME settings and the panel indicator.

## Compatibility and limits

Ubuntu's Desktop Icons NG extension can remain enabled. Ubuntu Shell excludes its desktop surfaces from tiling, focus, and raising, so desktop icons stay behind application windows. On Wayland, client-drawn titlebars cannot be forcibly hidden by this extension; the obsolete titlebar hiding feature was removed.

The intended target is Ubuntu 26.04 with GNOME Shell 50. Other GNOME Shell releases have not been validated. Multi-monitor behavior and window management should be checked in your own session after logging in; the repeatable and manual checks are listed in [TESTING.md](TESTING.md).

## Build and package

`make all` builds the extension. `make zip-file` creates a GNOME extension archive for isolated testing. `dpkg-buildpackage -us -uc -b` builds the `ubuntu-shell` Debian package. A system package cannot safely change another user's GNOME settings: each user should run `python3 /usr/lib/ubuntu-shell/scripts/shortcuts.py migrate`, then `apply` and `enable`, and log out and back in.

## Credits and license

Ubuntu Shell is derived from Pop Shell, originally developed by System76 and contributors. Original authorship and the license history are retained in [debian/copyright](debian/copyright) and the Git history. The code is distributed under GPL-3.0; see [LICENSE](LICENSE).
