import axios from 'axios';
import _ from 'lodash';
import { appendFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import Ora from 'ora';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import config from './config.js';

// signal for stop downloading
let stopSignal = false;

function pad(num, length = 2) {
  const numStr = num.toString();
  return numStr.length < length ? '0' + numStr : numStr;
}

// read from configuration
const { timeout, musicTitleExceptions, proxy } = config;
const axiosIns = proxy && proxy.protocal && proxy.host && proxy.port ? axios.create({
    proxy
  }) : axios.create();


// create log file
let logInfoPath;
await (async function() {
  try {
    const logDirPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'log');
    const date = new Date();
    logInfoPath = path.join(logDirPath, `info.${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.log`);
    await writeFile(logInfoPath, '=============== Download Musics For Programming =================\n\n');
  } catch (error) {
    console.error('create log file failed: ', error);
    process.exit(1);
  }
})();

// create location directory
async function createLocationDir() {
  const dir = 'musicForProgramming';
  const location = path.join(process.env.HOME, dir);
  try {
    await mkdir(location, {
      recursive: true
    });
    console.log(`Musics will be saved in ${location}`);
    appendFile(logInfoPath, `Created directory '${location}' for musics\n\n`);
    return location;
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
  } catch (error) {
    console.error('Parts of musics downloaded:', error);
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

// Run
// set timeout for process
let musicList = [];
const tm = 1000 * 60 * timeout;
setTimeout(async () => {
  stopSignal = true;
  console.log(`\n\nTimeout(${timeout} minute(s)), ${musicList.length} musics haven't downloaded. Check the ${logInfoPath}`);
  await appendFile(logInfoPath, `\n\nTimeout(${timeout} minute(s)), ${musicList.length} musics haven't downloaded:\n`);
  await appendFile(logInfoPath, `${musicList.join('\n')}`);
}, tm);
musicList = await fetchMusicList();
const location = await createLocationDir();
await downloadMusic(musicList, location);

process.exit(0);
