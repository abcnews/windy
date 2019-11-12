// 'use strict';
//
// exports.http = (request, response) => {
//   response.status(200).send('Hello World!');
// };
//
// exports.event = (event, callback) => {
//   callback();
// };

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const leftPad = require("left-pad");
const csv = require("csv-stringify/lib/sync");
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
      const row = {
        id,
        region,
        station: $("th", $row).text(),
        time,
        temperature: $children.eq(2).text(),
        temperatureApparent: $children.eq(3).text(),
        dewPoint: $children.eq(4).text(),
        relativeHumidity: $children.eq(5).text(),
        deltaT: $children.eq(6).text(),
        windDir: $children.eq(7).text(),
        windSpeedKm: $children.eq(8).text(),
        windGustKm: $children.eq(9).text(),
        windSpeedKn: $children.eq(10).text(),
        windGustKn: $children.eq(11).text(),
        pressure: $children.eq(12).text()
      };
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

  console.log(csv(json, { header: true }));
};

scrape().catch(console.error);
