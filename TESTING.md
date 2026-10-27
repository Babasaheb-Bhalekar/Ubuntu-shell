# Testing Ubuntu Shell

Run the repeatable checks on Ubuntu 26.04 / GNOME Shell 50:

```sh
make zip-file
node tests/calculator.mjs
gjs -m tests/config.js
python3 -m unittest discover -s tests
dbus-run-session -- gnome-shell-test-tool --headless --extension ubuntu-shell@babasaheb-bhalekar.github.io_2.0.0.zip tests/gnome50.js
dbus-run-session -- gnome-shell-test-tool --headless --extension ubuntu-shell@babasaheb-bhalekar.github.io_2.0.0.zip tests/tiling-gnome50.js
dbus-run-session -- gnome-shell-test-tool --headless --extension ubuntu-shell@babasaheb-bhalekar.github.io_2.0.0.zip tests/hint-gnome50.js
dbus-run-session -- gnome-shell-test-tool --headless --extension ubuntu-shell@babasaheb-bhalekar.github.io_2.0.0.zip tests/desktop-surface-gnome50.js
```

For a live Wayland session, install with `make local-install`, log out and back in, then check:

- [ ] The panel indicator toggles automatic tiling and opens settings.
- [ ] `Super+Y` toggles tiling; `Super+/` opens the launcher and its `?`, `t:`, `:`, and `=` commands work.
- [ ] Directional focus, floating, stacking, and tile adjustment shortcuts work.
- [ ] Window open, close, minimize, fullscreen, and workspace moves keep the tiling tree correct.
- [ ] Tiling and focus work across multiple monitors, including an empty monitor.
- [ ] Active window hints appear only around visible focused windows.
- [ ] Desktop Icons NG icons remain behind application windows.
- [ ] The panel indicator and extension survive an enable/disable cycle.
- [ ] Floating exceptions and tiling preferences migrate from an older installation.
- [ ] `make uninstall` restores unchanged GNOME shortcuts and preserves later user changes.

Use `journalctl -o cat -n 0 -f "$(which gnome-shell)"` to inspect GNOME Shell logs during live tests. A headless test cannot confirm keyboard delivery, appearance, or behavior in the user's running desktop session.
