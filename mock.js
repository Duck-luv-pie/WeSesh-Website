// Interactive VS Code mockup in the hero showcase.
(() => {
  const stage = document.querySelector('.mock-stage');
  if (!stage) return;
  const win = stage.querySelector('.win');
  const tip = stage.querySelector('.tip');
  const W = 1000, H = 600;

  // Scale the fixed-size window to fit the frame.
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const s = Math.min((r.width * 0.92) / W, (r.height * 0.9) / H);
    win.style.transform = `scale(${s})`;
  };
  new ResizeObserver(fit).observe(stage);
  fit();

  // Single-select groups.
  const single = (sel, onPick) => {
    const items = win.querySelectorAll(sel);
    items.forEach(i => i.addEventListener('click', () => {
      items.forEach(x => x.classList.toggle('on', x === i));
      onPick && onPick(i);
    }));
  };
  single('.tab', t => win.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.dataset.view === t.dataset.view)));
  single('.pt');
  single('.tl');

  // Sidebar sections collapse/expand.
  win.querySelectorAll('.sec-t').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open')));

  // Keep every working card's border light in phase: pin all orbit animations to the same start time.
  const syncLights = () => requestAnimationFrame(() => {
    document.getAnimations().filter(a => a.animationName === 'orbit' || a.animationName === 'avspin').forEach(a => { a.startTime = 0; });
  });
  syncLights();

  // Cards stay scrolled to their newest entry, like the extension.
  const pin = () => win.querySelectorAll('.screen').forEach(el => { el.scrollTop = el.scrollHeight; });
  pin();

  // Friend prompts, on a loop: a message chip flies from one person's card into the other's, the
  // receiving card lights up in the sender's colour, the prompt types itself in, and that agent starts on it.
  // When your Codex is the one prompted, VS Code's notification updates (it stays on screen).
  const view = win.querySelector('.view.agents'), flight = view.querySelector('.flight');
  const people = {
    alex: { card: win.querySelector('#card-alex'), color: '#4d8fe0', initial: 'A', agent: 'Claude Code', verb: 'Thinking' },
    sam: { card: win.querySelector('#card-sam'), color: '#c58ad6', initial: 'S', agent: 'Codex', verb: 'Working' },
  };
  const script = [
    { from: 'alex', to: 'sam', text: 'add a test for the Retry-After header' },
    { from: 'sam', to: 'alex', text: 'also log every 429 so we can spot abuse' },
    { from: 'alex', to: 'sam', text: 'run the full suite once my change merges' },
    { from: 'sam', to: 'alex', text: 'add the new limits to the README' },
  ];
  const local = el => { let x = 0, y = 0, n = el; while (n && n !== view) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const fly = (from, to, text, done) => {
    const a = local(from.card.querySelector('.dotav')), b = local(to.card.querySelector('.cin'));
    const p0 = { x: a.x + 3, y: a.y + 3 }, p2 = { x: b.x + b.w * 0.45, y: b.y - 8 };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 70 };
    flight.style.setProperty('--c', from.color);
    const flyer = document.createElement('div');
    flyer.className = 'flyer';
    flyer.innerHTML = `<span class="fav">${from.initial}</span>${esc(text)}`;
    flight.appendChild(flyer);
    const fw = flyer.offsetWidth, fh = flyer.offsetHeight, dur = 1500, t0 = performance.now();
    let lastSpark = 0;
    from.card.classList.add('launch');
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = ease(t), u = 1 - k;
      const x = u * u * p0.x + 2 * u * k * p1.x + k * k * p2.x;
      const y = u * u * p0.y + 2 * u * k * p1.y + k * k * p2.y;
      const scale = t < .15 ? .4 + t / .15 * .6 : t > .85 ? 1 - (t - .85) / .15 * .45 : 1;
      flyer.style.transform = `translate(${x - fw / 2}px, ${y - fh / 2}px) scale(${scale})`;
      flyer.style.opacity = t > .9 ? (1 - t) / .1 : 1;
      if (now - lastSpark > 14) {
        lastSpark = now;
        const sp = document.createElement('span');
        sp.className = 'spark';
        sp.style.left = (x + (Math.random() - .5) * 6) + 'px';
        sp.style.top = (y + (Math.random() - .5) * 6) + 'px';
        sp.addEventListener('animationend', () => sp.remove());
        flight.appendChild(sp);
      }
      if (t < 1) requestAnimationFrame(step);
      else { flyer.remove(); from.card.classList.remove('launch'); done(); }
    };
    requestAnimationFrame(step);
  };

  const typeIn = (el, text, done) => {
    let i = 0;
    el.classList.add('typing');
    const tick = setInterval(() => {
      el.textContent = text.slice(0, ++i); pin();
      if (i >= text.length) { clearInterval(tick); el.classList.remove('typing'); done(); }
    }, 28);
  };

  const markWorking = name => {
    const p = people[name];
    if (p.card.classList.contains('working')) return;
    p.card.classList.add('working');
    p.card.querySelector('[data-state]')?.remove();
    if (name === 'sam') {
      win.querySelector('[data-sam-av]').classList.add('working');
      win.querySelector('[data-sam-desc]').innerHTML = 'editor &middot; online &middot; agent working';
    }
    win.querySelector('[data-sum]').textContent = '2 working';
    win.querySelector('[data-status]').textContent = '2 working';
    syncLights();
  };

  // Append the incoming prompt to the receiving card; the previous turn wraps up as "Brewed for Ns".
  const receive = (fromName, toName, text) => {
    const from = people[fromName], to = people[toName], screen = to.card.querySelector('.screen');
    const prev = screen.querySelector('.live');
    if (prev) {
      const brew = document.createElement('p');
      brew.className = 'e brew';
      brew.textContent = `Brewed for ${prev.querySelector('[data-timer]').dataset.timer}s`;
      prev.replaceWith(brew);
    }
    const entry = document.createElement('p');
    entry.className = 'e user friend fresh';
    entry.style.setProperty('--c', from.color);
    entry.innerHTML = `<span class="from"><i>${from.initial}</i>${fromName}</span>(${fromName} via WeSesh asks) <span></span>`;
    screen.appendChild(entry);
    // Keep each card short: drop the oldest transcript lines.
    const lines = screen.querySelectorAll(':scope > .e, :scope > .notice');
    for (let i = 0; i < lines.length - 7; i++) lines[i].remove();
    to.card.style.setProperty('--c', from.color);
    to.card.classList.remove('ping'); void to.card.offsetWidth; to.card.classList.add('ping');
    setTimeout(() => to.card.classList.remove('ping'), 1700);
    markWorking(toName);
    if (toName === 'sam') {
      const toast = win.querySelector('[data-toast]');
      toast.querySelector('[data-toast-text]').innerHTML = `<b>${fromName}</b> prompted your ${to.agent}: ${esc(text)}`;
      toast.classList.add('show');
      toast.classList.remove('bump'); void toast.offsetWidth; toast.classList.add('bump');
    }
    pin();
    typeIn(entry.lastElementChild, text, () => {
      const live = document.createElement('p');
      live.className = 'live';
      live.innerHTML = `<span class="star">&#10043;</span> ${to.verb}&hellip; <span class="dim">(<span data-timer="0">0</span>s)</span>`;
      screen.appendChild(live);
      pin();
    });
  };

  let turn = 0;
  const loop = () => {
    // Wait while another tab is open or the page is hidden.
    if (!view.classList.contains('on') || document.hidden) return setTimeout(loop, 1500);
    const { from, to, text } = script[turn++ % script.length];
    fly(people[from], people[to], text, () => {
      receive(from, to, text);
      setTimeout(loop, 4500);
    });
  };
  new IntersectionObserver((entries, obs) => {
    if (entries.some(e => e.isIntersecting)) { obs.disconnect(); setTimeout(loop, 1500); }
  }, { threshold: 0.5 }).observe(win);

  // Live-ticking "working" timers.
  setInterval(() => {
    win.querySelectorAll('[data-timer]').forEach(el => {
      el.dataset.timer = +el.dataset.timer + 1;
      const t = +el.dataset.timer;
      el.textContent = t >= 60 ? `${Math.floor(t / 60)}m ${t % 60}` : t;
    });
  }, 1000);

  // Tooltips: describe the innermost hovered element.
  let current = null;
  win.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.classList.remove('show'); current = null; return; }
    if (el !== current) { tip.textContent = el.dataset.tip; current = el; }
    const sr = stage.getBoundingClientRect();
    let x = e.clientX - sr.left + 14;
    let y = e.clientY - sr.top + 18;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > sr.width - 8) x = e.clientX - sr.left - tw - 14;
    if (y + th > sr.height - 8) y = e.clientY - sr.top - th - 14;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.add('show');
  });
  win.addEventListener('mouseleave', () => { tip.classList.remove('show'); current = null; });
})();
