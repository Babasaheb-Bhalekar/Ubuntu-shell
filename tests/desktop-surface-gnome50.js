import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export var METRICS = {};

export async function run() {
    await Scripting.sleep(4000);
    const pop = Main.extensionManager.lookup('ubuntu-shell@babasaheb-bhalekar.github.io');
    if (!pop?.stateObj) throw new Error('Ubuntu Shell did not enable');
    if (!pop.stateObj.getSettings().get_boolean('tile-by-default'))
        Main.panel.statusArea['ubuntu-shell'].menu._getMenuItems()[0].toggle();

    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    launcher.setenv('WAYLAND_DISPLAY', 'gnome-shell-test-display', true);
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    launcher.unsetenv('DISPLAY');
    launcher.spawnv(['gnome-calculator']);
    await Scripting.sleep(1800);
    const app = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)
        .find(window => window.window_type === Meta.WindowType.NORMAL);
    if (!app) throw new Error('Calculator window did not appear');
    app.activate(global.get_current_time());

    const desktopProcess = launcher.spawnv(['gjs', '-c',
        "const Gtk = imports.gi.Gtk, GLib = imports.gi.GLib; Gtk.init(); let w = new Gtk.Window({title: 'Desktop Icons 1'}); w.set_default_size(500, 400); w.present(); GLib.MainLoop.new(null, false).run();"]);
    const lateDesktopProcess = launcher.spawnv(['gjs', '-c',
        "const Gtk = imports.gi.Gtk, GLib = imports.gi.GLib; Gtk.init(); let w = new Gtk.Window({title: 'Loading desktop'}); w.set_default_size(500, 400); w.present(); GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { w.set_title('Desktop Icons 2'); return GLib.SOURCE_REMOVE; }); GLib.MainLoop.new(null, false).run();"]);
    await Scripting.sleep(1800);
    const desktops = global.get_window_actors().map(actor => actor.meta_window)
        .filter(window => /^Desktop Icons [12]$/.test(window.get_title() ?? ''));
    if (desktops.length !== 2) throw new Error(`Expected two mock desktop windows, found ${desktops.length}`);
    for (const desktop of desktops) {
        desktop.set_type(Meta.WindowType.DESKTOP);
        desktop.lower();
    }
    app.activate(global.get_current_time());
    await Scripting.sleep(500);

    const children = global.window_group.get_children();
    for (const desktop of desktops) {
        if (children.indexOf(desktop.get_compositor_private()) >= children.indexOf(app.get_compositor_private()))
            throw new Error('Desktop surface is stacked above the app');
    }
    desktopProcess.force_exit();
    lateDesktopProcess.force_exit();
    app.delete(global.get_current_time());
}
