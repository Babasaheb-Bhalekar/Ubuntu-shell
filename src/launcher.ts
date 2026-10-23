import * as search from './search.js';
import * as log from './log.js';
import { calculate } from './calculator.js';
import type { Ext } from './extension.js';
import type { ShellWindow } from './window.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

const apps = Shell.AppSystem.get_default();
const clipboard = St.Clipboard.get_default();
const settingsPanels = [
    'applications', 'background', 'bluetooth', 'color', 'display', 'keyboard',
    'mouse', 'multitasking', 'network', 'wifi', 'notifications', 'online-accounts',
    'power', 'printers', 'privacy', 'search', 'sharing', 'sound', 'system',
    'universal-access', 'wacom', 'wellbeing', 'wwan',
];

interface Result {
    name: string;
    description: string;
    icon: any;
    activate: () => void;
    window?: ShellWindow;
    complete?: string;
}

function launch(argv: string[]) {
    try {
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
    } catch (error) {
        log.error(`could not launch ${argv[0]}: ${error}`);
    }
}

export class Launcher extends search.Search {
    ext: Ext;
    results: Result[] = [];
    opened = false;

    constructor(ext: Ext) {
        super();
        this.ext = ext;
        this.dialog.dialogLayout._dialog.y_align = Clutter.ActorAlign.START;
        this.dialog.dialogLayout._dialog.x_align = Clutter.ActorAlign.START;
        this.cancel = () => {
            ext.overlay.visible = false;
            this.opened = false;
        };
        this.search = (query) => this.update(query);
        this.select = (index) => {
            ext.overlay.visible = false;
            const win = this.results[index]?.window;
            if (win && win.workspace_id() === ext.active_workspace()) {
                const { x, y, width, height } = win.rect();
                Object.assign(ext.overlay, { x, y, width, height, visible: true });
            }
        };
        this.activate_id = (index) => {
            const result = this.results[index];
            if (!result) return;
            this.close();
            result.activate();
        };
        this.complete = () => {
            const result = this.results[this.active_id];
            if (result?.complete) this.set_text(result.complete);
        };
        this.quit = (index) => this.results[index]?.window?.meta.delete(global.get_current_time());
        this.copy = (index) => {
            const result = this.results[index];
            if (result) clipboard.set_text(St.ClipboardType.CLIPBOARD, result.description || result.name);
        };
    }

    private update(query: string) {
        if (!this.opened) return;
        this.results = this.find(query).slice(0, this.list_max);
        this.clear();
        for (const result of this.results) {
            this.append_search_option(new search.SearchOption(
                result.name, result.description, null, result.icon,
                this.icon_size(), null, null,
            ));
        }
        this.cleanup();
    }

    private find(query: string): Result[] {
        if (query.startsWith('?')) {
            return [
                ['Super + Y', 'Toggle tiling'],
                ['Super + /', 'Open launcher'],
                ['Super + arrows / H J K L', 'Focus windows'],
                ['Super + Return', 'Window adjustment mode'],
                ['Super + G / O / S', 'Floating / orientation / stacking'],
                ['t:command', 'Run in default terminal'],
                [':command / =expression', 'Run shell command / calculate'],
            ].map(([name, description]) => ({ name, description, icon: null, activate: () => {} }));
        }
        if (query.startsWith('t:') || query.startsWith(':')) {
            const terminal = query.startsWith('t:');
            const command = query.slice(terminal ? 2 : 1).trim();
            return [{
                name: terminal ? 'Run in terminal' : 'Run command',
                description: command || 'Type a command',
                icon: { Name: terminal ? 'utilities-terminal-symbolic' : 'system-run-symbolic' },
                activate: () => {
                    if (command) launch(terminal
                        ? ['xdg-terminal-exec', '--', 'sh', '-c', command]
                        : ['sh', '-c', command]);
                },
            }];
        }
        if (query.startsWith('=')) {
            const answer = calculate(query.slice(1));
            return answer === null ? [] : [{
                name: String(answer), description: 'Copy result', icon: { Name: 'accessories-calculator-symbolic' },
                activate: () => clipboard.set_text(St.ClipboardType.CLIPBOARD, String(answer)),
            }];
        }

        const needle = query.toLocaleLowerCase();
        const windows: Result[] = this.ext.tab_list(Meta.TabList.NORMAL_ALL, null)
            .filter((win) => win.meta.get_title()?.toLocaleLowerCase().includes(needle))
            .map((win) => ({
                name: win.meta.get_title() || 'Window',
                description: win.window_app?.get_name?.() || 'Open window',
                icon: { GIcon: win.window_app?.get_app_info?.()?.get_icon?.() },
                window: win,
                activate: () => win.activate(),
            }));
        const installed: Result[] = apps.get_installed()
            .filter((info: any) => info.should_show())
            .filter((info: any) => {
                return `${info.get_name()} ${info.get_description() || ''} ${info.get_id()}`
                    .toLocaleLowerCase().includes(needle);
            })
            .sort((a: any, b: any) => a.get_name().localeCompare(b.get_name()))
            .map((info: any) => ({
                name: info.get_name(),
                description: info.get_description() || 'Application',
                icon: { GIcon: info.get_icon() },
                activate: () => {
                    const app = apps.lookup_app(info.get_id());
                    if (app) app.activate();
                    else info.launch([], null);
                },
            }));
        const panels: Result[] = needle && GLib.find_program_in_path('gnome-control-center')
            ? settingsPanels.filter(panel => panel.replace('-', ' ').includes(needle)).map(panel => ({
                name: `${panel.replace(/(^|-)(\w)/g, (_match, _sep, letter) => ` ${letter.toUpperCase()}`).trim()} Settings`,
                description: 'GNOME Settings panel',
                icon: { Name: 'preferences-system-symbolic' },
                activate: () => launch(['gnome-control-center', panel]),
            }))
            : [];
        return [...windows, ...panels, ...installed];
    }

    close() {
        this.opened = false;
        this.ext.overlay.visible = false;
        super.close();
    }

    open(ext: Ext) {
        ext.tiler.exit(ext);
        if (this.opened || (!ext.settings.fullscreen_launcher() && ext.focus_window()?.meta.is_fullscreen())) return;
        this.opened = true;
        const monitor = ext.monitor_work_area(ext.active_monitor());
        if (!super._open()) {
            this.close();
            this.cancel();
            return;
        }
        this.update('');
        this.dialog.dialogLayout.x = monitor.x + (monitor.width - this.dialog.dialogLayout.width) / 2;
        this.dialog.dialogLayout.y = monitor.y + Math.max(48, monitor.height / 4 - this.dialog.dialogLayout.height / 2);
    }
}
