'use strict';

const expect = require('chai').expect;
const FastBootInfo = require('./../src/fastboot-info.js');
const FastBootResponse = require('./../src/fastboot-response.js');
const FastBootRequest = require('./../src/fastboot-request.js');

describe('FastBootInfo', function() {
  let response;
  let request;
  let fastbootInfo;
  let metadata = {
    'foo': 'bar',
    'baz': 'apple',
  };

  beforeEach(function() {
    response = {};
    request = {
      cookie: '',
      protocol: 'http',
      headers: {
      },
      get() {
        return this.cookie;
      },
    };

    fastbootInfo = new FastBootInfo(request, response, { metadata });
  });

  it('has a FastBootRequest', function() {
    expect(fastbootInfo.request).to.be.an.instanceOf(FastBootRequest);
  });

  it('has a FastBootResponse', function() {
    expect(fastbootInfo.response).to.be.an.instanceOf(FastBootResponse);
  });


  it('has metadata', function() {
    expect(fastbootInfo.metadata).to.deep.equal(metadata);
  });
});
