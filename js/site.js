(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // background-clip text doesn't paint through transformed children, so move
    // gradient classes from the wrapper onto each animated piece
    const takeGradient = el => {
        const cls = ['grad-text', 'shine-text'].filter(c => el.classList.contains(c));
        cls.forEach(c => el.classList.remove(c));
        return cls.join(' ');
    };

    // Split hero heading into animated characters
    document.querySelectorAll('[data-split]').forEach(el => {
        const base = parseInt(el.dataset.base || '0', 10);
        let i = 0;
        const walk = (node, inherit = '') => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const word = document.createElement('span');
                        word.className = 'word';
                        [...part].forEach(ch => {
                            const c = document.createElement('span');
                            c.className = ('char ' + inherit).trim();
                            c.textContent = ch;
                            c.style.setProperty('--i', i++);
                            c.style.setProperty('--base', base + 'ms');
                            word.appendChild(c);
                        });
                        frag.appendChild(word);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    walk(child, takeGradient(child) || inherit);
                }
            });
        };
        walk(el);
        el.classList.add('split');
    });

    // Split section headings into words that rise into view
    document.querySelectorAll('[data-words]').forEach(el => {
        let i = 0;
        const walk = (node, inherit = '') => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const wrap = document.createElement('span');
                        wrap.className = 'words-wrap';
                        const w = document.createElement('span');
                        w.className = ('w ' + inherit).trim();
                        w.textContent = part;
                        w.style.setProperty('--i', i++);
                        wrap.appendChild(w);
                        frag.appendChild(wrap);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    walk(child, takeGradient(child) || inherit);
                }
            });
        };
        walk(el);
        el.classList.add('words');
    });

    // Scroll reveal
    const revealer = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            e.target.classList.add('in');
            revealer.unobserve(e.target);
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.querySelectorAll('.reveal, .words, .tl-item').forEach(el => revealer.observe(el));

    // Stagger children of [data-stagger]
    document.querySelectorAll('[data-stagger]').forEach(group => {
        const step = parseFloat(group.dataset.stagger) || 0.08;
        [...group.children].forEach((c, i) => c.style.setProperty('--d', (i * step).toFixed(2) + 's'));
    });

    // Count-up stats
    const counter = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const el = e.target;
            const target = parseInt(el.dataset.count, 10);
            const dur = 1600;
            const t0 = performance.now();
            const tick = now => {
                const p = Math.min((now - t0) / dur, 1);
                el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
                if (p < 1) requestAnimationFrame(tick);
            };
            reduced ? (el.textContent = target) : requestAnimationFrame(tick);
            counter.unobserve(el);
        });
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-count]').forEach(el => counter.observe(el));

    // Rotating typewriter
    const typer = document.getElementById('typer');
    if (typer) {
        const words = JSON.parse(typer.dataset.words);
        let w = 0, ch = 0, deleting = false;
        const loop = () => {
            const word = words[w];
            ch += deleting ? -1 : 1;
            typer.textContent = word.slice(0, ch);
            let delay = deleting ? 35 : 70;
            if (!deleting && ch === word.length) { deleting = true; delay = 1800; }
            else if (deleting && ch === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
            setTimeout(loop, delay);
        };
        reduced ? (typer.textContent = words[0]) : setTimeout(loop, 1400);
    }

    // Hero terminal
    const term = document.getElementById('term');
    if (term) {
        const lines = [
            ['p', '$ ', 'w', 'whoami'],
            ['', 'sebastian · lead software engineer'],
            ['p', '$ ', 'w', 'go run ./cmd/ingest'],
            ['ok', '✓ ', '', 'mqtt broker connected'],
            ['ok', '✓ ', '', 'ocpp 1.6j listening :9000'],
            ['ok', '✓ ', '', 'telemetry pipeline ready'],
        ];
        const render = (count, partial) => {
            term.innerHTML = '';
            lines.slice(0, count).forEach((l, idx) => {
                const row = document.createElement('div');
                for (let k = 0; k < l.length; k += 2) {
                    const s = document.createElement('span');
                    if (l[k]) s.className = l[k];
                    let txt = l[k + 1];
                    if (idx === count - 1 && partial !== undefined && k === l.length - 2) txt = txt.slice(0, partial);
                    s.textContent = txt;
                    row.appendChild(s);
                }
                term.appendChild(row);
            });
        };
        let line = 0, pos = 0;
        const step = () => {
            if (line >= lines.length) { setTimeout(() => { line = 0; pos = 0; step(); }, 3500); return; }
            const l = lines[line];
            const typed = l[0] === 'p';
            const full = l[l.length - 1].length;
            if (typed && pos < full) { pos++; render(line + 1, pos); setTimeout(step, 55); return; }
            render(line + 1);
            line++; pos = 0;
            setTimeout(step, typed ? 350 : 260);
        };
        reduced ? render(lines.length) : setTimeout(step, 1600);
    }

    // Live log in the NexThings architecture card
    const log = document.getElementById('arch-log');
    if (log && !reduced) {
        const devices = ['evse-014', 'bms-221', 'sensor-07', 'bms-118', 'evse-003', 'gw-02'];
        const events = [
            ['ok', 'PUB telemetry/soc 87.2%'],
            ['', 'MeterValues 11.4kWh'],
            ['ok', 'PUB telemetry/temp 31.6°C'],
            ['', 'Heartbeat ok'],
            ['ok', 'WS → dashboard 4 clients'],
            ['', 'StatusNotification Available'],
        ];
        const push = () => {
            const [cls, msg] = events[Math.floor(Math.random() * events.length)];
            const dev = devices[Math.floor(Math.random() * devices.length)];
            const row = document.createElement('div');
            const ts = new Date().toISOString().slice(11, 19);
            row.innerHTML = `<span>${ts}</span> <span class="${cls}">${dev}</span> ${msg}`;
            log.appendChild(row);
            while (log.children.length > 3) log.firstElementChild.remove();
        };
        push(); push();
        setInterval(push, 1400);
    }

    // Header state, scroll progress, timeline progress
    const header = document.getElementById('header');
    const progress = document.querySelector('.progress');
    const tlLine = document.querySelector('.timeline-line span');
    const timeline = document.querySelector('.timeline');
    let ticking = false;
    const onScroll = () => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - innerHeight;
        header.classList.toggle('scrolled', y > 40);
        progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        if (tlLine && timeline) {
            const r = timeline.getBoundingClientRect();
            const p = Math.min(Math.max((innerHeight * 0.65 - r.top) / r.height, 0), 1);
            tlLine.style.transform = `scaleY(${p})`;
        }
        ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();

    // Active nav link
    const navLinks = document.querySelectorAll('.nav a[href^="#"]');
    document.querySelectorAll('section[id]').forEach(s => {
        new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' }).observe(s);
    });

    // Mobile menu
    const menu = document.getElementById('mobile-menu');
    const openMenu = () => { menu.classList.add('open'); document.body.style.overflow = 'hidden'; };
    const closeMenu = () => { menu.classList.remove('open'); document.body.style.overflow = ''; };
    document.getElementById('menu-toggle').addEventListener('click', openMenu);
    document.getElementById('menu-close').addEventListener('click', closeMenu);
    menu.querySelectorAll('a').forEach((a, i) => {
        a.style.transitionDelay = (0.15 + i * 0.05) + 's';
        a.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    // Touch devices: colour photos as they pass through the middle of the screen
    if (!finePointer) {
        const lighter = new IntersectionObserver(entries => {
            entries.forEach(e => e.target.classList.toggle('lit', e.isIntersecting));
        }, { rootMargin: '-35% 0px -35% 0px' });
        document.querySelectorAll('.photo').forEach(p => lighter.observe(p));
    }

    if (!finePointer || reduced) return;

    // Pointer-driven effects (desktop only)
    document.body.classList.add('has-pointer');
    const glow = document.querySelector('.cursor-glow');
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    const follow = () => {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        glow.style.transform = `translate(${gx - 300}px, ${gy - 300}px)`;
        requestAnimationFrame(follow);
    };
    follow();

    // Card spotlight
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('pointermove', e => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    });

    // 3D tilt
    document.querySelectorAll('[data-tilt]').forEach(el => {
        const max = parseFloat(el.dataset.tilt) || 6;
        el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    // Magnetic buttons
    document.querySelectorAll('[data-magnetic]').forEach(el => {
        el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect();
            const x = e.clientX - r.left - r.width / 2;
            const y = e.clientY - r.top - r.height / 2;
            el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    // Hero parallax
    const orbs = document.querySelectorAll('.orb');
    const visual = document.querySelector('.hero-visual');
    window.addEventListener('pointermove', e => {
        const x = e.clientX / innerWidth - 0.5;
        const y = e.clientY / innerHeight - 0.5;
        orbs.forEach((o, i) => { o.style.transform = `translate(${x * (i + 1) * 30}px, ${y * (i + 1) * 30}px)`; });
        if (visual) visual.style.transform = `translate(${x * -14}px, ${y * -14}px)`;
    }, { passive: true });
})();
