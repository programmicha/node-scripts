var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var xml = require('data2xml')();
var baseUrl = 'http://programmicha.de/';
var MAX_RECURSIVE_DEPTH = 3;

function indexOf(arr, url) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].loc == url) {
      return i;
    }
  }
  return -1;
}

function extractUrls(_url, body, callback) {
  var $ = cheerio.load(body);
  var links = $('a');
  var result = [];
  // add baseUrl Data
  result.push({'loc': _url, 'lastmod': $('meta[itemprop=dateModified]').attr('content') });
  $(links).each(function(i, element){
    var url = this.attr('href');
    // filter valid urls
    if(url != null
        && (typeof url == 'string')
        && url != ''
        && url.indexOf('http://programmicha.de/') == 0
        && indexOf(result, url) == -1) {
      result.push({'loc': url});
    }
  });
  return callback(null, result);
};

function requestUrl(item, callback) {
  if (!item.lastmod) {
    request(item.loc, function(err, resp, body){
      if (err) throw err;
      extractUrls(item.loc, body, function(err, result) {
        return callback(err, result);
      });
    });
  } else {
    callback(null, [item]);
  }
}

function requestUrls(urls, depth, callback) {
  depth++;
  if (depth > MAX_RECURSIVE_DEPTH) {
    // exit
    return callback(null, urls);
  } else {
    // get new data, join with previous
    async.map(urls, requestUrl, function(err, result) {
      // flatten the array
      var flattened = result.reduce(function(a, b) {
        return a.concat(b);
      });
      return requestUrls(flattened, depth, callback);
    });
  }
}


function run(url, callback) {
  // get first batch of urls
  requestUrl({'loc':url}, function(err, firstResult) {
    // recursively run through site
    var depth = 1
    requestUrls(firstResult, depth, function(err, result) {
      // remove duplicates
      var cleaned = [];
      for (var i = 0; i < result.length; i++) {
        if (indexOf(cleaned, result[i].loc) == -1) {
          cleaned.push(result[i]);
        }
      }
      return callback(err, cleaned);
    });
  });
}

function createSitemapXml(items) {
  return xml(
    'urlset',
    { _attr : {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:schemaLocation': 'http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd',
                'xmlns' : 'http://www.sitemaps.org/schemas/sitemap/0.9' }
      ,url : items }
  );
}

run(baseUrl, function(err, result) {
  if (err) throw err;
  console.log(createSitemapXml(result));
});
