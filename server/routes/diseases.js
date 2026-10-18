const router = require('express').Router();
const { DISEASES } = require('../data/knowledge');

router.get('/', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const list = DISEASES.filter((d) => !q || d.name.toLowerCase().includes(q)).map((d) => ({
    id: d.id, name: d.name, severity: d.severity, specialist: d.specialist, description: d.description,
  }));
  res.json(list);
});

router.get('/:id', (req, res) => {
  const d = DISEASES.find((x) => x.id === req.params.id);
  if (!d) return res.status(404).json({ message: 'Condition not found' });
  const { symptoms, ...rest } = d;
  res.json(rest);
});

module.exports = router;
