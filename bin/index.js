#!/usr/bin/env node
'use strict';

import meow from 'meow';
import { pack } from '../dist';

const cli = meow(`
	Usage
	  $ sounds-packer <asset settings file>

	Examples
	  $ sounds-packer assets.json
`);

pack(cli.input[0]);
