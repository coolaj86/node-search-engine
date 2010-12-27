/*jslint onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true, strict: true */
/*
  // for passing jslint.com
  var process = {},
    require = function () {},
    setTimeout = function () {};
*/
(function () {
  "use strict";

  function noop() {
    // do nothing
  }

  function indexInArray(arr, val) {
      var i;

      for (i = 0; i < arr.length; i += 1) {
        if(arr[i] === val) {
          return true;
        }
      }
      return false;
  }

  function get_content_type(headers) {
      return headers['content-type'].split(';')[0];
  }

  var libxml = require("./libxmljs"),
      http = require("http"),
      url = require("url"),
      settings = require("./settings"),
      couch = require("./node-couch").CouchDB,
      sys = require("sys"),
      target_site = http.createClient(80, settings.targethost),
      db = couch.db(settings.couchbase, settings.couchhost),
      doc_id = 1,
      known_pages = [],
      visited_pages = [],
      num_of_streams = 0;

  function save_page(URL, title, text) {

      db.saveDoc({'url' : URL, 'title' : title, 'text' : text, '_id': doc_id});

      doc_id += 1;
  }

      

  function unique(arr) {
      var a, l, i, j;

      a = [];
      l = arr.length;
      for(i = 0; i < l; i += 1) {
        for(j = i + 1; j < l; j += 1) {
          // If this[i] is found later in the array
          if (arr[i] === arr[j]) {
            i += 1;
            j = i;
          }
        }
        a.push(arr[i]);
      }
      return a;
  }


  function parsePage(string) {
      var parsed;
      try {
          parsed = libxml.parseHtmlString(string);
      } catch(e) {
          sys.puts('Cannot parse: ' + string);
          return {};
      }

      return parsed;
  }

  function getLinks(parsed_html, baseURL) {

      var links = parsed_html.find('//a'),
        destinations = [],
        attr,
        url_parts,
        destination;

      // or perhaps this is an array
      Object.keys(links).forEach(function (link) {
          attr = links[link].attr('href');
          if (attr && attr.value) {
              url_parts = url.parse(url.resolve(baseURL, attr.value()));

              if (!url_parts.hostname || url_parts.hostname.indexOf(settings.targethost) > -1) {
                  destination = url_parts.pathname;
                  if (url_parts.search) {
                      destination = destination + url_parts.search;
                  }
                  destinations.push(destination);
              } else {
                  noop();
                  // sys.puts('Found outbound link to ' + url_parts.hostname);
              }

          }
      });

      return destinations;
  }

  function getPage(URL, connection, callback) {

      var request = connection.request("GET", URL, {"host": settings.targethost});

      request.addListener('response', function (response) {
        response.setBodyEncoding("utf8");

        var text = '';

        response.addListener("data", function (chunk) {
            text += chunk;
        });

        response.addListener('end', function() {
  //          sys.puts('URL: ' + URL + ' > ' + response.statusCode);
  //          sys.puts('HEADERS > ' + JSON.stringify(response.headers));
            callback(response.statusCode, text, response.headers);
        });

      });
      request.end();
  }

  function cleanPage(parsed_html) {

      var scripts, styles, body;

      scripts = parsed_html.find('//script');
      Object.keys(scripts).forEach(function (script) {
          scripts[script].remove();
      });

      styles = parsed_html.find('//style');
      Object.keys(styles).forEach(function (style) {
          styles[style].remove();
      });

      body = parsed_html.get('/html/body');

      if (body && body.text) {
          body = body.text();
      } else {
          sys.puts('Body is empty?');
          body = '';
      }

      return body;
  }

  function pageTitle(parsed_html) {

      var title = parsed_html.get('//head/title');

      return title.text();
  }

  function get_next_page() {
      known_pages.forEach(function (page) {
          if (known_pages[page] && !indexInArray(visited_pages, known_pages[page]) && (typeof known_pages[page] !== 'undefined')) {
              visited_pages.push(known_pages[page]);
              // sys.puts(known_pages[page] + ' marked as visited');
              // sys.puts('Visited pages: ' + visited_pages.length);
              return known_pages[page];
          }
      });

      process.exit(); // End of list
  }

  function crawl_page(URL, connection, stream_id) {
      sys.puts('Stream ' + stream_id + ' visiting ' + URL);
      getPage(URL, connection, function(code, text, headers) {
          var links,
            content_type,
            title,
            page_text,
            parsed_page,
            new_connection;

          // sys.puts('Got ' + code + ' answer from '+URL+', headers is: ' + JSON.stringify(headers));
          sys.puts('Got ' + code + ' answer from ' + URL);
          links = [];

          if (code === 200) {
              content_type = get_content_type(headers);

              if (content_type === 'text/html' || content_type === 'text/plain' || content_type === '') {
                  parsed_page = parsePage(text);

                  if (parsed_page.find) {

                      title = pageTitle(parsed_page);

                      page_text = cleanPage(parsed_page);

                      links = getLinks(parsed_page, URL);

                      sys.puts('Got ' + links.length + ' links from ' + URL);

                      save_page(URL, title, page_text);
                  } else {
                      sys.puts('Bad parsed page: ' + URL);
                  }
              } else {
                  sys.puts('Strange content type: ' + content_type);
              }

          } else if (code === 301 || code === 303) {

              // Return redirect location to known pages
              links = [headers.location];

          } else if (code === 404) {
              noop();
              // Do nothing, maybe add some sort of log entry
          } else if (code === 400) {
              sys.puts('Bad request: ' + URL);
          } else {
              sys.puts('Unknown code: ' + code + '\nHeaders is: ' + JSON.stringify(headers));
          }


          known_pages = unique(known_pages.concat(links));
          sys.puts('Known pages: ' + known_pages.length);
          setTimeout(function() {
              crawl_page(get_next_page(), connection, stream_id);
          }, settings.crawl_timeout);

          // Create new stream if available and have unvisited pages
          if (num_of_streams < settings.max_streams && known_pages.length > visited_pages.length) {
              num_of_streams += 1;
              new_connection = http.createClient(80, settings.targethost);
              crawl_page(get_next_page(), new_connection, num_of_streams);
              sys.puts('Starting another stream: ' + num_of_streams + ' of ' + settings.max_streams);
          }
      });
  }

  crawl_page('/', target_site, 1);

  num_of_streams = 1;
}());
