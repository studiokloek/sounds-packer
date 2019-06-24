'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ora = _interopDefault(require('ora'));
var fs = _interopDefault(require('fs-extra'));
var get = _interopDefault(require('get-value'));
var defaults = _interopDefault(require('object.defaults'));
var path = require('path');
var path__default = _interopDefault(path);
var logSymbols = _interopDefault(require('log-symbols'));
var chalk = _interopDefault(require('chalk'));
var set = _interopDefault(require('set-value'));
var pupa = _interopDefault(require('pupa'));
var uppercamelcase = _interopDefault(require('uppercamelcase'));
var camelcase = _interopDefault(require('camelcase'));
var getAudioDuration = require('get-audio-duration');
var globby = _interopDefault(require('globby'));
var hasha = _interopDefault(require('hasha'));
var sane = require('sane');
var throttleDebounce = require('throttle-debounce');

async function readSettingsFrom(_file) {
  const spinner = ora(`Reading settings from ${_file}...`).start();

  let settings = {};

  try {
    const data = await fs.readJSON(_file);

    settings = get(data, 'sounds', {});

    settings = defaults(settings, {
      sourceDirectory: './assets/',
      scriptDirectory: './assets/converted/',
      targetDirectory: './assets/converted/',
      watch: false,
      watchDelay: 500,
      prefixes: [],
      directories: []
    });

    // sort prefixes
    settings.prefixes.sort((a, b) => {
      const x = a,
        y = b;

      return x < y ? 1 : x > y ? -1 : 0;
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

function makeVariableSafe(value) {
  return value.replace(/(\W)/g, '_').replace(/_{2,}/g, '.').replace(/^_/, '').replace(/_$/, '');
}

const loaderInfoTemplate = `export default {
  assetName : '{assetName}',
  assets : {assets},
  numberOfSounds : {numberOfSounds},
  type: 'sounds'
};`;

const assetTemplate = `export const {assetName} = {assetData};`;

function convertPathToVariableName(filePath, basePath) {
  // forceer string
  filePath = `${filePath}`;

  // basepath er af halen, path splitsen en opschonen
  let parts = filePath.replace(`${basePath}/`, '').split('/').map(makeVariableSafe);

  // haal laatste onderdeel er af
  let lastPart = parts.pop();
  lastPart = lastPart.toUpperCase();

  // camelcase andere onderdelen
  parts = parts.map(camelcase);

  // haal titel elementen uit base path
  let titleParts = basePath.split('/');
  titleParts = titleParts.slice(titleParts.length - (titleParts.length === 1 ? 1 : 2));


  titleParts.push('sounds');
  titleParts = uppercamelcase(titleParts.join('-'));

  if (parts.length > 0) {
    filePath = parts.join('.');
    filePath = filePath.replace(/(\W^\.)/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '').replace(/\.$/, '');
    return [titleParts, filePath, lastPart].join('.');
  }
  else {
    return [titleParts, lastPart].join('.');
  }
}

function parseAssetData(files, assetPath) {
  // bepaal base path
  const basePath = assetPath,
    parsedData = {};

  for (const file of files || []) {

    const assetInfo = {
      id: file.hash,
      duration: file.duration,
      name: file.name,
    };

    set(parsedData, convertPathToVariableName(path__default.join(file.path,file.name), basePath), assetInfo);
  }

  return parsedData;
}

function getSortedItems(_itemsData) {
  const itemsSortable = [];

  for (const assetName of Object.keys(_itemsData)) {
    if (_itemsData.hasOwnProperty(assetName)) {
      itemsSortable.push([assetName, _itemsData[assetName]]);
    }
  }

  itemsSortable.sort((a, b) => {
    const x = a[0],
      y = b[0];

    return x < y ? -1 : x > y ? 1 : 0;
  });

  const items = {};
  for (const item of itemsSortable) {
    items[item[0]] = item[1];
  }

  return items;
}

function generateContents(parsedAssetData, loaderData) {
  let contents = '';

  // assets
  const assets = [];
  for (const assetName of Object.keys(parsedAssetData)) {
    const items = getSortedItems(parsedAssetData[assetName]);

    let itemsContent = JSON.stringify(items, null, 2);
    itemsContent = itemsContent.replace(/"([^(")"]+)":/g, "$1:");

    contents = `${contents}${pupa(assetTemplate, {
      assetName: assetName,
      assetData: itemsContent
    })}\n`;

    assets.push(assetName);
  }

  // loader
  contents = `${contents}${pupa(loaderInfoTemplate, {
    assets: assets,
    assetName: loaderData.fileName,
    numberOfSounds: loaderData.numberOfSounds
  })}\n`;

  return contents;
}

function getScriptPath(assetPath, scriptDirectory) {
  const assetParts = assetPath.split('/'),
    assetName = assetParts.pop();

  if (assetParts.length < 2) {
    assetParts.push(assetName);
  }

  assetPath = assetParts.join('/');

  return `${path__default.join(scriptDirectory, assetPath)}/assets/sounds-${assetName}.ts`;
}

async function generateCode(assetPath, files, settings, itemOptions) {
  const scriptDirectory = get(itemOptions, 'scriptDirectory', settings.scriptDirectory);

  // parse data to object
  const parsedAssetData = parseAssetData(files, assetPath),
    loaderInfo = {
      fileName: assetPath,
      numberOfSounds: files.length
    };

  const contents = generateContents(parsedAssetData, loaderInfo),
    scriptpath = getScriptPath(assetPath, scriptDirectory);

  await fs.outputFile(scriptpath, contents);
}

const isPacking = {},
  shouldPackAgain = {};

async function packAll(directories, settings) {
  console.log(logSymbols.info, chalk.blue(`Start packing all items...`));

  // clean directory
  console.log(logSymbols.info, chalk.blue(`Clearing sounds directory (${settings.targetDirectory})...`));
  await fs.emptyDir(settings.targetDirectory);

  for (const directory of directories) {
    await pack(directory, settings);
  }

  console.log(logSymbols.success, chalk.green(`Done packing all items...`));
}

async function pack(directory, settings) {
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
  const sourceDirectory = path__default.join(settings.sourceDirectory, itemPath);

  // get all wav's
  const paths = await globby(`${sourceDirectory}/**/*.wav`),
    files = [];

  for (const filepath of paths) {
    // generate hash id
    let hash = await hasha.fromFile(filepath, { algorithm: 'md5' });
    hash = hash.substring(0, 10);

    // get duration
    let duration = await getAudioDuration.getAudioDurationInSeconds(filepath);
    duration = Math.round(duration * 10000) / 10000;

    // basepath er af halen
    const cleanedFilepath = filepath.replace(`${sourceDirectory}/`, '');

    const info = {
      filename: path.basename(cleanedFilepath, '.wav'),
      path: cleanedFilepath.replace(`${path.basename(cleanedFilepath)}`, ''),
      duration,
      hash,
    };

    // remove any prefix
    let cleanedFileName = info.filename;
    settings.prefixes.forEach(prefix => {
      if (cleanedFileName.startsWith(prefix)) {
        cleanedFileName = cleanedFileName.slice(prefix.length);
      }
    });
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

  const sourceDirectory = path__default.join(settings.sourceDirectory, itemPath);

  for (const file of files) {
    try {
      await fs.copy(`${path__default.join(sourceDirectory, file.path,file.filename)}.mp3`, `${path__default.join(settings.targetDirectory, file.hash)}.mp3`);
      await fs.copy(`${path__default.join(sourceDirectory, file.path, file.filename)}.ogg`, `${path__default.join(settings.targetDirectory, file.hash)}.ogg`);
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  return true;
}

async function watch(directories, settings) {
  for (const directory of directories) {
    await watchDirectory(directory, settings);
  }
}

async function watchDirectory(directory, settings) {
  return new Promise((_resolver) => {

    let itemPath, itemOptions = {};

    if (Array.isArray(directory)) {
      itemPath = directory[0];
      itemOptions = directory[1];
    } else {
      itemPath = directory;
    }

    if ((settings.watch !== true && itemOptions.watch !== true) || itemOptions.watch === false) {
      _resolver();
      return;
    }

    const delayedCallback = throttleDebounce.debounce(settings.watchDelay, () => {
      pack(directory, settings);
    });
    const watcher = sane.sane(`${path__default.join(settings.sourceDirectory, itemPath)}`, {
      glob: ['**/*.png', '**/*.jpg']
    });

    watcher.on('ready', () => {
      console.log(logSymbols.info, chalk.blue(`Started watching ${itemPath} with a delay of ${settings.watchDelay / 1000}s`));
      _resolver();
    });
    watcher.on('change', delayedCallback);
    watcher.on('add', delayedCallback);
    watcher.on('delete', delayedCallback);
  });
}

const AssetFile = 'assets.json';

async function main(_file) {
  const settings = await readSettingsFrom(_file),
    directories = settings.directories;

  delete settings.directories;

  if (!settings || !directories) {
    return;
  }

  await packAll(directories, settings);

  await watch(directories, settings);
}

function pack$1(_file) {
  main(_file || AssetFile);
}

exports.pack = pack$1;
//# sourceMappingURL=index.js.map
