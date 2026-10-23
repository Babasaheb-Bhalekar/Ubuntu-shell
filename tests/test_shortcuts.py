import importlib.util
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
