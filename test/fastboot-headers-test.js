'use strict';

const expect = require('chai').expect;
const FastBootHeaders = require('./../src/fastboot-headers.js');

describe('FastBootHeaders', function() {
  it('returns an array from getAll when header value is string', function() {
    let headers = {
      'x-test-header': 'value1, value2',
    };
    headers = new FastBootHeaders(headers);

    expect(headers.getAll('x-test-header')).to.deep.equal(['value1, value2']);
  });

  it('returns an array of header values from getAll, regardless of header name casing', function() {
    let headers = {
      'x-test-header': ['value1', 'value2'],
    };
    headers = new FastBootHeaders(headers);

    expect(headers.getAll('X-Test-Header')).to.deep.equal(['value1', 'value2']);
    expect(headers.getAll('x-test-header')).to.deep.equal(['value1', 'value2']);
  });

  it('returns an emtpy array when a header is not present', function() {
    let headers = {
      'x-test-header': ['value1', 'value2'],
    };
    headers = new FastBootHeaders(headers);

    expect(headers.getAll('Host')).to.deep.equal([]);
    expect(headers.getAll('host')).to.deep.equal([]);
  });

  it('returns the first value when using get, regardless of case', function() {
    let headers = {
      'x-test-header': ['value1', 'value2'],
    };
    headers = new FastBootHeaders(headers);

    expect(headers.get('X-Test-Header')).to.equal('value1');
    expect(headers.get('x-test-header')).to.equal('value1');
  });

  it('returns null when using get when a header is not present', function() {
    let headers = {
      'x-test-header': ['value1', 'value2'],
    };
    headers = new FastBootHeaders(headers);

    expect(headers.get('Host')).to.be.null;
    expect(headers.get('host')).to.be.null;
  });

  it('returns whether or not a header is present via has, regardless of casing', function() {
    let headers = {
      'x-test-header': ['value1', 'value2'],
    };
    headers = new FastBootHeaders(headers);

    expect(headers.has('X-Test-Header')).to.be.true;
    expect(headers.has('x-test-header')).to.be.true;
    expect(headers.has('Host')).to.be.false;
    expect(headers.has('host')).to.be.false;
  });

  it('appends entries onto a header, regardless of casing', function() {
    let headers = new FastBootHeaders();

    expect(headers.has('x-foo')).to.be.false;

    headers.append('X-Foo', 'bar');
    expect(headers.has('x-foo')).to.be.true;
    expect(headers.getAll('x-foo')).to.deep.equal(['bar']);

    headers.append('X-Foo', 'baz');
    expect(headers.getAll('x-foo')).to.deep.equal(['bar', 'baz']);
  });

  it('deletes entries onto a header, regardless of casing', function() {
    let headers = new FastBootHeaders();

    headers.append('X-Foo', 'bar');
    expect(headers.has('x-foo')).to.be.true;

    headers.delete('X-Foo');
    expect(headers.has('x-foo')).to.be.false;
  });

  it('returns an iterator for the header/value pairs when calling entries', function() {
    let headers = new FastBootHeaders();

    headers.append('X-Foo', 'foo');
    headers.append('X-Foo', 'baz');
    headers.append('x-bar', 'bar');

    let entriesIterator = headers.entries();
    expect(entriesIterator.next()).to.deep.equal({ value: ['x-foo', 'foo'], done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: ['x-foo', 'baz'], done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: ['x-bar', 'bar'], done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: undefined, done: true });
  });

  it('returns an iterator for keys containing all the keys', function() {
    let headers = new FastBootHeaders();

    headers.append('X-Foo', 'foo');
    headers.append('X-Foo', 'baz');
    headers.append('x-bar', 'bar');

    let entriesIterator = headers.keys();
    expect(entriesIterator.next()).to.deep.equal({ value: 'x-foo', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: 'x-foo', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: 'x-bar', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: undefined, done: true });
  });

  it('sets a header, overwriting existing values, regardless of casing', function() {
    let headers = new FastBootHeaders();

    expect(headers.getAll('x-foo')).to.deep.equal([]);
    expect(headers.getAll('x-bar')).to.deep.equal([]);

    headers.append('X-Foo', 'foo');
    expect(headers.getAll('x-foo')).to.deep.equal(['foo']);

    headers.set('x-foo', 'bar');
    expect(headers.getAll('X-foo')).to.deep.equal(['bar']);

    headers.set('X-Bar', 'baz');
    expect(headers.getAll('x-bar')).to.deep.equal(['baz']);
  });

  it('returns an iterator for values containing all the values', function() {
    let headers = new FastBootHeaders();

    headers.append('X-Foo', 'foo');
    headers.append('X-Foo', 'baz');
    headers.append('x-bar', 'bar');

    let entriesIterator = headers.values();
    expect(entriesIterator.next()).to.deep.equal({ value: 'foo', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: 'baz', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: 'bar', done: false });
    expect(entriesIterator.next()).to.deep.equal({ value: undefined, done: true });
  });
});
