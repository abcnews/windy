const fetch = require("node-fetch");
const cheerio = require("cheerio");

const getStationIds = async () => {
  const states = ["nsw", "qld", "nt", "vic", "tas", "sa", "wa"]; // No ACT
  const ids = await Promise.all(
    states.map(d =>
      fetch(`http://www.bom.gov.au/${d}/observations/${d}all.shtml`)
        .then(r => r.text())

        .then(html => cheerio.load(html))

        .then($ => {
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
                .match(/ID.[0-9]+\.[0-9]+/)[0];
              const row = { id, region, state: d };
              data.push(row);
            });
          });
          return data;
        })
    )
  );
  return ids.reduce((a, d) => a.concat(d), []);
};

const getStationData = async station => {
  return fetch(
    `http://www.bom.gov.au/fwo/${station.id.split(".")[0]}/${station.id}.json`
  )
    .then(res => res.json())
    .then(json => ({ ...json, ...station }));
};

const getStationsData = async stations => {
  return Promise.all(stations.map(getStationData));
};

const extractMinimumData = data => {
  return data
    .map(station => {
      const { state } = station;
      const latest = station.observations.data[0];
      if (!latest) return null;
      const { lat, lon, wind_dir, wind_spd_kmh } = station.observations.data[0];
      return [state, lat, lon, wind_dir, wind_spd_kmh];
    })
    .filter(d => !!d);
};

const extractLatestObservations = data => {
  return data
    .map(station => {})
    .then(json => {
      console.log("json", json);
      const {
        name,
        local_date_time_full,
        lat,
        lon,
        wind_dir,
        wind_spd_kmh
      } = json.observations.data[0];
      return {
        ...station,
        name,
        local_date_time_full,
        lat,
        lon,
        wind_dir,
        wind_spd_kmh
      };
    });
};

module.exports = {
  getStationIds,
  getStationsData,
  getStationData,
  extractMinimumData
};
