import ora from 'ora';
import fs from 'fs-extra';
import get from 'get-value';
import defaults from 'object.defaults';

export async function readSettingsFrom(_file) {
  const spinner = ora(`Reading settings from ${_file}...`).start();

  let settings = {};

  try {
    const data = await fs.readJSON(_file);

    settings = get(data, 'sounds', {});

    settings = defaults({}, settings, {
      sourceDirectory: './assets/',
      scriptDirectory: './assets/converted/',
      targetDirectory: './assets/converted/',
      watch: false,
      watchDelay: 500,
      prefixes: [],
      formats: ['ogg', 'mp3'],
      onlyGenerateCode: false,
      directories: []
    });

    // sort prefixes
    settings.prefixes.sort((a, b) => {
      const x = a,
        y = b;

      return x < y ? 1 : (x > y ? -1 : 0);
    });

  } catch (error) {
    console.log(error);
    spinner.fail(`Could not load settings from ${_file}... (does it exist?)`);

    return settings;
  }

  const numberOfDirectories = settings.directories.length;

  if (numberOfDirectories) {
    spinner.succeed(`Found ${numberOfDirectories} directories to process...`);

  } else {
    spinner.fail(`Found no directories to process...`);
  }

  return settings;
}
