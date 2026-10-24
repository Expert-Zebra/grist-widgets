#!/usr/bin/env node

// Creates a global manifest with all published widgets. Call as:
//   node ./buildtools/publish.js manifest.json
// or:
//   node ./buildtools/publish.js manifest.json http://localhost:8585

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const manifestFile = process.argv[2];
const replacementUrl = process.argv[3];
const inProduction = process.env.GRIST_ENV === 'production' || process.env.STATICHOST_BUILD_ID !== undefined;
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const excludeFiles = ['package.json', 'package-lock.json', 'node_modules'];
const folders = fs.readdirSync(rootDir);
const widgets = [];
const widgetIds = new Set();

if (!manifestFile) {
  throw new Error('please call with the file to build');
}

fs.mkdirSync(publicDir, {recursive: true});

if (!fs.existsSync(publicDir)) throw new Error('Couldn\'t create public directory.');

for (const folder of folders) {
  const dir = path.join(rootDir, folder);
  if (!fs.statSync(dir).isDirectory() || !isWidgetDir(dir)) { continue; }

  const packageFile = path.join(dir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
  let configs = packageJson.grist; 
  if (!configs) {
    console.warn(`Package in ${folder} is missing grist configuration section.`);
    continue;
  }

  // Config can be either an object or a list of objects. List of objects defines
  // multiple widget in a single widget package.
  configs = Array.isArray(configs) ? configs : [configs];
  for (const config of configs) {
    if (!config || !config.widgetId || !config.name || !config.url) {
      console.debug(`${folder} config:`, config);
      throw new Error(`Package in ${folder} is misconfigured.`);
    }

    if (widgetIds.has(config.widgetId)) {
      throw new Error(`Duplicate widgetId ${config.widgetId} in ${folder}`);
    }
    widgetIds.add(config.widgetId);

    if (config.published) {
      console.log('Publishing ' + config.widgetId);
      config.lastUpdatedAt = execSync(`git log -1 --format=%cI package.json`, {cwd: dir, encoding: 'utf8'})
        .trimEnd();
      // If we have custom server url as a first argument for local testing,
      // replace widget url.
      if (replacementUrl) {
        if (config.url) {
          config.url = replaceUrl(replacementUrl, config.url);
        }
        if (config.archive?.entrypoints) {
          config.archive.entrypoints = config.archive.entrypoints.map(
            e => replaceUrl(replacementUrl, e)
          );
        }
      }

      if (fs.existsSync(publicDir)) {
        fs.mkdirSync(path.join(publicDir, folder), {recursive: true});

        const files = fs.readdirSync(dir);

        files.forEach((file) => {
          if (!excludeFiles.includes(file)) {
            const srcPath = path.join(dir, file);
            const destPath = path.join(publicDir, folder, file);

            if (fs.statSync(srcPath).isDirectory()) {
              fs.cpSync(srcPath, destPath, {recursive: true});
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        })
      }

      widgets.push(config);
    }
  }
}

fs.writeFileSync(manifestFile, JSON.stringify(widgets, null, 2));

if (fs.existsSync(publicDir)) {
  fs.cpSync(path.join(rootDir, manifestFile), path.join(publicDir, 'manifest.json'));
  fs.cpSync(path.join(rootDir, 'common'), path.join(publicDir, 'common'), {recursive: true});
}

function isWidgetDir(dir) {
  const indexHtmlFile = path.join(dir, 'index.html');
  const packageFile = path.join(dir, 'package.json');
  return fs.existsSync(indexHtmlFile) && fs.existsSync(packageFile);
}

function replaceUrl(replacementUrl, configUrl) {
  return configUrl.replace(
    'http://localhost:8585',
    replacementUrl
  );
}
