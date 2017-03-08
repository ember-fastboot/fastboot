'use strict';

const express = require('express');
const RSVP = require('rsvp');
const FastBoot = require('./../src/index');

function TestHTTPServer(options) {
  options = options || {};

  options.ui = options.ui || {
    writeLine() { },
  };

  this.options = options;
}

TestHTTPServer.prototype.start = function() {
  let options = this.options;
  let server = new FastBoot(options);
  let self = this;

  this.server = server;

  return server._app.buildAppInstance().then(function() {
    let app = express();

    app.get('/*', server.middleware());

    return new RSVP.Promise(function(resolve, reject) {
      let listener = app.listen(options.port, options.host, function() {
        let host = listener.address().address;
        let port = listener.address().port;
        let family = listener.address().family;

        self.listener = listener;

        resolve({
          host,
          port,
          server,
          listener,
        });
      });
    });
  });
};

TestHTTPServer.prototype.withFastBoot = function(cb) {
  return cb(this.server);
};

TestHTTPServer.prototype.stop = function() {
  if (this.listener) {
    this.listener.close();
  }
};

module.exports = TestHTTPServer;
