const router = require('express').Router();
const { next } = require('../services/predictor');
const kb = require('../data/knowledge');
const Consultation = require('../models/Consultation');
const { dbReady } = require('../config/db');

router.get('/symptoms', (_req, res) =>
  res.json({
    all: kb.SYMPTOMS,
    starters: kb.STARTERS.map((id) => kb.SYMPTOMS.find((s) => s.id === id)).filter(Boolean),
  })
);

// Which knowledge base is active (useful to confirm the trained model is loaded)
router.get('/model', (_req, res) =>
  res.json({ source: kb.source, diseases: kb.DISEASES.length, symptoms: kb.SYMPTOMS.length, ...(kb.meta ? { rows: kb.meta.rows, trainedAt: kb.meta.trainedAt, holdout: kb.meta.holdout } : {}) })
);

// Stateless interview step: body = { yes: [], no: [], skip: [], finish?: bool }
router.post('/consult/next', async (req, res, next_) => {
  try {
    const { yes, no, skip, finish } = req.body || {};
    if (!Array.isArray(yes) || yes.length === 0)
      return res.status(400).json({ message: 'Choose at least one symptom to begin' });
    if ([yes, no, skip].some((a) => Array.isArray(a) && a.length > 60))
      return res.status(400).json({ message: 'Too many answers' });

    const out = next({ yes, no, skip }, { finish: Boolean(finish) });

    if (out.done && dbReady()) {
      Consultation.create({
        symptoms: yes.slice(0, 60), top: out.results[0]?.name,
        probability: out.results[0]?.probability, questions: out.answered,
      }).catch(() => {}); // storing stats must never break the user's result
    }
    res.json(out);
  } catch (e) {
    next_(e);
  }
});

// Anonymous usage stats (optional; empty if MongoDB isn't connected)
router.get('/stats', async (_req, res) => {
  if (!dbReady()) return res.json({ total: 0, top: [] });
  try {
    const [total, top] = await Promise.all([
      Consultation.countDocuments(),
      Consultation.aggregate([{ $group: { _id: '$top', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    ]);
    res.json({ total, top: top.map((t) => ({ name: t._id, count: t.n })) });
  } catch {
    res.json({ total: 0, top: [] });
  }
});

module.exports = router;
