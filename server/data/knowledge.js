/**
 * Loads the knowledge base used by the interview engine.
 *  - data/model.json (trained from a Kaggle dataset by `npm run train`)  -> preferred
 *  - otherwise the built-in hand-written knowledge base (data/diseases.js)
 * Set USE_BUILTIN=1 to force the built-in version.
 */
const fs = require('fs');
const path = require('path');
const QUESTIONS = require('./questions');
const MODEL = path.join(__dirname, 'model.json');

function trained() {
  const m = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  return {
    source: `trained:${m.meta.source}`,
    meta: m.meta,
    SYMPTOMS: m.symptoms.map(({ id, label }) => ({ id, label })),
    QUESTIONS: Object.fromEntries(m.symptoms.map((s) => [s.id, s.question])),
    STARTERS: m.starters,
    RED_FLAGS: m.redFlags,
    DISEASES: m.diseases,
    params: m.meta.params,
  };
}

function builtin() {
  const b = require('./diseases');
  const TESTS = require('./tests');
  return {
    source: 'builtin',
    meta: null,
    SYMPTOMS: b.SYMPTOMS,
    QUESTIONS,
    STARTERS: ['fever', 'cough', 'headache', 'runny_nose', 'sore_throat', 'abdominal_pain', 'vomiting', 'diarrhea', 'fatigue', 'burning_urination', 'excessive_thirst', 'yellow_skin'],
    RED_FLAGS: b.RED_FLAGS,
    DISEASES: b.DISEASES.map((d) => ({ ...d, tests: TESTS[d.id] || [] })),
    params: {},
  };
}

module.exports = !process.env.USE_BUILTIN && fs.existsSync(MODEL) ? trained() : builtin();
