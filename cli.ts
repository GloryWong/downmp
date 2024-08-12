#!/usr/bin/env node

import { cwd } from 'node:process'
import { Command } from 'commander/esm.mjs'
import { readPackage } from 'read-pkg'
import run from './index.js'

const version = (await readPackage({ cwd: import.meta.dirname })).version

new Command()
  .version(version)
  .option('-t, --timeout <timeout>', 'set timeout of running (unit: minute). Default: 0.5')
  .option('-l, --location <location>', `set location in which musics will be saved. Default: ${`${cwd()}/musicforprogramming`}`)
  .showHelpAfterError()
  .action((options) => {
    run(options)
  })
  .parse()
