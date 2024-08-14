#!/usr/bin/env node

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander/esm.mjs'
import { readPackage } from 'read-pkg'
import run from './index.js'

const version = (await readPackage({ cwd: dirname(fileURLToPath(import.meta.url)) })).version

new Command()
  .version(version)
  .argument('[directory]', 'Location where music files will be saved. Default: ./musicforprogramming')
  .option('-c, --concurency', 'Concurrency number of downloading. Default: 3')
  .showHelpAfterError()
  .action((directory) => {
    run(directory)
  })
  .parse()
