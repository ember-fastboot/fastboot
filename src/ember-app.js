'use strict';

const fs = require('fs');
const path = require('path');

const najax = require('najax');
const SimpleDOM = require('simple-dom');
const existsSync = require('exists-sync');
const debug = require('debug')('fastboot:ember-app');

const FastBootInfo = require('./fastboot-info');
const Result = require('./result');

/**
 * @private
 *
 * The `EmberApp` class serves as a non-sandboxed wrapper around a sandboxed
 * `Ember.Application`. This bridge allows the FastBoot to quickly spin up new
 * `ApplicationInstances` initialized at a particular route, then destroy them
 * once the route has finished rendering.
 */
class EmberApp {
  /**
   * Create a new EmberApp.
   * @param {Object} options
   * @param {string} options.distPath - path to the built Ember application
   * @param {Sandbox} [options.sandbox=VMSandbox] - sandbox to use
   * @param {Object} [options.sandboxGlobals] - sandbox variables that can be added or used for overrides in the sandbox.
   */
  constructor(options) {
    let distPath = path.resolve(options.distPath);
    let config = readPackageJSON(distPath);

    let {
      appFile,
      hostWhitelist,
      htmlFile,
      moduleWhitelist,
      vendorFile
    } = config;
    let {
      sandbox,
      sandboxGlobals
    } = options;

    let appConfig = process.env.APP_CONFIG ? JSON.parse(process.env.APP_CONFIG) : config.appConfig;

    debug('creating ember app');

    this.hostWhitelist = hostWhitelist;
    this.html = fs.readFileSync(htmlFile, 'utf8');
    this.sandbox = buildSandbox(distPath, sandbox, sandboxGlobals, moduleWhitelist, appConfig);
    this.app = createSandboxedEmberApp(this.sandbox, appFile, vendorFile);
  }


  /**
   * Destroys the app and its sandbox.
   */
  destroy() {
    if (this.app) { this.app.destroy(); }
    this.sandbox = null;
  }

  /**
   * Creates a new application instance and renders the instance at a specific
   * URL, returning a promise that resolves to a {@link Result}. The `Result`
   * givesg you access to the rendered HTML as well as metadata about the
   * request such as the HTTP status code.
   *
   * If this call to `visit()` is to service an incoming HTTP request, you may
   * provide Node's `ClientRequest` and `ServerResponse` objects as options
   * (e.g., the `res` and `req` arguments passed to Express middleware).  These
   * are provided to the Ember application via the FastBoot service.
   *
   * @param {string} path the URL path to render, like `/photos/1`
   * @param {Object} options
   * @param {string} [options.html] the HTML document to insert the rendered app into
   * @param {Object} [options.metadata] Per request specific data used in the app.
   * @param {Boolean} [options.shouldRender] whether the app should do rendering or not. If set to false, it puts the app in routing-only.
   * @param {Boolean} [options.disableShoebox] whether we should send the API data in the shoebox. If set to false, it will not send the API data used for rendering the app on server side in the index.html.
   * @param {Integer} [options.destroyAppInstanceInMs] whether to destroy the instance in the given number of ms. This is a failure mechanism to not wedge the Node process (See: https://github.com/ember-fastboot/fastboot/issues/90)
   * @param {ClientRequest}
   * @param {ClientResponse}
   * @returns {Promise<Result>} result
   */
  visit(path, options) {
    let req = options.request;
    let res = options.response;
    let html = options.html || this.html;
    let disableShoebox = options.disableShoebox || false;
    let destroyAppInstanceInMs = parseInt(options.destroyAppInstanceInMs, 10) || 0;

    let shouldRender = (options.shouldRender !== undefined) ? options.shouldRender : true;
    let bootOptions = buildBootOptions(shouldRender);
    let fastbootInfo = new FastBootInfo(
      req,
      res,
      { hostWhitelist: this.hostWhitelist, metadata: options.metadata }
    );

    let doc = bootOptions.document;

    let result = new Result({
      doc: doc,
      html: html,
      fastbootInfo: fastbootInfo
    });

    let destroy;
    return this.app.boot()
      .then((app) => app.buildInstance())
      .then((instance) => {
        debug('building application instance');
        fastbootInfo.register(instance);
        destroy = destroyAppInstance(instance, result, destroyAppInstanceInMs);
        return instance.boot(bootOptions);
      })
      .then((instance) => {
        result.instanceBooted = true;
        return instance.visit(path, bootOptions);
      })
      .then((instance) => this.waitForApp(instance))
      .then((instance) => createShoebox(instance, disableShoebox, doc, fastbootInfo))
      .catch((error) => { result.error = result.error || error; })
      .then((instance) => result._finalize(instance))
      .finally(() => destroy());
  }

  /**
   * @private
   *
   * Ember apps can manually defer rendering in FastBoot mode if they're waiting
   * on something async the router doesn't know about.  This function fetches
   * that promise for deferred rendering from the app.
   *
   * @param {Ember.ApplicationInstance} instance the application instance
   * @returns {Ember.ApplicationInstance} the application instance
   */
  waitForApp(instance) {
    let fastbootInfo = instance.lookup('info:-fastboot');
    return fastbootInfo.deferredPromise.then(() => instance);
  }

}

/**
 * Initializes the sandbox by evaluating the Ember app's JavaScript
 * code, then retrieves the application factory from the sandbox and creates a new
 * `Ember.Application`.
 *
 * @param {Sandbox} sandbox sandboxed execution context
 * @param {string} appFilePath the path to the application file
 * @param {string} vendorFilePath the path to the vendor file
 * @returns {Ember.Application} the Ember application from the sandbox
 */
function createSandboxedEmberApp(sandbox, appFilePath, vendorFilePath) {

  loadAppFiles(sandbox, appFilePath, vendorFilePath);

  // Retrieve the application factory from within the sandbox
  let AppFactory = sandbox.run(function(ctx) {
    return ctx.require('~fastboot/app-factory');
  });

  // If the application factory couldn't be found, throw an error
  if (!AppFactory || typeof AppFactory['default'] !== 'function') {
    throw new Error('Failed to load Ember app from ' + appFilePath + ', make sure it was built for FastBoot with the `ember fastboot:build` command.');
  }

  // Otherwise, return a new `Ember.Application` instance
  return AppFactory['default']();
}

/**
 * Loads the app and vendor files in the sandbox (Node vm).
 *
 * @param {Sandbox} sandbox sandboxed execution context
 * @param {string} appFilePath the path to the application file
 * @param {string} vendorFilePath the path to the vendor file
 */
function loadAppFiles(sandbox, appFilePath, vendorFilePath) {
  sandbox.eval('sourceMapSupport.install(Error);');

  let appFile = fs.readFileSync(appFilePath, 'utf8');
  let vendorFile = fs.readFileSync(vendorFilePath, 'utf8');

  debug("evaluating app; app=%s; vendor=%s", appFilePath, vendorFilePath);

  sandbox.eval(vendorFile, vendorFilePath);
  debug("vendor file evaluated");

  sandbox.eval(appFile, appFilePath);
  debug("app file evaluated");
}

/**
 * Creates a destroy function to destroy the created `ApplicationInstance` forcefully.
 *
 * @param {Object} The Result object that contains the application instance to be destroyed.
 * @param {Integer} How long to wait before manually destroying the application instance. Ignored if its value is 0.
 * @returns {Function} The destructor function.
 */
function destroyAppInstance(instance, result, timeout) {
  if (!timeout) return () => {
    debug('destroying application instance');
    if(instance.isDestroyed || instance.isDestroying) { return; }
    instance.destroy();
  };

  // start a timer to destroy the instance forcefully in the given ms.
  // This is a failure mechanism so that node process doesn't get wedged if the `visit` never completes.
  let destructionTimer = setTimeout(function() {
    debug('destroying application instance because of timeout');
    if(instance.isDestroyed || instance.isDestroying) { return; }
    instance.destroy();
    result.error = new Error(`App instance was forcefully destroyed in ${timeout}ms`);
  }, timeout);

  return () => {
    debug('destroying application instance');
    clearTimeout(destructionTimer);
    if(instance.isDestroyed || instance.isDestroying) { return; }
    instance.destroy();
  };
}

/**
 * Builds and initializes a new sandbox to run the Ember application in.
 *
 * @param {string} distPath path to the built Ember app to load
 * @param {Sandbox} [sandboxClass=VMSandbox] sandbox class to use
 * @param {Object} [sandboxGlobals={}] any additional variables to expose in the sandbox or override existing in the sandbox
 * @returns {Sandbox} the built Sandbox with attached globals
 */
function buildSandbox(distPath, sandboxClass, sandboxGlobals, moduleWhitelist, appConfig) {
  let Sandbox = sandboxClass || require('./vm-sandbox');
  let sandboxRequire = buildWhitelistedRequire(moduleWhitelist, distPath);

  // add any additional user provided variables or override the default globals in the sandbox
  let globals = {
    najax: najax,
    FastBoot: {
      require: sandboxRequire,
      config: () => ({ default: appConfig })
    }
  };

  for (let key in sandboxGlobals) {
    if (sandboxGlobals.hasOwnProperty(key)) {
      globals[key] = sandboxGlobals[key];
    }
  }

  return new Sandbox({ globals });
}

/**
 * The Ember app runs inside a sandbox that doesn't have access to the normal
 * Node.js environment, including the `require` function. Instead, we provide
 * our own `require` method that only allows whitelisted packages to be
 * requested.
 *
 * This method takes an array of whitelisted package names and the path to the
 * built Ember app and constructs this "fake" `require` function that gets made
 * available globally inside the sandbox.
 *
 * @param {string[]} whitelist array of whitelisted package names
 * @param {string} distPath path to the built Ember app
 * @return {Function} the `require` function
 */
function buildWhitelistedRequire(whitelist, distPath) {
  whitelist.forEach(function(whitelistedModule) {
    debug("module whitelisted; module=%s", whitelistedModule);
  });

  return function(moduleName) {
    if (whitelist.indexOf(moduleName) > -1) {
      let nodeModulesPath = path.join(distPath, 'node_modules', moduleName);

      if (existsSync(nodeModulesPath)) {
        return require(nodeModulesPath);
      } else {
        // If it's not on disk, assume it's a built-in node package
        return require(moduleName);
      }
    } else {
      throw new Error("Unable to require module '" + moduleName + "' because it was not in the whitelist.");
    }
  };
}

/**
 * Given the path to a built Ember app, reads the FastBoot manifest
 * information from its `package.json` file.
 *
 * @param {string} distPath the path to the Ember app's dist directory
 * @return {Object} package.json metadeta
 */
function readPackageJSON(distPath) {
  let pkgPath = path.join(distPath, 'package.json');
  let file;

  try {
    file = fs.readFileSync(pkgPath);
  } catch (e) {
    throw new Error(`Couldn't find ${pkgPath}. You may need to update your version of ember-cli-fastboot.`);
  }

  let manifest;
  let pkg;

  try {
    pkg = JSON.parse(file);
    manifest = pkg.fastboot.manifest;
  } catch (e) {
    throw new Error(`${pkgPath} was malformed or did not contain a manifest. Ensure that you have a compatible version of ember-cli-fastboot.`);
  }

  return {
    appFile:  path.join(distPath, manifest.appFile),
    vendorFile: path.join(distPath, manifest.vendorFile),
    htmlFile: path.join(distPath, manifest.htmlFile),
    moduleWhitelist: pkg.fastboot.moduleWhitelist,
    hostWhitelist: pkg.fastboot.hostWhitelist,
    appConfig: pkg.fastboot.appConfig
  };
}

/**
 * Builds an object with the options required to boot an ApplicationInstance in
 * FastBoot mode.
 *
 * @param {Boolean} shouldRender whether FastBoot should render the DOM
 * @return {Object} the boot options to send to the Ember app.
 */
function buildBootOptions(shouldRender) {
  let doc = new SimpleDOM.Document();

  return {
    isBrowser: false,
    document: doc,
    rootElement: doc.body,
    shouldRender
  };
}

/**
 * Writes the shoebox into the DOM for the browser rendered app to consume.
 * Uses a script tag with custom type so that the browser will treat as plain
 * text, and not expend effort trying to parse contents of the script tag.
 * Each key is written separately so that the browser rendered app can
 * parse the specific item at the time it is needed instead of everything
 * all at once.
 *
 * @param {Ember.ApplicationInstance} instance the application instance
 * @param {Boolean} disableShoebox does not create the shoebox if false
 * @param {SimpleDOM.Document} the DOM document to insert the shoebox into
 * @param {FastBootInfo} FastBoot information metadata.
 * @returns {Promise<Result>} the application instance
 */
function createShoebox(instance, disableShoebox, doc, fastbootInfo) {
  if (disableShoebox) { return instance; }

  let shoebox = fastbootInfo.shoebox;
  if (!shoebox) { return instance; }

  for (let key in shoebox) {
    if (!shoebox.hasOwnProperty(key)) { continue; }

    let value = shoebox[key];
    let textValue = JSON.stringify(value);
    textValue = escapeJSONString(textValue);

    let scriptText = doc.createRawHTMLSection(textValue);
    let scriptEl = doc.createElement('script');

    scriptEl.setAttribute('type', 'fastboot/shoebox');
    scriptEl.setAttribute('id', `shoebox-${key}`);
    scriptEl.appendChild(scriptText);
    doc.body.appendChild(scriptEl);
  }

  return instance;
}

const JSON_ESCAPE = {
  '&': '\\u0026',
  '>': '\\u003e',
  '<': '\\u003c',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};

const JSON_ESCAPE_REGEXP = /[\u2028\u2029&><]/g;

/**
 * Escapes JSON strings
 *
 * @param {string} string
 * @returns {string} string but escaped for JSON
 */
function escapeJSONString(string) {
  return string.replace(JSON_ESCAPE_REGEXP, (match) => JSON_ESCAPE[match]);
}

module.exports = EmberApp;
