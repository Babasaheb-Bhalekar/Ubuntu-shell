import importlib.util
from subprocess import CompletedProcess
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "shortcuts.py"
spec = importlib.util.spec_from_file_location("shortcuts", SCRIPT)
shortcuts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shortcuts)


class ShortcutTest(unittest.TestCase):
    def test_enable_preserves_existing_extensions(self):
        commands = []

        def fake_run(args, **_kwargs):
            commands.append(args)
            return CompletedProcess(args, 0, "['existing@example.com']")

        with patch.object(shortcuts.subprocess, "run", fake_run):
            shortcuts.enable()

        self.assertEqual(
            commands[-1],
            ("gsettings", "set", "org.gnome.shell", "enabled-extensions",
             "['existing@example.com', 'ubuntu-shell@babasaheb-bhalekar.github.io']"),
        )

    def test_enable_replaces_legacy_extension(self):
        commands = []

        def fake_run(args, **_kwargs):
            commands.append(args)
            return CompletedProcess(args, 0, "['existing@example.com', 'pop-shell@system76.com']")

        with patch.object(shortcuts.subprocess, "run", fake_run):
            shortcuts.enable()

        self.assertEqual(
            commands[-1][-1],
            "['existing@example.com', 'ubuntu-shell@babasaheb-bhalekar.github.io']",
        )

    def test_migrate_keeps_existing_new_preferences_and_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy = root / "pop-shell"
            legacy.mkdir()
            (legacy / "config.json").write_text('{"float": []}')
            (legacy / "shortcut-backup.json").write_text('{"old": "value"}')
            state = {
                shortcuts.LEGACY_SCHEMA_PATH + "gap-inner": "uint32 6",
                shortcuts.LEGACY_SCHEMA_PATH + "pop-workspace-up": "['<Super>Page_Up']",
                shortcuts.SCHEMA_PATH + "gap-inner": "uint32 4",
            }

            def fake_dconf(action, key, *args):
                if action == "list":
                    return "gap-inner\npop-workspace-up"
                if action == "read":
                    return state.get(key, "")
                if action == "write":
                    state[key] = args[0]
                return ""

            with patch.object(shortcuts, "BACKUP", root / "ubuntu-shell" / "shortcut-backup.json"), patch.object(
                shortcuts, "dconf", fake_dconf
            ):
                shortcuts.migrate()

            self.assertEqual(state[shortcuts.SCHEMA_PATH + "gap-inner"], "uint32 4")
            self.assertEqual(state[shortcuts.SCHEMA_PATH + "ubuntu-workspace-up"], "['<Super>Page_Up']")
            self.assertEqual((root / "ubuntu-shell" / "config.json").read_text(), '{"float": []}')
            self.assertEqual((root / "ubuntu-shell" / "shortcut-backup.json").read_text(), '{"old": "value"}')

    def test_apply_and_restore_preserve_later_user_change(self):
        with tempfile.TemporaryDirectory() as directory:
            state = {"/one": "'old'", "/two": "'other'"}

            def fake_dconf(action, key, *args):
                if action == "read":
                    return state.get(key, "")
                if action == "write":
                    state[key] = args[0]
                elif action == "reset":
                    state.pop(key, None)
                return ""

            backup = Path(directory) / "shortcut-backup.json"
            with patch.object(shortcuts, "BACKUP", backup), patch.object(
                shortcuts, "CHANGES", {"/one": "'new'", "/two": "'new'"}
            ), patch.object(shortcuts, "dconf", fake_dconf):
                shortcuts.apply()
                self.assertEqual(state, {"/one": "'new'", "/two": "'new'"})
                self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
                state["/two"] = "'user change'"
                shortcuts.restore()
                self.assertEqual(state, {"/one": "'old'", "/two": "'user change'"})
                self.assertFalse(backup.exists())


if __name__ == "__main__":
    unittest.main()
