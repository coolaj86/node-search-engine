/*jslint onevar: true, undef: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true, strict: true */
// nomen: false -- allow _
(function () {
    "use strict";

    var couch = require('./node-couch').CouchDB,
      libxml = require('./libxmljs'),
      settings = require('./settings'),
      sys = require('sys'),
      db = couch.db(settings.couchbase, settings.couchhost),
      doc_id = 1;

    function process_document(docs) {

      if (docs.length > 0) {
          doc_id += 1;
          var document = docs.pop();

          db.openDoc(document.id,{
              'success': function(page) {
                  sys.puts('<sphinx:document id="' + parseInt(page._id, 10) + '">');

                  sys.puts('<subject>');

                  if (page.title) {
                      sys.puts(page.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                  } else {
                      sys.puts('No title');
                  }

                  sys.puts('</subject>');

                  sys.puts('<content>');

                  if (page.text) {
                      sys.puts(page.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                  }

                  sys.puts('</content>');

                  if (page.url) {
                      sys.puts('<url>' + page.url + '</url>');
                  } else {
                      sys.puts('<url />');
                  }

                  sys.puts('</sphinx:document>');

                  process_document(docs);
              },
              'error':function (e) {
                  sys.puts('Error getting doc: ' + sys.inspect(e));
              }
          });

      } else {
          sys.puts('</sphinx:docset>');
      }
    }

    db.allDocs({
        'success': function(docs) {

            sys.puts('<' + '?xml version="1.0" encoding="utf-8"?>');
            sys.puts('<sphinx:docset>');
            sys.puts('<sphinx:schema>');

            sys.puts(' <sphinx:field name="subject" />');
            sys.puts(' <sphinx:field name="content" />');
            sys.puts(' <sphinx:field name="url" />');

            sys.puts('</sphinx:schema>');

            process_document(docs.rows);

        },
        'error': function(errorResponse) {
            sys.puts('Error getting all docs: ' + JSON.stringify(errorResponse.reason));
        }
    });
}());
