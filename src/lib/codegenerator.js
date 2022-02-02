import { makeVariableSafe } from './util';
import get from 'get-value';
import set from 'set-value';
import pupa from 'pupa';
import uppercamelcase from 'uppercamelcase';
import camelcase from 'camelcase';
import fs from 'fs-extra';
import path from 'path';

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
  let parts = filePath.replace(`${basePath}/`, '').split('/').map(part => makeVariableSafe(part));

  // haal laatste onderdeel er af
  let lastPart = parts.pop();
  lastPart = lastPart.toUpperCase();

  // camelcase andere onderdelen
  parts = parts.map(part => camelcase(part));

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
    }

    set(parsedData, convertPathToVariableName(path.join(file.path,file.name), basePath), assetInfo);
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

    return x < y ? -1 : (x > y ? 1 : 0);
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

    let itemsContent = JSON.stringify(items, undefined, 2);
    itemsContent = itemsContent.replace(/"([^"()]+)":/g, "$1:");

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

  return `${path.join(scriptDirectory, assetPath)}/assets/sounds-${assetName}.ts`;
}

export async function generateCode(assetPath, files, settings, itemOptions) {
  const scriptDirectory = get(itemOptions, 'scriptDirectory', settings.scriptDirectory);

  // parse data to object
  const parsedAssetData = parseAssetData(files, assetPath),
    loaderInfo = {
      fileName: assetPath,
      numberOfSounds: files.length
    }

  const contents = generateContents(parsedAssetData, loaderInfo),
    scriptpath = getScriptPath(assetPath, scriptDirectory);

  await fs.outputFile(scriptpath, contents);
}
