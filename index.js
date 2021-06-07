import axios from 'axios';
import _ from 'lodash';
import { appendFile, writeFile } from 'fs/promises';
import mkdirp from 'mkdirp';
import path from 'path';
import Ora from 'ora';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import defaultConfig from './defaultConfig.js';
import ConfigStore from 'configstore';
import { pad, parseProxy } from './util.js';
import launch from 'launch-editor';

// Global variables
let stopSignal = false; // signal for stop downloading
let logInfoPath = '';
let musicTitleExceptions = [];
let rootPath = '';
const axiosIns = axios.create();

// create log file
await (async function() {
  try {
    rootPath = path.join(process.env.HOME, '.downmp');
    const logDirPath = path.join(rootPath, 'logs');
    await mkdirp(logDirPath);

    const date = new Date();
    logInfoPath = path.join(logDirPath, `info.${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.log`);
    await writeFile(logInfoPath, '=============== Download Musics For Programming =================\n\n');
  } catch (error) {
    console.error('create log file failed: ', error);
    process.exit(1);
  }
})();

// create location directory
async function createLocationDir(location) {
  try {
    await mkdirp(location);
    console.log(`Musics will be saved in ${location}`);
    appendFile(logInfoPath, `\n\nCreated directory '${location}' for musics\n\n`);
  } catch (error) {
    console.error('create', location, 'failed:', error);
    process.exit(1);
  }
}

// Fetch the music list
async function fetchMusicList() {
  const ora = Ora().start('Fetch the music list');
  try {
    const pageUrl = 'https://musicforprogramming.net/';
    ora.text = 'Fetch page';
    const rsp = await axiosIns.get(pageUrl);
    const dom = new JSDOM(rsp.data);
    const musicList = Array.from(dom.window.document.querySelector('#episodes').querySelectorAll('a'), (achor) => achor.textContent);
    ora.succeed();
    appendFile(logInfoPath, `Fetched the music list from ${pageUrl}\n`);
    appendFile(logInfoPath, `Music List (${musicList.length}):\n${musicList.join('\n')}`);
    appendFile(logInfoPath, '\n\n');
    return musicList;
  } catch (error) {
    ora.fail('Fetch the music list:' + error);
    process.exit(1);
  }
}

// download music files
async function downloadMusic(musicList, location) {
  const concurencyNum = 3;
  const queue = Array(concurencyNum);
  
  for (let i = 0; i < queue.length; i++) {
    queue[i] = download(musicList.pop());
  }

  try {
    await Promise.all(queue);
    console.log('All musics downloaded');
    appendFile(logInfoPath, 'All music files downloaded\n');
    process.exit(0);
  } catch (error) {
    console.error('Parts of musics downloaded:', error);
    process.exit(1);
  }

  async function download(title) {
    const host = 'http://datashat.net/';
    const filePath = 'music_for_programming_' + title.replace(/^(\d+):(.+)$/, (match, p1, p2) => {
      p2 = p2.trim();
      // console.log('>>>', p2);
      return `${Number(p1)}-${musicTitleExceptions[p2] ? musicTitleExceptions[p2] : _.snakeCase(p2.replace('+', 'and'))}`;
    }) + '.mp3';
    const url = host + filePath;

    const ora = Ora().start();
    try {
      ora.text = `downloading '${filePath}'`;
      const rsp = await axiosIns.get(url, {
        responseType: 'stream'
      });
      ora.text = `writing '${filePath}' to drive`;
      await rsp.data.pipe(fs.createWriteStream(path.join(location, filePath)));
      ora.succeed(`'${filePath}' downloaded`);
      appendFile(logInfoPath, `'${filePath}' downloaded\n`);
    } catch (error) {
      ora.fail(`${filePath} failed: ${error}`);
      musicList.unshift(title);
    }

    if (stopSignal) {
      musicList.unshift(title);
      return Promise.reject('stopSignal');
    }

    if (!musicList.length) {
      return Promise.resolve();
    }

    return download(musicList.pop());
  }
}

function editFile(configPath, editor) {
  launch(configPath, typeof editor === 'string' ? editor : undefined, (fileName, error) => {
    console.error('failed to open file', fileName, ':', error);
  });
}

// Run
async function run({ proxy: instantProxy, timeout: instantTimeout, edit, location: instantLocation }) {
  try {
    // read from configuration
    const configPath = path.join(rootPath, 'config.json');
    let configStore = new ConfigStore('', fs.existsSync(configPath) ? null : defaultConfig, { configPath });
    if (edit) {
      editFile(configPath, edit);
      return;
    }

    const { timeout: defaultTimeout, musicTitleExceptions: defaultMusicTitleExceptions, proxy: defaultProxy, location: defaultLocation} = configStore.all;
    const proxy = instantProxy || defaultProxy;
    if (proxy && proxy.protocol && proxy.host) {
      axiosIns.defaults.proxy = parseProxy(proxy);
    }
    const timeout = instantTimeout || defaultTimeout;
    musicTitleExceptions = defaultMusicTitleExceptions;
    const location = path.resolve(instantLocation || defaultLocation || path.join(process.env.HOME, 'musicforprogramming'));

    // set timeout for process
    let musicList = [];
    setTimeout(async () => {
      stopSignal = true;
      console.log(`\n\nTimeout(${timeout} minute(s)), ${musicList.length} musics haven't downloaded. Check the ${logInfoPath}`);
      await appendFile(logInfoPath, `\n\nTimeout(${timeout} minute(s)), ${musicList.length} musics haven't downloaded:\n`);
      await appendFile(logInfoPath, `${musicList.join('\n')}`);
    }, 1000 * 60 * timeout);
    musicList = await fetchMusicList();
    await createLocationDir(location);
    await downloadMusic(musicList, location);
  } catch (error) {
    console.error('run failed:', error);
    process.exit(1);
  }
}

export default run;
