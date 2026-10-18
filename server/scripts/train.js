/**
 * Trains the symptom model from a Kaggle symptom/disease CSV and writes data/model.json.
 *
 *   node scripts/train.js [folder-with-csv-files]        (default: server/dataset)
 *
 * Supported formats (auto-detected):
 *   A) "Disease Symptom Prediction" (itachi9604):  dataset.csv  -> Disease, Symptom_1 ... Symptom_17
 *   B) "Disease Prediction Using ML" (kaushil268): Training.csv -> one 0/1 column per symptom + prognosis
 * Optional: symptom_Description.csv / symptom_precaution.csv (used for diseases without built-in content).
 *
 * For every disease it learns P(symptom | disease) = (count + 0.5) / (rows + 1), then evaluates the
 * full interview engine on rows that were NOT used for training (80/20 split).
 */
const fs = require('fs');
const path = require('path');
const { createEngine } = require('../services/predictor');
const CONTENT = require('../data/content');
const QUESTIONS = require('../data/questions');
const { RED_FLAGS: BASE_FLAGS } = require('../data/diseases');

const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dataset'));
const OUT = path.join(__dirname, '..', 'data', 'model.json');

/* ---------- helpers ---------- */
const findFile = (re) => {
  const f = fs.readdirSync(dir).find((n) => re.test(n));
  return f ? path.join(dir, f) : null;
};
const readCsv = (file) =>
  fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.split(','));

// ' skin_rash' , 'dischromic _patches', 'foul_smell_of urine'  ->  clean ids
const norm = (s) => s.trim().toLowerCase().replace(/\s*_\s*/g, '_').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
const ALIAS = {
  diarrhoea: 'diarrhea', yellowish_skin: 'yellow_skin', burning_micturition: 'burning_urination',
  continuous_sneezing: 'sneezing', pain_behind_the_eyes: 'eye_pain', fast_heart_rate: 'palpitations',
  blurred_and_distorted_vision: 'blurred_vision', skin_rash: 'rash', scurring: 'skin_scarring',
  spotting_urination: 'spotting_urination',
};
const sym = (s) => { const n = norm(s); return ALIAS[n] || n; };
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// dataset disease name (slug) -> [id, display name or null to use content name]
const DISEASE_IDS = {
  'common-cold': 'common-cold', dengue: 'dengue', malaria: 'malaria', typhoid: 'typhoid',
  gastroenteritis: 'gastroenteritis', migraine: 'migraine', hypertension: 'hypertension',
  diabetes: 'type-2-diabetes', 'bronchial-asthma': 'asthma', pneumonia: 'pneumonia',
  'urinary-tract-infection': 'uti', 'vertigo-paroymsal-positional-vertigo': 'vertigo-bppv',
  aids: 'hiv-aids', acne: 'acne', 'alcoholic-hepatitis': 'alcoholic-hepatitis', allergy: 'allergy',
  arthritis: 'arthritis', 'cervical-spondylosis': 'cervical-spondylosis', 'chicken-pox': 'chickenpox',
  'chronic-cholestasis': 'chronic-cholestasis', 'dimorphic-hemmorhoids-piles': 'hemorrhoids',
  'drug-reaction': 'drug-reaction', 'fungal-infection': 'fungal-infection', gerd: 'gerd',
  'heart-attack': 'heart-attack', 'hepatitis-a': 'hepatitis-a', 'hepatitis-b': 'hepatitis-b',
  'hepatitis-c': 'hepatitis-c', 'hepatitis-d': 'hepatitis-d', 'hepatitis-e': 'hepatitis-e',
  hyperthyroidism: 'hyperthyroidism', hypoglycemia: 'hypoglycemia', hypothyroidism: 'hypothyroidism',
  impetigo: 'impetigo', jaundice: 'jaundice', osteoarthristis: 'osteoarthritis',
  'paralysis-brain-hemorrhage': 'stroke', 'peptic-ulcer-diseae': 'peptic-ulcer', psoriasis: 'psoriasis',
  tuberculosis: 'tuberculosis', 'varicose-veins': 'varicose-veins',
};

const LABELS = {
  mild_fever: 'Mild fever', high_fever: 'High fever', rash: 'Skin rash', eye_pain: 'Pain behind the eyes',
  yellow_skin: 'Yellowish skin', burning_urination: 'Burning while urinating', sneezing: 'Continuous sneezing',
  palpitations: 'Fast heartbeat', blurred_vision: 'Blurred or distorted vision', skin_scarring: 'Skin scarring',
  cold_hands_and_feets: 'Cold hands and feet', swollen_extremeties: 'Swollen hands or feet',
  family_history: 'Family history of illness', history_of_alcohol_consumption: 'Regular alcohol use',
  extra_marital_contacts: 'Unprotected or multiple sexual contacts', toxic_look_typhos: 'Toxic, very unwell look',
  receiving_blood_transfusion: 'Received blood transfusion', receiving_unsterile_injections: 'Unsterile injections',
  dischromic_patches: 'Discoloured skin patches', nodal_skin_eruptions: 'Small skin bumps', mucoid_sputum: 'Thick sticky mucus',
  swelled_lymph_nodes: 'Swollen glands', stomach_bleeding: 'Bleeding from the stomach', silver_like_dusting: 'Silvery scaly patches',
  continuous_feel_of_urine: 'Constant urge to urinate', polyuria: 'Passing large amounts of urine', spotting_urination: 'Spotting while urinating',
};
const QUESTION_OVERRIDES = {
  mild_fever: 'Do you have a mild fever (up to about 38.5°C / 101°F)?',
  itching: 'Do you have itching on your skin?',
  family_history: 'Does a close family member have a related long-term illness?',
  history_of_alcohol_consumption: 'Do you drink alcohol regularly?',
  extra_marital_contacts: 'Have you had unprotected sex or multiple sexual partners recently?',
  receiving_blood_transfusion: 'Have you ever received a blood transfusion?',
  receiving_unsterile_injections: 'Have you had an injection with a possibly unsterilised needle?',
  obesity: 'Are you overweight or obese?',
  toxic_look_typhos: 'Do you look and feel severely unwell, almost "toxic"?',
  skin_scarring: 'Do you have skin scarring?',
  cold_hands_and_feets: 'Do your hands and feet feel unusually cold?',
  swollen_extremeties: 'Are your hands or feet swollen?',
  dischromic_patches: 'Do you have patches of skin that look a different colour from the rest?',
  spotting_urination: 'Do you notice blood spots when you urinate?',
  coma: 'Has the person been unconscious or unresponsive?',
  altered_sensorium: 'Is there confusion or a change in alertness?',
};
const humanize = (id) => LABELS[id] || id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const questionFor = (id) =>
  QUESTION_OVERRIDES[id] || QUESTIONS[id] || `Are you experiencing ${humanize(id).toLowerCase()}?`;

const STARTERS = ['mild_fever', 'high_fever', 'cough', 'headache', 'stomach_pain', 'vomiting', 'diarrhea',
  'itching', 'rash', 'joint_pain', 'fatigue', 'breathlessness', 'burning_urination', 'dizziness'];

const RED_FLAGS = [
  ...BASE_FLAGS,
  { all: ['slurred_speech'], message: 'Slurred speech can signal a stroke. Call emergency services now.' },
  { all: ['weakness_of_one_body_side'], message: 'Weakness on one side of the body can signal a stroke. Call emergency services now.' },
  { all: ['coma'], message: 'Unconsciousness is an emergency. Call emergency services now.' },
  { all: ['altered_sensorium'], message: 'Confusion or drowsiness needs urgent medical attention.' },
  { all: ['blood_in_sputum'], message: 'Coughing up blood needs urgent medical evaluation.' },
  { all: ['stomach_bleeding'], message: 'Bleeding from the stomach is an emergency. Go to hospital now.' },
  { all: ['bloody_stool'], message: 'Blood in the stool needs prompt medical evaluation.' },
  { all: ['acute_liver_failure'], message: 'Signs of acute liver failure are an emergency. Go to hospital now.' },
  { all: ['high_fever', 'stiff_neck'], message: 'High fever with a stiff neck can signal meningitis. Seek emergency care.' },
];

/* ---------- load data ---------- */
function loadRows() {
  const main = findFile(/^dataset\.csv$/i);
  if (main) {
    const rows = [];
    for (const r of readCsv(main)) {
      const name = (r[0] || '').trim();
      if (!name || name.toLowerCase() === 'disease') continue;
      const s = [...new Set(r.slice(1).filter((x) => x.trim()).map(sym))];
      if (s.length) rows.push({ disease: name, symptoms: s });
    }
    return { rows, file: path.basename(main) };
  }
  const train = findFile(/^training\.csv$/i);
  if (!train) throw new Error(`No dataset.csv or Training.csv found in ${dir}`);
  const [head, ...body] = readCsv(train).filter((r) => r.length > 2);
  const cols = head.map((h) => h.trim());
  const pi = cols.findIndex((h) => /prognosis|disease/i.test(h));
  const rows = body.filter((r) => r[pi]?.trim()).map((r) => ({
    disease: r[pi].trim(),
    symptoms: cols.map((c, i) => (i !== pi && r[i].trim() === '1' ? sym(c) : null)).filter(Boolean),
  })).filter((r) => r.symptoms.length);
  return { rows, file: path.basename(train) };
}

function optionalMap(re) {
  const f = findFile(re);
  const m = {};
  if (f) for (const r of readCsv(f)) if (r[0]?.trim()) m[slug(r[0])] = r.slice(1).map((x) => x.trim()).filter(Boolean);
  return m;
}

/* ---------- training ---------- */
function learn(rows) {
  const by = {};
  for (const r of rows) (by[r.disease] ||= []).push(r);
  const symbols = new Set();
  const diseases = Object.entries(by).map(([raw, rs]) => {
    const counts = {};
    rs.forEach((r) => r.symptoms.forEach((s) => { counts[s] = (counts[s] || 0) + 1; symbols.add(s); }));
    const symptoms = {};
    for (const [s, n] of Object.entries(counts)) symptoms[s] = Math.round(((n + 0.5) / (rs.length + 1)) * 1000) / 1000;
    const key = slug(raw);
    return { raw, id: DISEASE_IDS[key] || key, rows: rs.length, symptoms };
  });
  return { diseases, symbols: [...symbols].sort() };
}

const params = {
  unlisted: 0.02, minQuestions: 8, maxQuestions: 18, specificity: 0.5, relevance: 0.3, safetyMin: 0.05,
  noAsk: ['coma', 'altered_sensorium', 'acute_liver_failure', 'toxic_look_typhos'], // people can't report these about themselves
};
const toKb = (model) => ({
  SYMPTOMS: model.symbols.map((id) => ({ id, label: humanize(id) })),
  DISEASES: model.diseases.map((d) => ({ id: d.id, name: d.id, symptoms: d.symptoms })),
  RED_FLAGS, QUESTIONS: Object.fromEntries(model.symbols.map((id) => [id, questionFor(id)])), params,
});

/* ---------- evaluation on held-out rows ---------- */
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function evaluate(rows, omit) {
  const by = {};
  rows.forEach((r) => (by[r.disease] ||= []).push(r));
  const train = [], test = [];
  for (const rs of Object.values(by)) { shuffle(rs); const k = Math.floor(rs.length * 0.8); train.push(...rs.slice(0, k)); test.push(...rs.slice(k)); }
  const model = learn(train);
  const engine = createEngine(toKb(model));
  const idOf = Object.fromEntries(model.diseases.map((d) => [d.raw, d.id]));
  let t1 = 0, t3 = 0, q = 0;
  for (const r of test) {
    const all = r.symptoms;
    const reported = all.filter(() => rnd() >= omit); // patient forgets some true symptoms
    const have = new Set(reported.length ? reported : all);
    const ans = { yes: [[...have][Math.floor(rnd() * have.size)]], no: [], skip: [] };
    let out;
    for (let i = 0; i < 40; i++) {
      out = engine.next(ans);
      if (out.done) break;
      (have.has(out.question.id) ? ans.yes : ans.no).push(out.question.id);
    }
    q += out.answered;
    const want = idOf[r.disease];
    if (out.results[0]?.id === want) t1++;
    if (out.results.slice(0, 3).some((x) => x.id === want)) t3++;
  }
  const n = test.length;
  return { patients: n, top1: +(100 * t1 / n).toFixed(1), top3: +(100 * t3 / n).toFixed(1), avgQuestions: +(q / n).toFixed(1) };
}

/* ---------- run ---------- */
const { rows, file } = loadRows();
console.log(`Loaded ${rows.length} rows from ${file}`);
const holdout = evaluate(rows, 0);
const noisy = evaluate(rows, 0.2);
const model = learn(rows);

const desc = optionalMap(/symptom_description/i);
const prec = optionalMap(/symptom_precaution/i);
const out = {
  meta: {
    source: file, rows: rows.length, diseases: model.diseases.length, symptoms: model.symbols.length,
    trainedAt: new Date().toISOString(), params,
    holdout, holdoutWith20PercentSymptomsForgotten: noisy,
  },
  symptoms: model.symbols.map((id) => ({ id, label: humanize(id), question: questionFor(id) })),
  starters: STARTERS.filter((s) => model.symbols.includes(s)),
  redFlags: RED_FLAGS,
  diseases: model.diseases.map((d) => {
    const base = CONTENT[d.id];
    const fallback = {
      name: d.raw, severity: 2, specialist: 'General Physician',
      description: (desc[slug(d.raw)] || [])[0] || 'No description available for this condition.',
      treatment: ['Please consult a doctor for a confirmed diagnosis and treatment plan'],
      medications: ['Take only medicines prescribed by your doctor'], tests: [],
      precautions: prec[slug(d.raw)] || ['Consult a nearby hospital'], diet: [],
      seeDoctor: 'Please see a doctor for evaluation.',
    };
    return { id: d.id, ...(base || fallback), symptoms: d.symptoms, trainedOn: d.rows };
  }),
};
fs.writeFileSync(OUT, JSON.stringify(out));
const missing = out.diseases.filter((d) => !CONTENT[d.id]).map((d) => d.name);
console.log(`Diseases: ${out.meta.diseases}  Symptoms: ${out.meta.symptoms}`);
console.log('Held-out accuracy:', holdout);
console.log('With 20% of true symptoms forgotten:', noisy);
if (missing.length) console.log('No built-in care content (generic text used):', missing.join(', '));
console.log('Wrote', path.relative(process.cwd(), OUT));
