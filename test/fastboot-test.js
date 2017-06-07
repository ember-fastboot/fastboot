'use strict';

const expect = require('chai').expect;
const path = require('path');
const fs = require('fs');
const fixture = require('./helpers/fixture-path');
const FastBoot = require('./../src/index');
const CustomSandbox = require('./fixtures/custom-sandbox/custom-sandbox');

describe('FastBoot', function() {
  it('throws an exception if no distPath is provided', function() {
    let fn = function() {
      return new FastBoot();
    };

    expect(fn).to.throw(/You must instantiate FastBoot with a distPath option/);
  });

  it('throws an exception if no package.json exists in the provided distPath', function() {
    let distPath = fixture('no-package-json');
    let fn = function() {
      return new FastBoot({
        distPath,
      });
    };

    expect(fn).to.throw(/Couldn't find (.+)\/fixtures\/no-package-json/);
  });

  it('throws an error when manifest schema version is higher than fastboot schema version', function() {
    let distPath = fixture('higher-schema-version');
    let fn = function() {
      return new FastBoot({
        distPath,
      });
    };

    expect(fn).to.throw(/An incompatible version between `ember-cli-fastboot` and `fastboot` was found/);
  });

  it('doesn\'t throw an exception if a package.json is provided', function() {
    let distPath = fixture('empty-package-json');
    let fn = function() {
      return new FastBoot({
        distPath,
      });
    };

    expect(fn).to.throw(/(.+)\/fixtures\/empty-package-json\/package.json was malformed or did not contain a manifest/);
  });

  it('can render HTML', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/Welcome to Ember/);
      });
  });

  it('can render HTML with array of app files defined in package.json', function() {
    let fastboot = new FastBoot({
      distPath: fixture('multiple-app-files'),
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/Welcome to Ember/);
      });
  });

  it('cannot not render app HTML with shouldRender set as false', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/', {
      shouldRender: false,
    })
      .then(r => r.html())
      .then(html => {
        expect(html).to.not.match(/Welcome to Ember/);
      });
  });

  it('can serialize the head and body', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/')
      .then(r => {
        let contents = r.domContents();

        expect(contents.head).to.equal('');
        expect(contents.body).to.match(/Welcome to Ember/);
      });
  });

  it('can forcefully destroy the app instance using destroyAppInstanceInMs', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/', {
      destroyAppInstanceInMs: 5,
    })
      .catch(e => {
        expect(e.message).to.equal('App instance was forcefully destroyed in 5ms');
      });
  });

  it('can render HTML when sandboxGlobals is provided', function() {
    let fastboot = new FastBoot({
      distPath: fixture('custom-sandbox'),
      sandboxGlobals: {
        foo: 5,
        najax: 'undefined',
        myVar: 'undefined',
      },
    });

    return fastboot.visit('/foo')
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/foo from sandbox: 5/);
        expect(html).to.match(/najax in sandbox: undefined/);
      });
  });

  it('can render HTML when sandbox class is provided', function() {
    let fastboot = new FastBoot({
      distPath: fixture('custom-sandbox'),
      sandboxClass: CustomSandbox,
      sandboxGlobals: {
        myVar: 2,
        foo: 'undefined',
        najax: 'undefined',
      },
    });

    return fastboot.visit('/foo')
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/myVar in sandbox: 2/);
      });
  });

  it('rejects the promise if an error occurs', function() {
    let fastboot = new FastBoot({
      distPath: fixture('rejected-promise'),
    });

    return expect(fastboot.visit('/')).to.be.rejected;
  });

  it('catches the error if an error occurs', function() {
    let fastboot = new FastBoot({
      distPath: fixture('rejected-promise'),
    });

    fastboot.visit('/')
      .catch(err => expect(err).to.be.not.null);
  });

  it('renders an empty page if the resilient flag is set', function() {
    let fastboot = new FastBoot({
      distPath: fixture('rejected-promise'),
      resilient: true,
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/<body>/);
      });
  });

  it('can reload the distPath', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Welcome to Ember/))
      .then(hotReloadApp)
      .then(() => fastboot.visit('/'))
      .then(r => r.html())
      .then(html => expect(html).to.match(/Goodbye from Ember/));

    function hotReloadApp() {
      fastboot.reload({
        distPath: fixture('hot-swap-app'),
      });
    }
  });

  it('can reload the app using the same sandboxGlobals', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
      sandboxGlobals: {
        foo: 5,
        najax: 'undefined',
        myVar: 'undefined',
      },
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Welcome to Ember/))
      .then(hotReloadApp)
      .then(() => fastboot.visit('/foo'))
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/foo from sandbox: 5/);
        expect(html).to.match(/najax in sandbox: undefined/);
      });

    function hotReloadApp() {
      fastboot.reload({
        distPath: fixture('custom-sandbox'),
      });
    }
  });

  it('can reload the app using the same sandbox class', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
      sandbox: CustomSandbox,
      sandboxGlobals: {
        myVar: 2,
        foo: 'undefined',
        najax: 'undefined',
      },
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Welcome to Ember/))
      .then(hotReloadApp)
      .then(() => fastboot.visit('/foo'))
      .then(r => r.html())
      .then(html => {
        expect(html).to.match(/myVar in sandbox: 2/);
      });

    function hotReloadApp() {
      fastboot.reload({
        distPath: fixture('custom-sandbox'),
      });
    }
  });

  it('reads the config from package.json', function() {
    let fastboot = new FastBoot({
      distPath: fixture('config-app'),
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Config foo: bar/));
  });

  it('prefers APP_CONFIG environment variable', function() {
    let config = {
      modulePrefix: 'fastboot-test',
      environment: 'development',
      baseURL: '/',
      locationType: 'auto',
      EmberENV: { 'FEATURES': {} },
      APP: {
        name: 'fastboot-test',
        version: '0.0.0+3e9fe92d',
        autoboot: false,
        foo: 'baz',
      },
      exportApplicationGlobal: true,
    };

    process.env.APP_CONFIG = JSON.stringify(config);

    let fastboot = new FastBoot({
      distPath: fixture('config-app'),
    });

    delete process.env.APP_CONFIG;

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Config foo: baz/));
  });

  it('handles apps with config defined in app.js', function() {
    let fastboot = new FastBoot({
      distPath: fixture('config-not-in-meta-app'),
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Welcome to Ember/));
  });

  it('reloads the config when package.json changes', function() {
    let distPath = fixture('config-swap-app');
    let packagePath = path.join(distPath, 'package.json');
    let package1Path = path.join(distPath, 'package-1.json');
    let package2Path = path.join(distPath, 'package-2.json');

    copyPackage(package1Path);
    let fastboot = new FastBoot({
      distPath,
    });

    return fastboot.visit('/')
      .then(r => r.html())
      .then(html => expect(html).to.match(/Config foo: bar/))
      .then(() => deletePackage())
      .then(() => copyPackage(package2Path))
      .then(hotReloadApp)
      .then(() => fastboot.visit('/'))
      .then(r => r.html())
      .then(html => expect(html).to.match(/Config foo: boo/))
      .finally(() => deletePackage());

    function hotReloadApp() {
      fastboot.reload({
        distPath,
      });
    }

    function copyPackage(sourcePackage) {
      fs.symlinkSync(sourcePackage, packagePath);
    }

    function deletePackage() {
      fs.unlinkSync(packagePath);
    }
  });

  it('handles apps boot-time failures by throwing Errors', function() {
    let fastboot = new FastBoot({
      distPath: fixture('boot-time-failing-app'),
    });

    return fastboot.visit('/')
    .catch(e => expect(e).to.be.an('error'));
  });

  it('matches app\'s fastboot-info and result\'s fastboot-info', function() {
    let fastboot = new FastBoot({
      distPath: fixture('basic-app'),
    });

    return fastboot.visit('/')
      .then(r => {
        let lookupFastboot = r.instance.lookup('info:-fastboot');
        expect(r._fastbootInfo).to.deep.equal(lookupFastboot);
      });
  });

});
