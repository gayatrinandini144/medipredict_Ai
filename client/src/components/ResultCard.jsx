import { useState } from 'react';

const SEV = ['', 'Usually mild', 'Needs attention', 'Can be serious'];

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="detail-col">
      <h4>{title}</h4>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

/** Treatment, medicines, tests, prevention, diet and when to see a doctor. */
export function Details({ r }) {
  return (
    <>
      <div className="detail-grid">
        <List title="Medical treatment" items={r.treatment} />
        <List title="Medicines (confirm with a doctor)" items={r.medications} />
        <List title="Tests to ask about" items={r.tests} />
        <List title="Prevention" items={r.precautions} />
        <List title="Food and drink" items={r.diet} />
      </div>
      <p className="callout"><b>See a doctor if:</b> {r.seeDoctor}</p>
      <p className="muted">Consult: {r.specialist}</p>
    </>
  );
}

export default function ResultCard({ r }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="result">
      <button className="result-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="result-title">
          <strong>{r.name}</strong>
          <span className={`sev sev-${r.severity}`}>{SEV[r.severity]}</span>
        </div>
        <div className="bar" role="img" aria-label={`${r.probability} percent likelihood`}>
          <i style={{ width: `${Math.max(r.probability, 2)}%` }} />
        </div>
        <span className="pct">{r.probability}%</span>
      </button>
      {open && (
        <div className="result-body">
          <p>{r.description}</p>
          {r.matched?.length > 0 && <p className="muted"><b>Matches your answers:</b> {r.matched.join(', ')}.</p>}
          <Details r={r} />
        </div>
      )}
    </article>
  );
}
