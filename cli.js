#!/usr/bin/env node

import { Command } from 'commander/esm.mjs';
import run from './index.js';

new Command()
  .version('1.0.1')
  .option('-p, --proxy <proxy>', 'set proxy. Format: <protocol>://[username:password@]<host>:<port>')
  .option('-t, --timeout <timeout>', 'set timeout of running (unit: minute). Default: 0.5')
  .option('-l, --location <location>', `set location in which musics will be saved. Default: ${process.env.HOME + '/musicforprogramming'}`)
  .option('-e, --edit [editor name]', 'edit configuration in editor. Default: default editor in env')
  .action((options) => {
    run(options);
  })
  .parse();