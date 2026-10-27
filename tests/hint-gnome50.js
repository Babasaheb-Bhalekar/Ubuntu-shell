import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export var METRICS = {};

function visibleHints() {
    return global.window_group.get_children().filter(actor =>
        actor instanceof St.Bin && actor.has_style_class_name('ubuntu-shell-active-hint') && actor.visible);
}

function assertHints(count, stage) {
    const actual = visibleHints().length;
    if (actual !== count) throw new Error(`${stage}: expected ${count} active hints, found ${actual}`);
}

export async function run() {
    await Scripting.sleep(4000);
    const extension = Main.extensionManager.lookup('ubuntu-shell@babasaheb-bhalekar.github.io');
    if (!extension?.stateObj) throw new Error('Ubuntu Shell did not enable');
    new Gio.Settings({schema_id: 'org.gnome.mutter'}).set_boolean('workspaces-only-on-primary', false);
    extension.stateObj.getSettings().set_boolean('active-hint', true);
    await Scripting.sleep(200);
    assertHints(0, 'empty workspace');

    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'gnome-shell-test-display', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    launcher.unsetenv('DISPLAY');
    launcher.spawnv(['gnome-calculator']);
    await Scripting.sleep(2500);
    const window = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)
        .find(win => win.get_window_type() === Meta.WindowType.NORMAL);
    if (!window) throw new Error('Calculator window did not appear');
    window.activate(global.get_current_time());
    await Scripting.sleep(900);
    assertHints(1, 'focused window');

    window.minimize();
    await Scripting.sleep(900);
    assertHints(0, 'minimized window');

    window.unminimize();
    window.activate(global.get_current_time());
    await Scripting.sleep(900);
    assertHints(1, 'restored window');

    if (typeof window.set_type !== 'function')
        throw new Error('GNOME window type transition is unavailable for the desktop hint test');
    window.set_type(Meta.WindowType.DESKTOP);
    await Scripting.sleep(900);
    assertHints(0, 'window converted to desktop surface');
    window.set_type(Meta.WindowType.NORMAL);
    window.activate(global.get_current_time());
    await Scripting.sleep(900);
    assertHints(1, 'window converted back to normal');

    if (global.display.get_n_monitors() > 1) {
        const emptyMonitor = window.get_monitor();
        const destination = emptyMonitor === 0 ? 1 : 0;
        window.move_to_monitor(destination);
        window.activate(global.get_current_time());
        await Scripting.sleep(900);
        assertHints(1, 'window on another monitor');
        const hint = visibleHints()[0];
        const empty = global.display.get_monitor_geometry(emptyMonitor);
        const overlapsEmpty = hint.x < empty.x + empty.width && hint.x + hint.width > empty.x &&
            hint.y < empty.y + empty.height && hint.y + hint.height > empty.y;
        if (overlapsEmpty) throw new Error('Active hint leaks onto the empty monitor');
    }

    const workspace = global.workspace_manager.append_new_workspace(false, global.get_current_time());
    workspace.activate(global.get_current_time());
    await Scripting.sleep(900);
    assertHints(0, 'empty second workspace');
    window.delete(global.get_current_time());
}
