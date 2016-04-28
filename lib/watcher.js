'use strict';

var Sane = require('sane');

var defaultUI = {
  writeLine: function() {
    console.log.apply(console, arguments);
  }
};

function FastBootWatcher(options) {
  options = options || {};

  this.watchedDir = options.watchedDir;
  this.ui = options.ui || this.ui || defaultUI;
  this.verbose = options.verbose;

  console.log('FastBootWatcher watching', this.watchedDir);

  this.watcher = this.watcher || new Sane(this.watchedDir, {
    verbose: this.verbose
  });

  this.watcher.on('change', this.didChange.bind(this));
  this.watcher.on('add',    this.didAdd.bind(this));
  this.watcher.on('delete', this.didDelete.bind(this));
};

FastBootWatcher.prototype.didChange = function(filepath) {
  this.ui.writeLine('Server file changed: ' + filepath);
};

FastBootWatcher.prototype.didAdd = function(filepath) {
  this.ui.writeLine('Server file added: ' + filepath);
};

FastBootWatcher.prototype.didDelete = function(filepath) {
  this.ui.writeLine('Server file deleted: ' + filepath);
};

FastBootWatcher.prototype.on = function() {
  this.watcher.on.apply(this.watcher, arguments);
};

FastBootWatcher.prototype.off = function() {
  this.watcher.off.apply(this.watcher, arguments);
};

module.exports = FastBootWatcher;
