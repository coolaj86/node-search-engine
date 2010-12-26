(function () {
  "use strict";

  var settings = {
    couchhost: 'localhost:5984',
    couchbase: 'spider',
    targethost: 'finalfantasy.wikia.com',
    max_streams: 3,
    crawl_timeout: 500
  };

  module.exports = settings;
}());
