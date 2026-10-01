// פתיחת "המסע": זריחה, מטוס עם 14 הפנים בחלונות, קו מתל אביב לגארדה,
// צלילה דרך העננים אל אגם גארדה בצורה האמיתית שלו, והלוגו נכתב.
// כל פריים הוא פונקציה טהורה של t (חוקי core.js).
(() => {
  'use strict';
  const X = { // גוונים בהירים וכהים של הפלטה (סגנון איור: בהיר וכהה מכל צבע)
    SKY1: '#FFF6E2', SKY2: '#FCE3A6', SKY3: '#F6C59B', SKY4: '#EFA48D',
    BLUE_L: '#8DBDE6', BLUE_D: '#0F4E86', LEMON_L: '#F9E39A', TERRA_L: '#EE9A86',
    OLIVE: '#7E9A55', OLIVE_L: '#B9CC8C', OLIVE_D: '#5C7A3C', CLOUD: '#FFFDF7', CLOUD_S: '#EFE6D3',
  };
  const STROKE = 5;

  scene('main', 0, DUR, { bg: C.PAPER }, (root) => {
    const svg = svgBox(root, 0, 0, W, H);
    const defs = svgEl('defs', svg);
    const path = (parent, d, fill, stroke = C.INK, sw = STROKE, extra = {}) =>
      svgEl('path', parent, Object.assign({ d, fill, stroke: stroke || 'none', 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }, extra));
    const G = (parent, attrs = {}) => svgEl('g', parent, attrs);
    const setT = (el, s) => el.setAttribute('transform', s);
    const op = (el, o) => { el.setAttribute('opacity', clamp(o, 0, 1).toFixed(3)); el.style.visibility = o <= 0.003 ? 'hidden' : 'visible'; };
    const cloudD = (w, h) => { // ענן שטוח: בסיס מעוגל וגבעות
      const r = h / 2;
      return `M${-w / 2 + r},${r} L${w / 2 - r},${r} A${r},${r} 0 0 0 ${w / 2 - r * 0.4},${-r * 0.2} A${r * 1.1},${r * 1.1} 0 0 0 ${w * 0.12},${-r * 0.9}`
        + ` A${r * 1.35},${r * 1.35} 0 0 0 ${-w * 0.18},${-r * 0.7} A${r},${r} 0 0 0 ${-w / 2 + r * 0.5},${0} A${r * 0.6},${r * 0.6} 0 0 0 ${-w / 2 + r},${r}Z`;
    };

    // ── עולם: כל מה שהמצלמה הגדולה מזיזה ─────────────────
    const world = G(svg);

    // שמיים בפסים שטוחים
    const sky = G(world);
    [[0, X.SKY1], [760, X.SKY2], [1180, X.SKY3], [1520, X.SKY4]].forEach(([y, c]) => svgEl('rect', sky, { x: -1200, y, width: W + 2400, height: 3000, fill: c }));
    const sun = svgEl('circle', sky, { cx: 540, cy: 0, r: 190, fill: C.YELLOW });
    const sunRing = svgEl('circle', sky, { cx: 540, cy: 0, r: 250, fill: X.LEMON_L, opacity: 0.55 });
    sky.insertBefore(sunRing, sun);

    // עננים רחוקים שנסחפים לאט
    const farClouds = [[160, 520, 420, 120], [880, 380, 360, 100], [700, 1380, 520, 150], [200, 1640, 460, 130], [950, 1760, 380, 110]]
      .map(([x, y, w, h], i) => { const g = G(world); path(g, cloudD(w, h), X.CLOUD, null, 0, { opacity: 0.92 }); return { g, x, y, sp: 18 + 10 * hash(i) }; });

    // ── המטוס ─────────────────────────────────────────────
    const L = 4200, BH = 520;
    const planeCam = G(world);           // מיקום וזום של המטוס על המסך
    const plane = G(planeCam);           // נטייה ונדנוד
    // כנף אחורית (מאחורי הגוף) ומנוע
    path(plane, 'M300,120 L1200,620 L1500,620 L900,120Z', X.CLOUD_S);
    // גוף
    path(plane, `M${-L / 2},0 C${-L / 2},${-BH / 2} ${-L / 2 + 320},${-BH / 2} ${-L / 2 + 640},${-BH / 2} L${L / 2 - 340},${-BH / 2} L${L / 2},${-BH / 2 + 60} L${L / 2},${BH / 2 - 120} L${L / 2 - 340},${BH / 2} L${-L / 2 + 640},${BH / 2} C${-L / 2 + 320},${BH / 2} ${-L / 2},${BH / 2} ${-L / 2},0Z`, X.CLOUD);
    // פס כחול ופס טרקוטה
    svgEl('rect', plane, { x: -L / 2 + 260, y: 70, width: L - 520, height: 70, fill: C.BLUE });
    svgEl('rect', plane, { x: -L / 2 + 300, y: 152, width: L - 620, height: 18, fill: C.RED });
    // זנב
    path(plane, `M${L / 2 - 520},${-BH / 2} L${L / 2 - 120},${-BH / 2 - 760} L${L / 2 + 60},${-BH / 2 - 760} L${L / 2},${-BH / 2 + 40}Z`, C.BLUE);
    path(plane, `M${L / 2 - 300},${-BH / 2 - 420} L${L / 2 - 160},${-BH / 2 - 640} L${L / 2 - 40},${-BH / 2 - 640} L${L / 2 - 120},${-BH / 2 - 420}Z`, C.YELLOW, null, 0);
    // חלונות הטייסים
    path(plane, `M${-L / 2 + 150},${-110} L${-L / 2 + 330},${-150} L${-L / 2 + 360},${-70} L${-L / 2 + 120},${-50}Z`, X.BLUE_D);
    // כנף קדמית ומנוע
    path(plane, 'M-200,140 L700,820 L1080,820 L500,140Z', X.CLOUD);
    path(plane, 'M220,360 C220,300 560,300 560,360 L560,470 C560,530 220,530 220,470Z', X.CLOUD_S);
    svgEl('ellipse', plane, { cx: 230, cy: 415, rx: 40, ry: 70, fill: C.INK });

    // 14 חלונות עם הפנים
    const order = window.FACES.order, faces = window.FACES.img;
    const WX0 = -1560, PITCH = 228, WW = 150, WH = 190, WY = -150;
    const wins = order.map((id, i) => {
      const wx = WX0 + i * PITCH;
      const clip = svgEl('clipPath', defs, { id: 'w' + i });
      svgEl('rect', clip, { x: wx - WW / 2, y: WY, width: WW, height: WH, rx: 62 });
      const g = G(plane);
      svgEl('rect', g, { x: wx - WW / 2, y: WY, width: WW, height: WH, rx: 62, fill: X.BLUE_D });
      const face = svgEl('image', G(g, { 'clip-path': `url(#w${i})` }), { href: faces[id], x: wx - WW / 2, y: WY, width: WW, height: WH, preserveAspectRatio: 'xMidYMid slice' });
      const shade = svgEl('rect', G(g, { 'clip-path': `url(#w${i})` }), { x: wx - WW / 2, y: WY, width: WW, height: WH, fill: X.LEMON_L });
      path(g, `M${wx - 40},${WY + 30} L${wx - 10},${WY + 30} L${wx - 52},${WY + 110} L${wx - 64},${WY + 90}Z`, '#FFFFFF', null, 0, { opacity: 0.35 });
      svgEl('rect', g, { x: wx - WW / 2, y: WY, width: WW, height: WH, rx: 62, fill: 'none', stroke: C.INK, 'stroke-width': STROKE, 'vector-effect': 'non-scaling-stroke' });
      const img = new Image(); img.src = faces[id]; PRELOAD.push(img.decode().catch(() => {}));
      return { wx, face, shade, i };
    });

    // ── המצלמה על המטוס ────────────────────────────────────
    // שלב 1: האף נכנס מימין; שלב 2: מעבר לאורך החלונות; שלב 3: התרחקות, והמטוס טס על הקו
    const T_IN = 1.5, T_PAN1 = 6.4, T_OUT = 6.5, T_FLY = 7.6, T_FLY1 = 9.9, T_DIVE = 9.9;
    const panKeys = []; // הרבה יעדים קטנים = תנועה רציפה ורכה
    const FX0 = -L / 2 - 560, FX1 = WX0 + 13 * PITCH + 380;
    for (let k = 0; k <= 12; k++) panKeys.push([T_IN + (T_PAN1 - T_IN - 0.6) * k / 12, lerp(-L / 2 - 120, FX1, E.io3(k / 12)), 6, 1]);
    const fx = track(FX0, [...panKeys, [T_OUT, 0, 5, 1]]);
    const scl = track(1.38, [[T_OUT, 0.115, 5.2, 1]]);
    // הקו: מתל אביב (ימין) לגארדה (שמאל)
    const TA = [800, 1190], GA = [270, 1120], CP = [540, 860];
    const bez = (u) => [(1 - u) ** 2 * TA[0] + 2 * (1 - u) * u * CP[0] + u * u * GA[0], (1 - u) ** 2 * TA[1] + 2 * (1 - u) * u * CP[1] + u * u * GA[1]];
    const bezD = (u) => [2 * (1 - u) * (CP[0] - TA[0]) + 2 * u * (GA[0] - CP[0]), 2 * (1 - u) * (CP[1] - TA[1]) + 2 * u * (GA[1] - CP[1])];
    const flyU = (t) => E.io3(seg(t, T_FLY, T_FLY1));
    const screenPos = (t) => { // מרכז המטוס על המסך
      const p = bez(flyU(t)), k = S(t - T_OUT, 4.5, 1);
      return [lerp(540, p[0], k), lerp(980, p[1] - 34, k)];
    };
    // רגע הפתיחה של כל חלון: כשהוא חוצה את צד ימין של המסך (מחושב פעם אחת בבנייה)
    wins.forEach((w) => {
      w.t0 = DUR;
      for (let t = T_IN; t < T_PAN1; t += 1 / 120) if (540 + (w.wx - fx(t)) * 1.38 < 860) { w.t0 = t; break; }
    });
    // סאונד: פופ אחד לכל משפחה, כשהפנים הראשונות שלה נדלקות
    [0, 6, 9, 11].forEach((i, k) => sfx(wins[i].t0, k % 2 ? 'popHi' : 'pop', 0.55 - k * 0.05));
    sfx(T_IN - 0.1, 'rise', 0.4);

    // ── מפה: קו מקווקו, נקודות ותוויות ─────────────────────
    const mapG = G(world);
    const lineD = `M${TA[0]},${TA[1]} Q${CP[0]},${CP[1]} ${GA[0]},${GA[1]}`;
    const mask = svgEl('mask', defs, { id: 'lineMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H });
    const maskPath = svgEl('path', mask, { d: lineD, fill: 'none', stroke: '#fff', 'stroke-width': 30, 'stroke-linecap': 'round' });
    const lineLen = maskPath.getTotalLength();
    maskPath.setAttribute('stroke-dasharray', lineLen);
    svgEl('path', mapG, { d: lineD, fill: 'none', stroke: C.INK, 'stroke-width': 9, 'stroke-dasharray': '4 26', 'stroke-linecap': 'round', mask: 'url(#lineMask)' });
    const dot = (p, c) => { const g = G(mapG); svgEl('circle', g, { cx: p[0], cy: p[1], r: 26, fill: c, stroke: C.INK, 'stroke-width': STROKE }); svgEl('circle', g, { cx: p[0], cy: p[1], r: 9, fill: C.WHITE }); return g; };
    const dotTA = dot(TA, C.RED), dotGA = dot(GA, C.BLUE);
    const T_TA = 6.9, T_GA = 9.2, T_DATE = 7.5;
    sfx(T_TA, 'tick', 0.5); sfx(T_GA, 'tick', 0.5);

    // תוויות בשכבת HTML מעל
    const labels = div(root, { left: 0, top: 0 });
    const lab = (s, x, y, o = {}) => txt(labels, s, Object.assign({ x, y, size: 92, font: F.RUBIK, weight: 700, color: C.INK }, o));
    const labTA = lab('תל אביב', 730, TA[1] + 110);
    const labGA = lab('גארדה', GA[0] + 40, GA[1] + 110);
    const labDate = lab('27.9.2026 · W4 6406', 540, 1520, { size: 66, weight: 600, dir: 'ltr', color: C.INK, ls: 0.02 });

    // ── עננים שהמטוס צולל אליהם ───────────────────────────
    const bank = G(svg);
    const bankParts = [[-80, 0, 980, 360], [520, 60, 1100, 420], [1120, -10, 960, 380], [260, 260, 1300, 460], [900, 300, 1200, 440], [540, 520, 1600, 600], [100, 600, 1200, 520], [1000, 640, 1200, 520]]
      .map(([x, y, w, h], i) => { const g = G(bank); path(g, cloudD(w, h), i % 3 ? X.CLOUD : X.CLOUD_S, null, 0); svgEl('rect', g, { x: -w / 2, y: h / 2 - 2, width: w, height: 1400, fill: i % 3 ? X.CLOUD : X.CLOUD_S }); return { g, x, y }; });
    const T_CLOUD = 10.1;
    sfx(10.25, 'whoosh', 0.55);

    // ── האגם מלמעלה ──────────────────────────────────────
    const lakeScene = G(svg);
    svgEl('rect', lakeScene, { x: -400, y: -400, width: W + 800, height: H + 800, fill: X.OLIVE_L });
    const lakeCam = G(lakeScene);
    const LK = window.LAKE;
    const lr = rng(7);
    // שדות בדרום והרים בצפון ובצדדים (צורות שטוחות מעוגלות)
    for (let i = 0; i < 9; i++) { const x = -200 + i * 150 + lr() * 60, y = 1360 + lr() * 260; svgEl('rect', lakeCam, { x, y, width: 220 + lr() * 120, height: 90 + lr() * 60, rx: 34, fill: i % 2 ? X.LEMON_L : X.OLIVE, opacity: 0.75, transform: `rotate(${-12 + lr() * 24} ${x} ${y})` }); }
    const hill = (cx, cy, w, h, c) => path(lakeCam, `M${cx - w / 2},${cy} Q${cx - w / 4},${cy - h} ${cx},${cy - h} Q${cx + w / 4},${cy - h} ${cx + w / 2},${cy}Z`, c, null, 0);
    [[200, 420, 520, 380], [-40, 760, 460, 300], [1000, 380, 600, 420], [1060, 900, 520, 360], [560, 120, 700, 420], [300, -60, 600, 340], [880, -40, 560, 380], [-60, 260, 420, 300], [1120, 1260, 460, 280]]
      .forEach(([cx, cy, w, h], i) => hill(cx, cy, w, h, i % 2 ? X.OLIVE : X.OLIVE_D));
    // האגם עצמו: צורה אמיתית מ-OpenStreetMap
    const lakeG = G(lakeCam, { transform: `translate(${540 - LK.w / 2},${200})` });
    path(lakeG, LK.path, X.BLUE_L, null, 0, { transform: 'translate(0,0) scale(1)', 'stroke-width': 26, stroke: X.BLUE_L });
    path(lakeG, LK.path, C.BLUE, C.INK, 4);
    // גלים קטנים
    const waves = [];
    [[420, 600], [520, 900], [380, 1150], [600, 1250], [640, 300], [300, 1320]].forEach(([x, y], i) => waves.push(path(lakeG, `M${x - 26},${y} q13,-14 26,0 q13,14 26,0`, 'none', X.BLUE_L, 4, { opacity: 0.8 })));
    // כפרים: גגות טרקוטה
    Object.entries(LK.places).forEach(([k, [x, y]], i) => {
      const g = G(lakeG);
      const dx = k === 'riva' || k === 'varone' ? 0 : -46;
      for (let j = 0; j < 3; j++) svgEl('rect', g, { x: x + dx + j * 22 - 10, y: y - 18 + (j % 2) * 16, width: 18, height: 18, rx: 4, fill: j === 1 ? X.TERRA_L : C.RED, stroke: C.INK, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
    });
    // סירות
    const boats = [[430, 980, 1], [560, 640, -1], [330, 1240, 1]].map(([x, y, d]) => {
      const g = G(lakeG);
      path(g, `M-46,0 L-70,18 M-46,6 L-74,34`, 'none', '#FFFFFF', 4, { opacity: 0.85 });
      path(g, 'M-40,-10 L36,-10 L22,12 L-28,12Z', X.CLOUD, C.INK, 3);
      return { g, x, y, d };
    });
    // הסיכה על המלון במוניגה
    const [hx, hy] = LK.places.moniga;
    const pin = G(lakeG);
    path(pin, 'M0,0 C-30,-40 -44,-62 -44,-86 A44,44 0 1 1 44,-86 C44,-62 30,-40 0,0Z', C.RED, C.INK, 4);
    svgEl('circle', pin, { cx: 0, cy: -88, r: 17, fill: C.WHITE });
    const T_LAKE = 10.9, T_PIN = 13.2;
    const lakeZoom = track(2.5, [[T_LAKE, 0.8, 2.6, 1]]);
    sfx(T_PIN, 'thud', 0.6);

    // עננים שנפתחים מעל האגם: גושים עגולים שמכסים את כל המסך ונפתחים לצדדים
    const parting = [-1, 1].map((side) => {
      const g = G(svg);
      const rr = rng(side > 0 ? 11 : 23);
      for (let i = 0; i < 26; i++) {
        const y = -200 + (i % 13) * 190 + rr() * 60, x = 540 + side * (140 + rr() * 380) + (i < 13 ? 0 : side * 260);
        svgEl('circle', g, { cx: x, cy: y, r: 260 + rr() * 140, fill: (i + (side > 0 ? 1 : 0)) % 3 ? X.CLOUD : X.CLOUD_S });
      }
      return { g, side };
    });

    // ── הכותרת ───────────────────────────────────────────
    const title = div(root, { left: 0, top: 0 });
    const plate = box(title, 540, 470, 900, 400, { background: C.PAPER, borderRadius: '56px', border: `5px solid ${C.INK}` });
    const tOpt = { font: F.D, weight: 900, size: 124 };
    const wA = 'טואטי', wB = 'בגארדה';
    const wa = measure(wA, tOpt).w, wb = measure(wB, tOpt).w, gap = 40;
    const xr = 540 + (wa + wb + gap) / 2;
    const gA = letters(title, wA, Object.assign({ x: xr - wa / 2, y: 420, color: C.INK }, tOpt));
    const gB = letters(title, wB, Object.assign({ x: xr - wa - gap - wb / 2, y: 420, color: C.BLUE }, tOpt));
    const sub = txt(title, 'המסע מתחיל', { x: 540, y: 590, size: 96, font: F.RUBIK, weight: 700, color: C.RED });
    const T_TITLE = 14.3;
    const spans = [...gA.spans, ...gB.spans];
    sfx(T_TITLE + 0.05, 'sparkle', 0.6); sfx(T_TITLE + 1.0, 'chime', 0.55);

    // גרעיניות סטטית מעל הכל
    const grain = svgBox(root, 0, 0, W, H);
    const gf = svgEl('filter', svgEl('defs', grain), { id: 'grain' });
    svgEl('feTurbulence', gf, { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 3 });
    svgEl('feColorMatrix', gf, { values: '0 0 0 0 0.09  0 0 0 0 0.15  0 0 0 0 0.25  0 0 0 0.55 0' });
    svgEl('rect', grain, { width: W, height: H, filter: 'url(#grain)', opacity: 0.07 });

    // ── seek ─────────────────────────────────────────────
    return (t) => {
      // שמש עולה ועננים נסחפים
      const sunY = lerp(1500, 860, S(t - 0.1, 2.6, 1));
      sun.setAttribute('cy', f2(sunY)); sunRing.setAttribute('cy', f2(sunY));
      sunRing.setAttribute('r', f2(250 + 14 * Math.sin(t * 1.4)));
      farClouds.forEach((c) => setT(c.g, `translate(${f2(c.x + c.sp * t + (t > T_IN && t < T_OUT + 0.5 ? 0 : 0))},${c.y})`));

      // מצלמה כללית: דחיפה עדינה, ובצלילה זום פנימה אל המטוס
      const dive = S(t - T_DIVE, 3.2, 1);
      const sp_ = screenPos(t);
      const camS = 1 + 0.03 * t / DUR + dive * 1.4;
      setT(world, `translate(${f2(sp_[0])},${f2(sp_[1])}) scale(${camS.toFixed(4)}) translate(${f2(-sp_[0])},${f2(-sp_[1] + dive * 320)})`);

      // המטוס: נכנס, נוסע לאורך החלונות, מתרחק וטס על הקו
      const enter = S(t - (T_IN - 0.15), 5, 1);
      const s = scl(t);
      const bob = 10 * Math.sin(t * 1.7) * (1 - S(t - T_OUT, 4, 1)) + 4 * Math.sin(t * 2.3);
      const d = bezD(flyU(t));
      let head = Math.atan2(d[1], d[0]) * 180 / Math.PI - 180; // האף של המטוס מצויר כלפי שמאל
      if (head < -180) head += 360;
      const ang = head * 0.5 * S(t - T_FLY + 0.3, 4, 1) * (1 - S(t - T_FLY1, 4, 1));
      const tilt = -16 * S(t - T_DIVE, 5, 0.9);
      const x0 = sp_[0] + (1 - enter) * 1400;
      setT(planeCam, `translate(${f2(x0)},${f2(sp_[1] + bob)}) scale(${s.toFixed(4)}) translate(${f2(-fx(t))},0)`);
      setT(plane, `rotate(${f2(ang + tilt)} ${f2(fx(t))} 0)`);
      op(planeCam, 1 - S(t - 10.9, 9, 1));
      wins.forEach((w) => {
        const k = S(t - w.t0, 13, 0.82);
        w.shade.setAttribute('height', f2(Math.max(0, WH * (1 - k))));
        const fs = 1 + 0.12 * (1 - k);
        w.face.setAttribute('transform', `translate(${w.wx} ${WY + WH / 2}) scale(${fs.toFixed(4)}) translate(${-w.wx} ${-(WY + WH / 2)})`);
      });

      // מפה
      const mapIn = vis(t, T_OUT + 0.2, 10.4, 10, 18);
      op(mapG, mapIn);
      maskPath.setAttribute('stroke-dashoffset', f2(lineLen * (1 - flyU(t))));
      const pTA = S(t - T_TA, 16, 0.7), pGA = S(t - T_GA, 16, 0.7);
      setT(dotTA, `translate(${TA[0]} ${TA[1]}) scale(${pTA.toFixed(4)}) translate(${-TA[0]} ${-TA[1]})`);
      setT(dotGA, `translate(${GA[0]} ${GA[1]}) scale(${pGA.toFixed(4)}) translate(${-GA[0]} ${-GA[1]})`);
      const lOut = 1 - S(t - 10.0, 22, 1);
      [[labTA, T_TA + 0.1], [labGA, T_GA + 0.1], [labDate, T_DATE]].forEach(([g, t0]) => { const r = rise(t, t0); tf(g, { y: r.y, o: r.o * lOut }); });

      // עננים עולים ומכסים את המסך
      const up = S(t - T_CLOUD, 4.2, 1);
      bankParts.forEach((b, i) => setT(b.g, `translate(${f2(b.x)},${f2(b.y + 2300 - up * (1900 + i * 30))})`));
      op(bank, 1 - S(t - 11.3, 10, 1));

      // האגם: מצלמת רחפן מתרחקת ומסתובבת עד שהכל נכנס
      op(lakeScene, t > T_LAKE - 0.3 ? 1 : 0);
      const lz = lakeZoom(t) * (1 + 0.012 * Math.max(0, t - T_LAKE));
      const lrot = -9 * (1 - S(t - T_LAKE, 2.4, 1)) + 0.25 * Math.max(0, t - T_LAKE - 2);
      const fy = lerp(200 + LK.places.moniga[1], 200 + LK.h / 2, S(t - T_LAKE, 2.6, 1));
      const fxl = lerp(540 - LK.w / 2 + LK.places.moniga[0] + 200, 540, S(t - T_LAKE, 2.6, 1));
      setT(lakeCam, `translate(540 ${f2(1080 + 230 * S(t - T_TITLE + 0.6, 3, 1))}) rotate(${f2(lrot)}) scale(${lz.toFixed(4)}) translate(${f2(-fxl)} ${f2(-fy)})`);
      waves.forEach((wv, i) => op(wv, 0.5 + 0.35 * Math.sin(t * 2 + i)));
      boats.forEach((b) => setT(b.g, `translate(${f2(b.x + b.d * 9 * Math.max(0, t - T_LAKE))},${b.y}) scale(${b.d},1)`));
      const pk = S(t - T_PIN, 14, 0.6);
      setT(pin, `translate(${hx},${f2(hy - (1 - pk) * 120)}) scale(${(0.3 + 0.7 * pk).toFixed(3)})`);
      op(pin, t >= T_PIN ? 1 : 0);
      const part = S(t - (T_LAKE - 0.1), 3.2, 1);
      parting.forEach((p) => { setT(p.g, `translate(${f2(p.side * part * 1300)},0)`); op(p.g, t > T_LAKE - 0.6 ? 1 : 0); });

      // הכותרת: לוח, אותיות מימין לשמאל, ותת כותרת
      const pr = rise(t, T_TITLE - 0.15, 60);
      tf(plate, { y: pr.y, o: pr.o, s: 0.96 + 0.04 * S(t - T_TITLE + 0.15, 14, 0.8) });
      spans.forEach((el, k) => { const r = rise(t, T_TITLE + 0.05 + k * 0.055, 50); el.style.opacity = r.o.toFixed(3); el.style.transform = `translateY(${f2(r.y)}px)`; });
      const sr = rise(t, T_TITLE + 1.0);
      tf(sub, { y: sr.y, o: sr.o });
    };
  });
})();
