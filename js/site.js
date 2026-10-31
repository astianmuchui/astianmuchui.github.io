(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const $ = (s, root = document) => root.querySelector(s);
    const $$ = (s, root = document) => [...root.querySelectorAll(s)];
    const preloader = $('#preloader');
    let lenis = null;

    // --- Mobile menu ------------------------------------------------------
    const menu = $('#mobile-menu');
    const openMenu = () => { menu.classList.add('open'); lenis ? lenis.stop() : (document.body.style.overflow = 'hidden'); };
    const closeMenu = () => { menu.classList.remove('open'); lenis ? lenis.start() : (document.body.style.overflow = ''); };
    $('#menu-toggle').addEventListener('click', openMenu);
    $('#menu-close').addEventListener('click', closeMenu);
    $$('a', menu).forEach((a, i) => { a.style.transitionDelay = (0.15 + i * 0.05) + 's'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

    // Touch devices: colour photos as they pass through the middle of the screen
    if (!finePointer) {
        const lighter = new IntersectionObserver(entries => {
            entries.forEach(e => e.target.classList.toggle('lit', e.isIntersecting));
        }, { rootMargin: '-35% 0px -35% 0px' });
        const tunnelHandlesOwn = window.gsap && !reduced;
        $$(tunnelHandlesOwn ? '.photo:not(.t-item)' : '.photo').forEach(p => lighter.observe(p));
    }

    if (!window.gsap || !window.ScrollTrigger || reduced) {
        preloader?.remove();
        return;
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    // --- Smooth scroll ----------------------------------------------------
    if (window.Lenis) {
        lenis = new Lenis({ lerp: 0.085 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(t => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
        lenis.stop();
    }

    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const target = $(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        closeMenu();
        if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView();
    }));

    // --- Text helpers -----------------------------------------------------
    // background-clip text doesn't paint through transformed children, so
    // gradient classes move from the wrapper onto each character
    const GRADIENTS = ['grad-text', 'shine-text', 'fade-text'];

    function splitChars(el, { outer = false } = {}) {
        const chars = [];
        const label = el.textContent.replace(/\s+/g, ' ').trim();
        const walk = (node, inherit) => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.append(' '); return; }
                        const word = document.createElement('span');
                        word.className = 'sw';
                        word.setAttribute('aria-hidden', 'true');
                        [...part].forEach(ch => {
                            const c = document.createElement('span');
                            c.className = ('sc ' + inherit).trim();
                            c.textContent = ch;
                            c.style.setProperty('--i', chars.length);
                            if (outer) {
                                const o = document.createElement('span');
                                o.className = 'so';
                                o.append(c);
                                word.append(o);
                            } else {
                                word.append(c);
                            }
                            chars.push(c);
                        });
                        frag.append(word);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    const cls = GRADIENTS.filter(c => child.classList.contains(c));
                    cls.forEach(c => child.classList.remove(c));
                    walk(child, cls.join(' ') || inherit);
                }
            });
        };
        walk(el, '');
        // screen readers get the whole text once instead of letter-by-letter
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = label;
        el.append(sr);
        return chars;
    }

    function splitWords(el) {
        const words = [];
        const walk = node => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.append(' '); return; }
                        const w = document.createElement('span');
                        w.textContent = part;
                        frag.append(w);
                        words.push(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    walk(child);
                }
            });
        };
        walk(el);
        return words;
    }

    // Wrap every character so it can be revealed one at a time without the
    // layout shifting; the caret follows the last revealed character
    function prepareTyping(el) {
        const chars = [];
        const pre = el.tagName === 'PRE';
        const walk = node => {
            [...node.childNodes].forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = pre ? child.textContent : child.textContent.replace(/\s+/g, ' ');
                    const frag = document.createDocumentFragment();
                    [...text].forEach(ch => {
                        const s = document.createElement('span');
                        s.className = 'tc';
                        s.textContent = ch;
                        frag.append(s);
                        chars.push(s);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    walk(child);
                }
            });
        };
        walk(el);
        el.classList.add('type-ready');
        return chars;
    }

    function typeOut(el, chars, speed, keepCaret) {
        const caret = document.createElement('span');
        caret.className = 'caret';
        chars[0]?.before(caret);
        let i = 0;
        const tick = () => {
            if (i >= chars.length) {
                if (!keepCaret) setTimeout(() => caret.remove(), 1400);
                return;
            }
            const c = chars[i++];
            c.classList.add('on');
            c.after(caret);
            const runOfSpace = /\s/.test(c.textContent) && /\s/.test(chars[i]?.textContent || '');
            setTimeout(tick, runOfSpace ? 0 : speed * (0.5 + Math.random()));
        };
        tick();
    }

    const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEF';
    function scramble(el, duration = 900, text) {
        const original = text ?? (el.dataset.text ||= el.textContent);
        const t0 = performance.now();
        const frame = now => {
            const p = Math.min((now - t0) / duration, 1);
            const shown = Math.floor(p * original.length);
            let out = '';
            for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                out += i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            el.textContent = out;
            if (p < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }

    // --- WebGL particle field ---------------------------------------------
    let particles = null;
    try { particles = createParticles($('#gl')); } catch (err) { $('#gl')?.remove(); }

    function createParticles(canvas) {
        // Software-rendered WebGL (no GPU) fills the canvas on the main thread and
        // makes the whole page janky, so those browsers get the static backdrop instead
        const force = new URLSearchParams(location.search).has('forcegl');
        const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: !force });
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
        if (!gl || (!force && /swiftshader|llvmpipe|softpipe|software/i.test(renderer))) {
            canvas.remove();
            document.documentElement.classList.add('no-gl');
            return null;
        }

        const mobile = innerWidth < 900;
        const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
        const N = Math.round((mobile ? 2000 : 4200) * (lowEnd ? 0.6 : 1));
        const rand = (a, b) => a + Math.random() * (b - a);
        const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

        const build = fn => {
            const out = new Float32Array(N * 3);
            for (let i = 0; i < N; i++) {
                const [x, y, z] = fn(i);
                out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
            }
            return out;
        };
        const onSphere = r => {
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            return [Math.cos(a) * s * r, u * r, Math.sin(a) * s * r];
        };

        const shapes = {
            sphere: build(i => {
                if (i % 8 === 0) return onSphere(rand(2.7, 4.2));
                const k = i + 0.5, phi = Math.acos(1 - 2 * k / N), theta = Math.PI * (1 + Math.sqrt(5)) * k, r = 2.3;
                return [Math.cos(theta) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(theta) * Math.sin(phi) * r];
            }),
            helix: build(i => {
                const t = i / N, y = (t - 0.5) * 7, a = t * Math.PI * 9;
                if (i % 9 === 0) {
                    const m = Math.random() * 2 - 1;
                    return [Math.cos(a) * 1.25 * m, y, Math.sin(a) * 1.25 * m];
                }
                const off = i % 2 ? Math.PI : 0;
                return [Math.cos(a + off) * 1.25 + gauss() * 0.07, y + gauss() * 0.05, Math.sin(a + off) * 1.25 + gauss() * 0.07];
            }),
            cube: build(i => {
                const s = 1.75, p = [rand(-s, s), rand(-s, s), rand(-s, s)];
                const ax = i % 3;
                if (i % 3 === 0) {
                    p[(ax + 1) % 3] = Math.sign(p[(ax + 1) % 3]) * s;
                    p[(ax + 2) % 3] = Math.sign(p[(ax + 2) % 3]) * s;
                } else {
                    p[ax] = Math.sign(p[ax]) * s;
                    if (i % 5 === 0) return [p[0] * 0.45, p[1] * 0.45, p[2] * 0.45];
                }
                return p;
            }),
            lattice: build(i => {
                const n = 6, step = 4.2 / (n - 1), g = () => Math.floor(Math.random() * n) * step - 2.1;
                const p = [g(), g(), g()];
                p[i % 3] = rand(-2.1, 2.1);
                return p;
            }),
            torus: build(i => {
                const t = (i / N) * Math.PI * 2 * 3, p = 2, q = 3;
                const r = Math.cos(q * t) + 2.2;
                return [r * Math.cos(p * t) * 0.85 + gauss() * 0.16, r * Math.sin(p * t) * 0.85 + gauss() * 0.16, -Math.sin(q * t) * 0.85 + gauss() * 0.16];
            }),
            galaxy: build(i => {
                const r = Math.pow(Math.random(), 0.75) * 4.4, arm = i % 3;
                const a = arm * (Math.PI * 2 / 3) + r * 1.15 + gauss() * 0.4 / (r + 0.4);
                return [Math.cos(a) * r, gauss() * 0.22 * (1.2 - r / 4.4), Math.sin(a) * r];
            }),
            wave: build(i => {
                const cols = 90, c = i % cols, r = Math.floor(i / cols), rows = Math.ceil(N / cols);
                return [(c / (cols - 1) - 0.5) * 11, 0, (r / (rows - 1) - 0.5) * 7];
            }),
            ring: build(i => {
                const a = Math.random() * Math.PI * 2;
                if (i % 6 === 0) return onSphere(rand(0.2, 4.5));
                const R = 2.6 + gauss() * 0.12;
                return [Math.cos(a) * R, gauss() * 0.06, Math.sin(a) * R];
            }),
        };

        const layouts = mobile ? {
            sphere: { x: 0, y: -0.9, s: 0.72, tilt: 0.2 },
            helix: { x: 0, y: 0, s: 0.7, tilt: 0.3 },
            cube: { x: 0, y: 0, s: 0.72, tilt: 0.5 },
            lattice: { x: 0, y: 0, s: 0.8, tilt: 0.4 },
            torus: { x: 0, y: 0, s: 0.7, tilt: 0.3 },
            galaxy: { x: 0, y: 0, s: 0.85, tilt: 0.6 },
            wave: { x: 0, y: -1.6, s: 0.8, tilt: 0.35 },
            ring: { x: 0, y: 0, s: 0.75, tilt: 1.1 },
        } : {
            sphere: { x: 2.4, y: 0.1, s: 1, tilt: 0.2 },
            helix: { x: 2.6, y: 0, s: 1, tilt: 0.3 },
            cube: { x: 0, y: 0, s: 1.15, tilt: 0.5 },
            lattice: { x: 0, y: -0.2, s: 1.2, tilt: 0.4 },
            torus: { x: 0, y: 0, s: 1.15, tilt: 0.3 },
            galaxy: { x: 0, y: 0, s: 1.3, tilt: 0.55 },
            wave: { x: 0, y: -1.8, s: 1, tilt: 0.35 },
            ring: { x: 0, y: 0, s: 1.15, tilt: 1.15 },
        };

        // Morphing runs in the vertex shader: each particle eases from aFrom to aTo
        // at its own rate, so a frame only updates uniforms. The CPU touches the
        // buffers once per shape change.
        const from = build(() => onSphere(rand(6, 14)));   // start scattered so the first shape assembles itself
        const speed = new Float32Array(N).map(() => rand(0.018, 0.06));
        const jitter = build(() => onSphere(rand(0.4, 1)));
        const colors = build(() => {
            if (Math.random() < 0.14) { const k = rand(0.7, 1.15); return [0.88 * k, 0.14 * k, 0.31 * k]; }
            const k = rand(0.35, 0.95); return [k, k, k * 1.02];
        });
        const sizes = new Float32Array(N).map(() => (Math.random() < 0.04 ? rand(2.4, 3.6) : rand(0.8, 1.9)));

        const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, `
            attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aJit;
            attribute vec3 aCol; attribute float aSize; attribute float aSpeed;
            uniform mat4 uMVP; uniform float uPx; uniform float uT; uniform float uScatter;
            uniform float uWave; uniform float uTime;
            varying vec3 vCol; varying float vA;
            void main() {
                vec3 to = aTo;
                if (uWave > 0.5) to.y = sin(to.x * 0.9 + uTime * 1.4) * 0.35 + cos(to.z * 1.2 + uTime) * 0.25;
                float k = 1.0 - pow(1.0 - aSpeed, uT * 60.0);
                vec4 p = uMVP * vec4(mix(aFrom, to, k) + aJit * uScatter, 1.0);
                gl_Position = p;
                gl_PointSize = aSize * uPx / max(p.w, 0.6);
                vCol = aCol;
                vA = clamp(1.7 - p.w * 0.12, 0.15, 1.0);
            }`));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, `
            precision mediump float;
            varying vec3 vCol; varying float vA; uniform float uAlpha;
            void main() {
                float r = length(gl_PointCoord - 0.5);
                if (r > 0.5) discard;
                float a = pow(1.0 - r * 2.0, 1.5) * vA * uAlpha;
                gl_FragColor = vec4(vCol * a, 1.0);
            }`));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
        gl.useProgram(prog);

        const attr = (name, data, size) => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
            return buf;
        };
        const fromBuf = attr('aFrom', from, 3);
        const toBuf = attr('aTo', shapes.sphere, 3);
        attr('aJit', jitter, 3);
        attr('aCol', colors, 3);
        attr('aSize', sizes, 1);
        attr('aSpeed', speed, 1);
        const u = name => gl.getUniformLocation(prog, name);
        const uMVP = u('uMVP'), uPx = u('uPx'), uAlpha = u('uAlpha'), uT = u('uT'), uScatter = u('uScatter'), uWave = u('uWave'), uTime = u('uTime');
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.clearColor(0, 0, 0, 1);

        const mul = (a, b) => {
            const o = new Float32Array(16);
            for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
                o[c * 4 + r] = sum;
            }
            return o;
        };
        const perspective = (fov, asp, n, f) => {
            const t = 1 / Math.tan(fov / 2);
            return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
        };
        const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
        const rotX = a => { const c = Math.cos(a), sn = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, sn, 0, 0, -sn, c, 0, 0, 0, 0, 1]); };
        const rotY = a => { const c = Math.cos(a), sn = Math.sin(a); return new Float32Array([c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1]); };
        const scale = k => new Float32Array([k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1]);

        let aspect = 1, px = 1;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(innerWidth * dpr);
            canvas.height = Math.round(innerHeight * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
            aspect = innerWidth / innerHeight;
            px = dpr * 15;
        };
        resize();
        window.addEventListener('resize', resize);

        let shape = 'sphere', morphStart = performance.now();
        const view = { ...layouts.sphere, alpha: 0 };
        let spin = 0, scatter = 0, mx = 0, my = 0, tmx = 0, tmy = 0;

        window.addEventListener('pointermove', e => {
            tmx = e.clientX / innerWidth - 0.5;
            tmy = e.clientY / innerHeight - 0.5;
        }, { passive: true });

        gsap.ticker.add((time, delta) => {
            if (document.hidden || view.alpha === 0) return;
            const dt = Math.min(delta / 16.67, 3);
            scatter *= Math.pow(0.93, dt);
            if (scatter < 0.002) scatter = 0;
            mx += (tmx - mx) * 0.05;
            my += (tmy - my) * 0.05;
            spin += 0.0018 * dt * (1 + scatter * 6);
            let m = perspective(0.85, aspect, 0.1, 100);
            m = mul(m, translate(view.x, view.y, -7.5));
            m = mul(m, rotX(view.tilt + my * 0.35));
            m = mul(m, rotY(spin + mx * 0.6));
            m = mul(m, scale(view.s));
            gl.uniformMatrix4fv(uMVP, false, m);
            gl.uniform1f(uPx, px);
            gl.uniform1f(uAlpha, view.alpha);
            gl.uniform1f(uT, (performance.now() - morphStart) / 1000);
            gl.uniform1f(uScatter, scatter);
            gl.uniform1f(uWave, shape === 'wave' ? 1 : 0);
            gl.uniform1f(uTime, time);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.POINTS, 0, N);
        });

        return {
            setShape(name) {
                if (!shapes[name] || name === shape) return;
                // freeze where every particle is right now (same maths as the shader), then retarget
                const t = (performance.now() - morphStart) / 1000, now = gsap.ticker.time, prev = shapes[shape];
                for (let i = 0; i < N; i++) {
                    const k = 1 - Math.pow(1 - speed[i], t * 60), j = i * 3;
                    let ty = prev[j + 1];
                    if (shape === 'wave') ty = Math.sin(prev[j] * 0.9 + now * 1.4) * 0.35 + Math.cos(prev[j + 2] * 1.2 + now) * 0.25;
                    from[j] += (prev[j] - from[j]) * k;
                    from[j + 1] += (ty - from[j + 1]) * k;
                    from[j + 2] += (prev[j + 2] - from[j + 2]) * k;
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, fromBuf);
                gl.bufferData(gl.ARRAY_BUFFER, from, gl.STATIC_DRAW);
                gl.bindBuffer(gl.ARRAY_BUFFER, toBuf);
                gl.bufferData(gl.ARRAY_BUFFER, shapes[name], gl.STATIC_DRAW);
                shape = name;
                morphStart = performance.now();
                const { x, y, s: sc, tilt } = layouts[name];
                gsap.to(view, { x, y, s: sc, tilt, duration: 2.2, ease: 'expo.inOut', overwrite: 'auto' });
                scatter = Math.max(scatter, 0.6);
            },
            kick(v) { scatter = Math.max(scatter, Math.min(Math.abs(v) / 2600, 1.4)); },
            fadeIn() { morphStart = performance.now(); gsap.to(view, { alpha: 0.9, duration: 2.5, ease: 'power2.out' }); },
        };
    }

    // --- Pinned 3D set pieces (built first so later triggers see the spacers)
    const mm = gsap.matchMedia();
    mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, ctx => {
        const { desktop } = ctx.conditions;
        const cleanups = [];
        if (desktop) {
            cleanups.push(setupRing());
            cleanups.push(setupHorizontal());
        }
        cleanups.push(setupTunnel(!desktop));
        return () => cleanups.forEach(fn => fn && fn());
    });

    function setupRing() {
        const section = $('#stack'), ring = $('#ring');
        section.classList.add('is-3d');
        const cards = [...ring.children], n = cards.length, step = 360 / n;
        const R = Math.round(cards[0].offsetWidth / 2 / Math.tan(Math.PI / n)) + 120;
        cards.forEach((c, i) => { c.style.transform = `rotateY(${i * step}deg) translateZ(${R}px)`; });
        const idx = $('#ring-idx'), name = $('#ring-name');
        const state = { rot: 0 };
        let front = -1;
        const render = () => {
            ring.style.transform = `translateZ(${-R}px) rotateX(-8deg) rotateY(${state.rot}deg)`;
            let best = 0, bestCos = -2;
            cards.forEach((c, i) => {
                const cos = Math.cos((i * step + state.rot) * Math.PI / 180);
                c.style.opacity = (0.1 + 0.9 * Math.pow(Math.max(0, cos), 1.4)).toFixed(3);
                c.classList.toggle('front', cos > 0.97);
                if (cos > bestCos) { bestCos = cos; best = i; }
            });
            if (best !== front) {
                front = best;
                idx.textContent = String(best + 1).padStart(2, '0');
                scramble(name, 500, cards[best].dataset.name);
            }
        };
        render();
        gsap.to(state, {
            rot: -(n - 1) * step, ease: 'none', onUpdate: render,
            scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + innerHeight * 2.8, pin: true, scrub: 1 },
        });
        return () => {
            section.classList.remove('is-3d');
            ring.style.transform = '';
            cards.forEach(c => { c.style.transform = ''; c.style.opacity = ''; c.classList.remove('front'); });
        };
    }

    function setupHorizontal() {
        const section = $('#projects'), track = $('#proj-track');
        section.classList.add('is-h');
        const slots = [...track.children];
        const counter = $('#proj-counter b'), ghost = $('.proj-ghost');
        const dist = () => track.scrollWidth - innerWidth;
        const scroller = gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: {
                trigger: section, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true,
                onUpdate: self => gsap.set(ghost, { xPercent: -self.progress * 45 }),
            },
        });
        let last = -1, centers = [];
        const measure = () => { centers = slots.map(s => s.offsetLeft + s.offsetWidth / 2); };
        measure();
        ScrollTrigger.addEventListener('refresh', measure);
        const tick = () => {
            // the pin's own range plus a viewport either side; no layout reads per frame
            const st = scroller.scrollTrigger, y = st.scroll();
            if (y < st.start - innerHeight || y > st.end + innerHeight) return;
            const mid = innerWidth / 2, x = gsap.getProperty(track, 'x');
            let best = 0, bestD = Infinity;
            slots.forEach((s, i) => {
                const d = (centers[i] + x - mid) / innerWidth;
                s.style.transform = `perspective(1400px) rotateY(${(-d * 34).toFixed(2)}deg) translateZ(${(-Math.abs(d) * 260).toFixed(1)}px)`;
                if (i > 0 && Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
            });
            if (best !== last) { last = best; counter.textContent = String(best).padStart(2, '0'); }
        };
        gsap.ticker.add(tick);
        return () => {
            ScrollTrigger.removeEventListener('refresh', measure);
            gsap.ticker.remove(tick);
            section.classList.remove('is-h');
            slots.forEach(s => { s.style.transform = ''; });
        };
    }

    function setupTunnel(isMobile) {
        const section = $('#lab'), tunnel = $('#tunnel');
        section.classList.add('is-3d');
        const items = $$('.t-item', tunnel);
        const intro = $('.lab-intro', section), outro = $('.lab-outro', section);
        const depth = $('#lab-depth'), frameNo = $('#lab-frame-no');
        const spread = [[-0.25, -0.06], [0.24, 0.1], [-0.22, 0.14], [0.27, -0.12], [-0.26, 0.05], [0.18, -0.06], [-0.17, -0.13], [0.25, 0.12], [-0.22, -0.02], [0.2, 0.06]];
        const gap = isMobile ? 900 : 1150;
        const lead = gap * 0.9;
        const total = (items.length + 0.5) * gap + lead;
        const state = { p: 0 };
        const render = () => {
            const cam = state.p * total;
            let nearest = 0;
            items.forEach((el, i) => {
                const z = -(i + 1) * gap - lead + cam;
                const [fx, fy] = spread[i % spread.length];
                const x = fx * innerWidth * (isMobile ? 0.55 : 1), y = fy * innerHeight;
                let o = 1;
                if (z < -gap * 3.4) o = 0;
                else if (z < -gap * 2.4) o = (z + gap * 3.4) / gap;
                if (z > 200) o = Math.max(0, 1 - (z - 200) / 400);
                el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(fx * -40).toFixed(1)}deg)`;
                el.style.opacity = o.toFixed(3);
                el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
                if (!finePointer) el.classList.toggle('lit', z > -1300 && z < 250);
                if (z > -gap) nearest = i + 1;
            });
            intro.style.transform = `translate(-50%, -50%) perspective(1000px) translateZ(${(cam * 0.6).toFixed(1)}px)`;
            intro.style.opacity = Math.max(0, 1 - state.p * 7).toFixed(3);
            intro.style.visibility = state.p > 0.15 ? 'hidden' : 'visible';
            outro.style.opacity = gsap.utils.clamp(0, 1, (state.p - 0.86) / 0.1).toFixed(3);
            depth.textContent = String(Math.round(cam / 10)).padStart(4, '0');
            frameNo.textContent = String(Math.min(nearest, items.length)).padStart(2, '0');
        };
        render();
        gsap.to(state, {
            p: 1, ease: 'none', onUpdate: render,
            scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + innerHeight * (isMobile ? 3.6 : 4.6), pin: true, scrub: 1 },
        });
        return () => {
            section.classList.remove('is-3d');
            [...items, intro].forEach(el => { el.style.transform = ''; el.style.opacity = ''; el.style.visibility = ''; });
        };
    }

    // --- Hero ---------------------------------------------------------------
    const heroChars = splitChars($('#hero-name'), { outer: true });
    gsap.set(heroChars, { rotateX: -110, yPercent: 120, opacity: 0, transformPerspective: 800, transformOrigin: '50% 100%' });
    gsap.set('[data-in]', { opacity: 0, y: 30, filter: 'blur(10px)' });
    gsap.set('.term-wrap', { opacity: 0, rotateY: -40, rotateX: 18, z: -300, transformPerspective: 1200 });

    // letters fly apart in 3D as the hero scrolls away
    gsap.to(heroChars.map(c => c.parentElement), {
        x: () => gsap.utils.random(-600, 600),
        y: () => gsap.utils.random(-400, 150),
        z: () => gsap.utils.random(-300, 900),
        rotateX: () => gsap.utils.random(-200, 200),
        rotateY: () => gsap.utils.random(-200, 200),
        opacity: 0, transformPerspective: 900, ease: 'power1.in',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
    });
    gsap.to('.hero-out', {
        y: -140, opacity: 0, filter: 'blur(12px)', ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true },
    });
    gsap.to('.term-out', {
        y: -200, rotateX: 50, rotateY: -30, z: -400, opacity: 0, transformPerspective: 1000, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: '10% top', end: '70% top', scrub: true },
    });

    function heroIntro() {
        const tl = gsap.timeline();
        tl.to(heroChars, { rotateX: 0, yPercent: 0, opacity: 1, duration: 1.5, stagger: 0.05, ease: 'expo.out' })
            .to('[data-in]', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.1, ease: 'expo.out' }, 0.45)
            .to('.term-wrap', { opacity: 1, rotateY: 0, rotateX: 0, z: 0, duration: 1.8, ease: 'expo.out' }, 0.6);
        startTyper();
        setTimeout(startTerminal, 900);
    }

    function startTyper() {
        const typer = $('#typer');
        const words = JSON.parse(typer.dataset.words);
        let w = 0, ch = words[0].length, deleting = true;
        const loop = () => {
            const word = words[w];
            ch += deleting ? -1 : 1;
            typer.textContent = word.slice(0, ch);
            let delay = deleting ? 35 : 75;
            if (!deleting && ch === word.length) { deleting = true; delay = 1900; }
            else if (deleting && ch === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
            setTimeout(loop, delay);
        };
        setTimeout(loop, 2200);
    }

    function startTerminal() {
        const term = $('#term');
        const lines = [
            ['p', '$ ', 'w', 'whoami'],
            ['', 'sebastian'],
            ['p', '$ ', 'w', 'kubectl get pods -n iot'],
            ['', 'ingest-7f9c   Running'],
            ['p', '$ ', 'w', 'go run ./cmd/ingest'],
            ['ok', '✓ ', '', 'mqtt broker connected'],
            ['ok', '✓ ', '', 'ocpp 1.6j listening :9000'],
        ];
        const render = (count, partial) => {
            term.textContent = '';
            lines.slice(0, count).forEach((l, idx) => {
                const row = document.createElement('div');
                for (let k = 0; k < l.length; k += 2) {
                    const s = document.createElement('span');
                    if (l[k]) s.className = l[k];
                    let txt = l[k + 1];
                    if (idx === count - 1 && partial !== undefined && k === l.length - 2) txt = txt.slice(0, partial);
                    s.textContent = txt;
                    row.append(s);
                }
                term.append(row);
            });
        };
        let line = 0, pos = 0;
        const step = () => {
            if (line >= lines.length) { setTimeout(() => { line = 0; pos = 0; step(); }, 4000); return; }
            const l = lines[line], typed = l[0] === 'p', full = l[l.length - 1].length;
            if (typed && pos < full) { pos++; render(line + 1, pos); setTimeout(step, 50); return; }
            render(line + 1);
            line++; pos = 0;
            setTimeout(step, typed ? 380 : 240);
        };
        step();
    }

    // --- Boot sequence ----------------------------------------------------
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    const log2 = $('#pl-log'), num = $('#pl-num'), bar = $('#pl-bar');
    const bootLines = [
        ['> boot astianmuchui.tech', ''],
        ['> mount /dev/hardware ........ ', 'ok'],
        ['> load go runtime ............ ', 'ok'],
        ['> connect mqtt://sensors ..... ', 'ok'],
        ['> render particle field ...... ', 'ok'],
    ];
    bootLines.forEach(([text, ok], i) => gsap.delayedCall(i * 0.2, () => {
        const row = document.createElement('div');
        row.textContent = text;
        if (ok) { const s = document.createElement('span'); s.className = 'ok'; s.textContent = ok; row.append(s); }
        log2.append(row);
    }));
    const loaded = new Promise(r => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    const maxWait = new Promise(r => setTimeout(r, 1500));
    let seen = false;
    try { seen = sessionStorage.getItem('booted') === '1'; sessionStorage.setItem('booted', '1'); } catch (err) { /* storage blocked */ }
    const counter = { v: 0 };
    gsap.to(counter, {
        v: 100, duration: seen ? 0.01 : 1.2, ease: 'power2.inOut',
        onUpdate: () => { num.textContent = Math.round(counter.v); bar.style.transform = `scaleX(${counter.v / 100})`; },
        onComplete: () => (seen ? exitBoot() : Promise.race([loaded, maxWait]).then(exitBoot)),
    });

    function exitBoot() {
        particles?.fadeIn();
        gsap.timeline({ onComplete: () => { preloader.remove(); lenis?.start(); ScrollTrigger.refresh(); } })
            .to('.pl-inner', { opacity: 0, y: -40, duration: 0.45, ease: 'power2.in' })
            .to('.pl-a', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.05')
            .to('.pl-b', { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, '<')
            .add(heroIntro, '-=0.7');
    }
    // --- Tapes: speed and direction follow the scroll ---------------------
    const tapes = $$('.tape-track').map((el, i) => ({ el, x: i ? -50 : 0, dir: i ? 1 : -1 }));
    const wrap = gsap.utils.wrap(-50, 0);
    let velocity = 0, scrollDir = 1, tapesVisible = true;
    ScrollTrigger.create({ trigger: '.tapes', start: 'top bottom', end: 'bottom top', onToggle: self => { tapesVisible = self.isActive; } });
    gsap.ticker.add((t, delta) => {
        velocity *= 0.9;
        if (!tapesVisible) return;
        const boost = 1 + Math.min(Math.abs(velocity) / 250, 10);
        tapes.forEach(tp => {
            tp.x = wrap(tp.x + tp.dir * scrollDir * 0.022 * boost * (delta / 16.67));
            tp.el.style.transform = `translate3d(${tp.x}%, 0, 0)`;
        });
    });
    gsap.fromTo('.tapes', { rotate: -6, scale: 0.9 }, {
        rotate: 4, scale: 1.05, ease: 'none',
        scrollTrigger: { trigger: '.tapes', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // --- Section headings, typing, scramble -------------------------------
    $$('[data-flip]').forEach(h => {
        const chars = splitChars(h);
        gsap.from(chars, {
            rotateX: -100, yPercent: 90, opacity: 0, transformPerspective: 700, transformOrigin: '50% 100%',
            stagger: 0.022, duration: 1.2, ease: 'expo.out',
            scrollTrigger: { trigger: h, start: 'top 88%' },
        });
    });

    $$('[data-type]').forEach(el => {
        const chars = prepareTyping(el);
        const isCmd = !!el.closest('.cmd');
        const speed = parseFloat(el.dataset.speed) || (isCmd ? 55 : 16);
        ScrollTrigger.create({
            trigger: el, start: 'top 90%', once: true,
            onEnter: () => setTimeout(() => typeOut(el, chars, speed, isCmd), isCmd ? 0 : 500),
        });
    });

    $$('[data-scramble]').forEach(el => {
        ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => scramble(el) });
    });

    // --- About ------------------------------------------------------------
    $$('[data-scrub-words]').forEach(el => {
        gsap.fromTo(splitWords(el), { color: '#8a8a8a' }, {
            color: (i, word) => getComputedStyle(word).color, stagger: 0.05, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 55%', scrub: true },
        });
    });
    $$('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count, 10), obj = { v: 0 };
        el.textContent = '0';
        gsap.to(obj, {
            v: target, duration: 1.8, ease: 'power3.out',
            onUpdate: () => { el.textContent = Math.round(obj.v); },
            scrollTrigger: { trigger: el, start: 'top 90%' },
        });
    });
    gsap.fromTo('.about-photo', { clipPath: 'inset(22% 22% 22% 22% round 60px)', rotateY: -25, transformPerspective: 1200 }, {
        clipPath: 'inset(0% 0% 0% 0% round 24px)', rotateY: 0, ease: 'none',
        scrollTrigger: { trigger: '.about-visual', start: 'top 95%', end: 'top 30%', scrub: true },
    });

    // --- Experience: cards stack and recede -------------------------------
    const xpCards = $$('.xp-card');
    xpCards.forEach((card, i) => {
        const next = xpCards[i + 1];
        if (!next) return;
        gsap.to(card, {
            scale: 0.9, rotateX: -8, filter: 'brightness(0.35)', transformPerspective: 1400, transformOrigin: '50% 0%', ease: 'none',
            scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 30%', scrub: true },
        });
    });
    gsap.from('.xp-extra .card', {
        rotateY: i => (i ? 35 : -35), y: 100, opacity: 0, transformPerspective: 1200, stagger: 0.15, duration: 1.3, ease: 'expo.out',
        scrollTrigger: { trigger: '.xp-extra', start: 'top 85%' },
    });

    // Without pins (mobile), project and ring cards flip in individually
    mm.add('(max-width: 899px)', () => {
        $$('.proj-slot:not(.proj-intro), .ring-card').forEach(el => {
            gsap.from(el, {
                rotateX: -45, y: 80, opacity: 0, transformPerspective: 1000, transformOrigin: '50% 0%', duration: 1.1, ease: 'expo.out',
                scrollTrigger: { trigger: el, start: 'top 92%' },
            });
        });
    });

    // --- Writing ----------------------------------------------------------
    gsap.from('.post-row', {
        rotateX: -80, y: 60, opacity: 0, transformPerspective: 900, transformOrigin: '50% 0%', stagger: 0.12, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: '.posts-list', start: 'top 85%' },
    });

    // --- Contact + footer -------------------------------------------------
    gsap.fromTo('.mega-wrap', { scale: 0.55, rotateX: 55, transformPerspective: 1000 }, {
        scale: 1, rotateX: 0, ease: 'none',
        scrollTrigger: { trigger: '#contact', start: 'top bottom', end: 'top 20%', scrub: true },
    });
    gsap.from('.sponsor', {
        y: 80, rotateX: -40, opacity: 0, transformPerspective: 1000, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: '.sponsor', start: 'top 92%' },
    });
    const footChars = splitChars($('.footer-big'));
    gsap.from(footChars, {
        yPercent: 110, rotateX: -90, transformPerspective: 800, transformOrigin: '50% 100%', stagger: 0.06, ease: 'none',
        scrollTrigger: { trigger: '.footer', start: 'top 95%', end: 'bottom bottom', scrub: 1 },
    });
    $$('[data-speed]:not([data-type])').forEach(el => {
        gsap.to(el, {
            yPercent: -parseFloat(el.dataset.speed) * 100, ease: 'none',
            scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    });

    // --- Global scroll state: progress, HUD, velocity ---------------------
    const header = $('#header'), progress = $('.progress'), hudPct = $('#hud-pct');
    ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: self => {
            velocity = self.getVelocity();
            scrollDir = self.direction;
            progress.style.transform = `scaleX(${self.progress})`;
            hudPct.textContent = String(Math.round(self.progress * 100)).padStart(3, '0');
            header.classList.toggle('scrolled', self.scroll() > 40);
            particles?.kick(velocity);
        },
    });

    const hudIdx = $('#hud-idx'), hudLabel = $('#hud-label');
    const navLinks = $$('.nav a');
    // A pinned section's own box is one viewport tall, so measure those from the
    // pin's range instead or the section "ends" before its pinned scroll does
    const pinOf = el => ScrollTrigger.getAll().find(t => t.pin === el);
    $$('[data-shape]').forEach(section => {
        ScrollTrigger.create({
            trigger: section,
            start: () => { const p = pinOf(section); return p ? p.start - innerHeight * 0.45 : 'top 55%'; },
            end: () => { const p = pinOf(section); return p ? p.end + innerHeight * 0.45 : 'bottom 55%'; },
            onToggle: self => {
                if (!self.isActive) return;
                particles?.setShape(section.dataset.shape);
                hudIdx.textContent = section.dataset.idx;
                scramble(hudLabel, 500, section.dataset.label.toUpperCase());
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + section.id));
            },
        });
    });

    // --- Live log in the NexThings architecture card ----------------------
    const log = $('#arch-log');
    if (log) {
        const devices = ['evse-014', 'bms-221', 'sensor-07', 'bms-118', 'evse-003', 'gw-02'];
        const events = [
            ['ok', 'PUB telemetry/soc 87.2%'], ['', 'MeterValues 11.4kWh'], ['ok', 'PUB telemetry/temp 31.6°C'],
            ['', 'Heartbeat ok'], ['ok', 'WS → dashboard 4 clients'], ['', 'StatusNotification Available'],
        ];
        const push = () => {
            const [cls, msg] = events[(Math.random() * events.length) | 0];
            const row = document.createElement('div');
            const ts = document.createElement('span');
            ts.textContent = new Date().toISOString().slice(11, 19) + ' ';
            const dev = document.createElement('span');
            dev.className = cls;
            dev.textContent = devices[(Math.random() * devices.length) | 0];
            row.append(ts, dev, ' ' + msg);
            log.append(row);
            while (log.children.length > 3) log.firstElementChild.remove();
        };
        push(); push();
        setInterval(push, 1400);
    }

    // --- Pointer effects (desktop) ----------------------------------------
    if (finePointer) {
        document.documentElement.classList.add('has-cursor');
        const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-label');
        gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: innerWidth / 2, y: innerHeight / 2 });
        const dx = gsap.quickTo(dot, 'x', { duration: 0.06 }), dy = gsap.quickTo(dot, 'y', { duration: 0.06 });
        const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
        window.addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
        document.addEventListener('pointerover', e => {
            const hit = e.target.closest('a, button, [data-cursor]');
            const text = e.target.closest('[data-cursor]')?.dataset.cursor || '';
            ring.classList.toggle('hover', !!hit && !text);
            ring.classList.toggle('has-label', !!text);
            label.textContent = text;
        });

        $$('.card').forEach(card => {
            card.addEventListener('pointermove', e => {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                card.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });

        $$('[data-tilt]').forEach(el => {
            const max = parseFloat(el.dataset.tilt) || 6;
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });

        $$('[data-magnetic]').forEach(el => {
            const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                mx((e.clientX - r.left - r.width / 2) * 0.35);
                my((e.clientY - r.top - r.height / 2) * 0.45);
            });
            el.addEventListener('pointerleave', () => { mx(0); my(0); });
        });
    }

})();
