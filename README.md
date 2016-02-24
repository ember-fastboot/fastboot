# Ember FastBoot Server

The Ember FastBoot Server is used to render Ember.js applications on the
server and deliver them to clients over HTTP. This server is meant to be
run in a production environment.

For more information about FastBoot, see
[ember-cli-fastboot][ember-cli-fastboot], the Ember CLI addon that's a
prerequisite for developing FastBoot apps.

[ember-cli-fastboot]: https://github.com/tildeio/ember-cli-fastboot

## Usage

### Command Line

You can run the FastBoot server from the command line:

```
$ ember-fastboot path/to/fastboot-dist --port 80
```

### Middleware

Alternatively, you can integrate the FastBoot server into an existing
Node.js application by constructing a `FastBootServer` and using it as a
middleware.

```js
var server = new FastBootServer({
  distPath: 'path/to/fastboot-dist'
});

var app = express();

app.get('/*', server.middleware());

var listener = app.listen(process.env.PORT || 3000, function() {
  var host = listener.address().address;
  var port = listener.address().port;

  console.log('FastBoot running at http://' + host + ":" + port);
});
```

#### Providing Index Document Programmatically

You may not store `index.html` with the fastboot build, perhaps it's
stored on an external server, or want to preload the document with additional
information such as i18n translations.  To do this, first, omit `htmlFile` from the options hash
that is provided to the `FastBootServer` constructor.

Next, register a middleware _before_ `server.middleware`, retrieve your index file,
or read it from disk and manipulate the content.  Finally, set the final value to `res.locals.fastbootHTML`.

```js
var fetchIndex = require('node-ember-cli-deploy-redis/fetch');

var server = new FastBootServer({
  distPath: 'path/to/fastboot-dist'
});

var app = express();

app.use(function(req, res, next) {
  fetchIndex(req, 'myapp:index', {
    host: 'redis.example.org',
    port: 6929,
    password: 'passw0rd!',
    db: 0
  }).then(function(indexHtml) {
    res.locals.fastbootHTML = indexHtml;
    next();
  }).catch(next);
});

app.get('/*', server.middleware());

var listener = app.listen(process.env.PORT || 3000, function() {
  var host = listener.address().address;
  var port = listener.address().port;

  console.log('FastBoot running at http://' + host + ":" + port);
});
```
