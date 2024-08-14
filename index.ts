/* eslint-disable node/prefer-global/process */
import { appendFile, writeFile } from 'node:fs/promises'
import { createWriteStream, existsSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { cwd } from 'node:process'
import axios from 'axios'
import { mkdirp } from 'mkdirp'
import Ora from 'ora'
import { JSDOM } from 'jsdom'
import ConfigStore from 'configstore'
import { createLogger, enableLogger } from '@gloxy/logger'
import timestamp from 'iso-timestamp'
import defaultConfig from './defaultConfig.js'

// Global variables
let logInfoPath = ''
let musicTitleExceptions: any[] = []
let rootPath = ''
const axiosIns = axios.create()

const logger = createLogger('downmp')
enableLogger('downmp:*')

// create log file
await (async function () {
  try {
    rootPath = path.join(homedir(), '.downmp')
    const logDirPath = path.join(rootPath, 'logs')
    await mkdirp(logDirPath)

    logInfoPath = path.join(logDirPath, `info.${timestamp()}.log`)
    await writeFile(logInfoPath, '=============== Download Music For Programming =================\n\n')
  }
  catch (error) {
    logger.error('create log file failed: %o', error)
    process.exit(1)
  }
})()

// create location directory
async function createLocationDir(location: string) {
  try {
    await mkdirp(location)
    logger.info(`Music will be saved in ${location}`)
    appendFile(logInfoPath, `\n\nCreated directory '${location}' for music\n\n`)
  }
  catch (error) {
    logger.error('create', location, 'failed:', error)
    process.exit(1)
  }
}

// Fetch the music list
async function fetchMusicList() {
  const ora = Ora().start('Fetch the music list')
  try {
    const pageUrl = 'https://musicforprogramming.net/latest'
    ora.text = 'Searching for the music list...'
    const rsp = await axiosIns.get(pageUrl)
    const dom = new JSDOM(rsp.data)

    const musicList = Array.from(dom.window.document.querySelector('#sapper')?.querySelectorAll('a') ?? [], achor => achor.textContent).filter(v => v && /^\d{2}:.+/.test(v)) as string[]

    ora.succeed(`Found ${musicList.length} music`)
    appendFile(logInfoPath, `Fetched the music list from ${pageUrl}\n`)
    appendFile(logInfoPath, `Music List (${musicList.length}):\n${musicList.join('\n')}`)
    appendFile(logInfoPath, '\n\n')
    return musicList
  }
  catch (error) {
    ora.fail(`Failed to fetch the music list:${error}`)
    process.exit(1)
  }
}

// download music files
async function downloadMusic(musicList: string[], location: string, concurencyNum: number) {
  const queue = Array(concurencyNum)

  const number = musicList.length
  if (musicList.length) {
    for (let i = 0; i < queue.length; i++) {
      queue[i] = download(musicList.pop()!)
    }
  }

  try {
    await Promise.all(queue)
    logger.info('All %d music were downloaded', number)
    appendFile(logInfoPath, 'All music files were downloaded\n')
    process.exit(0)
  }
  catch (error) {
    logger.error('Parts of music were downloaded:', error)
    process.exit(1)
  }

  async function download(title: string) {
    const host = 'http://datashat.net/'
    const filePath = `music_for_programming_${title.replace(/^(\d+):(.+)$/, (match, p1, p2) => {
      p2 = p2.trim()
      // console.log('>>>', p2);
      return `${Number(p1)}-${musicTitleExceptions[p2] ? musicTitleExceptions[p2] : p2.replace('+', 'and').replace(/\s/g, '_').toLowerCase()}`
    })}.mp3`
    const url = host + filePath

    const ora = Ora().start()
    try {
      ora.text = `Downloading ${filePath}`
      const rsp = await axiosIns.get(url, {
        responseType: 'stream',
      })
      ora.text = `Writing ${filePath} to drive`
      await rsp.data.pipe(createWriteStream(path.join(location, filePath)))
      ora.succeed(`Downloaded ${filePath}`)
      appendFile(logInfoPath, `'${filePath}' downloaded\n`)
    }
    catch (error) {
      ora.fail(`${filePath} failed: ${error}. Retry automatically later`)
      musicList.unshift(title)
    }

    if (!musicList.length) {
      return Promise.resolve()
    }

    return download(musicList.pop()!)
  }
}

// Run
async function run({ location: instantLocation, concurencyNum: instantConcurencyNum }: { timeout: number, location: string, concurencyNum: number }) {
  try {
    // read from configuration
    const configPath = path.join(rootPath, 'config.json')
    const configStore = new ConfigStore('', existsSync(configPath) ? null : defaultConfig, { configPath })

    const { musicTitleExceptions: defaultMusicTitleExceptions, location: defaultLocation, concurrency: defaultConcurrencyNum } = configStore.all
    musicTitleExceptions = defaultMusicTitleExceptions
    const location = path.resolve(instantLocation || defaultLocation || path.join(cwd(), 'musicforprogramming'))
    const concurencyNum = instantConcurencyNum || defaultConcurrencyNum

    let musicList: string[] = []
    musicList = await fetchMusicList()
    await createLocationDir(location)
    await downloadMusic(musicList, location, concurencyNum)
  }
  catch (error) {
    logger.error('run failed:', error)
    process.exit(1)
  }
}

export default run
