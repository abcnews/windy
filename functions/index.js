const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  getStationIds,
  getStationsData,
  extractMinimumData
} = require("./lib/funcs");

admin.initializeApp();

const scrape = async () => {
  const stations = await getStationIds();
  const json = extractMinimumData(await getStationsData(stations));
  await saveFile(json, "latest.json");
};

const archive = async () => {
  const stations = await getStationIds();
  const json = await getStationsData(stations);
  await saveFile(json, `archive-${Date.now()}.json`);
};

async function saveFile(data, filename) {
  const tempLocalFile = path.join(os.tmpdir(), filename);

  fs.writeFileSync(tempLocalFile, JSON.stringify(data));
  const bucket = admin.storage().bucket("windy-258800.appspot.com");
  const metadata = {
    contentType: "text/json",
    "Cache-Control": "no-cache"
  };
  await bucket.upload(tempLocalFile, {
    destination: filename,
    metadata,
    resumable: false
  });
  fs.unlinkSync(tempLocalFile);
  console.log("Saved to database.");
  return "fin";
}

exports.scrape = functions
  .runWith({ memory: "1GB" })
  .pubsub.topic("update")
  .onPublish(scrape);

exports.archive = functions
  .runWith({ memory: "1GB" })
  .pubsub.topic("archive")
  .onPublish(archive);
