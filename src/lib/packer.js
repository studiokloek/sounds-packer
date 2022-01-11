import chalk from 'chalk';
import fs from 'fs-extra';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import { globby } from 'globby';
import hasha from 'hasha';
import logSymbols from 'log-symbols';
import ora from 'ora';
import path from 'path';
import { generateCode } from './codegenerator';

const isPacking = {},
  shouldPackAgain = {};

export async function packAll(directories, settings) {
  console.log(logSymbols.info, chalk.blue(`Start packing all items...`));

  console.log(logSymbols.info, chalk.blue(`Clearing sounds directory (${settings.targetDirectory})...`));
  
  // make sure dir exists
  await fs.mkdirp(settings.targetDirectory);

  // clean directory, except gitignore
  const files = await fs.readdir(settings.targetDirectory);
  await Promise.all(files.filter((file) => file.includes('.gitignore') === false).map(file => fs.remove(path.resolve(settings.targetDirectory,file))));

  for (const directory of directories) {
    await pack(directory, settings);
  }

  console.log(logSymbols.success, chalk.green(`Done packing all items...`));
}

export async function pack(directory, settings) {
  let itemPath, itemOptions;

  if (Array.isArray(directory)) {
    itemPath = directory[0];
    itemOptions = directory[1];
  } else {
    itemPath = directory;
  }

  if (isPacking[itemPath]) {
    console.log(logSymbols.warning, chalk.yellow(`Allready packing, starting again afterwards...`));
    shouldPackAgain[itemPath] = true;
    return;
  }

  isPacking[itemPath] = true;

  const spinner = ora(`Packing ${itemPath}`).start();

  try {
    // pack folder & generate code
    const success = packFolder(itemPath, settings, itemOptions);

    if (!success) {
      spinner.fail(`Error packing ${itemPath}`);

      return;
    }
  } catch (error) {
    spinner.fail(`Error packing ${itemPath}`);
    console.error(logSymbols.warning, error.message);

    return;
  }

  isPacking[itemPath] = false;

  if (shouldPackAgain[itemPath]) {
    shouldPackAgain[itemPath] = false;
    spinner.warn(`Needs repacking, something changed while packing...`);
    await pack(directory, settings);
  } else {
    spinner.succeed(`Done packing ${itemPath}`);
  }
}

async function packFolder(itemPath, settings, itemOptions) {
  const sourceDirectory = path.posix.join(settings.sourceDirectory, itemPath);

  // get all wav's
  const paths = await globby(`${sourceDirectory}/**/*.wav`),
    files = [];

  for (const filepath of paths) {
    // generate hash id
    let hash = await hasha.fromFile(filepath, { algorithm: 'md5' });
    hash = hash.slice(0, 10);

    // get duration
    let duration = await getAudioDurationInSeconds(filepath)
    duration = Math.round(duration * 10_000) / 10_000;

    // basepath er af halen
    const cleanedFilepath = filepath.replace(`${sourceDirectory}/`, '');

    const info = {
      filename: path.basename(cleanedFilepath, '.wav'),
      path: cleanedFilepath.replace(`${path.basename(cleanedFilepath)}`, ''),
      duration,
      hash,
    }

    // remove any prefix
    let cleanedFileName = info.filename;
    for (const prefix of settings.prefixes) {
      if (cleanedFileName.startsWith(prefix)) {
        cleanedFileName = cleanedFileName.slice(prefix.length)
      }
    }

    info.name = cleanedFileName;

    files.push(info);
  }

  const copied = await copyFiles(itemPath, files, settings);

  if (!copied) {
    return false;
  }

  await generateCode(itemPath, files, settings, itemOptions);

  return true;
}

async function copyFiles(itemPath, files, settings) {

  const sourceDirectory = path.join(settings.sourceDirectory, itemPath);

  for (const file of files) {
    try {
      // loop door formats
      for (const format of settings.formats) {
        await fs.copy(`${path.join(sourceDirectory, file.path,file.filename)}.${format}`, `${path.join(settings.targetDirectory, file.hash)}.${format}`);
      }
    } catch (error) {
      console.log(error)
      return false;
    }
  }

  return true;
}

