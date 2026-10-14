const { useState, useEffect, useRef, useContext, createContext } = React;
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);
const _c = {};
const C = new Proxy({}, { get: (_, k) => _c[k] || (_c[k] = (p) => React.createElement(window.Mock2PitchDesignSystem_feb8de[k], p)) });
const { Button, Icon, Badge, Card, IconButton, ScoreRing, ProgressBar, Input, Select, Checkbox, Dialog } = C;

const DF = { fontFamily: 'var(--font-display)', fontWeight: 400 };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const TOTAL = 8, LIMITS = { sessions: 5, slides: 10, minutes: 20 };

/* ---------------- sample data ---------------- */
const SL = [
  { t: 'ParkSense: Smart Campus Parking', b: ['Team Byte Bandits', 'Hackathon 2026 · Smart Campus track'], w: 20,
    kp: ['Introduce the team and the name ParkSense', 'Say in one line what the app does', 'Open with the late-to-class question'],
    sc: 'Good morning, everyone. We are Team Byte Bandits, and this is ParkSense, a smart parking app for college campuses. Quick question: how many of you have been late to class because you could not find a parking spot?',
    taken: [18, 19], missed: [[2], []], off: [['Our team has four members and two of us are from Pune.'], []],
    tr: 'Good morning everyone. We are Team Byte Bandits and this is ParkSense, a smart parking app for campuses. Quick question, how many of you have been late because you could not find a spot?' },
  { t: 'The problem', b: ['Students circle the campus for 12 minutes on average', 'Main gate lot is full by 9:15 am', 'No live view of free spots'], w: 40,
    kp: ['12 minutes average search time', 'Main gate lot fills by 9:15 am', 'Nobody can see free spots live'],
    sc: 'We surveyed 140 students. On average, they spend 12 minutes circling the campus looking for a spot. The main gate lot is full by 9:15 am, and nobody can see which bays are free until they get there.',
    taken: [47, 41], missed: [[1], []], off: [['I also park badly, so I understand this problem personally.'], []],
    tr: 'We surveyed 140 students. They spend 12 minutes on average circling for a spot. The main gate lot is full by 9:15 am. Basically nobody can see which bays are free until they arrive.' },
  { t: 'Our solution', b: ['Live map of free bays', 'Reserve a spot 15 minutes ahead', 'Gate alerts for security staff'], w: 40,
    kp: ['Live map of free bays', 'Reserve a spot 15 minutes ahead', 'Alerts for security staff'],
    sc: 'ParkSense shows a live map of free bays. You can reserve a spot 15 minutes before you arrive, and security staff get gate alerts when a lot is nearly full.',
    taken: [36, 38], missed: [[2], [2]], off: [[], []],
    tr: 'ParkSense shows a live map of free bays. You can reserve a spot fifteen minutes before you arrive. It is, you know, very simple to use.' },
  { t: 'How it works', b: ['One sensor per bay (ESP32)', 'Cloud sync every 5 seconds', 'App suggests the nearest free bay'], w: 50,
    kp: ['One ESP32 sensor per bay', 'Cloud sync every 5 seconds', 'App suggests the nearest free bay'],
    sc: 'Every bay has a small ESP32 sensor. Each sensor reports to our cloud every 5 seconds. The app then suggests the nearest free bay to wherever you are.',
    taken: [66, 58], missed: [[1, 2], [1]], off: [['We bought the sensors from a shop near our hostel.'], []],
    tr: 'Every bay has a small ESP32 sensor. Basically the sensor reports to our cloud, and the app, like, shows you the nearest free bay. Um, it updates quickly.' },
  { t: 'Tech stack', b: ['React Native app', 'Node.js with an MQTT broker', 'PostgreSQL on AWS'], w: 40,
    kp: ['React Native for the app', 'Node.js with an MQTT broker', 'PostgreSQL hosted on AWS'],
    sc: 'The app is built in React Native. The backend is Node.js with an MQTT broker for sensor messages, and the data sits in PostgreSQL on AWS.',
    taken: [34, 36], missed: [[2], []], off: [[], []],
    tr: 'The app is built in React Native. The backend is Node.js with an MQTT broker, and basically all the data sits in PostgreSQL on AWS. Basically it is cheap to run.' },
  { t: 'Impact', b: ['Pilot: 2 lots, 180 bays', 'Search time down from 12 to 3 minutes', 'Fewer cars circling at peak hours'], w: 40,
    kp: ['Pilot of 2 lots and 180 bays', 'Search time fell from 12 to 3 minutes', 'Fewer cars circling at peak hours'],
    sc: 'In our pilot of 2 lots and 180 bays, the average search time fell from 12 minutes to 3 minutes, and far fewer cars circled at peak hours.',
    taken: [52, 45], missed: [[1, 2], [1]], off: [['Our professor liked the pilot, and she also teaches DBMS.'], []],
    tr: 'In our pilot with two lots and 180 bays, we saw fewer cars circling at peak hours. Um, the results were good. Students found spots faster.' },
  { t: 'Roadmap', b: ['Month 1: main gate pilot', 'Month 3: full campus rollout', 'Month 6: open to other colleges'], w: 40,
    kp: ['Month 1: main gate pilot', 'Month 3: full campus rollout', 'Month 6: other colleges'],
    sc: 'In month 1 we run the main gate pilot. By month 3 we roll out to the full campus. By month 6 we open ParkSense to other colleges.',
    taken: [38, 40], missed: [[], []], off: [[], []],
    tr: 'In month one we run the main gate pilot. By month three we roll out to the full campus. By month six we open ParkSense to other colleges.' },
  { t: 'Thank you', b: ['Our ask: pilot at 2 more campuses', 'Questions?'], w: 30,
    kp: ['State the ask: 2 more campus pilots', 'Thank the jury', 'Invite questions'],
    sc: 'Our ask is support to pilot ParkSense at two more campuses. Thank you for your time. We would love to take your questions.',
    taken: [24, 27], missed: [[1], []], off: [[], []],
    tr: 'Our ask is support to pilot ParkSense at two more campuses. Thank you for your time. We would love your questions.' },
];
const SUB1 = [['Timing', 70, 'timer'], ['Pacing', 58, 'gauge'], ['Filler words', 52, 'message-square-warning'], ['Slide coverage', 66, 'list-checks'], ['Clarity', 64, 'message-square-text']];
const SUB2 = [82, 71, 64, 78, 75];
const SUBS = (a) => SUB1.map((s, i) => [s[0], a === 1 ? s[1] : SUB2[i], s[2]]);
const WPM = { 1: 188, 2: 168 };
const FILL = /\b(um|uh|like|basically|you know|actually)\b/gi;
const trOf = (i, a) => a === 2 ? SL[i].tr : SL[i].tr.split(/(?<=[.?!])\s+/).map((s, k) => k % 2 === 1 ? 'Um, ' + s[0].toLowerCase() + s.slice(1) : s).join(' ');
const fillersOf = (i, a) => { const m = trOf(i, a).match(FILL) || []; const o = {}; m.forEach((x) => { x = x.toLowerCase(); o[x] = (o[x] || 0) + 1; }); return { n: m.length, o }; };
const REPORT = {
  1: { score: 62, head: 'A solid first run. Slow down and cover every key point.',
    fix: ['You spoke at 188 wpm overall. Pause after each key point, especially on slides 4 and 6.', 'You used 14 filler words. "Um" appeared most on slides 4, 6 and 7.', 'You missed 8 key points. The 12 to 3 minute result on slide 6 is your strongest number.'],
    well: ['The opening question on slide 1 was clear and engaging.', 'Slide 7 landed within 2 seconds of its suggested time.', 'Your sentences were complete, with few restarts.'] },
  2: { score: 74, head: 'Clear and confident. Trim the filler words in the middle.',
    fix: ['Slide 4 ran at 186 wpm. Pause after naming each sensor detail.', 'You said "basically" 5 times on slides 2 and 5. Try a short pause instead.', 'On slide 3, add the security staff alerts. It was the only key point left out of 3.'],
    well: ['Your 5:00 target was met within 11 seconds (4:49 total).', 'You covered 21 of 24 key points, up from 16.', 'Your opening question on slide 1 was clear and engaging.'] },
};
const TERMS0 = `## 1. Using Mock2Pitch
Mock2Pitch is a practice tool for students. You must sign in with a Google account and be at least 18 years old, or have permission from a parent or guardian.

## 2. What you can upload
You may upload PPTX or PDF slides of up to 10 slides. Upload only material you have the right to use. We do not review, rate or suggest changes to your slide design.

## 3. Your recordings
Audio is recorded one slide at a time, only while you press Record. We never record video. Audio is deleted as soon as your report is generated.

## 4. Fair use
Each student has a daily limit on practice sessions and a maximum total duration per presentation. These limits may change as the product grows.

## 5. AI feedback
Reports are generated by AI and are meant to guide your practice. They are not a grade or an assessment of you as a person.

## 6. Changes to these terms
If we publish a new version you will be asked to accept it again before you continue.`;
const PRIV0 = `## 1. What we collect
Your name, email address and profile photo from Google, plus the college, year and branch you enter. We also store your slide text and your reports.

## 2. Audio
Your voice is processed only to create your report. Audio is deleted once the report is generated. Reports keep scores, transcripts and feedback, not recordings.

## 3. Who can see your reports
Only you. The product owner can see aggregate usage, your profile details and the star ratings you give to reports.

## 4. AI services
Transcripts and slide text are sent to AI services to create key points, scripts and feedback. They are not used to identify you.

## 5. Your choices
You can edit your profile at any time and ask us to delete your account and reports.`;
const STUDENTS = [
  ['Ananya Rao', 'ananya.rao@gmail.com', 'RV Institute of Technology', '3rd year', 'CSE', 2, 'Today', 68],
  ['Karthik Nair', 'karthik.nair@gmail.com', 'NIT Calicut', '4th year', 'ECE', 7, 'Today', 79],
  ['Meera Joshi', 'meera.joshi@gmail.com', 'COEP Pune', '3rd year', 'CSE', 4, 'Yesterday', 71],
  ['Arjun Reddy', 'arjun.reddy@gmail.com', 'VIT Vellore', '4th year', 'IT', 11, 'Yesterday', 83],
  ['Sneha Patil', 'sneha.patil@gmail.com', 'PICT Pune', '3rd year', 'CSE', 3, '28 Sep', 64],
  ['Rahul Verma', 'rahul.verma@gmail.com', 'IIIT Lucknow', '4th year', 'CSE', 5, '27 Sep', 76],
  ['Divya Menon', 'divya.menon@gmail.com', 'CET Trivandrum', '3rd year', 'EEE', 1, '25 Sep', 58],
  ['Imran Sheikh', 'imran.sheikh@gmail.com', 'MIT Manipal', 'Other', 'Mechanical', 2, '22 Sep', 66],
  ['Pooja Kulkarni', 'pooja.kulkarni@gmail.com', 'BMS College', '4th year', 'CSE', 9, '20 Sep', 81],
  ['Vikram Singh', 'vikram.singh@gmail.com', 'DTU Delhi', '3rd year', 'CSE', 0, '18 Sep', 0],
];
const RATINGS = [
  ['Ananya Rao', 'ParkSense pitch', 5, 'The per-slide breakdown showed exactly where I rushed.', '2 Oct 2026'],
  ['Karthik Nair', 'IoT demo review', 4, 'Useful. I wish the filler list was sorted by slide.', '2 Oct 2026'],
  ['Meera Joshi', 'Placement self-intro', 5, 'Felt safe practising here. No judgement.', '1 Oct 2026'],
  ['Arjun Reddy', 'Final year project', 3, 'Score felt low but the tips were fair.', '1 Oct 2026'],
  ['Sneha Patil', 'Hackathon pitch', 4, '', '29 Sep 2026'],
  ['Rahul Verma', 'Seminar: Edge AI', 5, 'Clarity score helped me fix my sentences.', '28 Sep 2026'],
  ['Divya Menon', 'Mini project', 2, 'Transcript missed a few technical words.', '26 Sep 2026'],
  ['Pooja Kulkarni', 'Placement HR round', 4, 'Good pacing feedback.', '24 Sep 2026'],
];
const AI = [
  ['Speech to text', 'sk-••••••••••••a91f', 3120, 5000, 'mic'],
  ['Slide reader', 'sk-••••••••••••7c2e', 1240, 3000, 'presentation'],
  ['Script and key points', 'sk-••••••••••••e04b', 2185, 4000, 'sparkles'],
  ['Report analysis', 'sk-••••••••••••39d8', 2870, 4000, 'chart-line'],
];
const AUD = [['Prof. Mehta', 'Jury', 0], ['Ms. Iyer', 'Jury', 1], ['Rohan K.', 'Audience', 2], ['Dr. Fernandes', 'Jury', 3], ['Sana', 'Mentor', 4]];
const sug = (min, i) => Math.round(min * 60 * SL[i].w / 300);

/* ---------------- primitives ---------------- */
const Logo = ({ dark, size = 22 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...DF, fontSize: size, color: dark ? '#fff' : 'var(--prussian-blue)' }}>
    <span style={{ width: size + 8, height: size + 8, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#2F5BF0', borderLeftColor: '#2F5BF0', borderRightColor: 'var(--pitch-violet)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-20deg)' }}>
      <span style={{ width: 0, height: 0, borderLeft: `${size * .38}px solid var(--pitch-violet)`, borderTop: `${size * .24}px solid transparent`, borderBottom: `${size * .24}px solid transparent`, marginLeft: 2, transform: 'rotate(20deg)' }} />
    </span>
    <span>Mock<span style={{ color: 'var(--pitch-violet)' }}>2</span>Pitch</span>
  </div>
);
const Overline = ({ children, color = 'var(--bright-marine)', style }) => <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', color, ...style }}>{children}</div>;
const H = ({ l = 1, children, style }) => <div style={{ ...DF, fontSize: [0, 'var(--text-h1)', 'var(--text-h2)', 'var(--text-h3)'][l], lineHeight: 1.2, color: 'var(--text-strong)', ...style }}>{children}</div>;
const P = ({ children, style }) => <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--text-body)', ...style }}>{children}</div>;
const Muted = ({ children, style }) => <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted)', ...style }}>{children}</div>;
const Tile = ({ icon, tone = 'marine', size = 40 }) => <div style={{ width: size, height: size, borderRadius: 12, background: tone === 'violet' ? 'var(--pitch-violet-soft)' : 'var(--marine-50)', color: tone === 'violet' ? '#5B30D9' : 'var(--bright-marine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={icon} size={size * .5} /></div>;
const AIBadge = ({ children = 'AI-generated' }) => <Badge tone="violet"><Icon name="sparkles" size={12} /> {children}</Badge>;
const Google = ({ onClick, label = 'Continue with Google', dark }) => (
  <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 52, padding: '0 28px', borderRadius: 999, border: '1px solid var(--border-strong)', background: '#fff', cursor: 'pointer', ...DF, fontSize: 16, color: 'var(--prussian-blue)', boxShadow: 'var(--shadow-sm)', transition: 'transform .12s' }}
    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(.97)'} onMouseUp={(e) => e.currentTarget.style.transform = 'none'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
    <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.100-13.500-9.900l-7.900 6.100C6.500 42.600 14.600 48 24 48z" /></svg>
    {label}
  </button>
);
const Star = ({ on, size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? '#E8A317' : 'none'} stroke={on ? '#E8A317' : 'var(--ink-300)'} strokeWidth="2" strokeLinejoin="round" style={{ display: 'block' }}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1z" /></svg>;
const Stars = ({ n, size = 16 }) => <span style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} on={i <= n} size={size} />)}</span>;
const Avatar = ({ name, size = 40, bg = 'var(--imperial-blue)', fg = '#fff', style }) => <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, ...DF, fontSize: size * .38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>{name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>;

function SlideView({ i, style }) {
  const s = SL[i];
  return (
    <div style={{ aspectRatio: '16/9', background: '#fff', borderRadius: 8, containerType: 'inline-size', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2.2%', background: i === 0 || i === 7 ? 'var(--imperial-blue)' : 'var(--bright-marine)' }} />
      <div style={{ padding: '7% 8%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: i === 0 || i === 7 ? 'center' : 'flex-start' }}>
        <div style={{ ...DF, fontSize: i === 0 || i === 7 ? '7cqw' : '5.4cqw', color: 'var(--imperial-blue)', lineHeight: 1.1, marginBottom: '4cqw' }}>{s.t}</div>
        {s.b.map((x, k) => <div key={k} style={{ display: 'flex', gap: '1.6cqw', alignItems: 'baseline', fontFamily: 'var(--font-body)', fontSize: '3.4cqw', color: '#2E3557', marginBottom: '1.8cqw' }}>{i !== 0 && <span style={{ width: '1.1cqw', height: '1.1cqw', borderRadius: '50%', background: 'var(--bright-marine)', flexShrink: 0, transform: 'translateY(-.3cqw)' }} />}{x}</div>)}
      </div>
      <div style={{ position: 'absolute', right: '3%', bottom: '3%', fontFamily: 'var(--font-body)', fontSize: '2.2cqw', color: '#9196AE' }}>{i + 1}</div>
    </div>
  );
}
function LineChart({ data, h = 170, color = 'var(--bright-marine)' }) {
  const W = 420, pad = 34, ys = (v) => 14 + (h - 40) * (1 - (v - 40) / 60), xs = (k) => data.length === 1 ? W / 2 : pad + (W - pad - 16) * k / (data.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[40, 60, 80, 100].map((g) => <g key={g}><line x1={pad} x2={W - 8} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" /><text x={0} y={ys(g) + 4} fontSize="11" fill="var(--ink-500)" fontFamily="var(--font-body)">{g}</text></g>)}
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={data.map((v, k) => `${xs(k)},${ys(v)}`).join(' ')} />
      {data.map((v, k) => <g key={k}><circle cx={xs(k)} cy={ys(v)} r="6" fill="#fff" stroke={color} strokeWidth="3" /><text x={xs(k)} y={ys(v) - 12} fontSize="13" textAnchor="middle" fill="var(--prussian-blue)" fontFamily="var(--font-display)">{v}</text><text x={xs(k)} y={h - 6} fontSize="11" textAnchor="middle" fill="var(--ink-500)" fontFamily="var(--font-body)">Attempt {k + 1}</text></g>)}
    </svg>
  );
}
const Bar = ({ v, color = 'var(--bright-marine)', h = 8 }) => <div style={{ height: h, borderRadius: 99, background: 'var(--ink-100)', overflow: 'hidden' }}><div style={{ width: v + '%', height: '100%', background: color, borderRadius: 99, transition: 'width .36s var(--ease-out)' }} /></div>;
const scoreTone = (v) => v >= 75 ? 'var(--success-500)' : v >= 60 ? 'var(--bright-marine)' : 'var(--warning-500)';

/* ---------------- shells ---------------- */
function Shell({ active, children, maxW = 1200 }) {
  const { S, go, m } = useApp();
  const items = [['dashboard', 'Home', 'house', 'dashboard'], ['upload', 'New practice', 'circle-plus', 'upload'], ['history', 'History', 'history', 'history'], ['settings', 'Profile', 'user', 'settings']];
  const start = () => go(S.used >= LIMITS.sessions ? 'limit' : 'upload', { retake: false, uploadErr: null });
  const nav = (k) => k === 'upload' ? start() : go(k);
  if (m) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#fff', borderBottom: '1px solid var(--border-subtle)' }}><Logo size={18} /><Avatar name={S.profile.name} size={32} /></div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>{children}</div>
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', borderTop: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
        {items.map(([k, l, ic]) => <button key={k} onClick={() => nav(k)} style={{ border: 0, background: 'none', padding: '8px 0 6px', minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: active === k ? 'var(--imperial-blue)' : 'var(--ink-500)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: active === k ? 700 : 400, cursor: 'pointer' }}><Icon name={ic} size={22} />{l}</button>)}
      </div>
    </div>
  );
  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg-page)' }}>
      <aside style={{ width: 248, flexShrink: 0, background: '#fff', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: 20, gap: 4 }}>
        <div style={{ padding: '4px 8px 24px' }}><Logo /></div>
        {items.map(([k, l, ic]) => <button key={k} onClick={() => nav(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer', background: active === k ? 'var(--marine-50)' : 'transparent', color: active === k ? 'var(--imperial-blue)' : 'var(--ink-600)', ...DF, fontSize: 15, textAlign: 'left' }}><Icon name={ic} size={20} />{l}</button>)}
        <div style={{ flex: 1 }} />
        <Card variant="sunken" padding={16}><Muted style={{ marginBottom: 8 }}>Practice sessions today</Muted><ProgressBar value={S.used} max={LIMITS.sessions} valueLabel={`${S.used} of ${LIMITS.sessions}`} /></Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 6px 0' }}><Avatar name={S.profile.name} size={36} /><div style={{ minWidth: 0 }}><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>{S.profile.name}</div><Muted style={{ fontSize: 12 }}>{S.profile.year} · {S.profile.branch}</Muted></div></div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: '36px 40px' }}><div style={{ maxWidth: maxW, margin: '0 auto' }}>{children}</div></main>
    </div>
  );
}
const STEPS = [['upload', 'Upload'], ['prep', 'Prepare'], ['time', 'Time'], ['mic', 'Mic check']];
function Flow({ step, children, wide }) {
  const { S, go, m } = useApp();
  const idx = STEPS.findIndex((s) => s[0] === step);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div style={{ flexShrink: 0, height: m ? 56 : 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: m ? '0 16px' : '0 40px', background: '#fff', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
        <Logo size={m ? 18 : 22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: m ? 6 : 14 }}>
          {STEPS.map(([k, l], i) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, color: i <= idx ? 'var(--imperial-blue)' : 'var(--ink-400)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: i === idx ? 700 : 400 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < idx ? 'var(--success-500)' : i === idx ? 'var(--imperial-blue)' : 'var(--ink-100)', color: i <= idx ? '#fff' : 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{i < idx ? <Icon name="check" size={13} /> : i + 1}</span>{!m && l}</div>)}
        </div>
        <IconButton icon="x" label="Exit to dashboard" onClick={() => go('dashboard')} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: m ? 16 : '32px 40px' }}><div style={{ maxWidth: wide ? 1280 : 760, margin: '0 auto' }}>{children}</div></div>
    </div>
  );
}
const Center = ({ children, w = 460 }) => { const { m } = useApp(); return <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: m ? 20 : 40, background: 'var(--bg-page)', boxSizing: 'border-box' }}><div style={{ width: '100%', maxWidth: w }}>{children}</div></div>; };
const Head = ({ title, sub, right }) => { const { m } = useApp(); return <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', justifyContent: 'space-between', alignItems: m ? 'stretch' : 'flex-end', gap: 16, marginBottom: 24 }}><div><H l={1} style={m ? { fontSize: 26 } : null}>{title}</H>{sub && <P style={{ marginTop: 6, color: 'var(--text-muted)' }}>{sub}</P>}</div>{right}</div>; };

/* ---------------- audience avatar ---------------- */
const TONES = [['#16336f', '#d9a98a'], ['#0c2a5e', '#c68e6b'], ['#1d3f86', '#e8bfa3'], ['#0f2457', '#b97f5d'], ['#23458f', '#f0cdb4']];
function Person({ k, label, role, small }) {
  const [bg, skin] = TONES[k];
  return (
    <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: `linear-gradient(160deg, ${bg}, #001C55)`, minWidth: 0 }}>
      <svg viewBox="0 0 120 90" style={{ width: '100%', height: '100%', display: 'block' }}>
        <g style={{ transformOrigin: '60px 90px', animation: `m2pNod ${6 + k * 1.3}s ease-in-out ${k * .7}s infinite` }}>
          <path d="M18 92c0-22 18-30 42-30s42 8 42 30z" fill={k % 2 ? '#e7ecf7' : '#20356b'} opacity=".92" />
          <rect x="52" y="50" width="16" height="14" rx="6" fill={skin} />
          <ellipse cx="60" cy="40" rx="17" ry="19" fill={skin} />
          <path d={k % 2 ? 'M42 38c0-14 8-20 18-20s18 6 18 20c-4-8-10-11-18-11s-14 3-18 11z' : 'M43 34c2-12 9-17 17-17s15 5 17 17c-7-5-12-6-17-6s-10 1-17 6z'} fill="#1b1410" />
          <g style={{ transformOrigin: '60px 41px', animation: `m2pBlink ${4 + k * .9}s linear ${k * 1.1}s infinite` }}><circle cx="53" cy="41" r="2" fill="#1b1410" /><circle cx="67" cy="41" r="2" fill="#1b1410" /></g>
          <path d="M55 49q5 3 10 0" stroke="#7a3d2c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 6, bottom: 6, padding: small ? '1px 6px' : '2px 8px', borderRadius: 99, background: 'rgba(0,7,45,.62)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: small ? 10 : 12, whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}{!small && <span style={{ color: 'var(--icy-blue)' }}> · {role}</span>}</div>
      <div style={{ position: 'absolute', right: 6, top: 6, width: 18, height: 18, borderRadius: 99, background: 'rgba(0,7,45,.55)', color: '#A6E1FA', display: small ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mic-off" size={11} /></div>
    </div>
  );
}
function useLevel(on) {
  const [l, setL] = useState(0);
  useEffect(() => { if (!on) { setL(0); return; } const t = setInterval(() => setL((p) => Math.max(.08, Math.min(1, p * .4 + Math.random() * .75))), 120); return () => clearInterval(t); }, [on]);
  return l;
}
function SelfTile({ speaking, small, level }) {
  const { S } = useApp();
  const sz = small ? 34 : 52;
  return (
    <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, background: '#0A2472', display: 'flex', alignItems: 'center', justifyContent: 'center', border: speaking ? '2px solid var(--icy-blue)' : '2px solid transparent', minWidth: 0 }}>
      <div style={{ borderRadius: '50%', boxShadow: speaking ? `0 0 0 ${3 + level * 12}px rgba(166,225,250,.28), 0 0 0 ${1 + level * 5}px rgba(166,225,250,.7)` : 'none', transition: 'box-shadow .12s' }}><Avatar name={S.profile.name} size={sz} bg="#A6E1FA" fg="#00072D" /></div>
      <div style={{ position: 'absolute', left: 6, bottom: 6, padding: small ? '1px 6px' : '2px 8px', borderRadius: 99, background: 'rgba(0,7,45,.62)', color: '#fff', fontFamily: 'var(--font-body)', fontSize: small ? 10 : 12 }}>You</div>
      <div style={{ position: 'absolute', right: 6, top: 6, width: 18, height: 18, borderRadius: 99, background: speaking ? 'var(--success-500)' : 'rgba(0,7,45,.55)', color: '#fff', display: small ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={speaking ? 'mic' : 'mic-off'} size={11} /></div>
    </div>
  );
}

/* ---------------- guest screens ---------------- */
function ReportPreview() {
  return (
    <Card padding={24} style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <ScoreRing value={74} size={110} stroke={10} label="of 100" />
        <div style={{ flex: 1, minWidth: 160 }}><Badge tone="success">+12 from attempt 1</Badge><div style={{ ...DF, fontSize: 18, color: 'var(--text-strong)', marginTop: 8, lineHeight: 1.25 }}>Clear and confident. Trim the filler words in the middle.</div></div>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>{SUBS(2).map(([l, v]) => <div key={l} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 28px', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-body)' }}>{l}<Bar v={v} color={scoreTone(v)} /><b>{v}</b></div>)}</div>
    </Card>
  );
}
function RoomPreview() {
  return (
    <div style={{ background: 'var(--prussian-blue)', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: '1fr 28%', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}><SlideView i={3} style={{ boxShadow: 'none' }} /><div style={{ alignSelf: 'center', display: 'flex', gap: 8, padding: 8, borderRadius: 99, background: 'rgba(166,225,250,.12)' }}>{['chevron-left', 'mic', 'play', 'chevron-right'].map((x, i) => <span key={x} style={{ width: 30, height: 30, borderRadius: '50%', background: i === 1 ? 'var(--danger-500)' : 'rgba(166,225,250,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={x} size={15} /></span>)}</div></div>
      <div style={{ display: 'grid', gap: 6, alignContent: 'center' }}>{[0, 1, 2].map((k) => <Person key={k} k={k} label={AUD[k][0]} small />)}<SelfTile small level={0} /></div>
    </div>
  );
}
function Landing() {
  const { go, m, w } = useApp();
  const stack = m || w < 1100;
  const pad = m ? '0 20px' : '0 64px';
  const steps = [['upload', 'Upload slides', 'PPTX or PDF, up to 10 slides. We read them and suggest key points and a script for each one.'], ['mic', 'Practice out loud', 'Set your time, then present slide by slide to a quiet room of jury members. Audio only.'], ['chart-line', 'Get your report', 'A score out of 100, what you did well, and the top 3 things to fix next time.']];
  return (
    <div style={{ minHeight: '100%', background: '#fff' }}>
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: pad }}><Logo size={m ? 18 : 22} /><Button variant="secondary" size="sm" onClick={() => go('signin')}>Sign in</Button></div>
      <section style={{ padding: m ? '32px 20px 48px' : '56px 64px 80px', display: 'grid', gridTemplateColumns: stack ? '1fr' : '1.05fr .95fr', gap: stack ? 32 : 64, alignItems: 'center', maxWidth: 1280, margin: '0 auto', boxSizing: 'border-box' }}>
        <div>
          <Overline>Practice • Improve • Pitch</Overline>
          <div style={{ ...DF, fontSize: m ? 38 : 56, lineHeight: 1.08, color: 'var(--prussian-blue)', margin: '16px 0 20px' }}>Rehearse your pitch in private. Walk in ready.</div>
          <P style={{ fontSize: 18, maxWidth: 520 }}>Upload your slides, present out loud to a calm virtual jury, and get honest, encouraging feedback before the real one.</P>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: m ? 'stretch' : 'flex-start', gap: 12, marginTop: 28 }}><Google onClick={() => go('signin')} /><Muted>Free to start · Audio only, no camera · English</Muted></div>
        </div>
        <div style={{ position: 'relative' }}><RoomPreview /><div style={{ position: stack ? 'relative' : 'absolute', right: 0, bottom: stack ? 0 : -48, width: stack ? '100%' : '62%', maxWidth: stack ? 520 : '100%', marginTop: stack ? 16 : 0 }}><ReportPreview /></div></div>
      </section>
      <section style={{ background: 'var(--bg-page)', padding: m ? '48px 20px' : '88px 64px' }}><div style={{ maxWidth: 1152, margin: '0 auto' }}>
        <Overline>How it works</Overline><H l={1} style={{ margin: '10px 0 28px', fontSize: m ? 26 : 32 }}>Three steps from slides to feedback</H>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(3,1fr)', gap: 20 }}>{steps.map(([ic, t, d], i) => <Card key={t} padding={24}><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}><Tile icon={ic} /><span style={{ ...DF, color: 'var(--ink-400)', fontSize: 15 }}>Step {i + 1}</span></div><H l={2} style={{ fontSize: 21, marginBottom: 8 }}>{t}</H><P>{d}</P></Card>)}</div>
      </div></section>
      <section style={{ padding: m ? '48px 20px' : '88px 64px' }}><div style={{ maxWidth: 1152, margin: '0 auto', display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 32 }}>
        <div><Overline>Practice room</Overline><H l={2} style={{ margin: '8px 0 14px' }}>Present like it is the real thing</H><P style={{ marginBottom: 20 }}>A meeting-style room with a quiet jury, a timer per slide and one recording per slide. You can re-record any slide before you submit.</P><RoomPreview /></div>
        <div><Overline>Feedback report</Overline><H l={2} style={{ margin: '8px 0 14px' }}>Specific, kind and easy to act on</H><P style={{ marginBottom: 20 }}>Scores for timing, pacing, filler words, slide coverage and clarity, with a breakdown for every slide.</P><ReportPreview /></div>
      </div></section>
      <section style={{ padding: m ? '0 20px 48px' : '0 64px 88px' }}><div style={{ maxWidth: 1152, margin: '0 auto', background: 'var(--prussian-blue)', borderRadius: 24, padding: m ? 28 : 56, display: 'grid', gridTemplateColumns: m ? '1fr' : '1.2fr 1fr', gap: 32, alignItems: 'center' }}>
        <div><Overline color="var(--icy-blue)">Private by design</Overline><div style={{ ...DF, fontSize: m ? 26 : 36, color: '#fff', margin: '12px 0 14px', lineHeight: 1.15 }}>Practise alone. Nobody is watching.</div><P style={{ color: 'var(--icy-blue)' }}>Your audio is deleted as soon as your report is ready. Only your report stays, and only you can see it.</P></div>
        <div style={{ display: 'grid', gap: 12 }}>{[['mic', 'Audio only. No camera, ever.'], ['trash-2', 'Audio deleted after your report'], ['lock', 'Reports are visible only to you']].map(([ic, t]) => <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(166,225,250,.1)', color: '#fff', fontFamily: 'var(--font-body)' }}><Icon name={ic} size={20} color="var(--icy-blue)" />{t}</div>)}</div>
      </div></section>
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: m ? '24px 20px' : '28px 64px', display: 'flex', flexDirection: m ? 'column' : 'row', gap: 16, justifyContent: 'space-between', alignItems: m ? 'flex-start' : 'center' }}>
        <Logo size={18} /><div style={{ display: 'flex', gap: 24, fontFamily: 'var(--font-body)', fontSize: 14 }}>{[['Terms', () => go('terms', { termsView: 'Terms', back: 'landing' })], ['Privacy Policy', () => go('terms', { termsView: 'Privacy', back: 'landing' })], ['Owner sign in', () => go('adminSignin')]].map(([l, f]) => <a key={l} onClick={f} style={{ color: 'var(--text-link)', cursor: 'pointer' }}>{l}</a>)}</div>
      </footer>
    </div>
  );
}
function SignIn() {
  const { S, go } = useApp();
  const next = () => S.accepted ? go(S.profileDone ? 'dashboard' : 'profile') : go('terms', { termsUpdate: false, termsView: null });
  return <Center><Card padding={36} style={{ textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}><Logo /></div>
    <H l={1} style={{ fontSize: 28 }}>Welcome back</H><P style={{ margin: '10px 0 28px' }}>Sign in to practise your next presentation.</P>
    <Google onClick={next} />
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 24, textAlign: 'left' }}><Icon name="shield-check" size={18} color="var(--bright-marine)" /><Muted>Practice is private. Audio is deleted after your report.</Muted></div>
    <a onClick={() => go('landing')} style={{ display: 'inline-block', marginTop: 20, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-link)', cursor: 'pointer' }}>Back to home</a>
  </Card></Center>;
}
function Doc({ text }) {
  return <>{text.split('\n\n').map((b, i) => b.startsWith('## ') ? <div key={i}><div style={{ ...DF, fontSize: 17, color: 'var(--text-strong)', margin: '18px 0 6px' }}>{b.split('\n')[0].slice(3)}</div><P style={{ fontSize: 15 }}>{b.split('\n').slice(1).join(' ')}</P></div> : <P key={i} style={{ fontSize: 15 }}>{b}</P>)}</>;
}
function Terms() {
  const { S, go, set, m } = useApp();
  const [tab, setTab] = useState(S.termsView || 'Terms');
  const [ok, setOk] = useState(false);
  const view = !!S.termsView;
  const done = () => { set({ accepted: true }); go(S.profileDone ? 'dashboard' : 'profile'); };
  return <Center w={760}><Card padding={m ? 20 : 36}>
    {view && <a onClick={() => go(S.back || 'settings')} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-body)', marginBottom: 12 }}><Icon name="chevron-left" size={16} />Back</a>}
    {S.termsUpdate && !view && <div style={{ background: 'var(--marine-50)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}><Tile icon="file-text" /><div><div style={{ ...DF, fontSize: 17, color: 'var(--text-strong)' }}>We've updated our terms</div><Muted>New version {S.versions[0].v} · published {S.versions[0].date}. Please review and accept to continue.</Muted></div></div>}
    {!S.termsUpdate && !view && <H l={1} style={{ fontSize: 26, marginBottom: 6 }}>Before you start</H>}
    {!view && <P style={{ marginBottom: 14 }}>Please read and accept our Terms and Privacy Policy.</P>}
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>{['Terms', 'Privacy'].map((t) => <button key={t} onClick={() => setTab(t)} style={{ height: 36, padding: '0 18px', borderRadius: 99, border: '1px solid ' + (tab === t ? 'var(--imperial-blue)' : 'var(--border-strong)'), background: tab === t ? 'var(--imperial-blue)' : '#fff', color: tab === t ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 14, cursor: 'pointer' }}>{t === 'Terms' ? 'Terms' : 'Privacy Policy'}</button>)}</div>
    <div style={{ height: m ? 280 : 320, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '4px 20px 16px', background: 'var(--ink-50)' }}><Doc text={tab === 'Terms' ? S.terms : S.priv} /></div>
    {!view && <><div style={{ margin: '20px 0' }}><Checkbox checked={ok} onChange={setOk} label="I have read and agree to the Terms and the Privacy Policy" /></div><Button fullWidth disabled={!ok} onClick={done}>Continue</Button></>}
  </Card></Center>;
}
function Profile() {
  const { S, set, go, m } = useApp();
  const [f, setF] = useState({ college: S.profile.college, year: S.profile.year, branch: S.profile.branch });
  const [err, setErr] = useState('');
  return <Center w={560}><Card padding={m ? 22 : 36}>
    <Overline>Step 2 of 2</Overline><H l={1} style={{ fontSize: 28, margin: '8px 0 6px' }}>Tell us a little about you</H><P style={{ marginBottom: 22 }}>This helps us tailor examples. Only you and the product owner can see it.</P>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--ink-50)', borderRadius: 14, marginBottom: 20 }}><Avatar name={S.profile.name} size={52} /><div><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>{S.profile.name}</div><Muted>{S.profile.email} · from Google</Muted></div></div>
    <div style={{ display: 'grid', gap: 16 }}>
      <Input label="College" placeholder="e.g. RV Institute of Technology" value={f.college} error={err} onChange={(e) => { setF({ ...f, college: e.target.value }); setErr(''); }} />
      <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 16 }}><Select label="Year" options={['3rd year', '4th year', 'Other']} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /><Select label="Branch" options={['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other']} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} /></div>
    </div>
    <Button fullWidth style={{ marginTop: 24 }} onClick={() => { if (!f.college.trim()) return setErr('Enter your college name'); set({ profile: { ...S.profile, ...f }, profileDone: true }); go('dashboard'); }}>Save and continue</Button>
  </Card></Center>;
}

/* ---------------- student app ---------------- */
function Dashboard() {
  const { S, go, m } = useApp();
  const scores = [62, 74].slice(0, S.attempts);
  const start = () => go(S.used >= LIMITS.sessions ? 'limit' : 'upload', { retake: false, uploadErr: null });
  const first = S.profile.name.split(' ')[0];
  return <Shell active="dashboard">
    <Head title={`Hi ${first}, ready to rehearse?`} sub="Take a breath. Nobody is watching but you." right={!m && <Button size="lg" iconLeft="plus" onClick={start}>Start a new practice</Button>} />
    {m && <Button fullWidth size="lg" iconLeft="plus" onClick={start} style={{ marginBottom: 16 }}>Start a new practice</Button>}
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.6fr 1fr', gap: 20 }}>
      <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        {S.attempts === 0 ? (
          <Card padding={m ? 28 : 48} style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Tile icon="presentation" size={56} /></div><H l={2}>Your first practice starts here</H><P style={{ margin: '8px auto 20px', maxWidth: 420 }}>Upload up to 10 slides. We'll suggest key points and a script, then you present slide by slide.</P><Button onClick={start}>Upload slides</Button></Card>
        ) : (
          <Card padding={0}>
            <div style={{ padding: '20px 24px 12px' }}><H l={3}>Recent decks</H></div>
            <div onClick={() => go('deck')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
              <Tile icon="presentation" size={48} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>ParkSense hackathon pitch</div><Muted>8 slides · 5:00 · {S.attempts} {S.attempts === 1 ? 'attempt' : 'attempts'}</Muted></div>
              <div style={{ textAlign: 'right' }}><div style={{ ...DF, fontSize: 28, color: scoreTone(scores[scores.length - 1]) }}>{scores[scores.length - 1]}</div><Muted style={{ fontSize: 12 }}>latest score</Muted></div><Icon name="chevron-right" size={18} color="var(--ink-400)" />
            </div>
          </Card>
        )}
        <Card><H l={3} style={{ marginBottom: 4 }}>Your progress</H><Muted style={{ marginBottom: 12 }}>Score across recent attempts</Muted>{S.attempts ? <LineChart data={scores} /> : <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-400)', fontFamily: 'var(--font-body)', background: 'var(--ink-50)', borderRadius: 12 }}>Your score trend will appear after your first report</div>}</Card>
      </div>
      <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        <Card><H l={3} style={{ marginBottom: 12 }}>Today's usage</H><ProgressBar value={S.used} max={LIMITS.sessions} valueLabel={`${S.used} of ${LIMITS.sessions} sessions`} label="Practice sessions" /><Muted style={{ marginTop: 12 }}>Resets at midnight IST. Up to {LIMITS.slides} slides and {LIMITS.minutes} minutes per presentation.</Muted></Card>
        <Card><H l={3} style={{ marginBottom: 14 }}>Your practice so far</H>{S.attempts === 0 ? <div style={{ textAlign: 'center', padding: '12px 0 4px' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Tile icon="mic" size={48} /></div><div style={{ ...DF, fontSize: 17, color: 'var(--text-strong)' }}>Ready for your first practice</div><Muted style={{ margin: '6px 0 14px' }}>Your average score, best score and practice time will show here.</Muted><Button size="sm" onClick={start}>Start now</Button></div> :
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{[['Average score', Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 'across all attempts'], ['Best score', Math.max(...scores), 'attempt ' + (scores.indexOf(Math.max(...scores)) + 1)], ['Practice time', S.attempts > 1 ? '10:19' : '5:15', 'minutes spoken'], ['Key points', S.attempts > 1 ? '21/24' : '16/24', 'covered last time']].map(([l, v, s]) => <div key={l} style={{ padding: 14, borderRadius: 12, background: 'var(--ink-50)' }}><Muted style={{ fontSize: 13 }}>{l}</Muted><div style={{ ...DF, fontSize: 26, color: 'var(--text-strong)', margin: '4px 0 0' }}>{v}</div><Muted style={{ fontSize: 12 }}>{s}</Muted></div>)}</div>}</Card>
      </div>
    </div>
  </Shell>;
}
function Upload() {
  const { S, go, set, m } = useApp();
  const [drag, setDrag] = useState(false);
  const fi = useRef();
  const err = S.uploadErr;
  const take = (file) => {
    if (!file) return;
    if (!/\.(pptx|pdf)$/i.test(file.name)) return set({ uploadErr: 'type', fileName: file.name });
    set({ uploadErr: null, fileName: file.name }); go('extracting', { fileName: file.name });
  };
  const msgs = { type: ['Unsupported file type', 'We can only read PPTX or PDF files. Export your slides as PDF and try again.'], count: ['That deck has 14 slides', `Decks can have up to ${LIMITS.slides} slides. Remove a few and upload again.`], fail: ['Upload failed', 'The upload was interrupted. Check your connection and try again.'] };
  return <Flow step="upload">
    <Head title="Upload your slides" sub="PPTX or PDF, up to 10 slides. We only read the text. Your slide design is never rated." />
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }} onClick={() => fi.current.click()}
      style={{ cursor: 'pointer', border: '2px dashed ' + (drag ? 'var(--bright-marine)' : 'var(--border-strong)'), background: drag ? 'var(--marine-50)' : '#fff', borderRadius: 20, padding: m ? '40px 20px' : '64px 24px', textAlign: 'center', transition: 'all .2s' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Tile icon="upload" size={56} /></div>
      <H l={2} style={{ fontSize: 20 }}>{m ? 'Tap to choose your slides' : 'Drag your slides here'}</H><Muted style={{ margin: '6px 0 18px' }}>PPTX or PDF · up to 10 slides</Muted><Button variant="secondary">Choose a file</Button>
      <input ref={fi} type="file" accept=".pptx,.pdf" hidden onChange={(e) => take(e.target.files[0])} />
    </div>
    {err && <div style={{ display: 'flex', gap: 12, padding: 16, borderRadius: 14, background: 'var(--danger-50)', marginTop: 12, alignItems: 'flex-start' }}><Icon name="triangle-alert" size={20} color="var(--danger-500)" /><div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--danger-500)' }}>{msgs[err][0]}</div><Muted style={{ color: 'var(--ink-700)' }}>{msgs[err][1]}</Muted></div></div>}
    <Card variant="sunken" padding={16} style={{ marginTop: 20 }}>
      <Muted style={{ marginBottom: 10 }}>Prototype shortcuts</Muted>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="sm" variant="accent" onClick={() => go('extracting', { fileName: 'ParkSense-pitch.pptx', uploadErr: null })}>Use ParkSense-pitch.pptx</Button>
        <Button size="sm" variant="secondary" onClick={() => set({ uploadErr: 'type' })}>Show: wrong file type</Button>
        <Button size="sm" variant="secondary" onClick={() => set({ uploadErr: 'count' })}>Show: too many slides</Button>
        <Button size="sm" variant="secondary" onClick={() => set({ uploadErr: 'fail' })}>Show: upload failed</Button>
      </div>
    </Card>
  </Flow>;
}
function Extracting() {
  const { S, go, m } = useApp();
  const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN((x) => x + 1), 550); return () => clearInterval(t); }, []);
  useEffect(() => { if (n > TOTAL + 2) go('prep', { sel: 0 }); }, [n]);
  const stage = n < 2 ? 'Reading your file' : n < TOTAL ? 'Finding the text on each slide' : 'Writing key points and a script';
  return <Flow step="upload"><div style={{ textAlign: 'center', paddingTop: m ? 8 : 40 }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><AIBadge>AI is reading your slides</AIBadge></div>
    <H l={1}>{stage}…</H><P style={{ margin: '8px 0 24px' }}>{S.fileName || 'ParkSense-pitch.pptx'} · this takes a few seconds</P>
    <div style={{ maxWidth: 420, margin: '0 auto 32px' }}><ProgressBar value={Math.min(n, TOTAL + 1)} max={TOTAL + 1} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16 }}>{SL.map((_, i) => <div key={i} style={{ opacity: i < n ? 1 : .15, transform: i < n ? 'none' : 'translateY(8px) scale(.97)', transition: 'all .4s var(--ease-out)' }}><SlideView i={i} style={{ boxShadow: 'var(--shadow-md)' }} /><Muted style={{ marginTop: 6 }}>Slide {i + 1}</Muted></div>)}</div>
  </div></Flow>;
}
function Prep() {
  const { S, go, set, m } = useApp();
  const i = S.sel || 0, s = SL[i];
  const [tab, setTab] = useState('kp');
  const kp = <Card padding={20}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Overline>Key points to cover</Overline><AIBadge /></div>{s.kp.map((k, x) => <div key={x} style={{ display: 'flex', gap: 10, padding: '8px 0', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-body)' }}><Icon name="circle-check" size={18} color="var(--bright-marine)" style={{ marginTop: 3 }} />{k}</div>)}</Card>;
  const sc = <Card padding={20}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Overline>Suggested script</Overline><AIBadge /></div><P style={{ fontSize: 15 }}>{s.sc}</P><Muted style={{ marginTop: 10 }}>About {sug(5, i)} seconds at a relaxed pace.</Muted></Card>;
  const thumbs = SL.map((_, x) => <div key={x} onClick={() => set({ sel: x })} style={{ cursor: 'pointer', flexShrink: 0, width: m ? 108 : 'auto', padding: 6, borderRadius: 12, border: '2px solid ' + (x === i ? 'var(--bright-marine)' : 'transparent'), background: x === i ? 'var(--marine-50)' : 'transparent' }}><SlideView i={x} style={{ boxShadow: 'var(--shadow-sm)' }} /><Muted style={{ fontSize: 12, marginTop: 4 }}>Slide {x + 1}</Muted></div>);
  return <Flow step="prep" wide>
    <Head title="Prepare your slides" sub="Study material only. Your slides stay exactly as you uploaded them." right={!m && <Button iconRight="arrow-right" onClick={() => go('time')}>Continue to set time</Button>} />
    {m ? <div style={{ display: 'grid', gap: 14 }}>
      <SlideView i={i} /><div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>{thumbs}</div>
      <div style={{ display: 'flex', gap: 8 }}>{[['kp', 'Key points'], ['sc', 'Script']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, height: 44, borderRadius: 99, border: '1px solid var(--border-strong)', background: tab === k ? 'var(--imperial-blue)' : '#fff', color: tab === k ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 14 }}>{l}</button>)}</div>
      {tab === 'kp' ? kp : sc}<Button fullWidth size="lg" onClick={() => go('time')}>Continue to set time</Button>
    </div> : <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 360px', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 6, maxHeight: 560, overflow: 'auto' }}>{thumbs}</div>
      <div><SlideView i={i} /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}><Button variant="ghost" size="sm" disabled={i === 0} iconLeft="chevron-left" onClick={() => set({ sel: i - 1 })}>Previous</Button><Muted style={{ alignSelf: 'center' }}>Slide {i + 1} of {TOTAL}</Muted><Button variant="ghost" size="sm" disabled={i === TOTAL - 1} iconRight="chevron-right" onClick={() => set({ sel: i + 1 })}>Next</Button></div></div>
      <div style={{ display: 'grid', gap: 16 }}>{kp}{sc}</div>
    </div>}
  </Flow>;
}
function Time() {
  const { S, go, set, m } = useApp();
  const [v, setV] = useState(String(S.minutes));
  const n = Number(v);
  const bad = !v || isNaN(n) || n < 1 ? 'Enter at least 1 minute' : n > LIMITS.minutes ? `The maximum is ${LIMITS.minutes} minutes` : '';
  const ok = !bad;
  const mins = ok ? n : S.minutes;
  return <Flow step="time">
    <Head title="Set your time" sub="Choose one total duration. We'll split it across your slides." />
    <Card><div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: 20, alignItems: m ? 'stretch' : 'flex-end' }}>
      <Input label="Total duration (minutes)" type="number" value={v} error={bad} onChange={(e) => setV(e.target.value)} style={{ width: m ? '100%' : 240 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: bad ? 22 : 0 }}>{[3, 5, 7, 10].map((p) => <button key={p} onClick={() => setV(String(p))} style={{ height: 44, minWidth: 64, padding: '0 18px', borderRadius: 99, border: '1px solid ' + (n === p ? 'var(--imperial-blue)' : 'var(--border-strong)'), background: n === p ? 'var(--imperial-blue)' : '#fff', color: n === p ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 15, cursor: 'pointer' }}>{p} min</button>)}</div>
    </div></Card>
    <Card padding={0} style={{ marginTop: 20 }}>
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><H l={3}>Suggested time per slide</H><Badge tone="info">Total {mmss(mins * 60)}</Badge></div>
      {SL.map((s, k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: m ? '28px 1fr 56px' : '36px 1fr 200px 64px', gap: 14, alignItems: 'center', padding: m ? '12px 16px' : '12px 24px', borderTop: '1px solid var(--border-subtle)', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-body)' }}>
        <span style={{ color: 'var(--ink-400)' }}>{k + 1}</span><span style={{ color: 'var(--text-strong)' }}>{s.t}</span>{!m && <Bar v={s.w / .5} />}<b style={{ textAlign: 'right' }}>{mmss(sug(mins, k))}</b></div>)}
    </Card>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '16px 4px' }}><Icon name="timer" size={18} color="var(--bright-marine)" /><Muted>The timer turns red if you run over. It never stops you, and recording is never cut off.</Muted></div>
    <Button fullWidth={m} size="lg" disabled={!ok} onClick={() => { set({ minutes: mins }); go('mic'); }}>Continue to mic check</Button>
  </Flow>;
}
function Mic() {
  const { S, go, set, m } = useApp();
  const st = S.mic;
  const lvl = useLevel(st === 'granted');
  return <Flow step="mic">
    <Head title="Mic check" sub="Like a meeting green room. Test your microphone before you enter." />
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.2fr 1fr', gap: 20 }}>
      <Card>
        {st === 'denied' ? <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}><Tile icon="mic-off" /><div><H l={3}>Microphone access is blocked</H><P style={{ fontSize: 15 }}>We can't hear you yet. This takes about 30 seconds to fix.</P></div></div>
          <ol style={{ margin: '0 0 18px', paddingLeft: 20, fontFamily: 'var(--font-body)', lineHeight: 1.9, color: 'var(--text-body)' }}><li>Click the lock icon next to the web address.</li><li>Set Microphone to Allow.</li><li>Reload this page, or press Try again.</li></ol>
          <Button onClick={() => set({ mic: 'granted' })}>Try again</Button>
        </div> : st === 'idle' ? <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Tile icon="mic" size={56} /></div><H l={3}>Allow microphone access</H><P style={{ margin: '6px 0 18px', fontSize: 15 }}>Your browser will ask for permission. We only record while you press Record.</P>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}><Button onClick={() => set({ mic: 'granted' })}>Allow microphone</Button><Button variant="ghost" onClick={() => set({ mic: 'denied' })}>Demo: block it</Button></div>
        </div> : <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}><Badge tone="success" dot>Microphone connected</Badge></div>
          <Muted style={{ marginBottom: 8 }}>Say something. The bars should move.</Muted>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 72, padding: 12, background: 'var(--ink-50)', borderRadius: 12 }}>{Array.from({ length: 28 }, (_, k) => { const on = k / 28 < lvl; return <div key={k} style={{ flex: 1, height: 8 + (k % 6) * 6 + 12, borderRadius: 4, background: on ? (k > 22 ? 'var(--warning-500)' : 'var(--bright-marine)') : 'var(--ink-200)', transition: 'background .1s' }} />; })}</div>
          <Muted style={{ marginTop: 10 }}>Input level: {lvl > .75 ? 'a little loud' : lvl > .3 ? 'good' : 'speak up a little'}</Muted>
        </div>}
      </Card>
      <Card><H l={3} style={{ marginBottom: 12 }}>Before you enter</H>{[['volume-x', 'Find a quiet room'], ['message-circle', 'Speak naturally, as you would to a jury'], ['circle-dot', 'Each slide is a separate recording'], ['rotate-ccw', 'You can re-record any slide before you submit']].map(([ic, t]) => <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', fontFamily: 'var(--font-body)', color: 'var(--text-body)' }}><Tile icon={ic} size={32} />{t}</div>)}</Card>
    </div>
    <Button fullWidth={m} size="lg" disabled={st !== 'granted'} style={{ marginTop: 20 }} onClick={() => go('room', { cur: 0, recs: S.retake ? {} : S.recs, preset: null })}>Enter practice room</Button>
  </Flow>;
}

/* ---------------- practice room ---------------- */
const STAT = { none: ['var(--ink-500)', 'Not recorded'], rec: ['var(--danger-500)', 'Recording'], done: ['var(--success-500)', 'Recorded'], over: ['var(--warning-500)', 'Over time'] };
function Room() {
  const { S, set, go, m } = useApp();
  const pre = S.preset;
  const [rec, setRec] = useState(pre === 'recording' || pre === 'overrun');
  const [el, setEl] = useState(pre === 'recording' ? 14 : pre === 'overrun' ? sug(S.minutes, S.cur) + 9 : 0);
  const [play, setPlay] = useState(null);
  const [notes, setNotes] = useState(false);
  const [leave, setLeave] = useState(pre === 'leave');
  const cur = S.cur, recs = S.recs;
  useEffect(() => { if (pre === 'recorded') set({ recs: { ...recs, [cur]: { dur: 19 } }, preset: null }); else if (pre) set({ preset: null }); }, []);
  useEffect(() => { if (!rec) return; const t = setInterval(() => setEl((e) => e + 1), 1000); return () => clearInterval(t); }, [rec]);
  useEffect(() => { if (play === null) return; const d = Math.min(recs[cur] ? recs[cur].dur : 3, 6); const t = setInterval(() => setPlay((p) => p === null ? null : p + 1 >= d ? null : p + 1), 1000); return () => clearInterval(t); }, [play === null, cur]);
  const level = useLevel(rec);
  const sg = sug(S.minutes, cur), over = rec && el > sg;
  const status = (i) => i === cur && rec ? 'rec' : recs[i] ? (recs[i].dur > sug(S.minutes, i) ? 'over' : 'done') : 'none';
  const here = status(cur);
  const total = Object.entries(recs).reduce((a, [k, v]) => a + (Number(k) === cur && rec ? 0 : v.dur), 0) + (rec ? el : 0);
  const start = () => { setEl(0); setRec(true); setPlay(null); };
  const stop = () => { set({ recs: { ...S.recs, [cur]: { dur: Math.max(el, 1) } } }); setRec(false); };
  const re = () => { const r = { ...S.recs }; delete r[cur]; set({ recs: r }); setPlay(null); start(); };
  const nav = (d) => { setPlay(null); setEl(0); set({ cur: cur + d }); };
  const Ctl = ({ icon, label, onClick, disabled, kind, big }) => <button disabled={disabled} onClick={onClick} title={label} style={{ border: 0, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .35 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 11, padding: 0, minWidth: m ? 44 : 64 }}>
    <span style={{ width: kind === 'leave' ? 68 : big ? 56 : 48, height: big ? 56 : 48, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: kind === 'rec' || kind === 'leave' ? 'var(--danger-500)' : 'rgba(166,225,250,.16)', color: '#fff', boxShadow: kind === 'rec' && !disabled ? 'var(--shadow-record)' : 'none', transition: 'transform .12s' }}><span style={{ display: 'flex', transform: kind === 'leave' ? 'rotate(135deg)' : 'none' }}><Icon name={icon} size={big ? 24 : 22} /></span></span>{label}</button>;
  const ctls = <div style={{ display: 'flex', gap: m ? 4 : 12, justifyContent: 'center', alignItems: 'flex-start' }}>
    <Ctl icon="chevron-left" label="Previous" disabled={rec || cur === 0} onClick={() => nav(-1)} />
    <Ctl icon="mic" label="Record" kind="rec" big disabled={rec || !!recs[cur]} onClick={start} />
    <Ctl icon="square" label="Stop" disabled={!rec} onClick={stop} />
    <Ctl icon="play" label="Play back" disabled={rec || !recs[cur]} onClick={() => setPlay(0)} />
    <Ctl icon="rotate-ccw" label="Re-record" disabled={rec || !recs[cur]} onClick={re} />
    <Ctl icon="chevron-right" label="Next" disabled={rec || cur === TOTAL - 1} onClick={() => nav(1)} />
    <Ctl icon="phone" label="End" kind="leave" onClick={() => setLeave(true)} />
  </div>;
  const timers = <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: over ? 'var(--danger-500)' : 'rgba(166,225,250,.14)', color: '#fff', ...DF, fontSize: m ? 15 : 18, transition: 'background .2s' }}><Icon name="timer" size={m ? 14 : 16} />{mmss(rec ? el : recs[cur] ? recs[cur].dur : 0)} <span style={{ opacity: .75, fontSize: m ? 12 : 14 }}>/ {mmss(sg)}</span></div>
    <div style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(166,225,250,.14)', color: '#fff', ...DF, fontSize: m ? 13 : 15 }}>{mmss(total)} <span style={{ opacity: .7 }}>/ {mmss(S.minutes * 60)}</span></div>
  </div>;
  const stage = <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
    <SlideView i={cur} style={{ boxShadow: 'var(--shadow-lg)' }} />
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{rec ? <Badge tone="danger" dot>Recording slide {cur + 1}</Badge> : play !== null ? <Badge tone="info" dot>Playing back slide {cur + 1}</Badge> : <Badge tone={here === 'over' ? 'warning' : here === 'done' ? 'success' : 'neutral'}>{STAT[here][1]}</Badge>}{over && <span style={{ color: '#ffb4b4', fontFamily: 'var(--font-body)', fontSize: 13 }}>Over by {mmss(el - sg)}. Keep going, wrap up when ready.</span>}</div>
      <span style={{ color: 'var(--icy-blue)', fontFamily: 'var(--font-body)', fontSize: 13 }}>{here === 'none' && !rec ? 'Take a breath. Press Record when ready.' : ''}</span>
    </div>
    {play !== null && <div style={{ height: 4, borderRadius: 4, background: 'rgba(166,225,250,.2)' }}><div style={{ width: (play / Math.min(recs[cur].dur, 6)) * 100 + '%', height: '100%', background: 'var(--icy-blue)', borderRadius: 4, transition: 'width 1s linear' }} /></div>}
  </div>;
  const strip = <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 6px' }}>{SL.map((_, i) => { const s = status(i); return <button key={i} disabled={rec} onClick={() => { setPlay(null); set({ cur: i }); }} style={{ flexShrink: 0, width: m ? 76 : 112, padding: 5, borderRadius: 10, border: '2px solid ' + (i === cur ? 'var(--icy-blue)' : 'transparent'), background: 'rgba(166,225,250,.08)', cursor: rec ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
    <SlideView i={i} style={{ boxShadow: 'none', borderRadius: 4 }} /><div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontFamily: 'var(--font-body)', fontSize: 11, color: '#fff' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: s === 'none' ? 'var(--ink-400)' : STAT[s][0], flexShrink: 0, animation: s === 'rec' ? 'm2pPulse 1.2s infinite' : 'none' }} />{m ? i + 1 : STAT[s][1]}</div></button>; })}</div>;
  const notesP = <div style={{ borderRadius: 14, background: 'rgba(166,225,250,.08)', overflow: 'hidden' }}>
    <button onClick={() => setNotes(!notes)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: 0, background: 'none', color: '#fff', ...DF, fontSize: 14, cursor: 'pointer' }}><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="notebook-pen" size={16} />My notes</span><Icon name={notes ? 'chevron-up' : 'chevron-down'} size={16} /></button>
    {notes && <div style={{ padding: '0 14px 14px' }}><Overline color="var(--icy-blue)" style={{ marginBottom: 6 }}>Cover on this slide</Overline>{SL[cur].kp.map((k, x) => <div key={x} style={{ display: 'flex', gap: 8, padding: '4px 0', color: '#fff', fontFamily: 'var(--font-body)', fontSize: 14 }}><Icon name="circle-check" size={15} color="var(--icy-blue)" style={{ marginTop: 3 }} />{k}</div>)}</div>}
  </div>;
  const tiles = (small) => <>{AUD.map((a, k) => <Person key={k} k={k} label={a[0]} role={a[1]} small={small} />)}<SelfTile speaking={rec} level={level} small={small} /></>;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--prussian-blue)', color: '#fff' }}>
      <div style={{ flexShrink: 0, height: m ? 52 : 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: m ? '0 12px' : '0 24px', gap: 12 }}>
        {m ? <div style={{ ...DF, fontSize: 14 }}>Slide {cur + 1}/{TOTAL}</div> : <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Logo dark size={18} /><span style={{ fontFamily: 'var(--font-body)', color: 'var(--icy-blue)' }}>ParkSense hackathon pitch · Slide {cur + 1} of {TOTAL}</span></div>}
        {!m && timers}
        {m ? <div style={{ ...DF, fontSize: 13, color: 'var(--icy-blue)' }}>Total {mmss(total)} / {mmss(S.minutes * 60)}</div> : <Button variant="inverse" size="sm" disabled={rec} onClick={() => go('review')}>Review and submit</Button>}
      </div>
      {m ? <>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px', display: 'grid', gap: 12, alignContent: 'start' }}>{stage}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>{tiles(true)}</div>{strip}{notesP}
          <Button variant="inverse" disabled={rec} onClick={() => go('review')}>Review and submit</Button></div>
        <div style={{ flexShrink: 0, background: 'var(--deep-navy)', borderRadius: '20px 20px 0 0', padding: '12px 8px 14px', display: 'grid', gap: 10 }}><div style={{ display: 'flex', justifyContent: 'center' }}>{timers}</div>{ctls}</div>
      </> : <>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, padding: '0 24px' }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', justifyContent: 'center' }}>{stage}{strip}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{tiles(false)}</div>{notesP}</div>
        </div>
        <div style={{ flexShrink: 0, padding: '14px 0 18px', display: 'flex', justifyContent: 'center' }}><div style={{ padding: '12px 28px', borderRadius: 99, background: 'var(--deep-navy)', boxShadow: 'var(--shadow-lg)' }}>{ctls}</div></div>
      </>}
      <Dialog open={leave} title="Leave this session?" onClose={() => setLeave(false)} width={440}
        actions={<><Button variant="secondary" onClick={() => setLeave(false)}>Keep practising</Button><Button variant="record" onClick={() => go('dashboard', { recs: {} })}>Leave session</Button></>}>
        <P>Your recordings for this session will be discarded and no report will be created.</P></Dialog>
    </div>
  );
}
function Review() {
  const { S, go, set, m } = useApp();
  const [play, setPlay] = useState(null);
  const [warn, setWarn] = useState(false);
  useEffect(() => { if (play === null) return; const t = setTimeout(() => setPlay(null), 2500); return () => clearTimeout(t); }, [play]);
  const done = Object.keys(S.recs).length, miss = TOTAL - done;
  const submit = () => { go('analysing'); };
  return <Flow step="mic" wide={false}>
    <Head title="Review and submit" sub="Play back or re-record any slide before you submit." />
    {miss > 0 && <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, background: 'var(--warning-50)', marginBottom: 16, alignItems: 'center' }}><Icon name="triangle-alert" size={20} color="var(--warning-500)" /><div style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-800)' }}>{miss} {miss === 1 ? 'slide is' : 'slides are'} not recorded yet. You can still submit, but those slides will be marked as skipped.</div></div>}
    <Card padding={0}>{SL.map((s, i) => { const r = S.recs[i], g = sug(S.minutes, i), o = r && r.dur > g; return <div key={i} style={{ display: 'grid', gridTemplateColumns: m ? '1fr auto' : '36px 1fr 150px auto', gap: 12, alignItems: 'center', padding: m ? '14px 16px' : '14px 24px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
      {!m && <span style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-body)' }}>{i + 1}</span>}
      <div><div style={{ fontFamily: 'var(--font-body)', color: 'var(--text-strong)', fontWeight: 700, fontSize: 15 }}>{m ? `${i + 1}. ` : ''}{s.t}</div>{m && <Muted>{r ? `${mmss(r.dur)} of ${mmss(g)}` : 'Not recorded'}</Muted>}</div>
      {!m && (r ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Badge tone={o ? 'warning' : 'success'}>{mmss(r.dur)} / {mmss(g)}</Badge></div> : <Badge tone="warning">Not recorded</Badge>)}
      <div style={{ display: 'flex', gap: 6 }}>{r && <IconButton icon={play === i ? 'volume-2' : 'play'} label="Play back" variant="secondary" size={44} onClick={() => setPlay(i)} />}<IconButton icon={r ? 'rotate-ccw' : 'mic'} label={r ? 'Re-record' : 'Record'} variant="secondary" size={44} onClick={() => { const rr = { ...S.recs }; delete rr[i]; go('room', { cur: i, recs: rr, preset: null }); }} /></div>
    </div>; })}</Card>
    {done === 0 && <Card variant="sunken" padding={16} style={{ marginTop: 16 }}><Muted>Prototype shortcut: </Muted><Button size="sm" variant="accent" style={{ marginTop: 8 }} onClick={() => set({ recs: Object.fromEntries(SL.map((s, i) => [i, { dur: Math.round(SL[i].taken[1]) }])) })}>Fill with sample recordings</Button></Card>}
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '20px 0 16px' }}><Icon name="trash-2" size={18} color="var(--bright-marine)" /><Muted>Audio is deleted once your report is generated. Your report keeps scores and transcripts only.</Muted></div>
    <div style={{ display: 'flex', gap: 12, flexDirection: m ? 'column' : 'row' }}><Button size="lg" variant="secondary" onClick={() => go('room', { preset: null })}>Back to practice room</Button><Button size="lg" iconLeft="sparkles" disabled={done === 0} onClick={() => miss ? setWarn(true) : submit()}>Submit for feedback</Button></div>
    <Dialog open={warn} title="Submit with unrecorded slides?" onClose={() => setWarn(false)} width={440} actions={<><Button variant="secondary" onClick={() => setWarn(false)}>Go back</Button><Button onClick={() => { setWarn(false); submit(); }}>Submit anyway</Button></>}><P>{miss} slides have no recording. Their key points will count as missed in your report.</P></Dialog>
  </Flow>;
}
function Analysing() {
  const { S, go, set, m } = useApp();
  const [n, setN] = useState(0);
  const msgs = ['Writing out what you said', 'Counting pauses and filler words', 'Checking each key point', 'Writing your feedback'];
  useEffect(() => { const t = setInterval(() => setN((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (n >= 5) { const id = S.attempts + 1 > 2 ? 2 : S.attempts + 1; set({ attempts: Math.max(S.attempts, id), used: S.used + 1, reportId: id, recs: {}, rated: 0 }); go('report', { reportId: id }); } }, [n]);
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--prussian-blue)', padding: 24, textAlign: 'center' }}><div style={{ maxWidth: 440 }}>
    <div style={{ width: 88, height: 88, margin: '0 auto 28px', borderRadius: '50%', border: '6px solid rgba(166,225,250,.2)', borderTopColor: 'var(--icy-blue)', animation: 'm2pSpin 1.1s linear infinite' }} />
    <div style={{ ...DF, fontSize: m ? 26 : 32, color: '#fff', marginBottom: 10 }}>Nice work. Reading your session…</div>
    <P style={{ color: 'var(--icy-blue)', marginBottom: 24 }}>{msgs[Math.min(n, 3)]}. Your audio will be deleted when this finishes.</P>
    <div style={{ height: 6, borderRadius: 6, background: 'rgba(166,225,250,.18)' }}><div style={{ width: Math.min(100, n * 20 + 10) + '%', height: '100%', borderRadius: 6, background: 'var(--icy-blue)', transition: 'width 1s linear' }} /></div>
  </div></div>;
}

/* ---------------- report ---------------- */
function Hl({ text }) {
  const parts = text.split(FILL);
  return <>{parts.map((p, i) => i % 2 ? <mark key={i} style={{ background: 'var(--warning-50)', color: '#9A6106', borderRadius: 4, padding: '0 3px', fontWeight: 700 }}>{p}</mark> : <span key={i}>{p}</span>)}</>;
}
function Report() {
  const { S, go, set, m } = useApp();
  const a = S.reportId || 1, R = REPORT[a];
  const [open, setOpen] = useState(0);
  const [stars, setStars] = useState(0);
  const [cmt, setCmt] = useState('');
  const [sent, setSent] = useState(false);
  const tf = SL.map((_, i) => fillersOf(i, a));
  const sum = tf.reduce((x, y) => x + y.n, 0);
  const totalTime = SL.reduce((x, s) => x + s.taken[a - 1], 0);
  const cov = SL.reduce((x, s) => x + 3 - s.missed[a - 1].length, 0);
  return <Shell active="history" maxW={1000}>
    <a onClick={() => go('deck')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-body)', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 14 }}><Icon name="chevron-left" size={16} />ParkSense hackathon pitch</a>
    <div style={{ background: 'var(--prussian-blue)', borderRadius: 24, padding: m ? 24 : 40, display: 'flex', flexDirection: m ? 'column' : 'row', gap: m ? 20 : 36, alignItems: 'center', textAlign: m ? 'center' : 'left' }}>
      <ScoreRing value={R.score} size={m ? 140 : 168} stroke={14} label="out of 100" color="var(--icy-blue)" track="rgba(166,225,250,.2)" textColor="#fff" />
      <div><Overline color="var(--icy-blue)">Attempt {a} · 2 Oct 2026</Overline><div style={{ ...DF, fontSize: m ? 24 : 32, color: '#fff', lineHeight: 1.2, margin: '10px 0 14px' }}>{R.head}</div>
        {a === 2 ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 99, background: 'rgba(31,157,107,.25)', color: '#9CF0CB', fontFamily: 'var(--font-body)', fontWeight: 700 }}><Icon name="trending-up" size={18} />+12 from your first attempt (62)</div> : <Muted style={{ color: 'var(--icy-blue)' }}>{totalTime >= 300 ? '' : ''}Your first report. Every retake shows how far you've come.</Muted>}</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : 'repeat(5,1fr)', gap: 12, margin: '20px 0' }}>{SUBS(a).map(([l, v, ic], i) => <Card key={l} padding={18} style={m && i === 4 ? { gridColumn: '1/3' } : null}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Tile icon={ic} size={32} />{a === 2 && <Badge tone="success">+{v - SUB1[i][1]}</Badge>}</div>
      <div style={{ ...DF, fontSize: 34, color: scoreTone(v), margin: '10px 0 2px' }}>{v}</div><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>{l}</div>
      <Muted style={{ fontSize: 12, marginTop: 2 }}>{[`${mmss(totalTime)} of 5:00`, `${WPM[a]} wpm · aim 130-160`, `${sum} filler words`, `${cov} of 24 key points`, 'Sentences and English'][i]}</Muted></Card>)}</div>
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 16 }}>
      <Card><div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><Tile icon="target" size={32} /><H l={3}>Top 3 things to fix next time</H></div>{R.fix.map((f, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><span style={{ ...DF, color: 'var(--bright-marine)' }}>{i + 1}</span><P style={{ fontSize: 15 }}>{f}</P></div>)}</Card>
      <Card><div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--success-50)', color: 'var(--success-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="circle-check" size={18} /></div><H l={3}>What you did well</H></div>{R.well.map((f, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><Icon name="check" size={18} color="var(--success-500)" style={{ marginTop: 3 }} /><P style={{ fontSize: 15 }}>{f}</P></div>)}</Card>
    </div>
    <H l={2} style={{ margin: '32px 0 14px' }}>Slide by slide</H>
    <div style={{ display: 'grid', gap: 10 }}>{SL.map((s, i) => { const t = s.taken[a - 1], g = sug(5, i), isOpen = open === i, f = tf[i], ms = s.missed[a - 1], of = s.off[a - 1]; return <Card key={i} padding={0}>
      <div onClick={() => setOpen(isOpen ? -1 : i)} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: m ? '1fr auto' : '36px 1fr auto auto auto 24px', gap: 12, alignItems: 'center', padding: m ? '14px 16px' : '16px 24px' }}>
        {!m && <span style={{ ...DF, color: 'var(--ink-400)' }}>{i + 1}</span>}<div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>{m ? `${i + 1}. ` : ''}{s.t}</div>
        <Badge tone={t > g + 5 ? 'warning' : 'success'}>{mmss(t)} / {mmss(g)}</Badge>{!m && <Badge tone={ms.length ? 'warning' : 'success'}>{3 - ms.length}/3 points</Badge>}{!m && <Badge tone={f.n > 2 ? 'warning' : 'neutral'}>{f.n} fillers</Badge>}{!m && <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="var(--ink-500)" />}
      </div>
      {isOpen && <div style={{ padding: m ? '4px 16px 18px' : '4px 24px 24px 72px', display: 'grid', gap: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div><Overline style={{ marginBottom: 8 }}>Key points</Overline>{s.kp.map((k, x) => { const miss = ms.includes(x); return <div key={x} style={{ display: 'flex', gap: 8, padding: '4px 0', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-body)' }}><Icon name={miss ? 'circle-x' : 'circle-check'} size={16} color={miss ? 'var(--warning-500)' : 'var(--success-500)'} style={{ marginTop: 3 }} /><span>{k} <b style={{ color: miss ? '#9A6106' : 'var(--success-500)' }}>{miss ? '· missed' : '· covered'}</b></span></div>; })}</div>
          <div><Overline style={{ marginBottom: 8 }}>Time and fillers</Overline><P style={{ fontSize: 14 }}>You took {mmss(t)} against {mmss(g)} suggested ({t > g ? `${t - g}s over` : `${g - t}s under`}).</P><P style={{ fontSize: 14, marginTop: 6 }}>{f.n ? `${f.n} filler ${f.n === 1 ? 'word' : 'words'}: ` + Object.entries(f.o).map(([k, v]) => `"${k}" × ${v}`).join(', ') : 'No filler words. Well done.'}</P></div>
        </div>
        {of.length > 0 && <div><Overline style={{ marginBottom: 8 }}>Off-topic or unnecessary</Overline>{of.map((x, k) => <div key={k} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--warning-50)', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink-800)' }}>"{x}"<div style={{ color: 'var(--ink-600)', marginTop: 2 }}>This didn't support a key point. Consider cutting it.</div></div>)}</div>}
        <div><Overline style={{ marginBottom: 8 }}>Transcript</Overline><div style={{ padding: 16, borderRadius: 12, background: 'var(--ink-50)', fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.8, color: 'var(--text-body)' }}><Hl text={trOf(i, a)} /></div></div>
      </div>}
    </Card>; })}</div>
    <Card style={{ margin: '28px 0' }}>{sent ? <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Tile icon="heart" /><div><H l={3}>Thank you</H><Muted>Your rating helps us improve the reports.</Muted></div></div> : <>
      <H l={3} style={{ marginBottom: 4 }}>Rate this report</H><Muted style={{ marginBottom: 12 }}>Was it clear and useful?</Muted>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} aria-label={n + ' stars'} style={{ border: 0, background: 'none', cursor: 'pointer', padding: 4 }}><Star on={n <= stars} size={32} /></button>)}</div>
      <Input placeholder="Add a comment (optional)" value={cmt} onChange={(e) => setCmt(e.target.value)} /><Button style={{ marginTop: 14 }} disabled={!stars} onClick={() => { setSent(true); set({ toast: 'Rating sent' }); }}>Send rating</Button></>}</Card>
    <div style={{ display: 'flex', gap: 12, flexDirection: m ? 'column' : 'row' }}>
      <Button size="lg" iconLeft="rotate-ccw" onClick={() => go(S.used >= LIMITS.sessions ? 'limit' : 'mic', { retake: true, recs: {}, mic: 'idle' })}>Retake this presentation</Button><Button size="lg" variant="secondary" onClick={() => go('dashboard')}>Back to dashboard</Button></div>
  </Shell>;
}
function History() {
  const { S, go, set, m } = useApp();
  const sc = [62, 74].slice(0, S.attempts);
  return <Shell active="history"><Head title="History" sub="Your reports, grouped by deck. Audio is never kept." />
    {S.attempts === 0 ? <Card padding={m ? 28 : 56} style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Tile icon="history" size={56} /></div><H l={2}>No reports yet</H><P style={{ margin: '8px 0 18px' }}>Your reports will show up here after your first practice.</P><Button onClick={() => go('upload', { uploadErr: null })}>Start a new practice</Button></Card> :
      <Card padding={0} interactive onClick={() => go('deck')} style={{ cursor: 'pointer' }}><div style={{ display: 'grid', gridTemplateColumns: m ? '48px 1fr 44px' : '48px 1fr 44px 120px 24px', gap: 16, alignItems: 'center', padding: 24 }}>
        <Tile icon="presentation" size={48} /><div><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>ParkSense hackathon pitch{S.pinned && <Badge tone="warning">Pinned</Badge>}</div><Muted>8 slides · {S.attempts} {S.attempts === 1 ? 'attempt' : 'attempts'} · last on 2 Oct 2026</Muted></div>
        <button aria-label={S.pinned ? 'Unpin deck' : 'Pin deck'} title={S.pinned ? 'Unpin' : 'Pin to top'} onClick={(e) => { e.stopPropagation(); set({ pinned: !S.pinned, toast: S.pinned ? 'Deck unpinned' : 'Deck pinned to top' }); }} style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: S.pinned ? 'var(--warning-50)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Star on={S.pinned} size={22} /></button>
        <div style={{ ...DF, fontSize: 32, color: scoreTone(sc[sc.length - 1]) }}>{sc[sc.length - 1]}<span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-500)', marginLeft: 6 }}>latest</span></div>{!m && <Icon name="chevron-right" size={20} color="var(--ink-400)" />}
      </div></Card>}
  </Shell>;
}
function Deck() {
  const { S, go, m } = useApp();
  const n = Math.max(S.attempts, 1), sc = [62, 74].slice(0, n);
  return <Shell active="history"><a onClick={() => go('history')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-body)', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 14 }}><Icon name="chevron-left" size={16} />History</a>
    <Head title="ParkSense hackathon pitch" sub={`8 slides · 5:00 target · ${n} ${n === 1 ? 'attempt' : 'attempts'}`} right={<Button iconLeft="rotate-ccw" onClick={() => go(S.used >= LIMITS.sessions ? 'limit' : 'mic', { retake: true, recs: {}, mic: 'idle' })}>Practice again</Button>} />
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 20 }}>
      <Card><H l={3} style={{ marginBottom: 8 }}>Score trend</H><LineChart data={sc} /></Card>
      <Card><H l={3} style={{ marginBottom: 14 }}>Sub-scores by attempt</H><div style={{ display: 'grid', gap: 12 }}>{SUBS(2).map(([l, v], i) => <div key={l}><div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-body)', fontSize: 14, marginBottom: 4 }}><span>{l}</span><span><span style={{ color: 'var(--ink-500)' }}>{SUB1[i][1]}</span>{n > 1 && <> → <b>{v}</b></>}</span></div><div style={{ display: 'grid', gap: 3 }}><Bar v={SUB1[i][1]} color="var(--ink-300)" h={6} />{n > 1 && <Bar v={v} color={scoreTone(v)} h={6} />}</div></div>)}</div></Card>
    </div>
    <Card padding={0} style={{ marginTop: 20 }}><div style={{ padding: '18px 24px' }}><H l={3}>Attempts</H></div>{sc.map((v, i) => <div key={i} onClick={() => go('report', { reportId: i + 1 })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)' }}><div style={{ ...DF, fontSize: 28, color: scoreTone(v), width: 56 }}>{v}</div><div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>Attempt {i + 1}</div><Muted>{i === 0 ? '2 Oct 2026' : '2 Oct 2026'} · {i ? 'Retake' : 'First attempt'}</Muted></div>{i === 1 && <Badge tone="success">+12</Badge>}<Icon name="chevron-right" size={18} color="var(--ink-400)" /></div>)}</Card>
  </Shell>;
}
function Settings() {
  const { S, set, go, m } = useApp();
  const [f, setF] = useState({ college: S.profile.college || 'RV Institute of Technology', year: S.profile.year, branch: S.profile.branch });
  return <Shell active="settings" maxW={860}><Head title="Profile and settings" />
    <Card><div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}><Avatar name={S.profile.name} size={56} /><div><div style={{ ...DF, fontSize: 19, color: 'var(--text-strong)' }}>{S.profile.name}</div><Muted>{S.profile.email}</Muted></div></div>
      <div style={{ display: 'grid', gap: 16 }}><Input label="College" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} /><div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 16 }}><Select label="Year" options={['3rd year', '4th year', 'Other']} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /><Select label="Branch" options={['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other']} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} /></div></div>
      <Button style={{ marginTop: 20 }} onClick={() => set({ profile: { ...S.profile, ...f }, toast: 'Profile saved' })}>Save changes</Button></Card>
    <Card style={{ marginTop: 20 }}><H l={3} style={{ marginBottom: 14 }}>Usage limits</H><div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>{[['Practice sessions per day', `${S.used} of ${LIMITS.sessions} used today`], ['Slides per deck', `Up to ${LIMITS.slides}`], ['Total duration', `Up to ${LIMITS.minutes} minutes`]].map(([a, b]) => <div key={a} style={{ padding: 16, borderRadius: 12, background: 'var(--ink-50)' }}><Muted>{a}</Muted><div style={{ ...DF, fontSize: 17, color: 'var(--text-strong)', marginTop: 4 }}>{b}</div></div>)}</div></Card>
    <Card style={{ marginTop: 20 }}>{[['Terms', 'Terms'], ['Privacy Policy', 'Privacy']].map(([l, k]) => <div key={k} onClick={() => go('terms', { termsView: k, back: 'settings' })} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontFamily: 'var(--font-body)', color: 'var(--text-link)' }}>{l}<Icon name="chevron-right" size={18} /></div>)}</Card>
    <Button variant="secondary" iconLeft="log-out" style={{ marginTop: 20 }} onClick={() => go('landing')}>Sign out</Button>
  </Shell>;
}
function Limit() {
  const { go, m } = useApp();
  return <Shell active="dashboard"><div style={{ maxWidth: 520, margin: m ? '24px auto' : '60px auto', textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Tile icon="moon" size={64} /></div>
    <H l={1}>That's 5 sessions today. Time to rest.</H><P style={{ margin: '12px 0 20px' }}>Short, regular practice works better than one long marathon. Your limit resets at midnight IST, in about 6 hours.</P>
    <Card variant="sunken" padding={16} style={{ marginBottom: 24 }}><ProgressBar value={5} max={5} valueLabel="5 of 5 sessions used" tone="marine" /></Card>
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexDirection: m ? 'column' : 'row' }}><Button onClick={() => go('history')}>Review your reports</Button><Button variant="secondary" onClick={() => go('dashboard')}>Back to dashboard</Button></div>
  </div></Shell>;
}

/* ---------------- admin ---------------- */
function AShell({ active, children }) {
  const { go, m } = useApp();
  const items = [['adminDash', 'Overview', 'layout-dashboard'], ['students', 'Students', 'users'], ['ratings', 'Ratings', 'star'], ['ai', 'AI usage', 'cpu'], ['adminTerms', 'Terms', 'file-text']];
  if (m) return <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
    <div style={{ height: 56, flexShrink: 0, background: 'var(--prussian-blue)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}><Logo dark size={17} /><Badge tone="violet">Owner admin</Badge></div>
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>{children}</div>
    <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--prussian-blue)', paddingBottom: 6 }}>{items.map(([k, l, ic]) => <button key={k} onClick={() => go(k)} style={{ border: 0, background: 'none', minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: active === k ? '#fff' : 'var(--ink-400)', fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer' }}><Icon name={ic} size={20} />{l}</button>)}</div></div>;
  return <div style={{ height: '100%', display: 'flex', background: 'var(--bg-page)' }}>
    <aside style={{ width: 248, flexShrink: 0, background: 'var(--prussian-blue)', display: 'flex', flexDirection: 'column', padding: 20, gap: 4 }}>
      <div style={{ padding: '4px 8px 6px' }}><Logo dark /></div><div style={{ padding: '0 8px 20px' }}><Badge tone="violet">Owner admin</Badge></div>
      {items.map(([k, l, ic]) => <button key={k} onClick={() => go(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer', background: active === k ? 'rgba(166,225,250,.16)' : 'transparent', color: active === k ? '#fff' : 'var(--icy-blue)', ...DF, fontSize: 15, textAlign: 'left' }}><Icon name={ic} size={20} />{l}</button>)}
      <div style={{ flex: 1 }} /><button onClick={() => go('landing')} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer', background: 'transparent', color: 'var(--icy-blue)', ...DF, fontSize: 15 }}><Icon name="log-out" size={20} />Sign out</button>
    </aside>
    <main style={{ flex: 1, overflow: 'auto', padding: '36px 40px' }}><div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div></main>
  </div>;
}
function AdminSignIn() {
  const { go } = useApp();
  return <Center><Card padding={36} style={{ textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo /></div><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Badge tone="violet">Owner admin</Badge></div><H l={1} style={{ fontSize: 26 }}>Owner sign in</H><P style={{ margin: '10px 0 26px' }}>Only the owner's Google account can open the admin area.</P><Google onClick={() => go('adminDash')} /><div><a onClick={() => go('landing')} style={{ display: 'inline-block', marginTop: 20, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-link)', cursor: 'pointer' }}>Back to home</a></div></Card></Center>;
}
function BarChart({ data, labels, h = 160, every = 1, values }) {
  const max = Math.max(...data);
  return <div><div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: h, borderBottom: '1px solid var(--ink-200)' }}>{data.map((v, i) => <div key={i} title={`${labels[i]}: ${v}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>{(values || i === data.length - 1) && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-600)' }}>{v}</span>}<div style={{ width: '100%', height: Math.round(v / max * (h - 22)), background: i === data.length - 1 ? 'var(--imperial-blue)' : 'var(--marine-200)', borderRadius: '6px 6px 0 0' }} /></div>)}</div>
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{labels.map((l, i) => <span key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--ink-500)', whiteSpace: 'nowrap', visibility: i % every === (labels.length - 1) % every ? 'visible' : 'hidden' }}>{l}</span>)}</div></div>;
}
const Stat = ({ icon, label, value, sub }) => <Card padding={20}><div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}><Tile icon={icon} size={36} /><Muted>{label}</Muted></div><div style={{ ...DF, fontSize: 36, color: 'var(--text-strong)' }}>{value}</div><Muted style={{ fontSize: 12 }}>{sub}</Muted></Card>;
function AdminDash() {
  const { go, m } = useApp();
  const d = [18, 24, 22, 31, 28, 35, 41, 38, 46, 52, 49, 58, 61, 66];
  return <AShell active="adminDash"><Head title="Overview" sub="Last 14 days" />
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : 'repeat(4,1fr)', gap: 14 }}><Stat icon="users" label="Total students" value="412" sub="+38 this week" /><Stat icon="mic" label="Practice sessions" value="1,086" sub="66 yesterday" /><Stat icon="star" label="Avg report rating" value="4.2" sub="from 318 ratings" /><Stat icon="cpu" label="AI credits used" value="9,415" sub="of 16,000" /></div>
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.5fr 1fr', gap: 20, marginTop: 20 }}>
      <Card><H l={3} style={{ marginBottom: 4 }}>Sessions per day</H><Muted style={{ marginBottom: 16 }}>23 Sep to 6 Oct 2026</Muted><BarChart data={d} labels={d.map((_, i) => i < 8 ? `${23 + i} Sep` : `${i - 7} Oct`)} h={170} every={2} /></Card>
      <Card padding={0}><div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between' }}><H l={3}>Recent ratings</H><a onClick={() => go('ratings')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-body)', fontSize: 14 }}>View all</a></div>{RATINGS.slice(0, 4).map((r, i) => <div key={i} style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>{r[0]}</b><Stars n={r[2]} size={14} /></div><Muted style={{ fontSize: 13 }}>{r[3] || 'No comment'}</Muted></div>)}</Card>
    </div></AShell>;
}
function Students() {
  const { go, set, S, m } = useApp();
  const [q, setQ] = useState('');
  const rows = STUDENTS.map((s, i) => ({ s, i })).filter(({ s }) => (s[0] + s[1] + s[2]).toLowerCase().includes(q.toLowerCase()));
  const blocked = (i) => S.blocked.includes(i);
  const tog = (i) => set({ blocked: blocked(i) ? S.blocked.filter((x) => x !== i) : [...S.blocked, i], toast: blocked(i) ? 'Student unblocked' : 'Student blocked' });
  return <AShell active="students"><Head title="Students" sub={`${rows.length} of 412 shown`} right={<div style={{ width: m ? '100%' : 300 }}><Input icon="search" placeholder="Search name, email or college" value={q} onChange={(e) => setQ(e.target.value)} /></div>} />
    {m ? <div style={{ display: 'grid', gap: 12 }}>{rows.map(({ s, i }) => <Card key={i} padding={16}><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Avatar name={s[0]} size={40} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--font-body)', fontWeight: 700 }}>{s[0]} {blocked(i) && <Badge tone="danger">Blocked</Badge>}</div><Muted style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s[2]} · {s[3]} · {s[4]}</Muted></div><div style={{ ...DF, fontSize: 20 }}>{s[7] || '–'}</div></div><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Button size="sm" variant="secondary" onClick={() => go('student', { sid: i })}>View</Button><Button size="sm" variant="ghost" onClick={() => tog(i)}>{blocked(i) ? 'Unblock' : 'Block'}</Button></div></Card>)}</div> :
      <Card padding={0}><div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.3fr .6fr .6fr .5fr .7fr .5fr 150px', gap: 12, padding: '14px 24px', background: 'var(--ink-50)', borderRadius: '16px 16px 0 0', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{['Name', 'Email', 'College', 'Year', 'Branch', 'Sessions', 'Last active', 'Avg', ''].map((x) => <span key={x}>{x}</span>)}</div>
        {rows.map(({ s, i }) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.3fr .6fr .6fr .5fr .7fr .5fr 150px', gap: 12, padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-body)', opacity: blocked(i) ? .6 : 1 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{s[0]}{blocked(i) && <> <Badge tone="danger">Blocked</Badge></>}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s[1]}</span><span>{s[2]}</span><span>{s[3]}</span><span>{s[4]}</span><span>{s[5]}</span><span>{s[6]}</span><span><b>{s[7] || '–'}</b></span>
          <span style={{ display: 'flex', gap: 6 }}><Button size="sm" variant="secondary" onClick={() => go('student', { sid: i })}>View</Button><Button size="sm" variant="ghost" onClick={() => tog(i)}>{blocked(i) ? 'Unblock' : 'Block'}</Button></span></div>)}
        {!rows.length && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', fontFamily: 'var(--font-body)' }}>No students match "{q}"</div>}</Card>}
  </AShell>;
}
function StudentDetail() {
  const { S, go, set, m } = useApp();
  const i = S.sid || 0, s = STUDENTS[i], bl = S.blocked.includes(i);
  const att = i === 0 ? [['ParkSense hackathon pitch', 'Attempt 2', 74, '2 Oct'], ['ParkSense hackathon pitch', 'Attempt 1', 62, '2 Oct']] : [['Seminar: Edge AI', 'Attempt 2', s[7] + 4, '30 Sep'], ['Seminar: Edge AI', 'Attempt 1', s[7] - 4, '28 Sep']];
  const rt = RATINGS.filter((r) => r[0] === s[0]);
  return <AShell active="students"><a onClick={() => go('students')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-body)', display: 'inline-flex', gap: 6, alignItems: 'center', marginBottom: 14 }}><Icon name="chevron-left" size={16} />Students</a>
    <Card><div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: 16, alignItems: m ? 'flex-start' : 'center' }}><Avatar name={s[0]} size={64} /><div style={{ flex: 1 }}><div style={{ ...DF, fontSize: 24, color: 'var(--text-strong)' }}>{s[0]} {bl && <Badge tone="danger">Blocked</Badge>}</div><Muted>{s[1]}</Muted><Muted>{s[2]} · {s[3]} · {s[4]}</Muted></div><Button variant={bl ? 'primary' : 'secondary'} iconLeft={bl ? 'check' : 'ban'} onClick={() => set({ blocked: bl ? S.blocked.filter((x) => x !== i) : [...S.blocked, i], toast: bl ? 'Student unblocked' : 'Student blocked' })}>{bl ? 'Unblock' : 'Block student'}</Button></div></Card>
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.2fr 1fr', gap: 20, marginTop: 20 }}>
      <Card padding={0}><div style={{ padding: '18px 24px' }}><H l={3}>Practice attempts</H></div>{s[5] ? att.map((a, k) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}><div style={{ ...DF, fontSize: 24, width: 48, color: scoreTone(a[2]) }}>{a[2]}</div><div style={{ flex: 1, fontFamily: 'var(--font-body)' }}><b style={{ color: 'var(--text-strong)' }}>{a[0]}</b><Muted>{a[1]}</Muted></div><Muted>{a[3]}</Muted></div>) : <div style={{ padding: 24, color: 'var(--ink-500)', fontFamily: 'var(--font-body)' }}>No attempts yet.</div>}</Card>
      <Card padding={0}><div style={{ padding: '18px 24px' }}><H l={3}>Ratings given</H></div>{rt.length ? rt.map((r, k) => <div key={k} style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}><Stars n={r[2]} size={14} /><P style={{ fontSize: 14 }}>{r[3] || 'No comment'}</P><Muted style={{ fontSize: 12 }}>{r[1]} · {r[4]}</Muted></div>) : <div style={{ padding: 24, color: 'var(--ink-500)', fontFamily: 'var(--font-body)' }}>No ratings given.</div>}</Card>
    </div></AShell>;
}
function Ratings() {
  const { m } = useApp();
  const [f, setF] = useState(0);
  const rows = RATINGS.filter((r) => !f || r[2] === f);
  const avg = (RATINGS.reduce((a, r) => a + r[2], 0) / RATINGS.length).toFixed(1);
  return <AShell active="ratings"><Head title="Report ratings" sub="What students think of their reports" right={<Card padding={14} style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ ...DF, fontSize: 32 }}>{avg}</div><div><Stars n={Math.round(avg)} /><Muted style={{ fontSize: 12 }}>average of {RATINGS.length} shown</Muted></div></Card>} />
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>{[0, 5, 4, 3, 2, 1].map((n) => <button key={n} onClick={() => setF(n)} style={{ height: 40, padding: '0 16px', borderRadius: 99, border: '1px solid ' + (f === n ? 'var(--imperial-blue)' : 'var(--border-strong)'), background: f === n ? 'var(--imperial-blue)' : '#fff', color: f === n ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 14, cursor: 'pointer' }}>{n ? n + ' stars' : 'All'}</button>)}</div>
    <Card padding={0}>{rows.map((r, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.2fr 1.2fr 130px 2fr 110px', gap: m ? 4 : 16, alignItems: 'center', padding: m ? '14px 16px' : '16px 24px', borderTop: i ? '1px solid var(--border-subtle)' : 0, fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-body)' }}><b style={{ color: 'var(--text-strong)' }}>{r[0]}</b><span>{r[1]}</span><Stars n={r[2]} size={15} /><span>{r[3] || <i style={{ color: 'var(--ink-400)' }}>No comment</i>}</span><span style={{ color: 'var(--ink-500)' }}>{r[4]}</span></div>)}{!rows.length && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)' }}>No ratings with that value.</div>}</Card></AShell>;
}
function AiUsage() {
  const { m } = useApp();
  const spark = [[3, 5, 4, 7, 6, 9, 8], [2, 3, 3, 4, 5, 4, 6], [4, 4, 6, 5, 7, 8, 7], [3, 6, 5, 8, 7, 9, 10]];
  return <AShell active="ai"><Head title="AI usage and credits" sub="Keys are shown masked. Usage over the last 7 days." />
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 20 }}>{AI.map(([n, key, used, tot, ic], k) => { const left = tot - used, pct = used / tot * 100; return <Card key={n}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}><Tile icon={ic} /><div style={{ flex: 1 }}><H l={3}>{n}</H><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-500)' }}>{key}</div></div>{pct > 75 && <Badge tone="warning">Running low</Badge>}</div>
      <ProgressBar value={used} max={tot} tone={pct > 75 ? 'warning' : 'marine'} />
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 16px', fontFamily: 'var(--font-body)', fontSize: 14 }}><span>Used <b>{used.toLocaleString()}</b></span><span>Remaining <b>{left.toLocaleString()}</b></span></div>
      <Muted style={{ fontSize: 13, marginBottom: 8 }}>Credits used per day</Muted><BarChart data={spark[k].map((v) => v * 40)} labels={['30 Sep', '1 Oct', '2 Oct', '3 Oct', '4 Oct', '5 Oct', '6 Oct']} h={110} values /></Card>; })}</div></AShell>;
}
function AdminTerms() {
  const { S, set, m } = useApp();
  const [tab, setTab] = useState('Terms');
  const [dr, setDr] = useState({ Terms: S.terms, Privacy: S.priv });
  const [conf, setConf] = useState(false);
  const publish = () => { set({ terms: dr.Terms, priv: dr.Privacy, termsUpdate: true, accepted: false, versions: [{ v: 'v' + (S.versions.length + 1) + '.0', date: '2 Oct 2026', note: 'Updated ' + (tab === 'Terms' ? 'Terms' : 'Privacy Policy') }, ...S.versions], toast: 'New version published. Students must re-accept.' }); setConf(false); };
  return <AShell active="adminTerms"><Head title="Terms and Privacy Policy" sub="Edit the text, then publish a new version." right={<Button iconLeft="upload" onClick={() => setConf(true)}>Publish new version</Button>} />
    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.6fr 1fr', gap: 20 }}>
      <Card><div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>{['Terms', 'Privacy'].map((t) => <button key={t} onClick={() => setTab(t)} style={{ height: 36, padding: '0 18px', borderRadius: 99, border: '1px solid ' + (tab === t ? 'var(--imperial-blue)' : 'var(--border-strong)'), background: tab === t ? 'var(--imperial-blue)' : '#fff', color: tab === t ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 14, cursor: 'pointer' }}>{t === 'Terms' ? 'Terms' : 'Privacy Policy'}</button>)}</div>
        <textarea value={dr[tab]} onChange={(e) => setDr({ ...dr, [tab]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', height: m ? 320 : 460, padding: 16, borderRadius: 12, border: '1px solid var(--border-strong)', fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.7, color: 'var(--text-body)', resize: 'vertical' }} /><Muted style={{ marginTop: 8 }}>Use "## Heading" on its own line to start a section.</Muted></Card>
      <Card padding={0} style={{ alignSelf: 'start' }}><div style={{ padding: '18px 24px' }}><H l={3}>Version history</H></div>{S.versions.map((v, i) => <div key={v.v} style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-body)' }}><div><b style={{ color: 'var(--text-strong)' }}>{v.v}</b> {i === 0 && <Badge tone="success">Live</Badge>}<Muted style={{ fontSize: 13 }}>{v.note}</Muted></div><Muted style={{ fontSize: 13 }}>{v.date}</Muted></div>)}</Card>
    </div>
    <Dialog open={conf} title="Publish a new version?" onClose={() => setConf(false)} width={460} actions={<><Button variant="secondary" onClick={() => setConf(false)}>Cancel</Button><Button onClick={publish}>Publish</Button></>}><P>All 412 students will need to accept the new Terms and Privacy Policy before they can continue. It will never interrupt a practice session in progress.</P></Dialog>
  </AShell>;
}

/* ---------------- app ---------------- */
const INIT = { screen: 'landing', frame: 'desktop', profile: { name: 'Ananya Rao', email: 'ananya.rao@gmail.com', college: '', year: '3rd year', branch: 'CSE' }, profileDone: false, accepted: false, termsUpdate: false, termsView: null, back: null, attempts: 0, used: 0, reportId: 1, retake: false, cur: 0, recs: {}, minutes: 5, mic: 'idle', sel: 0, uploadErr: null, preset: null, toast: null, blocked: [6], sid: 0, pinned: false, terms: TERMS0, priv: PRIV0, versions: [{ v: 'v3.0', date: '12 Aug 2026', note: 'Added usage limits' }, { v: 'v2.0', date: '3 Jun 2026', note: 'Clarified audio deletion' }, { v: 'v1.0', date: '15 Apr 2026', note: 'First release' }] };
const SCREENS = { landing: Landing, signin: SignIn, terms: Terms, profile: Profile, dashboard: Dashboard, upload: Upload, extracting: Extracting, prep: Prep, time: Time, mic: Mic, room: Room, review: Review, analysing: Analysing, report: Report, history: History, deck: Deck, settings: Settings, limit: Limit, adminSignin: AdminSignIn, adminDash: AdminDash, students: Students, student: StudentDetail, ratings: Ratings, ai: AiUsage, adminTerms: AdminTerms };
const DEMO_RECS = Object.fromEntries(SL.map((s, i) => [i, { dur: s.taken[1] }]));

function JumpMenu() {
  const { S, set, go } = useApp();
  const [o, setO] = useState(false);
  const base = { accepted: true, profileDone: true, profile: { ...S.profile, college: S.profile.college || 'RV Institute of Technology' } };
  const J = (label, screen, extra = {}) => [label, () => go(screen, { ...base, ...extra })];
  const groups = [
    ['Student', [J('S1 Landing', 'landing'), J('S2 Sign in', 'signin'), ['S3 Terms (first time)', () => go('terms', { termsUpdate: false, termsView: null, accepted: false })], ['S3 Terms (updated)', () => go('terms', { termsUpdate: true, termsView: null, accepted: false, profileDone: true })], ['S4 Profile setup', () => go('profile', { profileDone: false, accepted: true })],
      J('S5 Dashboard (empty)', 'dashboard', { attempts: 0, used: 0 }), J('S5 Dashboard (with history)', 'dashboard', { attempts: 2, used: 2 }), J('S6 Upload', 'upload', { uploadErr: null }), J('S6 Upload (error)', 'upload', { uploadErr: 'count' }), J('S7 Extracting', 'extracting'), J('S8 Slide prep', 'prep', { sel: 0 }), J('S9 Set time', 'time'), J('S10 Mic check', 'mic', { mic: 'idle' }), J('S10 Mic denied', 'mic', { mic: 'denied' })]],
    ['Practice room', [J('S11 Before recording', 'room', { cur: 2, recs: {}, preset: null }), J('S11 Recording', 'room', { cur: 2, recs: {}, preset: 'recording' }), J('S11 Recorded', 'room', { cur: 2, recs: {}, preset: 'recorded' }), J('S11 Overrun (red)', 'room', { cur: 2, recs: {}, preset: 'overrun' }), J('S11 Leave confirm', 'room', { cur: 2, recs: {}, preset: 'leave' }), J('S12 Review (all recorded)', 'review', { recs: DEMO_RECS }), J('S12 Review (some missing)', 'review', { recs: { 0: { dur: 19 }, 1: { dur: 44 }, 2: { dur: 36 } } }), J('S13 Analysing', 'analysing', { recs: DEMO_RECS, attempts: 0, used: 0 })]],
    ['Reports', [J('S14 Report: attempt 1', 'report', { reportId: 1, attempts: 2 }), J('S14 Report: retake (74)', 'report', { reportId: 2, attempts: 2 }), J('S15 History (empty)', 'history', { attempts: 0 }), J('S15 History', 'history', { attempts: 2 }), J('S16 Deck detail', 'deck', { attempts: 2 }), J('S17 Settings', 'settings'), J('S18 Limit reached', 'limit', { used: 5 })]],
    ['Admin', [['A0 Owner sign in', () => go('adminSignin')], ['A1 Dashboard', () => go('adminDash')], ['A2 Students', () => go('students')], ['A3 Student detail', () => go('student', { sid: 0 })], ['A4 Ratings', () => go('ratings')], ['A5 AI usage', () => go('ai')], ['A6 Terms and Privacy', () => go('adminTerms')]]],
  ];
  return <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 999, fontFamily: 'var(--font-body)' }}>
    {o && <div style={{ position: 'absolute', right: 0, bottom: 52, width: 270, maxHeight: '70vh', overflow: 'auto', background: '#fff', borderRadius: 16, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)', padding: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>{['desktop', 'mobile'].map((f) => <button key={f} onClick={() => set({ frame: f })} style={{ flex: 1, height: 34, borderRadius: 99, border: '1px solid var(--border-strong)', background: S.frame === f ? 'var(--imperial-blue)' : '#fff', color: S.frame === f ? '#fff' : 'var(--imperial-blue)', ...DF, fontSize: 13, cursor: 'pointer' }}>{f === 'desktop' ? 'Desktop' : 'Mobile 390'}</button>)}</div>
      {groups.map(([g, items]) => <div key={g}><Overline style={{ margin: '10px 4px 4px', fontSize: 10 }}>{g}</Overline>{items.map(([l, f]) => <button key={l} onClick={() => { f(); setO(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', padding: '6px 8px', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-800)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--marine-50)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>{l}</button>)}</div>)}
    </div>}
    <button onClick={() => setO(!o)} style={{ height: 44, padding: '0 18px', borderRadius: 99, border: 0, background: 'var(--violet, #7B4DFF)', color: '#fff', ...DF, fontSize: 14, cursor: 'pointer', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="layers" size={16} />Screens</button>
  </div>;
}

function App() {
  const [S, setS] = useState(INIT);
  const [w, setW] = useState(1200);
  const ref = useRef();
  const set = (p) => setS((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const go = (screen, extra = {}) => setS((s) => ({ ...s, ...extra, screen }));
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver((e) => setW(e[0].contentRect.width)); ro.observe(ref.current); return () => ro.disconnect(); }, [S.frame]);
  useEffect(() => { if (!S.toast) return; const t = setTimeout(() => set({ toast: null }), 2600); return () => clearTimeout(t); }, [S.toast]);
  useEffect(() => { try { const sv = JSON.parse(localStorage.getItem('m2p-screen') || 'null'); if (sv && SCREENS[sv] && !['room', 'analysing', 'extracting'].includes(sv)) setS((s) => ({ ...s, screen: sv, accepted: true, profileDone: true })); } catch (e) { } }, []);
  useEffect(() => { localStorage.setItem('m2p-screen', JSON.stringify(S.screen)); }, [S.screen]);
  const m = w < 760, mob = S.frame === 'mobile';
  const Scr = SCREENS[S.screen] || Landing;
  return <Ctx.Provider value={{ S, set, go, m, w }}>
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: mob ? 'var(--ink-200)' : 'transparent', boxSizing: 'border-box' }}>
      <div ref={ref} key={S.frame} style={mob ? { width: 390, height: 'min(844px, calc(100vh - 24px))', borderRadius: 38, border: '8px solid #0b1030', overflow: 'hidden', background: '#fff', position: 'relative', boxSizing: 'border-box' } : { width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <div key={S.screen} style={{ height: '100%', overflow: ['landing', 'signin', 'terms', 'profile', 'adminSignin'].includes(S.screen) ? 'auto' : 'hidden', animation: 'm2pIn .3s var(--ease-out)' }}><Scr /></div>
        {S.toast && <div style={{ position: 'absolute', left: '50%', bottom: m ? 80 : 28, transform: 'translateX(-50%)', background: 'var(--prussian-blue)', color: '#fff', padding: '12px 20px', borderRadius: 99, fontFamily: 'var(--font-body)', fontSize: 14, boxShadow: 'var(--shadow-lg)', zIndex: 50, display: 'flex', gap: 8, alignItems: 'center', animation: 'm2pIn .25s' }}><Icon name="circle-check" size={16} color="#9CF0CB" />{S.toast}</div>}
      </div>
    </div>
    <JumpMenu />
  </Ctx.Provider>;
}
window.M2PApp = App;
