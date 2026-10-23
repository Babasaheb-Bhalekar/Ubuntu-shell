import {Config, DEFAULT_FLOAT_RULES} from '../target/config.js';

const config = new Config();
config.sync_to_disk = () => {};
config.float = [{class: '['}];
if (config.window_shall_float('UnrelatedApp', 'Window'))
    throw new Error('Invalid regex should not match or crash');

config.skiptaskbarhidden = [{class: '['}];
const hidden = config.skiptaskbar_shall_hide({
    get_wm_class: () => 'UnrelatedApp',
    get_title: () => 'Window',
    is_skip_taskbar: () => true,
});
if (hidden) throw new Error('Invalid skip-taskbar regex should not match');

const first = DEFAULT_FLOAT_RULES[0];
config.toggle_system_exception(first.class, first.title, true);
if (first.disabled || config.float.at(-1)?.disabled !== true)
    throw new Error('System exception was mutated');

config.float = [{class: 'Duplicate'}, {class: 'Duplicate'}, {class: 'Keep'}];
config.remove_user_exception('Duplicate', undefined);
if (config.float.length !== 1 || config.float[0].class !== 'Keep')
    throw new Error('Duplicate user exceptions were not removed');
