// Live collaboration demo: two people's editors showing the same file. Both people type at the
// same time on different lines; every keystroke appears in both editors, each in its author's colour.
(() => {
  const root = document.querySelector('.feature-visual.collab');
  if (!root) return;

  const people = {
    alex: { color: '#4d8fe0', pane: root.querySelector('[data-pane="alex"] .ed-code') },
    sam: { color: '#c58ad6', pane: root.querySelector('[data-pane="sam"] .ed-code') },
  };
  const names = Object.keys(people);
  const sync = root.querySelector('.sync');

  const start = [
    'async function upload(req, res) {',
    '  const file = req.file;',
    '  const url = await store(file);',
    '  res.json({ url });',
    '}',
  ];
  // Each round, both people insert a line after a given anchor line and type it at the same time.
  const rounds = [
    { alex: { after: '  const file = req.file;', text: '  if (!file) return fail(res);' },
      sam: { after: '  const url = await store(file);', text: "  log.info('saved', url);" } },
    { alex: { after: "  log.info('saved', url);", text: '  await notify(req.user);' },
      sam: { after: 'async function upload(req, res) {', text: '  const t0 = Date.now();' } },
  ];

  // Lines are objects so cursors stay attached to the right line while the other person inserts above it.
  let lines, cursors, typing;
  const reset = () => {
    lines = start.map(t => ({ t }));
    cursors = { alex: { line: lines[1], col: lines[1].t.length }, sam: { line: lines[3], col: lines[3].t.length } };
    typing = {};
  };

  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const highlight = t => esc(t)
    .replace(/('[^']*'?)/g, '<span class="s">$1</span>')
    .replace(/\b(async|function|const|await|if|return)\b/g, '<span class="k">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="m">$1</span>')
    .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="f">$1</span>');

  const cursorHtml = (who, me) => {
    const local = who === me;
    // Like the extension, a remote name only floats while that person is typing.
    const tag = !local && typing[who] ? `<b>${who}</b>` : '';
    return `<span class="ed-cur ${local ? 'local' : 'remote'}" style="--c:${people[who].color}">${tag}</span>`;
  };

  const render = () => {
    for (const me of names) {
      people[me].pane.innerHTML = lines.map((line, i) => {
        // Place every cursor on this line, right to left so earlier columns stay valid.
        const here = names.filter(n => cursors[n].line === line).sort((a, b) => cursors[b].col - cursors[a].col);
        let html = '', rest = line.t;
        for (const n of here) { html = cursorHtml(n, me) + highlight(rest.slice(cursors[n].col)) + html; rest = rest.slice(0, cursors[n].col); }
        html = highlight(rest) + html;
        const author = names.find(n => n !== me && typing[n] === line);
        const attr = author ? ` class="ln remote-edit" style="--c:${people[author].color}"` : ' class="ln"';
        return `<span${attr}><span class="no">${i + 1}</span>${html || ' '}</span>`;
      }).join('');
    }
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const visible = () => !document.hidden && root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight;

  const type = async (who, line, text, speed) => {
    typing[who] = line;
    cursors[who] = { line, col: 0 };
    for (let i = 1; i <= text.length; i++) {
      line.t = text.slice(0, i);
      cursors[who].col = i;
      render();
      await wait(text[i - 1] === ' ' ? speed * 0.6 : speed + Math.random() * 25);
    }
    await wait(500);
    typing[who] = null; render();
  };

  const run = async () => {
    for (;;) {
      reset(); render();
      await wait(900);
      for (const round of rounds) {
        while (!visible()) await wait(500);
        // Both insert their new line, then type in parallel.
        const jobs = names.map((who, k) => {
          const { after, text } = round[who];
          const anchor = lines.find(l => l.t === after);
          const line = { t: '' };
          lines.splice(lines.indexOf(anchor) + 1, 0, line);
          return () => wait(k * 250).then(() => type(who, line, text, k ? 52 : 44));
        });
        sync.classList.add('pulse', 'both');
        await Promise.all(jobs.map(j => j()));
        sync.classList.remove('pulse', 'both');
        await wait(1200);
      }
      await wait(2200);
    }
  };

  reset(); render();
  new IntersectionObserver((entries, obs) => {
    if (entries.some(e => e.isIntersecting)) { obs.disconnect(); run(); }
  }, { threshold: 0.4 }).observe(root);
})();

// How it works: a guided demo. Each step acts out the real flow in a VS Code window (and Slack for the
// invite), with a big pointer and a highlight ring on whatever is about to be clicked.
(() => {
  const section = document.querySelector('.how');
  if (!section) return;
  const steps = [...section.querySelectorAll('.how-step')];
  const stage = section.querySelector('.how-stage');
  const hw = stage.querySelector('.hw'), who = hw.querySelector('.hw-who');
  const side = hw.querySelector('.hw-side'), ed = hw.querySelector('.hw-ed');
  const status = hw.querySelector('.sb-wesesh');
  const toast = hw.querySelector('.hw-toast'), overlay = hw.querySelector('.hw-overlay');
  const pointer = stage.querySelector('.pointer');
  const DUR = [8000, 13500, 9500];

  let run = 0; // bumps on every jump, cancelling the previous timeline
  const wait = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === run ? res() : rej('cancel')), ms));
  const offscreen = () => document.hidden || stage.getBoundingClientRect().bottom < 0 || stage.getBoundingClientRect().top > innerHeight;

  const code = ['<span class="k">export async function</span> <span class="f">upload</span>(<span class="v">req</span>, <span class="v">res</span>) {',
    '  <span class="k">const</span> <span class="v">file</span> = req.file;',
    '  <span class="k">const</span> <span class="v">url</span> = <span class="k">await</span> <span class="f">store</span>(file);',
    '  res.<span class="f">json</span>({ url });', '}'];
  const codeHtml = `<div class="code-dim">${code.map((l, i) => `<span><span class="no">${i + 1}</span>${l}</span>`).join('')}</div>`;
  const row = (icon, label, desc, extra = '') => `<div class="hw-row ${extra}">${icon}${label}${desc ? ` <em>${desc}</em>` : ''}</div>`;
  const av = (l, c) => `<span class="av" style="--c:${c}">${l}</span>`;
  const welcome = `<div class="hw-h">WeSesh<span>&middot;&middot;&middot;</span></div><div class="hw-sec">Session</div>
    <div class="hw-welcome">Code together. Bring your own agent.</div>
    <span class="hw-btn" data-start>Start a session</span>
    <span class="hw-btn" data-join>Join with an invitation</span>
    <span class="hw-btn">Configure your agents</span>
    <div class="hw-small">New here? <a>Try the demo</a></div>`;
  const vsIcon = '<svg viewBox="0 0 24 24"><path d="M17 3 8 11.5 4 8.5 2.5 9.5v5L4 15.5l4-3L17 21l4.5-2V5z"/></svg>';

  // Pointer: positioned so its tip lands on the element (plus an offset).
  const tipAt = (el, dx = 0, dy = 0, instant = false) => {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (instant) { pointer.style.transition = 'none'; }
    pointer.style.transform = `translate(${r.left - s.left + r.width / 2 + dx}px, ${r.top - s.top + r.height / 2 + dy}px)`;
    if (instant) { void pointer.offsetWidth; pointer.style.transition = ''; }
  };
  // Move to a target, ring it so it's obvious, then click.
  const clickOn = async (el, id, dx = 0, dy = 0) => {
    tipAt(el, dx, dy); await wait(950, id);
    el.classList.add('target'); await wait(700, id);
    pointer.classList.remove('click'); void pointer.offsetWidth; pointer.classList.add('click');
    el.classList.add('press'); await wait(200, id);
    el.classList.remove('press', 'target');
  };
  const showToast = (html, src = 'WeSesh') => { toast.innerHTML = `<div class="tm"><span>${html}</span></div><div class="src">Source: ${src}</div>`; toast.classList.add('show'); };
  const clear = () => { toast.classList.remove('show'); overlay.innerHTML = ''; status.textContent = ''; };

  const scenes = [
    // 1. Start a session (alex)
    async id => {
      who.innerHTML = '<b>acme-app</b> &mdash; alex';
      side.innerHTML = welcome; ed.innerHTML = codeHtml;
      status.innerHTML = '((&middot;)) WeSesh';
      tipAt(ed, 40, 40, true);
      await wait(700, id);
      await clickOn(side.querySelector('[data-start]'), id, 8, 2);
      await wait(250, id);
      side.innerHTML = `<div class="hw-h">WeSesh<span>&middot;&middot;&middot;</span></div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '1/4 participants', 'fresh')}
        ${row(av('A', '#4d8fe0'), 'alex (you)', 'host &middot; online', 'fresh')}
        <div class="hw-sec">Agents</div>
        ${row('<span class="hw-dot"></span>', 'Claude Code', 'Connected', 'fresh')}`;
      status.innerHTML = '((&middot;)) WeSesh &middot; 1/4'; status.classList.remove('fresh'); void status.offsetWidth; status.classList.add('fresh');
      showToast('Session started. <b>Invitation link copied</b> to your clipboard. Send it to your crew.');
      tipAt(ed, 50, 30);
    },
    // 2. Invite your crew: the link arrives in Slack, sam opens it in VS Code
    async id => {
      who.innerHTML = '<b>acme-app</b> &mdash; sam';
      side.innerHTML = welcome; ed.innerHTML = ''; status.innerHTML = '((&middot;)) WeSesh';
      overlay.innerHTML = `<div class="slack">
        <div class="slack-top"><span class="lights"><i></i><i></i><i></i></span><span class="slack-search">Search acme</span></div>
        <div class="slack-body">
          <div class="slack-side"><div class="ws">acme</div>
            <div class="grp">Channels</div>
            <div class="ch"># general</div><div class="ch on"># dev</div><div class="ch"># random</div>
            <div class="grp">Direct messages</div>
            <div class="ch bold"><span class="sq" style="--c:#4d8fe0">A</span>alex</div>
            <div class="ch"><span class="sq" style="--c:#e0a15a">J</span>jordan</div></div>
          <div class="slack-main">
            <div class="slack-ch"># dev</div>
            <div class="slack-msgs">
              <div class="smsg"><span class="sav" style="--c:#e0a15a">J</span><div><div class="sn">jordan<time>2:12 PM</time></div>upload limits today?</div></div>
              <div class="smsg"><span class="sav" style="--c:#4d8fe0">A</span><div><div class="sn">alex<time>2:14 PM</time></div>yep, jump in, bring your agent<br /><a data-link>wesesh.com/join/acme-app</a>
                <div class="unfurl"><b>Join alex's WeSesh session</b><span>acme-app &middot; opens in VS Code or Cursor</span></div></div></div>
            </div>
            <div class="slack-compose">Message #dev</div>
          </div>
        </div></div>`;
      tipAt(overlay, 60, 90, true);
      await wait(1100, id);
      await clickOn(overlay.querySelector('[data-link]'), id, -20, 2);
      await wait(250, id);
      overlay.innerHTML = `<div class="dim"></div><div class="modal"><span class="mi">${vsIcon}</span><div><h4>Join alex's WeSesh session?</h4>alex invited you to edit <b style="color:#fff">acme-app</b> together.</div>
        <div class="btns"><span>Cancel</span><span class="primary" data-join>Join</span></div></div>`;
      await wait(500, id);
      await clickOn(overlay.querySelector('[data-join]'), id);
      await wait(250, id);
      overlay.innerHTML = `<div class="qp"><div class="qp-in">Where should acme-app go?</div>
        <div class="qp-o" data-clone>Use my existing clone <em>~/code/acme-app</em></div>
        <div class="qp-o">Pick an empty folder <em>fresh copy</em></div></div>`;
      const clone = overlay.querySelector('[data-clone]');
      await wait(400, id);
      clone.classList.add('hl');
      await clickOn(clone, id, -50);
      await wait(250, id);
      overlay.innerHTML = '';
      side.innerHTML = `<div class="hw-h">WeSesh<span>&middot;&middot;&middot;</span></div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '2/4 participants', 'fresh')}
        ${row(av('A', '#4d8fe0'), 'alex', 'host &middot; online', 'fresh')}
        ${row(av('S', '#c58ad6'), 'sam (you)', 'editor &middot; online', 'fresh')}
        <div class="hw-sec">Agents</div>
        ${row('<span class="hw-dot"></span>', 'Codex', 'Connected', 'fresh')}`;
      ed.innerHTML = codeHtml;
      status.innerHTML = '((&middot;)) WeSesh &middot; 2/4'; status.classList.remove('fresh'); void status.offsetWidth; status.classList.add('fresh');
      showToast("Joined <b>alex</b>'s session. Your files match the room.");
      tipAt(ed, 50, 30);
    },
    // 3. Build together
    async id => {
      who.innerHTML = '<b>acme-app</b> &mdash; sam';
      status.innerHTML = '((&middot;)) WeSesh &middot; 3/4 &middot; 2 working';
      side.innerHTML = `<div class="hw-h">WeSesh<span>&middot;&middot;&middot;</span></div><div class="hw-sec">Session</div>
        ${row('<span class="ic">((&middot;))</span>', 'Session active', '3/4 participants')}
        ${row(av('A', '#4d8fe0'), 'alex', 'host &middot; agent working')}
        ${row(av('S', '#c58ad6'), 'sam (you)', 'editor &middot; agent working')}
        ${row(av('J', '#e0a15a'), 'jordan', 'editor &middot; online', 'fresh')}
        <div class="hw-sec">Room Board</div>
        ${row('<span class="ic">&#9635;</span>', 'View agents', '2 working')}
        ${row('<span class="ic">&#9889;</span>', 'Auto-merge: On', 'finished work merges right away')}`;
      ed.innerHTML = `<div class="mini-card" style="--c:#4d8fe0"><div class="mt"><i></i>alex &middot; Claude Code</div><div class="mb"><span class="or">&#10043; Thinking&hellip;</span> rate limiting /api/upload</div></div>
        <div class="mini-card" style="--c:#c58ad6" data-mine><div class="mt"><i></i>sam (you) &middot; Codex</div><div class="mb">Ready for a prompt</div></div>`;
      tipAt(ed, 60, 60, true);
      await wait(1500, id);
      const mine = ed.querySelector('[data-mine] .mb');
      mine.innerHTML = `<span class="ask" style="--c:#4d8fe0">(alex via WeSesh asks) add tests for the limiter</span>`;
      showToast('<b>alex</b> prompted your Codex: add tests for the limiter');
      await wait(2200, id);
      mine.insertAdjacentHTML('beforeend', '<div>&#10043; Working&hellip;</div>');
      await wait(1800, id);
      ed.insertAdjacentHTML('beforeend', '<div class="merge-line">&#10003; Auto-merged alex\'s change &rarr; rateLimit.ts</div>');
      await wait(900, id);
      ed.insertAdjacentHTML('beforeend', '<div class="merge-line">&#10003; Auto-merged your tests &rarr; rateLimit.test.ts</div>');
    },
  ];

  const go = async n => {
    const id = ++run;
    steps.forEach((s, i) => { s.classList.toggle('on', i === n); s.style.setProperty('--dur', DUR[i] + 'ms'); });
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
