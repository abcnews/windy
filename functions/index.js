const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require("fs");
const os = require("os");
const path = require("path");

const currentFile = "current.json";
const now = new Date();
admin.initializeApp();

exports.scrape = functions.pubsub.topic("update").onPublish(message => {
  return scrape();
});

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
  console.log("before-save");
  await saveFile(json);
};

async function saveFile(data) {
  const tempLocalFile = path.join(os.tmpdir(), currentFile);

  fs.writeFileSync(tempLocalFile, JSON.stringify(data));
  const bucket = admin.storage().bucket("windy-258800.appspot.com");
  const metadata = {
    contentType: "text/json",
    "Cache-Control": "no-cache"
  };
  await bucket.upload(tempLocalFile, { destination: currentFile, metadata });
  await bucket.upload(tempLocalFile, {
    destination: `${Date.now()}.json`,
    metadata
  });
  fs.unlinkSync(tempLocalFile);
  console.log("Saved to database.");
  return "fin";
}
