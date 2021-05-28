#!/usr/bin/env node
'use strict';

import meow from 'meow';
import { pack } from '../dist/index.js';

const cli = meow(`
	Usage
	  $ sounds-packer <asset settings file>

	Examples
	  $ sounds-packer assets.json
`, {
	importMeta: import.meta,
});

pack(cli.input[0]);
