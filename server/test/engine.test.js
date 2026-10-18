const assert = require('assert');
const kb = require('../data/knowledge');
const { next } = require('../services/predictor');

console.log('Knowledge base:', kb.source, `(${kb.DISEASES.length} diseases, ${kb.SYMPTOMS.length} symptoms)`);
const has = (id) => kb.SYMPTOMS.some((s) => s.id === id);
assert.ok(kb.DISEASES.length >= 14);

// 1. Starts by asking a question, never returns a result after one symptom
const first = next({ yes: ['high_fever'] });
assert.strictEqual(first.done, false);
assert.ok(first.question.text.endsWith('?'));

// 2. Never repeats a question, and always ends
const ans = { yes: ['high_fever'], no: [], skip: [] };
const seen = new Set(['high_fever']);
let out;
for (let i = 0; i < 40; i++) {
  out = next(ans);
  if (out.done) break;
  assert.ok(!seen.has(out.question.id), 'repeated ' + out.question.id);
  seen.add(out.question.id);
  ans.no.push(out.question.id);
}
assert.ok(out.done, 'interview must end');
assert.ok(out.answered <= 22, 'interview too long: ' + out.answered);

// 3. Every symptom has a readable question; every disease has full care content
kb.SYMPTOMS.forEach((s) => assert.ok(kb.QUESTIONS[s.id] && kb.QUESTIONS[s.id].endsWith('?'), 'bad question for ' + s.id));
kb.DISEASES.forEach((d) => {
  ['treatment', 'medications', 'precautions', 'seeDoctor', 'description'].forEach((f) => assert.ok(d[f] && d[f].length, `${d.id} missing ${f}`));
});

// 4. A classic dengue picture is identified
const dengue = ['high_fever', 'headache', 'joint_pain', 'eye_pain', 'rash', 'muscle_pain', 'nausea', 'vomiting', 'fatigue'].filter(has);
let r = next({ yes: dengue, no: ['cough'].filter(has), skip: [] }, { finish: true });
assert.strictEqual(r.results[0].id, 'dengue');
assert.ok(r.results[0].tests.length && r.results[0].precautions.length);

// 5. Red flags
r = next({ yes: ['chest_pain', 'breathlessness'], no: [], skip: [] }, { finish: true });
assert.ok(r.redFlags.length > 0);

// 6. Garbage input is ignored
assert.strictEqual(next({ yes: ['high_fever', 'bogus'], no: 'x' }).done, false);
console.log('All engine tests passed');
