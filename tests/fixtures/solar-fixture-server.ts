import http from 'http';

// Local stand-in for hamqsl.com/prop.kc2g.com — server/solar.ts's fetchHamqslData
// and fetchEssnData read RCW_SOLAR_HAMQSL_URL/RCW_SOLAR_KC2G_URL overrides
// (set in playwright.config.ts's webServer.env), pointed here instead of the
// real external services, so solar-panel.spec.ts gets deterministic data.
export const SOLAR_FIXTURE_PORT = 3179;
export const SOLAR_FIXTURE_HAMQSL_URL = `http://127.0.0.1:${SOLAR_FIXTURE_PORT}/solarxml.php`;
export const SOLAR_FIXTURE_KC2G_URL = `http://127.0.0.1:${SOLAR_FIXTURE_PORT}/api/essn.json`;

export const SOLAR_FIXTURE = {
  updated: '27 Jul 2026 1200 GMT',
  solarflux: 145,
  sunspots: 62,
  aindex: 8,
  kindex: 2,
  xray: 'B2.1',
  signalnoise: 'S3',
  geomagfield: 'Quiet',
  esfi: 142.3,
  essn: 59.7,
  hfBands: [
    { name: '80m-40m', day: 'Good', night: 'Good' },
    { name: '30m-20m', day: 'Good', night: 'Fair' },
    { name: '17m-15m', day: 'Fair', night: 'Poor' },
    { name: '12m-10m', day: 'Poor', night: 'Poor' },
  ],
};

// fetchHamqslData (server/solar.ts) parses this via regex over the raw
// string, not a real XML parser — element nesting/wrapper tags don't
// matter, only that each `<tag>value</tag>`, `<band name=.. time=..>`, and
// `<phenomenon name=.. location=..>` appears somewhere in the body.
const HAMQSL_XML = `<solar><solardata>
<updated>${SOLAR_FIXTURE.updated}</updated>
<solarflux>${SOLAR_FIXTURE.solarflux}</solarflux>
<sunspots>${SOLAR_FIXTURE.sunspots}</sunspots>
<aindex>${SOLAR_FIXTURE.aindex}</aindex>
<kindex>${SOLAR_FIXTURE.kindex}</kindex>
<xray>${SOLAR_FIXTURE.xray}</xray>
<signalnoise>${SOLAR_FIXTURE.signalnoise}</signalnoise>
<geomagfield>${SOLAR_FIXTURE.geomagfield}</geomagfield>
<solarwind>380.5</solarwind>
<magneticfield>1.2</magneticfield>
<aurora>3</aurora>
<protonflux>1</protonflux>
<electonflux>89</electonflux>
${SOLAR_FIXTURE.hfBands.map(b =>
  `<band name="${b.name}" time="day">${b.day}</band>\n<band name="${b.name}" time="night">${b.night}</band>`
).join('\n')}
<phenomenon name="Aurora" location="northern_hemi">Active</phenomenon>
<phenomenon name="Es Skip" location="north_america">Band Closed</phenomenon>
</solardata></solar>`;

const KC2G_JSON = JSON.stringify({
  '24h': [
    { time: 0, sfi: 140.1, ssn: 55.2 },
    { time: 1, sfi: SOLAR_FIXTURE.esfi, ssn: SOLAR_FIXTURE.essn },
  ],
});

let serverInstance: http.Server | null = null;

export function startSolarFixtureServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/solarxml.php') {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(HAMQSL_XML);
      } else if (req.url === '/api/essn.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(KC2G_JSON);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.once('error', reject);
    server.listen(SOLAR_FIXTURE_PORT, '127.0.0.1', () => {
      serverInstance = server;
      resolve();
    });
  });
}

export function stopSolarFixtureServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverInstance) { resolve(); return; }
    const s = serverInstance;
    serverInstance = null;
    s.close(() => resolve());
  });
}
