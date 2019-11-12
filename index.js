// 'use strict';
//
// exports.http = (request, response) => {
//   response.status(200).send('Hello World!');
// };
//
// exports.event = (event, callback) => {
//   callback();
// };

const { Storage } = require("@google-cloud/storage");
// Creates a client
const storage = new Storage();

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { zonedTimeToUtc, format } = require("date-fns-tz");
const { parse } = require("date-fns");

const now = new Date();
const scrape = async () => {
  const req = await fetch(
    "http://www.bom.gov.au/nsw/observations/nswall.shtml"
  );
  const html = await req.text();
  const $ = cheerio.load(html);

  const $tables = $(".tabledata");

  let data = [];

  $tables.each(function(i, el) {
    const $table = $(this);
    const region = $table.prev().text();
    const $rows = $("tbody>tr", $table);

    $rows.each(function() {
      const $row = $(this);
      const $children = $row.children();
      const time = parse(`${$children.eq(1).text()}+11`, "d/h:mmax", now);
      const id = $children
        .eq(0)
        .find("a")
        .attr("href")
        .match(/IDN[0-9]+\.[0-9]+/)[0];
      const row = { id, region };
      data.push(row);
    });
  });
  const json = await Promise.all(
    data.map(d => {
      return fetch(
        `http://www.bom.gov.au/fwo/${d.id.split(".")[0]}/${d.id}.json`
      )
        .then(res => res.json())
        .then(json => {
          const {
            name,
            local_date_time_full,
            lat,
            lon,
            wind_dir,
            wind_spd_kmh
          } = json.observations.data[0];
          return {
            region: d.region,
            name,
            local_date_time_full,
            lat,
            lon,
            wind_dir,
            wind_spd_kmh
          };
        });
    })
  );

  // uploadFile();
  console.log(json);
};

const bucketName = "windy-state";
const filename = "current.csv";

async function uploadFile() {
  // Uploads a local file to the bucket
  await storage.bucket(bucketName).upload(filename, {
    // Support for HTTP requests made with `Accept-Encoding: gzip`
    gzip: true,
    // By setting the option `destination`, you can change the name of the
    // object you are uploading to a bucket.
    metadata: {
      // Enable long-lived HTTP caching headers
      // Use only if the contents of the file will never change
      // (If the contents will change, use cacheControl: 'no-cache')
      cacheControl: "no-cache"
    }
  });

  console.log(`${filename} uploaded to ${bucketName}.`);
}

scrape().catch(console.error);
