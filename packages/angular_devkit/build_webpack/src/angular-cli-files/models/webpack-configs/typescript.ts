// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

import * as path from 'path';
import { stripIndent } from 'common-tags';
import {
  AotPlugin,
  AotPluginOptions,
  AngularCompilerPlugin,
  AngularCompilerPluginOptions,
  PLATFORM
} from '@ngtools/webpack';
import { WebpackConfigOptions } from '../build-options';

const SilentError = require('silent-error');


const g: any = global;
const webpackLoader: string = g['angularCliIsLocal']
  ? g.angularCliPackages['@ngtools/webpack'].main
  : '@ngtools/webpack';


function _createAotPlugin(wco: WebpackConfigOptions, options: any, useMain = true) {
  const { appConfig, projectRoot, buildOptions } = wco;
  options.compilerOptions = options.compilerOptions || {};

  if (wco.buildOptions.preserveSymlinks) {
    options.compilerOptions.preserveSymlinks = true;
  }

  // Forcing commonjs seems to drastically improve rebuild speeds on webpack.
  // Dev builds on watch mode will set this option to true.
  if (wco.buildOptions.forceTsCommonjs) {
    options.compilerOptions.module = 'commonjs';
  }

  // Read the environment, and set it in the compiler host.
  let hostReplacementPaths: any = {};
  // process environment file replacement
  if (appConfig.environments) {
    if (!appConfig.environmentSource) {
      let migrationMessage = '';
      if ('source' in appConfig.environments) {
        migrationMessage = '\n\n' + stripIndent`
          A new environmentSource entry replaces the previous source entry inside environments.

          To migrate angular-cli.json follow the example below:

          Before:

          "environments": {
            "source": "environments/environment.ts",
            "dev": "environments/environment.ts",
            "prod": "environments/environment.prod.ts"
          }


          After:

          "environmentSource": "environments/environment.ts",
          "environments": {
            "dev": "environments/environment.ts",
            "prod": "environments/environment.prod.ts"
          }
        `;
      }
      throw new SilentError(
        `Environment configuration does not contain "environmentSource" entry.${migrationMessage}`
      );

    }
    if (!(buildOptions.environment as any in appConfig.environments)) {
      throw new SilentError(`Environment "${buildOptions.environment}" does not exist.`);
    }

    const appRoot = path.resolve(projectRoot, appConfig.root);
    const sourcePath = appConfig.environmentSource;
    const envFile = appConfig.environments[buildOptions.environment as any];

    hostReplacementPaths = {
      [path.resolve(appRoot, sourcePath)]: path.resolve(appRoot, envFile)
    };
  }

  if (AngularCompilerPlugin.isSupported()) {
    const pluginOptions: AngularCompilerPluginOptions = Object.assign({}, {
      mainPath: useMain ? path.join(projectRoot, appConfig.root, appConfig.main) : undefined,
      i18nInFile: buildOptions.i18nFile,
      i18nInFormat: buildOptions.i18nFormat,
      i18nOutFile: buildOptions.i18nOutFile,
      i18nOutFormat: buildOptions.i18nOutFormat,
      locale: buildOptions.locale,
      platform: appConfig.platform === 'server' ? PLATFORM.Server : PLATFORM.Browser,
      missingTranslation: buildOptions.missingTranslation,
      hostReplacementPaths,
      sourceMap: buildOptions.sourcemaps,
    }, options);
    return new AngularCompilerPlugin(pluginOptions);
  } else {
    const pluginOptions: AotPluginOptions = Object.assign({}, {
      mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
      i18nFile: buildOptions.i18nFile,
      i18nFormat: buildOptions.i18nFormat,
      locale: buildOptions.locale,
      replaceExport: appConfig.platform === 'server',
      missingTranslation: buildOptions.missingTranslation,
      hostReplacementPaths,
      sourceMap: buildOptions.sourcemaps,
      // If we don't explicitely list excludes, it will default to `['**/*.spec.ts']`.
      exclude: []
    }, options);
    return new AotPlugin(pluginOptions);
  }
}

export function getNonAotConfig(wco: WebpackConfigOptions) {
  const { appConfig, projectRoot } = wco;
  const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsConfig);

  return {
    module: { rules: [{ test: /\.ts$/, loader: webpackLoader }] },
    plugins: [ _createAotPlugin(wco, { tsConfigPath, skipCodeGeneration: true }) ]
  };
}

export function getAotConfig(wco: WebpackConfigOptions) {
  const { projectRoot, buildOptions, appConfig } = wco;
  const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsConfig);

  let pluginOptions: any = { tsConfigPath };

  let boLoader: any = [];
  if (buildOptions.buildOptimizer) {
    boLoader = [{
      loader: '@angular-devkit/build-optimizer/webpack-loader',
      options: { sourceMap: buildOptions.sourcemaps }
    }];
  }

  const test = AngularCompilerPlugin.isSupported()
    ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/
    : /\.ts$/;

  return {
    module: { rules: [{ test, use: [...boLoader, webpackLoader] }] },
    plugins: [ _createAotPlugin(wco, pluginOptions) ]
  };
}

export function getNonAotTestConfig(wco: WebpackConfigOptions) {
  const { projectRoot, appConfig } = wco;
  const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsConfig);

  let pluginOptions: any = { tsConfigPath, skipCodeGeneration: true };

  if (appConfig.polyfills) {
    // TODO: remove singleFileIncludes for 2.0, this is just to support old projects that did not
    // include 'polyfills.ts' in `tsconfig.spec.json'.
    const polyfillsPath = path.resolve(projectRoot, appConfig.root, appConfig.polyfills);
    pluginOptions.singleFileIncludes = [polyfillsPath];
  }

  return {
    module: { rules: [{ test: /\.ts$/, loader: webpackLoader }] },
    plugins: [ _createAotPlugin(wco, pluginOptions, false) ]
  };
}
