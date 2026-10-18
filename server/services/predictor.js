/**
 * Adaptive symptom interview engine (Bernoulli Naive Bayes + information gain).
 *
 * The server is stateless: the client sends every answer so far
 *   { yes: [...], no: [...], skip: [...] }
 * and gets back either the next best question to ask, or the final result.
 *
 * - posterior(): P(condition | answers) assuming a uniform prior.
 * - bestQuestion(): picks the unasked symptom that reduces uncertainty the most
 *   (expected entropy reduction), so each question is as useful as possible.
 * - Safety questions (chest pain, breathlessness) are always asked before finishing.
 *
 * createEngine(kb) works on any knowledge base, so the same code serves the
 * built-in knowledge and a model trained from a Kaggle dataset (see scripts/train.js).
 */
const knowledge = require('../data/knowledge');

const CONFIDENT = 0.85;    // stop early once the top condition reaches this
const MIN_GAIN = 0.02;     // bits; below this a question is not worth asking
const P_MIN = 0.01;
const P_MAX = 0.97;
const TOP_N = 5;

const entropy = (post) => -post.reduce((a, x) => (x > 0 ? a + x * Math.log2(x) : a), 0);

function createEngine(kb) {
  const { SYMPTOMS, DISEASES, RED_FLAGS, QUESTIONS } = kb;
  const UNLISTED = kb.params?.unlisted ?? 0.05;          // P(symptom | condition) never seen together
  const MIN_QUESTIONS = kb.params?.minQuestions ?? 5;    // never stop before this many answers
  const MAX_QUESTIONS = kb.params?.maxQuestions ?? 14;   // hard cap so the interview stays short
  const byId = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));
  const REL = kb.params?.relevance ?? 0;                 // bonus for asking symptoms the patient is likely to have
  const SAFETY_MIN = kb.params?.safetyMin ?? 0.05;       // only ask a safety question if it is plausible here
  const SAFETY = ['chest_pain', 'breathlessness'].filter((s) => byId[s]);
  // How "specific" each symptom is: symptoms shared by many diseases (fatigue, loss of appetite) score low
  const SPEC = kb.params?.specificity ?? 0;
  const df = Object.fromEntries(SYMPTOMS.map((s) => [s.id, DISEASES.filter((d) => d.symptoms[s.id] >= 0.2).length]));
  const idf = (id) => Math.log(DISEASES.length / Math.max(1, df[id])) / Math.log(DISEASES.length);
  const NO_ASK = new Set(kb.params?.noAsk || []);        // symptoms a person can't report themselves (e.g. coma)
  const pYesOf = (post, s) => DISEASES.reduce((a, d, i) => a + post[i] * prob(d, s), 0);
  const known = (id) => Object.prototype.hasOwnProperty.call(byId, id);
  const prob = (d, s) => Math.min(P_MAX, Math.max(P_MIN, d.symptoms[s] ?? UNLISTED));
  const lower = (t) => (/^[A-Z]{2,}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
  const questionText = (id) => (QUESTIONS && QUESTIONS[id]) || `Do you have ${lower(byId[id].label)}?`;

  function clean(a = {}) {
    const arr = (x) => [...new Set(Array.isArray(x) ? x.filter(known) : [])];
    const yes = arr(a.yes);
    const no = arr(a.no).filter((s) => !yes.includes(s));
    const skip = arr(a.skip).filter((s) => !yes.includes(s) && !no.includes(s));
    return { yes, no, skip };
  }

  function posterior(yes, no) {
    const logs = DISEASES.map((d) => {
      let l = 0;
      for (const s of yes) l += Math.log(prob(d, s));
      for (const s of no) l += Math.log(1 - prob(d, s));
      return l;
    });
    const max = Math.max(...logs);
    const e = logs.map((x) => Math.exp(x - max));
    const t = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / t);
  }

  function bestQuestion(post, asked) {
    const h0 = entropy(post);
    let best = null;
    for (const s of SYMPTOMS) {
      if (asked.has(s.id) || SAFETY.includes(s.id) || NO_ASK.has(s.id)) continue; // safety questions are asked separately
      let pYes = 0;
      DISEASES.forEach((d, i) => (pYes += post[i] * prob(d, s.id)));
      if (pYes < 0.001 || pYes > 0.999) continue;
      const yes = DISEASES.map((d, i) => (post[i] * prob(d, s.id)) / pYes);
      const no = DISEASES.map((d, i) => (post[i] * (1 - prob(d, s.id))) / (1 - pYes));
      const gain = h0 - (pYes * entropy(yes) + (1 - pYes) * entropy(no));
      const score = gain * Math.pow(Math.max(idf(s.id), 0.05), SPEC) + REL * pYes;
      if (!best || score > best.score) best = { id: s.id, gain, score };
    }
    return best;
  }

  function buildResult(yes, post) {
    const results = DISEASES.map((d, i) => ({ d, pr: post[i] }))
      .sort((a, b) => b.pr - a.pr)
      .filter((x) => x.pr >= 0.02)
      .slice(0, TOP_N)
      .map(({ d, pr }) => ({
        id: d.id,
        name: d.name,
        severity: d.severity,
        specialist: d.specialist,
        description: d.description,
        probability: Math.round(pr * 1000) / 10,
        matched: yes.filter((s) => d.symptoms[s]).map((s) => byId[s].label),
        missing: Object.entries(d.symptoms)
          .filter(([s, v]) => v >= 0.6 && !yes.includes(s))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([s]) => byId[s].label),
        tests: d.tests || [],
        treatment: d.treatment || [],
        medications: d.medications || [],
        precautions: d.precautions || [],
        diet: d.diet || [],
        seeDoctor: d.seeDoctor || 'Please see a doctor for evaluation.',
      }));

    const top = results[0]?.probability ?? 0;
    return {
      done: true,
      symptoms: yes.map((s) => byId[s].label),
      results,
      confidence: top >= 70 ? 'high' : top >= 45 ? 'moderate' : 'low',
      redFlags: RED_FLAGS.filter((f) => f.all.every((s) => yes.includes(s))).map((f) => f.message),
      disclaimer:
        'MediPredict AI gives general educational information and is not a medical diagnosis. Please consult a qualified doctor.',
    };
  }

  /** Core step: given answers so far, return the next question or the final result. */
  function next(answers, { finish = false } = {}) {
    const { yes, no, skip } = clean(answers);
    const asked = new Set([...yes, ...no, ...skip]);
    const answered = asked.size;
    const post = posterior(yes, no);
    const top = Math.max(...post);

    const stop = finish || answered >= MAX_QUESTIONS || (answered >= MIN_QUESTIONS && top >= CONFIDENT);
    let q = null;
    if (!stop) {
      q = bestQuestion(post, asked);
      if (!q || (q.gain < MIN_GAIN && answered >= MIN_QUESTIONS)) q = null;
    }
    if (!q && !finish) {
      // About to finish: ask a safety symptom only if it is plausible for this patient
      const unsafe = SAFETY.find((s) => !asked.has(s) && pYesOf(post, s) >= SAFETY_MIN);
      if (unsafe) return { done: false, question: { id: unsafe, text: questionText(unsafe), safety: true }, answered };
    }
    if (q) return { done: false, question: { id: q.id, text: questionText(q.id) }, answered };
    return { ...buildResult(yes, post), answered };
  }

  return { next, posterior, questionText };
}

module.exports = { createEngine, ...createEngine(knowledge) };
