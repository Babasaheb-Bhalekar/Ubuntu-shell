import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import {ExtensionState} from 'resource:///org/gnome/shell/misc/extensionUtils.js';

export var METRICS = {};

export async function run() {
    await Scripting.sleep(4000);
    const extension = Main.extensionManager.lookup('ubuntu-shell@babasaheb-bhalekar.github.io');
    if (!extension || extension.state !== ExtensionState.ACTIVE)
        throw new Error(`Ubuntu Shell failed to enable: ${extension?.error || extension?.state}; found ${[...Main.extensionManager._extensions.keys()]}; enabled ${global.settings.get_strv('enabled-extensions')}`);
    const button = Main.panel.statusArea['ubuntu-shell'];
    if (!button) throw new Error('Ubuntu Shell panel indicator is missing');
    const settings = extension.stateObj.getSettings();
    if (!settings.get_strv('toggle-tiling').includes('<Super>y'))
        throw new Error('Super+Y tiling shortcut changed');
    button.menu.open();
    await Scripting.sleep(100);
    const tiling = button.menu._getMenuItems()[0];
    const initiallyTiled = settings.get_boolean('tile-by-default');
    tiling.toggle();
    await Scripting.sleep(200);
    if (settings.get_boolean('tile-by-default') === initiallyTiled)
        throw new Error('Panel tiling toggle did not update settings');
    tiling.toggle();
    await new Promise((resolve, reject) => Gio.DBus.session.call(
        'io.github.BabasahebBhalekar.UbuntuShell', '/io/github/BabasahebBhalekar/UbuntuShell', 'io.github.BabasahebBhalekar.UbuntuShell',
        'Launcher', null, null, Gio.DBusCallFlags.NONE, -1, null,
        (connection, result) => {
            try {
                connection.call_finish(result);
                resolve();
            } catch (error) {
                reject(error);
            }
        },
    ));
    await Scripting.sleep(300);
    const modal = Main.layoutManager.modalDialogGroup.get_children().find(child => child.visible);
    if (!modal)
        throw new Error('Ubuntu Shell launcher did not open from the indicator');
    const entry = modal.contentLayout.get_children()[0];
    const labels = actor => [
        ...(actor instanceof St.Label ? [actor.text] : []),
        ...(actor.get_children?.() || []).flatMap(labels),
    ];
    entry.set_text('=1 + 2 * 3');
    await Scripting.sleep(200);
    if (!labels(modal).includes('7')) throw new Error('Launcher calculator did not return 7');
    entry.set_text('?');
    await Scripting.sleep(200);
    if (!labels(modal).includes('Super + Y')) throw new Error('Shortcut guide is missing');
    entry.set_text('bluetooth');
    await Scripting.sleep(200);
    if (!labels(modal).includes('Bluetooth Settings')) throw new Error('Settings panel search failed');
    entry.set_text('t:echo hello');
    await Scripting.sleep(200);
    if (!labels(modal).includes('Run in terminal')) throw new Error('Terminal command is missing');
    const marker = `${GLib.get_tmp_dir()}/ubuntu-shell-command-${GLib.get_monotonic_time()}`;
    entry.set_text(`:printf ready > ${marker}`);
    await Scripting.sleep(200);
    entry.get_clutter_text().emit('activate');
    await Scripting.sleep(200);
    const file = Gio.File.new_for_path(marker);
    if (!file.query_exists(null)) throw new Error('Launcher shell command did not run');
    file.delete(null);
    button.menu.close();
    Main.extensionManager.disableExtension('ubuntu-shell@babasaheb-bhalekar.github.io');
    await Scripting.sleep(500);
    if (Main.panel.statusArea['ubuntu-shell']) throw new Error('Panel indicator remained after disable');
    Main.extensionManager.enableExtension('ubuntu-shell@babasaheb-bhalekar.github.io');
    await Scripting.sleep(500);
    if (!Main.panel.statusArea['ubuntu-shell']) throw new Error('Panel indicator did not return after enable');
}
