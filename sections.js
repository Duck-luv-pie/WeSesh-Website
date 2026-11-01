// Live collaboration demo: two people's editors showing the same file. Whoever types, the
// same characters appear in both editors at once, with the typist's cursor and name in the other.
(() => {
  const root = document.querySelector('.feature-visual.collab');
  if (!root) return;

  const people = {
    alex: { color: '#4d8fe0', pane: root.querySelector('[data-pane="alex"] .ed-code') },
    sam: { color: '#c58ad6', pane: root.querySelector('[data-pane="sam"] .ed-code') },
  };
  const sync = root.querySelector('.sync');

  const start = [
    'async function upload(req, res) {',
    '  const file = req.file;',
    '  const url = await store(file);',
    '  res.json({ url });',
    '}',
  ];
  // Each step: who types, which line index the new line goes at, and what they type.
  const steps = [
    { who: 'alex', at: 2, text: '  if (!file) return fail(res);' },
    { who: 'sam', at: 4, text: "  log.info('saved', url);" },
    { who: 'alex', at: 5, text: '  await notify(req.user);' },
  ];

  let lines, cursors, flash;
  const reset = () => {
    lines = [...start];
    cursors = { alex: { line: 1, col: lines[1].length }, sam: { line: 3, col: lines[3].length } };
    flash = null;
  };

  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const highlight = t => esc(t)
    .replace(/('[^']*'?)/g, '<span class="s">$1</span>')
    .replace(/\b(async|function|const|await|if|return)\b/g, '<span class="k">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="m">$1</span>')
    .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="f">$1</span>');

  // Insert a cursor marker into a line at a column, keeping highlighting intact.
  const withCursor = (text, col, cls, who) => {
    const before = highlight(text.slice(0, col)), after = highlight(text.slice(col));
    // Like the extension, the name only floats over a remote cursor while that person is typing.
    const tag = cls === 'remote' && flash && flash.who === who ? `<b>${who}</b>` : '';
    return `${before}<span class="ed-cur ${cls}" style="--c:${people[who].color}">${tag}</span>${after}`;
  };

  const render = () => {
    for (const me of Object.keys(people)) {
      const other = me === 'alex' ? 'sam' : 'alex';
      people[me].pane.innerHTML = lines.map((text, i) => {
        let html;
        if (cursors[me].line === i) html = withCursor(text, cursors[me].col, 'local', me);
        else if (cursors[other].line === i) html = withCursor(text, cursors[other].col, 'remote', other);
        else html = highlight(text);
        // Highlight the line the other person is editing, in their colour.
        const remote = flash && flash.line === i && flash.who !== me;
        return `<span class="ln${remote ? ' remote-edit' : ''}"${remote ? ` style="--c:${people[flash.who].color}"` : ''}><span class="no">${i + 1}</span>${html || ' '}</span>`;
      }).join('');
    }
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const visible = () => !document.hidden && root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight;

  const run = async () => {
    for (;;) {
      reset(); render();
      await wait(900);
      for (const step of steps) {
        while (!visible()) await wait(500);
        const { who, at, text } = step;
        // Shift the other cursor down if a line is inserted above it.
        const other = who === 'alex' ? 'sam' : 'alex';
        if (cursors[other].line >= at) cursors[other].line++;
        lines.splice(at, 0, '');
        cursors[who] = { line: at, col: 0 };
        flash = { line: at, who };
        sync.style.setProperty('--c', people[who].color);
        sync.classList.add('pulse');
        for (let i = 1; i <= text.length; i++) {
          lines[at] = text.slice(0, i);
          cursors[who].col = i;
          render();
          await wait(text[i - 1] === ' ' ? 30 : 45);
        }
        sync.classList.remove('pulse');
        await wait(700);
        flash = null; render();
        await wait(900);
      }
      await wait(2200);
    }
  };

  reset(); render();
  new IntersectionObserver((entries, obs) => {
    if (entries.some(e => e.isIntersecting)) { obs.disconnect(); run(); }
  }, { threshold: 0.4 }).observe(root);
})();

// How it works: a guided demo. Each step acts out the real flow in a small VS Code window,
// with a pointer that clicks through it. Steps auto-advance; clicking a step jumps to it.
(() => {
  const section = document.querySelector('.how');
  if (!section) return;
  const steps = [...section.querySelectorAll('.how-step')];
  const stage = section.querySelector('.how-stage');
  const hw = stage.querySelector('.hw'), who = hw.querySelector('.hw-who');
  const side = hw.querySelector('.hw-side'), main = hw.querySelector('.hw-main');
  const toast = hw.querySelector('.hw-toast'), overlay = hw.querySelector('.hw-overlay');
  const pointer = stage.querySelector('.pointer');
  const DUR = [7000, 11000, 9500];

  let run = 0; // bumps on every jump, cancelling the previous timeline
  const wait = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === run ? res() : rej('cancel')), ms));
  const offscreen = () => document.hidden || stage.getBoundingClientRect().bottom < 0 || stage.getBoundingClientRect().top > innerHeight;

  const code = `<div class="code-dim"><span><span class="k">export async function</span> <span class="f">upload</span>(req, res) {</span><span>  <span class="k">const</span> file = req.file;</span><span>  <span class="k">const</span> url = <span class="k">await</span> <span class="f">store</span>(file);</span><span>  res.<span class="f">json</span>({ url });</span><span>}</span></div>`;
  const row = (icon, label, desc, extra = '') => `<div class="hw-row ${extra}">${icon}${label}${desc ? ` <em>${desc}</em>` : ''}</div>`;
  const av = (l, c) => `<span class="av" style="--c:${c}">${l}</span>`;

  // Move the pointer to the centre of an element (or a point inside the stage), then optionally click.
  const pointAt = (el, dx = 0, dy = 0) => {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    pointer.style.transform = `translate(${r.left - s.left + r.width / 2 + dx}px, ${r.top - s.top + r.height / 2 + dy}px)`;
  };
  const click = async (el, id) => {
    pointer.classList.remove('click'); void pointer.offsetWidth; pointer.classList.add('click');
    el.classList.add('press'); await wait(180, id); el.classList.remove('press');
  };
  const showToast = html => { toast.innerHTML = html; toast.classList.add('show'); };
  const clear = () => { toast.classList.remove('show'); overlay.innerHTML = ''; };

  const scenes = [
    // 1. Start a session (alex)
    async id => {
      who.innerHTML = '<b>alex</b> &middot; acme-app';
      side.innerHTML = `<div class="hw-h">WeSesh</div><div class="hw-sec">Session</div>
        <div class="hw-welcome">Code together. Bring your own agent.</div>
        <span class="hw-btn" data-go>Start a session</span>
        <span class="hw-btn ghost">Join with an invitation</span>
        <span class="hw-btn ghost">Configure your agents</span>`;
      main.innerHTML = code;
      pointer.style.transition = 'none'; pointAt(main, 40, 60); void pointer.offsetWidth; pointer.style.transition = '';
      await wait(900, id);
      const go = side.querySelector('[data-go]');
      pointAt(go, 10, 4); await wait(1100, id);
      await click(go, id); await wait(350, id);
      side.innerHTML = `<div class="hw-h">WeSesh</div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '1/4 participants', 'fresh')}
        ${row(av('A', '#4d8fe0'), 'alex (you)', 'host &middot; online', 'fresh')}
        <div class="hw-sec">Agents</div>
        ${row('<span class="hw-dot"></span>', 'Claude Code', 'Connected', 'fresh')}`;
      showToast('Session started. <b>Invitation link copied</b> to your clipboard.');
      pointAt(main, 30, 70);
    },
    // 2. Invite your crew (sam opens the link)
    async id => {
      who.innerHTML = '<b>sam</b> &middot; acme-app';
      side.innerHTML = `<div class="hw-h">WeSesh</div><div class="hw-sec">Session</div><div class="hw-welcome">Code together. Bring your own agent.</div>
        <span class="hw-btn ghost">Start a session</span><span class="hw-btn ghost">Join with an invitation</span>`;
      main.innerHTML = '';
      overlay.innerHTML = `<div class="chat"><div class="chat-top"><span class="av">A</span>alex</div>
        <div class="bubble">join my sesh, bring codex</div>
        <div class="bubble"><a data-link>vscode://wesesh/join?room=acme-app</a></div></div>`;
      pointer.style.transition = 'none'; pointAt(hw, 120, 90); void pointer.offsetWidth; pointer.style.transition = '';
      await wait(1000, id);
      const link = overlay.querySelector('[data-link]');
      pointAt(link, -30, 2); await wait(1100, id);
      await click(link, id); await wait(300, id);
      overlay.innerHTML = `<div class="modal"><h4>Join alex's session?</h4>alex invited you to edit <b style="color:#fff">acme-app</b> together.
        <div class="btns"><span>Cancel</span><span class="primary" data-join>Join</span></div></div>`;
      const join = overlay.querySelector('[data-join]');
      await wait(500, id); pointAt(join); await wait(1000, id);
      await click(join, id); await wait(300, id);
      overlay.innerHTML = `<div class="qp"><div class="qp-t">Where should acme-app go?</div>
        <div class="qp-o" data-clone>Use my existing clone <em>~/code/acme-app</em></div>
        <div class="qp-o">Pick an empty folder <em>fresh copy</em></div></div>`;
      const clone = overlay.querySelector('[data-clone]');
      await wait(400, id); pointAt(clone, -40); await wait(900, id);
      clone.classList.add('hl'); await click(clone, id); await wait(350, id);
      overlay.innerHTML = '';
      side.innerHTML = `<div class="hw-h">WeSesh</div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '2/4 participants', 'fresh')}
        ${row(av('A', '#4d8fe0'), 'alex', 'host &middot; online', 'fresh')}
        ${row(av('S', '#c58ad6'), 'sam (you)', 'editor &middot; online', 'fresh')}
        <div class="hw-sec">Agents</div>
        ${row('<span class="hw-dot"></span>', 'Codex', 'Connected', 'fresh')}`;
      main.innerHTML = code;
      showToast('Joined <b>alex</b>\'s session. Your files match the room.');
      pointAt(main, 30, 70);
    },
    // 3. Build together
    async id => {
      who.innerHTML = '<b>sam</b> &middot; acme-app';
      side.innerHTML = `<div class="hw-h">WeSesh</div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '3/4 participants')}
        ${row(av('A', '#4d8fe0'), 'alex', 'host &middot; agent working')}
        ${row(av('S', '#c58ad6'), 'sam (you)', 'editor &middot; agent working')}
        ${row(av('J', '#e0a15a'), 'jordan', 'editor &middot; online', 'fresh')}
        <div class="hw-sec">Room Board</div>
        ${row('<span class="ic">&#9635;</span>', 'View agents', '2 working')}
        ${row('<span class="ic">&#9889;</span>', 'Auto-merge: On', '')}`;
      main.innerHTML = `<div class="mini-card" style="--c:#4d8fe0"><div class="mt"><i></i>alex &middot; Claude Code</div><div class="mb"><span class="or">&#10043; Thinking&hellip;</span> rate limiting /api/upload</div></div>
        <div class="mini-card" style="--c:#c58ad6" data-mine><div class="mt"><i></i>sam (you) &middot; Codex</div><div class="mb">Ready for a prompt</div></div>`;
      pointer.style.transition = 'none'; pointAt(main, 60, 90); void pointer.offsetWidth; pointer.style.transition = '';
      await wait(1600, id);
      const mine = main.querySelector('[data-mine] .mb');
      mine.innerHTML = `<span class="ask" style="--c:#4d8fe0">(alex via WeSesh asks) add tests for the limiter</span>`;
      showToast('<b>alex</b> prompted your Codex: add tests for the limiter');
      await wait(2200, id);
      mine.insertAdjacentHTML('beforeend', '<div>&#10043; Working&hellip;</div>');
      await wait(1800, id);
      main.insertAdjacentHTML('beforeend', '<div class="merge-line">&#10003; Auto-merged alex\'s change &rarr; rateLimit.ts</div>');
      await wait(900, id);
      main.insertAdjacentHTML('beforeend', '<div class="merge-line">&#10003; Auto-merged your tests &rarr; rateLimit.test.ts</div>');
    },
  ];

  const go = async n => {
    const id = ++run;
    steps.forEach((s, i) => { s.classList.toggle('on', i === n); s.style.setProperty('--dur', DUR[i] + 'ms'); });
    // Restart the progress bar animation.
    const bar = steps[n].querySelector('.hs-bar i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    clear();
    const t0 = Date.now();
    try {
      await scenes[n](id);
      await wait(Math.max(800, DUR[n] - (Date.now() - t0)), id);
      while (offscreen()) await wait(600, id);
      go((n + 1) % steps.length);
    } catch { /* cancelled by a jump */ }
  };

  steps.forEach((s, i) => s.querySelector('button').addEventListener('click', () => go(i)));
  new IntersectionObserver((entries, obs) => {
    if (entries.some(e => e.isIntersecting)) { obs.disconnect(); go(0); }
  }, { threshold: 0.35 }).observe(stage);
})();
