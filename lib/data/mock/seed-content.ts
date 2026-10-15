// Sample content seeded into the mock adapter (taken from the design prototype; PDF-only copy per Phase 2 §1.2).

export type SeedSlide = {
  title: string; bullets: string[]; weight: number; keyPoints: string[]; script: string;
  taken: [number, number]; missed: [number[], number[]]; off: [string[], string[]]; transcript: string;
};

export const PARKSENSE_TITLE = "ParkSense hackathon pitch";

export const PARKSENSE: SeedSlide[] = [
  { title: "ParkSense: Smart Campus Parking", bullets: ["Team Byte Bandits", "Hackathon 2026 · Smart Campus track"], weight: 20,
    keyPoints: ["Introduce the team and the name ParkSense", "Say in one line what the app does", "Open with the late-to-class question"],
    script: "Good morning, everyone. We are Team Byte Bandits, and this is ParkSense, a smart parking app for college campuses. Quick question: how many of you have been late to class because you could not find a parking spot?",
    taken: [18, 19], missed: [[2], []], off: [["Our team has four members and two of us are from Pune."], []],
    transcript: "Good morning everyone. We are Team Byte Bandits and this is ParkSense, a smart parking app for campuses. Quick question, how many of you have been late because you could not find a spot?" },
  { title: "The problem", bullets: ["Students circle the campus for 12 minutes on average", "Main gate lot is full by 9:15 am", "No live view of free spots"], weight: 40,
    keyPoints: ["12 minutes average search time", "Main gate lot fills by 9:15 am", "Nobody can see free spots live"],
    script: "We surveyed 140 students. On average, they spend 12 minutes circling the campus looking for a spot. The main gate lot is full by 9:15 am, and nobody can see which bays are free until they get there.",
    taken: [47, 41], missed: [[1], []], off: [["I also park badly, so I understand this problem personally."], []],
    transcript: "We surveyed 140 students. They spend 12 minutes on average circling for a spot. The main gate lot is full by 9:15 am. Basically nobody can see which bays are free until they arrive." },
  { title: "Our solution", bullets: ["Live map of free bays", "Reserve a spot 15 minutes ahead", "Gate alerts for security staff"], weight: 40,
    keyPoints: ["Live map of free bays", "Reserve a spot 15 minutes ahead", "Alerts for security staff"],
    script: "ParkSense shows a live map of free bays. You can reserve a spot 15 minutes before you arrive, and security staff get gate alerts when a lot is nearly full.",
    taken: [36, 38], missed: [[2], [2]], off: [[], []],
    transcript: "ParkSense shows a live map of free bays. You can reserve a spot fifteen minutes before you arrive. It is, you know, very simple to use." },
  { title: "How it works", bullets: ["One sensor per bay (ESP32)", "Cloud sync every 5 seconds", "App suggests the nearest free bay"], weight: 50,
    keyPoints: ["One ESP32 sensor per bay", "Cloud sync every 5 seconds", "App suggests the nearest free bay"],
    script: "Every bay has a small ESP32 sensor. Each sensor reports to our cloud every 5 seconds. The app then suggests the nearest free bay to wherever you are.",
    taken: [66, 58], missed: [[1, 2], [1]], off: [["We bought the sensors from a shop near our hostel."], []],
    transcript: "Every bay has a small ESP32 sensor. Basically the sensor reports to our cloud, and the app, like, shows you the nearest free bay. Um, it updates quickly." },
  { title: "Tech stack", bullets: ["React Native app", "Node.js with an MQTT broker", "PostgreSQL on AWS"], weight: 40,
    keyPoints: ["React Native for the app", "Node.js with an MQTT broker", "PostgreSQL hosted on AWS"],
    script: "The app is built in React Native. The backend is Node.js with an MQTT broker for sensor messages, and the data sits in PostgreSQL on AWS.",
    taken: [34, 36], missed: [[2], []], off: [[], []],
    transcript: "The app is built in React Native. The backend is Node.js with an MQTT broker, and basically all the data sits in PostgreSQL on AWS. Basically it is cheap to run." },
  { title: "Impact", bullets: ["Pilot: 2 lots, 180 bays", "Search time down from 12 to 3 minutes", "Fewer cars circling at peak hours"], weight: 40,
    keyPoints: ["Pilot of 2 lots and 180 bays", "Search time fell from 12 to 3 minutes", "Fewer cars circling at peak hours"],
    script: "In our pilot of 2 lots and 180 bays, the average search time fell from 12 minutes to 3 minutes, and far fewer cars circled at peak hours.",
    taken: [52, 45], missed: [[1, 2], [1]], off: [["Our professor liked the pilot, and she also teaches DBMS."], []],
    transcript: "In our pilot with two lots and 180 bays, we saw fewer cars circling at peak hours. Um, the results were good. Students found spots faster." },
  { title: "Roadmap", bullets: ["Month 1: main gate pilot", "Month 3: full campus rollout", "Month 6: open to other colleges"], weight: 40,
    keyPoints: ["Month 1: main gate pilot", "Month 3: full campus rollout", "Month 6: other colleges"],
    script: "In month 1 we run the main gate pilot. By month 3 we roll out to the full campus. By month 6 we open ParkSense to other colleges.",
    taken: [38, 40], missed: [[], []], off: [[], []],
    transcript: "In month one we run the main gate pilot. By month three we roll out to the full campus. By month six we open ParkSense to other colleges." },
  { title: "Thank you", bullets: ["Our ask: pilot at 2 more campuses", "Questions?"], weight: 30,
    keyPoints: ["State the ask: 2 more campus pilots", "Thank the jury", "Invite questions"],
    script: "Our ask is support to pilot ParkSense at two more campuses. Thank you for your time. We would love to take your questions.",
    taken: [24, 27], missed: [[1], []], off: [[], []],
    transcript: "Our ask is support to pilot ParkSense at two more campuses. Thank you for your time. We would love your questions." },
];

/** Overall + 4 scored sub-scores per attempt (overall satisfies round(.35·coverage + .25·clarity + .2·timing + .2·fillers)). */
export const PARKSENSE_REPORTS = [
  { overall: 62, coverage: 66, clarity: 64, timing: 70, fillers: 45, wpm: 188,
    headline: "A solid first run. Slow down and cover every key point.",
    fixes: ["You spoke at 188 wpm overall. Pause after each key point, especially on slides 4 and 6.", "You used 14 filler words. \"Um\" appeared most on slides 4, 6 and 7.", "You missed 9 key points. The 12 to 3 minute result on slide 6 is your strongest number."],
    well: ["The opening question on slide 1 was clear and engaging.", "Slide 7 landed within 2 seconds of its suggested time.", "Your sentences were complete, with few restarts."] },
  { overall: 74, coverage: 78, clarity: 75, timing: 82, fillers: 58, wpm: 168,
    headline: "Clear and confident. Trim the filler words in the middle.",
    fixes: ["Slide 4 ran at 186 wpm. Pause after naming each sensor detail.", "You said \"basically\" 5 times on slides 2 and 5. Try a short pause instead.", "On slide 3, add the security staff alerts. It was the only key point left out of 3."],
    well: ["Your 5:00 target was met within 4 seconds (5:04 total).", "You covered 21 of 24 key points, up from 15.", "Your opening question on slide 1 was clear and engaging."] },
] as const;

export const TERMS_V3 = `## 1. Using Mock2Pitch
Mock2Pitch is a practice tool for students. You must sign in with a Google account and be at least 18 years old, or have permission from a parent or guardian.

## 2. What you can upload
You may upload PDF slides of up to 10 slides and 5 MB. Upload only material you have the right to use. We do not review, rate or suggest changes to your slide design.

## 3. Your recordings
Audio is recorded one slide at a time, only while you press Record. We never record video. Audio is deleted as soon as your report is generated.

## 4. Fair use
Each student can start up to 5 practice sessions a day, and a presentation can last up to 20 minutes. These limits may change as the product grows.

## 5. AI feedback
Reports are generated by AI and are meant to guide your practice. They are not a grade or an assessment of you as a person.

## 6. Changes to these terms
If we publish a new version you will be asked to accept it again before you continue.`;

export const PRIVACY_V3 = `## 1. What we collect
Your name, email address and profile photo from Google, plus the college, year and branch you enter. We also store your PDF, an image of each slide, your practice sessions, transcripts, scores and the star ratings you give.

## 2. Audio
Your voice is processed only to create your report. Audio is deleted once the report is generated. Reports keep scores, transcripts and feedback, not recordings.

## 3. Who can see your reports
Only you. The product owner can see aggregate usage, your profile details and the star ratings you give to reports.

## 4. AI services
Slide images and transcripts are sent to AI services to create key points, scripts and feedback. They are not used to identify you.

## 5. Your choices
You can edit your profile at any time and delete your account and reports from Settings.`;

export const STUDENT_SEED = [
  ["Ananya Rao", "ananya.rao@gmail.com", "RV Institute of Technology", "3rd year", "CSE", 2, "2026-10-14T05:10:00Z", 68],
  ["Karthik Nair", "karthik.nair@gmail.com", "NIT Calicut", "4th year", "ECE", 7, "2026-10-14T04:00:00Z", 79],
  ["Meera Joshi", "meera.joshi@gmail.com", "COEP Pune", "3rd year", "CSE", 4, "2026-10-13T11:00:00Z", 71],
  ["Arjun Reddy", "arjun.reddy@gmail.com", "VIT Vellore", "4th year", "IT", 11, "2026-10-13T08:30:00Z", 83],
  ["Sneha Patil", "sneha.patil@gmail.com", "PICT Pune", "3rd year", "CSE", 3, "2026-09-28T10:00:00Z", 64],
  ["Rahul Verma", "rahul.verma@gmail.com", "IIIT Lucknow", "4th year", "CSE", 5, "2026-09-27T10:00:00Z", 76],
  ["Divya Menon", "divya.menon@gmail.com", "CET Trivandrum", "3rd year", "EEE", 1, "2026-09-25T10:00:00Z", 58],
  ["Imran Sheikh", "imran.sheikh@gmail.com", "MIT Manipal", "Other", "Mechanical", 2, "2026-09-22T10:00:00Z", 66],
  ["Pooja Kulkarni", "pooja.kulkarni@gmail.com", "BMS College", "4th year", "CSE", 9, "2026-09-20T10:00:00Z", 81],
  ["Vikram Singh", "vikram.singh@gmail.com", "DTU Delhi", "3rd year", "CSE", 0, "2026-09-18T10:00:00Z", null],
] as const;

export const RATING_SEED = [
  ["Ananya Rao", "ParkSense pitch", 5, "The per-slide breakdown showed exactly where I rushed.", "2026-10-02T10:00:00Z"],
  ["Karthik Nair", "IoT demo review", 4, "Useful. I wish the filler list was sorted by slide.", "2026-10-02T08:00:00Z"],
  ["Meera Joshi", "Placement self-intro", 5, "Felt safe practising here. No judgement.", "2026-10-01T10:00:00Z"],
  ["Arjun Reddy", "Final year project", 3, "Score felt low but the tips were fair.", "2026-10-01T07:00:00Z"],
  ["Sneha Patil", "Hackathon pitch", 4, "", "2026-09-29T10:00:00Z"],
  ["Rahul Verma", "Seminar: Edge AI", 5, "Clarity score helped me fix my sentences.", "2026-09-28T10:00:00Z"],
  ["Divya Menon", "Mini project", 2, "Transcript missed a few technical words.", "2026-09-26T10:00:00Z"],
  ["Pooja Kulkarni", "Placement HR round", 4, "Good pacing feedback.", "2026-09-24T10:00:00Z"],
] as const;

export const SESSIONS_PER_DAY_SEED = [18, 24, 22, 31, 28, 35, 41, 38, 46, 52, 49, 58, 61, 66];
export const AI_PER_DAY_SEED: Record<string, number[]> = {
  slide_reading: [120, 80, 160, 200, 160, 240, 200], speech_to_text: [80, 120, 120, 160, 200, 160, 240], report_generation: [160, 160, 240, 200, 280, 320, 280],
};
