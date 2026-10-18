import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';
import ResultCard, { Details } from '../components/ResultCard';

const ANSWERS = { yes: 'Yes', no: 'No', skip: 'Not sure' };

// Rebuild the full answer set from the first symptom + the chat log (so "Undo" is trivial)
const derive = (start, log) => ({
  yes: [start, ...log.filter((l) => l.a === 'yes').map((l) => l.id)],
  no: log.filter((l) => l.a === 'no').map((l) => l.id),
  skip: log.filter((l) => l.a === 'skip').map((l) => l.id),
});

export default function Consult() {
  const [symptoms, setSymptoms] = useState({ all: [], starters: [] });
  const [stats, setStats] = useState(null);
  const [model, setModel] = useState(null);
  const [q, setQ] = useState('');
  const [start, setStart] = useState(null);   // first symptom id
  const [log, setLog] = useState([]);         // [{id, text, a}]
  const [question, setQuestion] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addQ, setAddQ] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const load = () => {
    setError('');
    api.get('/symptoms').then((r) => setSymptoms(r.data)).catch((e) => setError(errMsg(e)));
    api.get('/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/model').then((r) => setModel(r.data)).catch(() => {});
  };
  useEffect(load, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [log, question, result]);

  const label = (id) => symptoms.all.find((s) => s.id === id)?.label || id;

  const ask = async (s, l, finish = false) => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/consult/next', { ...derive(s, l), finish });
      if (data.done) { setResult(data); setQuestion(null); } else { setQuestion(data.question); setResult(null); }
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const begin = (id) => { setStart(id); setLog([]); ask(id, []); };
  const answer = (a) => {
    const next = [...log, { ...question, a }];
    setLog(next); setQuestion(null); ask(start, next);
  };
  const undo = () => {
    const next = log.slice(0, -1);
    setLog(next); setResult(null); ask(start, next);
  };
  const known = () => { const a = derive(start, log); return new Set([...a.yes, ...a.no, ...a.skip]); };
  const addSymptom = (id) => {
    const next = [...log, { id, text: label(id), a: 'yes', added: true }];
    setLog(next); setQuestion(null); setResult(null); setAdding(false); setAddQ(''); ask(start, next);
  };
  const forgot = () => { setResult(null); setQuestion(null); setAdding(true); };
  const reset = () => { setStart(null); setLog([]); setQuestion(null); setResult(null); setQ(''); setError(''); setAdding(false); setAddQ(''); };

  const matches = q.trim()
    ? symptoms.all.filter((s) => s.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];

  /* ---------- Start screen ---------- */
  if (!start) {
    return (
      <section className="start">
        <h1>What’s bothering you most?</h1>
        <p className="lead">Pick one symptom. I’ll ask a few short questions, like a doctor would, then suggest likely conditions with treatment and prevention.</p>

        {error && (
          <div className="alert" role="alert">
            {error} <button className="btn ghost" onClick={load}>Try again</button>
          </div>
        )}

        <div className="chips big">
          {symptoms.starters.map((s) => (
            <button key={s.id} className="chip" onClick={() => begin(s.id)}>{s.label}</button>
          ))}
        </div>

        <label className="field">Something else? Search all symptoms
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. joint pain, dizziness, rash" />
        </label>
        {matches.length > 0 && (
          <div className="chips">{matches.map((s) => <button key={s.id} className="chip on" onClick={() => begin(s.id)}>{s.label}</button>)}</div>
        )}
        {q.trim() && matches.length === 0 && <p className="muted">No symptom matches “{q}”. Try a simpler word.</p>}

        {model && (
          <p className="muted small-text">
            {model.rows
              ? `Learned from ${model.rows.toLocaleString()} patient records across ${model.diseases} conditions and ${model.symptoms} symptoms.`
              : `Built-in knowledge base: ${model.diseases} conditions.`}
          </p>
        )}
        {stats?.total > 0 && <p className="muted small-text">{stats.total.toLocaleString()} checkups completed so far.</p>}
      </section>
    );
  }

  /* ---------- Result ---------- */
  if (result) {
    const top = result.results[0];
    const conf = { high: 'High confidence', moderate: 'Moderate confidence', low: 'Low confidence — see a doctor to confirm' }[result.confidence];
    return (
      <section className="results">
        <h1>Your results</h1>
        {result.redFlags.map((m) => <div key={m} className="alert" role="alert"><b>Urgent:</b> {m}</div>)}
        {top ? (
          <div className="panel top">
            <p className="muted">Most likely · {conf}</p>
            <h2>{top.name} <span className="pct-inline">{top.probability}%</span></h2>
            <p>{top.description}</p>
            <p className="muted small-text">Based on: {result.symptoms.join(', ')}</p>
            <Details r={top} />
          </div>
        ) : <p>No clear match found. Please see a doctor.</p>}

        {result.results.length > 1 && <h2>Other possibilities</h2>}
        {result.results.slice(1).map((r) => <ResultCard key={r.id} r={r} />)}
        <p className="disclaimer">{result.disclaimer}</p>
        <div className="row">
          <button className="btn" onClick={reset}>Start a new checkup</button>
          <button className="btn ghost" onClick={forgot}>I forgot a symptom</button>
          <button className="btn ghost" onClick={undo}>Go back one question</button>
          <button className="btn ghost" onClick={() => window.print()}>Print report</button>
        </div>
      </section>
    );
  }

  /* ---------- Chat ---------- */
  return (
    <section className="chat" aria-live="polite">
      <div className="bubble bot">Okay. Let’s go through this together. Answer as best you can.</div>
      <div className="bubble me">{label(start)}</div>
      {log.map((l, i) => (
        l.added ? (
          <div key={i} className="bubble me">Also: {l.text}</div>
        ) : (
          <div key={i}>
            <div className="bubble bot">{l.text}</div>
            <div className="bubble me">{ANSWERS[l.a]}</div>
          </div>
        )
      ))}

      {question && (
        <div className="bubble bot current">
          <p>{question.text}</p>
          {question.safety && <p className="muted small-text">Quick safety check.</p>}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => answer('yes')}>Yes</button>
            <button className="btn ghost" disabled={busy} onClick={() => answer('no')}>No</button>
            <button className="btn ghost" disabled={busy} onClick={() => answer('skip')}>Not sure</button>
          </div>
        </div>
      )}
      {busy && !question && <div className="bubble bot muted">Thinking…</div>}
      {error && (
        <div className="alert" role="alert">
          {error}{' '}
          <button className="btn ghost" onClick={() => ask(start, log)}>Try again</button>
        </div>
      )}

      {adding && (
        <div className="panel add">
          <label className="field">Which other symptom do you have?
            <input className="input" type="search" autoFocus value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder="Type to search, e.g. chest pain" />
          </label>
          <div className="chips">
            {symptoms.all
              .filter((x) => !known().has(x.id) && (!addQ.trim() || x.label.toLowerCase().includes(addQ.trim().toLowerCase())))
              .slice(0, 10)
              .map((x) => <button key={x.id} className="chip" onClick={() => addSymptom(x.id)}>{x.label}</button>)}
          </div>
          <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}

      <div className="toolbar">
        <span className="muted small-text">{log.length + 1} answered</span>
        <button className="btn ghost" disabled={busy} onClick={() => setAdding(!adding)}>+ Add a symptom</button>
        <button className="btn ghost" disabled={busy || log.length === 0} onClick={undo}>Undo</button>
        <button className="btn ghost" disabled={busy || log.length < 2} onClick={() => ask(start, log, true)}>Show results now</button>
        <button className="btn ghost" onClick={reset}>Start over</button>
      </div>
      <div ref={endRef} />
    </section>
  );
}
