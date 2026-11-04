import { useEffect, useState } from 'react';
import { actions, inputError, wordCount, type Action } from './actions';
import { LocalWriter, type Writer } from './inference';
import { checkGPU, models } from './models';
import { ChangeReview } from './ChangeReview';
import { missingTerms } from './prompts';
import { useWriter } from './useWriter';
export default function App({ writer: supplied, gpuCheck = checkGPU }: { writer?: Writer; gpuCheck?: () => Promise<boolean> }) {
  const [writer] = useState(() => supplied ?? new LocalWriter());
  const session = useWriter(writer);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [model, setModel] = useState<string>(models[0].id);
  const [cached, setCached] = useState<string>('Checking cache…');
  const [text, setText] = useState('');
  const [action, setAction] = useState<Action>('grammar');
  const [terms, setTerms] = useState('');
  const [instruction, setInstruction] = useState('');
  const [requestSource, setRequestSource] = useState('');
  const [resultAction, setResultAction] = useState<Action>('grammar');
  const [requestTerms, setRequestTerms] = useState('');
  const [feedback, setFeedback] = useState('');
  const [previous, setPrevious] = useState<string | null>(null);
  const busy = session.status === 'loading' || session.status === 'writing';
  const selected = models.find(item => item.id === model)!;
  useEffect(() => { let alive = true; gpuCheck().then(value => { if (alive) setSupported(value); }, () => { if (alive) setSupported(false); }); return () => { alive = false; }; }, [gpuCheck]);
  useEffect(() => { let alive = true; setCached('Checking cache…'); writer.cached(model).then(value => { if (alive) setCached(value ? 'Weights cached. Offline availability depends on all runtime files being cached.' : 'Model not cached. First load needs internet.'); }, () => { if (alive) setCached('Cache unavailable. Check browser storage permissions.'); }); return () => { alive = false; }; }, [writer, model, session.status]);
  function run() { const error = inputError(text); setFeedback(error ?? ''); if (!error) { setRequestSource(text); setResultAction(action); setRequestTerms(terms); void session.run({ text, action, terms, instruction }); } }
  async function copy() { try { await navigator.clipboard.writeText(session.output); setFeedback('Copied.'); } catch { setFeedback('Clipboard access failed. Select the result and copy it manually.'); } }
  return <main>
    <header><a className="brand" href="./">◈ Local Writer</a><span className="badge">On-device AI</span></header>
    <section className="intro"><p className="eyebrow">YOUR WORDS, A LITTLE CLEARER</p><h1>Find the right words.</h1><p>Polish a message, untangle your notes, or get to the point. Your writing stays in this browser.</p></section>
    <section className="model-panel" aria-label="Model setup">
      <div><label htmlFor="model">Writing model</label><select id="model" value={model} disabled={busy} onChange={event => { session.stop(''); setModel(event.target.value); }}>
        {models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select><p>{selected.download} + runtime files · {selected.memory}</p><p className="muted">{cached}</p></div>
      <div className="model-controls"><button disabled={!supported || busy || session.status === 'ready'} onClick={() => void session.load(model)}>{session.status === 'ready' ? 'Model ready' : 'Download / load model'}</button><button className="secondary" disabled={busy} onClick={() => void session.remove(model)}>Remove model cache</button></div>
      {supported === false && <p role="alert">WebGPU is unavailable. Use a recent desktop browser with hardware acceleration, on HTTPS or localhost.</p>}
      {supported === null && <p>Checking device support…</p>}
      {session.status === 'loading' && <div className="loading"><progress max={1} value={session.progress.value} aria-label="Model loading"/><p role="status">{session.progress.message}</p></div>}
    </section>
    <div className="actions" role="group" aria-label="Writing actions">{(Object.keys(actions) as Action[]).map(key => <button key={key} className="action" aria-pressed={key === action} disabled={busy} onClick={() => setAction(key)}>{actions[key].label}</button>)}</div>
    <details className="preferences"><summary>Make it yours <span>· optional</span></summary><div className="preference-fields"><div><label htmlFor="terms">Protected terms</label><input id="terms" value={terms} disabled={busy} maxLength={300} onChange={event => setTerms(event.target.value)} placeholder="PostgreSQL, Acme, API"/><small>Comma-separated. We flag terms missing from the result.</small></div><div><label htmlFor="instruction">Custom instruction</label><input id="instruction" value={instruction} disabled={busy} maxLength={300} onChange={event => setInstruction(event.target.value)} placeholder="Be polite but direct. Keep it under 100 words."/><small>Preferences guide the model; review the result.</small></div></div></details>
    {session.output && !busy && missingTerms(requestSource, session.output, requestTerms).length > 0 && <p role="alert">Review missing protected terms: {missingTerms(requestSource, session.output, requestTerms).join(', ')}</p>}
    <section className="editors" aria-label="Writing workspace">
      <div className="editor"><div className="editor-heading"><label htmlFor="source">Your text</label><span>{wordCount(text)} / 500 words</span></div><textarea id="source" value={text} disabled={busy} onChange={event => setText(event.target.value)} placeholder="Paste that rough draft here…"/><div className="editor-footer"><button className="secondary" disabled={busy} onClick={() => { setText(''); session.setOutput(''); setPrevious(null); setFeedback(''); }}>Clear</button>{previous !== null && <button className="secondary" disabled={busy} onClick={() => { setText(previous); setPrevious(null); }}>Undo input change</button>}</div></div>
      <div className="editor"><div className="editor-heading"><label htmlFor="result">Your result</label><span>{session.status === 'writing' ? 'Writing…' : 'Review before using'}</span></div><textarea id="result" value={session.output} disabled={busy} onChange={event => session.setOutput(event.target.value)} placeholder="A clearer version will appear here."/><div className="editor-footer"><button className="secondary" disabled={busy || !session.output} onClick={copy}>Copy result</button><button className="secondary" disabled={busy || !session.output} onClick={() => { setPrevious(text); setText(session.output); session.setOutput(''); }}>Use as input</button></div></div>
    </section>
    {session.output && !busy && resultAction === 'grammar' && <ChangeReview source={requestSource} result={session.output} />}
    <div className="run-bar"><p>Check names, numbers, dates, and meaning.</p>{busy ? <button onClick={() => session.stop()}>Stop</button> : <button disabled={session.status !== 'ready' || Boolean(inputError(text))} onClick={run}>{actions[action].label} →</button>}</div>
    {inputError(text) && text.length > 0 && <p role="alert">{inputError(text)}</p>}
    {(session.error || feedback) && <p role="status">{session.error || feedback}</p>}
    {session.notice && <p role="status">{session.notice}</p>}
    <footer>Local processing. No account. No saved writing history. Model downloads contact Hugging Face and the runtime host.</footer>
  </main>;
}
