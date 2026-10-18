import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { Details } from '../components/ResultCard';

export default function Diseases() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/diseases', { params: { q } }).then((r) => setList(r.data)).catch((e) => setError(errMsg(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const view = async (id) => {
    try { setDetail((await api.get(`/diseases/${id}`)).data); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <>
      <section className="hero compact"><h1>Conditions</h1><p>Browse every condition MediPredict AI knows about.</p></section>
      <input className="input" type="search" placeholder="Search conditions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conditions" />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="cards">
        {list.map((d) => (
          <button key={d.id} className="card" onClick={() => view(d.id)}>
            <strong>{d.name}</strong>
            <span className="muted">{d.description}</span>
            <span className="muted small-text">{d.specialist}</span>
          </button>
        ))}
        {list.length === 0 && !error && <p className="muted">No condition matches “{q}”.</p>}
      </div>
      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <div className="modal-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="btn ghost close" onClick={() => setDetail(null)}>Close</button>
            <h2>{detail.name}</h2>
            <p>{detail.description}</p>
            <Details r={{ ...detail, tests: detail.tests || [] }} />
          </div>
        </div>
      )}
    </>
  );
}
