import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export var METRICS = {};

export async function run() {
    await Scripting.sleep(4000);
    const button = Main.panel.statusArea['ubuntu-shell'];
    if (!button) throw new Error('Ubuntu Shell did not enable');
    button.menu._getMenuItems()[0].toggle();
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'gnome-shell-test-display', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    launcher.unsetenv('DISPLAY');
    launcher.spawnv(['gnome-calculator']);
    launcher.spawnv(['gnome-text-editor', '--new-window']);
    await Scripting.sleep(3000);
    const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)
        .filter(window => window.get_window_type() === Meta.WindowType.NORMAL);
    if (windows.length < 2)
        throw new Error(`Expected two application windows, found: ${windows.map(window => window.get_title())}`);
    const [first, second] = windows.slice(0, 2).map(window => window.get_frame_rect());
    const separate = first.x + first.width <= second.x || second.x + second.width <= first.x ||
        first.y + first.height <= second.y || second.y + second.height <= first.y;
    if (!separate) throw new Error('Tiled windows overlap');
    for (const window of windows) window.delete(global.get_current_time());
}
