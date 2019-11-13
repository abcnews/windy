const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  getStationIds,
  getStationsData,
  extractMinimumData
} = require("./lib/funcs");
const currentFile = "latest.json";
const now = new Date();
admin.initializeApp();

exports.scrape = functions
  .runWith({ memory: "1GB" })
  .pubsub.topic("update")
  .onPublish(message => {
    return scrape();
  });

const scrape = async () => {
  const stations = await getStationIds();
  const json = extractMinimumData(await getStationsData(stations));
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
  await bucket.upload(tempLocalFile, {
    destination: currentFile,
    metadata,
    resumable: false
  });
  fs.unlinkSync(tempLocalFile);
  console.log("Saved to database.");
  return "fin";
}
