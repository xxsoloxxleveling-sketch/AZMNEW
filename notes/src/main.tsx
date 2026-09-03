import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './zoom.css';

type Collection = { id: string; title: string; classes: string; pages: number; description: string; colour: string };

const collections: Collection[] = [
  { id: 'class67', title: 'Session 5 Question Bank', classes: 'Classes 6 & 7', pages: 57, description: 'Practice MCQs arranged for Session 5 preparation.', colour: '#0d7b69' },
  { id: 'class89', title: 'Session 5 Question Bank', classes: 'Classes 8 & 9', pages: 125, description: 'A complete MCQ practice bank for middle-school learners.', colour: '#245ca8' },
  { id: 'class10', title: 'Session 5 Question Bank', classes: 'Class 10', pages: 62, description: 'Focused MCQ practice for Class 10 students.', colour: '#9a5c10' },
  { id: 'college', title: 'Session 5 MCQ Notes', classes: '1st & 2nd Year', pages: 92, description: 'Correct-sequence MCQ notes for college-level preparation.', colour: '#7a3aa0' },
];

const pagePath = (collection: Collection, page: number) => `/library/${collection.id}/page-${String(page).padStart(String(collection.pages).length, '0')}.jpg`;

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.3);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState('');
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pageFrame = useRef<HTMLElement | null>(null);
  const selected = useMemo(() => collections.find((item) => item.id === selectedId) ?? null, [selectedId]);
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3800); };

  useEffect(() => {
    const stopContextMenu = (event: MouseEvent) => { event.preventDefault(); showNotice('Right-click is disabled in AZM Study Notes.'); };
    const stopShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['p', 's'].includes(event.key.toLowerCase())) {
        event.preventDefault(); showNotice(event.key.toLowerCase() === 'p' ? 'These notes are available to read online only.' : 'Saving and downloading are not provided.');
      }
    };
    document.addEventListener('contextmenu', stopContextMenu); document.addEventListener('keydown', stopShortcuts);
    return () => { document.removeEventListener('contextmenu', stopContextMenu); document.removeEventListener('keydown', stopShortcuts); };
  }, []);

  const resetView = () => { setZoom(1.3); setPan({ x: 0, y: 0 }); };
  const openCollection = (id: string) => { setSelectedId(id); setPage(1); resetView(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const changePage = (nextPage: number) => { setPage(nextPage); resetView(); };
  const changeZoom = (amount: number) => {
    setZoom((value) => Math.max(1, Math.min(2.2, Math.round((value + amount) * 10) / 10)));
    setPan({ x: 0, y: 0 });
  };
  const constrainPan = (x: number, y: number) => {
    const frame = pageFrame.current;
    if (!frame) return { x, y };
    const maxX = (frame.clientWidth * (zoom - 1)) / 2;
    const maxY = (frame.clientHeight * (zoom - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPage = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setPan(constrainPan(dragStart.current.panX + event.clientX - dragStart.current.x, dragStart.current.panY + event.clientY - dragStart.current.y));
  };
  const endDrag = () => { dragStart.current = null; };

  if (selected) return <div className="app-shell viewer-shell">
    <header className="topbar"><button className="brand back" onClick={() => setSelectedId(null)}>← <span>AZM</span> Study Notes</button><p>Free educational material · Session 5</p></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <main className="viewer-main">
      <div className="reader-top"><div><p className="eyebrow">{selected.classes}</p><h1>{selected.title}</h1></div><div className="reader-actions"><button disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page} of {selected.pages}</span><button disabled={page === selected.pages} onClick={() => changePage(page + 1)}>Next</button></div></div>
      <aside className="free-banner"><strong>NOT FOR SALE</strong><span>These notes are free of cost. If anyone charges you for these AZM notes, AZM will take strict action.</span></aside>
      <div className="zoom-toolbar" aria-label="Reader zoom controls"><span>Zoom {Math.round(zoom * 100)}%</span><button disabled={zoom <= 1} onClick={() => changeZoom(-0.1)} aria-label="Zoom out">−</button><button disabled={zoom >= 2.2} onClick={() => changeZoom(0.1)} aria-label="Zoom in">+</button><button onClick={resetView}>Reset view</button><small>Drag the page to read different areas</small></div>
      <section ref={pageFrame} className={`page-frame ${zoom > 1 ? 'is-zoomed' : ''}`} style={{ '--collection-colour': selected.colour } as React.CSSProperties} onPointerDown={beginDrag} onPointerMove={dragPage} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="page-canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}><img src={pagePath(selected, page)} alt={`${selected.classes} study notes, page ${page}`} draggable={false} /></div>
        <div className="page-watermark" aria-hidden="true">AZM · NOT FOR SALE · FREE OF COST</div>
      </section>
      <div className="page-jump"><label htmlFor="page-number">Go to page</label><input id="page-number" type="number" min="1" max={selected.pages} value={page} onChange={(event) => changePage(Math.max(1, Math.min(selected.pages, Number(event.target.value) || 1)))} /><span>of {selected.pages}</span></div>
      <p className="orders">By order of our Director General and Chairperson, Sir Sumama.</p>
    </main>
  </div>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="https://azmaio.com"><span>AZM</span> Study Notes</a><p>Session 5 · 2026</p></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <main>
      <section className="hero"><p className="eyebrow">AZM.AIO educational initiative</p><h1>Notes can be accessed here.</h1><p className="hero-copy">Free Session 5 notes and question banks for AZM students. Choose your class below and start studying online.</p><div className="declaration"><strong>Notes for this session are free of cost.</strong><span>Not for sale. If anyone charges for these notes, AZM will take strict action.</span></div><p className="orders">By order of our Director General and Chairperson, Sir Sumama.</p></section>
      <section className="catalogue" aria-labelledby="notes-heading"><div className="catalogue-heading"><div><p className="eyebrow">Study material</p><h2 id="notes-heading">Choose your class</h2></div><p>Read online · No payment required</p></div><div className="cards">{collections.map((collection) => <article className="note-card" key={collection.id} style={{ '--collection-colour': collection.colour } as React.CSSProperties}><div className="card-top"><span>{collection.classes}</span><span>{collection.pages} pages</span></div><h3>{collection.title}</h3><p>{collection.description}</p><button onClick={() => openCollection(collection.id)}>Access notes <span>→</span></button><small>Free of cost · Not for sale</small></article>)}</div></section>
      <section className="action-notice"><strong>Important notice</strong><p>AZM provides these notes free for students’ personal study. Do not buy, sell, or charge anyone for access to this material. Please report anyone who attempts to charge for AZM notes.</p></section>
    </main>
    <footer>© {new Date().getFullYear()} AZM.AIO · Free educational material · By order of our Director General and Chairperson, Sir Sumama.</footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
