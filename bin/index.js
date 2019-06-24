#!/usr/bin/env node
'use strict';

const meow = require('meow');
const { pack } = require('../dist');

const cli = meow(`
	Usage
	  $ sounds-packer <asset settings file>

	Examples
	  $ sounds-packer assets.json
`);

pack(cli.input[0]);
