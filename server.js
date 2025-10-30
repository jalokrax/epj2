// server.js – REN JavaScript + XML (ingen DB, filer i /data)
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { parseStringPromise, Builder } = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Paths ----------
const DATA_DIR       = path.join(__dirname, "data");
const PATIENTS_XML   = path.join(DATA_DIR, "patients.xml");
const ENCOUNTERS_XML = path.join(DATA_DIR, "encounters.xml");
const NOTES_XML      = path.join(DATA_DIR, "notes.xml");

// ---------- Middleware ----------
app.use(cors());
// Modtag rå tekst (XML) fra klienten
app.use(express.text({ type: "*/*", limit: "1mb" }));
// Statisk frontend
app.use(express.static(path.join(__dirname, "public")));

// Root → send index.html
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "public") }, (err) => {
    if (err) {
      console.error("sendFile error:", err);
      res.status(500).send("sendFile error");
    }
  });
});

// ---------- Init datafiler ----------
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(PATIENTS_XML)) {
    const seed = `<patients>
  <patient>
    <id>p-anna</id>
    <cpr>123456-7890</cpr>
    <name>Anna Jensen</name>
    <dob>1990-01-01</dob>
  </patient>
</patients>`;
    fs.writeFileSync(PATIENTS_XML, seed, "utf8");
  }

  if (!fs.existsSync(ENCOUNTERS_XML)) {
    fs.writeFileSync(ENCOUNTERS_XML, "<encounters></encounters>", "utf8");
  }
  if (!fs.existsSync(NOTES_XML)) {
    fs.writeFileSync(NOTES_XML, "<notes></notes>", "utf8");
  }
}
ensureData();

// ---------- Helpers (XML <-> JS) ----------
function newId(prefix) {
  return (prefix || "") + Math.random().toString(36).slice(2, 9);
}

/* Patients */
async function readPatients() {
  const xml = fs.readFileSync(PATIENTS_XML, "utf8");
  const obj = await parseStringPromise(xml, { explicitArray: true, trim: true });
  const list = obj?.patients?.patient || [];
  return list.map(p => ({
    id:   p.id?.[0]   || "",
    cpr:  p.cpr?.[0]  || "",
    name: p.name?.[0] || "",
    dob:  p.dob?.[0]  || ""
  }));
}
async function writePatients(list) {
  const b = new Builder({ headless: true });
  const xml = b.buildObject({
    patients: { patient: list.map(p => ({ id: p.id, cpr: p.cpr, name: p.name, dob: p.dob })) }
  });
  fs.writeFileSync(PATIENTS_XML, xml, "utf8");
}

/* Encounters */
async function readEncounters() {
  const xml = fs.readFileSync(ENCOUNTERS_XML, "utf8");
  const obj = await parseStringPromise(xml, { explicitArray: true, trim: true });
  const list = obj?.encounters?.encounter || [];
  return list.map(e => ({
    id:         e.id?.[0]         || "",
    patient_id: e.patient_id?.[0] || "",
    start:      e.start?.[0]      || ""
  }));
}
async function writeEncounters(list) {
  const b = new Builder({ headless: true });
  const xml = b.buildObject({
    encounters: { encounter: list.map(e => ({ id: e.id, patient_id: e.patient_id, start: e.start })) }
  });
  fs.writeFileSync(ENCOUNTERS_XML, xml, "utf8");
}

/* Notes */
async function readNotes() {
  const xml = fs.readFileSync(NOTES_XML, "utf8");
  const obj = await parseStringPromise(xml, { explicitArray: true, trim: true });
  const list = obj?.notes?.note || [];
  return list.map(n => ({
    id:           n.id?.[0]           || "",
    encounter_id: n.encounter_id?.[0] || "",
    author:       n.author?.[0]       || "",
    ts:           n.ts?.[0]           || "",
    text:         n.text?.[0]         || ""
  }));
}
async function writeNotes(list) {
  const b = new Builder({ headless: true });
  const xml = b.buildObject({
    notes: { note: list.map(n => ({
      id: n.id, encounter_id: n.encounter_id, author: n.author, ts: n.ts, text: n.text
    })) }
  });
  fs.writeFileSync(NOTES_XML, xml, "utf8");
}

// ---------- ROUTES (XML) ----------

// Health
app.get("/health", (_req, res) => {
  res.type("application/xml")
     .send(`<health ok="true"><time>${new Date().toISOString()}</time></health>`);
});

// Patients
app.get("/patients", async (_req, res) => {
  try {
    const list = await readPatients();
    const b = new Builder({ headless: true });
    res.type("application/xml").send(b.buildObject({ patients: { patient: list } }));
  } catch {
    res.status(500).type("application/xml").send("<error>Could not read patients</error>");
  }
});

// POST body (XML):
// <patient><cpr>010101-0001</cpr><name>Test</name><dob>1995-01-01</dob></patient>
app.post("/patients", async (req, res) => {
  try {
    const parsed = await parseStringPromise(req.body || "", { explicitArray: true, trim: true });
    const p = parsed?.patient;
    const patient = {
      id: newId("p-"),
      cpr:  p?.cpr?.[0]  || "",
      name: p?.name?.[0] || "",
      dob:  p?.dob?.[0]  || ""
    };
    if (!patient.cpr || !patient.name || !patient.dob)
      return res.status(400).type("application/xml").send("<error>cpr, name og dob kræves</error>");

    const list = await readPatients();
    if (list.some(x => x.cpr === patient.cpr))
      return res.status(409).type("application/xml").send("<error>CPR findes allerede</error>");

    list.unshift(patient);
    await writePatients(list);

    const b = new Builder({ headless: true });
    res.status(201).type("application/xml").send(b.buildObject({ ok: true, patient }));
  } catch {
    res.status(400).type("application/xml").send("<error>Invalid XML</error>");
  }
});

// Encounters (kontakter)
app.get("/patients/:pid/encounters", async (req, res) => {
  try {
    const all = await readEncounters();
    const subset = all.filter(e => e.patient_id === req.params.pid);
    const b = new Builder({ headless: true });
    res.type("application/xml").send(b.buildObject({ encounters: { encounter: subset } }));
  } catch {
    res.status(500).type("application/xml").send("<error>Could not read encounters</error>");
  }
});

app.post("/patients/:pid/encounters", async (req, res) => {
  try {
    const enc = { id: newId("e-"), patient_id: req.params.pid, start: new Date().toISOString() };
    const list = await readEncounters();
    list.unshift(enc);
    await writeEncounters(list);
    const b = new Builder({ headless: true });
    res.status(201).type("application/xml").send(b.buildObject({ ok: true, encounter: enc }));
  } catch {
    res.status(400).type("application/xml").send("<error>Could not create encounter</error>");
  }
});

// Notes (journalnotater)
app.get("/encounters/:eid/notes", async (req, res) => {
  try {
    const all = await readNotes();
    const subset = all.filter(n => n.encounter_id === req.params.eid);
    const b = new Builder({ headless: true });
    res.type("application/xml").send(b.buildObject({ notes: { note: subset } }));
  } catch {
    res.status(500).type("application/xml").send("<error>Could not read notes</error>");
  }
});

// POST body (XML):
// <note><author>u-doc</author><text>Patient er velbefindende</text></note>
app.post("/encounters/:eid/notes", async (req, res) => {
  try {
    const parsed = await parseStringPromise(req.body || "", { explicitArray: true, trim: true });
    const n = parsed?.note || {};
    const note = {
      id: newId("n-"),
      encounter_id: req.params.eid,
      author: n.author?.[0] || "unknown",
      ts: new Date().toISOString(),
      text: n.text?.[0] || ""
    };
    if (!note.text) return res.status(400).type("application/xml").send("<error>Missing text</error>");

    const list = await readNotes();
    list.unshift(note);
    await writeNotes(list);

    const b = new Builder({ headless: true });
    res.status(201).type("application/xml").send(b.buildObject({ ok: true, note }));
  } catch {
    res.status(400).type("application/xml").send("<error>Invalid XML</error>");
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log("Static dir:", path.join(__dirname, "public"));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/`);
});
